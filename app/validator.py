import json
import re


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


def safe_list(value, max_len: int, item_type=str) -> list:
    if not isinstance(value, list):
        return []
    result = []
    for item in value[:max_len]:
        try:
            result.append(item_type(item))
        except Exception:
            pass
    return result


def extract_json_from_text(text: str) -> dict:
    """Try to extract JSON object from potentially noisy model output."""
    if not text:
        raise ValueError("Empty text")
    # Direct parse
    try:
        return json.loads(text)
    except Exception:
        pass
    # Strip markdown fences
    clean = re.sub(r"```(?:json)?", "", text).strip()
    try:
        return json.loads(clean)
    except Exception:
        pass
    # Find first {...} block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    raise ValueError(f"Cannot extract JSON from model output: {text[:200]}")


SENTIMENT_ALLOWED = {"positive", "neutral", "negative"}
LANGUAGE_ALLOWED = {"uz", "ru", "en", "mixed"}
SEVERITY_ALLOWED = {"low", "medium", "high", "critical"}
EMOTION_ALLOWED = {
    "frustration", "confusion", "anxiety", "anger", "boredom",
    "gratitude", "curiosity", "confidence", "inspiration", "relief",
    "indifference", "disappointment",
}
ISSUE_ALLOWED = {
    "none", "teaching_style", "content_quality", "assessment", "materials",
    "communication", "technical_issue", "classroom_management", "fairness_concern", "other",
}
LABEL_ALLOWED = {"complaint", "praise", "suggestion", "incident", "other"}
ACTION_ALLOWED = {
    "no_action_needed", "monitor_pattern", "follow_up_with_student",
    "review_course_materials", "provide_teacher_feedback", "escalate_to_department",
    "open_formal_review", "check_for_policy_violation", "request_more_context",
}
RISK_TYPE_ALLOWED = {
    "corruption_allegation", "harassment_claim", "grading_bias",
    "academic_integrity_issue", "discrimination_claim", "policy_violation",
    "system_abuse", "coordinated_spam",
}
SCOPE_ALLOWED = {"none", "course", "teacher", "department", "system"}


def validate_output(raw: dict, feedback_id: str) -> tuple[dict, list]:
    """
    Returns (normalized_output, list_of_corrections).
    Never raises — always returns a safe output.
    """
    corrections = []
    if not isinstance(raw, dict):
        raw = {}
        corrections.append("Root was not a dict, reset to empty")

    def fix(field, msg):
        corrections.append(f"Fixed {field}: {msg}")

    # --- risk block ---
    risk_raw = raw.get("risk", {})
    if not isinstance(risk_raw, dict):
        risk_raw = {}
        fix("risk", "not a dict")

    risk_types_raw = risk_raw.get("types", [])
    if not isinstance(risk_types_raw, list):
        risk_types_raw = []
        fix("risk.types", "not a list")
    risk_types = [t for t in [rt.strip().lower() if isinstance(rt, str) else "" for rt in risk_types_raw] if t in RISK_TYPE_ALLOWED]

    risk_prob = clamp_float(risk_raw.get("probability"), 0.0)
    risk_scope = normalize_choice(risk_raw.get("impact_scope"), SCOPE_ALLOWED, "none")

    # Consistency: empty types → zero probability + none scope
    if not risk_types:
        if risk_prob > 0.0:
            fix("risk.probability", "reset to 0.0 since types empty")
        risk_prob = 0.0
        risk_scope = "none"

    # Consistency: positive sentiment + high risk prob without risk types → lower prob
    sentiment_raw = normalize_choice(raw.get("sentiment"), SENTIMENT_ALLOWED, "neutral")
    if sentiment_raw == "positive" and risk_prob > 0.5 and not risk_types:
        risk_prob = 0.1
        fix("risk.probability", "lowered for positive sentiment with no risk types")

    # --- satisfaction_dimensions ---
    sd_raw = raw.get("satisfaction_dimensions", {})
    if not isinstance(sd_raw, dict):
        sd_raw = {}

    def sd(key, default=0.5):
        return clamp_float(sd_raw.get(key), default)

    # --- feedback_credibility ---
    cred_raw = raw.get("feedback_credibility", {})
    if not isinstance(cred_raw, dict):
        cred_raw = {}

    # --- feedback_fairness ---
    fair_raw = raw.get("feedback_fairness", {})
    if not isinstance(fair_raw, dict):
        fair_raw = {}

    output = {
        "schema_version": "1.0.0",
        "feedback_id": str(raw.get("feedback_id", feedback_id)),
        "language": normalize_choice(raw.get("language"), LANGUAGE_ALLOWED, "uz"),
        "feedback_credibility": {
            "score": clamp_float(cred_raw.get("score"), 0.6),
        },
        "feedback_fairness": {
            "score": clamp_float(fair_raw.get("score"), 0.6),
            "is_one_sided": bool(fair_raw.get("is_one_sided", False)),
            "has_constructive_tone": bool(fair_raw.get("has_constructive_tone", False)),
        },
        "sentiment": sentiment_raw,
        "sentiment_score": clamp_float(raw.get("sentiment_score"), 0.5),
        "emotion": normalize_choice(raw.get("emotion"), EMOTION_ALLOWED, "indifference"),
        "emotion_intensity": clamp_float(raw.get("emotion_intensity"), 0.5),
        "subtopics": safe_list(raw.get("subtopics", []), 5),
        "keywords": safe_list(raw.get("keywords", []), 4),
        "topics": safe_list(raw.get("topics", []), 3),
        "issue_category": normalize_choice(raw.get("issue_category"), ISSUE_ALLOWED, "other"),
        "risk": {
            "types": risk_types,
            "probability": risk_prob,
            "impact_scope": risk_scope,
        },
        "satisfaction_dimensions": {
            "teaching_quality": sd("teaching_quality", 0.5),
            "clarity": sd("clarity", 0.5),
            "engagement": sd("engagement", 0.5),
            "fairness": sd("fairness", 0.5),
            "materials": sd("materials", 0.5),
        },
        "severity": normalize_choice(raw.get("severity"), SEVERITY_ALLOWED, "low"),
        "confidence": clamp_float(raw.get("confidence"), 0.7),
        "summary_uz": str(raw.get("summary_uz", ""))[:500],
        "representative_label": normalize_choice(raw.get("representative_label"), LABEL_ALLOWED, "other"),
        "requires_admin_attention": bool(raw.get("requires_admin_attention", False)),
        "recommended_action": normalize_choice(raw.get("recommended_action"), ACTION_ALLOWED, "no_action_needed"),
    }

    return output, corrections