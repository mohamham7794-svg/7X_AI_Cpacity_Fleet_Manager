# AI Workforce Planning Engine

A decision pipeline that turns a demand forecast into a staffing and hiring
recommendation — built for the **Build With 7X — Intelligent Capacity
Planning** track.

> Demand moves every week. Driver numbers do not. This turns expected
> demand into the right drivers, in the right place, at the right time —
> and explains why, with numbers that trace back to real calculations.

---

## What this is NOT

This is deliberately **not** "one model that predicts a number." A single
ML model or a single LLM call can't do this job well — forecasting demand,
converting that into a staffing need, checking whether a plan actually
survives an hour-by-hour shift, and finding the cheapest valid mix are four
different kinds of problems. Each gets a purpose-built tool instead of one
model stretched to cover all of it.

---

## Architecture — the pipeline

```
  Forecast          Convert          Simulate           Optimize          Explain
 (ML ensemble)   (deterministic)  (discrete-event)   (MILP solver)   (SHAP + guardrailed LLM)
      │                │                 │                 │                  │
      ▼                ▼                 ▼                 ▼                  ▼
"How many         "How many         "Will this       "What's the       "Why is the system
 shipments         drivers does       staffing plan     cheapest valid    recommending
 next hour?"       that need?"        actually work?"   staffing mix?"    this?"
```

| Stage | Tool | Package |
|---|---|---|
| Demand forecast | LightGBM (40%) + CatBoost (30%) + XGBoost (20%) + Prophet (10%) ensemble | `packages/forecasting` |
| Demand → drivers | Deterministic capacity formula | `packages/workforce` |
| Plan validation | Discrete-event simulation (SimPy), hour by hour | `packages/simulation` |
| Hiring mix | Mixed-Integer Linear Program (OR-Tools CP-SAT) | `packages/optimization` |
| Reasoning | SHAP feature importances + guardrailed LLM narration | `packages/ai` |
| Public interface | Versioned REST API | `apps/api` |

Each package is independently testable and only talks to the others
through typed Pydantic contracts (`packages/analytics/schemas.py`) — the
optimizer never sees a forecast, only a driver-requirement number; the
simulator never sees the MILP internals, just a staffing plan.

---

## Deterministic vs. LLM — where AI actually makes decisions

This is a common judging question, so it's worth being explicit:

**Deterministic (no LLM involved) — this is where every actual decision is made:**
- Forecasting: trained gradient-boosted tree models + Prophet, not an LLM. Same input → same output.
- Capacity conversion: a fixed formula (`EffectiveCapacity = Base × Productivity × Traffic × Weather × Route`).
- Simulation: a deterministic hour-by-hour state machine.
- Hiring optimization: a MILP solver (CP-SAT) — given the same constraints, it returns the same (or an equally optimal) plan.
- SHAP feature importances: computed directly from the trained model, not generated text.

**LLM — used in exactly one place, and boxed in tightly:**
- `packages/ai/explain.py` is the only file that touches an LLM.
- The LLM **never computes a number.** Every number in an explanation (expected savings, confidence, etc.) comes from the deterministic pipeline above, not from the model.
- The LLM's only job is choosing/ordering which pre-written reason strings to include (e.g. *"Demand expected to increase 18%"* vs *"Utilization already at 94%"*) — it cannot author new sentences containing numbers of its own.
- A validation guardrail checks that every string and number in an explanation traces back to structured input. Anything that doesn't match is rejected and regenerated deterministically instead of surfaced to the user.
- If no LLM is configured (no `OPENAI_API_KEY` set), the system still works — it falls back to including all reasons in their original order.

**In one sentence: this is a deterministic decision engine with an
optional, guardrailed LLM narration layer on top — the LLM explains
decisions, it doesn't make them.**

---

## How this maps to the 7X brief

| Requirement from the brief | How it's satisfied |
|---|---|
| 60% permanent / 40% outsourced target mix | Hard constraint in the MILP objective (`ConstraintConfig.permanent_mix_target`, ±10pp tolerance), tested in `test_phase5_optimization.py` |
| Permanent hires take 45–60 days, outsourced 5–10 days | Modeled as separate lead-time risk premiums in the optimizer's objective function — makes "hire everything permanent" a genuinely worse plan, not just a constraint bolted on |
| Store-to-store productivity/route/traffic variance | Per-store configurable factors in the capacity formula — not a single network-wide number |
| Clear reasoning behind every recommendation | SHAP + guardrailed LLM explanation layer, numbers always traceable to structured output |
| Cut labor cost per shipment by AED 0.50 | `CostConfig` is fully parameterized (currency, hourly costs, understaffing penalty) — plug in real cost figures once the dataset unlocks and the optimizer minimizes against them directly |
| Reduce over/understaffed store-hours by 20% | Simulation tracks `bottleneck_hours`, `late_deliveries_total`, and `utilization` per hour — this is the number you'd compare before/after a recommended plan |
| 0 store closures, >95% on-time delivery | Simulation explicitly tracks `store_closures` and `on_time_rate` |

---

## Run it

```bash
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

# generate + load synthetic data (until the real dataset unlocks)
python scripts/generate_synthetic_data.py --stores 5 --days 120 --seed 42
python -c "
from apps.api.db import init_db, upsert_records
from packages.analytics.schemas import ShipmentRecord
from scripts.generate_synthetic_data import generate
init_db()
upsert_records([ShipmentRecord(**r) for r in generate(n_stores=5, n_days=120, seed=42)])
"

uvicorn apps.api.main:app --reload
```
Then open `http://127.0.0.1:8000/docs` for an interactive Swagger UI over
every endpoint.

## Test it

```bash
pytest
```
49 tests across all 7 phases — synthetic data generation, forecasting,
capacity conversion, simulation, optimization, explainability, and full
API integration. See `docs/TESTING_AND_INTEGRATION.md` for a phase-by-phase
breakdown of what each test proves.

## Run it with Docker

```bash
docker compose up --build
```
Starts the API + Postgres. See `docs/TESTING_AND_INTEGRATION.md` for
seeding data into the containerized DB.

---

## What's synthetic, what's real

All current data is synthetic and clearly labeled as such
(`scripts/generate_synthetic_data.py`, seeded/deterministic, no real
company names or figures). The pipeline's logic doesn't depend on the data
source — swapping in the real dataset (unlocked on event day) is a data-
loading change, not a logic change, since every module only depends on the
shared `ShipmentRecord`/`StoreConfig` schemas, not on how the data got
there.

## Out of scope for this build

Frontend/dashboard, per the track's backend-first scope — this exposes a
clean, versioned REST API (with CORS already enabled) so a frontend can be
wired up without any backend changes.