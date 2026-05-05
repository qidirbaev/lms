import os
import json
import re
import time
import random
import asyncio
from typing import Any, Dict, Tuple

from google import genai
from google.genai import types as genai_types

from . import config
from . import logger_service as logger
from .validator import validate_output, extract_json_from_text


_client = None

SYSTEM_PROMPT = """
You are an institutional LMS feedback intelligence engine.

Your job is to analyze ONE student feedback record using:
1. raw_text
2. rating
3. course context
4. teacher context
5. student context
6. feedback context

Return ONLY valid JSON.
Do not use markdown.
Do not add explanations outside JSON.
Do not add fields outside the required schema.
Follow the outputFromAI schema exactly.

CRITICAL ANALYSIS PRINCIPLES

1. Evidence-first rule
- The raw_text is the primary evidence.
- Rating and context can adjust confidence, severity, fairness, credibility, and recommended action.
- Context must NEVER create an accusation by itself.
- Never infer corruption, harassment, discrimination, or abuse unless the raw_text explicitly suggests it.

2. Student context usage
Use student_context to improve interpretation:
- Low attendance may reduce confidence if the complaint is vague, broad, or about general difficulty.
- Low GPA may reduce confidence for vague complaints about grading difficulty, but must NOT automatically invalidate the student.
- High GPA + high attendance can increase credibility for specific academic complaints.
- Senior students may provide more credible curriculum/workload feedback.
- First-year students may express adaptation issues; classify vague confusion conservatively.
- Department/group/year help understand scope, but one record is not proof of a systemic issue.
- Gender must not influence sentiment, severity, credibility, or risk unless the text explicitly discusses gender-related discrimination.

3. Rating consistency
- Rating 4–5 usually supports positive or neutral-positive interpretation unless raw_text is clearly negative.
- Rating 1–2 usually supports negative interpretation unless raw_text is clearly positive.
- If text and rating conflict, lower confidence and mention the conflict briefly in summary_uz.
- Rating alone must not create severe risk.

4. Credibility scoring
feedback_credibility.score means how actionable/reliable this single feedback is.
Increase credibility when:
- text is specific
- concrete issue is named
- course/teacher/material/assessment detail is present
- high attendance supports course experience
- rating matches text
Decrease credibility when:
- text is vague
- text is emotional but has no detail
- rating conflicts with text
- attendance is low and complaint is about teaching clarity/attendance-dependent experience
- content looks spammy or irrelevant

Suggested ranges:
- 0.80–1.00: specific, consistent, actionable
- 0.60–0.79: useful but limited
- 0.35–0.59: vague, conflicting, or weak context support
- 0.00–0.34: spam, irrelevant, or not enough evidence

5. Fairness scoring
feedback_fairness.score means how balanced and constructive the feedback is.
Increase fairness when:
- feedback gives a reason
- feedback includes constructive suggestion
- feedback avoids personal attack
Decrease fairness when:
- one-sided blame
- insulting wording
- unsupported accusation
- no actionable detail

6. Severity
Severity describes operational urgency, not emotional tone.
- low: praise, minor issue, vague dissatisfaction
- medium: repeated-feeling complaint, clear academic issue, materials/clarity/communication issue
- high: serious grading fairness concern, strong negative impact, explicit repeated unresolved problem
- critical: explicit corruption, harassment, discrimination, policy violation, or serious safety/system abuse claim

Do NOT mark severity high/critical only because sentiment is negative.

7. Admin attention
requires_admin_attention should be true only when:
- severity is high or critical
- risk.probability >= 0.50
- issue involves fairness_concern with specific evidence
- recommended_action requires human follow-up/escalation

8. Risk rules
Risk types must be empty [] unless explicit evidence exists in raw_text.
Allowed risk types:
- corruption_allegation
- harassment_claim
- grading_bias
- academic_integrity_issue
- discrimination_claim
- policy_violation
- system_abuse
- coordinated_spam

Risk probability:
- 0.00 if no explicit risk
- 0.20–0.49 if weak/ambiguous risk language
- 0.50–0.74 if explicit but limited claim
- 0.75–1.00 if explicit, specific, serious claim

Positive feedback should normally have:
- risk.types = []
- risk.probability = 0.0
- risk.impact_scope = "none"
- severity = "low"
- requires_admin_attention = false
- recommended_action = "no_action_needed"

9. Satisfaction dimensions
Use both text and context.
- teaching_quality: explanation, teacher behavior, teaching method
- clarity: understandability, confusion, explanation quality
- engagement: interest, motivation, boring/interactive
- fairness: grading, equal treatment, bias, transparency
- materials: slides, resources, assignments, LMS content

Scores:
- 0.80–1.00 strong positive
- 0.60–0.79 acceptable
- 0.40–0.59 mixed/unclear
- 0.20–0.39 weak/problematic
- 0.00–0.19 severe problem

10. Language and Uzbek summary
- Detect language as uz, ru, en, or mixed.
- summary_uz must always be in Uzbek.
- summary_uz must include the main conclusion and, when useful, context-aware caution.
- Do not overstate. Use words like "ehtimol", "ko‘rinadi", "aniqlashtirish kerak" for uncertain cases.

11. Lists
- topics max 3
- subtopics max 5
- keywords max 4
- Use short normalized labels, not long sentences.

Return this exact JSON structure:

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
    "types": ["corruption_allegation|harassment_claim|grading_bias|academic_integrity_issue|discrimination_claim|policy_violation|system_abuse|coordinated_spam"],
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
"""

