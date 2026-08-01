"""Workforce simulator — hour-by-hour discrete-event state machine (§4):

    Hour -> Demand -> Assign Drivers (greedy/priority-queue) -> Remaining Demand
    -> Late Deliveries carried to -> Next Hour

Uses SimPy's Environment to drive the hourly clock (a real discrete-event
process, not just a for-loop) so the simulation can later be extended with
genuine SimPy Resources/Processes (e.g. per-driver shift processes) without
changing the public API.

Assignment policy (greedy/priority-queue, per §4):
    1. Serve carried-over backlog + this hour's forecasted demand.
    2. Use on-shift permanent+temp drivers first (their capacity_used comes
       straight from the matching DriverRequirement, i.e. the same effective
       capacity/driver/hour the workforce package computed).
    3. If demand still exceeds capacity and overtime is allowed, on-shift
       drivers absorb overtime work at OVERTIME_CAPACITY_BOOST.
    4. Outsourced drivers are called in last (they're the flexible, faster
       lead-time lever) to cover whatever's still short.
    5. Anything still unmet becomes backlog, carried into the next hour.
"""
from __future__ import annotations

import math
from datetime import datetime

import simpy

from packages.analytics.schemas import (
    DriverRequirement,
    StaffingPlan,
    HourlySimResult,
    SimulationResult,
)

OVERTIME_CAPACITY_BOOST = 0.25  # on-shift drivers can deliver 25% more via overtime


class SimulationInputError(Exception):
    pass


def _assign_hour(
    demand: float,
    backlog_in: float,
    capacity_per_driver: float,
    plan: StaffingPlan,
) -> dict:
    total_demand = demand + backlog_in

    scheduled = plan.permanent_scheduled + plan.temp_scheduled
    drivers_absent = math.floor(scheduled * plan.absence_rate)
    drivers_on_leave = 0  # modeled as part of absence_rate; kept as an explicit field for reporting
    drivers_on_shift = max(0, scheduled - drivers_absent)

    on_shift_capacity = drivers_on_shift * capacity_per_driver
    remaining_after_regular = max(0.0, total_demand - on_shift_capacity)
    delivered_regular = min(total_demand, on_shift_capacity)

    drivers_overtime = 0
    overtime_capacity = 0.0
    if remaining_after_regular > 0 and plan.overtime_allowed and drivers_on_shift > 0:
        overtime_capacity = on_shift_capacity * OVERTIME_CAPACITY_BOOST
        drivers_overtime = drivers_on_shift
    delivered_overtime = min(remaining_after_regular, overtime_capacity)
    remaining_after_overtime = remaining_after_regular - delivered_overtime

    outsourced_capacity = plan.outsourced_scheduled * capacity_per_driver
    delivered_outsourced = min(remaining_after_overtime, outsourced_capacity)
    remaining_after_outsourced = remaining_after_overtime - delivered_outsourced

    deliveries_completed = delivered_regular + delivered_overtime + delivered_outsourced
    backlog_out = max(0.0, remaining_after_outsourced)

    drivers_available = drivers_on_shift + plan.outsourced_scheduled
    utilization = (
        deliveries_completed / on_shift_capacity if on_shift_capacity > 0 else (0.0 if deliveries_completed == 0 else float("inf"))
    )

    return {
        "drivers_available": drivers_available,
        "drivers_absent": drivers_absent,
        "drivers_on_leave": drivers_on_leave,
        "drivers_on_shift": drivers_on_shift,
        "drivers_overtime": drivers_overtime,
        "drivers_outsourced": plan.outsourced_scheduled,
        "deliveries_completed": deliveries_completed,
        "late_deliveries": backlog_out,
        "backlog_carried_forward": backlog_out,
        "utilization": utilization,
    }


def simulate(
    driver_requirements: list[DriverRequirement],
    staffing_plan: list[StaffingPlan],
) -> SimulationResult:
    """Public API. Both lists must cover the same single store_id and be
    aligned/matchable by timestamp (order doesn't need to match; they're
    joined internally). Runs as a SimPy process stepping hour-by-hour."""
    if not driver_requirements:
        raise SimulationInputError("driver_requirements is empty")
    store_ids = {d.store_id for d in driver_requirements}
    if len(store_ids) != 1:
        raise SimulationInputError(f"simulate() takes a single store's timeline; got store_ids={store_ids}")
    store_id = store_ids.pop()

    plan_by_ts: dict[datetime, StaffingPlan] = {p.timestamp: p for p in staffing_plan}
    dr_sorted = sorted(driver_requirements, key=lambda d: d.timestamp)

    missing = [d.timestamp for d in dr_sorted if d.timestamp not in plan_by_ts]
    if missing:
        raise SimulationInputError(
            f"staffing_plan missing entries for {len(missing)} timestamp(s), e.g. {missing[0]}"
        )

    env = simpy.Environment()
    timeline: list[HourlySimResult] = []
    state = {"backlog": 0.0}

    def hour_process():
        for dr in dr_sorted:
            plan = plan_by_ts[dr.timestamp]
            result = _assign_hour(
                demand=dr.forecast_shipments,
                backlog_in=state["backlog"],
                capacity_per_driver=dr.capacity_used,
                plan=plan,
            )
            state["backlog"] = result["backlog_carried_forward"]
            timeline.append(
                HourlySimResult(
                    store_id=store_id,
                    timestamp=dr.timestamp,
                    demand=dr.forecast_shipments,
                    drivers_available=result["drivers_available"],
                    drivers_absent=result["drivers_absent"],
                    drivers_on_leave=result["drivers_on_leave"],
                    drivers_on_shift=result["drivers_on_shift"],
                    drivers_overtime=result["drivers_overtime"],
                    drivers_outsourced=result["drivers_outsourced"],
                    deliveries_completed=result["deliveries_completed"],
                    late_deliveries=result["late_deliveries"],
                    backlog_carried_forward=result["backlog_carried_forward"],
                    utilization=min(result["utilization"], 10.0) if result["utilization"] != float("inf") else 10.0,
                )
            )
            yield env.timeout(1)

    env.process(hour_process())
    env.run()

    late_total = sum(h.late_deliveries for h in timeline)
    total_forecast_demand = sum(h.demand for h in timeline)
    bottleneck_hours = [h.timestamp for h in timeline if h.backlog_carried_forward > 0]
    avg_utilization = sum(h.utilization for h in timeline) / len(timeline) if timeline else 0.0
    on_time_rate = 1.0 - (late_total / total_forecast_demand if total_forecast_demand > 0 else 0.0)
    on_time_rate = max(0.0, min(1.0, on_time_rate))

    store_closures = sum(1 for h in timeline if h.drivers_available == 0 and h.demand > 0)

    return SimulationResult(
        store_id=store_id,
        timeline=timeline,
        late_deliveries_total=late_total,
        utilization=avg_utilization,
        bottleneck_hours=bottleneck_hours,
        on_time_rate=on_time_rate,
        store_closures=store_closures,
    )
