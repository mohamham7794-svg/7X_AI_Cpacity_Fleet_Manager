import warnings
from datetime import datetime, timedelta

import pytest

from packages.ai.explain import (
    ExplanationGuardrailError,
    ExplanationInputs,
    generate_explanation,
    validate_explanation,
)
from packages.ai.reasons import build_explanation_inputs
from packages.ai.scenario import run_scenario
from packages.analytics.schemas import (
    ConstraintConfig,
    CostConfig,
    ExplanationPayload,
    ForecastResult,
    HiringPlan,
    ScenarioRequest,
    StoreConfig,
    StoreHiringPlan,
)

warnings.filterwarnings("ignore")


def _sample_hiring_plan() -> HiringPlan:
    return HiringPlan(
        store_id="ALL",
        planning_period_start=datetime(2025, 1, 1),
        planning_period_end=datetime(2025, 1, 31),
        permanent_hires=5,
        temp_hires=1,
        outsourced_units=3,
        transfers=[StoreHiringPlan(store_id="S1", permanent_hires=5, temp_hires=1, outsourced_units=3, store_cost=1000)],
        total_cost=1000,
        constraint_slack={},
        solver_status="OPTIMAL",
    )


# ---------------------------------------------------------------------------
# Guardrail
# ---------------------------------------------------------------------------


def test_generate_explanation_passes_guardrail_with_no_llm_configured(monkeypatch):
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    inputs = ExplanationInputs(
        recommendation="Hire 5 permanent drivers",
        candidate_reasons=["Demand expected to increase 18%", "Utilization already at 94%"],
        expected_savings_monthly=18300.0,
        currency="AED",
        confidence=0.96,
    )
    payload = generate_explanation(inputs)
    assert isinstance(payload, ExplanationPayload)
    assert set(payload.reasons) <= set(inputs.candidate_reasons)
    assert payload.expected_savings_monthly == 18300.0


def test_guardrail_catches_fabricated_reason_not_in_candidates():
    """Deliberately-corrupted fixture (§6 Phase 6 acceptance criteria): a
    reason string containing a number that was never in the structured
    input must be rejected."""
    inputs = ExplanationInputs(
        recommendation="Hire 5 permanent drivers",
        candidate_reasons=["Demand expected to increase 18%"],
        expected_savings_monthly=18300.0,
        currency="AED",
        confidence=0.96,
    )
    corrupted = ExplanationPayload(
        recommendation="Hire 5 permanent drivers",
        reasons=["Demand expected to increase 47%"],  # fabricated number, not verbatim
        expected_savings_monthly=18300.0,
        currency="AED",
        confidence=0.96,
    )
    with pytest.raises(ExplanationGuardrailError):
        validate_explanation(corrupted, inputs)


def test_guardrail_catches_altered_savings_figure():
    inputs = ExplanationInputs(
        recommendation="Hire 5 permanent drivers",
        candidate_reasons=["Demand expected to increase 18%"],
        expected_savings_monthly=18300.0,
        currency="AED",
        confidence=0.96,
    )
    corrupted = ExplanationPayload(
        recommendation="Hire 5 permanent drivers",
        reasons=["Demand expected to increase 18%"],
        expected_savings_monthly=99999.0,  # altered — not traceable to structured input
        currency="AED",
        confidence=0.96,
    )
    with pytest.raises(ExplanationGuardrailError):
        validate_explanation(corrupted, inputs)


def test_build_explanation_inputs_is_deterministic_and_traceable():
    plan = _sample_hiring_plan()
    inputs = build_explanation_inputs(
        plan, naive_baseline_cost=2000.0, demand_change_pct=0.18,
        store_productivity_vs_network=0.85, utilization_pct=0.94,
    )
    payload = generate_explanation(inputs)
    assert payload.expected_savings_monthly == pytest.approx(1000.0)  # 2000 - 1000
    validate_explanation(payload, inputs)  # should not raise


# ---------------------------------------------------------------------------
# Scenario runner
# ---------------------------------------------------------------------------


def _forecasts(store_id, n, base=100.0):
    start = datetime(2025, 1, 6)
    return [
        ForecastResult(store_id=store_id, timestamp=start + timedelta(hours=i), predicted_shipments=base)
        for i in range(n)
    ]


def test_scenario_with_no_op_overrides_produces_identical_plan_to_baseline():
    forecasts_by_store = {"S1": _forecasts("S1", 24, base=100.0)}
    store_configs = {"S1": StoreConfig(store_id="S1")}
    scenario = ScenarioRequest(demand_multiplier=1.0)
    result = run_scenario(forecasts_by_store, store_configs, scenario)
    assert result.hiring_plan_delta["permanent_hires_delta"] == 0
    assert result.hiring_plan_delta["temp_hires_delta"] == 0
    assert result.hiring_plan_delta["outsourced_units_delta"] == 0
    assert result.hiring_plan_delta["total_cost_delta"] == pytest.approx(0.0)


def test_scenario_with_demand_multiplier_produces_different_plan():
    forecasts_by_store = {"S1": _forecasts("S1", 24, base=100.0)}
    store_configs = {"S1": StoreConfig(store_id="S1")}
    scenario = ScenarioRequest(demand_multiplier=2.0)
    result = run_scenario(forecasts_by_store, store_configs, scenario)
    total_delta = (
        result.hiring_plan_delta["permanent_hires_delta"]
        + result.hiring_plan_delta["temp_hires_delta"]
        + result.hiring_plan_delta["outsourced_units_delta"]
    )
    assert total_delta > 0


def test_scenario_missing_store_config_raises():
    forecasts_by_store = {"S1": _forecasts("S1", 5)}
    scenario = ScenarioRequest()
    with pytest.raises(ValueError):
        run_scenario(forecasts_by_store, {}, scenario)


# ---------------------------------------------------------------------------
# SHAP smoke test
# ---------------------------------------------------------------------------


def test_shap_explain_returns_top_features_for_trained_model():
    from packages.ai.shap_explain import explain_forecast
    from packages.analytics.schemas import ShipmentRecord
    from packages.forecasting.api import train
    from scripts.generate_synthetic_data import generate

    rows = generate(n_stores=1, n_days=15, seed=5)
    records = [ShipmentRecord(**r) for r in rows]
    model, features_df = train(records)
    explanations = explain_forecast(model, features_df.head(3), top_n=3)
    assert len(explanations) == 3
    for e in explanations:
        assert len(e["feature_importance"]) == 3
        assert all("feature" in f and "shap_value" in f for f in e["feature_importance"])
