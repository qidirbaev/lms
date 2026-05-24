from __future__ import annotations

import re
from statistics import mean
from typing import Any


OUTPUT_SCHEMA_VERSION = "1.1.0"
FORMULA_VERSION = "deterministic_v1.1.0"

SD_KEYS = [
    "teaching_quality",
    "clarity",
    "engagement",
    "course_content_relevance",
    "assessment_fairness",
    "grading_transparency",
    "materials_quality",
    "support_availability",
    "admin_responsiveness",
    "workload_balance",
    "overall_satisfaction",
]

LABEL_SCORES = {
    "positive": 0.80,
    "neutral": 0.50,
    "negative": 0.20,
}

EMOTION_BASE = {
    "anger": 0.90,
    "anxiety": 0.80,
    "frustration": 0.78,
    "disappointment": 0.70,
    "confusion": 0.62,
    "boredom": 0.50,
    "helplessness": 0.72,
    "shame": 0.64,
    "isolated": 0.58,
    "gratitude": 0.55,
    "inspiration": 0.60,
    "confidence": 0.48,
    "satisfaction": 0.46,
    "relief": 0.42,
    "curiosity": 0.40,
    "surprise": 0.45,
    "indifference": 0.22,
}

SEVERITY_WEIGHTS = {
    "none": 0.0,
    "low": 0.20,
    "medium": 0.45,
    "high": 0.75,
    "critical": 1.0,
}

SCOPE_WEIGHTS = {
    "individual_student": 0.20,
    "group_of_students": 0.35,
    "course_section": 0.45,
    "teacher_instructor": 0.50,
    "staff_admin": 0.55,
    "department": 0.65,
    "faculty": 0.75,
    "institute": 0.85,
    "education_system": 1.0,
    "external_community": 0.65,
    "digital_platform": 0.55,
}

GENERAL_ACADEMIC_MARKERS = [
    "dars", "domla", "oqit", "o'qit", "ustoz", "muallim", "mavzu", "fan",
    "amaliy", "laboratoriya", "seminar", "baho", "ball", "imtihon", "test",
    "topshiriq", "deadline", "slayd", "material", "platforma", "lms",
    "teacher", "lesson", "course", "class", "assignment", "exam", "grade",
    "grading", "material", "lecture",
]

SPAM_IRRELEVANT_MARKERS = [
    "abed", "obed", "ovqat", "osh", "haha", "lol", "salom", "privet",
]

DIMENSION_MARKERS = {
    "teaching_quality": {
        "positive": ["yaxshi tushuntir", "zor tushuntir", "zo'r tushuntir", "dars yaxshi", "teacher good"],
        "negative": ["yomon tushuntir", "tushuntirmaydi", "dars yomon", "oqitish yomon", "o'qitish yomon"],
        "neutral": ["dars", "domla", "ustoz", "oqit", "o'qit", "teacher", "lesson", "lecture"],
    },
    "clarity": {
        "positive": ["tushunarli", "aniq", "ravshan", "clear", "understandable"],
        "negative": ["tushunmadim", "chummadim", "chunmadim", "tushunarsiz", "aniq emas", "noaniq", "unclear", "confusing"],
        "neutral": ["tushun", "clarity", "explain"],
    },
    "engagement": {
        "positive": ["qiziqarli", "faol", "interaktiv", "interesting", "engaging"],
        "negative": ["zerikarli", "qiziq emas", "passiv", "boring"],
        "neutral": ["engagement", "faollik"],
    },
    "course_content_relevance": {
        "positive": ["foydali mavzu", "kerakli mavzu", "relevant", "useful content"],
        "negative": ["keraksiz mavzu", "eskirgan", "mavzu mos emas", "irrelevant", "outdated"],
        "neutral": ["mavzu", "content", "curriculum", "sillabus", "syllabus"],
    },
    "assessment_fairness": {
        "positive": ["adolati baho", "fair grading", "fair assessment"],
        "negative": ["adolatsiz", "nohaq", "baho nohaq", "baholash adolatsiz", "unfair"],
        "neutral": ["baholash", "assessment", "baho", "ball", "grade"],
    },
    "grading_transparency": {
        "positive": ["mezon aniq", "rubrika aniq", "criteria clear"],
        "negative": ["mezon aniq emas", "ball nima asosda", "baho nima asosda", "criteria unclear"],
        "neutral": ["mezon", "rubrika", "criteria", "grading"],
    },
    "materials_quality": {
        "positive": ["material yaxshi", "slayd yaxshi", "resource useful", "good material"],
        "negative": ["material yomon", "slayd yetarli emas", "material yetarli emas", "bad material"],
        "neutral": ["material", "slayd", "resurs", "resource", "slide"],
    },
    "support_availability": {
        "positive": ["yordam berdi", "javob berdi", "support helpful"],
        "negative": ["yordam bermadi", "javob bermadi", "support yoq", "support yo'q"],
        "neutral": ["yordam", "support", "consultation", "maslahat"],
    },
    "admin_responsiveness": {
        "positive": ["dekanat yordam berdi", "admin javob berdi"],
        "negative": ["dekanat javob bermadi", "admin javob bermadi", "admin muammo"],
        "neutral": ["dekanat", "admin", "registrar"],
    },
    "workload_balance": {
        "positive": ["yuklama mos", "workload balanced"],
        "negative": ["yuklama kop", "yuklama ko'p", "juda kop topshiriq", "juda ko'p topshiriq", "too much work"],
        "neutral": ["yuklama", "topshiriq", "deadline", "workload"],
    },
}

