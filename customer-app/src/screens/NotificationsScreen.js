import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Switch, View } from "react-native";
import { Text } from "../components/Text";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, type } from "../theme";
import { Card, Divider, Loading, Notice } from "../components/ui";

const PREFS = [
  { key: "orders", label: "Order updates", hint: "Confirmation, delivery and refunds" },
  { key: "offers", label: "Offers and deals", hint: "Discounts and new arrivals" },
  { key: "whatsapp", label: "WhatsApp", hint: "Order updates on WhatsApp" },
  { key: "sms", label: "SMS", hint: "Text messages" },
];

export default function NotificationsScreen() {
  const { user, setUser } = useAuth();
  const [feed, setFeed] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const prefs = user?.notificationPrefs || {};

  const load = useCallback(async () => {
    try {
      const data = await api.get("/notifications", { limit: 50 });
      setFeed(data.items);
      setError("");
      // Opening the inbox reads it.
      if (data.unread > 0) api.post("/notifications/read", {}).catch(() => {});
    } catch (err) {
      setError(err.message);
      setFeed((current) => current || []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function toggle(key, value) {
    // Optimistic: flip now, put it back if the API says no.
    setUser((u) => ({ ...u, notificationPrefs: { ...u.notificationPrefs, [key]: value } }));
    try {
      await api.patch("/notifications/preferences", { [key]: value });
    } catch (err) {
      setUser((u) => ({ ...u, notificationPrefs: { ...u.notificationPrefs, [key]: !value } }));
      setError(err.message);
    }
  }

  if (feed === null) return <Loading />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      data={feed}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      ListHeaderComponent={
        <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Card style={{ paddingVertical: spacing.xs }}>
            {PREFS.map((pref, index) => (
              <View key={pref.key}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.prefRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prefLabel}>{pref.label}</Text>
                    <Text style={type.tiny}>{pref.hint}</Text>
                  </View>
                  <Switch
                    value={prefs[pref.key] !== false}
                    onValueChange={(value) => toggle(pref.key, value)}
                    trackColor={{ true: colors.primary }}
                    accessibilityLabel={pref.label}
                  />
                </View>
              </View>
            ))}
          </Card>
          <Text style={type.h3}>Inbox</Text>
        </View>
      }
      ListEmptyComponent={<Text style={[type.small, { textAlign: "center", marginTop: spacing.lg }]}>No notifications yet.</Text>}
      renderItem={({ item }) => (
        <View style={[styles.item, !item.readAt && styles.unread]}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          {item.body ? <Text style={type.small}>{item.body}</Text> : null}
          <Text style={type.tiny}>
            {new Date(item.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  prefRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, minHeight: 56 },
  prefLabel: { ...type.body, fontWeight: "600" },
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 3,
  },
  unread: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  itemTitle: { ...type.body, fontWeight: "700" },
});
