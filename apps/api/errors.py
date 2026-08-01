"""Structured error responses with error codes (§6 Phase 7)."""
from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

from packages.analytics.schemas import ErrorCode
from packages.optimization.hiring import OptimizationInfeasibleError
from packages.simulation.engine import SimulationInputError


def error_body(code: ErrorCode, message: str, detail: dict | None = None) -> dict:
    return {"error_code": code.value, "message": message, "detail": detail or {}}


async def optimization_infeasible_handler(request: Request, exc: OptimizationInfeasibleError) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content=error_body(ErrorCode.INFEASIBLE_OPTIMIZATION, str(exc)),
    )


async def simulation_input_handler(request: Request, exc: SimulationInputError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=error_body(ErrorCode.SIMULATION_INPUT_ERROR, str(exc)),
    )


async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=error_body(ErrorCode.MISSING_STORE_DATA, str(exc)),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=error_body(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred"),
    )
