# Wasel — mock consumer delivery app

A fictional, Careem-style consumer delivery app ("wasel" — وصل, "it
arrived") used as the **data-generating front end** for the AI Workforce
Planning Engine. It's not connected to the backend yet — this is the UI
layer only, phase one of a three-part plan:

1. **This app** — landing page, store browse, cart, checkout, live order
   tracking. ✅ built
2. **Event pipeline** — a `POST /v1/events` endpoint on `apps/api` that
   receives what this app already sends (see below) and rolls raw events
   up into `ShipmentRecord`s the forecasting engine can consume. ✅ built
   — see `docs/TESTING_AND_INTEGRATION.md` §6.3 for how it works.
3. **Traffic simulator** — a bot that drives this app's interactions
   automatically so the ops console (`apps/web`) has continuous live data
   to react to, without someone clicking manually the whole time. Not
   built yet.

## Run

    npm install
    npm run dev

Opens on http://localhost:5173 by default — but since `apps/web` (the ops
console) already uses that port, run Wasel on **5174**:

    npm run dev -- --port 5174

## What's already wired for later

Every interaction — page view, store viewed, item added/removed, checkout
started, order placed, order status changed — flows through a single
function: `src/events.js#trackEvent()`. It:

- Keeps an in-memory live feed, rendered in the "N events" button in the
  header (opens a slide-over showing the raw stream as it happens).
- Sends a `POST {VITE_EVENTS_API_BASE_URL}/v1/events` with each event,
  wrapped in a silent catch (so a down/unreachable API never breaks the
  UI). `apps/api` now implements this endpoint — `order_placed` events
  roll up into the hourly shipment data the forecasting engine reads. No
  frontend code needed to change when the endpoint landed, as designed.

Event shape:
```json
{
  "event_id": "evt_...",
  "type": "order_placed",
  "timestamp": "2026-08-02T14:03:11.000Z",
  "session_id": "sess_...",
  "order_id": "WSL-8420",
  "store_id": "AUH-014",
  "items": [{ "item_id": "m1", "qty": 2, "price": 42 }],
  "total": 96.0
}
```

`store_id` values (`AUH-014`, `DXB-002`, `SHJ-007`, `AUH-021`, `AJM-003`)
are identical to the `STORES` list in `apps/web/src/App.jsx`, so an order
placed here and the driver-requirement/hiring-plan shown on the ops
console refer to the same store once they're connected.

## Pages (one integrated app, no split pages)

Everything lives in `App.jsx`'s single `view` state machine — there's one
URL/origin, one nav bar, no separate frontend/backend addresses to juggle:

| Nav item | `view` | Component |
|---|---|---|
| Storefront | `home` / `store` / `checkout` / `tracking` | `Hero`, `StoreList`, `StoreDetail`, `Checkout`, `OrderTracking` |
| Offers | `offers` | `OffersPromo.jsx` — brand directory + promo showcase |
| Fleet Setup | `fleet` | `FleetSetup.jsx` — routes, driver placement, subscription tier |
| **Forecasting & Hiring** (the access point into the backend) | `ops` | `OpsDashboard.jsx` — calls `/v1/forecast` → `/v1/driver-requirements` → `/v1/optimize` |

The "Forecasting & Hiring" button in the header is styled apart from the
storefront nav pills on purpose — it's the explicit, always-visible entry
point from the consumer-facing app into the planning backend.

## Real food photography

Store cards/detail headers use a real photo (`src/assets/icons/*.png`)
instead of an emoji wherever one was supplied — set via each store's
`image` field in `src/data/stores.js`. Stores without a matching photo
fall back to their emoji `icon` automatically (see `StoreList.jsx` /
`StoreDetail.jsx`). The same four images (burger, croissant, juice, grill)
are reused on the Offers page's promo showcase.

## What's mocked / not real

- No real payment, no real couriers — `assignCourier()` just picks a
  name from a fixed list, and `OrderTracking` advances through delivery
  stages on a timer (2.6s/stage) rather than reacting to anything real.
- No backend call happens on page load — all store/menu data is local
  (`src/data/stores.js`).
