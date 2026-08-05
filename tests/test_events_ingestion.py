import warnings

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from apps.api.db import RawEventORM, ShipmentRecordORM, engine, get_records, init_db, upsert_records
from apps.api.main import _MODEL_CACHE, app
from packages.analytics.schemas import ShipmentRecord
from scripts.generate_synthetic_data import generate

warnings.filterwarnings("ignore")


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.delenv("API_BEARER_TOKEN", raising=False)  # auth disabled for these tests
    _MODEL_CACHE.clear()

    init_db()
    with engine.begin() as conn:
        conn.execute(text(f"DELETE FROM {ShipmentRecordORM.__tablename__}"))
        conn.execute(text(f"DELETE FROM {RawEventORM.__tablename__}"))

    rows = generate(n_stores=1, n_days=15, seed=11)
    records = [ShipmentRecord(**r) for r in rows]
    upsert_records(records)

    with TestClient(app) as c:
        yield c


def _order_placed_event(event_id="evt_1", store_id="STORE_001", timestamp="2026-08-02T14:03:11Z"):
    return {
        "event_id": event_id,
        "type": "order_placed",
        "timestamp": timestamp,
        "session_id": "sess_abc123",
        "order_id": "WSL-8420",
        "store_id": store_id,
        "items": [{"item_id": "m1", "qty": 2, "price": 42}],
        "total": 96.0,
    }


def test_events_endpoint_accepts_any_tracked_event_shape(client):
    resp = client.post(
        "/v1/events",
        json={
            "event_id": "evt_pageview_1",
            "type": "page_view",
            "timestamp": "2026-08-02T14:00:00Z",
            "session_id": "sess_abc123",
            "view": "home",
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "stored": True}


def test_events_endpoint_is_unauthenticated(client, monkeypatch):
    # Wasel is a public frontend and must be able to post events even when
    # the planning endpoints are locked down with a bearer token.
    monkeypatch.setenv("API_BEARER_TOKEN", "secret-token")
    resp = client.post("/v1/events", json=_order_placed_event())
    assert resp.status_code == 200

    # Sanity check: the token-gated endpoints do reject unauthenticated calls.
    gated = client.get("/v1/stores")
    assert gated.status_code == 401


def test_duplicate_event_id_is_a_noop(client):
    payload = _order_placed_event(event_id="evt_dup")
    first = client.post("/v1/events", json=payload)
    second = client.post("/v1/events", json=payload)
    assert first.json()["stored"] is True
    assert second.json()["stored"] is False


def test_order_placed_rolls_up_into_shipment_record(client):
    before = get_records("STORE_001")
    before_count = len(before)

    resp = client.post(
        "/v1/events", json=_order_placed_event(event_id="evt_rollup_1", timestamp="2026-08-02T14:03:11Z")
    )
    assert resp.status_code == 200

    after = get_records("STORE_001")
    assert len(after) == before_count + 1

    hour_bucket = [r for r in after if r.timestamp.isoformat().startswith("2026-08-02T14:00:00")]
    assert len(hour_bucket) == 1
    assert hour_bucket[0].shipments == 1.0


def test_second_order_in_same_hour_increments_existing_bucket(client):
    client.post("/v1/events", json=_order_placed_event(event_id="evt_a", timestamp="2026-08-02T14:03:11Z"))
    client.post("/v1/events", json=_order_placed_event(event_id="evt_b", timestamp="2026-08-02T14:47:00Z"))

    records = get_records("STORE_001")
    hour_bucket = [r for r in records if r.timestamp.isoformat().startswith("2026-08-02T14:00:00")]
    assert len(hour_bucket) == 1
    assert hour_bucket[0].shipments == 2.0


def test_order_placed_evicts_model_cache_for_that_store(client):
    _MODEL_CACHE["STORE_001"] = ("stale-model", "stale-features")
    client.post("/v1/events", json=_order_placed_event(event_id="evt_cache_evict"))
    assert "STORE_001" not in _MODEL_CACHE


def test_non_order_events_do_not_touch_shipment_records(client):
    before = len(get_records("STORE_001"))
    client.post(
        "/v1/events",
        json={
            "event_id": "evt_store_viewed_1",
            "type": "store_viewed",
            "timestamp": "2026-08-02T14:03:11Z",
            "session_id": "sess_abc123",
            "store_id": "STORE_001",
        },
    )
    after = len(get_records("STORE_001"))
    assert after == before
