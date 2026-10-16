import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../components/Text";
import BrandLogo from "../components/BrandLogo";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, formatAddress, radius, relativeTime, rupees, spacing, type } from "../theme";
import { Button, Card, EmptyState, IconTile, Loading, Notice, Pill, Stat } from "../components/ui";

// What the rider should do next, per status. The engine owns the transitions;
// this only decides the wording on the card.
const NEXT_ACTION = {
  ASSIGNED_TO_DELIVERY: { label: "Go to store", tone: "primary" },
  PICKED_UP: { label: "Start delivery", tone: "primary" },
  OUT_FOR_DELIVERY: { label: "Continue", tone: "primary" },
  ARRIVED: { label: "Hand over", tone: "primary" },
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
      {/* The customer app's home header: white, the logo, a soft green pill. */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <View style={styles.logoBox} accessibilityRole="image" accessibilityLabel="The Farmers Basket">
            <BrandLogo style={styles.logo} />
          </View>
          <View style={styles.shiftPill}>
            <Ionicons name="bicycle-outline" size={17} color={colors.primary} />
            <Text style={styles.shiftText}>On shift</Text>
          </View>
        </View>
        <View>
          <Text style={type.h1}>Hi, {user?.name?.split(" ")[0] || "there"}</Text>
          <Text style={type.small}>
            {orders.length
              ? `${orders.length} ${orders.length === 1 ? "delivery" : "deliveries"} in hand`
              : "Nothing assigned right now"}
          </Text>
        </View>
      </View>

      <View style={styles.statRow}>
        <Stat icon="clipboard-outline" label="Assigned today" value={stats?.assignedToday ?? 0} />
        <Stat icon="cube-outline" label="In hand" value={stats?.pending ?? 0} />
        <Stat icon="checkmark-done-outline" tone="success" label="Delivered today" value={stats?.deliveredToday ?? 0} />
      </View>

      {stats?.codCollected > 0 ? (
        <Notice tone="warn" icon="cash-outline" style={styles.cod}>
          Cash to hand in at the store: {rupees(stats.codCollected)}
        </Notice>
      ) : null}

      {error ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
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
            icon="bicycle-outline"
            title="No deliveries assigned"
            hint="When the store assigns you an order it will appear here. Pull down to refresh."
          />
        }
        renderItem={({ item }) => {
          const action = NEXT_ACTION[item.status] || { label: "Open", tone: "primary" };
          const atStore = item.status === "ASSIGNED_TO_DELIVERY";
          const target = atStore ? item.pickup?.address : item.delivery?.address;

          return (
            <Card
              style={styles.card}
              onPress={() => navigation.navigate("Delivery", { orderId: item.id })}
              accessibilityLabel={`Order ${item.code}, ${STAGE_LABEL[item.status] || item.status}`}
            >
              <View style={styles.cardHead}>
                <Text style={styles.code}>{item.code}</Text>
                <Pill tone={item.status === "ARRIVED" ? "success" : "primary"}>
                  {STAGE_LABEL[item.status] || item.status}
                </Pill>
              </View>

              {/* Where to go next — the store while it is unpicked, the
                  customer once it is in the bag. */}
              <View style={styles.legRow}>
<IconTile name={atStore ? "storefront-outline" : "location-outline"} />
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
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  // The artwork carries a wide white margin; the box crops it (as the customer
  // app's header does).
  logoBox: { width: 104, height: 52, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  logo: { width: 104, height: 52, transform: [{ scale: 1.25 }] },
  shiftPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  shiftText: { fontSize: 13.5, fontWeight: "600", color: colors.primaryDark },

  statRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  cod: { marginHorizontal: spacing.lg, marginTop: spacing.md },

  card: { padding: spacing.md, gap: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  code: { ...type.h3, fontVariant: ["tabular-nums"] },

  legRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  legLabel: { ...type.tiny, textTransform: "uppercase", fontWeight: "600", letterSpacing: 0.5 },
  legName: { ...type.body, fontWeight: "600" },

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