RISK_MARKERS = [
    ("pora", "corruption_allegation", "serious", "teacher_instructor"),
    ("pul soradi", "corruption_allegation", "serious", "teacher_instructor"),
    ("pul so'radi", "corruption_allegation", "serious", "teacher_instructor"),
    ("korrupsiya", "corruption_allegation", "serious", "department"),
    ("corruption", "corruption_allegation", "serious", "department"),
    ("bribe", "corruption_allegation", "serious", "teacher_instructor"),
    ("haqorat", "harassment_abuse", "explicit", "teacher_instructor"),
    ("tahdid", "harassment_abuse", "serious", "teacher_instructor"),
    ("bosim", "harassment_abuse", "explicit", "teacher_instructor"),
    ("harassment", "harassment_abuse", "serious", "teacher_instructor"),
    ("kamsit", "discrimination_bias", "explicit", "teacher_instructor"),
    ("discrimination", "discrimination_bias", "serious", "teacher_instructor"),
    ("adolatsiz", "grading_integrity_issue", "explicit", "course_section"),
    ("nohaq", "grading_integrity_issue", "explicit", "course_section"),
    ("policy violation", "policy_violation", "serious", "department"),
    ("shaxsiy malumot", "data_privacy_breach", "serious", "digital_platform"),
    ("personal data", "data_privacy_breach", "serious", "digital_platform"),
    ("suicide", "mental_health_crisis", "serious", "individual_student"),
    ("ozimga zarar", "mental_health_crisis", "serious", "individual_student"),
]

RISK_LEVEL_BASE = {
    "weak": 0.35,
    "explicit": 0.55,
    "serious": 0.75,
}


def clip(value: Any, default: float = 0.0) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = default
    return max(0.0, min(1.0, numeric))


def round4(value: Any, default: float = 0.0) -> float:
    return round(clip(value, default), 4)


def _norm_text(value: Any) -> str:
    text = str(value or "").lower()
    return (
        text.replace("‘", "'")
        .replace("’", "'")
        .replace("`", "'")
        .strip()
    )


def _contains(text: str, marker: str) -> bool:
    return marker in text


def _hits(text: str, markers: list[str]) -> list[str]:
    return [marker for marker in markers if _contains(text, marker)]


def _tokens(text: str) -> list[str]:
    return re.findall(r"[\w']+", text, flags=re.UNICODE)


def _safe_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _content(input_to_system: dict) -> dict:
    return input_to_system.get("content", {}) or {}


def _metadata(input_to_system: dict) -> dict:
    return input_to_system.get("metadata", {}) or {}


def _rating_value(input_to_system: dict) -> float | None:
    rating = _content(input_to_system).get("rating")
    if rating is None:
        rating = (input_to_system.get("context", {}) or {}).get("rating")
    value = _safe_float(rating)
    if value is None:
        return None
    return max(1.0, min(5.0, value))


def _rating_score(input_to_system: dict) -> float:
    rating = _rating_value(input_to_system)
    if rating is None:
        return 0.5
    return round4((rating - 1.0) / 4.0, 0.5)


def _student_context(input_to_system: dict) -> dict:
    meta = _metadata(input_to_system)
    ctx = meta.get("student_context", {}) or {}
    legacy = input_to_system.get("context", {}) or {}
    return {
        "attendance": _safe_float(ctx.get("course_attendance_rate", ctx.get("attendance_rate", legacy.get("attendance_rate")))),
        "gpa": _safe_float(ctx.get("gpa", legacy.get("gpa"))),
        "year": _safe_int(ctx.get("year", legacy.get("year", legacy.get("student_year")))),
    }


