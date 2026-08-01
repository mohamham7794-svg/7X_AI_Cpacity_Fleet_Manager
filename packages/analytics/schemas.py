"""Shared Pydantic v2 data contracts (§5 of the build prompt).

Every package imports these types instead of passing around ad-hoc dicts.
Locked here first, per §7.1 ('Don't skip §5') — module internals depend on
these being stable.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Raw data / ingestion
# ---------------------------------------------------------------------------

class ShipmentRecord(BaseModel):
    store_id: str
    timestamp: datetime
    shipments: float = Field(ge=0)
    weather: str | None = None
    weather_severity: float = 1.0
    is_promo: bool = False
    is_event: bool = False
    is_holiday: bool = False
    is_weekend: bool = False


# ---------------------------------------------------------------------------
# Forecasting (Phase 2)
# ---------------------------------------------------------------------------

class ModelBreakdown(BaseModel):
    lightgbm: float | None = None
    catboost: float | None = None
    xgboost: float | None = None
    prophet: float | None = None


class ForecastResult(BaseModel):
    store_id: str
    timestamp: datetime
    predicted_shipments: float
    model_breakdown: ModelBreakdown | None = None
    confidence_interval_low: float | None = None
    confidence_interval_high: float | None = None


class EnsembleWeights(BaseModel):
    lightgbm: float = 0.40
    catboost: float = 0.30
    xgboost: float = 0.20
    prophet: float = 0.10

    @model_validator(mode="after")
    def _weights_sum_to_one(self) -> "EnsembleWeights":
        total = self.lightgbm + self.catboost + self.xgboost + self.prophet
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"EnsembleWeights must sum to 1.0, got {total}")
        return self


class EvaluationMetrics(BaseModel):
    model_name: str
    rmse: float
    mae: float
    mape: float
    weighted_mape: float
    r2: float


# ---------------------------------------------------------------------------
# Workforce / capacity conversion (Phase 3)
# ---------------------------------------------------------------------------

class StoreConfig(BaseModel):
    store_id: str
    base_capacity: float = 10.0
    store_productivity: float = 0.82
    traffic_factor: float = 0.90
    weather_factor: float = 1.0
    route_length_factor: float = 0.75


class CapacityFactors(BaseModel):
    base_capacity: float
    store_productivity: float
    traffic_factor: float
    weather_factor: float
    route_length_factor: float
    effective_capacity: float


class DriverRequirement(BaseModel):
    store_id: str
    timestamp: datetime
    forecast_shipments: float
    drivers_needed: int = Field(ge=0)
    capacity_used: float
    factors_applied: CapacityFactors


# ---------------------------------------------------------------------------
# Simulation (Phase 4)
# ---------------------------------------------------------------------------

class StaffingPlan(BaseModel):
    store_id: str
    timestamp: datetime
    permanent_scheduled: int = Field(ge=0)
    temp_scheduled: int = Field(ge=0, default=0)
    outsourced_scheduled: int = Field(ge=0, default=0)
    absence_rate: float = Field(ge=0, le=1, default=0.0)
    overtime_allowed: bool = True


class HourlySimResult(BaseModel):
    store_id: str
    timestamp: datetime
    demand: float
    drivers_available: int
    drivers_absent: int
    drivers_on_leave: int
    drivers_on_shift: int
    drivers_overtime: int
    drivers_outsourced: int
    deliveries_completed: float
    late_deliveries: float
    backlog_carried_forward: float
    utilization: float


class SimulationResult(BaseModel):
    store_id: str
    timeline: list[HourlySimResult]
    late_deliveries_total: float
    utilization: float
    bottleneck_hours: list[datetime]
    on_time_rate: float
    store_closures: int


# ---------------------------------------------------------------------------
# Optimization / hiring (Phase 5)
# ---------------------------------------------------------------------------

class CostConfig(BaseModel):
    permanent_hourly_cost: float = 25.0
    temp_hourly_cost: float = 30.0
    outsource_unit_cost: float = 35.0
    understaffing_penalty_per_unit: float = 200.0
    currency: str = "AED"


class ConstraintConfig(BaseModel):
    permanent_mix_target: float = 0.60  # 60% permanent / 40% outsourced, per 7X brief
    min_drivers_per_store: int | None = None
    temp_capacity_fraction: float = 0.25
    permanent_lead_time_days: int = 52  # 45-60 day range per 7X brief, default 52
    outsourced_lead_time_days: int = 7  # 5-10 day range per 7X brief
    max_hours_per_week: float = 48.0  # configurable — no jurisdiction hardcoded


class StoreHiringPlan(BaseModel):
    store_id: str
    permanent_hires: int
    temp_hires: int
    outsourced_units: int
    transfers_in: int = 0
    transfers_out: int = 0
    store_cost: float


class HiringPlan(BaseModel):
    store_id: str  # "ALL" for a network-wide plan, or a specific store_id
    planning_period_start: datetime
    planning_period_end: datetime
    permanent_hires: int
    temp_hires: int
    outsourced_units: int
    transfers: list[StoreHiringPlan] = Field(default_factory=list)
    total_cost: float
    constraint_slack: dict = Field(default_factory=dict)
    solver_status: str


# ---------------------------------------------------------------------------
# Explainability (Phase 6)
# ---------------------------------------------------------------------------

class ExplanationPayload(BaseModel):
    recommendation: str
    reasons: list[str]
    expected_savings_monthly: float
    currency: str = "AED"
    confidence: float = Field(ge=0, le=1)


class ScenarioRequest(BaseModel):
    demand_multiplier: float = 1.0
    weather_override: str | None = None
    resignations: int = 0
    outsourcing_available: bool = True

    @field_validator("demand_multiplier")
    @classmethod
    def _positive_multiplier(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("demand_multiplier must be > 0")
        return v


# ---------------------------------------------------------------------------
# API error codes (Phase 7)
# ---------------------------------------------------------------------------

class ErrorCode(str, Enum):
    UNAUTHORIZED = "unauthorized"
    INFEASIBLE_OPTIMIZATION = "infeasible_optimization"
    SIMULATION_INPUT_ERROR = "simulation_input_error"
    MISSING_STORE_DATA = "missing_store_data"
    VALIDATION_ERROR = "validation_error"
    INTERNAL_ERROR = "internal_error"
