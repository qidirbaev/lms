import json
import os
import re
import time
import random
from . import config
from .validator import extract_json_from_text, validate_output
from . import logger_service as logger

SYSTEM_PROMPT = """You are an LMS feedback analysis engine for a university system.

Return ONLY valid JSON. No markdown. No text outside JSON. No explanation.

Analyze the provided LMS student feedback and return this EXACT outputFromAI JSON structure:

{
  "schema_version": "1.0.0",
  "feedback_id": "string",
  "language": "uz|ru|en|mixed",
  "feedback_credibility": {
    "score": 0.0
  },
  "feedback_fairness": {
    "score": 0.0,
    "is_one_sided": false,
    "has_constructive_tone": false
  },
  "sentiment": "positive|neutral|negative",
  "sentiment_score": 0.0,
  "emotion": "frustration|confusion|anxiety|anger|boredom|gratitude|curiosity|confidence|inspiration|relief|indifference|disappointment",
  "emotion_intensity": 0.0,
  "subtopics": ["string"],
  "keywords": ["string"],
  "topics": ["string"],
  "issue_category": "none|teaching_style|content_quality|assessment|materials|communication|technical_issue|classroom_management|fairness_concern|other",
  "risk": {
    "types": [],
    "probability": 0.0,
    "impact_scope": "none|course|teacher|department|system"
  },
  "satisfaction_dimensions": {
    "teaching_quality": 0.0,
    "clarity": 0.0,
    "engagement": 0.0,
    "fairness": 0.0,
    "materials": 0.0
  },
  "severity": "low|medium|high|critical",
  "confidence": 0.0,
  "summary_uz": "string",
  "representative_label": "complaint|praise|suggestion|incident|other",
  "requires_admin_attention": false,
  "recommended_action": "no_action_needed|monitor_pattern|follow_up_with_student|review_course_materials|provide_teacher_feedback|escalate_to_department|open_formal_review|check_for_policy_violation|request_more_context"
}

STRICT RULES:
- Return ONLY the JSON object. No markdown. No preamble.
- language: detect the actual language of raw_text (uz=Uzbek, ru=Russian, en=English, mixed=multiple)
- sentiment_score: 0.0 = very negative, 0.5 = neutral, 1.0 = very positive
- emotion_intensity: 0.0 to 1.0
- topics: max 3 items
- subtopics: max 5 items
- keywords: max 10 items (extract actual words from the feedback)
- risk.types: [] if no risk detected. NEVER invent risk without explicit evidence.
- Positive feedback normally has risk.probability=0.0 and risk.types=[]
- If risk.types is empty, risk.probability MUST be 0.0 and impact_scope MUST be "none"
- For vague feedback: lower confidence (0.4-0.6)
- For clear positive: confidence 0.8+, sentiment=positive, severity=low
- summary_uz: write 1-2 sentences summarizing the feedback IN UZBEK LANGUAGE
- severity=critical ONLY for explicit corruption/harassment allegations
- requires_admin_attention=true ONLY for high/critical severity or explicit risk
"""


def build_input_to_ai(input_to_system: dict) -> dict:
    """Convert inputToSystem to the minimal inputToAI format sent to the model."""
    meta = input_to_system.get("metadata", {}) or {}
    content = input_to_system.get("content", {}) or {}
    ctx = input_to_system.get("course_context") or meta.get("course_context", {}) or {}
    fctx = input_to_system.get("feedback_context") or meta.get("feedback_context", {}) or {}
    tctx = input_to_system.get("teacher_context") or meta.get("teacher_context", {}) or {}
    sc = meta.get("student_context", {}) or {}

    return {
        "schema_version": "1.0.0",
        "feedback_id": input_to_system.get("feedback_id", "unknown"),
        "content": {
            "raw_text": content.get("raw_text", ""),
        },
        "context": {
            "rating": content.get("rating"),
            "course_id": meta.get("course_id"),
            "teacher_id": meta.get("teacher_id"),
            "teacher_fullname": meta.get("teacher_fullname"),
            "feedback_channel": fctx.get("feedback_channel"),
            "is_anonymous": fctx.get("is_anonymous"),
            "course_name": ctx.get("course_name"),
            "course_level": ctx.get("course_level"),
            "course_delivery_mode": ctx.get("course_delivery_mode"),
            "teacher_role": tctx.get("teacher_role"),
            "student_year": sc.get("year"),
            "department": sc.get("department_name") or sc.get("department"),
            "group_id": sc.get("group_id"),
            "gpa": sc.get("gpa"),
            "attendance_rate": sc.get("course_attendance_rate") if sc.get("course_attendance_rate") is not None else sc.get("attendance_rate"),
            "course_points": sc.get("course_points"),
        },
    }


