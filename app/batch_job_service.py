import json
import time
import uuid
import threading
from datetime import datetime, timezone
from typing import Dict, Any, List

from . import config
from . import logger_service as logger
from . import data_service
from . import dashboard_service
from .ai_service import analyze_feedback, analyze_feedback_batch


JOBS_FILE = config.DATA_DIR / "batch_jobs.json"
_LOCK = threading.RLock()
_JOBS: Dict[str, Dict[str, Any]] = {}


def _now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def init():
    global _JOBS
    if JOBS_FILE.exists():
        try:
            with open(JOBS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            _JOBS = data if isinstance(data, dict) else {}
        except Exception:
            _JOBS = {}
    logger.info("batch_job_service_init", {"jobs": len(_JOBS)})


def _save():
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(JOBS_FILE, "w", encoding="utf-8") as f:
        json.dump(_JOBS, f, ensure_ascii=False, indent=2)


def _public(job: Dict[str, Any]):
    total = int(job.get("total", 0) or 0)
    processed = int(job.get("processed", 0) or 0)

    out = dict(job)
    out["progress_percent"] = round((processed / total) * 100, 2) if total else 0
    return out


def list_jobs(limit: int = 20):
    with _LOCK:
        rows = sorted(_JOBS.values(), key=lambda x: x.get("created_at", ""), reverse=True)
        return [_public(x) for x in rows[:limit]]


def get_job(job_id: str):
    with _LOCK:
        job = _JOBS.get(job_id)
        return _public(job) if job else None


def cancel_job(job_id: str):
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return None

        if job.get("status") in ["completed", "failed", "cancelled"]:
            return _public(job)

        job["cancel_requested"] = True
        job["status"] = "cancelling"
        job["updated_at"] = _now()
        _save()

        return _public(job)


def create_job(source: str, limit: int, batch_size: int, use_batch_ai: bool):
    data = data_service.load_source_file(source)
    items = data[:max(1, int(limit))]

    job_id = "job-" + uuid.uuid4().hex[:12]
    now = _now()

    job = {
        "job_id": job_id,
        "source": source,
        "status": "queued",
        "total": len(items),
        "processed": 0,
        "success": 0,
        "failed": 0,
        "fallback_used": 0,
        "batch_size": max(1, min(int(batch_size or 8), int(getattr(config, "AI_BATCH_MAX_SIZE", 10)))),
        "use_batch_ai": bool(use_batch_ai),
        "chunks_total": 0,
        "chunks_done": 0,
        "vertex_calls_estimated": 0,
        "old_vertex_calls_estimated": len(items),
        "cancel_requested": False,
        "created_at": now,
        "updated_at": now,
        "started_at": None,
        "finished_at": None,
        "duration_seconds": 0,
        "throughput_items_per_second": 0,
        "failed_items": [],
        "last_message": "Job created",
    }

    with _LOCK:
        _JOBS[job_id] = job
        _save()

    thread = threading.Thread(target=_run_job, args=(job_id, items), daemon=True)
    thread.start()

    return _public(job)


def _update(job_id: str, **patch):
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return None
        job.update(patch)
        job["updated_at"] = _now()
        _save()
        return job


def _run_job(job_id: str, items: List[Dict[str, Any]]):
    start = time.time()

    job = get_job(job_id)
    if not job:
        return

    batch_size = int(job.get("batch_size", 8))
    chunks = [(i, items[i:i + batch_size]) for i in range(0, len(items), batch_size)]

    _update(
        job_id,
        status="processing",
        started_at=_now(),
        chunks_total=len(chunks),
        last_message="Processing started",
    )

    logger.info("batch_job_started", {
        "job_id": job_id,
        "source": job.get("source"),
        "total": len(items),
        "batch_size": batch_size,
    })

    for start_idx, chunk in chunks:
        current = get_job(job_id)

        if current and current.get("cancel_requested"):
            _update(
                job_id,
                status="cancelled",
                finished_at=_now(),
                duration_seconds=round(time.time() - start, 2),
                last_message="Job cancelled by user",
            )
            logger.warn("batch_job_cancelled", {"job_id": job_id})
            return

        try:
            analyses = []

            if job.get("use_batch_ai") and len(chunk) > 1:
                _update(job_id, vertex_calls_estimated=current.get("vertex_calls_estimated", 0) + 1)
                analyses = analyze_feedback_batch(chunk)

                if len(analyses) != len(chunk):
                    raise RuntimeError(f"Batch output mismatch: {len(analyses)} != {len(chunk)}")
            else:
                for item in chunk:
                    analyses.append(analyze_feedback(item))

            for offset, analysis in enumerate(analyses):
                item = chunk[offset]
                feedback_id = item.get("feedback_id") or f"fb-{uuid.uuid4().hex[:12]}"

                data_service.upsert_result(feedback_id, item, analysis)

                current = get_job(job_id)
                _update(
                    job_id,
                    processed=current.get("processed", 0) + 1,
                    success=current.get("success", 0) + 1,
                    fallback_used=current.get("fallback_used", 0) + (1 if analysis.get("used_fallback") else 0),
                    last_message=f"Processed {feedback_id}",
                )

        except Exception as chunk_error:
            logger.warn("batch_job_chunk_failed_split", {
                "job_id": job_id,
                "start_idx": start_idx,
                "chunk_size": len(chunk),
                "error": str(chunk_error),
            })

            for offset, item in enumerate(chunk):
                current = get_job(job_id)

                if current and current.get("cancel_requested"):
                    _update(
                        job_id,
                        status="cancelled",
                        finished_at=_now(),
                        duration_seconds=round(time.time() - start, 2),
                        last_message="Job cancelled by user",
                    )
                    return

                feedback_id = item.get("feedback_id") or f"fb-{uuid.uuid4().hex[:12]}"

                try:
                    analysis = analyze_feedback(item)
                    data_service.upsert_result(feedback_id, item, analysis)

                    current = get_job(job_id)
                    _update(
                        job_id,
                        processed=current.get("processed", 0) + 1,
                        success=current.get("success", 0) + 1,
                        fallback_used=current.get("fallback_used", 0) + (1 if analysis.get("used_fallback") else 0),
                        last_message=f"Processed after split: {feedback_id}",
                    )
                except Exception as item_error:
                    current = get_job(job_id)
                    failed_items = list(current.get("failed_items", []))
                    failed_items.append({
                        "index": start_idx + offset,
                        "feedback_id": feedback_id,
                        "error": str(item_error),
                    })

                    _update(
                        job_id,
                        processed=current.get("processed", 0) + 1,
                        failed=current.get("failed", 0) + 1,
                        failed_items=failed_items[-50:],
                        last_message=f"Failed {feedback_id}",
                    )

        current = get_job(job_id)
        _update(
            job_id,
            chunks_done=current.get("chunks_done", 0) + 1,
            duration_seconds=round(time.time() - start, 2),
        )

    final = get_job(job_id)
    duration = round(time.time() - start, 2)
    processed = int(final.get("processed", 0) or 0)

    _update(
        job_id,
        status="completed" if final.get("failed", 0) == 0 else "partial_failed",
        finished_at=_now(),
        duration_seconds=duration,
        throughput_items_per_second=round(processed / duration, 2) if duration else processed,
        vertex_call_reduction=max(0, int(final.get("old_vertex_calls_estimated", 0)) - int(final.get("vertex_calls_estimated", 0))),
        last_message="Job finished",
    )

    logger.info("batch_job_finished", get_job(job_id))


def job_dashboard():
    return dashboard_service.get_full_dashboard()