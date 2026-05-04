import asyncio
import uuid
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from . import logger_service as logger
from . import data_service
from . import auth_service
from . import dashboard_service
from . import simulation_service
from .ai_service import analyze_feedback
from .models import (
    LoginRequest, AnalyzeFileItemRequest, ProcessBatchRequest,
    AnalyzeCustomRequest, SimulateRequest, RecordsFilterRequest,
)

# ─── Init ────────────────────────────────────────────────────────────────────
logger.init()
data_service.init()
logger.info("config_loaded", {
    "ai_provider": config.AI_PROVIDER,
    "concurrency": config.BATCH_CONCURRENCY,
    "fallback": config.FALLBACK_TO_MOCK,
})

app = FastAPI(title="LMS Feedback AI Analyzer", version="2.0.0")

STATIC_DIR = config.STATIC_DIR
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
    return FileResponse(STATIC_DIR / "index.html")


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


# ─── Feedbacks ───────────────────────────────────────────────────────────────

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
        data = data_service.load_source_file(req.source)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    items = data[:req.limit]
    total = len(items)
    logger.info("batch_started", {"source": req.source, "total": total})

    start_time = time.time()
    success_count = 0
    failed_count = 0
    fallback_count = 0
    semaphore = asyncio.Semaphore(config.BATCH_CONCURRENCY)

    async def process_one(item: dict, idx: int):
        nonlocal success_count, failed_count, fallback_count
        async with semaphore:
            feedback_id = item.get("feedback_id", f"fb-{idx:05d}")
            try:
                loop = asyncio.get_event_loop()
                analysis = await loop.run_in_executor(None, analyze_feedback, item)
                data_service.upsert_result(feedback_id, item, analysis)
                if analysis.get("used_fallback"):
                    fallback_count += 1
                success_count += 1
            except Exception as e:
                failed_count += 1
                logger.error("batch_item_failed", {"feedback_id": feedback_id, "error": str(e)})

    tasks = [process_one(item, i) for i, item in enumerate(items)]
    await asyncio.gather(*tasks)

    duration = round(time.time() - start_time, 2)
    logger.info("batch_completed", {
        "source": req.source, "total": total,
        "success": success_count, "failed": failed_count,
        "fallback": fallback_count, "duration_s": duration,
    })

    return {
        "source": req.source,
        "total_requested": total,
        "success": success_count,
        "failed": failed_count,
        "fallback_used": fallback_count,
        "duration_seconds": duration,
        "dashboard": dashboard_service.get_full_dashboard(),
    }


@app.post("/analyze-custom")
def analyze_custom(req: AnalyzeCustomRequest, authorization: str = Header(default=None)):
    require_auth(authorization)

    if not req.raw_text.strip():
        raise HTTPException(status_code=400, detail="raw_text is required")

    feedback_id = req.feedback_id or f"custom-{uuid.uuid4().hex[:8]}"
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    input_to_system = {
        "schema_version": "1.0.0",
        "feedback_id": feedback_id,
        "content": {"raw_text": req.raw_text, "rating": req.rating},
        "metadata": {
            "course_id": req.course_id,
            "teacher_id": req.teacher_id,
            "teacher_fullname": req.teacher_fullname,
            "student_context": {
                "year": req.year,
                "gender": "other",
                "group_id": req.group_id,
                "department": req.department,
                "course_points": 80,
                "gpa": req.gpa,
                "attendance_rate": req.attendance_rate,
            },
            "timestamp": ts,
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
            "teaching_experience_years": 5,
            "teacher_department_id": "DEP-CS",
        },
    }

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
    sentiment: str = None,
    severity: str = None,
    issue_category: str = None,
    course_id: str = None,
    teacher_id: str = None,
    requires_admin_attention: bool = None,
    limit: int = 100,
    offset: int = 0,
    authorization: str = Header(default=None),
):
    require_auth(authorization)

    records = data_service.get_all_results()

    if sentiment:
        records = [r for r in records if r.get("output", {}).get("sentiment") == sentiment]
    if severity:
        records = [r for r in records if r.get("output", {}).get("severity") == severity]
    if issue_category:
        records = [r for r in records if r.get("output", {}).get("issue_category") == issue_category]
    if course_id:
        records = [r for r in records if r.get("course_id") == course_id]
    if teacher_id:
        records = [r for r in records if r.get("teacher_id") == teacher_id]
    if requires_admin_attention is not None:
        records = [r for r in records if r.get("output", {}).get("requires_admin_attention") == requires_admin_attention]

    total = len(records)
    paginated = records[offset: offset + limit]

    # Return lightweight list items
    items = []
    for r in paginated:
        out = r.get("output", {})
        items.append({
            "feedback_id": r["feedback_id"],
            "raw_text": r.get("raw_text", "")[:300],
            "rating": r.get("rating"),
            "course_id": r.get("course_id"),
            "course_name": r.get("course_name"),
            "teacher_id": r.get("teacher_id"),
            "teacher_fullname": r.get("teacher_fullname"),
            "sentiment": out.get("sentiment"),
            "severity": out.get("severity"),
            "issue_category": out.get("issue_category"),
            "summary_uz": out.get("summary_uz", ""),
            "recommended_action": out.get("recommended_action"),
            "requires_admin_attention": out.get("requires_admin_attention", False),
            "risk_types": out.get("risk", {}).get("types", []),
            "emotion": out.get("emotion"),
            "representative_label": out.get("representative_label"),
            "processed_at": r.get("processed_at"),
        })

    return {"total": total, "offset": offset, "limit": limit, "items": items}


@app.get("/records/{feedback_id}")
def get_record_detail(feedback_id: str, authorization: str = Header(default=None)):
    require_auth(authorization)
    record = data_service.get_result(feedback_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


# ─── Logs ─────────────────────────────────────────────────────────────────────

@app.get("/logs")
def get_logs(level: str = None, limit: int = 200, authorization: str = Header(default=None)):
    require_auth(authorization)
    logs = logger.get_logs(level_filter=level, limit=limit)
    return {"count": len(logs), "logs": logs, "items": logs}


# ─── Reset ────────────────────────────────────────────────────────────────────

@app.post("/reset-demo")
def reset_demo(authorization: str = Header(default=None)):
    require_auth(authorization)
    data_service.reset_results()
    return {"success": True, "message": "Demo state reset. processed_results cleared."}