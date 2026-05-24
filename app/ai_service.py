import os
import json
import re
import time
import random
import asyncio
import tempfile
from pathlib import Path
from typing import Any, Dict, Tuple, List

try:
    from google import genai
    from google.genai import types as genai_types
except Exception:
    genai = None
    genai_types = None

from . import config
from . import logger_service as logger
from . import schema_service
from .deterministic_scoring import apply_deterministic_scores
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

0. Deterministic scoring policy
- You classify categorical evidence only: language, sentiment label, emotion label, topics, keywords, severity, routing, and summary.
- Numeric scores are recalculated by backend deterministic formulas after validation.
- For numeric fields, return conservative placeholders only; do not pretend exact numeric certainty.
- Do not fill satisfaction dimensions unless raw_text directly mentions that dimension. Unmentioned dimensions may be null.

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
- If raw_text explicitly alleges corruption, bribery, harassment, safety, or other serious risk, do not let a positive/random rating reduce the risk, severity, or escalation.

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
- none: no actionable issue, general praise, or neutral feedback
- low: praise, minor issue, vague dissatisfaction
- medium: repeated-feeling complaint, clear academic issue, materials/clarity/communication issue
- high: serious grading fairness concern, strong negative impact, explicit repeated unresolved problem
- critical: explicit corruption, harassment, discrimination, policy violation, or serious safety/system abuse claim

Do NOT mark severity high/critical only because sentiment is negative.

7. requires_attention_from should be a non-empty array only when:
- severity is high or critical
- risk.probability >= 0.50
- issue involves fairness_concern with specific evidence
- recommended_action requires human follow-up/escalation

8. Risk rules
Risk types must be empty [] unless explicit evidence exists in raw_text.
- Money-request wording involving a teacher/instructor (for example "pul so'radi", "pul soravotti", "pul talab", "pora", "pul evaziga", "domla pul") is corruption_allegation, not confirmed corruption.
- corruption_allegation should use impact_scopes including teacher_instructor and department, severity high or critical, and human follow-up.

Risk probability:
- 0.00 if no explicit risk
- 0.20–0.49 if weak/ambiguous risk language
- 0.50–0.74 if explicit but limited claim
- 0.75–1.00 if explicit, specific, serious claim

Positive feedback should normally have:
- risk.types = []
- risk.probability = 0.0
- risk.impact_scopes = []
- severity = "low"
- requires_attention_from = []
- recommended_action = "no_action_needed"
Exception: explicit risk evidence in raw_text overrides a positive or random-looking rating.

9. Satisfaction dimensions
Use both text and context.

Scores:
- 0.80–1.00 strong positive
- 0.60–0.79 acceptable
- 0.40–0.59 mixed/unclear 
- 0.20–0.39 weak/problematic
- 0.00–0.19 severe problem

10. Language and Uzbek summary
- Detect language as uz, ru, en, or mixed.
- summary_uz must always be in Uzbek and must include the main conclusion and, when useful, context-aware caution.
- Do not overstate. Use words like "ehtimol", "ko‘rinadi", "aniqlashtirish kerak" for uncertain cases.

11. Lists
- topics max 4
- keywords max 4
- Use short normalized labels, not long sentences.

Return this exact JSON structure:

