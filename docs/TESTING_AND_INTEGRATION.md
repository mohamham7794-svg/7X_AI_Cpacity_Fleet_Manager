# Testing & UI/UX Integration Guide

This covers two things:
1. **How to run the backend and its tests**, phase by phase.
2. **How to wire up a frontend/dashboard later** without touching backend code.

---

## 1. One-time setup

```bash
# unzip the repo, then from its root:
cd ai_workforce_planning_engine

# create a virtual environment
python3.12 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# install dependencies
pip install -r requirements.txt
```

**Note on heavy ML libs:** `catboost`, `xgboost`, `prophet`, and `mlflow` are
large installs. Every module that uses them was written to **degrade
gracefully** if they're missing (you'll just see a `UserWarning` and the
ensemble renormalizes across whatever models *are* available — LightGBM
alone is enough to run everything end-to-end). If you're short on time or
disk space, you can skip them:

```bash
pip install fastapi uvicorn pydantic pandas sqlalchemy ortools simpy \
            lightgbm shap pytest httpx
```

Full install (`pip install -r requirements.txt`) is what you want before a
real demo, since the ensemble is supposed to blend all four models.

---

## 2. Generate synthetic data

Nothing works until there's data in the DB. Two ways to get it in:

**A. Generate a CSV (for inspection / bulk-loading later):**
```bash
python scripts/generate_synthetic_data.py --stores 5 --days 120 --seed 42 \
    --out data/raw/synthetic_shipments.csv
```

**B. Load directly into the app's database (what the API reads from):**
```bash
python - <<'EOF'
from apps.api.db import init_db, upsert_records
from packages.analytics.schemas import ShipmentRecord
from scripts.generate_synthetic_data import generate

init_db()
rows = generate(n_stores=5, n_days=120, seed=42)
records = [ShipmentRecord(**r) for r in rows]
n = upsert_records(records)
print(f"inserted {n} rows")
EOF
```
This writes to `data/app.db` (SQLite) by default. Set `DATABASE_URL` before
running this to point at Postgres instead.

---

## 3. Running the test suite

All commands assume you're in the repo root with the venv active.

### Run everything
```bash
pytest
```
Expect **49 passed** (fewer if you skipped catboost/xgboost/prophet — those
tests just log warnings and use what's available, they don't fail).

### Run one phase at a time (recommended the first time, so failures are easy to trace)

```bash
# Phase 1 — schemas, synthetic data generator, feature pipeline
pytest tests/test_phase1_data.py -v

# Phase 2 — forecasting ensemble (LightGBM/CatBoost/XGBoost/Prophet)
pytest tests/test_phase2_forecasting.py -v

# Phase 3 — demand -> driver capacity conversion
pytest tests/test_phase3_workforce.py -v

# Phase 4 — hour-by-hour workforce simulation
pytest tests/test_phase4_simulation.py -v

# Phase 5 — MILP hiring optimizer
pytest tests/test_phase5_optimization.py -v

# Phase 6 — SHAP + LLM explanation layer + scenario runner
pytest tests/test_phase6_ai.py -v

# Phase 7 — full API integration (spins up the FastAPI app via TestClient)
pytest tests/test_phase7_api.py -v
```

### Useful flags
```bash
pytest -x              # stop at first failure
pytest -k "worked_example"   # run only tests matching a name
pytest --tb=short       # shorter failure output
pytest -q               # quiet summary only
```

### What each phase's tests actually prove
| Phase | Key assertions |
|---|---|
| 1 | Generator is deterministic per seed; schema rejects bad data; no NaNs in engineered features |
| 2 | Ensemble beats a naive lag-24 baseline on MAPE; weights combine correctly (40/30/20/10) |
| 3 | Worked example from the spec (Base=10, Productivity=0.82, Traffic=0.90, Route=0.75, Forecast=145 → 27 drivers) |
| 4 | Fully-staffed plan → zero late deliveries; understaffed plan → backlog grows hour over hour |
| 5 | 60/40 permanent/outsource mix respected; optimizer beats "hire to peak" naive baseline; infeasible input raises a typed error, not a silent null |
| 6 | LLM explanation guardrail rejects fabricated numbers; scenario runner gives identical output for a no-op override and different output for a real one |
| 7 | Full pipeline (forecast → driver-requirements → optimize → explain) works through real HTTP calls against the FastAPI app |

---

## 4. Running the API locally

```bash
uvicorn apps.api.main:app --reload
```
Then open **http://127.0.0.1:8000/docs** — FastAPI's auto-generated Swagger
UI, where you can try every endpoint by hand before wiring up a frontend.

By default `API_BEARER_TOKEN` is unset, so auth is **disabled** (local/dev
mode). To turn it on:
```bash
export API_BEARER_TOKEN=some-secret-token
uvicorn apps.api.main:app --reload
```
and pass `Authorization: Bearer some-secret-token` on every request.

### Quick manual smoke test with curl
```bash
curl http://127.0.0.1:8000/healthz
curl http://127.0.0.1:8000/v1/stores
curl -X POST http://127.0.0.1:8000/v1/forecast \
  -H "Content-Type: application/json" \
  -d '{"store_id": "STORE_001", "horizon_hours": 24}'
curl "http://127.0.0.1:8000/v1/stores/STORE_001/summary?horizon_hours=24"
```

