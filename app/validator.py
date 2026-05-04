def clamp_float(value, default=0.0):
    try:
        value = float(value)
        return max(0.0, min(1.0, value))
    except Exception:
        return default


def normalize_choice(value, allowed, default):
    if not isinstance(value, str):
        return default
    value = value.strip().lower()
    return value if value in allowed else default


def validate_output(ai_output: dict, feedback_id: str) -> dict:
    if not isinstance(ai_output, dict):
        ai_output = {}

    sentiment_allowed = {"positive", "neutral", "negative"}
    severity_allowed = {"low", "medium", "high", "critical"}
    issue_allowed = {
        "none",
        "teaching_style",
        "content_quality",
        "assessment",
        "materials",
        "communication",
        "technical_issue",
        "classroom_management",
        "fairness_concern",
        "other",
    }
    label_allowed = {"complaint", "praise", "suggestion", "incident", "other"}
    action_allowed = {
        "no_action_needed",
        "monitor_pattern",
        "follow_up_with_student",
        "review_course_materials",
        "provide_teacher_feedback",
        "escalate_to_department",
        "open_formal_review",
        "check_for_policy_violation",
        "request_more_context",
    }

    risk = ai_output.get("risk")
    if not isinstance(risk, dict):
        risk = {}

    risk_types = risk.get("types", [])
    if not isinstance(risk_types, list):
        risk_types = []

    topics = ai_output.get("topics", [])
    if not isinstance(topics, list):
        topics = []
    topics = [str(t) for t in topics[:3]]

    return {
        "schema_version": str(ai_output.get("schema_version", "1.0.0")),
        "feedback_id": str(ai_output.get("feedback_id", feedback_id)),
        "language": normalize_choice(
            ai_output.get("language"),
            {"uz", "ru", "en", "mixed"},
            "uz",
        ),
        "sentiment": normalize_choice(
            ai_output.get("sentiment"),
            sentiment_allowed,
            "neutral",
        ),
        "sentiment_score": clamp_float(ai_output.get("sentiment_score"), 0.5),
        "emotion": str(ai_output.get("emotion", "indifference")),
        "emotion_intensity": clamp_float(ai_output.get("emotion_intensity"), 0.0),
        "topics": topics,
        "issue_category": normalize_choice(
            ai_output.get("issue_category"),
            issue_allowed,
            "other",
        ),
        "risk": {
            "types": risk_types,
            "probability": clamp_float(risk.get("probability"), 0.0),
            "impact_scope": normalize_choice(
                risk.get("impact_scope"),
                {"none", "course", "teacher", "department", "system"},
                "none",
            ),
        },
        "severity": normalize_choice(
            ai_output.get("severity"),
            severity_allowed,
            "low",
        ),
        "confidence": clamp_float(ai_output.get("confidence"), 0.7),
        "summary_uz": str(ai_output.get("summary_uz", "")),
        "representative_label": normalize_choice(
            ai_output.get("representative_label"),
            label_allowed,
            "other",
        ),
        "requires_admin_attention": bool(ai_output.get("requires_admin_attention", False)),
        "recommended_action": normalize_choice(
            ai_output.get("recommended_action"),
            action_allowed,
            "monitor_pattern",
        ),
    }