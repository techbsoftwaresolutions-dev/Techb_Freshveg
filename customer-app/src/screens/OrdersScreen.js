import React, { useCallback, useState } from "react";
import { FlatList, Image, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, EmptyState, Loading } from "../components/ui";

const OPEN_STATUSES = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];

// Colour of the status line at the top of each order.
function statusColor(status) {
  if (status === "DELIVERED") return colors.save;
  if (["CANCELLED", "REJECTED"].includes(status)) return colors.danger;
  if (status === "REFUNDED") return colors.warn;
  return colors.accent;
}

// "ORDER_CONFIRMED" -> "Order confirmed"
function statusText(status) {
  const text = String(status || "").replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The order's picture: the first item's photo, with "+N" when there are more
// items behind it. Falls back to the product's first letter when a product has
// no photo, so the row never has a hole in it.
function OrderThumb({ items }) {
  const first = items[0] || {};
  const extra = items.length - 1;
  return (
    <View style={styles.thumb}>
      {first.image ? (
        <Image source={{ uri: first.image }} style={styles.thumbImage} resizeMode="contain" />
      ) : (
        <Text style={styles.thumbLetter}>{(first.name || "?").charAt(0).toUpperCase()}</Text>
      )}
      {extra > 0 ? (
        <View style={styles.thumbBadge}>
          <Text style={styles.thumbBadgeText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function OrdersScreen({ navigation }) {
  const { signedIn } = useAuth();
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
      renderItem={({ item }) => {
        const isOpen = !OPEN_STATUSES.includes(item.status);
        return (
          <Card style={{ padding: spacing.md }} onPress={() => navigation.navigate("OrderTrack", { orderId: item.id })}>
            <View style={styles.row}>
              <OrderThumb items={item.items || []} />

              <View style={{ flex: 1 }}>
                <Text style={[styles.status, { color: statusColor(item.status) }]} numberOfLines={1}>
                  {statusText(item.status)}
                </Text>
                <Text style={styles.code} numberOfLines={1}>
                  {item.code}
                </Text>
                <Text style={type.tiny}>
                  {new Date(item.placedAt).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={[type.small, { marginTop: 4 }]} numberOfLines={2}>
                  {(item.items || []).map((line) => line.name).join(", ")}
                </Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </View>

            <View style={styles.foot}>
              <Text style={styles.total}>{rupees(item.pricing?.total)}</Text>
              <Text style={styles.trackLink}>{isOpen ? "Track order" : "View details"}</Text>
            </View>
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: { width: "100%", height: "100%" },
  thumbLetter: { fontSize: 28, fontWeight: "800", color: colors.textFaint },
  thumbBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    minWidth: 24,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(20,23,31,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  status: { fontSize: 15, fontWeight: "800", marginBottom: 2 },
  code: { fontSize: 13, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  chevron: { fontSize: 28, color: colors.textFaint, marginLeft: -4 },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  total: { fontSize: 15, fontWeight: "800", color: colors.text },
  trackLink: { color: colors.primary, fontWeight: "700", fontSize: 13 },
});
