import json
import time
import hashlib
import secrets
from datetime import datetime, timezone
from . import config
from . import logger_service as logger


TOKENS_FILE = config.DATA_DIR / "integration_tokens.json"
REQUESTS_FILE = config.DATA_DIR / "integration_requests.json"

_rate_memory = {}


PRESETS = {
    "lms": {
        "label": "Generic LMS",
        "description": "Standard LMS feedback payload with course, teacher, rating and text fields.",
        "sample_payload": {
            "feedback": "Dars yaxshi, lekin baholash mezonlari aniqroq bo‘lsa yaxshi bo‘lardi.",
            "rating": 4,
            "course_id": "CS-101",
            "course_name": "Algorithms",
            "teacher_id": "T-01",
            "teacher_name": "Aziz Karimov",
            "department": "Computer Science"
        }
    },
    "hemis": {
        "label": "HEMIS",
        "description": "HEMIS-like academic feedback structure mapped into inputToSystem.",
        "sample_payload": {
            "comment": "O‘qituvchi yaxshi tushuntirdi, ammo amaliy topshiriqlar ko‘proq kerak.",
            "score": 4,
            "subject_code": "HEMIS-CS-204",
            "subject_name": "Dasturlash texnologiyalari",
            "employee_id": "EMP-204",
            "employee_name": "Dilshod Rahimov",
            "faculty": "Computer Engineering",
            "group": "210-22"
        }
    },
    "moodle": {
        "label": "Moodle",
        "description": "Moodle feedback module export style.",
        "sample_payload": {
            "text": "Course materials are useful, but deadlines are too close.",
            "rating": 3,
            "course": "MOODLE-AI-301",
            "course_title": "Artificial Intelligence",
            "teacher_id": "MDL-T-18",
            "teacher_fullname": "Madina Oripova",
            "department_name": "AI Department"
        }
    },
    "sis": {
        "label": "Student Information System",
        "description": "Student portal / SIS feedback object.",
        "sample_payload": {
            "message": "Platform sometimes loads slowly during submissions.",
            "rating": 2,
            "course_id": "SIS-NET-112",
            "course_name": "Computer Networks",
            "teacher_id": "SIS-T-09",
            "teacher_name": "Akmal Yusupov",
            "department": "Telecommunications"
        }
    },
    "custom": {
        "label": "Custom REST Client",
        "description": "Flexible flat JSON object accepted through secure REST.",
        "sample_payload": {
            "raw_text": "The lesson was useful but assessment criteria should be clearer.",
            "rating": 4,
            "course_id": "CUSTOM-101",
            "course_name": "Custom Course",
            "teacher_id": "CUSTOM-T-01",
            "teacher_name": "External Teacher",
            "department": "External Department"
        }
    }
}


FIELD_MAPS = {
    "hemis": {
        "comment": "content.raw_text",
        "score": "content.rating",
        "subject_code": "metadata.course_id",
        "subject_name": "metadata.course_context.course_name",
        "employee_id": "metadata.teacher_id",
        "employee_name": "metadata.teacher_fullname",
        "faculty": "metadata.student_context.department_name",
        "group": "metadata.student_context.group_id"
    },
    "moodle": {
        "text": "content.raw_text",
        "rating": "content.rating",
        "course": "metadata.course_id",
        "course_title": "metadata.course_context.course_name",
        "teacher_id": "metadata.teacher_id",
        "teacher_fullname": "metadata.teacher_fullname",
        "department_name": "metadata.student_context.department_name"
    },
    "lms": {
        "feedback": "content.raw_text",
        "rating": "content.rating",
        "course_id": "metadata.course_id",
        "course_name": "metadata.course_context.course_name",
        "teacher_id": "metadata.teacher_id",
        "teacher_name": "metadata.teacher_fullname",
        "department": "metadata.student_context.department_name"
    },
    "sis": {
        "message": "content.raw_text",
        "rating": "content.rating",
        "course_id": "metadata.course_id",
        "course_name": "metadata.course_context.course_name",
        "teacher_id": "metadata.teacher_id",
        "teacher_name": "metadata.teacher_fullname",
        "department": "metadata.student_context.department_name"
    },
    "custom": {
        "raw_text": "content.raw_text",
        "rating": "content.rating",
        "course_id": "metadata.course_id",
        "course_name": "metadata.course_context.course_name",
        "teacher_id": "metadata.teacher_id",
        "teacher_name": "metadata.teacher_fullname",
        "department": "metadata.student_context.department_name"
    }
}


def _now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _load_json(path, default):
    if not path.exists():
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, type(default)) else default
    except Exception:
        return default


def _save_json(path, data):
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _load_tokens():
    return _load_json(TOKENS_FILE, [])


def _save_tokens(tokens):
    _save_json(TOKENS_FILE, tokens)


def _load_requests():
    return _load_json(REQUESTS_FILE, [])


def _save_requests(items):
    _save_json(REQUESTS_FILE, items[-300:])


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def mask_token_hash(token_hash: str):
    if not token_hash:
        return "unknown"
    return token_hash[:8] + "..." + token_hash[-6:]


