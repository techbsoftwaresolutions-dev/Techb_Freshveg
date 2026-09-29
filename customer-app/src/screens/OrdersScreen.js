import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, EmptyState, Loading, Pill } from "../components/ui";

const OPEN_STATUSES = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];

function toneFor(status) {
  if (status === "DELIVERED") return "save";
  if (["CANCELLED", "REJECTED"].includes(status)) return "danger";
  if (status === "REFUNDED") return "warn";
  return "accent";
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
            <View style={styles.head}>
              <Text style={styles.code}>{item.code}</Text>
              <Pill tone={toneFor(item.status)}>{item.status.replace(/_/g, " ").toLowerCase()}</Pill>
            </View>

            <Text style={type.tiny}>
              {new Date(item.placedAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>

            <Text style={[type.small, { marginTop: spacing.sm }]} numberOfLines={2}>
              {item.items.map((line) => line.name).join(", ")}
            </Text>

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
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  code: { ...type.h3, fontVariant: ["tabular-nums"] },
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