{
  "schema_version": "1.1.0",
  "feedback_id": "string",
  "language": "uz|ru|en|mixed",
  "feedback_credibility": {
    "score": 0.0
  },
  "sentiment": "positive|neutral|negative",
  "sentiment_score": 0.0,
  "emotion": "frustration|confusion|anxiety|anger|boredom|gratitude|curiosity|confidence|inspiration|relief|indifference|disappointment",
  "emotion_intensity": 0.0,
  "topics": ["teaching_instruction|course_content|assessment_grading|workload_difficulty|learning_resources|technology_platforms|support_accessibility|administrative_processes|communication|facilities_infrastructure|health_services|personal_life_family|financial_factors|housing_living|transport_commute|social_peer_interaction|extracurricular_activities|career_employability|diversity_equity_inclusion|safety_security|personal_growth_identity|motivation_engagement|university_system_issues|global_external_factors"],
  "keywords": ["string"],
  "risk": {
    "types": ["safety_risk|harassment_abuse|discrimination_bias|corruption_allegation|academic_misconduct|grading_integrity_issue|policy_violation|system_abuse|retaliation_whistleblowing|data_privacy_breach|mental_health_crisis|negligence_malpractice|exploitation_of_students|misinformation_disinformation|legal_ethical_breach"],
    "probability": 0.0,
    "impact_scopes": ["individual_student|group_of_students|course_section|teacher_instructor|staff_admin|department|faculty|institute|education_system|external_community|digital_platform"]
  },
  "satisfaction_dimensions": {
    "teaching_quality": null,
    "clarity": null,
    "engagement": null,
    "course_content_relevance": null,
    "assessment_fairness": null,
    "grading_transparency": null,
    "materials_quality": null,
    "support_availability": null,
    "admin_responsiveness": null,
    "workload_balance": null,
    "overall_satisfaction": 0
  },
  "severity": "none|low|medium|high|critical",
  "confidence": 0.0,
  "summary_uz": "string",
  "representative_label": "complaint|praise|suggestion|incident|query|concern|other",
  "requires_attention_from": ["teacher_instructor|department_head|academic_affairs|student_affairs|disability_support|counseling_mental_health|academic_integrity_office|legal_compliance|it_platform_team|executive_leadership"],
  "recommended_action": "improve_teaching|adjust_assessment|update_content|clarify_communication|provide_student_support|address_wellbeing|fix_infrastructure|investigate_incident|investigate_misconduct|emergency_intervention|no_action_needed"
}
"""

BATCH_SYSTEM_PROMPT = """
You are an institutional LMS feedback intelligence engine.

Analyze MULTIPLE student feedback records in one request.

Return ONLY valid JSON.
Do not use markdown.
Do not add explanations outside JSON.
Do not omit any input feedback_id.
Do not add fields outside the required schema.

Return this exact structure:

{
  "results": [
    {
      "feedback_id": "string",
      "output": {
            "schema_version": "1.1.0",
            "feedback_id": "string",
            "language": "uz|ru|en|mixed",
            "feedback_credibility": {
                "score": 0.0
            },
            "sentiment": "positive|neutral|negative",
            "sentiment_score": 0.0,
            "emotion": "frustration|confusion|anxiety|anger|boredom|gratitude|curiosity|confidence|inspiration|relief|indifference|disappointment",
            "emotion_intensity": 0.0,
            "topics": ["teaching_instruction|course_content|assessment_grading|workload_difficulty|learning_resources|technology_platforms|support_accessibility|administrative_processes|communication|facilities_infrastructure|health_services|personal_life_family|financial_factors|housing_living|transport_commute|social_peer_interaction|extracurricular_activities|career_employability|diversity_equity_inclusion|safety_security|personal_growth_identity|motivation_engagement|university_system_issues|global_external_factors"],
            "keywords": ["string"],
            "risk": {
                "types": ["safety_risk|harassment_abuse|discrimination_bias|corruption_allegation|academic_misconduct|grading_integrity_issue|policy_violation|system_abuse|retaliation_whistleblowing|data_privacy_breach|mental_health_crisis|negligence_malpractice|exploitation_of_students|misinformation_disinformation|legal_ethical_breach"],
                "probability": 0.0,
                "impact_scopes": ["individual_student|group_of_students|course_section|teacher_instructor|staff_admin|department|faculty|institute|education_system|external_community|digital_platform"]
            },
            "satisfaction_dimensions": {
                "teaching_quality": null,
                "clarity": null,
                "engagement": null,
                "course_content_relevance": null,
                "assessment_fairness": null,
                "grading_transparency": null,
                "materials_quality": null,
                "support_availability": null,
                "admin_responsiveness": null,
                "workload_balance": null,
                "overall_satisfaction": 0
            },
            "severity": "none|low|medium|high|critical",
            "confidence": 0.0,
            "summary_uz": "string",
            "representative_label": "complaint|praise|suggestion|incident|query|concern|other",
            "requires_attention_from": ["teacher_instructor|department_head|academic_affairs|student_affairs|disability_support|counseling_mental_health|academic_integrity_office|legal_compliance|it_platform_team|executive_leadership"],
            "recommended_action": "improve_teaching|adjust_assessment|update_content|clarify_communication|provide_student_support|address_wellbeing|fix_infrastructure|investigate_incident|investigate_misconduct|emergency_intervention|no_action_needed"
        }
      }
    }
  ]
}

