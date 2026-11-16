import React, { useCallback, useState } from "react";
import { FlatList, Image, RefreshControl, StyleSheet, View } from "react-native";
import { Text } from "../components/AppText";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { CLOSED_STATUSES, fullDate, orderInfoLine, orderStatusInfo } from "../lib/orderStatus";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, EmptyState, Loading } from "../components/ui";

const MAX_THUMBS = 4;

// Badge colours per status tone, matching the website's order list.
const TONES = {
  ok: { bg: colors.saveSoft, fg: colors.save },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  brand: { bg: colors.primarySoft, fg: colors.primaryDark },
};

function StatusBadge({ status }) {
  const { label, tone } = orderStatusInfo(status);
  const t = TONES[tone] || TONES.brand;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: t.fg }]} />
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

// One order, laid out like the website's card: id and date with the status,
// the item photos, count and total, one status line, then the actions.
function OrderCard({ order, onView, onBuyAgain }) {
  const items = order.items || [];
  const shown = items.slice(0, MAX_THUMBS);
  const more = items.length - shown.length;
  const delivered = order.status === "DELIVERED";
  const open = !CLOSED_STATUSES.includes(order.status);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function buyAgain() {
    setBusy(true);
    setNote("");
    const added = await onBuyAgain(items);
    setBusy(false);
    if (!added) setNote("These items aren't available right now.");
  }

  return (
    <Card style={styles.card} onPress={onView}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.code} numberOfLines={1}>{order.code}</Text>
          <Text style={styles.date}>{fullDate(order.placedAt)}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <View style={styles.thumbs}>
        {shown.map((item, index) => (
          <View key={item.id || item.sku || index} style={styles.thumb}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.thumbImage} resizeMode="contain" />
            ) : (
              <Text style={styles.thumbLetter}>{(item.name || "?").charAt(0).toUpperCase()}</Text>
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
        <Text style={styles.count}>
          {items.length} item{items.length === 1 ? "" : "s"}
        </Text>
        <Text style={styles.total}>{rupees(order.pricing?.total)}</Text>
      </View>
      <Text style={[styles.info, open && styles.infoOpen]}>{orderInfoLine(order)}</Text>

      <View style={styles.actions}>
        <Button title={open ? "Track Order" : "View Order"} onPress={onView} size="sm" style={styles.actionBtn} />
        {delivered ? (
          <Button title="Buy Again" variant="outline" size="sm" onPress={buyAgain} loading={busy} style={styles.actionBtn} />
        ) : null}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </Card>
  );
}

export default function OrdersScreen({ navigation }) {
  const { signedIn } = useAuth();
  const cart = useCart();

  // Buy Again puts the same lines back through the cart's own add (stock and
  // price checks as usual), skips anything no longer available, then opens
  // the cart. Returns how many lines went in.
  const buyAgain = useCallback(
    async (items) => {
      let added = 0;
      for (const item of items) {
        try {
          await cart.add(item.variant, item.quantity);
          added += 1;
        } catch {
          // out of stock or no longer sold: carry on with the rest
        }
      }
      if (added) navigation.navigate("CartTab");
      return added;
    },
    [cart, navigation]
  );
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }
    api
      .get("/orders/mine", { limit: 30 })
      .then((data) => setOrders(data.items))
      .catch(() => setOrders([]))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [signedIn]);

  // Refetch on focus: an order's status changes while the app sits in the
  // background, and a stale "Packing" is the first thing someone checks.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!signedIn) {
    return (
      <EmptyState
        title="Sign in to see your orders"
        hint="Your order history and live tracking live here."
        action={<Button title="Sign in" onPress={() => navigation.navigate("Login")} />}
      />
    );
  }

  if (loading) return <Loading />;

  if (!orders.length) {
    return (
      <EmptyState
        title="No orders yet"
        hint="When you place an order it will appear here with live tracking."
        action={<Button title="Start shopping" onPress={() => navigation.navigate("HomeTab")} />}
      />
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      data={orders}
      keyExtractor={(item) => item.id}
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
      ListHeaderComponent={
        <Text style={styles.listCount}>
          {orders.length} order{orders.length === 1 ? "" : "s"}
        </Text>
      }
      renderItem={({ item }) => (
        <OrderCard
          order={item}
          onView={() => navigation.navigate("OrderTrack", { orderId: item.id })}
          onBuyAgain={buyAgain}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  listCount: { ...type.small, color: colors.textMuted, marginBottom: -4 },
  card: { padding: spacing.lg, gap: spacing.md },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  code: { fontSize: 16, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  date: { ...type.small, color: colors.textFaint, marginTop: 2 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  thumbs: { flexDirection: "row", gap: spacing.sm },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: { width: "86%", height: "86%" },
  thumbLetter: { fontSize: 20, fontWeight: "800", color: colors.textFaint },
  thumbMore: { backgroundColor: colors.surfaceAlt },
  thumbMoreText: { fontSize: 13, fontWeight: "800", color: colors.textMuted },
  sum: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { ...type.small, color: colors.textMuted },
  total: { fontSize: 18, fontWeight: "800", color: colors.text },
  info: { ...type.small, color: colors.textMuted, marginTop: -4 },
  infoOpen: { color: colors.primaryDark, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionBtn: { flex: 1 },
  note: { ...type.tiny, color: colors.danger },
});
