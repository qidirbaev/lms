# app/assistant_service.py

import json
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field

from . import config
from . import logger_service as logger


try:
    from google import genai
    from google.genai import types
except Exception:
    genai = None
    types = None


class AssistantMessage(BaseModel):
    role: str
    content: str


class AssistantChatRequest(BaseModel):
    message: str
    context: Dict[str, Any] = Field(default_factory=dict)
    history: List[AssistantMessage] = Field(default_factory=list)


class AssistantAction(BaseModel):
    type: str
    target: Optional[str] = None
    label: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)


class AssistantChatResponse(BaseModel):
    answer: str
    actions: List[AssistantAction] = Field(default_factory=list)
    model: str
    provider: str = "Vertex AI Gemini"
    ok: bool = True


def _client():
    if genai is None or types is None:
        raise HTTPException(
            status_code=500,
            detail="google-genai is not installed. Add google-genai to requirements.txt"
        )

    return genai.Client(
        vertexai=True,
        project=config.GOOGLE_CLOUD_PROJECT,
        location=config.GOOGLE_CLOUD_LOCATION,
    )


def _compact_json(data: Any, max_chars: int) -> str:
    text = json.dumps(data, ensure_ascii=False, indent=2, default=str)
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n...TRUNCATED..."


def _safe_parse_json(text: str) -> Dict[str, Any]:
    cleaned = (text or "").strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(cleaned[start:end + 1])
            except Exception:
                pass

    return {
        "answer": cleaned or "Gemini returned an empty response.",
        "actions": []
    }


def assistant_chat(req: AssistantChatRequest) -> AssistantChatResponse:
    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is empty")

    model = config.VERTEX_MODEL or "gemini-3.1-flash-lite-preview"

    system_prompt = """
You are S-Pilot, a real AI copilot inside SentPro LMS Feedback Intelligence Platform.

Identity:
- You are not the sentiment classifier itself.
- You are the admin-facing AI assistant that uses Gemini on Vertex AI.
- You help admins understand, inspect, explain, and control the platform.

Platform purpose:
- LMS/student feedback analysis
- sentiment detection
- mood tracking
- trend monitoring
- risk and admin-attention detection
- batch analysis
- integration monitoring
- executive PDF reporting

Behavior rules:
- If the user asks a casual question like "Who are you?" or "What's up?", answer naturally.
- If the user asks about the platform, use PLATFORM_CONTEXT.
- Never invent metrics not present in context.
- If data is missing, say exactly what is missing.
- Be direct, practical, and management-oriented.
- Keep answers concise by default.
- You may suggest actions.
- You may return actions for the frontend to execute.

Allowed action types:
- navigate: target can be overview, mood, courses, teachers, trends, issues, risks, keywords, records, batch, test, simulate, integration, logs, settings
- generate_pdf
- refresh_dashboard
- open_record: payload.feedback_id
- clear_chat

Return ONLY valid JSON in this exact shape:
{
  "answer": "string",
  "actions": [
    {
      "type": "navigate|generate_pdf|refresh_dashboard|open_record|clear_chat",
      "target": "string or null",
      "label": "short button label",
      "payload": {}
    }
  ]
}
"""

    context_text = _compact_json(req.context, 28000)
    history_text = _compact_json([m.model_dump() for m in req.history[-12:]], 7000)

    prompt = f"""
{system_prompt}

PLATFORM_CONTEXT:
{context_text}

RECENT_CHAT_HISTORY:
{history_text}

USER_MESSAGE:
{message}
"""

    try:
        client = _client()

        result = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.35,
                max_output_tokens=1400,
                response_mime_type="application/json",
            ),
        )

        raw = result.text or ""
        parsed = _safe_parse_json(raw)

        actions = []
        for a in parsed.get("actions", []) or []:
            if isinstance(a, dict):
                actions.append(AssistantAction(
                    type=str(a.get("type", "")).strip(),
                    target=a.get("target"),
                    label=a.get("label"),
                    payload=a.get("payload") or {}
                ))

        logger.info("assistant_chat_success", {
            "model": model,
            "message_length": len(message),
            "actions": [a.type for a in actions],
        })

        return AssistantChatResponse(
            answer=str(parsed.get("answer") or "I could not generate an answer."),
            actions=actions,
            model=model,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("assistant_chat_failed", {"error": str(e)})
        raise HTTPException(status_code=500, detail=f"S-Pilot Gemini failed: {str(e)}")