---

## 5. Running via Docker

```bash
docker compose up --build
```
This starts the API (port 8000) + Postgres (port 5432). The API's
`DATABASE_URL` is already pointed at the `db` service in
`docker-compose.yml`. You still need to seed data (step 2, option B) once
the containers are up — either exec into the API container or add a
one-off seeding script/service if you want it automatic on boot.

---

## 6. UI/UX integration (when you're ready to build a frontend)

The backend is a plain REST API — **any** frontend stack works. Nothing
below requires backend changes; it's just how a UI consumes what's already
there.

### 6.1 Endpoint reference

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/v1/stores` | List all store IDs with data loaded |
| `POST` | `/v1/forecast` | Get an N-hour shipment forecast for one store |
| `POST` | `/v1/driver-requirements` | Convert forecasts → drivers needed per hour |
| `POST` | `/v1/simulate` | Run a staffing plan through the hour-by-hour simulator |
| `POST` | `/v1/optimize` | Get the cheapest hiring mix (permanent/temp/outsourced) |
| `POST` | `/v1/explain` | Get a structured + prose explanation for a hiring plan |
| `POST` | `/v1/scenarios` | Run a what-if (demand spike, no outsourcing, etc.) and diff vs. baseline |
| `GET`  | `/v1/stores/{id}/summary` | One call: forecast + driver requirements + hiring plan for a store |

Full request/response shapes are always visible live at `/docs` (or
`/openapi.json` if you want to generate a typed client — see 6.4).

### 6.2 A dashboard's typical call sequence

For a "Store Detail" page, the simplest approach is one call:
```
GET /v1/stores/{id}/summary?horizon_hours=72
```
This alone gives you enough to render a forecast chart, a driver-requirement
table, and the recommended hiring plan.

For a "What-if" panel (sliders for demand multiplier, toggle for
"outsourcing available"), call `/v1/scenarios` with the current forecasts
and the overridden `ScenarioRequest`, then diff the returned
`hiring_plan_delta` against the baseline you already have on screen.

For an "Explain this recommendation" button next to a hiring plan, call
`/v1/explain` with that plan plus the few extra numbers it wants
(`naive_baseline_cost`, `demand_change_pct`, etc. — all of which you'll
already have computed from earlier calls).

### 6.3 CORS

CORS middleware is already wired in `apps/api/main.py`, open (`*`) by
default so local frontend dev works out of the box. Before deploying
publicly, restrict it via an env var:
```bash
export CORS_ALLOW_ORIGINS="https://your-dashboard.example.com,http://localhost:3000"
```

### 6.4 Generating a typed client (optional, saves a lot of manual typing)

Since every request/response is a Pydantic model, the OpenAPI schema at
`/openapi.json` is fully typed. You can generate a TypeScript client
automatically instead of hand-writing `fetch` calls:

```bash
npx openapi-typescript http://127.0.0.1:8000/openapi.json -o frontend/src/api-types.ts
```
or a full client with `openapi-generator-cli` / `orval` if you want
generated hooks (e.g. React Query) instead of just types.

### 6.5 Auth from the frontend

If you turn on `API_BEARER_TOKEN`, every frontend request needs:
```js
fetch("http://localhost:8000/v1/stores", {
  headers: { Authorization: `Bearer ${TOKEN}` }
});
```
For a real deployment, swap the shared bearer token for per-user auth
(e.g. an auth provider issuing short-lived JWTs) — the current scheme is
explicitly the "don't over-engineer it yet" version called for in the
build prompt, not a production auth system.

### 6.6 Suggested frontend shape (not built — you're free to choose any stack)

- **Store picker** → `GET /v1/stores`
- **Forecast chart** (line chart, predicted shipments over the horizon) → `GET /v1/stores/{id}/summary`
- **Driver-requirement table** (hour, drivers needed, capacity used) → same summary call
- **Hiring plan card** (permanent/temp/outsourced counts, total cost) → same summary call
- **"Why?" panel** → `POST /v1/explain`
- **What-if sliders** (demand multiplier, outsourcing toggle) → `POST /v1/scenarios`, re-render deltas
- **Simulation view** (hour-by-hour backlog/utilization, once a plan is chosen) → `POST /v1/simulate`

None of this requires touching `packages/` or `apps/api/main.py` beyond the
CORS addition above — that's the entire point of keeping the backend a
clean, versioned REST API per the original build prompt's scope.

## alternative:

```
1. Install
pip install fastapi uvicorn pydantic pandas sqlalchemy ortools simpy lightgbm shap pytest httpx

2. Load sample data + run tests
pytest

3. Seed the database the API reads from
python -c "
from apps.api.db import init_db, upsert_records
from packages.analytics.schemas import ShipmentRecord
from scripts.generate_synthetic_data import generate
init_db()
upsert_records([ShipmentRecord(**r) for r in generate(n_stores=5, n_days=120, seed=42)])
"

4. Start the API
uvicorn apps.api.main:app --reload
```