# SYSTEM_PROMPT = """
# You are an LMS feedback analysis engine.

# Return ONLY valid JSON.
# Do not use markdown.
# Do not add explanations outside JSON.
# Follow the outputFromAI schema exactly.

# Rules:
# - Use only allowed enum values.
# - If unsure, choose conservative values.
# - Never invent severe risks without explicit evidence.
# - Positive feedback should normally have no risk.
# - For vague feedback, lower confidence.
# - Uzbek summary must be in Uzbek.
# - Output must be valid JSON object only.
# - topics max 3.
# - subtopics max 5.
# - keywords max 4.

# Return this exact JSON structure:

# {
#   "schema_version": "1.0.0",
#   "feedback_id": "string",
#   "language": "uz|ru|en|mixed",
#   "feedback_credibility": {
#     "score": 0.0
#   },
#   "feedback_fairness": {
#     "score": 0.0,
#     "is_one_sided": false,
#     "has_constructive_tone": false
#   },
#   "sentiment": "positive|neutral|negative",
#   "sentiment_score": 0.0,
#   "emotion": "frustration|confusion|anxiety|anger|boredom|gratitude|curiosity|confidence|inspiration|relief|indifference|disappointment",
#   "emotion_intensity": 0.0,
#   "subtopics": ["string"],
#   "keywords": ["string"],
#   "topics": ["string"],
#   "issue_category": "none|teaching_style|content_quality|assessment|materials|communication|technical_issue|classroom_management|fairness_concern|other",
#   "risk": {
#     "types": ["corruption_allegation|harassment_claim|grading_bias|academic_integrity_issue|discrimination_claim|policy_violation|system_abuse|coordinated_spam"],
#     "probability": 0.0,
#     "impact_scope": "none|course|teacher|department|system"
#   },
#   "satisfaction_dimensions": {
#     "teaching_quality": 0.0,
#     "clarity": 0.0,
#     "engagement": 0.0,
#     "fairness": 0.0,
#     "materials": 0.0
#   },
#   "severity": "low|medium|high|critical",
#   "confidence": 0.0,
#   "summary_uz": "string",
#   "representative_label": "complaint|praise|suggestion|incident|other",
#   "requires_admin_attention": false,
#   "recommended_action": "no_action_needed|monitor_pattern|follow_up_with_student|review_course_materials|provide_teacher_feedback|escalate_to_department|open_formal_review|check_for_policy_violation|request_more_context"
# }
# """


def prepare_google_credentials() -> str:
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON") or config.GOOGLE_SERVICE_ACCOUNT_JSON

    if not raw:
        raise RuntimeError("Missing GOOGLE_SERVICE_ACCOUNT_JSON")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid GOOGLE_SERVICE_ACCOUNT_JSON: {exc}") from exc

    if "private_key" in data:
        data["private_key"] = data["private_key"].replace("\\n", "\n")

    path = "/tmp/gcp-sa.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = path
    return path


