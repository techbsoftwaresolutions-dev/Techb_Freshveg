import React, { useCallback, useRef, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../components/Text";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { colors, radius, rupees, shadow, spacing, type } from "../theme";
import { Button, EmptyState, Loading } from "../components/ui";
import { useTabBarScroll, useTabBarSpace } from "../navigation/tabBarScroll";

const CLOSED = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];
const MAX_THUMBS = 4;

// How a status reads in a list — the website's grouping (lib/orderStatus.js):
// a shopper needs the stage, not one of twenty internal steps.
const GROUPS = [
  { label: "Delivered", tone: "ok", statuses: ["DELIVERED"] },
  { label: "Cancelled", tone: "danger", statuses: ["CANCELLED"] },
  { label: "Rejected", tone: "danger", statuses: ["REJECTED"] },
  { label: "Refunded", tone: "danger", statuses: ["REFUNDED"] },
  { label: "Pending", tone: "warn", statuses: ["ORDER_PLACED", "PAYMENT_PENDING"] },
  { label: "Processing", tone: "brand", statuses: ["ORDER_CONFIRMED", "ORDER_ACCEPTED", "PICKING", "PACKING", "READY_FOR_PICKUP"] },
  { label: "Out for delivery", tone: "brand", statuses: ["ASSIGNED_TO_DELIVERY", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"] },
];
const TONES = {
  ok: { bg: colors.saveSoft, fg: colors.save },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  brand: { bg: colors.primarySoft, fg: colors.primaryDark },
};

export function statusLook(status = "") {
  const group = GROUPS.find((g) => g.statuses.includes(status));
  const text = String(status).replace(/_/g, " ").toLowerCase();
  const label = group?.label || (text ? text[0].toUpperCase() + text.slice(1) : "Order");
  return { label, ...TONES[group?.tone || "brand"] };
}

const day = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

// The one line under the total: when it arrived, when it stopped, or when it is due.
function infoLine(order) {
  const reached = (status) => order.statusHistory?.find((h) => h.status === status)?.at;
  if (order.status === "DELIVERED") {
    const at = order.delivery?.deliveredAt || reached("DELIVERED");
    return at ? `Delivered on ${day(at)}` : "Delivered";
  }
  if (["CANCELLED", "REJECTED", "REFUNDED"].includes(order.status)) {
    const at = reached(order.status);
    return at ? `${statusLook(order.status).label} on ${day(at)}` : statusLook(order.status).label;
  }
  const due = order.delivery?.expectedBy;
  if (due) {
    const sameDay = new Date(due).toDateString() === new Date().toDateString();
    const clock = new Date(due).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
    return sameDay ? `Expected today by ${clock}` : `Expected ${new Date(due).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
  }
  return `Placed on ${day(order.placedAt)}`;
}

export default function OrdersScreen({ navigation }) {
  const scroll = useTabBarScroll();
  const { space } = useTabBarSpace();
  const { signedIn } = useAuth();
  const cart = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [next, setNext] = useState(null); // the next page to fetch, or null at the end
  const [buying, setBuying] = useState(null); // the order id being re-added
  const [note, setNote] = useState({});
  const fetching = useRef(false);

  const load = useCallback(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }
    api
      .get("/orders/mine", { limit: 20 })
      .then((data) => {
        setOrders(data.items);
        setNext(data.meta?.hasNext ? 2 : null);
      })
      .catch(() => setOrders([]))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [signedIn]);

  // Older orders, a page at a time, as the list nears its end.
  const loadMore = useCallback(() => {
    if (!next || fetching.current) return;
    fetching.current = true;
    api
      .get("/orders/mine", { limit: 20, page: next })
      .then((data) => {
        setOrders((current) => [...current, ...data.items.filter((o) => !current.some((c) => c.id === o.id))]);
        setNext(data.meta?.hasNext ? next + 1 : null);
      })
      .catch(() => {})
      .finally(() => {
        fetching.current = false;
      });
  }, [next]);

  // Refetch on focus: an order's status changes while the app sits in the
  // background, and a stale "Packing" is the first thing someone checks.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Buy Again, as on the website: the same lines go back through the cart's
  // own add, so stock limits, steps and today's prices all apply; lines that
  // can't be added right now are skipped.
  async function buyAgain(order) {
    setBuying(order.id);
    setNote((n) => ({ ...n, [order.id]: "" }));
    let added = 0;
    for (const item of order.items) {
      try {
        await cart.add(item.variant, item.quantity);
        added += 1;
      } catch {
        // out of stock or no longer sold — carry on with the rest
      }
    }
    setBuying(null);
    if (added) navigation.navigate("CartTab");
    else setNote((n) => ({ ...n, [order.id]: "These items aren't available right now." }));
  }

  if (!signedIn) {
    return (
      <EmptyState
        icon="orders"
        title="Sign in to see your orders"
        hint="Your order history and live tracking live here."
        action={<Button title="Sign in" onPress={() => navigation.navigate("Login")} style={{ minWidth: 180 }} />}
      />
    );
  }

  if (loading) return <Loading />;

  if (!orders.length) {
    return (
      <EmptyState
        icon="orders"
        title="No orders yet"
        hint="When you place an order it will appear here with live tracking."
        action={<Button title="Start shopping" onPress={() => navigation.navigate("HomeTab")} style={{ minWidth: 180 }} />}
      />
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.lg + space, gap: spacing.md }}
      {...scroll}
      data={orders}
      keyExtractor={(item) => item.id}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <Text style={type.small}>
          {orders.length}
          {next ? "+" : ""} order{orders.length === 1 && !next ? "" : "s"}
        </Text>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.primary}
        />
      }
      renderItem={({ item }) => {
        const look = statusLook(item.status);
        const shown = item.items.slice(0, MAX_THUMBS);
        const more = item.items.length - shown.length;
        const open = () => navigation.navigate("OrderTrack", { orderId: item.id });
        return (
          <View style={[styles.card, !CLOSED.includes(item.status) && styles.cardOpen]}>
            <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Order ${item.code}, ${look.label}`}>
              <View style={styles.top}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.code} numberOfLines={1}>
                    {item.code}
                  </Text>
                  <Text style={type.tiny}>{day(item.placedAt)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: look.bg }]}>
                  <Text style={[styles.badgeText, { color: look.fg }]}>{look.label}</Text>
                </View>
              </View>

              <View style={styles.thumbs}>
                {shown.map((line, index) => (
                  <View key={line.id || line.sku || index} style={styles.thumb}>
                    {line.image ? (
                      <Image source={{ uri: line.image }} style={styles.thumbImage} />
                    ) : (
                      <Text style={styles.thumbLetter}>{line.name?.[0]}</Text>
                    )}
                  </View>
                ))}
                {more > 0 ? (
                  <View style={[styles.thumb, styles.thumbMore]}>
                    <Text style={styles.thumbMoreText}>+{more}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.sum}>
                <Text style={type.small}>
                  {item.items.length} item{item.items.length === 1 ? "" : "s"}
                </Text>
                <Text style={styles.total}>{rupees(item.pricing?.total)}</Text>
              </View>
              <Text style={styles.info}>{infoLine(item)}</Text>
            </Pressable>

            <View style={styles.actions}>
              <Button title="View Order" size="sm" onPress={open} style={{ flex: 1 }} />
              {item.status === "DELIVERED" ? (
                <Button
                  title="Buy Again"
                  size="sm"
                  variant="outline"
                  loading={buying === item.id}
                  onPress={() => buyAgain(item)}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
            {note[item.id] ? <Text style={styles.note}>{note[item.id]}</Text> : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardOpen: { borderColor: colors.primarySoft },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  code: { fontSize: 15, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: "600" },

  thumbs: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImage: { width: "100%", height: "100%" },
  thumbLetter: { fontSize: 18, fontWeight: "600", color: colors.textMuted },
  thumbMore: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  thumbMoreText: { fontSize: 13, fontWeight: "700", color: colors.primaryDark },

  sum: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: spacing.md },
  total: { fontSize: 17, fontWeight: "700", color: colors.primaryDeep },
  info: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },

  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  note: { ...type.tiny, color: colors.warn, marginTop: spacing.sm },
});
