import os
import json
import re
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request


SYSTEM_PROMPT = """
You are an LMS feedback analysis engine.

Return ONLY valid JSON.
No markdown.
No explanation outside JSON.

Analyze the provided inputToSystem feedback object.

Return this exact outputFromAI JSON structure:
{
  "schema_version": "1.0.0",
  "feedback_id": "string",
  "language": "uz|ru|en|mixed",
  "sentiment": "positive|neutral|negative",
  "sentiment_score": 0.0,
  "emotion": "frustration|confusion|anxiety|anger|boredom|gratitude|curiosity|confidence|inspiration|relief|indifference|disappointment",
  "emotion_intensity": 0.0,
  "topics": ["string"],
  "issue_category": "none|teaching_style|content_quality|assessment|materials|communication|technical_issue|classroom_management|fairness_concern|other",
  "risk": {
    "types": ["corruption_allegation|harassment_claim|grading_bias|academic_integrity_issue|discrimination_claim|policy_violation|system_abuse|coordinated_spam"],
    "probability": 0.0,
    "impact_scope": "none|course|teacher|department|system"
  },
  "severity": "low|medium|high|critical",
  "confidence": 0.0,
  "summary_uz": "string",
  "representative_label": "complaint|praise|suggestion|incident|other",
  "requires_admin_attention": false,
  "recommended_action": "no_action_needed|monitor_pattern|follow_up_with_student|review_course_materials|provide_teacher_feedback|escalate_to_department|open_formal_review|check_for_policy_violation|request_more_context"
}

Rules:
- sentiment must be only positive, neutral, or negative.
- risk must always be an object.
- topics max 3.
- confidence must be between 0 and 1.
- If there is no risk, use risk.types=[] and probability=0.0.
"""


def get_access_token():
    sa_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not sa_json:
        raise Exception("Missing GOOGLE_SERVICE_ACCOUNT_JSON")

    info = json.loads(sa_json)

    credentials = service_account.Credentials.from_service_account_info(
        info,
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    credentials.refresh(Request())
    return credentials.token


def extract_json(text: str):
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise Exception("No JSON object found in model response")
        return json.loads(match.group(0))


def call_gemma_structured(input_to_system: dict):
    token = get_access_token()

    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    location = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
    model = os.getenv("VERTEX_MODEL", "google/gemma-4-26b-a4b-it-maas")

    url = f"https://aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/endpoints/openapi/chat/completions"

    user_prompt = {
        "task": "Analyze this LMS feedback and return outputFromAI JSON.",
        "inputToSystem": input_to_system
    }

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(user_prompt, ensure_ascii=False)}
        ],
        "temperature": 0.2,
        "stream": False,
        "max_tokens": 2048
    }

    res = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=body,
        timeout=90
    )

    if res.status_code != 200:
        raise Exception(f"Gemma error: {res.status_code} {res.text}")

    data = res.json()
    raw_content = data["choices"][0]["message"]["content"]
    parsed = extract_json(raw_content)

    return {
        "raw_model_output": raw_content,
        "parsed_output": parsed
    }