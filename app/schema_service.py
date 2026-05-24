from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple
import uuid


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def _none_if_blank(value):
    if value == "":
        return None
    return value


def safe_int_or_none(value):
    value = _none_if_blank(value)
    if value is None:
        return None
    try:
        return int(value)
    except Exception:
        return None


def safe_float_or_none(value):
    value = _none_if_blank(value)
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def safe_bool(value, default=None):
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"true", "1", "yes", "y", "ha"}:
            return True
        if v in {"false", "0", "no", "n", "yoq", "yo'q"}:
            return False
    return bool(value)


def normalize_rating(value, default=None):
    if value is None or value == "":
        return default
    try:
        return max(1, min(5, int(float(value))))
    except Exception:
        return default


def get_meta(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    return input_to_system.get("metadata", {}) or {}


def get_feedback_context(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    meta = get_meta(input_to_system)
    return meta.get("feedback_context") or input_to_system.get("feedback_context") or {}


def get_course_context(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    meta = get_meta(input_to_system)
    return meta.get("course_context") or input_to_system.get("course_context") or {}


def get_teacher_context(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    meta = get_meta(input_to_system)
    return meta.get("teacher_context") or input_to_system.get("teacher_context") or {}


def get_student_context(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    meta = get_meta(input_to_system)
    return meta.get("student_context") or {}


def normalize_course_level(value):
    if value in (None, ""):
        return None

    v = str(value).strip().lower()

    mapping = {
        "bachelor": "undergraduate",
        "bachelors": "undergraduate",
        "undergrad": "undergraduate",
        "undergraduate": "undergraduate",

        "master": "graduate",
        "masters": "graduate",
        "graduate": "graduate",

        "phd": "doctoral",
        "doctorate": "doctoral",
        "doctoral": "doctoral",
    }

    return mapping.get(v, v)


def normalize_input_to_system_v12(item: Dict[str, Any], idx: int = 0, source: str = "uploaded_file") -> Tuple[Dict[str, Any], List[str]]:
    """Normalize canonical, legacy-root-context, or flat payload into inputToSystem v1.2.0.

    Policy:
    - never invent externally-sourced metadata;
    - missing fields become None;
    - system-generated fields are recorded in mapping_audit.
    """
    warnings: List[str] = []
    if not isinstance(item, dict):
        raise ValueError(f"Item {idx} is not an object")

    provided_fields = sorted(list(item.keys()))
    generated_fields = ["schema_version"]
    missing_fields_policy = "null_not_invented"

    if "content" in item and isinstance(item.get("content"), dict):
        content = item.get("content") or {}
        raw_text = content.get("raw_text") or content.get("text")
        if not raw_text:
            raise ValueError(f"Item {idx} has content but missing content.raw_text")

        meta = item.get("metadata") or {}
        student_context = dict(meta.get("student_context") or {})
        feedback_context = dict(meta.get("feedback_context") or item.get("feedback_context") or {})
        course_context = dict(meta.get("course_context") or item.get("course_context") or {})
        teacher_context = dict(meta.get("teacher_context") or item.get("teacher_context") or {})

        if item.get("feedback_context") or item.get("course_context") or item.get("teacher_context"):
            warnings.append("legacy root-level context moved into metadata")

        feedback_id = item.get("feedback_id") or f"fb-{uuid.uuid4().hex[:12]}"
        if not item.get("feedback_id"):
            generated_fields.append("feedback_id")

        timestamp = meta.get("timestamp") or now_iso()
        if not meta.get("timestamp"):
            generated_fields.append("metadata.timestamp")

        normalized = {
            "schema_version": "1.2.0",
            "feedback_id": str(feedback_id),
            "content": {
                "raw_text": str(raw_text),
                "rating": normalize_rating(content.get("rating"), None),
            },
            "metadata": {
                "timestamp": timestamp,
                "semester_id": meta.get("semester_id"),
                "course_id": meta.get("course_id"),
                "teacher_id": meta.get("teacher_id"),
                "teacher_fullname": meta.get("teacher_fullname"),
                "student_context": {
                    "year": safe_int_or_none(student_context.get("year")),
                    "gender": student_context.get("gender"),
                    "group_id": student_context.get("group_id"),
                    "department_name": student_context.get("department_name") or student_context.get("department"),
                    "course_points": safe_int_or_none(student_context.get("course_points")),
                    "gpa": safe_float_or_none(student_context.get("gpa")),
                    "course_attendance_rate": safe_float_or_none(
                        student_context.get("course_attendance_rate", student_context.get("attendance_rate"))
                    ),
                },
                "feedback_context": {
                    "feedback_channel": feedback_context.get("feedback_channel"),
                    "is_anonymous": safe_bool(feedback_context.get("is_anonymous"), None),
                },
                "course_context": {
                    "course_name": course_context.get("course_name"),
                    "course_level": normalize_course_level(course_context.get("course_level")),
                    "course_delivery_mode": course_context.get("course_delivery_mode"),
                },
                "teacher_context": {
                    "teacher_role": teacher_context.get("teacher_role"),
                    "teaching_experience_years": safe_int_or_none(teacher_context.get("teaching_experience_years")),
                    "teacher_department_id": teacher_context.get("teacher_department_id"),
                },
            },
        }
        normalized["mapping_audit"] = {
            "source": source,
            "mapping_mode": "canonical_or_legacy_to_inputToSystem_v1.2.0",
            "missing_fields_policy": missing_fields_policy,
            "provided_fields": provided_fields,
            "system_generated_fields": generated_fields,
            "warnings": warnings,
        }
        return normalized, warnings

    raw_text = item.get("raw_text") or item.get("text") or item.get("feedback") or item.get("comment") or item.get("message")
    if not raw_text:
        raise ValueError(f"Item {idx} missing text field: raw_text/text/feedback/comment/message")

    rating = normalize_rating(item.get("rating", item.get("score")), None)
    feedback_id = item.get("feedback_id") or item.get("id") or f"fb-{uuid.uuid4().hex[:12]}"
    if not item.get("feedback_id") and not item.get("id"):
        generated_fields.append("feedback_id")

    timestamp = item.get("timestamp") or now_iso()
    if not item.get("timestamp"):
        generated_fields.append("metadata.timestamp")

    normalized = {
        "schema_version": "1.2.0",
        "feedback_id": str(feedback_id),
        "content": {
            "raw_text": str(raw_text),
            "rating": rating,
        },
        "metadata": {
            "timestamp": timestamp,
            "semester_id": item.get("semester_id"),
            "course_id": item.get("course_id") or item.get("course") or item.get("subject_code"),
            "teacher_id": item.get("teacher_id") or item.get("employee_id"),
            "teacher_fullname": item.get("teacher_fullname") or item.get("teacher_name") or item.get("employee_name"),
            "student_context": {
                "year": safe_int_or_none(item.get("year")),
                "gender": item.get("gender"),
                "group_id": item.get("group_id") or item.get("group"),
                "department_name": item.get("department_name") or item.get("department") or item.get("faculty"),
                "course_points": safe_int_or_none(item.get("course_points")),
                "gpa": safe_float_or_none(item.get("gpa")),
                "course_attendance_rate": safe_float_or_none(item.get("course_attendance_rate", item.get("attendance_rate"))),
            },
            "feedback_context": {
                "feedback_channel": item.get("feedback_channel") or source,
                "is_anonymous": safe_bool(item.get("is_anonymous"), None),
            },
            "course_context": {
                "course_name": item.get("course_name") or item.get("course_title") or item.get("subject_name"),
                "course_level": normalize_course_level(item.get("course_level")),
                "course_delivery_mode": item.get("course_delivery_mode"),
            },
            "teacher_context": {
                "teacher_role": item.get("teacher_role"),
                "teaching_experience_years": safe_int_or_none(item.get("teaching_experience_years")),
                "teacher_department_id": item.get("teacher_department_id"),
            },
        },
        "mapping_audit": {
            "source": source,
            "mapping_mode": "flat_object_to_inputToSystem_v1.2.0",
            "missing_fields_policy": missing_fields_policy,
            "provided_fields": provided_fields,
            "system_generated_fields": generated_fields,
            "warnings": ["flat object mapped to inputToSystem v1.2.0"],
        },
    }
    warnings.append("flat object mapped to inputToSystem v1.2.0")
    return normalized, warnings


def build_input_to_ai_v10(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    canonical, _ = normalize_input_to_system_v12(input_to_system, 0, source="internal")
    meta = canonical["metadata"]
    sc = meta.get("student_context", {}) or {}
    fctx = meta.get("feedback_context", {}) or {}
    cctx = meta.get("course_context", {}) or {}
    tctx = meta.get("teacher_context", {}) or {}
    rating = canonical.get("content", {}).get("rating")
    year = safe_int_or_none(sc.get("year"))

    return {
        "schema_version": "1.0.0",
        "feedback_id": canonical.get("feedback_id"),
        "content": {
            "raw_text": canonical.get("content", {}).get("raw_text", ""),
            "rating": rating,
        },
        "context": {
            "rating": rating,
            "year": year,
            "gender": sc.get("gender"),
            "is_anonymous": fctx.get("is_anonymous"),
            "course_level": normalize_course_level(cctx.get("course_level")),
            "course_delivery_mode": cctx.get("course_delivery_mode"),
            "teacher_role": tctx.get("teacher_role"),
            "student_year": year,
            "gpa": safe_float_or_none(sc.get("gpa")),
            "attendance_rate": safe_float_or_none(sc.get("course_attendance_rate")),
            "course_points": safe_int_or_none(sc.get("course_points")),
        },
    }


ISSUE_TO_TOPIC = {
    "none": None,
    "teaching_style": "teaching_instruction",
    "content_quality": "course_content",
    "assessment": "assessment_grading",
    "materials": "learning_resources",
    "communication": "communication",
    "technical_issue": "technology_platforms",
    "classroom_management": "teaching_instruction",
    "fairness_concern": "diversity_equity_inclusion",
    "other": "university_system_issues",
}

TOPIC_TO_ISSUE = {
    "teaching_instruction": "teaching_style",
    "course_content": "content_quality",
    "assessment_grading": "assessment",
    "learning_resources": "materials",
    "communication": "communication",
    "technology_platforms": "technical_issue",
    "facilities_infrastructure": "technical_issue",
    "university_system_issues": "other",
    "diversity_equity_inclusion": "fairness_concern",
}

OLD_SCOPE_TO_NEW = {
    "none": None,
    "course": "course_section",
    "teacher": "teacher_instructor",
    "department": "department",
    "system": "education_system",
}

NEW_SCOPE_TO_OLD = {
    "course_section": "course",
    "teacher_instructor": "teacher",
    "department": "department",
    "faculty": "department",
    "institute": "system",
    "education_system": "system",
    "digital_platform": "system",
}

OLD_ACTION_TO_NEW = {
    "no_action_needed": "no_action_needed",
    "monitor_pattern": "clarify_communication",
    "follow_up_with_student": "provide_student_support",
    "review_course_materials": "update_content",
    "provide_teacher_feedback": "improve_teaching",
    "escalate_to_department": "investigate_misconduct",
    "open_formal_review": "investigate_misconduct",
    "check_for_policy_violation": "investigate_misconduct",
    "request_more_context": "clarify_communication",
}


def derive_issue_category(output: Dict[str, Any]) -> str:
    if output.get("issue_category"):
        return str(output.get("issue_category"))
    topics = output.get("topics") or []
    for topic in topics:
        if topic in TOPIC_TO_ISSUE:
            return TOPIC_TO_ISSUE[topic]
    if output.get("sentiment") == "positive":
        return "none"
    return "other"


def output_compat(output: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(output or {})
    sd = out.get("satisfaction_dimensions", {}) or {}
    risk = out.get("risk", {}) or {}
    topics = out.get("topics") or []
    issue_category = derive_issue_category(out)
    scopes = risk.get("impact_scopes") or []
    if not isinstance(scopes, list):
        scopes = [scopes]
    if not scopes and risk.get("impact_scope"):
        mapped = OLD_SCOPE_TO_NEW.get(str(risk.get("impact_scope")).strip().lower())
        scopes = [mapped] if mapped else []
    scopes = [s for s in scopes if s and s != "none"]
    old_scope = NEW_SCOPE_TO_OLD.get(scopes[0], scopes[0]) if scopes else "none"
    requires_attention_from = out.get("requires_attention_from") or []
    if isinstance(requires_attention_from, str):
        requires_attention_from = [requires_attention_from]
    requires_attention_from = [x for x in requires_attention_from if x and x != "none"]

    out.setdefault("issue_category", issue_category)
    out["requires_admin_attention"] = bool(requires_attention_from)
    out.setdefault("subtopics", topics[:5])
    out["requires_attention_from"] = requires_attention_from
    out["risk"] = {
        **risk,
        "impact_scope": old_scope,
        "impact_scopes": scopes,
    }
    out["satisfaction_dimensions"] = {
        **sd,
        "fairness": sd.get("assessment_fairness", sd.get("fairness", 0.5)),
        "materials": sd.get("materials_quality", sd.get("materials", 0.5)),
    }
    return out
