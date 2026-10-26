import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../components/Text";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, ConfirmModal, Divider, IconTile, Loading, Notice, Pill } from "../components/ui";

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState(null);
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const load = useCallback(async () => {
    try {
      const [queue, history] = await Promise.all([
        api.get("/orders/delivery/queue"),
        api.get("/orders/delivery/history", { days: 7, limit: 100 }),
      ]);
      setStats(queue.stats);

      const delivered = history.items;
      setWeek({
        count: delivered.length,
        cash: delivered
          .filter((o) => o.payment?.method === "cod")
          .reduce((sum, o) => sum + (o.pricing?.total || 0), 0),
        value: delivered.reduce((sum, o) => sum + (o.pricing?.total || 0), 0),
      });
      setError("");
    } catch (err) {
      // The figures below would read as zero; say they could not load.
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <Loading />;

  // Words only: "Arun (Delivery)" is "AD", not "A(".
  const initials = (user?.name || "?")
    .split(/\s+/)
    .map((part) => part.replace(/^[^0-9A-Za-z\u0080-￿]+/, ""))
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {error ? <Notice tone="error">{`Couldn't load today's figures. ${error}`}</Notice> : null}
      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.h2}>{user?.name}</Text>
          <Text style={type.small}>+91 {user?.phone}</Text>
          <Text style={type.tiny}>{user?.roleLabel || "Delivery staff"} · The Farmers Basket</Text>
        </View>
        <Pill tone={user?.status === "active" ? "success" : "warn"}>{user?.status}</Pill>
      </Card>

      {/* Today */}
      <Card style={{ padding: spacing.md }}>
        <View style={styles.cardHead}>
          <IconTile name="today-outline" size={18} box={34} />
          <Text style={type.h3}>Today</Text>
        </View>
        <View style={{ marginTop: spacing.sm, gap: 8 }}>
          <Row label="Assigned to you" value={stats?.assignedToday ?? 0} />
          <Row label="Deliveries completed" value={stats?.deliveredToday ?? 0} strong />
          <Row label="Still in hand" value={stats?.pending ?? 0} />
          <Divider style={{ marginVertical: 4 }} />
          <Row label="Cash collected" value={rupees(stats?.codCollected)} tone="cash" />
        </View>

        {stats?.codCollected > 0 ? (
          <Notice tone="warn" icon="cash-outline" style={{ marginTop: spacing.md }}>
            You are holding {rupees(stats.codCollected)} in cash. Hand it in at the store.
          </Notice>
        ) : null}
      </Card>

      {/* Last 7 days */}
      <Card style={{ padding: spacing.md }}>
        <View style={styles.cardHead}>
          <IconTile name="calendar-outline" size={18} box={34} />
          <Text style={type.h3}>Last 7 days</Text>
        </View>
        <View style={{ marginTop: spacing.sm, gap: 8 }}>
          <Row label="Deliveries" value={week?.count ?? 0} />
          <Row label="Order value handled" value={rupees(week?.value)} />
          <Row label="Cash handled" value={rupees(week?.cash)} tone="cash" />
        </View>
      </Card>

      <Button
        title="Legal & account"
        icon="document-text-outline"
        variant="outline"
        onPress={() => navigation.navigate("About")}
      />

      <Button
        title="Sign out"
        icon="log-out-outline"
        variant="danger"
        onPress={() => setConfirmSignOut(true)}
      />

      <ConfirmModal
        visible={confirmSignOut}
        title="Sign out?"
        message="You'll need your OTP to sign back in."
        confirmText="Sign out"
        onConfirm={() => {
          setConfirmSignOut(false);
          signOut();
        }}
        onCancel={() => setConfirmSignOut(false)}
      />

      <Text style={[type.tiny, { textAlign: "center", marginTop: spacing.sm }]}>
        The Farmers Basket Delivery · v0.1.0
      </Text>
    </ScrollView>
  );
}

function Row({ label, value, strong, tone }) {
  return (
    <View style={styles.row}>
      <Text style={[type.small, strong && { color: colors.text, fontWeight: "600" }]}>{label}</Text>
      <Text
        style={[
          type.body,
          { fontWeight: strong ? "700" : "600" },
          strong && { fontSize: 18 },
          tone === "cash" && { color: colors.cash },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primaryDark, fontWeight: "700", fontSize: 18 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