def _attendance_signal(attendance: float | None) -> float:
    if attendance is None:
        return 0.5
    if attendance >= 0.75:
        return 0.9
    if attendance >= 0.55:
        return 0.6
    if attendance >= 0.40:
        return 0.35
    return 0.2


def _dimension_hits(text: str) -> dict[str, dict[str, Any]]:
    evidence = {}
    for key, groups in DIMENSION_MARKERS.items():
        positive = _hits(text, groups["positive"])
        negative = _hits(text, groups["negative"])
        neutral = _hits(text, groups["neutral"])
        all_hits = positive + negative + neutral
        evidence[key] = {
            "has_evidence": bool(all_hits),
            "positive_markers": positive,
            "negative_markers": negative,
            "neutral_markers": neutral,
            "matched_markers": all_hits,
        }
    return evidence


def _risk_hits(text: str) -> list[dict[str, str]]:
    hits = []
    for phrase, risk_type, level, scope in RISK_MARKERS:
        if _contains(text, phrase):
            hits.append({
                "marker": phrase,
                "type": risk_type,
                "level": level,
                "scope": scope,
            })
    return hits


def _text_features(input_to_system: dict, output: dict) -> dict[str, Any]:
    text = _norm_text(_content(input_to_system).get("raw_text"))
    tokens = _tokens(text)
    word_count = len(tokens)
    dimension_evidence = _dimension_hits(text)
    risk_hits = _risk_hits(text)
    specific_marker_present = any(_hits(text, GENERAL_ACADEMIC_MARKERS)) or any(
        item["has_evidence"] for item in dimension_evidence.values()
    ) or bool(risk_hits)
    domain_evidence = 1.0 if specific_marker_present else 0.0
    specificity = clip(0.15 + 0.55 * min(word_count / 20.0, 1.0) + 0.30 * (1 if specific_marker_present else 0))
    is_vague = word_count < 7

    student = _student_context(input_to_system)
    attendance = student["attendance"]
    gpa = student["gpa"]
    year = student["year"]

    context_modifier = 0.0
    if (
        attendance is not None and attendance >= 0.75
        and gpa is not None and gpa >= 3.5
        and year is not None and year >= 4
        and specificity >= 0.65
    ):
        context_modifier = 0.02
    elif is_vague and attendance is not None and attendance < 0.55:
        context_modifier = -0.03

    spam_like = (
        domain_evidence == 0.0
        and (
            word_count <= 6
            or bool(_hits(text, SPAM_IRRELEVANT_MARKERS))
            or not re.search(r"[a-zA-ZА-Яа-яЁё]", text)
        )
    )

    sentiment = str(output.get("sentiment") or "neutral").lower()
    label_score = LABEL_SCORES.get(sentiment, 0.5)
    rating_score = _rating_score(input_to_system)
    alignment = clip(1.0 - abs(label_score - rating_score))

    return {
        "raw_text": text,
        "tokens": tokens,
        "word_count": word_count,
        "is_vague": is_vague,
        "specific_marker_present": specific_marker_present,
        "specificity": round4(specificity),
        "domain_evidence": domain_evidence,
        "dimension_evidence": dimension_evidence,
        "risk_hits": risk_hits,
        "spam_like": spam_like,
        "attendance": attendance,
        "gpa": gpa,
        "year": year,
        "attendance_signal": _attendance_signal(attendance),
        "context_modifier": context_modifier,
        "sentiment_label": sentiment,
        "label_score": label_score,
        "rating": _rating_value(input_to_system),
        "rating_score": rating_score,
        "alignment": round4(alignment),
        "rating_extremity": round4(abs(rating_score - 0.5) * 2),
    }


def _rating_weight(features: dict[str, Any]) -> float:
    if features["rating"] is None:
        return 0.0
    weight = 0.25 if features["is_vague"] else 0.15
    if abs(features["label_score"] - features["rating_score"]) > 0.45:
        weight = min(weight, 0.10)
    return weight


def _dimension_polarity(key: str, evidence: dict[str, Any], sentiment_score: float) -> float | None:
    if not evidence["has_evidence"]:
        return None
    if evidence["negative_markers"] and not evidence["positive_markers"]:
        return 0.20
    if evidence["positive_markers"] and not evidence["negative_markers"]:
        return 0.85
    if evidence["positive_markers"] and evidence["negative_markers"]:
        return 0.50
    if key in {"assessment_fairness", "grading_transparency"} and sentiment_score < 0.45:
        return 0.30
    return sentiment_score


