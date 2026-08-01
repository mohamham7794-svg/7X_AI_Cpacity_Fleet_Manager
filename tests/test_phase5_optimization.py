from datetime import datetime, timedelta

import pytest

from packages.analytics.schemas import CapacityFactors, ConstraintConfig, CostConfig, DriverRequirement
from packages.optimization.hiring import OptimizationInfeasibleError, naive_hire_to_peak_baseline, optimize


def _requirement(store_id, ts, drivers_needed, capacity=5.5):
    factors = CapacityFactors(
        base_capacity=10, store_productivity=0.82, traffic_factor=0.9,
        weather_factor=1.0, route_length_factor=0.75, effective_capacity=capacity,
    )
    return DriverRequirement(
        store_id=store_id, timestamp=ts, forecast_shipments=drivers_needed * capacity,
        drivers_needed=drivers_needed, capacity_used=capacity, factors_applied=factors,
    )


def _multi_store_requirements(n_stores=4, n_hours=24, peak=20):
    start = datetime(2025, 1, 6)
    reqs = []
    for s in range(n_stores):
        store_id = f"S{s+1}"
        for h in range(n_hours):
            reqs.append(_requirement(store_id, start + timedelta(hours=h), drivers_needed=peak))
    return reqs


def test_optimize_respects_60_40_mix_within_tolerance():
    reqs = _multi_store_requirements()
    plan = optimize(reqs)
    total = plan.permanent_hires + plan.outsourced_units
    assert total > 0
    permanent_ratio = plan.permanent_hires / total
    assert 0.50 <= permanent_ratio <= 0.70  # 60% target +/- 10pp tolerance


def test_optimize_beats_naive_hire_to_peak_baseline():
    reqs = _multi_store_requirements()
    plan = optimize(reqs)
    naive_cost = naive_hire_to_peak_baseline(reqs)
    assert plan.total_cost < naive_cost


def test_infeasible_input_raises_typed_exception():
    reqs = _multi_store_requirements(n_stores=1, peak=1000)
    constraint_config = ConstraintConfig(min_drivers_per_store=5)
    with pytest.raises(OptimizationInfeasibleError):
        optimize(reqs, constraint_config=constraint_config, max_drivers_per_store=2)


def test_optimize_raises_value_error_on_empty_input():
    with pytest.raises(ValueError):
        optimize([])


def test_understaffing_penalty_absorbs_extreme_peaks_without_infeasibility():
    # A very high, unbounded upper_bound should let the solver use the
    # understaffing slack variable rather than going infeasible.
    reqs = _multi_store_requirements(n_stores=1, peak=500)
    plan = optimize(reqs, cost_config=CostConfig(understaffing_penalty_per_unit=1.0))
    assert plan.solver_status in ("OPTIMAL", "FEASIBLE")
