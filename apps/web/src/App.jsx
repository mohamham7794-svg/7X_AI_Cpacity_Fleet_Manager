import React, { useEffect, useMemo, useState } from "react";
import { color, font, useWaselFonts } from "./theme.jsx";
import { trackEvent, getEventFeed } from "./events.js";
import { findStore } from "./data/stores.js";

import Header from "./components/Header.jsx";
import Hero from "./components/Hero.jsx";
import StoreList from "./components/StoreList.jsx";
import StoreDetail from "./components/StoreDetail.jsx";
import CartDrawer from "./components/CartDrawer.jsx";
import Checkout from "./components/Checkout.jsx";
import OrderTracking, { assignCourier } from "./components/OrderTracking.jsx";
import EventFeed from "./components/EventFeed.jsx";
import OpsDashboard from "./components/OpsDashboard.jsx";
import OpsTransition from "./components/OpsTransition.jsx";
import OffersPromo from "./components/OffersPromo.jsx";
import FleetSetup from "./components/FleetSetup.jsx";
import MetricsHub from "./components/scorecard/MetricsHub.jsx";
import DemandAccuracyPage from "./components/scorecard/DemandAccuracyPage.jsx";
import StaffingEfficiencyPage from "./components/scorecard/StaffingEfficiencyPage.jsx";
import ServiceReliabilityPage from "./components/scorecard/ServiceReliabilityPage.jsx";
import CostEfficiencyPage from "./components/scorecard/CostEfficiencyPage.jsx";

let orderSeq = 8420;