def _calculate_dimensions(features: dict[str, Any], sentiment_score: float) -> tuple[dict[str, float | None], dict[str, Any]]:
    dims: dict[str, float | None] = {}
    audit: dict[str, Any] = {}
    rating_score = features["rating_score"]
    context_modifier = features["context_modifier"]

    for key in SD_KEYS:
        if key == "overall_satisfaction":
            continue
        evidence = features["dimension_evidence"].get(key, {"has_evidence": False})
        polarity = _dimension_polarity(key, evidence, sentiment_score)
        if polarity is None:
            dims[key] = None
            audit[key] = {
                "has_evidence": False,
                "dimension_evidence_polarity": None,
                "matched_markers": [],
            }
            continue

        score = round4((0.80 * polarity) + (0.15 * sentiment_score) + (0.05 * rating_score) + context_modifier)
        dims[key] = score
        audit[key] = {
            "has_evidence": True,
            "dimension_evidence_polarity": polarity,
            "matched_markers": evidence.get("matched_markers", []),
            "score": score,
        }

    non_null_scores = [score for key, score in dims.items() if key != "overall_satisfaction" and score is not None]
    dimension_mean = mean(non_null_scores) if non_null_scores else sentiment_score
    dims["overall_satisfaction"] = round4(
        (0.70 * sentiment_score) + (0.20 * rating_score) + (0.10 * dimension_mean)
    )
    audit["overall_satisfaction"] = {
        "has_evidence": True,
        "dimension_mean_source": "non_null_dimension_scores" if non_null_scores else "sentiment_score",
        "dimension_mean": round4(dimension_mean),
        "score": dims["overall_satisfaction"],
    }
    return dims, audit


def _calculate_risk(output: dict, features: dict[str, Any]) -> tuple[dict[str, Any], float, dict[str, Any]]:
    hits = features["risk_hits"]
    if not hits:
        return {"types": [], "probability": 0.0, "impact_scopes": []}, 0.0, {
            "explicit_risk_evidence": False,
            "matched_markers": [],
            "risk_impact_score": 0.0,
        }

    raw_risk = output.get("risk", {}) or {}
    model_types = raw_risk.get("types") if isinstance(raw_risk.get("types"), list) else []
    hit_types = [hit["type"] for hit in hits]
    risk_types = list(dict.fromkeys([str(x).strip().lower() for x in hit_types + model_types if x]))[:5]

    level_order = {"weak": 1, "explicit": 2, "serious": 3}
    strongest = max((hit["level"] for hit in hits), key=lambda x: level_order.get(x, 1))
    base = RISK_LEVEL_BASE.get(strongest, 0.35)
    probability = round4(base + (0.10 * features["specificity"]) + (0.03 * min(len(risk_types), 3)))

    model_scopes = raw_risk.get("impact_scopes") if isinstance(raw_risk.get("impact_scopes"), list) else []
    hit_scopes = [hit["scope"] for hit in hits]
    scopes = [scope for scope in hit_scopes + model_scopes if scope in SCOPE_WEIGHTS]
    scopes = list(dict.fromkeys(scopes))[:5]
    if not scopes:
        scopes = ["individual_student"]

    max_scope_weight = max(SCOPE_WEIGHTS.get(scope, 0.2) for scope in scopes)
    severity = str(output.get("severity") or "low").lower()
    severity_weight = SEVERITY_WEIGHTS.get(severity, 0.2)
    risk_impact_score = round4((0.55 * probability) + (0.30 * max_scope_weight) + (0.15 * severity_weight))

    return {"types": risk_types, "probability": probability, "impact_scopes": scopes}, risk_impact_score, {
        "explicit_risk_evidence": True,
        "matched_markers": hits,
        "base_by_evidence_level": base,
        "max_scope_weight": max_scope_weight,
        "severity_weight": severity_weight,
        "risk_impact_score": risk_impact_score,
    }


