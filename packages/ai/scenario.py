"""Scenario runner (§4 ScenarioRequest, §6 Phase 6 Module 7).

Given a ScenarioRequest, re-runs convert -> optimize with the overridden
assumptions and returns the resulting HiringPlan diffed against the
baseline (unscaled, weather-as-configured) plan.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from packages.analytics.schemas import (
    ConstraintConfig,
    CostConfig,
    ForecastResult,
    HiringPlan,
    ScenarioRequest,
    StoreConfig,
)
from packages.optimization.hiring import optimize
from packages.workforce.capacity import convert


@dataclass
class ScenarioResult:
    scenario: ScenarioRequest
    baseline_plan: HiringPlan
    scenario_plan: HiringPlan
    hiring_plan_delta: dict = field(default_factory=dict)


def _driver_requirements(
    forecasts_by_store: dict[str, list[ForecastResult]],
    store_configs: dict[str, StoreConfig],
    demand_multiplier: float,
    weather_override: float | None,
):
    driver_requirements = []
    for store_id, forecasts in forecasts_by_store.items():
        cfg = store_configs.get(store_id)
        if cfg is None:
            raise ValueError(f"No StoreConfig provided for store_id={store_id!r}")
        for f in forecasts:
            scaled = f.model_copy(update={"predicted_shipments": f.predicted_shipments * demand_multiplier})
            driver_requirements.append(convert(scaled, cfg, weather_factor=weather_override))
    return driver_requirements


def run_scenario(
    forecasts_by_store: dict[str, list[ForecastResult]],
    store_configs: dict[str, StoreConfig],
    scenario: ScenarioRequest,
    cost_config: CostConfig | None = None,
    constraint_config: ConstraintConfig | None = None,
) -> ScenarioResult:
    """Public API (§6 Phase 6). Raises ValueError if a forecasted store has
    no matching StoreConfig (fails fast rather than silently skipping a
    store's demand)."""
    if not forecasts_by_store:
        raise ValueError("forecasts_by_store is empty")

    cost_config = cost_config or CostConfig()
    constraint_config = constraint_config or ConstraintConfig()

    baseline_requirements = _driver_requirements(
        forecasts_by_store, store_configs, demand_multiplier=1.0, weather_override=None
    )
    baseline_plan = optimize(baseline_requirements, cost_config, constraint_config)

    outsourcing_available = scenario.outsourcing_available
    scenario_constraint_config = constraint_config
    if not outsourcing_available:
        # Scenario disables outsourcing entirely: force the mix target to
        # 100% permanent so the MILP can't lean on outsourced units.
        scenario_constraint_config = constraint_config.model_copy(update={"permanent_mix_target": 1.0})

    scenario_requirements = _driver_requirements(
        forecasts_by_store,
        store_configs,
        demand_multiplier=scenario.demand_multiplier,
        weather_override=None,
    )
    scenario_plan = optimize(scenario_requirements, cost_config, scenario_constraint_config)

    delta = {
        "permanent_hires_delta": scenario_plan.permanent_hires - baseline_plan.permanent_hires,
        "temp_hires_delta": scenario_plan.temp_hires - baseline_plan.temp_hires,
        "outsourced_units_delta": scenario_plan.outsourced_units - baseline_plan.outsourced_units,
        "total_cost_delta": scenario_plan.total_cost - baseline_plan.total_cost,
    }

    return ScenarioResult(
        scenario=scenario,
        baseline_plan=baseline_plan,
        scenario_plan=scenario_plan,
        hiring_plan_delta=delta,
    )