def get_genai_client():
    global _client

    if _client is None:
        prepare_google_credentials()

        project = os.getenv("GOOGLE_CLOUD_PROJECT") or config.GOOGLE_CLOUD_PROJECT
        location = os.getenv("GOOGLE_CLOUD_LOCATION") or config.GOOGLE_CLOUD_LOCATION or "global"

        if not project:
            raise RuntimeError("Missing GOOGLE_CLOUD_PROJECT")

        _client = genai.Client(
            vertexai=True,
            project=project,
            location=location,
        )

        logger.info("vertex_genai_client_ready", {
            "project": project,
            "location": location,
            "model": os.getenv("VERTEX_MODEL") or config.VERTEX_MODEL,
        })

    return _client


def build_context_signals(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    content = input_to_system.get("content", {}) or {}
    metadata = input_to_system.get("metadata", {}) or {}

    student_context = metadata.get("student_context", {}) or {}
    feedback_context = metadata.get("feedback_context") or input_to_system.get("feedback_context", {}) or {}
    course_context = metadata.get("course_context") or input_to_system.get("course_context", {}) or {}
    teacher_context = metadata.get("teacher_context") or input_to_system.get("teacher_context", {}) or {}

    text = str(content.get("raw_text", "") or "")
    rating = content.get("rating")

    try:
      rating_num = float(rating) if rating is not None else None
    except Exception:
      rating_num = None

    try:
      attendance = float(
          student_context.get("course_attendance_rate")
          if student_context.get("course_attendance_rate") is not None
          else student_context.get("attendance_rate")
      )
    except Exception:
      attendance = None

    try:
      gpa = float(student_context.get("gpa"))
    except Exception:
      gpa = None

    try:
      year = int(student_context.get("year"))
    except Exception:
      year = None

    text_len = len(text.strip())
    word_count = len(text.split())

    vague_markers = [
        "yomon", "zo'r emas", "yoqmadi", "tushunmadim", "qiyin",
        "bad", "not good", "hard", "unclear",
        "плохо", "сложно", "непонятно"
    ]

    specific_markers = [
        "baho", "ball", "imtihon", "slayd", "material", "deadline", "topshiriq",
        "platforma", "login", "xato", "dars", "amaliy", "laboratoriya",
        "grade", "exam", "assignment", "material", "teacher", "lesson"
    ]

    risk_markers = [
        "pora", "pul so'radi", "pul soradi", "korrupsiya",
        "haqorat", "kamsit", "tahdid", "bosim",
        "corruption", "bribe", "harassment", "discrimination"
    ]

    is_vague = word_count < 7 or (
        any(m in text.lower() for m in vague_markers)
        and not any(m in text.lower() for m in specific_markers)
    )

    has_specific_evidence = any(m in text.lower() for m in specific_markers) or word_count >= 14
    has_explicit_risk_language = any(m in text.lower() for m in risk_markers)

    rating_band = "unknown"
    if rating_num is not None:
        if rating_num <= 2:
            rating_band = "low"
        elif rating_num == 3:
            rating_band = "middle"
        else:
            rating_band = "high"

    attendance_band = "unknown"
    if attendance is not None:
        if attendance < 0.45:
            attendance_band = "low"
        elif attendance < 0.75:
            attendance_band = "medium"
        else:
            attendance_band = "high"

    gpa_band = "unknown"
    if gpa is not None:
        if gpa < 2.5:
            gpa_band = "low"
        elif gpa < 3.5:
            gpa_band = "medium"
        else:
            gpa_band = "high"

    academic_maturity = "unknown"
    if year is not None:
        if year <= 1:
            academic_maturity = "first_year"
        elif year >= 4:
            academic_maturity = "senior"
        else:
            academic_maturity = "middle_year"

    return {
        "text_quality": {
            "text_length": text_len,
            "word_count": word_count,
            "is_vague": is_vague,
            "has_specific_evidence": has_specific_evidence,
            "has_explicit_risk_language": has_explicit_risk_language,
        },
        "rating_context": {
            "rating_band": rating_band,
            "rating_text_alignment_instruction": "If rating conflicts with text, lower confidence and mention uncertainty in summary_uz."
        },
        "student_context_interpretation": {
            "attendance_band": attendance_band,
            "gpa_band": gpa_band,
            "academic_maturity": academic_maturity,
            "fairness_warning": "Do not penalize the student automatically. Use GPA/attendance only as weak context for confidence and credibility.",
            "gender_rule": "Gender must not affect scoring unless raw_text explicitly discusses gender-related discrimination."
        },
        "institutional_scope_instruction": {
            "single_feedback_limit": "One feedback item is not enough to conclude teacher/course/system-wide failure.",
            "risk_rule": "Only explicit raw_text evidence may create risk types or high/critical severity."
        },
        "available_context_flags": {
            "has_course_context": bool(course_context),
            "has_teacher_context": bool(teacher_context),
            "has_student_context": bool(student_context),
            "is_anonymous": feedback_context.get("is_anonymous"),
        }
    }


def build_input_to_ai(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    content = input_to_system.get("content", {}) or {}
    metadata = input_to_system.get("metadata", {}) or {}

    # Support both schema styles:
    # 1) nested inside metadata
    # 2) top-level feedback_context/course_context/teacher_context
    student_context = metadata.get("student_context", {}) or {}
    feedback_context = metadata.get("feedback_context") or input_to_system.get("feedback_context", {}) or {}
    course_context = metadata.get("course_context") or input_to_system.get("course_context", {}) or {}
    teacher_context = metadata.get("teacher_context") or input_to_system.get("teacher_context", {}) or {}
    context_signals = build_context_signals(input_to_system)

    return {
        "feedback_id": input_to_system.get("feedback_id"),
        "raw_text": content.get("raw_text", ""),
        "rating": content.get("rating"),

        "timestamp": metadata.get("timestamp"),
        "semester_id": metadata.get("semester_id"),

        "course": {
            "course_id": metadata.get("course_id"),
            "course_name": course_context.get("course_name"),
            "course_level": course_context.get("course_level"),
            "course_delivery_mode": course_context.get("course_delivery_mode"),
        },

        "teacher": {
            "teacher_id": metadata.get("teacher_id"),
            "teacher_fullname": metadata.get("teacher_fullname"),
            "teacher_role": teacher_context.get("teacher_role"),
            "teaching_experience_years": teacher_context.get("teaching_experience_years"),
            "teacher_department_id": teacher_context.get("teacher_department_id"),
        },

        "student_context": {
            "year": student_context.get("year"),
            "gender": student_context.get("gender"),
            "group_id": student_context.get("group_id"),
            "department_name": (
                student_context.get("department_name")
                or student_context.get("department")
                or metadata.get("department")
            ),
            "course_points": student_context.get("course_points"),
            "gpa": student_context.get("gpa"),
            "course_attendance_rate": (
                student_context.get("course_attendance_rate")
                or student_context.get("attendance_rate")
            ),
        },

        "feedback_context": {
            "feedback_channel": feedback_context.get("feedback_channel"),
            "is_anonymous": feedback_context.get("is_anonymous"),
        },
        
        "context_signals": context_signals,
    }


def extract_json(text: str) -> Dict[str, Any]:
    return extract_json_from_text(text)


async def call_vertex_genai_once(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    client = get_genai_client()

    model = os.getenv("VERTEX_MODEL") or config.VERTEX_MODEL or "gemini-3.1-flash-lite-preview"
    temperature = float(os.getenv("MODEL_TEMPERATURE", str(config.MODEL_TEMPERATURE)))
    max_tokens = int(os.getenv("MODEL_MAX_TOKENS", str(config.MODEL_MAX_TOKENS)))

    input_to_ai = build_input_to_ai(input_to_system)
    feedback_id = input_to_ai.get("feedback_id") or input_to_system.get("feedback_id") or "unknown"

    prompt = json.dumps(
        {
            "task": "Analyze this LMS feedback and return outputFromAI JSON only.",
            "inputToAI": input_to_ai,
        },
        ensure_ascii=False,
    )

    response = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=temperature,
            max_output_tokens=max_tokens,
            thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
        ),
    )

    raw = (response.text or "").strip()

    return {
        "feedback_id": feedback_id,
        "input_to_ai": input_to_ai,
        "raw_output": raw,
        "parsed_raw": extract_json(raw),
    }


_loop = None


def get_reusable_loop():
    global _loop

    if _loop is None or _loop.is_closed():
        _loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_loop)

    return _loop