def apply_deterministic_scores(output: dict, input_to_system: dict) -> tuple[dict, list[str]]:
    corrections: list[str] = []
    scored = dict(output or {})
    features = _text_features(input_to_system, scored)

    rating_weight = _rating_weight(features)
    sentiment_score = round4(
        ((1.0 - rating_weight) * features["label_score"])
        + (rating_weight * features["rating_score"])
        + features["context_modifier"]
    )

    credibility = round4(
        0.10
        + (0.35 * features["specificity"])
        + (0.25 * features["alignment"])
        + (0.15 * features["attendance_signal"])
        + (0.15 * features["domain_evidence"])
    )
    if features["is_vague"]:
        credibility = min(credibility, 0.45)
    if features["spam_like"]:
        credibility = min(credibility, 0.25)

    confidence = round4(
        0.20
        + (0.35 * features["specificity"])
        + (0.20 * features["alignment"])
        + (0.25 * features["domain_evidence"])
    )
    if features["is_vague"]:
        confidence = min(confidence, 0.50)

    emotion = str(scored.get("emotion") or "indifference").lower()
    emotion_base = EMOTION_BASE.get(emotion, 0.35)
    emotion_intensity = round4(
        (0.55 * emotion_base)
        + (0.25 * abs(sentiment_score - 0.5) * 2)
        + (0.10 * features["rating_extremity"])
        + (0.10 * features["specificity"])
    )

    dims, dimension_audit = _calculate_dimensions(features, sentiment_score)
    risk, risk_impact_score, risk_audit = _calculate_risk(scored, features)

    if not risk["types"]:
        if scored.get("recommended_action") in {"investigate_misconduct", "emergency_intervention"}:
            scored["recommended_action"] = "clarify_communication"
            corrections.append("deterministic_scoring: downgraded escalation action without explicit risk evidence")
        if scored.get("severity") not in {"high", "critical"}:
            scored["requires_attention_from"] = []
    elif risk["probability"] >= 0.50 and not scored.get("requires_attention_from"):
        scored["requires_attention_from"] = ["department_head"]

    scored.update({
        "schema_version": OUTPUT_SCHEMA_VERSION,
        "sentiment_score": sentiment_score,
        "feedback_credibility": {"score": round4(credibility)},
        "confidence": round4(confidence),
        "emotion_intensity": emotion_intensity,
        "risk": risk,
        "risk_impact_score": risk_impact_score,
        "satisfaction_dimensions": dims,
    })

    scored["score_audit"] = {
        "formula_version": FORMULA_VERSION,
        "inputs": {
            "sentiment_label": features["sentiment_label"],
            "emotion": emotion,
            "rating": features["rating"],
            "rating_score": features["rating_score"],
            "word_count": features["word_count"],
            "attendance": features["attendance"],
            "gpa": features["gpa"],
            "year": features["year"],
        },
        "components": {
            "label_score": features["label_score"],
            "specificity": features["specificity"],
            "specific_marker_present": features["specific_marker_present"],
            "alignment": features["alignment"],
            "context_modifier": features["context_modifier"],
            "rating_weight": rating_weight,
            "attendance_signal": features["attendance_signal"],
            "domain_evidence": features["domain_evidence"],
            "is_vague": features["is_vague"],
            "spam_like": features["spam_like"],
            "emotion_base": emotion_base,
            "rating_extremity": features["rating_extremity"],
        },
        "dimension_evidence": dimension_audit,
        "risk": risk_audit,
        "formulas": {
            "sentiment_score": "clip((1-rating_weight)*label_score + rating_weight*rating_score + context_modifier)",
            "credibility": "clip(0.10 + 0.35*specificity + 0.25*alignment + 0.15*attendance_signal + 0.15*domain_evidence), capped for vague/spam-like text",
            "confidence": "clip(0.20 + 0.35*specificity + 0.20*alignment + 0.25*domain_evidence), capped for vague text",
            "emotion_intensity": "clip(0.55*emotion_base + 0.25*abs(sentiment_score-0.5)*2 + 0.10*rating_extremity + 0.10*specificity)",
            "dimension_score": "null if no direct evidence; otherwise clip(0.80*dimension_evidence_polarity + 0.15*sentiment_score + 0.05*rating_score + context_modifier)",
            "overall_satisfaction": "clip(0.70*sentiment_score + 0.20*rating_score + 0.10*mean(non_null_dimension_scores or sentiment_score))",
            "risk_probability": "0 if no explicit risk; otherwise clip(base_by_evidence_level + 0.10*specificity + 0.03*min(type_count,3))",
            "risk_impact_score": "0 if no risk; otherwise clip(0.55*risk_probability + 0.30*max_scope_weight + 0.15*severity_weight)",
        },
        "scores": {
            "sentiment_score": sentiment_score,
            "credibility": round4(credibility),
            "confidence": round4(confidence),
            "emotion_intensity": emotion_intensity,
            "risk_probability": risk["probability"],
            "risk_impact_score": risk_impact_score,
            "overall_satisfaction": dims["overall_satisfaction"],
        },
    }

    corrections.append(f"deterministic_scoring: recalculated numeric scores with {FORMULA_VERSION}")
    return scored, corrections