def create_integration_token(system_name: str, system_type: str = "lms"):
    raw_token = "lmsint_" + secrets.token_urlsafe(32)
    system_type = system_type if system_type in PRESETS else "custom"

    record = {
        "id": secrets.token_hex(8),
        "system_name": system_name,
        "system_type": system_type,
        "token_hash": hash_token(raw_token),
        "active": True,
        "created_at": _now(),
        "last_used_at": None,
        "request_count": 0,
        "accepted_count": 0,
        "rejected_count": 0,
        "last_status": "created",
        "rate_limit_per_minute": 30,
    }

    tokens = _load_tokens()
    tokens.append(record)
    _save_tokens(tokens)

    logger.info("integration_token_created", {
        "system_name": system_name,
        "system_type": system_type,
    })

    return {
        "token": raw_token,
        "record": public_token_record(record),
    }


def public_token_record(item):
    out = {k: v for k, v in item.items() if k != "token_hash"}
    out["token_fingerprint"] = mask_token_hash(item.get("token_hash", ""))
    out["rate_window"] = get_rate_status(item.get("id"), int(item.get("rate_limit_per_minute", 30)))
    out["health"] = build_system_health(out)
    return out


def verify_integration_token(raw_token: str):
    if not raw_token:
        return None

    token_hash = hash_token(raw_token)
    tokens = _load_tokens()

    for item in tokens:
        if item.get("token_hash") == token_hash and item.get("active"):
            return item

    return None


def touch_token(token_record, accepted=0, rejected=0, status="ok"):
    tokens = _load_tokens()
    for item in tokens:
        if item.get("id") == token_record.get("id"):
            item["last_used_at"] = _now()
            item["request_count"] = int(item.get("request_count", 0)) + 1
            item["accepted_count"] = int(item.get("accepted_count", 0)) + int(accepted)
            item["rejected_count"] = int(item.get("rejected_count", 0)) + int(rejected)
            item["last_status"] = status
            break
    _save_tokens(tokens)


def revoke_token(token_id: str):
    tokens = _load_tokens()
    found = None

    for item in tokens:
        if item.get("id") == token_id:
            item["active"] = False
            item["revoked_at"] = _now()
            item["last_status"] = "revoked"
            found = item
            break

    if found:
        _save_tokens(tokens)
        logger.warn("integration_token_revoked", {
            "token_id": token_id,
            "system_name": found.get("system_name"),
        })
        return public_token_record(found)

    return None


def get_rate_status(token_id, limit):
    now = time.time()
    window = _rate_memory.get(token_id, [])
    window = [x for x in window if now - x < 60]
    _rate_memory[token_id] = window

    return {
        "limit": limit,
        "used": len(window),
        "remaining": max(0, limit - len(window)),
        "window_seconds": 60,
    }


def check_rate_limit(token_record):
    token_id = token_record["id"]
    limit = int(token_record.get("rate_limit_per_minute", 30))
    now = time.time()

    window = _rate_memory.setdefault(token_id, [])
    window = [x for x in window if now - x < 60]
    _rate_memory[token_id] = window

    if len(window) >= limit:
        return False, get_rate_status(token_id, limit)

    window.append(now)
    return True, get_rate_status(token_id, limit)


def build_system_health(item):
    active = item.get("active", False)
    rejected = int(item.get("rejected_count", 0) or 0)
    accepted = int(item.get("accepted_count", 0) or 0)
    total = accepted + rejected

    if not active:
        return {"status": "revoked", "score": 0, "label": "Revoked"}

    if total == 0:
        return {"status": "idle", "score": 72, "label": "Ready"}

    rejection_rate = rejected / max(1, total)

    if rejection_rate >= 0.35:
        return {"status": "degraded", "score": 45, "label": "Schema issues"}

    return {"status": "healthy", "score": 96, "label": "Healthy"}


def list_integrations():
    tokens = _load_tokens()
    return [public_token_record(item) for item in tokens]


def list_presets():
    return PRESETS


def get_field_map(system_type: str):
    return FIELD_MAPS.get(system_type, FIELD_MAPS["custom"])


def log_ingest_request(token_record, status, accepted=0, rejected=0, errors=None, warnings=None, preview=None):
    rows = _load_requests()

    row = {
        "id": secrets.token_hex(8),
        "timestamp": _now(),
        "system_id": token_record.get("id") if token_record else None,
        "system_name": token_record.get("system_name") if token_record else "Unknown",
        "system_type": token_record.get("system_type") if token_record else "unknown",
        "status": status,
        "accepted": int(accepted or 0),
        "rejected": int(rejected or 0),
        "errors": errors or [],
        "warnings": warnings or [],
        "payload_preview": preview or {},
    }

    rows.append(row)
    _save_requests(rows)

    return row


def list_request_logs(limit=80, system_id=None):
    rows = _load_requests()

    if system_id:
        rows = [x for x in rows if x.get("system_id") == system_id]

    rows = sorted(rows, key=lambda x: x.get("timestamp", ""), reverse=True)
    return rows[:limit]


def build_ingest_report(items, valid_items, errors, warnings, token_record):
    return {
        "accepted": len(valid_items),
        "rejected": len(errors),
        "warnings": warnings[:20],
        "errors": errors[:20],
        "source_system": token_record.get("system_name"),
        "system_type": token_record.get("system_type"),
        "timestamp": _now(),
        "mode": "secure_rest_ingestion",
        "rate": get_rate_status(
            token_record.get("id"),
            int(token_record.get("rate_limit_per_minute", 30))
        )
    }