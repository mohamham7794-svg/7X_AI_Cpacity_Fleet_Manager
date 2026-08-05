// Every interaction in Wasel funnels through here. Today it just keeps an
// in-memory feed (rendered live in <EventFeed />) so you can *see* the data
// being generated. The moment a real ingestion endpoint exists
// (proposed: POST /v1/events on apps/api), this becomes the single place
// that needs to change — every call site already just calls trackEvent().
//
// Event shape is deliberately close to what apps/api would want to store,
// so a future rollup job can turn a stream of `order_placed` /
// `order_status_changed` events into ShipmentRecord-shaped hourly rows per
// store_id without re-deriving anything from the UI.

const API_BASE = import.meta.env.VITE_EVENTS_API_BASE_URL || "http://localhost:8000";
const SESSION_ID = `sess_${Math.random().toString(36).slice(2, 10)}`;

let seq = 0;
const feed = [];
const listeners = new Set();
const MAX_FEED = 250;

function notify() {
  for (const fn of listeners) fn(feed);
}

export function subscribeToEvents(fn) {
  listeners.add(fn);
  fn(feed);
  return () => listeners.delete(fn);
}

export function trackEvent(type, payload = {}) {
  const event = {
    event_id: `evt_${Date.now()}_${seq++}`,
    type,
    timestamp: new Date().toISOString(),
    session_id: SESSION_ID,
    ...payload,
  };

  feed.unshift(event);
  if (feed.length > MAX_FEED) feed.length = MAX_FEED;
  notify();

  // Best-effort send to a real backend. No endpoint exists yet on
  // apps/api, so this is expected to fail quietly (network error /
  // 404) until that lands — trackEvent() must never throw or block the UI.
  fetch(`${API_BASE}/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }).catch(() => {});

  return event;
}

export function getEventFeed() {
  return feed;
}
