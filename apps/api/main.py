"""FastAPI app — the only public interface (§3, §6 Phase 7).

Endpoints:
    POST /v1/forecast
    POST /v1/driver-requirements
    POST /v1/simulate
    POST /v1/optimize
    POST /v1/explain
    POST /v1/scenarios
    GET  /v1/stores/{id}/summary
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os
from typing import Any

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from apps.api.auth import require_bearer_token
from apps.api.db import get_records, init_db, list_store_ids
from apps.api.errors import (
    optimization_infeasible_handler,
    simulation_input_handler,
    unhandled_exception_handler,
    value_error_handler,
)
from packages.ai.explain import ExplanationInputs, generate_explanation
from packages.ai.reasons import build_explanation_inputs
from packages.ai.scenario import run_scenario
from packages.analytics.schemas import (
    ConstraintConfig,
    CostConfig,
    DriverRequirement,
    ExplanationPayload,
    ForecastResult,
    HiringPlan,
    ScenarioRequest,
    SimulationResult,
    StaffingPlan,
    StoreConfig,
)
from packages.forecasting.api import forecast as run_forecast
from packages.forecasting.api import train
from packages.optimization.hiring import OptimizationInfeasibleError, optimize as run_optimize
from packages.simulation.engine import SimulationInputError, simulate as run_simulate
from packages.workforce.capacity import convert as convert_capacity

@asynccontextmanager
async def _lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="AI Workforce Planning Engine", version="1.0.0", lifespan=_lifespan)

# CORS: open by default (CORS_ALLOW_ORIGINS env var, comma-separated) so a
# locally-run frontend on a different port can call this API. Tighten
# allow_origins before deploying publicly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ALLOW_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(OptimizationInfeasibleError, optimization_infeasible_handler)
app.add_exception_handler(SimulationInputError, simulation_input_handler)
app.add_exception_handler(ValueError, value_error_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)


# Trained model per store is cheap to keep in memory for a hackathon-scale
# service; swap for a real model registry/cache (e.g. MLflow model URI +
# Redis) before production use.
_MODEL_CACHE: dict[str, Any] = {}


def _get_or_train(store_id: str):
    if store_id not in _MODEL_CACHE:
        records = get_records(store_id)
        if not records:
            raise ValueError(f"no data found for store_id={store_id!r}")
        model, features_df = train(records)
        _MODEL_CACHE[store_id] = (model, features_df)
    return _MODEL_CACHE[store_id]


# ---------------------------------------------------------------------------
# Request models (thin wrappers around the shared schemas)
# ---------------------------------------------------------------------------

class ForecastRequest(BaseModel):
    store_id: str
    horizon_hours: int = 24


class DriverRequirementsRequest(BaseModel):
    forecasts: list[ForecastResult]
    store_config: StoreConfig
    weather_factor: float | None = None


class SimulateRequest(BaseModel):
    driver_requirements: list[DriverRequirement]
    staffing_plan: list[StaffingPlan]


class OptimizeRequest(BaseModel):
    driver_requirements: list[DriverRequirement]
    cost_config: CostConfig = CostConfig()
    constraint_config: ConstraintConfig = ConstraintConfig()


class ExplainRequest(BaseModel):
    hiring_plan: HiringPlan
    naive_baseline_cost: float
    demand_change_pct: float
    store_productivity_vs_network: float
    utilization_pct: float
    constraint_config: ConstraintConfig = ConstraintConfig()


class ScenarioRunRequest(BaseModel):
    forecasts_by_store: dict[str, list[ForecastResult]]
    store_configs: dict[str, StoreConfig]
    scenario: ScenarioRequest
    cost_config: CostConfig = CostConfig()
    constraint_config: ConstraintConfig = ConstraintConfig()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/v1/forecast", response_model=list[ForecastResult], dependencies=[Depends(require_bearer_token)])
def post_forecast(req: ForecastRequest) -> list[ForecastResult]:
    model, features_df = _get_or_train(req.store_id)
    return run_forecast(model, features_df, req.store_id, req.horizon_hours)


@app.post("/v1/driver-requirements", response_model=list[DriverRequirement], dependencies=[Depends(require_bearer_token)])
def post_driver_requirements(req: DriverRequirementsRequest) -> list[DriverRequirement]:
    return [convert_capacity(f, req.store_config, req.weather_factor) for f in req.forecasts]


@app.post("/v1/simulate", response_model=SimulationResult, dependencies=[Depends(require_bearer_token)])
def post_simulate(req: SimulateRequest) -> SimulationResult:
    return run_simulate(req.driver_requirements, req.staffing_plan)


@app.post("/v1/optimize", response_model=HiringPlan, dependencies=[Depends(require_bearer_token)])
def post_optimize(req: OptimizeRequest) -> HiringPlan:
    return run_optimize(req.driver_requirements, req.cost_config, req.constraint_config)


@app.post("/v1/explain", response_model=ExplanationPayload, dependencies=[Depends(require_bearer_token)])
def post_explain(req: ExplainRequest) -> ExplanationPayload:
    inputs = build_explanation_inputs(
        req.hiring_plan, req.naive_baseline_cost, req.demand_change_pct,
        req.store_productivity_vs_network, req.utilization_pct, req.constraint_config,
    )
    return generate_explanation(inputs)


@app.post("/v1/scenarios", dependencies=[Depends(require_bearer_token)])
def post_scenarios(req: ScenarioRunRequest) -> dict:
    result = run_scenario(
        req.forecasts_by_store, req.store_configs, req.scenario, req.cost_config, req.constraint_config,
    )
    return {
        "baseline_plan": result.baseline_plan,
        "scenario_plan": result.scenario_plan,
        "hiring_plan_delta": result.hiring_plan_delta,
    }


@app.get("/v1/stores/{store_id}/summary", dependencies=[Depends(require_bearer_token)])
def get_store_summary(store_id: str, horizon_hours: int = 24) -> dict:
    model, features_df = _get_or_train(store_id)
    forecasts = run_forecast(model, features_df, store_id, horizon_hours)

    store_config = StoreConfig(store_id=store_id)
    driver_requirements = [convert_capacity(f, store_config) for f in forecasts]

    hiring_plan = run_optimize(driver_requirements)

    return {
        "store_id": store_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "forecast": forecasts,
        "driver_requirements": driver_requirements,
        "hiring_plan": hiring_plan,
    }


@app.get("/v1/stores", dependencies=[Depends(require_bearer_token)])
def get_stores() -> list[str]:
    return list_store_ids()


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}