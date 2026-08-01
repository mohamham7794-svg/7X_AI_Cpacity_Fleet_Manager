"""Turns structured optimization/simulation/forecasting output into the
candidate reason strings + numeric fields the LLM layer is allowed to
narrate (§4, §6 Phase 6). Every number here is computed in plain Python —
the LLM never sees raw numbers to invent from, only these finished strings.
"""
from __future__ import annotations

from packages.ai.explain import ExplanationInputs
from packages.analytics.schemas import ConstraintConfig, HiringPlan


def build_explanation_inputs(
    plan: HiringPlan,
    naive_baseline_cost: float,
    demand_change_pct: float,
    store_productivity_vs_network: float,
    utilization_pct: float,
    constraint_config: ConstraintConfig | None = None,
    currency: str = "AED",
) -> ExplanationInputs:
    """All arguments are pre-computed facts from other packages:
      - plan: from packages.optimization.hiring.optimize()
      - naive_baseline_cost: from packages.optimization.hiring.naive_hire_to_peak_baseline()
      - demand_change_pct: from forecasting (e.g. next period vs trailing average)
      - store_productivity_vs_network: from workforce/store config vs network average
      - utilization_pct: from packages.simulation.engine.simulate()
    """
    constraint_config = constraint_config or ConstraintConfig()

    recommendation = _build_recommendation(plan)
    candidate_reasons = _build_candidate_reasons(
        demand_change_pct, store_productivity_vs_network, utilization_pct, constraint_config
    )
    expected_savings_monthly = round(naive_baseline_cost - plan.total_cost, 2)
    confidence = _confidence_from_solver_status(plan.solver_status)

    return ExplanationInputs(
        recommendation=recommendation,
        candidate_reasons=candidate_reasons,
        expected_savings_monthly=expected_savings_monthly,
        currency=currency,
        confidence=confidence,
    )


def _build_recommendation(plan: HiringPlan) -> str:
    parts = []
    if plan.permanent_hires > 0:
        parts.append(f"Hire {plan.permanent_hires} permanent drivers")
    if plan.temp_hires > 0:
        parts.append(f"{plan.temp_hires} temp drivers")
    if plan.outsourced_units > 0:
        parts.append(f"{plan.outsourced_units} outsourced units")
    if not parts:
        return "Maintain current staffing — no changes recommended"
    return ", ".join(parts)


def _build_candidate_reasons(
    demand_change_pct: float,
    store_productivity_vs_network: float,
    utilization_pct: float,
    constraint_config: ConstraintConfig,
) -> list[str]:
    reasons: list[str] = []

    if demand_change_pct > 0:
        reasons.append(f"Demand expected to increase {round(demand_change_pct * 100)}%")
    elif demand_change_pct < 0:
        reasons.append(f"Demand expected to decrease {round(abs(demand_change_pct) * 100)}%")

    if store_productivity_vs_network < 1.0:
        reasons.append("Store productivity lower than network average")
    elif store_productivity_vs_network > 1.0:
        reasons.append("Store productivity higher than network average")

    reasons.append(f"Average utilization already at {round(utilization_pct * 100)}%")

    reasons.append(
        f"Lead time is {constraint_config.permanent_lead_time_days} days — "
        "hiring today prevents a shortage later"
    )

    return reasons


def _confidence_from_solver_status(solver_status: str) -> float:
    return 0.96 if solver_status == "OPTIMAL" else 0.75