Rules:
- Treat each feedback independently.
- raw_text is primary evidence.
- Numeric scores are backend-authoritative; return conservative placeholders only.
- Do not invent satisfaction dimensions. Use null when raw_text does not directly mention that dimension.
- Never infer corruption, harassment, discrimination, abuse, or policy violation unless raw_text explicitly suggests it.
- Money-request wording involving a teacher/instructor ("pul so'radi", "pul soravotti", "pul talab", "pora", "domla pul") is corruption_allegation and needs human investigation, not a factual conclusion.
- Positive feedback should normally have low severity, no risk, and requires_attention_from []; explicit risk evidence overrides a positive/random-looking rating.
- If a field is missing, analyze conservatively.
- summary_uz must always be Uzbek.
- topics max 3.
- subtopics max 5.
- keywords max 4.
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

    path = Path(tempfile.gettempdir()) / "gcp-sa.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(path)
    return str(path)


def get_genai_client():
    global _client

    if genai is None or genai_types is None:
        raise RuntimeError("google-genai is not installed. Install dependencies from requirements.txt or use AI_PROVIDER=mock.")

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
        "pora", "pul so'radi", "pul soradi", "pul soravot", "pul sorayap",
        "pul talab", "pul evaziga", "domla pul", "haq so'radi", "otkat", "korrupsiya",
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
    """Build canonical compact inputToAI v1.0.0 from inputToSystem v1.2.0-compatible payload."""
    return schema_service.build_input_to_ai_v10(input_to_system)

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
    """Local fallback that returns the new outputFromAI schema."""
    input_to_ai = build_input_to_ai(input_to_system)
    feedback_id = input_to_ai.get("feedback_id") or "unknown"
    content = input_to_ai.get("content", {}) or {}
    context = input_to_ai.get("context", {}) or {}
    text = str(content.get("raw_text", "") or "").lower()
    rating = content.get("rating") or context.get("rating")

    positive_words = ["rahmat", "zo'r", "zor", "yaxshi", "ajoyib", "tushunarli", "yoqdi", "excellent", "good", "super"]
    negative_words = ["yomon", "qiyin", "tushunmadim", "chummadim", "chunmadim", "tushunarsiz", "adolatsiz", "nohaq", "muammo", "zerikarli", "shikoyat", "bad"]
    assessment_words = ["baho", "baholash", "ball", "imtihon", "test", "grading", "assessment", "mezon"]
    technical_words = ["platforma", "login", "xato", "texnik", "server", "lms", "kirmayapti"]
    corruption_words = [
        "pora", "pul so'radi", "pul soradi", "pul soravot", "pul sorayap",
        "pul talab", "pul evaziga", "domla pul", "haq so'radi", "otkat",
        "korrupsiya", "corruption"
    ]
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
        sentiment_score = max(0.0, min(1.0, float(rating) / 5.0))

    topics = []
    keywords = []
    recommended_action = "no_action_needed" if sentiment == "positive" else "clarify_communication"

    if any(w in text for w in assessment_words):
        topics.append("assessment_grading")
        keywords.extend(["baholash", "mezon"])
        recommended_action = "adjust_assessment"
    elif any(w in text for w in technical_words):
        topics.append("technology_platforms")
        keywords.extend(["platforma", "lms"])
        recommended_action = "fix_infrastructure"
    elif "material" in text or "slayd" in text or "resurs" in text:
        topics.append("learning_resources")
        keywords.extend(["material"])
        recommended_action = "update_content"
    elif "tushuntir" in text or "dars" in text:
        topics.append("teaching_instruction")
        keywords.extend(["dars", "tushuntirish"])
        recommended_action = "improve_teaching" if sentiment != "positive" else "no_action_needed"
    elif sentiment == "positive":
        topics.append("motivation_engagement")
        keywords.extend(["yaxshi"])

    risk_types = []
    risk_probability = 0.0
    impact_scopes = []
    requires_attention_from = []

    if any(w in text for w in corruption_words):
        risk_types.append("corruption_allegation")
        risk_probability = 0.8
        impact_scopes = ["teacher_instructor", "department"]
        severity = "high"
        requires_attention_from = ["department_head", "academic_affairs"]
        recommended_action = "investigate_incident"
    elif any(w in text for w in harassment_words):
        risk_types.append("harassment_abuse")
        risk_probability = 0.75
        impact_scopes = ["teacher_instructor"]
        severity = "high"
        requires_attention_from = ["department_head", "student_affairs"]
        recommended_action = "investigate_misconduct"
    elif "adolatsiz" in text or "nohaq" in text:
        risk_types.append("grading_integrity_issue")
        risk_probability = 0.55
        impact_scopes = ["course_section"]
        severity = "high"
        requires_attention_from = ["department_head"]
        recommended_action = "adjust_assessment"

    raw_output = {
        "schema_version": "1.1.0",
        "feedback_id": feedback_id,
        "language": "uz",
        "feedback_credibility": {"score": 0.65},
        "sentiment": sentiment,
        "sentiment_score": sentiment_score,
        "emotion": emotion,
        "emotion_intensity": 0.55 if sentiment != "neutral" else 0.3,
        "topics": topics[:5],
        "keywords": keywords[:5],
        "risk": {
            "types": risk_types,
            "probability": risk_probability,
            "impact_scopes": impact_scopes,
        },
        "satisfaction_dimensions": {
            "teaching_quality": 0.8 if sentiment == "positive" else 0.45,
            "clarity": 0.75 if "tushunarli" in text or sentiment == "positive" else 0.45,
            "engagement": 0.7 if sentiment == "positive" else 0.5,
            "course_content_relevance": 0.65,
            "assessment_fairness": 0.35 if "assessment_grading" in topics or risk_types else 0.7,
            "grading_transparency": 0.35 if "assessment_grading" in topics else 0.65,
            "materials_quality": 0.55,
            "support_availability": 0.5,
            "admin_responsiveness": 0.5,
            "workload_balance": 0.55,
            "overall_satisfaction": sentiment_score,
        },
        "severity": severity,
        "confidence": 0.62,
        "summary_uz": (
            "Talaba ijobiy fikr bildirgan."
            if sentiment == "positive"
            else "Talaba muammo yoki aniqlashtirish kerak bo'lgan holat haqida fikr bildirgan."
        ),
        "representative_label": label,
        "requires_attention_from": requires_attention_from,
        "recommended_action": recommended_action,
    }

    return {
        "input_to_ai": input_to_ai,
        "raw_output": json.dumps(raw_output, ensure_ascii=False),
        "parsed_raw": raw_output,
    }

