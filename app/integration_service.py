import json
import time
import hashlib
import secrets
from pathlib import Path
from datetime import datetime, timezone

from . import config
from . import logger_service as logger


TOKENS_FILE = config.DATA_DIR / "integration_tokens.json"

_rate_memory = {}


def _now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _load_tokens():
    if not TOKENS_FILE.exists():
        return []
    try:
        with open(TOKENS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_tokens(tokens):
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(TOKENS_FILE, "w", encoding="utf-8") as f:
        json.dump(tokens, f, ensure_ascii=False, indent=2)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_integration_token(system_name: str, system_type: str = "lms"):
    raw_token = "lmsint_" + secrets.token_urlsafe(32)

    record = {
        "id": secrets.token_hex(8),
        "system_name": system_name,
        "system_type": system_type,
        "token_hash": hash_token(raw_token),
        "active": True,
        "created_at": _now(),
        "last_used_at": None,
        "request_count": 0,
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
        "record": {k: v for k, v in record.items() if k != "token_hash"},
    }


def verify_integration_token(raw_token: str):
    if not raw_token:
        return None

    token_hash = hash_token(raw_token)
    tokens = _load_tokens()

    for item in tokens:
        if item.get("token_hash") == token_hash and item.get("active"):
            return item

    return None


def touch_token(token_record):
    tokens = _load_tokens()
    for item in tokens:
        if item.get("id") == token_record.get("id"):
            item["last_used_at"] = _now()
            item["request_count"] = int(item.get("request_count", 0)) + 1
            break
    _save_tokens(tokens)


def check_rate_limit(token_record):
    token_id = token_record["id"]
    limit = int(token_record.get("rate_limit_per_minute", 30))
    now = time.time()

    window = _rate_memory.setdefault(token_id, [])
    window = [x for x in window if now - x < 60]
    _rate_memory[token_id] = window

    if len(window) >= limit:
        return False, {
            "limit": limit,
            "window_seconds": 60,
            "current": len(window),
        }

    window.append(now)
    return True, {
        "limit": limit,
        "window_seconds": 60,
        "current": len(window),
    }


def list_integrations():
    tokens = _load_tokens()
    return [{k: v for k, v in item.items() if k != "token_hash"} for item in tokens]


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
    }