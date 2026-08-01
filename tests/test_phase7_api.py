import warnings

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from apps.api.db import ShipmentRecordORM, engine, init_db, upsert_records
from apps.api.main import _MODEL_CACHE, app
from packages.analytics.schemas import ShipmentRecord
from scripts.generate_synthetic_data import generate

warnings.filterwarnings("ignore")


@pytest.fixture()
def client(monkeypatch):
    # apps.api.db binds its SQLAlchemy engine to DATABASE_URL at *import*
    # time, so monkeypatching the env var here would have no effect on the
    # already-created engine. Use the default sqlite engine and just wipe
    # its rows before each test for isolation.
    monkeypatch.delenv("API_BEARER_TOKEN", raising=False)  # auth disabled for these tests
    _MODEL_CACHE.clear()

    init_db()
    with engine.begin() as conn:
        conn.execute(text(f"DELETE FROM {ShipmentRecordORM.__tablename__}"))

    rows = generate(n_stores=1, n_days=15, seed=11)
    records = [ShipmentRecord(**r) for r in rows]
    upsert_records(records)

    with TestClient(app) as c:
        yield c


def test_health_check(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_list_stores(client):
    resp = client.get("/v1/stores")
    assert resp.status_code == 200
    assert "STORE_001" in resp.json()


def test_forecast_endpoint(client):
    resp = client.post("/v1/forecast", json={"store_id": "STORE_001", "horizon_hours": 6})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 6
    assert all(r["predicted_shipments"] >= 0 for r in body)


def test_full_pipeline_end_to_end_for_one_store(client):
    forecast_resp = client.post("/v1/forecast", json={"store_id": "STORE_001", "horizon_hours": 24})
    assert forecast_resp.status_code == 200
    forecasts = forecast_resp.json()

    store_config = {
        "store_id": "STORE_001", "base_capacity": 10, "store_productivity": 0.82,
        "traffic_factor": 0.9, "weather_factor": 1.0, "route_length_factor": 0.75,
    }
    dr_resp = client.post(
        "/v1/driver-requirements", json={"forecasts": forecasts, "store_config": store_config}
    )
    assert dr_resp.status_code == 200
    driver_requirements = dr_resp.json()
    assert len(driver_requirements) == 24

    opt_resp = client.post("/v1/optimize", json={"driver_requirements": driver_requirements})
    assert opt_resp.status_code == 200
    hiring_plan = opt_resp.json()
    assert hiring_plan["solver_status"] in ("OPTIMAL", "FEASIBLE")

    explain_resp = client.post(
        "/v1/explain",
        json={
            "hiring_plan": hiring_plan, "naive_baseline_cost": hiring_plan["total_cost"] + 1000,
            "demand_change_pct": 0.1, "store_productivity_vs_network": 0.9, "utilization_pct": 0.9,
        },
    )
    assert explain_resp.status_code == 200
    assert explain_resp.json()["expected_savings_monthly"] == pytest.approx(1000.0)


def test_store_summary_endpoint(client):
    resp = client.get("/v1/stores/STORE_001/summary", params={"horizon_hours": 6})
    assert resp.status_code == 200
    body = resp.json()
    assert body["store_id"] == "STORE_001"
    assert "forecast" in body and "hiring_plan" in body


def test_missing_store_returns_structured_error(client):
    resp = client.post("/v1/forecast", json={"store_id": "NOT_REAL", "horizon_hours": 6})
    assert resp.status_code == 422
    assert resp.json()["error_code"] == "missing_store_data"


def test_bearer_auth_rejects_missing_token(client, monkeypatch):
    monkeypatch.setenv("API_BEARER_TOKEN", "secret-token")
    resp = client.get("/v1/stores")
    assert resp.status_code == 401