def call_vertex_genai_sync(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    loop = get_reusable_loop()
    return loop.run_until_complete(call_vertex_genai_once(input_to_system))


def mock_analyze(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    input_to_ai = build_input_to_ai(input_to_system)
    feedback_id = input_to_ai.get("feedback_id") or input_to_system.get("feedback_id") or "mock-feedback"
    text = (input_to_ai.get("raw_text") or "").lower()
    rating = input_to_ai.get("rating")

    positive_words = ["rahmat", "zo'r", "zor", "yaxshi", "ajoyib", "tushunarli", "yoqdi", "excellent", "good"]
    negative_words = ["yomon", "qiyin", "tushunarsiz", "adolatsiz", "nohaq", "muammo", "zerikarli", "shikoyat", "bad"]
    assessment_words = ["baho", "baholash", "ball", "imtihon", "test", "grading", "assessment"]
    technical_words = ["platforma", "login", "xato", "texnik", "server", "lms", "kirmayapti"]
    corruption_words = ["pora", "pul so'radi", "pul soradi", "korrupsiya", "corruption"]
    harassment_words = ["haqorat", "qo'pol", "qopol", "kamsit", "bosim", "harassment"]

    pos = any(w in text for w in positive_words)
    neg = any(w in text for w in negative_words)

    if neg and not pos:
        sentiment = "negative"
        sentiment_score = 0.25
        emotion = "frustration"
        severity = "medium"
        label = "complaint"
    elif pos and not neg:
        sentiment = "positive"
        sentiment_score = 0.85
        emotion = "gratitude"
        severity = "low"
        label = "praise"
    else:
        sentiment = "neutral"
        sentiment_score = 0.55
        emotion = "indifference"
        severity = "low"
        label = "suggestion"

    if isinstance(rating, (int, float)):
        sentiment_score = max(0.0, min(1.0, rating / 5))

    issue_category = "other"
    topics = []
    keywords = []

    if any(w in text for w in assessment_words):
        issue_category = "assessment"
        topics.append("assessment")
        keywords.extend(["baholash", "ball"])
    elif any(w in text for w in technical_words):
        issue_category = "technical_issue"
        topics.append("technical_issue")
        keywords.extend(["platforma", "lms"])
    elif "material" in text or "slayd" in text or "resurs" in text:
        issue_category = "materials"
        topics.append("materials")
        keywords.extend(["material"])
    elif "tushuntir" in text or "dars" in text:
        issue_category = "teaching_style"
        topics.append("teaching_style")
        keywords.extend(["dars", "tushuntirish"])
    elif sentiment == "positive":
        issue_category = "none"
        topics.append("positive_feedback")
        keywords.extend(["yaxshi"])

    risk_types = []
    risk_probability = 0.0
    impact_scope = "none"

    if any(w in text for w in corruption_words):
        risk_types.append("corruption_allegation")
        risk_probability = 0.8
        impact_scope = "teacher"
        severity = "critical"
    elif any(w in text for w in harassment_words):
        risk_types.append("harassment_claim")
        risk_probability = 0.75
        impact_scope = "teacher"
        severity = "high"
    elif "adolatsiz" in text or "nohaq" in text:
        risk_types.append("grading_bias")
        risk_probability = 0.55
        impact_scope = "course"
        severity = "high"

    if risk_types:
        requires_admin_attention = True
        recommended_action = "open_formal_review" if severity == "critical" else "escalate_to_department"
    elif issue_category == "assessment":
        requires_admin_attention = False
        recommended_action = "monitor_pattern"
    elif issue_category == "technical_issue":
        requires_admin_attention = False
        recommended_action = "request_more_context"
    elif sentiment == "positive":
        requires_admin_attention = False
        recommended_action = "no_action_needed"
    else:
        requires_admin_attention = False
        recommended_action = "monitor_pattern"

    raw_output = {
        "schema_version": "1.0.0",
        "feedback_id": feedback_id,
        "language": "uz",
        "feedback_credibility": {"score": 0.65},
        "feedback_fairness": {
            "score": 0.65,
            "is_one_sided": sentiment == "negative",
            "has_constructive_tone": "kerak" in text or "yaxshi bo'lardi" in text or "taklif" in text,
        },
        "sentiment": sentiment,
        "sentiment_score": sentiment_score,
        "emotion": emotion,
        "emotion_intensity": 0.55 if sentiment != "neutral" else 0.3,
        "subtopics": topics[:5],
        "keywords": keywords[:10],
        "topics": topics[:3],
        "issue_category": issue_category,
        "risk": {
            "types": risk_types,
            "probability": risk_probability,
            "impact_scope": impact_scope,
        },
        "satisfaction_dimensions": {
            "teaching_quality": 0.8 if sentiment == "positive" else 0.45,
            "clarity": 0.75 if "tushunarli" in text or sentiment == "positive" else 0.45,
            "engagement": 0.7 if sentiment == "positive" else 0.5,
            "fairness": 0.35 if issue_category == "assessment" or risk_types else 0.7,
            "materials": 0.55,
        },
        "severity": severity,
        "confidence": 0.62,
        "summary_uz": (
            "Talaba ijobiy fikr bildirgan."
            if sentiment == "positive"
            else "Talaba muammo yoki aniqlashtirish kerak bo'lgan holat haqida fikr bildirgan."
        ),
        "representative_label": label,
        "requires_admin_attention": requires_admin_attention,
        "recommended_action": recommended_action,
    }

    return {
        "input_to_ai": input_to_ai,
        "raw_output": json.dumps(raw_output, ensure_ascii=False),
        "parsed_raw": raw_output,
    }


def apply_context_guardrails(output: Dict[str, Any], input_to_system: Dict[str, Any]) -> Tuple[Dict[str, Any], list]:
    corrections = []
    guarded = dict(output)

    input_to_ai = build_input_to_ai(input_to_system)
    signals = input_to_ai.get("context_signals", {})
    text_quality = signals.get("text_quality", {})
    rating_context = signals.get("rating_context", {})
    student_interp = signals.get("student_context_interpretation", {})

    is_vague = bool(text_quality.get("is_vague"))
    has_specific_evidence = bool(text_quality.get("has_specific_evidence"))
    has_explicit_risk_language = bool(text_quality.get("has_explicit_risk_language"))
    rating_band = rating_context.get("rating_band")
    attendance_band = student_interp.get("attendance_band")

    risk = guarded.get("risk", {}) or {}
    risk_types = risk.get("types", []) or []
    risk_probability = float(risk.get("probability", 0.0) or 0.0)

    # No explicit risk text => no formal risk.
    if not has_explicit_risk_language and risk_types:
        guarded["risk"] = {
            "types": [],
            "probability": 0.0,
            "impact_scope": "none",
        }
        corrections.append("context_guardrail: removed risk because raw_text has no explicit risk evidence")

    # Vague feedback must not become high/critical.
    if is_vague and guarded.get("severity") in {"high", "critical"}:
        guarded["severity"] = "medium" if guarded.get("sentiment") == "negative" else "low"
        guarded["requires_admin_attention"] = False
        if guarded.get("recommended_action") in {"open_formal_review", "escalate_to_department", "check_for_policy_violation"}:
            guarded["recommended_action"] = "request_more_context"
        corrections.append("context_guardrail: reduced severity for vague feedback")

    # Positive/high-rating feedback should not get admin escalation without explicit risk.
    if guarded.get("sentiment") == "positive" and rating_band == "high" and not has_explicit_risk_language:
        guarded["severity"] = "low"
        guarded["requires_admin_attention"] = False
        guarded["recommended_action"] = "no_action_needed"
        guarded["risk"] = {
            "types": [],
            "probability": 0.0,
            "impact_scope": "none",
        }
        corrections.append("context_guardrail: normalized positive high-rating feedback")

    # Low attendance + vague complaint => lower confidence/credibility, not automatic rejection.
    if attendance_band == "low" and is_vague:
        guarded["confidence"] = min(float(guarded.get("confidence", 0.7) or 0.7), 0.55)

        cred = guarded.get("feedback_credibility", {}) or {}
        cred["score"] = min(float(cred.get("score", 0.6) or 0.6), 0.50)
        guarded["feedback_credibility"] = cred

        if guarded.get("recommended_action") in {"open_formal_review", "escalate_to_department"}:
            guarded["recommended_action"] = "request_more_context"

        corrections.append("context_guardrail: lowered confidence for vague feedback with low attendance context")

    # Specific negative fairness complaint can remain serious, but not critical unless explicit risk.
    if (
        guarded.get("issue_category") == "fairness_concern"
        and guarded.get("severity") == "critical"
        and not has_explicit_risk_language
    ):
        guarded["severity"] = "high" if has_specific_evidence else "medium"
        guarded["recommended_action"] = "follow_up_with_student" if has_specific_evidence else "request_more_context"
        corrections.append("context_guardrail: reduced critical fairness concern without explicit policy/risk evidence")

    # Admin attention consistency.
    final_risk = guarded.get("risk", {}) or {}
    final_risk_prob = float(final_risk.get("probability", 0.0) or 0.0)
    if guarded.get("severity") in {"high", "critical"} or final_risk_prob >= 0.5:
        guarded["requires_admin_attention"] = True
    elif guarded.get("recommended_action") in {"open_formal_review", "escalate_to_department", "check_for_policy_violation"}:
        guarded["requires_admin_attention"] = True
    else:
        guarded["requires_admin_attention"] = False

    return guarded, corrections


def analyze_feedback(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main function expected by app.py.

    Returns:
    {
      input_to_ai,
      output,
      raw_output,
      provider,
      used_fallback,
      corrections
    }
    """
    feedback_id = input_to_system.get("feedback_id", "unknown")
    provider = config.AI_PROVIDER

    if provider == "mock":
        result = mock_analyze(input_to_system)
        output, corrections = validate_output(result["parsed_raw"], feedback_id)
        output, guardrail_corrections = apply_context_guardrails(output, input_to_system)
        corrections.extend(guardrail_corrections)
        
        if corrections:
            logger.info("validation_corrections", {"feedback_id": feedback_id, "corrections": corrections})
        return {
            "input_to_ai": result["input_to_ai"],
            "output": output,
            "raw_output": result["raw_output"],
            "provider": "mock",
            "used_fallback": False,
            "corrections": corrections,
        }

    last_error = None
    max_retries = max(1, int(config.MAX_RETRIES) + 1)

    for attempt in range(1, max_retries + 1):
        try:
            logger.info("gemma_call_start", {"feedback_id": feedback_id, "attempt": attempt})
            result = call_vertex_genai_sync(input_to_system)
            output, corrections = validate_output(result["parsed_raw"], feedback_id)
            output, guardrail_corrections = apply_context_guardrails(output, input_to_system)
            corrections.extend(guardrail_corrections)

            logger.info("gemma_call_success", {"feedback_id": feedback_id, "attempt": attempt})
            if corrections:
                logger.info("validation_corrections", {"feedback_id": feedback_id, "corrections": corrections})

            return {
                "input_to_ai": result["input_to_ai"],
                "output": output,
                "raw_output": result["raw_output"],
                "provider": "vertex_genai",
                "used_fallback": False,
                "corrections": corrections,
            }

        except Exception as e:
            last_error = e
            logger.warn("gemma_call_failed", {
                "feedback_id": feedback_id,
                "attempt": attempt,
                "error": str(e),
            })

            if attempt < max_retries:
                # exponential backoff + jitter
                time.sleep((1.5 ** attempt) + random.uniform(0.1, 0.7))

    if config.FALLBACK_TO_MOCK:
        logger.warn("gemma_fallback_to_mock", {
            "feedback_id": feedback_id,
            "reason": str(last_error),
        })
        result = mock_analyze(input_to_system)
        output, corrections = validate_output(result["parsed_raw"], feedback_id)
        output, guardrail_corrections = apply_context_guardrails(output, input_to_system)
        corrections.extend(guardrail_corrections)

        return {
            "input_to_ai": result["input_to_ai"],
            "output": output,
            "raw_output": result["raw_output"],
            "provider": "mock",
            "used_fallback": True,
            "corrections": corrections,
        }

    raise RuntimeError(f"Gemini analysis failed and fallback disabled: {last_error}")