def apply_context_guardrails(output: Dict[str, Any], input_to_system: Dict[str, Any]) -> Tuple[Dict[str, Any], list]:
    """Guardrails for the new canonical outputFromAI schema."""
    corrections = []
    guarded = dict(output or {})

    signals = build_context_signals(input_to_system)
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

    if not has_explicit_risk_language and risk_types:
        guarded["risk"] = {"types": [], "probability": 0.0, "impact_scopes": []}
        guarded["requires_attention_from"] = []
        corrections.append("context_guardrail: removed risk because raw_text has no explicit risk evidence")

    if is_vague and guarded.get("severity") in {"high", "critical"}:
        guarded["severity"] = "medium" if guarded.get("sentiment") == "negative" else "low"
        guarded["requires_attention_from"] = []
        if guarded.get("recommended_action") in {"investigate_misconduct", "investigate_incident", "emergency_intervention"}:
            guarded["recommended_action"] = "clarify_communication"
        corrections.append("context_guardrail: reduced severity for vague feedback")

    if guarded.get("sentiment") == "positive" and rating_band == "high" and not has_explicit_risk_language:
        guarded["severity"] = "low"
        guarded["requires_attention_from"] = []
        guarded["recommended_action"] = "no_action_needed"
        guarded["risk"] = {"types": [], "probability": 0.0, "impact_scopes": []}
        corrections.append("context_guardrail: normalized positive high-rating feedback")

    if attendance_band == "low" and is_vague:
        guarded["confidence"] = min(float(guarded.get("confidence", 0.7) or 0.7), 0.55)
        cred = guarded.get("feedback_credibility", {}) or {}
        cred["score"] = min(float(cred.get("score", 0.6) or 0.6), 0.50)
        guarded["feedback_credibility"] = cred
        if guarded.get("recommended_action") in {"investigate_misconduct", "investigate_incident", "emergency_intervention"}:
            guarded["recommended_action"] = "clarify_communication"
        corrections.append("context_guardrail: lowered confidence for vague feedback with low attendance context")

    topics = guarded.get("topics") or []
    if (
        "diversity_equity_inclusion" in topics
        and guarded.get("severity") == "critical"
        and not has_explicit_risk_language
    ):
        guarded["severity"] = "high" if has_specific_evidence else "medium"
        guarded["recommended_action"] = "provide_student_support" if has_specific_evidence else "clarify_communication"
        corrections.append("context_guardrail: reduced critical DEI/fairness concern without explicit risk evidence")

    final_risk = guarded.get("risk", {}) or {}
    final_risk_prob = float(final_risk.get("probability", 0.0) or 0.0)
    if guarded.get("severity") in {"high", "critical"} or final_risk_prob >= 0.5:
        if not guarded.get("requires_attention_from"):
            guarded["requires_attention_from"] = ["department_head"]
    elif guarded.get("recommended_action") in {"investigate_misconduct", "investigate_incident", "emergency_intervention"}:
        if not guarded.get("requires_attention_from"):
            guarded["requires_attention_from"] = ["department_head"]
    else:
        guarded["requires_attention_from"] = []

    return guarded, corrections


