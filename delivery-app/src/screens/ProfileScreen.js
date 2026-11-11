import React, { useCallback, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, Divider, Loading, Notice, Pill } from "../components/ui";

export default function ProfileScreen() {
  const { user, signOut, notificationStatus, notificationError, enableNotifications } = useAuth();
  const [stats, setStats] = useState(null);
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testingNotifications, setTestingNotifications] = useState(false);

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
    } catch {
      setStats(null);
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

  const initials = (user?.name || "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function sendTestNotification() {
    setTestingNotifications(true);
    try {
      const { result } = await api.post("/notifications/test-push", {});
      if (result.status === "sent") {
        Alert.alert(
          "Test notification sent",
          "Check the notification shade. If it is not visible, check Android notification settings and Do Not Disturb."
        );
      } else {
        Alert.alert(
          "Test notification was not delivered",
          result.reason || result.error || "Check notification permission and device registration."
        );
      }
    } catch (error) {
      Alert.alert("Could not send test notification", error.message);
    } finally {
      setTestingNotifications(false);
    }
  }

  const notificationReady = notificationStatus === "registered";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.h2}>{user?.name}</Text>
          <Text style={type.small}>+91 {user?.phone}</Text>
        </View>
        <Pill tone={user?.status === "active" ? "success" : "warn"}>{user?.status}</Pill>
      </Card>

      <Card style={{ padding: spacing.md }}>
        <Text style={type.h3}>Notifications</Text>
        <Text style={[type.small, { marginTop: spacing.xs }]}>
          {notificationStatus === "registered"
            ? "Push alerts are registered on this device."
            : notificationStatus === "channel-disabled"
              ? "Notifications are blocked for this app in Android settings."
              : notificationStatus === "permission-denied"
                ? "Notification permission is off. Allow it to receive delivery alerts."
                : notificationStatus === "unsupported"
                  ? "Push notifications need the installed Android or iOS app."
                  : notificationStatus === "error"
                    ? notificationError || "This device could not register for push alerts."
                    : "Enable push alerts to hear when a delivery is assigned."}
        </Text>
        {!notificationReady ? (
          <Button
            title="Enable notifications"
            style={{ marginTop: spacing.md }}
            onPress={async () => {
              try {
                const result = await enableNotifications();
                if (result.status === "permission-denied") {
                  Alert.alert("Notifications are blocked", "Allow notifications for Hosur Basket Partner in your phone settings.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Open settings", onPress: () => Linking.openSettings() },
                  ]);
                } else if (result.status === "registered" && result.channelEnabled === false) {
                  Alert.alert("Turn on delivery alerts", "Enable the Delivery assignments notification channel in Android notification settings.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Open settings", onPress: () => Linking.openSettings() },
                  ]);
                } else if (result.status === "registered") {
                  Alert.alert("Notifications enabled", "This device is registered for delivery alerts.");
                }
              } catch (error) {
                Alert.alert("Could not enable notifications", error.message);
              }
            }}
          />
        ) : (
          <Button
            title="Send test notification"
            style={{ marginTop: spacing.md }}
            loading={testingNotifications}
            onPress={sendTestNotification}
          />
        )}
      </Card>

      {/* Today */}
      <Card style={{ padding: spacing.md }}>
        <Text style={type.h3}>Today</Text>
        <View style={{ marginTop: spacing.sm, gap: 8 }}>
          <Row label="Deliveries completed" value={stats?.deliveredToday ?? 0} />
          <Row label="Still in hand" value={stats?.pending ?? 0} />
          <Divider style={{ marginVertical: 4 }} />
          <Row label="Earnings" value={rupees(stats?.earnings)} strong />
          <Row label="Cash collected" value={rupees(stats?.codCollected)} tone="cash" />
        </View>

        {stats?.codCollected > 0 ? (
          <Notice tone="warn" style={{ marginTop: spacing.md }}>
            You are holding {rupees(stats.codCollected)} in cash to deposit at the store.
          </Notice>
        ) : null}
      </Card>

      {/* Last 7 days */}
      <Card style={{ padding: spacing.md }}>
        <Text style={type.h3}>Last 7 days</Text>
        <View style={{ marginTop: spacing.sm, gap: 8 }}>
          <Row label="Deliveries" value={week?.count ?? 0} />
          <Row label="Order value handled" value={rupees(week?.value)} />
          <Row label="Cash handled" value={rupees(week?.cash)} tone="cash" />
        </View>
        <Text style={[type.tiny, { marginTop: spacing.md }]}>
          Earnings are your store's per-delivery rate × completed deliveries. Nothing here is
          estimated.
        </Text>
      </Card>

      <Button
        title="Sign out"
        variant="danger"
        onPress={() =>
          Alert.alert("Sign out?", "You'll need your OTP to sign back in.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: signOut },
          ])
        }
      />

      <Text style={[type.tiny, { textAlign: "center", marginTop: spacing.sm }]}>
        Hosur Basket Partner · v0.1.0
      </Text>
    </ScrollView>
  );
}

function Row({ label, value, strong, tone }) {
  return (
    <View style={styles.row}>
      <Text style={[type.small, strong && { color: colors.text, fontWeight: "700" }]}>{label}</Text>
      <Text
        style={[
          type.body,
          { fontWeight: strong ? "800" : "700" },
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
  avatarText: { color: colors.primaryDark, fontWeight: "800", fontSize: 18 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
