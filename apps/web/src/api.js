// Thin fetch wrapper for the planning endpoints (/v1/stores, /v1/stores/{id}/summary, ...).
//
// Defaults to same-origin ("") because in the normal deployment path
// (npm run build -> served by apps/api/main.py's StaticFiles mount) the
// frontend and API share one origin, so relative paths just work.
//
// If you're running the Vite dev server separately (npm run dev, port
// 5174) against a backend on a different host/port, set
// VITE_EVENTS_API_BASE_URL in apps/web/.env (same var events.js already
// uses) and this will pick it up too.
const API_BASE = import.meta.env.VITE_EVENTS_API_BASE_URL_ABSOLUTE
  ? import.meta.env.VITE_EVENTS_API_BASE_URL
  : import.meta.env.DEV
    ? import.meta.env.VITE_EVENTS_API_BASE_URL || "http://localhost:8000"
    : "";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = body.message || body.detail || detail;
    } catch {
      /* body wasn't JSON, keep default detail */
    }
    throw new Error(detail);
  }
  return res.json();
}

export function getStores() {
  return request("/v1/stores");
}

export function getStoreSummary(storeId, horizonHours = 24) {
  return request(`/v1/stores/${encodeURIComponent(storeId)}/summary?horizon_hours=${horizonHours}`);
}

export function runForecast(storeId, horizonHours = 24) {
  return request("/v1/forecast", {
    method: "POST",
    body: JSON.stringify({ store_id: storeId, horizon_hours: horizonHours }),
  });
}

export function runDriverRequirements(forecasts, storeConfig) {
  return request("/v1/driver-requirements", {
    method: "POST",
    body: JSON.stringify({ forecasts, store_config: storeConfig }),
  });
}

export function runOptimize(driverRequirements) {
  return request("/v1/optimize", {
    method: "POST",
    body: JSON.stringify({ driver_requirements: driverRequirements }),
  });
}

// Rolls up the four brief-level metrics (forecast accuracy, staffing
// efficiency, service reliability, cost per shipment) for one store, all
// computed server-side from the same functions the calls above use.
export function getStoreScorecard(storeId, horizonHours = 72) {
  return request(`/v1/stores/${encodeURIComponent(storeId)}/scorecard?horizon_hours=${horizonHours}`);
}
