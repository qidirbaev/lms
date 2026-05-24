from collections import Counter, defaultdict
from . import data_service
from . import schema_service

EMOTION_KEYS = [
    "frustration",
    "confusion",
    "anxiety",
    "anger",
    "boredom",
    "disappointment",
    "shame",
    "helplessness",
    "isolated",
    "gratitude",
    "confidence",
    "inspiration",
    "relief",
    "satisfaction",
    "surprise",
]

SATISFACTION_KEYS = [
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


def _all_records():
    return data_service.get_all_results()


def _records():
    # Dashboard compatibility adapter: old stored outputs and new canonical outputs are both readable.
    records = data_service.get_all_results()
    hydrated = []
    for r in records:
        x = dict(r)
        x["output"] = schema_service.output_compat(x.get("output", {}))
        hydrated.append(x)
    return hydrated


def _avg(vals: list) -> float:
    vals = [v for v in vals if v is not None]
    return round(sum(vals) / len(vals), 3) if vals else 0.0


def _record_weight(out: dict) -> float:
    cred = _num01((out.get("feedback_credibility") or {}).get("score"), 0.5)
    conf = _num01(out.get("confidence"), 0.5)
    return max(0.05, cred * conf)


def _weighted_avg(values: list, weights: list, empty=0.0):
    pairs = [
        (float(v), float(w))
        for v, w in zip(values, weights)
        if v is not None and w is not None
    ]
    if not pairs:
        return empty
    total_weight = sum(w for _, w in pairs)
    if total_weight <= 0:
        return empty
    return round(sum(v * w for v, w in pairs) / total_weight, 4)


def _weighted_records_avg(records: list, getter, empty=0.0):
    values = []
    weights = []
    for record in records:
        out = record.get("output", {}) or {}
        value = getter(record)
        if value is None:
            continue
        values.append(value)
        weights.append(_record_weight(out))
    return _weighted_avg(values, weights, empty)


def _risk_impact_score(out: dict) -> float:
    direct = out.get("risk_impact_score")
    if direct is not None:
        return _num01(direct, 0.0)
    audit = out.get("score_audit", {}) or {}
    scores = audit.get("scores", {}) if isinstance(audit, dict) else {}
    return _num01(scores.get("risk_impact_score"), 0.0)


def _num01(value, default=0.5):
    """
    Normalize numeric values to 0..1.

    Supports:
    - 0.87
    - 87
    - None
    - invalid strings
    """
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default

    if 1.0 < v <= 100.0:
        v = v / 100.0

    return max(0.0, min(1.0, v))


def _dimension_score_from_evidence(out: dict, key: str) -> float:
    """
    Evidence-weighted satisfaction score.

    Problem fixed:
    AI-generated satisfaction_dimensions often become unrealistically high
    like 0.95, 0.96, 0.98 for almost every dimension.

    This function keeps the AI dimension score as one signal, but adjusts it
    using sentiment, severity, risk probability, risk types, and detected topics.
    """

    dims = out.get("satisfaction_dimensions", {}) or {}

    ai = _num01(dims.get(key), None)
    sentiment_score = _num01(out.get("sentiment_score"), 0.5)

    sentiment = str(out.get("sentiment") or "neutral").lower()
    severity = str(out.get("severity") or "low").lower()

    topics = {
        str(x).lower()
        for x in (
            out.get("topics")
            or out.get("subtopics")
            or []
        )
    }

    risk = out.get("risk", {}) or {}
    risk_types = {
        str(x).lower()
        for x in (risk.get("types") or [])
    }

    # Base score: combine AI dimension score with real sentiment score.
    if ai is not None:
        base = (0.62 * ai) + (0.38 * sentiment_score)
    else:
        base = sentiment_score

    # Sentiment-level correction.
    if sentiment == "negative":
        base -= 0.18
    elif sentiment == "neutral":
        base -= 0.06
    elif sentiment == "positive":
        base += 0.03

    # Severity-level correction.
    severity_penalty = {
        "none": 0.0,
        "low": 0.05,
        "medium": 0.2,
        "high": 0.28,
        "critical": 0.48,
    }

    base -= severity_penalty.get(severity, 0.08)

    # Risk probability correction.
    base -= min(0.16, _num01(risk.get("probability"), 0.0) * 0.18)

    # Dimension-specific topic/risk penalties.
    topic_penalties = {
        "teaching_quality": (
            {"teaching_method", "teacher_style", "pace_too_fast", "too_much_theory"},
            0.13,
        ),
        "clarity": (
            {"clarity", "teaching_method", "confusion", "materials_quality"},
            0.12,
        ),
        "engagement": (
            {"engagement", "boredom", "teacher_style", "too_much_theory"},
            0.12,
        ),
        "course_content_relevance": (
            {"course_content_relevance", "course_content", "practicals", "too_much_theory"},
            0.10,
        ),
        "assessment_fairness": (
            {"assessment_grading", "grading_integrity_issue", "assessment_fairness", "hard_assignments"},
            0.18,
        ),
        "grading_transparency": (
            {"assessment_grading", "grading_transparency", "grading_integrity_issue"},
            0.17,
        ),
        "materials_quality": (
            {"materials_quality", "materials", "course_content"},
            0.12,
        ),
        "support_availability": (
            {"support_availability", "teacher_responsiveness", "support"},
            0.13,
        ),
        "admin_responsiveness": (
            {"platform_admin", "admin_responsiveness", "system_issue"},
            0.15,
        ),
        "workload_balance": (
            {"workload", "hard_assignments", "pace_too_fast"},
            0.14,
        ),
        "overall_satisfaction": (
            {"platform_admin", "assessment_grading", "workload", "teaching_method"},
            0.08,
        ),
    }

    hit_topics, penalty = topic_penalties.get(key, (set(), 0.0))

    if topics.intersection(hit_topics) or risk_types.intersection(hit_topics):
        base -= penalty

    # Prevent near-perfect scores when there is real negative evidence.
    if severity in {"high", "critical"} or risk_types:
        base = min(base, 0.78)
    elif sentiment == "negative":
        base = min(base, 0.70)

    # Final clamp.
    return round(max(0.12, min(0.96, base)), 4)


def aggregate_overview() -> dict:
    records = _records()
    if not records:
        return _empty_overview()

    sentiments = Counter(r.get("output", {}).get("sentiment", "neutral") for r in records)
    severities = Counter(r.get("output", {}).get("severity", "low") for r in records)
    issues = Counter(r.get("output", {}).get("issue_category", "none") for r in records)
    labels = Counter(r.get("output", {}).get("representative_label", "other") for r in records)

    confidences = [r.get("output", {}).get("confidence", 0.5) for r in records]
    avg_sentiment_score = _weighted_records_avg(
        records,
        lambda r: r.get("output", {}).get("sentiment_score"),
    )
    avg_risk_impact_score = _weighted_records_avg(
        records,
        lambda r: _risk_impact_score(r.get("output", {}) or {}),
    )

    high_critical = severities.get("high", 0) + severities.get("critical", 0)
    admin_attention = sum(1 for r in records if r.get("output", {}).get("requires_attention_from"))

    top_issue = issues.most_common(1)[0][0] if issues else "none"

    risk_types_all = []
    for r in records:
        risk = r.get("output", {}).get("risk", {})
        risk_types_all.extend(risk.get("types", []))
    top_risk = Counter(risk_types_all).most_common(1)[0][0] if risk_types_all else "none"

    # Satisfaction dimension averages
    sd_keys = ["teaching_quality", "clarity", "engagement", "fairness", "materials"]
    sd_avgs = {}
    for k in sd_keys:
        sd_avgs[k] = _weighted_records_avg(
            records,
            lambda r, key=k: (r.get("output", {}).get("satisfaction_dimensions", {}) or {}).get(key),
            empty=None,
        )

    latest = sorted(records, key=lambda r: r.get("processed_at", ""), reverse=True)[:5]
    latest_items = [
        {
            "feedback_id": r["feedback_id"],
            "sentiment": r.get("output", {}).get("sentiment"),
            "severity": r.get("output", {}).get("severity"),
            "summary_uz": r.get("output", {}).get("summary_uz", ""),
            "course_id": r.get("course_id"),
            "teacher_id": r.get("teacher_id"),
        }
        for r in latest
    ]

    return {
        "total": len(records),
        "sentiments": dict(sentiments),
        "severities": dict(severities),
        "issues": dict(issues.most_common(10)),
        "labels": dict(labels),
        "avg_sentiment_score": avg_sentiment_score,
        "avg_confidence": _avg(confidences),
        "avg_risk_impact_score": avg_risk_impact_score,
        "high_critical_count": high_critical,
        "admin_attention_count": admin_attention,
        "top_issue": top_issue,
        "top_risk": top_risk,
        "satisfaction_dimensions": sd_avgs,
        "latest": latest_items,
    }


def _empty_overview():
    return {
        "total": 0, "sentiments": {}, "severities": {}, "issues": {}, "labels": {},
        "avg_sentiment_score": 0, "avg_confidence": 0, "avg_risk_impact_score": 0, "high_critical_count": 0,
        "admin_attention_count": 0, "top_issue": "none", "top_risk": "none",
        "satisfaction_dimensions": {}, "latest": [],
    }


def aggregate_university_mood() -> dict:
    records = _records()
    if not records:
        return {}

    emotions = Counter(r.get("output", {}).get("emotion", "indifference") for r in records)
    university_satisfaction_score = _weighted_records_avg(
        records,
        lambda r: (r.get("output", {}).get("satisfaction_dimensions", {}) or {}).get(
            "overall_satisfaction",
            r.get("output", {}).get("sentiment_score"),
        ),
    )

    sd_keys = ["teaching_quality", "clarity", "engagement", "fairness", "materials"]
    sd_avgs = {}
    for k in sd_keys:
        sd_avgs[k] = _weighted_records_avg(
            records,
            lambda r, key=k: (r.get("output", {}).get("satisfaction_dimensions", {}) or {}).get(key),
            empty=None,
        )

    # Mood over time: group by month
    monthly = defaultdict(list)
    for r in records:
        ts = r.get("timestamp") or r.get("processed_at", "")
        if ts and len(ts) >= 7:
            month = ts[:7]
            out = r.get("output", {}) or {}
            monthly[month].append((out.get("sentiment_score", 0.5), _record_weight(out)))

    mood_trend = [
        {
            "month": m,
            "avg_score": _weighted_avg([x[0] for x in v], [x[1] for x in v]),
        }
        for m, v in sorted(monthly.items())
    ]

    dominant_emotion = emotions.most_common(1)[0][0] if emotions else "indifference"

    return {
        "dominant_emotion": dominant_emotion,
        "emotion_distribution": dict(emotions.most_common(12)),
        "university_satisfaction_score": university_satisfaction_score,
        "satisfaction_dimensions": sd_avgs,
        "mood_trend": mood_trend,
        "total_analyzed": len(records),
    }


def aggregate_courses() -> dict:
    records = _records()
    if not records:
        return {}

    by_course = defaultdict(list)
    for r in records:
        cid = r.get("course_id", "unknown")
        by_course[cid].append(r)

    courses = []
    for cid, recs in by_course.items():
        sentiments = Counter(r.get("output", {}).get("sentiment") for r in recs)
        issues = Counter(r.get("output", {}).get("issue_category") for r in recs)
        severities = Counter(r.get("output", {}).get("severity") for r in recs)
        high_risk = severities.get("high", 0) + severities.get("critical", 0)

        kw_all = []
        for r in recs:
            kw_all.extend(r.get("output", {}).get("keywords", []))
        top_kw = [k for k, _ in Counter(kw_all).most_common(5)]

        summaries = [r.get("output", {}).get("summary_uz", "") for r in recs if r.get("output", {}).get("summary_uz")][:3]

        course_name = recs[0].get("course_name", cid)
        courses.append({
            "course_id": cid,
            "course_name": course_name,
            "feedback_count": len(recs),
            "avg_sentiment": _weighted_records_avg(
                recs,
                lambda r: r.get("output", {}).get("sentiment_score"),
            ),
            "sentiments": dict(sentiments),
            "top_issue": issues.most_common(1)[0][0] if issues else "none",
            "high_risk_count": high_risk,
            "top_keywords": top_kw,
            "latest_summaries": summaries,
            "severities": dict(severities),
        })

    courses.sort(key=lambda c: c["avg_sentiment"])
    return {
        "most_problematic": courses[:5],
        "most_praised": sorted(courses, key=lambda c: c["avg_sentiment"], reverse=True)[:5],
        "all": sorted(courses, key=lambda c: c["feedback_count"], reverse=True),
    }


def aggregate_teachers() -> dict:
    records = _records()
    if not records:
        return {}

    by_teacher = defaultdict(list)
    for r in records:
        tid = r.get("teacher_id", "unknown")
        by_teacher[tid].append(r)

    teachers = []
    for tid, recs in by_teacher.items():
        sentiments = Counter(r.get("output", {}).get("sentiment") for r in recs)
        emotions = Counter(r.get("output", {}).get("emotion") for r in recs)
        severities = Counter(r.get("output", {}).get("severity") for r in recs)
        fairness_issues = sum(1 for r in recs if r.get("output", {}).get("issue_category") == "fairness_concern")
        high_count = severities.get("high", 0) + severities.get("critical", 0)
        admin_count = sum(1 for r in recs if r.get("output", {}).get("requires_attention_from"))

        name = recs[0].get("teacher_fullname", tid)
        role = recs[0].get("teacher_role", "")
        teachers.append({
            "teacher_id": tid,
            "teacher_fullname": name,
            "teacher_role": role,
            "feedback_count": len(recs),
            "avg_sentiment_score": _weighted_records_avg(
                recs,
                lambda r: r.get("output", {}).get("sentiment_score"),
            ),
            "dominant_emotion": emotions.most_common(1)[0][0] if emotions else "indifference",
            "sentiments": dict(sentiments),
            "avg_teaching_quality": _weighted_records_avg(
                recs,
                lambda r: (r.get("output", {}).get("satisfaction_dimensions", {}) or {}).get("teaching_quality"),
                empty=None,
            ),
            "avg_clarity": _weighted_records_avg(
                recs,
                lambda r: (r.get("output", {}).get("satisfaction_dimensions", {}) or {}).get("clarity"),
                empty=None,
            ),
            "fairness_concern_count": fairness_issues,
            "high_critical_count": high_count,
            "admin_attention_count": admin_count,
        })

    teachers.sort(key=lambda t: t["feedback_count"], reverse=True)
    return {"teachers": teachers, "total_teachers": len(teachers)}


def aggregate_trends() -> dict:
    records = _records()
    if not records:
        return {}

    daily = defaultdict(lambda: {"total": 0, "positive": 0, "negative": 0, "neutral": 0, "high_severity": 0})
    monthly = defaultdict(lambda: {"total": 0, "positive": 0, "negative": 0, "neutral": 0, "high_severity": 0})

    for r in records:
        ts = r.get("timestamp") or r.get("processed_at", "")
        if not ts or len(ts) < 10:
            continue
        day = ts[:10]
        month = ts[:7]
        sentiment = r.get("output", {}).get("sentiment", "neutral")
        severity = r.get("output", {}).get("severity", "low")
        for bucket in [daily[day], monthly[month]]:
            bucket["total"] += 1
            bucket[sentiment] = bucket.get(sentiment, 0) + 1
            if severity in ("high", "critical"):
                bucket["high_severity"] += 1

    def to_list(d):
        return [{"period": k, **v} for k, v in sorted(d.items())]

    return {
        "daily": to_list(daily)[-30:],
        "monthly": to_list(monthly),
    }


def aggregate_issues() -> dict:
    records = _records()
    if not records:
        return {}

    issue_counter = Counter()
    issue_records = defaultdict(list)
    for r in records:
        cat = r.get("output", {}).get("issue_category", "none")
        issue_counter[cat] += 1
        issue_records[cat].append(r)

    total = len(records) or 1
    issues = []
    for cat, count in issue_counter.most_common():
        recs = issue_records[cat]
        severities = Counter(r.get("output", {}).get("severity") for r in recs)
        examples = [
            {"feedback_id": r["feedback_id"], "summary_uz": r.get("output", {}).get("summary_uz", ""), "severity": r.get("output", {}).get("severity")}
            for r in recs[:3]
        ]
        recommended = Counter(r.get("output", {}).get("recommended_action") for r in recs).most_common(1)
        issues.append({
            "category": cat,
            "count": count,
            "percentage": round(count / total * 100, 1),
            "severities": dict(severities),
            "examples": examples,
            "top_action": recommended[0][0] if recommended else "no_action_needed",
        })

    return {"issues": issues, "total": len(records)}


def aggregate_risks() -> dict:
    records = _records()
    if not records:
        return {}

    risky = [
        r for r in records
        if r.get("output", {}).get("risk", {}).get("types") or r.get("output", {}).get("severity") in ("high", "critical")
    ]

    alerts = []
    for r in risky:
        risk = r.get("output", {}).get("risk", {})
        alerts.append({
            "feedback_id": r["feedback_id"],
            "risk_types": risk.get("types", []),
            "probability": risk.get("probability", 0.0),
            "impact_scope": risk.get("impact_scope", "none"),
            "impact_scopes": risk.get("impact_scopes", []),
            "severity": r.get("output", {}).get("severity"),
            "course_id": r.get("course_id"),
            "teacher_id": r.get("teacher_id"),
            "teacher_fullname": r.get("teacher_fullname"),
            "recommended_action": r.get("output", {}).get("recommended_action"),
            "summary_uz": r.get("output", {}).get("summary_uz", ""),
            "requires_attention_from": r.get("output", {}).get("requires_attention_from", []),
            "requires_admin_attention": bool(r.get("output", {}).get("requires_attention_from")),
            "confidence": r.get("output", {}).get("confidence", 0),
        })

    alerts.sort(key=lambda a: a["probability"], reverse=True)

    risk_type_counter = Counter()
    for a in alerts:
        for rt in a["risk_types"]:
            risk_type_counter[rt] += 1

    return {
        "total_alerts": len(alerts),
        "alerts": alerts[:50],
        "risk_type_distribution": dict(risk_type_counter.most_common()),
    }


def aggregate_keywords() -> dict:
    records = _records()
    if not records:
        return {}

    all_kw = Counter()
    pos_kw = Counter()
    neg_kw = Counter()
    all_topics = Counter()
    all_subtopics = Counter()

    for r in records:
        out = r.get("output", {})
        sentiment = out.get("sentiment", "neutral")
        kws = out.get("keywords", [])
        topics = out.get("topics", [])
        subtopics = out.get("subtopics", [])

        for kw in kws:
            if kw and len(kw) > 2:
                all_kw[kw] += 1
                if sentiment == "positive":
                    pos_kw[kw] += 1
                elif sentiment == "negative":
                    neg_kw[kw] += 1

        for t in topics:
            if t:
                all_topics[t] += 1
        for st in subtopics:
            if st:
                all_subtopics[st] += 1

    return {
        "top_keywords": [{"word": w, "count": c} for w, c in all_kw.most_common(30)],
        "top_positive_keywords": [{"word": w, "count": c} for w, c in pos_kw.most_common(15)],
        "top_negative_keywords": [{"word": w, "count": c} for w, c in neg_kw.most_common(15)],
        "top_topics": [{"topic": t, "count": c} for t, c in all_topics.most_common(20)],
        "top_subtopics": [{"subtopic": s, "count": c} for s, c in all_subtopics.most_common(20)],
    }


def _out(record: dict) -> dict:
    return schema_service.output_compat(record.get("output", {}))


def _record_timestamp(record: dict) -> str:
    input_to_system = record.get("input_to_system", {}) or {}
    metadata = input_to_system.get("metadata", {}) or {}
    ts = metadata.get("timestamp") or record.get("timestamp") or record.get("created_at")

    if isinstance(ts, str) and len(ts) >= 10:
        return ts[:10]

    return "unknown"


def build_emotion_distribution(records: list) -> dict:
    counts = {k: 0 for k in EMOTION_KEYS}

    for record in records:
        out = _out(record)
        emotion = out.get("emotion")
        if emotion in counts:
            counts[emotion] += 1

    return {
        "labels": EMOTION_KEYS,
        "values": [counts[k] for k in EMOTION_KEYS],
        "total": sum(counts.values()),
    }


def build_satisfaction_dimensions(records: list) -> dict:
    sums = {k: 0.0 for k in SATISFACTION_KEYS}
    weights = {k: 0.0 for k in SATISFACTION_KEYS}

    for record in records:
        out = _out(record)
        dims = out.get("satisfaction_dimensions", {}) or {}
        weight = _record_weight(out)

        for key in SATISFACTION_KEYS:
            score = dims.get(key)
            if score is None:
                continue
            sums[key] += _num01(score, 0.0) * weight
            weights[key] += weight

    averages = []
    for key in SATISFACTION_KEYS:
        avg = (sums[key] / weights[key]) if weights[key] else None
        averages.append(round(avg, 4) if avg is not None else None)

    return {
        "labels": SATISFACTION_KEYS,
        "values": averages,
        "method": "credibility_weighted_non_null",
    }


def build_sentiment_trend(records: list) -> dict:
    bucket = defaultdict(lambda: {"positive": 0, "neutral": 0, "negative": 0})

    for record in records:
        out = _out(record)
        day = _record_timestamp(record)
        sentiment = out.get("sentiment")

        if sentiment in ("positive", "neutral", "negative"):
            bucket[day][sentiment] += 1

    labels = sorted(bucket.keys())

    return {
        "labels": labels,
        "positive": [bucket[d]["positive"] for d in labels],
        "neutral": [bucket[d]["neutral"] for d in labels],
        "negative": [bucket[d]["negative"] for d in labels],
    }


def build_emotion_trend(records: list) -> dict:
    bucket = defaultdict(lambda: {k: 0 for k in EMOTION_KEYS})

    for record in records:
        out = _out(record)
        day = _record_timestamp(record)
        emotion = out.get("emotion")

        if emotion in EMOTION_KEYS:
            bucket[day][emotion] += 1

    labels = sorted(bucket.keys())

    series = {
        emotion: [bucket[d][emotion] for d in labels]
        for emotion in EMOTION_KEYS
    }

    dominant = []
    for day in labels:
        row = bucket[day]
        best_emotion = max(row, key=row.get)
        best_count = row[best_emotion]
        dominant.append({
            "date": day,
            "emotion": best_emotion if best_count > 0 else None,
            "count": best_count,
        })

    return {
        "labels": labels,
        "series": series,
        "dominant": dominant,
    }


def build_sentiment_emotion_sankey(records: list) -> dict:
    sentiments = ["positive", "neutral", "negative"]

    matrix = {
        sentiment: {emotion: 0 for emotion in EMOTION_KEYS}
        for sentiment in sentiments
    }

    for record in records:
        out = _out(record)
        sentiment = out.get("sentiment")
        emotion = out.get("emotion")

        if sentiment in sentiments and emotion in EMOTION_KEYS:
            matrix[sentiment][emotion] += 1

    active_emotions = [
        emotion for emotion in EMOTION_KEYS
        if sum(matrix[s][emotion] for s in sentiments) > 0
    ]

    nodes = sentiments + active_emotions
    node_index = {name: idx for idx, name in enumerate(nodes)}

    source = []
    target = []
    value = []

    for sentiment in sentiments:
        for emotion in active_emotions:
            count = matrix[sentiment][emotion]
            if count > 0:
                source.append(node_index[sentiment])
                target.append(node_index[emotion])
                value.append(count)

    return {
        "nodes": nodes,
        "source": source,
        "target": target,
        "value": value,
    }


def get_full_dashboard() -> dict:
    results = _all_records()
    
    return {
        "overview": aggregate_overview(),
        "university_mood": aggregate_university_mood(),
        "courses": aggregate_courses(),
        "teachers": aggregate_teachers(),
        "trends": aggregate_trends(),
        "issues": aggregate_issues(),
        "risks": aggregate_risks(),
        "keywords": aggregate_keywords(),
        
        "emotion_distribution": build_emotion_distribution(results),
        "satisfaction_dimensions_chart": build_satisfaction_dimensions(results),
        "sentiment_trend": build_sentiment_trend(results),
        "emotion_trend": build_emotion_trend(results),
        "emotion_sankey": build_sentiment_emotion_sankey(results),
    }
