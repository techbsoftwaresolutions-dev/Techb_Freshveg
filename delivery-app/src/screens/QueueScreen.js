import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, formatAddress, radius, relativeTime, rupees, spacing, type } from "../theme";
import { Button, Card, EmptyState, Loading, Notice, Pill, Stat } from "../components/ui";

// What the rider should do next, per status. The engine owns the transitions;
// this only decides the wording on the card.
const NEXT_ACTION = {
  ASSIGNED_TO_DELIVERY: { label: "Go to store", tone: "primary" },
  PICKED_UP: { label: "Start delivery", tone: "primary" },
  OUT_FOR_DELIVERY: { label: "Continue", tone: "primary" },
  ARRIVED: { label: "Hand over", tone: "success" },
};

const STAGE_LABEL = {
  ASSIGNED_TO_DELIVERY: "Pick up from store",
  PICKED_UP: "Picked up",
  OUT_FOR_DELIVERY: "On the way",
  ARRIVED: "At the door",
};

export default function QueueScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/orders/delivery/queue");
      setOrders(data.orders);
      setStats(data.stats);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch every time the screen comes forward. A rider backgrounds this app
  // constantly, and a stale queue is the one thing that must not happen.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <Loading label="Loading your runs" />;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.greeting}>Hi, {user?.name?.split(" ")[0] || "partner"}</Text>
        <Text style={styles.headerSub}>
          {orders.length
            ? `${orders.length} ${orders.length === 1 ? "delivery" : "deliveries"} in hand`
            : "Nothing assigned right now"}
        </Text>

        <View style={styles.statRow}>
          <Stat label="Delivered today" value={stats?.deliveredToday ?? 0} tone="success" />
          <Stat label="In hand" value={stats?.pending ?? 0} tone="primary" />
          <Stat label="Earned today" value={rupees(stats?.earnings)} tone="cash" />
        </View>

        {stats?.codCollected > 0 ? (
          <View style={styles.codBar}>
            <Text style={styles.codText}>
              Cash to deposit: {rupees(stats.codCollected)}
            </Text>
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={{ padding: spacing.lg }}>
          <Notice tone="error">{error}</Notice>
        </View>
      ) : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
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
          <EmptyState
 icon=""
            title="No deliveries assigned"
            hint="When the store assigns you an order it will appear here. Pull down to refresh."
          />
        }
        renderItem={({ item }) => {
          const action = NEXT_ACTION[item.status] || { label: "Open", tone: "primary" };
          const atStore = item.status === "ASSIGNED_TO_DELIVERY";
          const target = atStore ? item.pickup?.address : item.delivery?.address;

          return (
            <Card style={styles.card} onPress={() => navigation.navigate("Delivery", { orderId: item.id })}>
              <View style={styles.cardHead}>
                <Text style={styles.code}>{item.code}</Text>
                <Pill tone={item.status === "ARRIVED" ? "success" : "primary"}>
                  {STAGE_LABEL[item.status] || item.status}
                </Pill>
              </View>

              {/* Where to go next — the store while it is unpicked, the
                  customer once it is in the bag. */}
              <View style={styles.legRow}>
<Text style={styles.legIcon}>{atStore ?"" :""}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.legLabel}>{atStore ? "Pick up from" : "Deliver to"}</Text>
                  <Text style={styles.legName} numberOfLines={1}>
                    {atStore ? item.pickup?.name || "Store" : item.delivery?.address?.contactName || "Customer"}
                  </Text>
                  <Text style={type.small} numberOfLines={2}>
                    {formatAddress(target)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFoot}>
                <View>
                  <Text style={type.tiny}>
                    {item.items?.length} item{item.items?.length === 1 ? "" : "s"} ·{" "}
                    {relativeTime(item.delivery?.assignedAt)}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                    {item.payment?.method === "cod" && item.payment?.status !== "paid" ? (
                      <Pill tone="cash">Collect {rupees(item.pricing?.total)}</Pill>
                    ) : (
                      <Pill tone="success">Prepaid</Pill>
                    )}
                  </View>
                </View>

                <Button
                  title={action.label}
                  style={{ paddingHorizontal: spacing.lg }}
                  onPress={() => navigation.navigate("Delivery", { orderId: item.id })}
                />
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  greeting: { color: "#fff", fontSize: 22, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 13.5, marginTop: 2, fontWeight: "600" },

  statRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },

  codBar: {
    marginTop: spacing.md,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  codText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  card: { padding: spacing.md, gap: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  code: { ...type.h3, fontVariant: ["tabular-nums"] },

  legRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  legIcon: { fontSize: 22 },
  legLabel: { ...type.tiny, textTransform: "uppercase", fontWeight: "800", letterSpacing: 0.5 },
  legName: { ...type.body, fontWeight: "700" },

  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
});
