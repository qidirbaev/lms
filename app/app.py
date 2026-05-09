import asyncio
import uuid
import time
from datetime import datetime, timezone
from pathlib import Path
import os
import json
import time

from fastapi import FastAPI, HTTPException, Header, Request, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import requests

from . import config
from . import logger_service as logger
from . import data_service
from . import auth_service
from . import dashboard_service
from . import simulation_service
from . import integration_service
from . import batch_job_service
from . import schema_service
from .ai_service import analyze_feedback, analyze_feedback_batch
from .models import (
    LoginRequest, AnalyzeFileItemRequest, ProcessBatchRequest,
    AnalyzeCustomRequest, SimulateRequest, RecordsFilterRequest,
)

from .assistant_service import AssistantChatRequest, assistant_chat
from fastapi.middleware.cors import CORSMiddleware

import urllib.parse
import urllib.request
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

# ─── Init ────────────────────────────────────────────────────────────────────
logger.init()
data_service.init()
batch_job_service.init()
logger.info("config_loaded", {
    "ai_provider": config.AI_PROVIDER,
    "concurrency": config.BATCH_CONCURRENCY,
    "fallback": config.FALLBACK_TO_MOCK,
})

app = FastAPI(title="LMS Feedback AI Analyzer", version="2.0.0")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN] if FRONTEND_ORIGIN != "*" else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = config.STATIC_DIR

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# ─── Auth helper ─────────────────────────────────────────────────────────────