def finalize_output(output: Dict[str, Any], input_to_system: Dict[str, Any], corrections: list) -> Tuple[Dict[str, Any], list]:
    scored, scoring_corrections = apply_deterministic_scores(output, input_to_system)
    corrections.extend(scoring_corrections)
    return scored, corrections

async def call_vertex_genai_batch_once(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    client = get_genai_client()

    model = os.getenv("VERTEX_MODEL") or config.VERTEX_MODEL or "gemini-3.1-flash-lite-preview"
    temperature = float(os.getenv("MODEL_TEMPERATURE", str(config.MODEL_TEMPERATURE)))
    max_tokens = int(os.getenv("AI_BATCH_MAX_TOKENS", str(getattr(config, "AI_BATCH_MAX_TOKENS", 8192))))

    input_items = [build_input_to_ai(item) for item in items]

    prompt = json.dumps(
        {
            "task": "Analyze this array of LMS feedback records. Return one output object per feedback_id.",
            "count": len(input_items),
            "inputToAIItems": input_items,
        },
        ensure_ascii=False,
    )

    response = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            system_instruction=BATCH_SYSTEM_PROMPT,
            temperature=temperature,
            max_output_tokens=max_tokens,
            thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
        ),
    )

    raw = (response.text or "").strip()

    return {
        "input_to_ai_items": input_items,
        "raw_output": raw,
        "parsed_raw": extract_json(raw),
    }