def _get_access_token() -> str:
    sa_json = config.GOOGLE_SERVICE_ACCOUNT_JSON
    if not sa_json:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is not set")
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
        info = json.loads(sa_json)
        # Fix escaped newlines in private key
        if "private_key" in info:
            info["private_key"] = info["private_key"].replace("\\n", "\n")
        creds = service_account.Credentials.from_service_account_info(
            info,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        creds.refresh(Request())
        return creds.token
    except Exception as e:
        raise RuntimeError(f"Failed to get access token: {e}")


def _call_gemma_once(input_to_ai: dict) -> str:
    """Make a single call to Vertex AI Gemma. Returns raw text."""
    import requests as req_lib

    token = _get_access_token()
    url = config.VERTEX_ENDPOINT.format(
        project=config.GOOGLE_CLOUD_PROJECT,
        location=config.GOOGLE_CLOUD_LOCATION,
    )
    user_prompt = json.dumps({
        "task": "Analyze this LMS feedback and return outputFromAI JSON.",
        "inputToAI": input_to_ai,
    }, ensure_ascii=False)

    body = {
        "model": config.VERTEX_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": config.MODEL_TEMPERATURE,
        "stream": False,
        "max_tokens": config.MODEL_MAX_TOKENS,
    }

    resp = req_lib.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=config.REQUEST_TIMEOUT,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"Gemma HTTP {resp.status_code}: {resp.text[:500]}")

    data = resp.json()
    return data["choices"][0]["message"]["content"]


def _call_gemma_with_retry(input_to_ai: dict) -> tuple[str, bool]:
    """Returns (raw_text, used_fallback)."""
    feedback_id = input_to_ai.get("feedback_id", "?")
    last_err = None
    for attempt in range(config.MAX_RETRIES + 1):
        try:
            logger.info("gemma_call_start", {"feedback_id": feedback_id, "attempt": attempt + 1})
            raw = _call_gemma_once(input_to_ai)
            logger.info("gemma_call_success", {"feedback_id": feedback_id, "attempt": attempt + 1})
            return raw, False
        except Exception as e:
            last_err = e
            logger.warn("gemma_call_failed", {"feedback_id": feedback_id, "attempt": attempt + 1, "error": str(e)})
            if attempt < config.MAX_RETRIES:
                time.sleep(1.5 * (attempt + 1))

    if config.FALLBACK_TO_MOCK:
        logger.warn("gemma_fallback_to_mock", {"feedback_id": feedback_id, "reason": str(last_err)})
        return _mock_analysis_raw(input_to_ai), True

    raise RuntimeError(f"Gemma failed after {config.MAX_RETRIES + 1} attempts: {last_err}")


# ─── Mock Analyzer ─────────────────────────────────────────────────────────────

_POSITIVE_WORDS = {
    "rahmat", "zo'r", "yaxshi", "ajoyib", "foydali", "minnatdorman",
    "mamnun", "zo'r", "professional", "tajribali", "qiziqarli",
    "samarali", "a'lo", "mukammal", "ilhom",
}
_NEGATIVE_WORDS = {
    "adolatsiz", "nohaqlik", "past", "tushunarsiz", "qiyin", "muammo",
    "yomon", "noto'g'ri", "noqulay", "zerik", "kelmaydi", "eskirgan",
    "shovqin", "kamsitadi", "stress",
}
_RISK_WORDS = {
    "pora", "korrupsiya", "pul", "aldash", "haqorat", "tahdid",
    "adolatsiz ball", "spam", "soxta", "manipulyatsiya",
}
_ASSESSMENT_WORDS = {"ball", "imtihon", "baholash", "mezon", "adolat", "hisoblash"}
_TECH_WORDS = {"platforma", "login", "texnik", "internet", "video", "server", "ishlamaydi"}
_CONTENT_WORDS = {"darslik", "material", "eskirgan", "yangi", "dolzarb", "manba"}
_TEACHING_WORDS = {"tushuntirib", "tushunarsiz", "uslub", "metod", "jadal", "tez"}
_HARASSMENT_WORDS = {"haqorat", "kamsitadi", "hurmatsizlik", "bosim", "qo'rqitish"}
_GRADING_WORDS = {"ball past", "nohaqlik", "adolatsiz baholash", "mezon noaniq"}


