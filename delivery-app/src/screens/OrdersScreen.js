import React, { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import useQueue from "../hooks/useQueue";
import { colors, radius, spacing, type } from "../theme";
import { Card, Loading, Notice } from "../components/ui";
import { LiveRunCard, UpcomingRunCard } from "../components/RunCards";
import HistoryScreen from "./HistoryScreen";

// Every order the rider has, in two views: what is still to do, and what is done.
export default function OrdersScreen({ navigation }) {
  const [tab, setTab] = useState("active");

  return (
    <View style={styles.screen}>
      <View style={styles.segment}>
        {[
          ["active", "Active"],
          ["done", "Completed"],
        ].map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.segBtn, tab === key && styles.segBtnOn]}
          >
            <Text style={[styles.segText, tab === key && styles.segTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "active" ? <ActiveList navigation={navigation} /> : <HistoryScreen navigation={navigation} />}
    </View>
  );
}

function ActiveList({ navigation }) {
  const { orders, upcoming, loading, refreshing, error, refresh } = useQueue();
  if (loading) return <Loading />;

  const data = [
    ...orders.map((o) => ({ ...o, kind: "live" })),
    ...upcoming.map((o) => ({ ...o, kind: "upcoming" })),
  ];
  const open = (item) => navigation.navigate("Delivery", { orderId: item.id });

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      ListHeaderComponent={error ? <Notice tone="error">{error}</Notice> : null}
      ListEmptyComponent={
        <Card style={styles.empty}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={44} color={colors.primary} />
          <Text style={[type.h3, { marginTop: spacing.sm }]}>No active orders</Text>
          <Text style={[type.small, { textAlign: "center", marginTop: 4 }]}>
            Orders assigned to you will appear here. Pull down to refresh.
          </Text>
        </Card>
      }
      renderItem={({ item }) =>
        item.kind === "live" ? (
          <LiveRunCard item={item} onPress={() => open(item)} />
        ) : (
          <UpcomingRunCard item={item} onPress={() => open(item)} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  segment: {
    flexDirection: "row",
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
  },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.pill },
  segBtnOn: { backgroundColor: colors.primaryDark },
  segText: { fontWeight: "700", color: colors.textMuted, fontSize: 14.5 },
  segTextOn: { color: "#fff" },
  empty: { padding: spacing.xl, alignItems: "center" },
});
