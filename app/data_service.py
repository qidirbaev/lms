import json
import threading
from datetime import datetime, timezone
from . import config
from . import logger_service as logger
from . import schema_service
import uuid

_lock = threading.Lock()
_results: dict = {}  # feedback_id -> result record


def _load_results():
    global _results
    if config.RESULTS_FILE.exists():
        try:
            with open(config.RESULTS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    _results = {r["feedback_id"]: r for r in data if isinstance(r, dict) and "feedback_id" in r}
                elif isinstance(data, dict):
                    _results = data
        except Exception as e:
            logger.error("load_results_failed", {"error": str(e)})
            _results = {}
    else:
        _results = {}


def _save_results():
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        records = list(_results.values())
        with open(config.RESULTS_FILE, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error("save_results_failed", {"error": str(e)})


def _nested_context(input_to_system: dict):
    """Return metadata plus feedback/course/teacher context from either root or metadata nesting.

    Some generated inputToSystem records store feedback_context/course_context/teacher_context
    inside metadata, while custom frontend records may store them at root. Support both.
    """
    meta = input_to_system.get("metadata", {}) or {}
    return (
        meta,
        meta.get("feedback_context") or input_to_system.get("feedback_context") or {},
        meta.get("course_context") or input_to_system.get("course_context") or {},
        meta.get("teacher_context") or input_to_system.get("teacher_context") or {},
        meta.get("student_context", {}) or {},
    )


def upsert_result(feedback_id: str, input_to_system: dict, analysis: dict):
    """Store or update a processed result."""
    meta, fctx, course_ctx, teacher_ctx, sc = _nested_context(input_to_system)
    content = input_to_system.get("content", {}) or {}

    record = {
        "feedback_id": feedback_id,
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "provider": analysis.get("provider", "unknown"),
        "used_fallback": analysis.get("used_fallback", False),
        # Input snapshot
        "raw_text": content.get("raw_text", ""),
        "rating": content.get("rating"),
        "course_id": meta.get("course_id", ""),
        "teacher_id": meta.get("teacher_id", ""),
        "teacher_fullname": meta.get("teacher_fullname", ""),
        "course_name": course_ctx.get("course_name", ""),
        "course_level": course_ctx.get("course_level", ""),
        "course_delivery_mode": course_ctx.get("course_delivery_mode", ""),
        "teacher_role": teacher_ctx.get("teacher_role", ""),
        "feedback_channel": fctx.get("feedback_channel", ""),
        "is_anonymous": fctx.get("is_anonymous", False),
        "department": sc.get("department_name") or sc.get("department", ""),
        "student_year": sc.get("year"),
        "gpa": sc.get("gpa"),
        "attendance_rate": sc.get("course_attendance_rate") if sc.get("course_attendance_rate") is not None else sc.get("attendance_rate"),
        "timestamp": meta.get("timestamp", ""),
        # Full objects
        "input_to_system": input_to_system,
        "input_to_ai": analysis.get("input_to_ai", {}),
        "output": analysis.get("output", {}),
        "raw_output": analysis.get("raw_output", ""),
        "corrections": analysis.get("corrections", []),
    }

    with _lock:
        _results[feedback_id] = record
        _save_results()

    return record


def get_all_results() -> list:
    with _lock:
        return list(_results.values())


def get_result(feedback_id: str) -> dict | None:
    with _lock:
        return _results.get(feedback_id)


def count_results() -> int:
    with _lock:
        return len(_results)


def reset_results():
    global _results
    with _lock:
        _results = {}
        _save_results()
    logger.info("demo_reset", {"action": "processed_results cleared"})


def normalize_uploaded_feedback(item: dict, idx: int) -> tuple[dict, list[str]]:
    """Normalize uploaded/integration/simulation payloads into canonical inputToSystem v1.2.0."""
    return schema_service.normalize_input_to_system_v12(item, idx, source="uploaded_file")

def save_uploaded_source(items: list, filename: str = "uploaded.json") -> dict:
    """
    Validates/maps uploaded records and stores normalized file in data/uploaded_batch.json.
    """
    normalized = []
    errors = []
    warnings = []

    upload_id = uuid.uuid4().hex[:8]

    for idx, item in enumerate(items):
        try:
            mapped, item_warnings = normalize_uploaded_feedback(item, idx)

            original_id = mapped.get("feedback_id")
            mapped["feedback_id"] = f"upload-{upload_id}-{idx + 1:05d}"

            mapped.setdefault("mapping_audit", {})
            mapped["mapping_audit"]["upload_id"] = upload_id
            mapped["mapping_audit"]["original_feedback_id"] = original_id
            normalized.append(mapped)
            warnings.extend([{"index": idx, "warning": w} for w in item_warnings])
        except Exception as e:
            errors.append({"index": idx, "error": str(e)})

    upload_path = config.DATA_DIR / "uploaded_batch.json"
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)

    with open(upload_path, "w", encoding="utf-8") as f:
        json.dump(normalized, f, ensure_ascii=False, indent=2)

    logger.info("uploaded_batch_saved", {
        "filename": filename,
        "valid": len(normalized),
        "errors": len(errors),
        "warnings": len(warnings),
    })

    return {
        "source": "uploaded",
        "filename": filename,
        "saved_to": str(upload_path),
        "total_received": len(items),
        "valid_count": len(normalized),
        "error_count": len(errors),
        "warning_count": len(warnings),
        "errors": errors[:20],
        "warnings": warnings[:30],
        "items": normalized,
    }


def load_source_file(source: str) -> list:
    """Load seed, batch, or uploaded file."""
    if source == "seed":
        path = config.SEED_FILE
        label = "seed_1600.json"
    elif source == "uploaded":
        path = config.DATA_DIR / "uploaded_batch.json"
        label = "uploaded_batch.json"
    else:
        path = config.BATCH_FILE
        label = "batch_30.json"

    if not path.exists():
        raise FileNotFoundError(f"{label} not found at {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        data = [data]

    return data


def init():
    _load_results()
    logger.info("data_service_init", {"loaded_results": len(_results)})