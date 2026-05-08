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


def aggregate_overview() -> dict:
    records = _records()
    if not records:
        return _empty_overview()

    sentiments = Counter(r.get("output", {}).get("sentiment", "neutral") for r in records)
    severities = Counter(r.get("output", {}).get("severity", "low") for r in records)
    issues = Counter(r.get("output", {}).get("issue_category", "none") for r in records)
    labels = Counter(r.get("output", {}).get("representative_label", "other") for r in records)

    sentiment_scores = [r.get("output", {}).get("sentiment_score", 0.5) for r in records]
    confidences = [r.get("output", {}).get("confidence", 0.5) for r in records]

    high_critical = severities.get("high", 0) + severities.get("critical", 0)
    admin_attention = sum(1 for r in records if r.get("output", {}).get("requires_admin_attention", False))

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
        vals = [r.get("output", {}).get("satisfaction_dimensions", {}).get(k) for r in records]
        sd_avgs[k] = _avg([v for v in vals if v is not None])

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
        "avg_sentiment_score": _avg(sentiment_scores),
        "avg_confidence": _avg(confidences),
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
        "avg_sentiment_score": 0, "avg_confidence": 0, "high_critical_count": 0,
        "admin_attention_count": 0, "top_issue": "none", "top_risk": "none",
        "satisfaction_dimensions": {}, "latest": [],
    }


def aggregate_university_mood() -> dict:
    records = _records()
    if not records:
        return {}

    emotions = Counter(r.get("output", {}).get("emotion", "indifference") for r in records)
    sentiment_scores = [r.get("output", {}).get("sentiment_score", 0.5) for r in records]

    sd_keys = ["teaching_quality", "clarity", "engagement", "fairness", "materials"]
    sd_avgs = {}
    for k in sd_keys:
        vals = [r.get("output", {}).get("satisfaction_dimensions", {}).get(k) for r in records if r.get("output", {}).get("satisfaction_dimensions", {}).get(k) is not None]
        sd_avgs[k] = _avg(vals)

    # Mood over time: group by month
    monthly = defaultdict(list)
    for r in records:
        ts = r.get("timestamp") or r.get("processed_at", "")
        if ts and len(ts) >= 7:
            month = ts[:7]
            monthly[month].append(r.get("output", {}).get("sentiment_score", 0.5))

    mood_trend = [{"month": m, "avg_score": _avg(v)} for m, v in sorted(monthly.items())]

    dominant_emotion = emotions.most_common(1)[0][0] if emotions else "indifference"

    return {
        "dominant_emotion": dominant_emotion,
        "emotion_distribution": dict(emotions.most_common(12)),
        "university_satisfaction_score": _avg(sentiment_scores),
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
        scores = [r.get("output", {}).get("sentiment_score", 0.5) for r in recs]
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
            "avg_sentiment": _avg(scores),
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
        scores = [r.get("output", {}).get("sentiment_score", 0.5) for r in recs]
        severities = Counter(r.get("output", {}).get("severity") for r in recs)
        tq_vals = [r.get("output", {}).get("satisfaction_dimensions", {}).get("teaching_quality") for r in recs]
        clarity_vals = [r.get("output", {}).get("satisfaction_dimensions", {}).get("clarity") for r in recs]
        fairness_issues = sum(1 for r in recs if r.get("output", {}).get("issue_category") == "fairness_concern")
        high_count = severities.get("high", 0) + severities.get("critical", 0)
        admin_count = sum(1 for r in recs if r.get("output", {}).get("requires_admin_attention", False))

        name = recs[0].get("teacher_fullname", tid)
        role = recs[0].get("teacher_role", "")
        teachers.append({
            "teacher_id": tid,
            "teacher_fullname": name,
            "teacher_role": role,
            "feedback_count": len(recs),
            "avg_sentiment_score": _avg(scores),
            "dominant_emotion": emotions.most_common(1)[0][0] if emotions else "indifference",
            "sentiments": dict(sentiments),
            "avg_teaching_quality": _avg([v for v in tq_vals if v is not None]),
            "avg_clarity": _avg([v for v in clarity_vals if v is not None]),
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
            "severity": r.get("output", {}).get("severity"),
            "course_id": r.get("course_id"),
            "teacher_id": r.get("teacher_id"),
            "teacher_fullname": r.get("teacher_fullname"),
            "recommended_action": r.get("output", {}).get("recommended_action"),
            "summary_uz": r.get("output", {}).get("summary_uz", ""),
            "requires_admin_attention": r.get("output", {}).get("requires_admin_attention", False),
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
    counts = {k: 0 for k in SATISFACTION_KEYS}

    for record in records:
        out = _out(record)
        dims = out.get("satisfaction_dimensions", {}) or {}

        for key in SATISFACTION_KEYS:
            value = dims.get(key)
            if isinstance(value, (int, float)):
                sums[key] += float(value)
                counts[key] += 1

    averages = []
    for key in SATISFACTION_KEYS:
        avg = (sums[key] / counts[key]) if counts[key] else 0.0
        averages.append(round(avg, 4))

    return {
        "labels": SATISFACTION_KEYS,
        "values": averages,
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
    }