import json
import re
from . import schema_service


def clamp_float(value, default=0.0) -> float:
    try:
        v = float(value)
        return round(max(0.0, min(1.0, v)), 4)
    except Exception:
        return default


def normalize_choice(value, allowed: set, default: str) -> str:
    if not isinstance(value, str):
        return default
    v = value.strip().lower()
    return v if v in allowed else default


def safe_list(value, max_len: int, item_type=str, allowed: set | None = None) -> list:
    if not isinstance(value, list):
        return []
    result = []
    for item in value[:max_len]:
        try:
            v = item_type(item)
            if isinstance(v, str):
                v = v.strip().lower()
            if allowed is None or v in allowed:
                result.append(v)
        except Exception:
            pass
    return result


def safe_string_or_list(value, max_len: int, item_type=str, allowed: set | None = None) -> list:
    """Normalize canonical arrays while accepting old single-string model output."""
    if isinstance(value, str):
        value = [value]
    return safe_list(value, max_len, item_type, allowed)


def extract_json_from_text(text: str) -> dict:
    if not text:
        raise ValueError("Empty text")
    try:
        return json.loads(text)
    except Exception:
        pass
    clean = re.sub(r"```(?:json)?", "", text).strip()
    try:
        return json.loads(clean)
    except Exception:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    raise ValueError(f"Cannot extract JSON from model output: {text[:200]}")


SENTIMENT_ALLOWED = {"positive", "neutral", "negative"}
LANGUAGE_ALLOWED = {"uz", "ru", "en", "mixed"}
SEVERITY_ALLOWED = {"none", "low", "medium", "high", "critical"}
EMOTION_ALLOWED = {
    "frustration", "confusion", "anxiety", "anger", "boredom", "disappointment",
    "shame", "helplessness", "isolated", "gratitude", "confidence", "inspiration",
    "relief", "satisfaction", "surprise", "indifference", "curiosity",
}
TOPIC_ALLOWED = {
    "teaching_instruction", "course_content", "assessment_grading", "workload_difficulty",
    "learning_resources", "technology_platforms", "support_accessibility",
    "administrative_processes", "communication", "facilities_infrastructure",
    "health_services", "personal_life_family", "financial_factors", "housing_living",
    "transport_commute", "social_peer_interaction", "extracurricular_activities",
    "career_employability", "diversity_equity_inclusion", "safety_security",
    "personal_growth_identity", "motivation_engagement", "university_system_issues",
    "global_external_factors",
}
LABEL_ALLOWED = {"complaint", "praise", "suggestion", "incident", "query", "concern", "other"}
ACTION_ALLOWED = {
    "improve_teaching", "adjust_assessment", "update_content", "clarify_communication",
    "provide_student_support", "address_wellbeing", "fix_infrastructure",
    "investigate_misconduct", "investigate_incident", "emergency_intervention", "no_action_needed",
}
RISK_TYPE_ALLOWED = {
    "safety_risk", "harassment_abuse", "discrimination_bias", "corruption_allegation",
    "academic_misconduct", "grading_integrity_issue", "policy_violation", "system_abuse",
    "retaliation_whistleblowing", "data_privacy_breach", "mental_health_crisis",
    "negligence_malpractice", "exploitation_of_students", "misinformation_disinformation",
    "legal_ethical_breach",
    # compatibility accepted and normalized below
    "harassment_claim", "grading_bias", "academic_integrity_issue", "discrimination_claim", "coordinated_spam",
}
RISK_TYPE_MAP = {
    "harassment_claim": "harassment_abuse",
    "grading_bias": "grading_integrity_issue",
    "academic_integrity_issue": "academic_misconduct",
    "discrimination_claim": "discrimination_bias",
    "coordinated_spam": "system_abuse",
}
SCOPE_ALLOWED = {
    "individual_student", "group_of_students", "course_section", "teacher_instructor",
    "staff_admin", "department", "faculty", "institute", "education_system",
    "external_community", "digital_platform",
    # old compatibility
    "none", "course", "teacher", "system",
}
ATTENTION_ALLOWED = {
    "none", "teacher_instructor", "department_head", "academic_affairs", "student_affairs",
    "disability_support", "counseling_mental_health", "academic_integrity_office",
    "legal_compliance", "it_platform_team", "executive_leadership",
}
SD_KEYS = [
    "teaching_quality", "clarity", "engagement", "course_content_relevance",
    "assessment_fairness", "grading_transparency", "materials_quality",
    "support_availability", "admin_responsiveness", "workload_balance",
    "overall_satisfaction",
]


def _normalize_topics(raw: dict) -> list:
    topics = safe_list(raw.get("topics", []), 4, str, TOPIC_ALLOWED)
    if not topics and raw.get("issue_category"):
        mapped = schema_service.ISSUE_TO_TOPIC.get(str(raw.get("issue_category")).strip().lower())
        if mapped:
            topics = [mapped]
    return topics[:4]