def _mock_analysis_raw(input_to_ai: dict) -> str:
    """Generate deterministic mock analysis as JSON string."""
    feedback_id = input_to_ai.get("feedback_id", "fb-000")
    raw_text = input_to_ai.get("content", {}).get("raw_text", "").lower()
    rating = input_to_ai.get("context", {}).get("rating") or 3
    words = set(raw_text.split())

    # Scoring
    pos_hits = len(_POSITIVE_WORDS & words)
    neg_hits = len(_NEGATIVE_WORDS & words)
    risk_hits = any(rw in raw_text for rw in _RISK_WORDS)
    harassment_hits = any(h in raw_text for h in _HARASSMENT_WORDS)
    assessment_hits = len(_ASSESSMENT_WORDS & words)
    tech_hits = len(_TECH_WORDS & words)
    content_hits = len(_CONTENT_WORDS & words)
    teaching_hits = len(_TEACHING_WORDS & words)

    # Sentiment
    if pos_hits > neg_hits or int(rating) >= 4:
        sentiment = "positive"
        sentiment_score = min(0.95, 0.65 + pos_hits * 0.05 + (int(rating) - 3) * 0.1)
        emotion = random.choice(["gratitude", "confidence", "inspiration"])
        severity = "low"
        label = "praise"
        action = "no_action_needed"
        requires_admin = False
    elif neg_hits > pos_hits or int(rating) <= 2:
        sentiment = "negative"
        sentiment_score = max(0.05, 0.4 - neg_hits * 0.05 - (3 - int(rating)) * 0.1)
        emotion = random.choice(["frustration", "disappointment", "anger"])
        severity = "medium"
        label = "complaint"
        action = "provide_teacher_feedback"
        requires_admin = False
    else:
        sentiment = "neutral"
        sentiment_score = 0.5
        emotion = random.choice(["indifference", "curiosity", "confusion"])
        severity = "low"
        label = "suggestion"
        action = "no_action_needed"
        requires_admin = False

    # Issue category
    if risk_hits or harassment_hits:
        issue = "fairness_concern"
        severity = "high"
        action = "escalate_to_department"
        requires_admin = True
    elif assessment_hits > 0:
        issue = "assessment"
    elif tech_hits > 0:
        issue = "technical_issue"
    elif content_hits > 0:
        issue = "content_quality"
    elif teaching_hits > 0:
        issue = "teaching_style"
    else:
        issue = "none" if sentiment == "positive" else "other"

    # Risk
    risk_types = []
    risk_prob = 0.0
    risk_scope = "none"
    if harassment_hits:
        risk_types = ["harassment_claim"]
        risk_prob = 0.7
        risk_scope = "teacher"
        severity = "critical"
        requires_admin = True
    elif risk_hits:
        risk_types = ["grading_bias"]
        risk_prob = 0.55
        risk_scope = "teacher"
        requires_admin = True

    # Satisfaction dims
    tq = min(1.0, 0.5 + pos_hits * 0.1 - neg_hits * 0.08 + (int(rating) - 3) * 0.1)
    cl = min(1.0, tq - 0.05 + (0 if teaching_hits == 0 else -0.1))
    en = min(1.0, tq + 0.03)
    fa = min(1.0, 0.5 - (0.15 if assessment_hits > 0 or risk_hits else 0))
    ma = min(1.0, 0.5 + (0 if content_hits == 0 else -0.15) + pos_hits * 0.05)

    # Summary in Uzbek
    if sentiment == "positive":
        summary = f"Talaba kurs va o'qituvchi haqida ijobiy fikr bildirgan. Ball: {rating}/5."
    elif sentiment == "negative":
        summary = f"Talaba muammo va kamchiliklar haqida shikoyat qilgan. Ball: {rating}/5."
    else:
        summary = f"Talaba kurs haqida aralash fikr bildirgan. Ball: {rating}/5."

    # Topics/keywords
    kw_pool = []
    for w in raw_text.split():
        if len(w) > 4:
            kw_pool.append(w.strip(".,!?;:"))
    keywords = list(dict.fromkeys(kw_pool))[:10]
    topics = []
    if issue != "none" and issue != "other":
        topics.append(issue.replace("_", " "))
    if sentiment != "neutral":
        topics.append(f"{sentiment} experience")
    topics = topics[:3]

    subtopics = []
    if assessment_hits:
        subtopics.append("grading process")
    if tech_hits:
        subtopics.append("platform issues")
    if teaching_hits:
        subtopics.append("teaching method")
    subtopics = subtopics[:5]

    confidence = 0.75 if len(raw_text) > 50 else 0.55

    output = {
        "schema_version": "1.0.0",
        "feedback_id": feedback_id,
        "language": "uz",
        "feedback_credibility": {"score": round(0.5 + pos_hits * 0.05 + (int(rating) - 3) * 0.05, 2)},
        "feedback_fairness": {
            "score": round(max(0.1, 0.6 - neg_hits * 0.05), 2),
            "is_one_sided": neg_hits > 2 or pos_hits > 2,
            "has_constructive_tone": "kerak" in raw_text or "qo'shilsa" in raw_text,
        },
        "sentiment": sentiment,
        "sentiment_score": round(max(0.0, min(1.0, sentiment_score)), 3),
        "emotion": emotion,
        "emotion_intensity": round(min(1.0, 0.5 + abs(neg_hits - pos_hits) * 0.1), 2),
        "subtopics": subtopics,
        "keywords": keywords,
        "topics": topics,
        "issue_category": issue,
        "risk": {
            "types": risk_types,
            "probability": round(risk_prob, 2),
            "impact_scope": risk_scope,
        },
        "satisfaction_dimensions": {
            "teaching_quality": round(max(0.0, min(1.0, tq)), 2),
            "clarity": round(max(0.0, min(1.0, cl)), 2),
            "engagement": round(max(0.0, min(1.0, en)), 2),
            "fairness": round(max(0.0, min(1.0, fa)), 2),
            "materials": round(max(0.0, min(1.0, ma)), 2),
        },
        "severity": severity,
        "confidence": round(confidence, 2),
        "summary_uz": summary,
        "representative_label": label,
        "requires_admin_attention": requires_admin,
        "recommended_action": action,
    }
    return json.dumps(output, ensure_ascii=False)


