import os
import json
import re
import asyncio
from typing import Any, Dict

from google import genai
from google.genai import types as genai_types


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

Return this exact structure:

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
    """
    Uses one HF secret:
    GOOGLE_SERVICE_ACCOUNT_JSON={...full service account json...}

    Writes it to /tmp/gcp-sa.json and sets GOOGLE_APPLICATION_CREDENTIALS,
    exactly like your working tguserbot approach.
    """
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")

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

        project = os.getenv("GOOGLE_CLOUD_PROJECT")
        location = os.getenv("GOOGLE_CLOUD_LOCATION", "global")

        if not project:
            raise RuntimeError("Missing GOOGLE_CLOUD_PROJECT")

        _client = genai.Client(
            vertexai=True,
            project=project,
            location=location,
        )

    return _client


def extract_json(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise RuntimeError(f"No JSON object found in model response: {text[:500]}")
        return json.loads(match.group(0))


def build_input_to_ai(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    content = input_to_system.get("content", {}) or {}
    metadata = input_to_system.get("metadata", {}) or {}

    student_context = metadata.get("student_context", {}) or {}
    feedback_context = metadata.get("feedback_context", {}) or {}
    course_context = metadata.get("course_context", {}) or {}
    teacher_context = metadata.get("teacher_context", {}) or {}

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
            "department_name": student_context.get("department_name"),
            "course_points": student_context.get("course_points"),
            "gpa": student_context.get("gpa"),
            "course_attendance_rate": student_context.get("course_attendance_rate"),
        },

        "feedback_context": {
            "feedback_channel": feedback_context.get("feedback_channel"),
            "is_anonymous": feedback_context.get("is_anonymous"),
        },
    }


async def call_vertex_genai_structured_async(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    client = get_genai_client()

    model = os.getenv("VERTEX_MODEL", "gemini-3.1-flash-lite-preview")
    temperature = float(os.getenv("MODEL_TEMPERATURE", "0.2"))
    max_tokens = int(os.getenv("MODEL_MAX_TOKENS", "2048"))

    input_to_ai = build_input_to_ai(input_to_system)

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
        "input_to_ai": input_to_ai,
        "raw_model_output": raw,
        "parsed_output": extract_json(raw),
    }


def call_gemma_structured(input_to_system: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sync wrapper so your existing FastAPI endpoints do not need major changes.
    Keeps old function name to avoid breaking app.py/data_service.py.
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        raise RuntimeError(
            "call_gemma_structured() called inside running async loop. "
            "Use call_vertex_genai_structured_async() instead."
        )

    return asyncio.run(call_vertex_genai_structured_async(input_to_system))