from datetime import datetime, timedelta

import pytest

from packages.analytics.schemas import DriverRequirement, CapacityFactors, StaffingPlan
from packages.simulation.engine import simulate, SimulationInputError


def _make_requirement(store_id, ts, forecast, capacity_per_driver=5.5):
    factors = CapacityFactors(
        base_capacity=10, store_productivity=0.82, traffic_factor=0.9,
        weather_factor=1.0, route_length_factor=0.75, effective_capacity=capacity_per_driver,
    )
    import math
    drivers_needed = math.ceil(forecast / capacity_per_driver) if forecast > 0 else 0
    return DriverRequirement(
        store_id=store_id, timestamp=ts, forecast_shipments=forecast,
        drivers_needed=drivers_needed, capacity_used=capacity_per_driver, factors_applied=factors,
    )


def _hours(n, start=None):
    start = start or datetime(2025, 1, 6, 0, 0, 0)
    return [start + timedelta(hours=i) for i in range(n)]


def test_sufficient_staffing_produces_zero_late_deliveries():
    ts = _hours(24)
    reqs = [_make_requirement("S1", t, forecast=100) for t in ts]  # needs ceil(100/5.5)=19 drivers/hr
    plan = [
        StaffingPlan(store_id="S1", timestamp=t, permanent_scheduled=25, temp_scheduled=0,
                     outsourced_scheduled=0, absence_rate=0.0)
        for t in ts
    ]
    result = simulate(reqs, plan)
    assert result.late_deliveries_total == pytest.approx(0.0)
    assert result.on_time_rate == pytest.approx(1.0)
    assert result.store_closures == 0
    assert len(result.bottleneck_hours) == 0


def test_understaffed_plan_produces_backlog_that_carries_forward():
    ts = _hours(5)
    # forecast needs ~19 drivers/hr but only 5 scheduled -> big shortfall every hour
    reqs = [_make_requirement("S1", t, forecast=100) for t in ts]
    plan = [
        StaffingPlan(store_id="S1", timestamp=t, permanent_scheduled=5, temp_scheduled=0,
                     outsourced_scheduled=0, absence_rate=0.0, overtime_allowed=False)
        for t in ts
    ]
    result = simulate(reqs, plan)
    assert result.late_deliveries_total > 0
    # backlog should be monotonically non-decreasing across hours since staffing never catches up
    backlogs = [h.backlog_carried_forward for h in result.timeline]
    assert all(b2 >= b1 - 1e-6 for b1, b2 in zip(backlogs, backlogs[1:]))
    assert backlogs[-1] > backlogs[0]
    assert len(result.bottleneck_hours) == 5


def test_absence_rate_reduces_effective_on_shift_drivers():
    ts = _hours(1)
    reqs = [_make_requirement("S1", ts[0], forecast=50)]
    plan_no_absence = [StaffingPlan(store_id="S1", timestamp=ts[0], permanent_scheduled=20,
                                     temp_scheduled=0, outsourced_scheduled=0, absence_rate=0.0)]
    plan_high_absence = [StaffingPlan(store_id="S1", timestamp=ts[0], permanent_scheduled=20,
                                       temp_scheduled=0, outsourced_scheduled=0, absence_rate=0.5)]
    r1 = simulate(reqs, plan_no_absence)
    r2 = simulate(reqs, plan_high_absence)
    assert r1.timeline[0].drivers_on_shift > r2.timeline[0].drivers_on_shift
    assert r1.timeline[0].drivers_absent == 0
    assert r2.timeline[0].drivers_absent == 10


def test_outsourced_drivers_cover_shortfall_after_overtime():
    ts = _hours(1)
    reqs = [_make_requirement("S1", ts[0], forecast=100)]  # needs ~19 drivers
    plan = [StaffingPlan(store_id="S1", timestamp=ts[0], permanent_scheduled=10, temp_scheduled=0,
                          outsourced_scheduled=10, absence_rate=0.0, overtime_allowed=True)]
    result = simulate(reqs, plan)
    h = result.timeline[0]
    assert h.drivers_outsourced == 10
    # with overtime + outsourced help, shortfall should shrink vs no outsourcing at all
    plan_no_outsource = [StaffingPlan(store_id="S1", timestamp=ts[0], permanent_scheduled=10,
                                       temp_scheduled=0, outsourced_scheduled=0, absence_rate=0.0,
                                       overtime_allowed=True)]
    result2 = simulate(reqs, plan_no_outsource)
    assert h.backlog_carried_forward < result2.timeline[0].backlog_carried_forward


def test_store_closure_flagged_when_zero_drivers_and_demand_positive():
    ts = _hours(1)
    reqs = [_make_requirement("S1", ts[0], forecast=50)]
    plan = [StaffingPlan(store_id="S1", timestamp=ts[0], permanent_scheduled=0, temp_scheduled=0,
                          outsourced_scheduled=0, absence_rate=0.0)]
    result = simulate(reqs, plan)
    assert result.store_closures == 1


def test_simulate_rejects_missing_staffing_plan_entries():
    ts = _hours(2)
    reqs = [_make_requirement("S1", t, forecast=10) for t in ts]
    plan = [StaffingPlan(store_id="S1", timestamp=ts[0], permanent_scheduled=5, temp_scheduled=0,
                          outsourced_scheduled=0)]
    with pytest.raises(SimulationInputError):
        simulate(reqs, plan)


def test_simulate_rejects_multi_store_input():
    ts = _hours(1)
    reqs = [_make_requirement("S1", ts[0], forecast=10), _make_requirement("S2", ts[0], forecast=10)]
    plan = [StaffingPlan(store_id="S1", timestamp=ts[0], permanent_scheduled=5, temp_scheduled=0, outsourced_scheduled=0)]
    with pytest.raises(SimulationInputError):
        simulate(reqs, plan)
