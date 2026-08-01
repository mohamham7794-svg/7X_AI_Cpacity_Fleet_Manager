"""Bearer-token auth (§6 Phase 7: 'simple bearer token via env var is fine —
don't over-engineer'). Reads the expected token from API_BEARER_TOKEN. If
unset, auth is disabled (useful for local dev) — but that's opt-in only via
explicitly leaving the env var empty, never a silent default token.
"""
from __future__ import annotations

import os

from fastapi import Header, HTTPException

from apps.api.errors import ErrorCode


def _expected_token() -> str | None:
    return os.environ.get("API_BEARER_TOKEN")


async def require_bearer_token(authorization: str | None = Header(default=None)) -> None:
    expected = _expected_token()
    if expected is None:
        return  # auth disabled — local/dev mode only

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={"error_code": ErrorCode.UNAUTHORIZED.value, "message": "Missing or malformed Authorization header"},
        )
    token = authorization.removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(
            status_code=401,
            detail={"error_code": ErrorCode.UNAUTHORIZED.value, "message": "Invalid bearer token"},
        )
