# Build status vs. AI_Workforce_Planning_Engine_BUILD_PROMPT.md

49/49 tests passing (lightgbm+shap installed for validation; catboost/xgboost/
prophet/mlflow are optional-at-import and degrade gracefully when absent —
exactly as models.py already handled).

All 7 phases now have working code + tests. See chat response for the
full gap analysis of what was missing from the original upload and what
was added to close it.

## Update: Wasel <-> backend event pipeline

`POST /v1/events` is now implemented on `apps/api`, closing the gap
`apps/web/README.md` used to flag as "phase 2, not built yet." Raw events
from the Wasel frontend are stored, and `order_placed` events roll up into
the hourly `ShipmentRecord` data the forecasting engine reads — no
frontend changes were needed since `events.js` was already POSTing to this
path. See `docs/TESTING_AND_INTEGRATION.md` §6.3 and
`tests/test_events_ingestion.py`.
