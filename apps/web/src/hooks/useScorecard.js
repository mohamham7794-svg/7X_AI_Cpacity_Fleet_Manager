import { useEffect, useState } from "react";
import { getStores, getStoreScorecard } from "../api.js";
import { STORES } from "../data/stores.js";

// Shared by all four brief-metric pages (Demand Accuracy, Staffing
// Efficiency, Service Reliability, Cost Efficiency) so each page fetches
// the exact same GET /v1/stores/{id}/scorecard payload the same way and
// only differs in how it renders it — one backend call, four dedicated
// views onto it.
export function useScorecard(defaultHorizon = 72) {
  const [availableStores, setAvailableStores] = useState([]);
  const [storesLoadError, setStoresLoadError] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [horizonHours, setHorizonHours] = useState(defaultHorizon);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRunAt, setLastRunAt] = useState(null);

  useEffect(() => {
    getStores()
      .then((ids) => setAvailableStores(ids.length ? ids : STORES.map((s) => s.store_id)))
      .catch((err) => {
        setStoresLoadError(err.message);
        setAvailableStores(STORES.map((s) => s.store_id));
      });
  }, []);

  useEffect(() => {
    if (!storeId && availableStores.length) setStoreId(availableStores[0]);
  }, [availableStores, storeId]);

  async function run() {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getStoreScorecard(storeId, horizonHours);
      setData(result);
      setLastRunAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return {
    availableStores,
    storesLoadError,
    storeId,
    setStoreId,
    horizonHours,
    setHorizonHours,
    data,
    loading,
    error,
    run,
    lastRunAt,
  };
}
