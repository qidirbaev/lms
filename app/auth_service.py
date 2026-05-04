import hashlib
import secrets
import time
from . import config

# In-memory session store: token -> {username, created_at}
_sessions: dict = {}
SESSION_TTL = 3600 * 8  # 8 hours


def _hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def login(username: str, password: str) -> dict:
    if username == config.ADMIN_USERNAME and password == config.ADMIN_PASSWORD:
        token = secrets.token_hex(32)
        _sessions[token] = {"username": username, "created_at": time.time()}
        return {"success": True, "token": token, "username": username}
    return {"success": False, "token": None, "username": None}


def verify_token(token: str) -> bool:
    if not token or token not in _sessions:
        return False
    session = _sessions[token]
    if time.time() - session["created_at"] > SESSION_TTL:
        del _sessions[token]
        return False
    return True


def logout(token: str):
    _sessions.pop(token, None)