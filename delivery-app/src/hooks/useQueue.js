import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";

// The rider's live runs, the orders still being prepared for them, and today's
// numbers. Refetches when the screen comes forward and every 10 s while open,
// so an order the admin assigns shows up without pulling to refresh.
export default function useQueue() {
  const [orders, setOrders] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/orders/delivery/queue");
      setOrders(data.orders);
      setUpcoming(data.upcoming || []);
      setStats(data.stats);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 10000);
      return () => clearInterval(timer);
    }, [load])
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return { orders, upcoming, stats, loading, refreshing, error, refresh };
}
