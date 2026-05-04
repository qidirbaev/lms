import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from . import config

_lock = threading.Lock()
_logs: list = []


def _load_logs():
    global _logs
    if config.LOGS_FILE.exists():
        try:
            with open(config.LOGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                _logs = data if isinstance(data, list) else []
        except Exception:
            _logs = []
    else:
        _logs = []


def _save_logs():
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        with open(config.LOGS_FILE, "w", encoding="utf-8") as f:
            json.dump(_logs[-2000:], f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def log(level: str, event: str, details: dict = None):
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level.upper(),
        "event": event,
        "details": details or {},
    }
    with _lock:
        _logs.append(entry)
        _save_logs()
    return entry


def info(event: str, details: dict = None):
    return log("INFO", event, details)


def warn(event: str, details: dict = None):
    return log("WARN", event, details)


def error(event: str, details: dict = None):
    return log("ERROR", event, details)


def get_logs(level_filter: str = None, limit: int = 500) -> list:
    with _lock:
        result = _logs[-limit:]
    if level_filter:
        result = [l for l in result if l.get("level") == level_filter.upper()]
    return list(reversed(result))


def init():
    _load_logs()
    info("app_startup", {"ai_provider": config.AI_PROVIDER, "concurrency": config.BATCH_CONCURRENCY})