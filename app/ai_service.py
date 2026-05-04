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
You are an LMS feedback analysis engine.

Return ONLY valid JSON.
Do not use markdown.
Do not add explanations outside JSON.
Follow the outputFromAI schema exactly.

Rules:
- Use only allowed enum values.
- If unsure, choose conservative values.
- Never invent severe risks without explicit evidence.
- Positive feedback should normally have no risk.
- For vague feedback, lower confidence.
- Uzbek summary must be in Uzbek.
- Output must be valid JSON object only.
- topics max 3.
- subtopics max 5.
- keywords max 10.

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


def call_vertex_genai_sync(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    return asyncio.run(call_vertex_genai_once(input_to_system))


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

        return {
            "input_to_ai": result["input_to_ai"],
            "output": output,
            "raw_output": result["raw_output"],
            "provider": "mock",
            "used_fallback": True,
            "corrections": corrections,
        }

    raise RuntimeError(f"Gemini analysis failed and fallback disabled: {last_error}")