def call_vertex_genai_batch_sync(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    loop = get_reusable_loop()
    return loop.run_until_complete(call_vertex_genai_batch_once(items))


def _mock_analyze_batch(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows = []
    for item in items:
        feedback_id = item.get("feedback_id", "unknown")
        result = mock_analyze(item)
        output, corrections = validate_output(result["parsed_raw"], feedback_id)
        output, guardrail_corrections = apply_context_guardrails(output, item)
        corrections.extend(guardrail_corrections)
        output, corrections = finalize_output(output, item, corrections)

        rows.append({
            "feedback_id": feedback_id,
            "input_to_ai": result["input_to_ai"],
            "output": output,
            "raw_output": result["raw_output"],
            "provider": "mock",
            "used_fallback": False,
            "corrections": corrections,
        })
    return rows


def analyze_feedback_batch(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyze multiple feedbacks in one Vertex request.

    Returns list of analysis objects compatible with data_service.upsert_result().
    If batch Vertex fails, falls back to individual analyze_feedback().
    """
    clean_items = [x for x in items if isinstance(x, dict)]
    if not clean_items:
        return []

    provider = config.AI_PROVIDER

    if provider == "mock":
        return _mock_analyze_batch(clean_items)

    max_size = max(1, int(getattr(config, "AI_BATCH_MAX_SIZE", 10)))
    if len(clean_items) > max_size:
        raise ValueError(f"AI batch too large: {len(clean_items)} > {max_size}")

    last_error = None
    max_retries = max(1, int(config.MAX_RETRIES) + 1)

    for attempt in range(1, max_retries + 1):
        try:
            feedback_ids = [x.get("feedback_id", "unknown") for x in clean_items]
            logger.info("gemma_batch_call_start", {
                "count": len(clean_items),
                "feedback_ids": feedback_ids,
                "attempt": attempt,
            })

            result = call_vertex_genai_batch_sync(clean_items)
            parsed = result.get("parsed_raw", {}) or {}
            rows = parsed.get("results", [])

            if not isinstance(rows, list):
                raise ValueError("Batch model response missing results[]")

            by_id = {}
            for row in rows:
                if not isinstance(row, dict):
                    continue
                fid = row.get("feedback_id")
                output = row.get("output") or row
                if fid:
                    by_id[str(fid)] = output

            outputs = []

            for item in clean_items:
                fid = str(item.get("feedback_id", "unknown"))
                raw_output_obj = by_id.get(fid)

                if not raw_output_obj:
                    raise ValueError(f"Batch response missing feedback_id={fid}")

                output, corrections = validate_output(raw_output_obj, fid)
                output, guardrail_corrections = apply_context_guardrails(output, item)
                corrections.extend(guardrail_corrections)
                output, corrections = finalize_output(output, item, corrections)

                outputs.append({
                    "feedback_id": fid,
                    "input_to_ai": build_input_to_ai(item),
                    "output": output,
                    "raw_output": json.dumps(raw_output_obj, ensure_ascii=False),
                    "provider": "vertex_genai_batch",
                    "used_fallback": False,
                    "corrections": corrections,
                })

            logger.info("gemma_batch_call_success", {
                "count": len(outputs),
                "attempt": attempt,
            })

            return outputs

        except Exception as e:
            last_error = e
            logger.warn("gemma_batch_call_failed", {
                "count": len(clean_items),
                "attempt": attempt,
                "error": str(e),
            })

            if attempt < max_retries:
                time.sleep((1.5 ** attempt) + random.uniform(0.1, 0.7))

    logger.warn("gemma_batch_fallback_to_single", {
        "count": len(clean_items),
        "reason": str(last_error),
    })

    # Safe fallback: split failed batch into normal single-feedback analysis.
    outputs = []
    for item in clean_items:
        outputs.append(analyze_feedback(item))

    return outputs


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
        output, corrections = finalize_output(output, input_to_system, corrections)
        
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
            output, corrections = finalize_output(output, input_to_system, corrections)

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
        output, corrections = finalize_output(output, input_to_system, corrections)

        return {
            "input_to_ai": result["input_to_ai"],
            "output": output,
            "raw_output": result["raw_output"],
            "provider": "mock",
            "used_fallback": True,
            "corrections": corrections,
        }

    raise RuntimeError(f"Gemini analysis failed and fallback disabled: {last_error}")

# Schema migration override: canonical inputToAI v1.0.0 + outputFromAI v1.0.0-new.
# SYSTEM_PROMPT = """
# You are an institutional LMS feedback analysis engine.

# Return ONLY valid JSON. Do not use markdown. Do not add explanations outside JSON.
# Analyze the provided inputToAI object and return outputFromAI exactly in this schema:

# {
#   "schema_version": "1.0.0",
#   "feedback_id": "string",
#   "language": "uz|en|ru|mixed",
#   "feedback_credibility": {"score": 0.0},
#   "sentiment": "positive|neutral|negative",
#   "sentiment_score": 0.0,
#   "emotion": "frustration|confusion|anxiety|anger|boredom|disappointment|shame|helplessness|isolated|gratitude|confidence|inspiration|relief|satisfaction|surprise|indifference|curiosity",
#   "emotion_intensity": 0.0,
#   "topics": ["teaching_instruction|course_content|assessment_grading|workload_difficulty|learning_resources|technology_platforms|support_accessibility|administrative_processes|communication|facilities_infrastructure|health_services|personal_life_family|financial_factors|housing_living|transport_commute|social_peer_interaction|extracurricular_activities|career_employability|diversity_equity_inclusion|safety_security|personal_growth_identity|motivation_engagement|university_system_issues|global_external_factors"],
#   "keywords": ["string"],
#   "risk": {
#     "types": ["safety_risk|harassment_abuse|discrimination_bias|corruption_allegation|academic_misconduct|grading_integrity_issue|policy_violation|system_abuse|retaliation_whistleblowing|data_privacy_breach|mental_health_crisis|negligence_malpractice|exploitation_of_students|misinformation_disinformation|legal_ethical_breach"],
#     "probability": 0.0,
#     "impact_scopes": ["individual_student|group_of_students|course_section|teacher_instructor|staff_admin|department|faculty|institute|education_system|external_community|digital_platform"]
#   },
#   "satisfaction_dimensions": {
#     "teaching_quality": 0.0,
#     "clarity": 0.0,
#     "engagement": 0.0,
#     "course_content_relevance": 0.0,
#     "assessment_fairness": 0.0,
#     "grading_transparency": 0.0,
#     "materials_quality": 0.0,
#     "support_availability": 0.0,
#     "admin_responsiveness": 0.0,
#     "workload_balance": 0.0,
#     "overall_satisfaction": 0.0
#   },
#   "severity": "none|low|medium|high|critical",
#   "confidence": 0.0,
#   "summary_uz": "string",
#   "representative_label": "complaint|praise|suggestion|incident|query|concern|other",
#   "requires_attention_from": ["teacher_instructor|department_head|student_affairs|disability_support|counseling_mental_health|academic_integrity_office|legal_compliance|it_platform_team|executive_leadership"],
#   "recommended_action": "improve_teaching|adjust_assessment|update_content|clarify_communication|provide_student_support|address_wellbeing|fix_infrastructure|investigate_misconduct|emergency_intervention|no_action_needed"
# }

# Rules:
# - feedback_id must exactly match inputToAI.feedback_id.
# - content.raw_text is primary evidence.
# - context values are weak context only; never use gender/GPA/attendance to unfairly penalize a student.
# - Positive feedback should normally have severity none or low, no risk, requires_attention_from [], and recommended_action no_action_needed unless the text explicitly contains risk evidence.
# - Never create legal/safety/corruption/harassment/discrimination risks without explicit raw_text evidence.
# - keywords max 5. topics max 5. summary_uz must be natural Uzbek.
# """

# BATCH_SYSTEM_PROMPT = SYSTEM_PROMPT + """

# Batch mode:
# Analyze MULTIPLE inputToAI records. Return ONLY valid JSON with this outer shape:
# {
#   "results": [
#     {"feedback_id": "string", "output": {"schema_version": "1.0.0"}}
#   ]
# }
# Each output must follow the outputFromAI schema above.
# Do not omit any input feedback_id. Do not add explanations or markdown.
# """