def require_auth(authorization: str = Header(default=None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token or not auth_service.verify_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return token


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/")
def index():
    index_file = STATIC_DIR / "index.html"

    if index_file.exists():
        return FileResponse(index_file)
    
    return {
        "status": "backend_running",
        "message": "The backend is running, the frontend has moved to a separate deployment. Please access the frontend to use the application.",
    }

@app.get("/worm")
def index():
    return {
        "status": "good",
        "message": "WORM IS HERE!"
    }


@app.get("/health")
def health():
    return {
        "status": "running",
        "ai_provider": config.AI_PROVIDER,
        "project": config.GOOGLE_CLOUD_PROJECT,
        "location": config.GOOGLE_CLOUD_LOCATION,
        "model": config.VERTEX_MODEL,
        "processed_count": data_service.count_results(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/login")
def login(req: LoginRequest):
    result = auth_service.login(req.username, req.password)
    if result["success"]:
        logger.info("login_success", {"username": req.username})
        return {"success": True, "token": result["token"], "username": result["username"]}
    logger.warn("login_failed", {"username": req.username})
    raise HTTPException(status_code=401, detail="Invalid credentials")


@app.post("/logout")
def logout(authorization: str = Header(default=None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if token:
        auth_service.logout(token)
    return {"success": True}


# ─── Dashboard ───────────────────────────────────────────────────────────────

@app.get("/dashboard")
def get_dashboard(authorization: str = Header(default=None)):
    require_auth(authorization)
    return dashboard_service.get_full_dashboard()


@app.get("/dashboard/overview")
def get_overview(authorization: str = Header(default=None)):
    require_auth(authorization)
    return dashboard_service.aggregate_overview()


@app.get("/dashboard/mood")
def get_mood(authorization: str = Header(default=None)):
    require_auth(authorization)
    return dashboard_service.aggregate_university_mood()


@app.get("/dashboard/courses")
def get_courses_dash(authorization: str = Header(default=None)):
    require_auth(authorization)
    return dashboard_service.aggregate_courses()


@app.get("/dashboard/teachers")
def get_teachers_dash(authorization: str = Header(default=None)):
    require_auth(authorization)
    return dashboard_service.aggregate_teachers()


@app.get("/dashboard/trends")
def get_trends(authorization: str = Header(default=None)):
    require_auth(authorization)
    return dashboard_service.aggregate_trends()


@app.get("/dashboard/issues")
def get_issues(authorization: str = Header(default=None)):
    require_auth(authorization)
    return dashboard_service.aggregate_issues()


@app.get("/dashboard/risks")
def get_risks(authorization: str = Header(default=None)):
    require_auth(authorization)
    return dashboard_service.aggregate_risks()


@app.get("/dashboard/keywords")
def get_keywords(authorization: str = Header(default=None)):
    require_auth(authorization)
    return dashboard_service.aggregate_keywords()


# ─── Integrations ────────────────────────────────────────────────────────────

@app.get("/integrations/status")
def integrations_status(authorization: str = Header(default=None)):
    require_auth(authorization)

    integrations = integration_service.list_integrations()
    requests = integration_service.list_request_logs(limit=60)
    presets = integration_service.list_presets()

    accepted_total = sum(int(x.get("accepted_count", 0) or 0) for x in integrations)
    rejected_total = sum(int(x.get("rejected_count", 0) or 0) for x in integrations)
    active_total = len([x for x in integrations if x.get("active")])

    return {
        "mode": "secure_rest",
        "supported_systems": ["LMS", "HEMIS", "Moodle", "Custom SIS", "Student Portal"],
        "auth_method": "X-Integration-Token",
        "ingest_endpoint": "/integrations/ingest-feedback",
        "rate_limit": "30 requests/minute per token",
        "schema": "inputToSystem or flat feedback object",
        "active_integrations": integrations,
        "request_logs": requests,
        "presets": presets,
        "metrics": {
            "systems_total": len(integrations),
            "systems_active": active_total,
            "accepted_total": accepted_total,
            "rejected_total": rejected_total,
            "requests_total": len(requests),
        },
        "security_features": [
            "hashed token storage",
            "per-token rate limiting",
            "schema validation",
            "mapping to inputToSystem",
            "structured request logging",
            "AI validation before persistence",
            "token revocation",
        ],
    }


@app.post("/integrations/token")
def create_integration_token(payload: dict, authorization: str = Header(default=None)):
    require_auth(authorization)

    system_name = (payload.get("system_name") or "External LMS").strip()
    system_type = (payload.get("system_type") or "lms").strip()

    if not system_name:
        raise HTTPException(status_code=400, detail="system_name is required")

    result = integration_service.create_integration_token(system_name, system_type)

    return {
        "success": True,
        "message": "Copy this token now. It is shown only once.",
        "token": result["token"],
        "integration": result["record"],
        "field_map": integration_service.get_field_map(system_type),
    }


@app.post("/integrations/revoke/{token_id}")
def revoke_integration_token(token_id: str, authorization: str = Header(default=None)):
    require_auth(authorization)

    revoked = integration_service.revoke_token(token_id)

    if not revoked:
        raise HTTPException(status_code=404, detail="Integration token not found")

    return {
        "success": True,
        "message": "Integration token revoked",
        "integration": revoked,
    }


@app.post("/integrations/mapper/preview")
def integration_mapper_preview(payload: dict, authorization: str = Header(default=None)):
    require_auth(authorization)

    system_type = payload.get("system_type", "custom")
    sample = payload.get("payload") or integration_service.list_presets().get(system_type, {}).get("sample_payload", {})

    try:
        mapped, warnings = data_service.normalize_uploaded_feedback(sample, 0)
        mapped["metadata"]["source_system"] = payload.get("system_name", "Preview System")
        mapped["metadata"].setdefault("feedback_context", {})["feedback_channel"] = f"integration:{system_type}"

        return {
            "success": True,
            "system_type": system_type,
            "field_map": integration_service.get_field_map(system_type),
            "input": sample,
            "mapped": mapped,
            "warnings": warnings,
        }
    except Exception as e:
        return {
            "success": False,
            "system_type": system_type,
            "field_map": integration_service.get_field_map(system_type),
            "input": sample,
            "error": str(e),
        }


@app.post("/integrations/ingest-feedback")
def ingest_feedback_from_external_system(
    payload: dict,
    x_integration_token: str = Header(default=None),
):
    token_record = integration_service.verify_integration_token(x_integration_token)

    if not token_record:
        logger.warn("integration_ingest_rejected", {"reason": "invalid_token"})
        integration_service.log_ingest_request(
            None,
            status="rejected_invalid_token",
            accepted=0,
            rejected=1,
            errors=[{"error": "Invalid integration token"}],
            preview={"payload_type": type(payload).__name__},
        )
        raise HTTPException(status_code=401, detail="Invalid integration token")

    ok, rate = integration_service.check_rate_limit(token_record)

    if not ok:
        logger.warn("integration_rate_limited", {
            "system": token_record.get("system_name"),
            "rate": rate,
        })
        integration_service.log_ingest_request(
            token_record,
            status="rate_limited",
            accepted=0,
            rejected=1,
            errors=[{"error": "Rate limit exceeded"}],
            preview={"rate": rate},
        )
        raise HTTPException(status_code=429, detail={
            "message": "Rate limit exceeded",
            "rate": rate,
        })

    if isinstance(payload, dict):
        if isinstance(payload.get("items"), list):
            raw_items = payload["items"]
        elif isinstance(payload.get("feedbacks"), list):
            raw_items = payload["feedbacks"]
        elif isinstance(payload.get("data"), list):
            raw_items = payload["data"]
        else:
            raw_items = [payload]
    elif isinstance(payload, list):
        raw_items = payload
    else:
        raise HTTPException(status_code=400, detail="Payload must be object, array, or wrapper with items/feedbacks/data")

    raw_items = raw_items[:25]

    valid_items = []
    warnings = []
    errors = []
    results = []

    for idx, item in enumerate(raw_items):
        try:
            mapped, item_warnings = data_service.normalize_uploaded_feedback(item, idx)
            mapped["metadata"]["source_system"] = token_record.get("system_name")
            mapped["metadata"].setdefault("feedback_context", {})["feedback_channel"] = f"integration:{token_record.get('system_type')}"
            valid_items.append(mapped)
            warnings.extend([{"index": idx, "warning": w} for w in item_warnings])
        except Exception as e:
            errors.append({"index": idx, "error": str(e)})

    for item in valid_items:
        fid = item.get("feedback_id", f"int-{uuid.uuid4().hex[:8]}")
        try:
            analysis = analyze_feedback(item)
            data_service.upsert_result(fid, item, analysis)

            out_compat = schema_service.output_compat(analysis["output"])
            results.append({
                "feedback_id": fid,
                "success": True,
                "sentiment": out_compat.get("sentiment"),
                "severity": out_compat.get("severity"),
                "topics": out_compat.get("topics", []),
                "issue_category": out_compat.get("issue_category"),
                "requires_attention_from": out_compat.get("requires_attention_from", []),
                "requires_admin_attention": out_compat.get("requires_admin_attention"),
            })
        except Exception as e:
            results.append({
                "feedback_id": fid,
                "success": False,
                "error": str(e),
            })

    accepted = len(valid_items)
    rejected = len(errors)
    status = "accepted" if accepted and not rejected else "partial" if accepted else "rejected"

    integration_service.touch_token(token_record, accepted=accepted, rejected=rejected, status=status)

    request_log = integration_service.log_ingest_request(
        token_record,
        status=status,
        accepted=accepted,
        rejected=rejected,
        errors=errors,
        warnings=warnings,
        preview={
            "received": len(raw_items),
            "first_item_keys": list(raw_items[0].keys()) if raw_items and isinstance(raw_items[0], dict) else [],
        },
    )

    logger.info("integration_ingest_completed", {
        "system": token_record.get("system_name"),
        "received": len(raw_items),
        "accepted": accepted,
        "errors": rejected,
        "processed": len(results),
    })

    report = integration_service.build_ingest_report(
        raw_items,
        valid_items,
        errors,
        warnings,
        token_record
    )

    return {
        "success": True,
        "request_id": request_log.get("id"),
        "status": request_log.get("status"),
        "accepted": report.get("accepted", 0),
        "rejected": report.get("rejected", 0),
        "warnings": report.get("warnings", []),
        "errors": report.get("errors", []),
        "results": [
            {
                "feedback_id": r.get("feedback_id"),
                "status": "processed" if r.get("success") else "failed"
            }
            for r in results
        ],
        "rate_limit": report.get("rate"),
        "timestamp": report.get("timestamp"),
    }


@app.get("/integrations/request/{request_id}")
def get_integration_request_details(
    request_id: str,
    authorization: str = Header(default=None)
):
    require_auth(authorization)

    logs = integration_service.list_request_logs(limit=500)

    item = next(
        (x for x in logs if x.get("id") == request_id),
        None
    )

    if not item:
        raise HTTPException(status_code=404, detail="Request not found")

    return {
        "request": item,
        "dashboard_snapshot": dashboard_service.get_full_dashboard(),
    }


@app.post("/integrations/test-ingest")
def integration_test_ingest(payload: dict, authorization: str = Header(default=None)):
    require_auth(authorization)

    system_name = payload.get("system_name", "Demo LMS")
    system_type = payload.get("system_type", "lms")
    feedback = payload.get("feedback") or integration_service.list_presets().get(system_type, {}).get("sample_payload")

    token_pack = integration_service.create_integration_token(system_name, system_type)
    fake_token_record = integration_service.verify_integration_token(token_pack["token"])

    mapped, warnings = data_service.normalize_uploaded_feedback(feedback, 0)
    mapped["metadata"]["source_system"] = system_name
    mapped["metadata"].setdefault("feedback_context", {})["feedback_channel"] = f"integration:{system_type}"

    fid = mapped.get("feedback_id", f"test-int-{uuid.uuid4().hex[:8]}")
    analysis = analyze_feedback(mapped)
    data_service.upsert_result(fid, mapped, analysis)

    integration_service.touch_token(fake_token_record, accepted=1, rejected=0, status="test_accepted")

    request_log = integration_service.log_ingest_request(
        fake_token_record,
        status="test_accepted",
        accepted=1,
        rejected=0,
        warnings=warnings,
        preview={
            "demo": True,
            "first_item_keys": list(feedback.keys()) if isinstance(feedback, dict) else [],
        },
    )

    logger.info("integration_test_ingest_success", {
        "system": system_name,
        "feedback_id": fid,
    })

    return {
        "success": True,
        "feedback_id": fid,
        "token_preview": token_pack["token"][:14] + "..." + token_pack["token"][-6:],
        "request_log": request_log,
        "field_map": integration_service.get_field_map(system_type),
        "inputToSystem": mapped,
        "outputFromAI": analysis["output"],
        "dashboard": dashboard_service.get_full_dashboard(),
        "integration_status": integrations_status(authorization),
    }


# ─── Feedbacks ───────────────────────────────────────────────────────────────

@app.post("/upload-feedbacks")
async def upload_feedbacks(file: UploadFile = File(...), authorization: str = Header(default=None)):
    require_auth(authorization)

    if not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Only .json files are supported in MVP")

    try:
        raw = await file.read()
        text = raw.decode("utf-8")
        data = json.loads(text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {e}")

    if isinstance(data, dict):
        # Support common wrappers
        if isinstance(data.get("items"), list):
            data = data["items"]
        elif isinstance(data.get("feedbacks"), list):
            data = data["feedbacks"]
        elif isinstance(data.get("data"), list):
            data = data["data"]
        else:
            data = [data]

    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="JSON must be an array or object wrapper with items/feedbacks/data")

    result = data_service.save_uploaded_source(data, file.filename)

    return {
        "success": True,
        "source": "uploaded",
        "filename": result["filename"],
        "total_received": result["total_received"],
        "valid_count": result["valid_count"],
        "error_count": result["error_count"],
        "warning_count": result["warning_count"],
        "errors": result["errors"],
        "warnings": result["warnings"],
        "preview": [
            {
                "index": i,
                "feedback_id": item.get("feedback_id"),
                "raw_text": item.get("content", {}).get("raw_text", "")[:220],
                "rating": item.get("content", {}).get("rating"),
                "course_id": item.get("metadata", {}).get("course_id"),
                "teacher_id": item.get("metadata", {}).get("teacher_id"),
            }
            for i, item in enumerate(result["items"][:10])
        ],
    }

@app.get("/feedbacks/{source}")
def get_feedbacks(source: str, limit: int = 50, authorization: str = Header(default=None)):
    require_auth(authorization)
    try:
        data = data_service.load_source_file(source)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    items = data[:limit]
    return {
        "source": source,
        "total": len(data),
        "returned": len(items),
        "items": [
            {
                "index": i,
                "feedback_id": item.get("feedback_id"),
                "raw_text": item.get("content", {}).get("raw_text", "")[:200],
                "rating": item.get("content", {}).get("rating"),
                "course_id": item.get("metadata", {}).get("course_id"),
                "teacher_id": item.get("metadata", {}).get("teacher_id"),
                "already_processed": data_service.get_result(item.get("feedback_id")) is not None,
            }
            for i, item in enumerate(items)
        ],
    }


# ─── Analysis ────────────────────────────────────────────────────────────────

@app.post("/analyze-file-item")
def analyze_file_item(req: AnalyzeFileItemRequest, authorization: str = Header(default=None)):
    require_auth(authorization)
    try:
        data = data_service.load_source_file(req.source)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if req.index < 0 or req.index >= len(data):
        raise HTTPException(status_code=400, detail=f"Index {req.index} out of range (0-{len(data)-1})")

    input_to_system = data[req.index]
    feedback_id = input_to_system.get("feedback_id", f"fb-{req.index:05d}")

    try:
        analysis = analyze_feedback(input_to_system)
        record = data_service.upsert_result(feedback_id, input_to_system, analysis)
        logger.info("analyze_file_item_success", {"feedback_id": feedback_id, "source": req.source})
    except Exception as e:
        logger.error("analyze_file_item_failed", {"feedback_id": feedback_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "source": req.source,
        "index": req.index,
        "feedback_id": feedback_id,
        "inputToSystem": input_to_system,
        "inputToAI": analysis["input_to_ai"],
        "outputFromAI": analysis["output"],
        "rawModelOutput": analysis["raw_output"],
        "provider": analysis["provider"],
        "corrections": analysis["corrections"],
        "dashboard": dashboard_service.get_full_dashboard(),
    }

@app.post("/process-batch")
async def process_batch(req: ProcessBatchRequest, authorization: str = Header(default=None)):
    require_auth(authorization)

    try:
        job = batch_job_service.create_job(
            source=req.source,
            limit=req.limit,
            batch_size=req.batch_size,
            use_batch_ai=req.use_batch_ai,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {
        "success": True,
        "mode": "background_job",
        "job": job,
    }

@app.get("/batch-jobs")
def list_batch_jobs(authorization: str = Header(default=None)):
    require_auth(authorization)
    return {
        "jobs": batch_job_service.list_jobs(limit=20)
    }


@app.get("/batch-jobs/{job_id}")
def get_batch_job(job_id: str, authorization: str = Header(default=None)):
    require_auth(authorization)

    job = batch_job_service.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    return {
        "job": job
    }


@app.post("/batch-jobs/{job_id}/cancel")
def cancel_batch_job(job_id: str, authorization: str = Header(default=None)):
    require_auth(authorization)

    job = batch_job_service.cancel_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    return {
        "success": True,
        "job": job,
    }


@app.get("/batch-jobs/{job_id}/dashboard")
def get_batch_job_dashboard(job_id: str, authorization: str = Header(default=None)):
    require_auth(authorization)

    job = batch_job_service.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    return {
        "job": job,
        "dashboard": batch_job_service.job_dashboard(),
    }

@app.post("/analyze-custom")
def analyze_custom(req: AnalyzeCustomRequest, authorization: str = Header(default=None)):
    require_auth(authorization)

    if not req.raw_text.strip():
        raise HTTPException(status_code=400, detail="raw_text is required")

    feedback_id = req.feedback_id or f"custom-{uuid.uuid4().hex[:8]}"
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    input_to_system = {
        "schema_version": "1.2.0",
        "feedback_id": feedback_id,
        "content": {
            "raw_text": req.raw_text,
            "rating": req.rating,
        },
        "metadata": {
            "timestamp": ts,
            "semester_id": req.semester_id,
            "course_id": req.course_id,
            "teacher_id": req.teacher_id,
            "teacher_fullname": req.teacher_fullname,
            "student_context": {
                "year": req.year,
                "gender": req.gender,
                "group_id": req.group_id,
                "department_name": req.department,
                "course_points": req.course_points,
                "gpa": req.gpa,
                "course_attendance_rate": req.attendance_rate,
            },
            "feedback_context": {
                "feedback_channel": req.feedback_channel,
                "is_anonymous": req.is_anonymous,
            },
            "course_context": {
                "course_name": req.course_name,
                "course_level": req.course_level,
                "course_delivery_mode": req.course_delivery_mode,
            },
            "teacher_context": {
                "teacher_role": req.teacher_role,
                "teaching_experience_years": req.teaching_experience_years,
                "teacher_department_id": req.teacher_department_id,
            },
        },
        "mapping_audit": {
            "source": "custom_test",
            "mapping_mode": "manual_form_to_inputToSystem_v1.2.0",
            "missing_fields_policy": "null_not_invented",
            "system_generated_fields": [
                "schema_version",
                "feedback_id" if not req.feedback_id else None,
                "metadata.timestamp",
            ],
            "provided_fields": [
                k for k, v in req.model_dump().items()
                if v is not None and v != ""
            ],
        },
    }
    
    input_to_system["mapping_audit"]["system_generated_fields"] = [
        x for x in input_to_system["mapping_audit"]["system_generated_fields"]
        if x
    ]
    
    try:
        analysis = analyze_feedback(input_to_system)
        record = data_service.upsert_result(feedback_id, input_to_system, analysis)
        logger.info("analyze_custom_success", {"feedback_id": feedback_id})
    except Exception as e:
        logger.error("analyze_custom_failed", {"feedback_id": feedback_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "feedback_id": feedback_id,
        "inputToSystem": input_to_system,
        "inputToAI": analysis["input_to_ai"],
        "outputFromAI": analysis["output"],
        "rawModelOutput": analysis["raw_output"],
        "provider": analysis["provider"],
        "corrections": analysis["corrections"],
        "dashboard": dashboard_service.get_full_dashboard(),
    }


# ─── Simulation ───────────────────────────────────────────────────────────────

@app.post("/generate-simulated-feedbacks")
def generate_simulated(req: SimulateRequest, authorization: str = Header(default=None)):
    require_auth(authorization)

    count = max(1, min(req.count, 50))
    items = simulation_service.generate_simulated_feedbacks(
        count=count,
        sentiment_style=req.sentiment_style,
        issue_theme=req.issue_theme,
    )
    logger.info("simulated_generated", {"count": len(items), "style": req.sentiment_style})
    return {"count": len(items), "items": items}


@app.post("/analyze-simulated")
async def analyze_simulated(payload: dict, authorization: str = Header(default=None)):
    require_auth(authorization)

    items = payload.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="No items provided")

    items = items[:20]
    semaphore = asyncio.Semaphore(config.BATCH_CONCURRENCY)
    results = []

    async def process_one(item):
        async with semaphore:
            fid = item.get("feedback_id", f"sim-{uuid.uuid4().hex[:8]}")
            try:
                loop = asyncio.get_event_loop()
                analysis = await loop.run_in_executor(None, analyze_feedback, item)
                data_service.upsert_result(fid, item, analysis)
                results.append({"feedback_id": fid, "success": True, "output": analysis["output"]})
            except Exception as e:
                results.append({"feedback_id": fid, "success": False, "error": str(e)})

    await asyncio.gather(*[process_one(item) for item in items])

    return {"processed": len(results), "results": results}


# ─── Records ─────────────────────────────────────────────────────────────────

@app.get("/records")
def get_records(
    authorization: str = Header(default=None),
    limit: int = 50,
    offset: int = 0,
    q: str = "",
    sentiment: str = "",
    severity: str = "",
    topic: str = "",
    course_id: str = "",
    teacher_id: str = "",
):
    require_auth(authorization)

    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))

    rows = data_service.get_all_results()
    filtered = []

    q_low = (q or "").lower().strip()
    topic_low = (topic or "").lower().strip()

    for r in rows:
        out = schema_service.output_compat(r.get("output", {}))
        inp = r.get("input_to_system", {}) or {}
        meta = inp.get("metadata", {}) or {}
        content = inp.get("content", {}) or {}

        topics = out.get("topics", []) or []

        if sentiment and out.get("sentiment") != sentiment:
            continue

        if severity and out.get("severity") != severity:
            continue

        if topic_low and not any(topic_low in str(x).lower() for x in topics):
            continue

        if course_id and str(meta.get("course_id", "")).lower() != course_id.lower():
            continue

        if teacher_id and str(meta.get("teacher_id", "")).lower() != teacher_id.lower():
            continue

        if q_low:
            haystack = " ".join([
                str(r.get("feedback_id", "")),
                str(content.get("raw_text", "")),
                str(meta.get("course_id", "")),
                str(meta.get("teacher_id", "")),
                str(meta.get("teacher_fullname", "")),
                str(out.get("summary_uz", "")),
                str(out.get("emotion", "")),
                str(out.get("recommended_action", "")),
                " ".join(topics),
            ]).lower()

            if q_low not in haystack:
                continue

        risk = out.get("risk", {}) or {}

        filtered.append({
            "feedback_id": r.get("feedback_id"),
            "raw_text": content.get("raw_text"),
            "course_id": meta.get("course_id"),
            "teacher_id": meta.get("teacher_id"),
            "teacher_fullname": meta.get("teacher_fullname"),
            "sentiment": out.get("sentiment"),
            "severity": out.get("severity"),
            "emotion": out.get("emotion"),
            "topics": topics,
            "summary_uz": out.get("summary_uz"),
            "confidence": out.get("confidence"),
            "requires_attention_from": out.get("requires_attention_from", []),
            "risk_types": risk.get("types", []),
            "risk_impact_scopes": risk.get("impact_scopes", []),
            "recommended_action": out.get("recommended_action"),
        })

    total = len(filtered)

    return {
        "items": filtered[offset:offset + limit],
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total,
    }
@app.get("/records/{feedback_id}")
def get_record_detail(feedback_id: str, authorization: str = Header(default=None)):
    require_auth(authorization)

    record = data_service.get_result(feedback_id)

    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    record = dict(record)
    record["output_compat"] = schema_service.output_compat(record.get("output", {}))

    return record


# ─── Logs ─────────────────────────────────────────────────────────────────────

@app.get("/logs")
def get_logs(level: str = None, limit: int = 200, authorization: str = Header(default=None)):
    require_auth(authorization)
    logs = logger.get_logs(level_filter=level, limit=limit)
    return {"count": len(logs), "logs": logs, "items": logs}


# ─── S-Pilot Assistant ───────────────────────────────────────────────────────

@app.post("/assistant/chat")
def post_assistant_chat(req: AssistantChatRequest, authorization: str = Header(default=None)):
    require_auth(authorization)
    return assistant_chat(req)


# ─── Notifier / Telegram ─────────────────────────────────────

class TelegramNotifyRequest(BaseModel):
    bot_token: Optional[str] = None
    chat_id: str
    message: str
    parse_mode: str = "HTML"


class TelegramNotifyResponse(BaseModel):
    ok: bool
    detail: str
    telegram_response: Dict[str, Any] = Field(default_factory=dict)


def get_telegram_bot_token(payload_token: Optional[str] = None) -> str:
    token = (
        payload_token
        or os.getenv("TELEGRAM_BOT_TOKEN")
        or getattr(config, "TELEGRAM_BOT_TOKEN", "")
    )

    if not token:
        raise HTTPException(
            status_code=400,
            detail="Telegram bot token missing. Provide bot_token or set TELEGRAM_BOT_TOKEN env variable."
        )

    return token


def send_telegram_message(bot_token: str, chat_id: str, message: str, parse_mode: str = "HTML") -> Dict[str, Any]:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

    payload = {
        "chat_id": str(chat_id),
        "text": message,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }

    last_error = None

    for attempt in range(1, 5):
        try:
            res = requests.post(
                url,
                json=payload,
                timeout=(20, 90),
                headers={"Connection": "close"}
            )

            data = res.json()

            if not res.ok or not data.get("ok"):
                raise HTTPException(
                    status_code=400,
                    detail=data.get("description") or f"Telegram API error HTTP {res.status_code}"
                )

            return data

        except HTTPException:
            raise
        except Exception as e:
            last_error = e
            logger.warn("telegram_send_retry", {
                "attempt": attempt,
                "error": str(e)
            })
            time.sleep(2 * attempt)

    raise HTTPException(
        status_code=504,
        detail=f"Telegram timeout/network failure after retries: {str(last_error)}"
    )

@app.post("/notifier/telegram/send", response_model=TelegramNotifyResponse)
def post_telegram_notify(payload: TelegramNotifyRequest, authorization: str = Header(default=None)):
    require_auth(authorization)

    token = get_telegram_bot_token(payload.bot_token)
    tg = send_telegram_message(
        bot_token=token,
        chat_id=payload.chat_id,
        message=payload.message,
        parse_mode=payload.parse_mode
    )

    logger.info("telegram_notification_sent", {
        "chat_id": payload.chat_id,
        "message_length": len(payload.message),
    })

    return TelegramNotifyResponse(
        ok=bool(tg.get("ok")),
        detail="Telegram notification sent",
        telegram_response=tg
    )


@app.post("/notifier/telegram/test", response_model=TelegramNotifyResponse)
def post_telegram_test(payload: TelegramNotifyRequest, authorization: str = Header(default=None)):
    require_auth(authorization)

    token = get_telegram_bot_token(payload.bot_token)

    msg = """
<b>✅ SentoPro Notifier Test</b>

Telegram channel is connected successfully.

This channel can now receive:
• critical feedback alerts
• emerging negative trend warnings
• admin attention cases
• system errors
• integration failures
• batch completion reports
"""

    tg = send_telegram_message(
        bot_token=token,
        chat_id=payload.chat_id,
        message=msg,
        parse_mode="HTML"
    )

    logger.info("telegram_test_notification_sent", {"chat_id": payload.chat_id})

    return TelegramNotifyResponse(
        ok=bool(tg.get("ok")),
        detail="Telegram test notification sent",
        telegram_response=tg
    )


# ─── Reset ────────────────────────────────────────────────────────────────────

@app.post("/reset-demo")
def reset_demo(authorization: str = Header(default=None)):
    require_auth(authorization)
    data_service.reset_results()
    return {"success": True, "message": "Demo state reset. processed_results cleared."}