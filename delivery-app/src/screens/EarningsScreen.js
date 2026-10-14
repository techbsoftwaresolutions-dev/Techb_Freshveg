import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../api/client";
import { colors, rupees, spacing, type } from "../theme";
import { Card, Divider, Loading, Notice } from "../components/ui";

// Today's earnings, the cash the rider is holding for the store, and the last
// seven days. Everything comes from real delivered orders.
export default function EarningsScreen() {
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [queue, history] = await Promise.all([
        api.get("/orders/delivery/queue"),
        api.get("/orders/delivery/history", { days: 7, limit: 100 }),
      ]);
      setStats(queue.stats);

      const groups = [];
      for (const order of history.items) {
        const day = new Date(order.delivery.deliveredAt).toLocaleDateString("en-IN", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        });
        let group = groups.find((g) => g.day === day);
        if (!group) {
          group = { day, count: 0, value: 0, cash: 0 };
          groups.push(group);
        }
        group.count += 1;
        group.value += order.pricing?.total || 0;
        if (order.payment?.method === "cod") group.cash += order.pricing?.total || 0;
      }
      setDays(groups);
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
    }, [load])
  );

  if (loading) return <Loading />;

  const week = days.reduce(
    (sum, d) => ({ count: sum.count + d.count, value: sum.value + d.value, cash: sum.cash + d.cash }),
    { count: 0, value: 0, cash: 0 }
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
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
    >
      {error ? <Notice tone="error">{error}</Notice> : null}

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Earned today</Text>
        <Text style={styles.heroValue}>{rupees(stats?.earnings)}</Text>
        <Text style={styles.heroSub}>
          {stats?.deliveredToday ?? 0} deliver{stats?.deliveredToday === 1 ? "y" : "ies"} completed
        </Text>
      </View>

      <Card style={styles.cash}>
        <View style={styles.cashIcon}>
          <Ionicons name="wallet-outline" size={26} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.small}>Cash to deposit</Text>
          <Text style={styles.cashValue}>{rupees(stats?.codCollected)}</Text>
        </View>
      </Card>
      <Notice tone="info">
        Hand this cash to the store manager at the end of your shift. Cash on delivery orders you
        complete are added here automatically.
      </Notice>

      <Card style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={type.h3}>Last 7 days</Text>
        <View style={styles.weekRow}>
          <Week icon="truck-delivery-outline" label="Deliveries" value={week.count} />
          <Week icon="cash" label="Cash collected" value={rupees(week.cash)} />
          <Week icon="shopping-outline" label="Order value" value={rupees(week.value)} />
        </View>
      </Card>

      <Card style={{ padding: spacing.md }}>
        <Text style={type.h3}>Day by day</Text>
        {days.length === 0 ? (
          <Text style={[type.small, { marginTop: spacing.sm }]}>No completed deliveries yet.</Text>
        ) : (
          days.map((d, index) => (
            <View key={d.day}>
              {index > 0 ? <Divider style={{ marginVertical: spacing.sm }} /> : <View style={{ height: spacing.sm }} />}
              <View style={styles.dayRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.day}>{d.day}</Text>
                  <Text style={type.small}>
                    {d.count} delivered{d.cash > 0 ? ` · ${rupees(d.cash)} cash` : ""}
                  </Text>
                </View>
                <Text style={styles.dayValue}>{rupees(d.value)}</Text>
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function Week({ icon, label, value }) {
  return (
    <View style={styles.week}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.primaryDark} />
      <Text style={styles.weekValue} numberOfLines={1}>{value}</Text>
      <Text style={type.tiny}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primaryDark, borderRadius: 20, padding: spacing.lg },
  heroLabel: { color: "rgba(255,255,255,0.85)", fontWeight: "600", fontSize: 14 },
  heroValue: { color: "#fff", fontSize: 40, fontWeight: "800", marginTop: 2 },
  heroSub: { color: "rgba(255,255,255,0.85)", marginTop: 2, fontSize: 13.5 },

  cash: { padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  cashIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cashValue: { fontSize: 28, fontWeight: "800", color: colors.text },

  weekRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  week: { flex: 1, alignItems: "center", gap: 2, backgroundColor: colors.primarySoft, borderRadius: 14, padding: spacing.sm },
  weekValue: { fontSize: 17, fontWeight: "800", color: colors.text },

  dayRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  day: { ...type.body, fontWeight: "700" },
  dayValue: { ...type.body, fontWeight: "800" },
});
