import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../components/Text";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { clockTime, colors, formatAddress, rupees, spacing, type } from "../theme";
import { Card, EmptyState, Loading, Notice, Pill } from "../components/ui";

export default function HistoryScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/orders/delivery/history", { days: 7, limit: 50 });
      setOrders(data.items);
      setError("");
    } catch (err) {
      // Keep what was on screen; "no deliveries" would be untrue.
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <Loading />;

  // Grouped by day, because "what did I do yesterday" is the actual question.
  const groups = [];
  for (const order of orders) {
    const day = new Date(order.delivery.deliveredAt).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
    let group = groups.find((g) => g.day === day);
    if (!group) {
      group = { day, orders: [], cash: 0 };
      groups.push(group);
    }
    group.orders.push(order);
    if (order.payment?.method === "cod") group.cash += order.pricing?.total || 0;
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
      data={groups}
      keyExtractor={(group) => group.day}
      ListHeaderComponent={error ? <Notice tone="error">{error}</Notice> : null}
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
      ListEmptyComponent={
        error ? null : <EmptyState
          icon="history"
          title="No completed deliveries"
          hint="Your last seven days of deliveries will show up here."
        />
      }
      renderItem={({ item: group }) => (
        <View style={{ gap: spacing.sm }}>
          <View style={styles.dayHead}>
            <Text style={type.h3}>{group.day}</Text>
            <Text style={type.small}>
              {group.orders.length} delivered
              {group.cash > 0 ? ` · ${rupees(group.cash)} cash` : ""}
            </Text>
          </View>

          {group.orders.map((order) => (
            <Card
              key={order.id}
              style={styles.card}
              onPress={() => navigation.navigate("RunDetail", { orderId: order.id })}
              accessibilityLabel={`Order ${order.code}, delivered at ${clockTime(order.delivery.deliveredAt)}`}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.cardHead}>
                  <Text style={styles.code}>{order.code}</Text>
                  <Text style={type.tiny}>{clockTime(order.delivery.deliveredAt)}</Text>
                </View>
                <Text style={type.small} numberOfLines={1}>
                  {formatAddress(order.delivery?.address)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={styles.amount}>{rupees(order.pricing?.total)}</Text>
                <Pill tone={order.payment?.method === "cod" ? "cash" : "success"}>
                  {order.payment?.method === "cod" ? "Cash" : "Prepaid"}
                </Pill>
              </View>
              {/* Opens the full details (RunDetailScreen). */}
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Card>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  dayHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  card: { padding: spacing.md, flexDirection: "row", gap: spacing.md, alignItems: "center" },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  code: { ...type.body, fontWeight: "600", fontVariant: ["tabular-nums"] },
  amount: { ...type.body, fontWeight: "600" },
});