def analyze_feedback(input_to_system: dict) -> dict:
    """
    Full pipeline: inputToSystem → inputToAI → AI call → validate → return.
    Returns dict with: input_to_ai, raw_output, output, corrections, used_fallback, provider
    """
    input_to_ai = build_input_to_ai(input_to_system)
    feedback_id = input_to_ai.get("feedback_id", "unknown")

    used_fallback = False
    provider = config.AI_PROVIDER

    try:
        if config.AI_PROVIDER == "gemma":
            raw_text, used_fallback = _call_gemma_with_retry(input_to_ai)
            if used_fallback:
                provider = "mock_fallback"
        else:
            raw_text = _mock_analysis_raw(input_to_ai)
            provider = "mock"
    except Exception as e:
        logger.error("analyze_feedback_failed", {"feedback_id": feedback_id, "error": str(e)})
        raise

    try:
        raw_dict = extract_json_from_text(raw_text)
    except Exception as e:
        logger.error("json_extract_failed", {"feedback_id": feedback_id, "error": str(e)})
        # Last resort: use mock
        raw_text = _mock_analysis_raw(input_to_ai)
        raw_dict = extract_json_from_text(raw_text)
        used_fallback = True
        provider = "mock_fallback"

    normalized, corrections = validate_output(raw_dict, feedback_id)

    if corrections:
        logger.info("validation_corrections", {"feedback_id": feedback_id, "corrections": corrections})

    return {
        "input_to_ai": input_to_ai,
        "raw_output": raw_text,
        "output": normalized,
        "corrections": corrections,
        "used_fallback": used_fallback,
        "provider": provider,
    }