"""Rolling replanning (§6 Phase 5): a callable that re-runs
forecast -> convert -> optimize on each call and diffs the result against
the previous plan, so a scheduler (cron/Airflow/etc.) can call this daily
without the caller needing to know optimizer/forecast internals."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from packages.analytics.schemas import HiringPlan, DriverRequirement, CostConfig, ConstraintConfig, ForecastResult, StoreConfig
from packages.workforce.capacity import convert
from .hiring import optimize


@dataclass
class PlanDiff:
    run_timestamp: datetime
    previous_plan: HiringPlan | None
    current_plan: HiringPlan
    permanent_hires_delta: int
    temp_hires_delta: int
    outsourced_units_delta: int
    cost_delta: float
    per_store_deltas: dict[str, dict] = field(default_factory=dict)


class RollingReplanner:
    """Holds the last plan in memory (swap for a DB-backed store in
    production) so successive calls can be diffed."""

    def __init__(self):
        self._last_plan: HiringPlan | None = None

    def run(
        self,
        forecasts_by_store: dict[str, list[ForecastResult]],
        store_configs: dict[str, StoreConfig],
        cost_config: CostConfig | None = None,
        constraint_config: ConstraintConfig | None = None,
        weather_factor: float = 1.0,
        run_timestamp: datetime | None = None,
    ) -> PlanDiff:
        run_timestamp = run_timestamp or datetime.utcnow()

        driver_requirements: list[DriverRequirement] = []
        for store_id, forecasts in forecasts_by_store.items():
            cfg = store_configs.get(store_id)
            if cfg is None:
                raise ValueError(f"No StoreConfig provided for store_id={store_id!r}")
            driver_requirements.extend(convert(f, cfg, weather_factor=weather_factor) for f in forecasts)

        current_plan = optimize(driver_requirements, cost_config, constraint_config)
        diff = self._diff(run_timestamp, self._last_plan, current_plan)
        self._last_plan = current_plan
        return diff

    @staticmethod
    def _diff(run_timestamp: datetime, previous: HiringPlan | None, current: HiringPlan) -> PlanDiff:
        if previous is None:
            return PlanDiff(
                run_timestamp=run_timestamp, previous_plan=None, current_plan=current,
                permanent_hires_delta=current.permanent_hires, temp_hires_delta=current.temp_hires,
                outsourced_units_delta=current.outsourced_units, cost_delta=current.total_cost,
                per_store_deltas={sp.store_id: {"permanent_delta": sp.permanent_hires, "outsourced_delta": sp.outsourced_units}
                                   for sp in current.transfers},
            )

        prev_by_store = {sp.store_id: sp for sp in previous.transfers}
        per_store_deltas = {}
        for sp in current.transfers:
            prev_sp = prev_by_store.get(sp.store_id)
            per_store_deltas[sp.store_id] = {
                "permanent_delta": sp.permanent_hires - (prev_sp.permanent_hires if prev_sp else 0),
                "outsourced_delta": sp.outsourced_units - (prev_sp.outsourced_units if prev_sp else 0),
            }

        return PlanDiff(
            run_timestamp=run_timestamp,
            previous_plan=previous,
            current_plan=current,
            permanent_hires_delta=current.permanent_hires - previous.permanent_hires,
            temp_hires_delta=current.temp_hires - previous.temp_hires,
            outsourced_units_delta=current.outsourced_units - previous.outsourced_units,
            cost_delta=current.total_cost - previous.total_cost,
            per_store_deltas=per_store_deltas,
        )
