"""FastAPI app — the only public interface (§3, §6 Phase 7).

Endpoints:
    POST /v1/forecast
    POST /v1/driver-requirements
    POST /v1/simulate
    POST /v1/optimize
    POST /v1/explain
    POST /v1/scenarios
    GET  /v1/stores/{id}/summary
    GET  /v1/stores/{id}/scorecard
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from apps.api.auth import require_bearer_token
from apps.api.db import get_records, init_db, insert_event, list_store_ids, rollup_order_placed
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
    RawEvent,
    ScenarioRequest,
    SimulationResult,
    StaffingPlan,
    StoreConfig,
)
from packages.forecasting.api import evaluate_model
from packages.forecasting.api import forecast as run_forecast
from packages.forecasting.api import train
from packages.optimization.hiring import (
    OptimizationInfeasibleError,
    naive_hire_to_peak_baseline,
    optimize as run_optimize,
)
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
import os as _os

app.add_middleware(
    CORSMiddleware,
    allow_origins=_os.environ.get("CORS_ALLOW_ORIGINS", "*").split(","),
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


@app.get("/v1/stores/{store_id}/scorecard", dependencies=[Depends(require_bearer_token)])
def get_store_scorecard(store_id: str, horizon_hours: int = 72) -> dict:
    """Rolls up the four brief-level numbers (demand-forecast accuracy,
    staffing efficiency, service reliability, cost per shipment) for one
    store. This is pure composition — every number here comes from a
    function another endpoint already calls (evaluate_model, forecast,
    convert_capacity, optimize, naive_hire_to_peak_baseline, simulate);
    nothing new is modeled here, it's just read together in one place so a
    dashboard doesn't have to re-derive it client-side."""
    model, features_df = _get_or_train(store_id)

    # --- Demand-forecast accuracy: ensemble vs. a naive lag-24 baseline,
    # evaluated in-sample against the same history the ensemble was
    # trained on. A true held-out backtest needs actuals collected over
    # time via /v1/events; this is the honest in-sample figure until then.
    accuracy_metrics = evaluate_model(model, features_df)
    by_name = {m.model_name: m for m in accuracy_metrics}
    ensemble_metrics = by_name.get("ensemble")
    naive_metrics = by_name.get("naive_lag24")

    forecasts = run_forecast(model, features_df, store_id, horizon_hours)
    store_config = StoreConfig(store_id=store_id)
    driver_requirements = [convert_capacity(f, store_config) for f in forecasts]
    hiring_plan = run_optimize(driver_requirements)
    naive_baseline_cost = naive_hire_to_peak_baseline(driver_requirements)

    total_shipments = sum(f.predicted_shipments for f in forecasts)
    peak_drivers = max(dr.drivers_needed for dr in driver_requirements)
    optimized_capacity = hiring_plan.permanent_hires + hiring_plan.temp_hires + hiring_plan.outsourced_units

    def _bad_hours(capacity: int) -> tuple[int, int]:
        under = sum(1 for dr in driver_requirements if capacity < dr.drivers_needed)
        over = sum(1 for dr in driver_requirements if capacity > dr.drivers_needed * 1.15)
        return under, over

    optimized_under, optimized_over = _bad_hours(optimized_capacity)
    naive_under, naive_over = _bad_hours(peak_drivers)  # hire-to-peak: never understaffed, always overstaffed off-peak
    optimized_bad, naive_bad = optimized_under + optimized_over, naive_under + naive_over
    bad_hours_reduction_pct = round((1 - optimized_bad / naive_bad) * 100, 1) if naive_bad > 0 else 0.0

    optimized_plan = [
        StaffingPlan(
            store_id=store_id, timestamp=dr.timestamp,
            permanent_scheduled=hiring_plan.permanent_hires,
            temp_scheduled=hiring_plan.temp_hires,
            outsourced_scheduled=hiring_plan.outsourced_units,
        )
        for dr in driver_requirements
    ]
    naive_plan = [
        StaffingPlan(store_id=store_id, timestamp=dr.timestamp, permanent_scheduled=peak_drivers)
        for dr in driver_requirements
    ]
    optimized_sim = run_simulate(driver_requirements, optimized_plan)
    naive_sim = run_simulate(driver_requirements, naive_plan)

    optimized_cost_per_shipment = hiring_plan.total_cost / total_shipments if total_shipments else 0.0
    naive_cost_per_shipment = naive_baseline_cost / total_shipments if total_shipments else 0.0

    return {
        "store_id": store_id,
        "horizon_hours": horizon_hours,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "accuracy": {
            "per_model": accuracy_metrics,
            "ensemble_mape": ensemble_metrics.mape if ensemble_metrics else None,
            "ensemble_accuracy_pct": round((1 - ensemble_metrics.mape) * 100, 2) if ensemble_metrics else None,
            "naive_lag24_mape": naive_metrics.mape if naive_metrics else None,
            "naive_lag24_accuracy_pct": round((1 - naive_metrics.mape) * 100, 2) if naive_metrics else None,
            "basis": "in_sample",
        },
        "staffing_efficiency": {
            "optimized_understaffed_hours": optimized_under,
            "optimized_overstaffed_hours": optimized_over,
            "naive_understaffed_hours": naive_under,
            "naive_overstaffed_hours": naive_over,
            "bad_hours_reduction_pct": bad_hours_reduction_pct,
            "hours_evaluated": len(driver_requirements),
        },
        "reliability": {"optimized": optimized_sim, "naive": naive_sim},
        "cost": {
            "optimized_total_cost": hiring_plan.total_cost,
            "naive_total_cost": naive_baseline_cost,
            "optimized_cost_per_shipment": optimized_cost_per_shipment,
            "naive_cost_per_shipment": naive_cost_per_shipment,
            "savings_per_shipment": naive_cost_per_shipment - optimized_cost_per_shipment,
            "total_shipments": total_shipments,
            "currency": "AED",
        },
        "hiring_plan": hiring_plan,
    }


@app.post("/v1/events")
def post_event(event: RawEvent) -> dict:
    """Ingests one event from the Wasel frontend (apps/web/src/events.js).
    No auth dependency: the frontend is a public, unauthenticated client by
    design (same as any consumer app posting analytics), unlike the
    planning endpoints above which are meant for trusted dashboard/ops
    callers. Idempotent on event_id, and 'order_placed' events immediately
    roll up into the hourly ShipmentRecord that packages/forecasting
    reads — closing the loop described in apps/web/README.md phase 2.
    """
    inserted = insert_event(event)
    if inserted and event.type == "order_placed" and event.store_id:
        rollup_order_placed(event.store_id, event.timestamp)
        # Next /v1/forecast or /v1/stores/{id}/summary call for this store
        # should retrain on the freshly-rolled-up data rather than serving
        # a stale cached model.
        _MODEL_CACHE.pop(event.store_id, None)
    return {"status": "ok", "stored": inserted}


@app.get("/v1/stores", dependencies=[Depends(require_bearer_token)])
def get_stores() -> list[str]:
    return list_store_ids()


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Frontend hosting — serves the built Wasel app (apps/web/dist) so the whole
# thing runs behind one URL/port instead of separate api/web addresses.
# Mounted last and at "/" so it never shadows the /v1/* and /healthz routes
# above (Starlette matches path operations before mounts). If dist/ hasn't
# been built (e.g. running the API directly during backend-only dev without
# `npm run build`), this mount is skipped rather than erroring — the API
# still works standalone, just without a served frontend.
_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"
if _FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="frontend")