export default function App() {
  useWaselFonts();

  const [view, setView] = useState("home"); // home | store | checkout | tracking | ops-intro | ops | offers | fleet
  const [hasSeenOpsIntro, setHasSeenOpsIntro] = useState(false);
  const [activeStoreId, setActiveStoreId] = useState(null);
  const [cart, setCart] = useState({}); // { storeId, items: { [itemId]: qty } }
  const [cartOpen, setCartOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [order, setOrder] = useState(null);
  const [eventCount, setEventCount] = useState(getEventFeed().length);

  // Track every screen change as a page_view — this is the "connected to
  // all the landing pages" wiring: nothing renders without an event firing.
  useEffect(() => {
    trackEvent("page_view", { view, store_id: activeStoreId || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    const unsub = window.setInterval(() => setEventCount(getEventFeed().length), 400);
    return () => window.clearInterval(unsub);
  }, []);

  const store = activeStoreId ? findStore(activeStoreId) : null;

  const cartLines = useMemo(() => {
    if (!store || !cart.items) return [];
    return Object.entries(cart.items)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ item: store.menu.find((m) => m.id === itemId), qty }))
      .filter((l) => l.item);
  }, [cart, store]);

  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);

  function selectStore(storeId) {
    trackEvent("store_viewed", { store_id: storeId });
    setActiveStoreId(storeId);
    // Switching stores mid-cart resets it — one order, one store, like the real thing.
    if (cart.storeId && cart.storeId !== storeId) setCart({});
    setView("store");
  }

  function addItem(storeForItem, item) {
    trackEvent("item_added", { store_id: storeForItem.store_id, item_id: item.id, item_name: item.name, price: item.price });
    setCart((prev) => {
      const items = prev.storeId === storeForItem.store_id ? { ...prev.items } : {};
      items[item.id] = (items[item.id] || 0) + 1;
      return { storeId: storeForItem.store_id, items };
    });
  }

  function incItem(item) {
    trackEvent("item_added", { store_id: cart.storeId, item_id: item.id, item_name: item.name, price: item.price });
    setCart((prev) => ({ ...prev, items: { ...prev.items, [item.id]: (prev.items[item.id] || 0) + 1 } }));
  }

  function decItem(item) {
    trackEvent("item_removed", { store_id: cart.storeId, item_id: item.id, item_name: item.name });
    setCart((prev) => {
      const next = Math.max(0, (prev.items[item.id] || 0) - 1);
      return { ...prev, items: { ...prev.items, [item.id]: next } };
    });
  }

  function goToCheckout() {
    trackEvent("checkout_started", { store_id: activeStoreId, item_count: cartCount });
    setCartOpen(false);
    setView("checkout");
  }

  function placeOrder({ area, payment, subtotal, deliveryFee, total }) {
    const orderId = `WSL-${orderSeq++}`;
    const courier = assignCourier();
    const newOrder = { id: orderId, store, lines: cartLines, area, payment, subtotal, deliveryFee, total, courier };

    trackEvent("order_placed", {
      order_id: orderId,
      store_id: store.store_id,
      area,
      payment,
      item_count: cartCount,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      items: cartLines.map((l) => ({ item_id: l.item.id, qty: l.qty, price: l.item.price })),
    });

    setOrder(newOrder);
    setCart({});
    setView("tracking");
  }

  function onStageChange(stage) {
    trackEvent("order_status_changed", { order_id: order?.id, store_id: order?.store.store_id, status: stage });
  }

  function backToHome() {
    setView("home");
    setActiveStoreId(null);
  }

  function goToOps() {
    if (hasSeenOpsIntro) {
      trackEvent("ops_dashboard_viewed", {});
      setView("ops");
    } else {
      trackEvent("ops_intro_viewed", {});
      setView("ops-intro");
    }
  }

  function enterOpsFromIntro() {
    setHasSeenOpsIntro(true);
    trackEvent("ops_dashboard_viewed", {});
    setView("ops");
  }

  function goToOffers() {
    trackEvent("offers_page_viewed", {});
    setView("offers");
  }

  function goToFleet() {
    trackEvent("fleet_setup_viewed", {});
    setView("fleet");
  }

  function goToScorecard() {
    trackEvent("scorecard_viewed", { page: "scorecard-hub" });
    setView("scorecard-hub");
  }

  function navigateScorecard(subview) {
    trackEvent("scorecard_viewed", { page: subview });
    setView(subview);
  }

  return (
    <div style={{ minHeight: "100vh", background: color.paper, fontFamily: font.body, color: color.ink }}>
      <Header
        cartCount={cartCount}
        onCartClick={() => setCartOpen(true)}
        onLogoClick={backToHome}
        eventCount={eventCount}
        onFeedClick={() => setFeedOpen(true)}
        view={view}
        onOpsClick={goToOps}
        onHomeClick={backToHome}
        onOffersClick={goToOffers}
        onFleetClick={goToFleet}
        onScorecardClick={goToScorecard}
      />

      {view === "ops-intro" && <OpsTransition onContinue={enterOpsFromIntro} />}
      {view === "ops" && <OpsDashboard />}
      {view === "offers" && <OffersPromo onSelectStore={selectStore} />}
      {view === "fleet" && <FleetSetup />}
      {view === "scorecard-hub" && <MetricsHub onNavigate={navigateScorecard} />}
      {view === "scorecard-accuracy" && <DemandAccuracyPage onNavigate={navigateScorecard} />}
      {view === "scorecard-staffing" && <StaffingEfficiencyPage onNavigate={navigateScorecard} />}
      {view === "scorecard-reliability" && <ServiceReliabilityPage onNavigate={navigateScorecard} />}
      {view === "scorecard-cost" && <CostEfficiencyPage onNavigate={navigateScorecard} />}

      {view === "home" && (
        <>
          <Hero />
          <StoreList onSelectStore={selectStore} />
        </>
      )}

      {view === "store" && store && (
        <StoreDetail
          storeId={activeStoreId}
          cart={cart.storeId === activeStoreId ? cart.items : {}}
          onAdd={addItem}
          onBack={backToHome}
          onGoToCheckout={goToCheckout}
        />
      )}

      {view === "checkout" && store && cartLines.length > 0 && (
        <Checkout store={store} lines={cartLines} onBack={() => setView("store")} onPlaceOrder={placeOrder} />
      )}

      {view === "tracking" && order && (
        <OrderTracking order={order} onStageChange={onStageChange} onNewOrder={backToHome} />
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={cartLines}
        onInc={incItem}
        onDec={decItem}
        onCheckout={goToCheckout}
      />

      <EventFeed open={feedOpen} onClose={() => setFeedOpen(false)} />

      <footer style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 24px 40px", textAlign: "center" }}>
        <span style={{ fontFamily: font.mono, fontSize: 11, color: color.muted }}>
          Wasel — a demo storefront generating live data for the workforce planning engine.
        </span>
      </footer>
    </div>
  );
}