def _normalize_risk(raw: dict, corrections: list) -> dict:
    risk_raw = raw.get("risk", {})
    if not isinstance(risk_raw, dict):
        risk_raw = {}
        corrections.append("Fixed risk: not a dict")

    risk_types = []
    for item in risk_raw.get("types", []) if isinstance(risk_raw.get("types", []), list) else []:
        v = str(item).strip().lower()
        if v in RISK_TYPE_ALLOWED:
            risk_types.append(RISK_TYPE_MAP.get(v, v))
    risk_types = list(dict.fromkeys(risk_types))[:5]

    scopes_raw = risk_raw.get("impact_scopes")
    if not isinstance(scopes_raw, list):
        old = risk_raw.get("impact_scope")
        if old:
            mapped = schema_service.OLD_SCOPE_TO_NEW.get(str(old).strip().lower())
            scopes_raw = [mapped] if mapped else []
        else:
            scopes_raw = []

    scopes = []
    for item in scopes_raw:
        v = str(item).strip().lower()
        v = schema_service.OLD_SCOPE_TO_NEW.get(v, v)
        if v in SCOPE_ALLOWED and v != "none":
            scopes.append(v)
    scopes = list(dict.fromkeys(scopes))[:5]

    probability = clamp_float(risk_raw.get("probability"), 0.0)
    if not risk_types:
        probability = 0.0
        scopes = []

    return {"types": risk_types, "probability": probability, "impact_scopes": scopes}


def validate_output(raw: dict, feedback_id: str) -> tuple[dict, list]:
    corrections = []
    if not isinstance(raw, dict):
        raw = {}
        corrections.append("Root was not a dict, reset to empty")

    sentiment = normalize_choice(raw.get("sentiment"), SENTIMENT_ALLOWED, "neutral")
    topics = _normalize_topics(raw)
    risk = _normalize_risk(raw, corrections)

    sd_raw = raw.get("satisfaction_dimensions", {})
    if not isinstance(sd_raw, dict):
        sd_raw = {}
        corrections.append("Fixed satisfaction_dimensions: not a dict")

    def sd(key):
        if key not in sd_raw:
            return 0.5 if key == "overall_satisfaction" else None
        if sd_raw.get(key) is None:
            return None if key != "overall_satisfaction" else 0.5
        return clamp_float(sd_raw.get(key), 0.5 if key == "overall_satisfaction" else None)

    cred_raw = raw.get("feedback_credibility", {})
    if not isinstance(cred_raw, dict):
        cred_raw = {}

    requires = safe_string_or_list(raw.get("requires_attention_from", []), 6, str, ATTENTION_ALLOWED)
    requires = [x for x in requires if x != "none"]

    # Compatibility from old boolean.
    if not requires and bool(raw.get("requires_admin_attention", False)):
        requires = ["department_head"]

    severity = normalize_choice(raw.get("severity"), SEVERITY_ALLOWED, "low")
    if sentiment == "positive" and not risk.get("types") and severity == "none":
        pass
    elif sentiment == "positive" and not risk.get("types") and severity in {"high", "critical"}:
        severity = "low"
        corrections.append("Fixed severity: positive feedback without risk cannot be high/critical")

    action = raw.get("recommended_action")
    if isinstance(action, str) and action.strip().lower() in schema_service.OLD_ACTION_TO_NEW:
        action = schema_service.OLD_ACTION_TO_NEW[action.strip().lower()]
    action = normalize_choice(action, ACTION_ALLOWED, "no_action_needed")

    output = {
        "schema_version": "1.1.0",
        "feedback_id": str(raw.get("feedback_id") or feedback_id),
        "language": normalize_choice(raw.get("language"), LANGUAGE_ALLOWED, "uz"),
        "feedback_credibility": {"score": clamp_float(cred_raw.get("score"), 0.6)},
        "sentiment": sentiment,
        "sentiment_score": clamp_float(raw.get("sentiment_score"), 0.5),
        "emotion": normalize_choice(raw.get("emotion"), EMOTION_ALLOWED, "indifference"),
        "emotion_intensity": clamp_float(raw.get("emotion_intensity"), 0.5),
        "topics": topics,
        "keywords": safe_list(raw.get("keywords", []), 4, str),
        "risk": risk,
        "risk_impact_score": clamp_float(raw.get("risk_impact_score"), 0.0),
        "satisfaction_dimensions": {key: sd(key) for key in SD_KEYS},
        "severity": severity,
        "confidence": clamp_float(raw.get("confidence"), 0.7),
        "summary_uz": str(raw.get("summary_uz", ""))[:700],
        "representative_label": normalize_choice(raw.get("representative_label"), LABEL_ALLOWED, "other"),
        "requires_attention_from": requires,
        "recommended_action": action,
        "score_audit": raw.get("score_audit") if isinstance(raw.get("score_audit"), dict) else {},
    }

    if output["sentiment"] == "positive" and not output["risk"]["types"]:
        if output["severity"] not in {"none", "low"}:
            output["severity"] = "low"
            corrections.append("Fixed severity: positive non-risk feedback set to low")
        if output["recommended_action"] in {"investigate_misconduct", "investigate_incident", "emergency_intervention"}:
            output["recommended_action"] = "no_action_needed"
            corrections.append("Fixed recommended_action: removed escalation for positive non-risk feedback")
        output["requires_attention_from"] = []

    return output, corrections
