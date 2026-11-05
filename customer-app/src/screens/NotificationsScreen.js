import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Text } from "../components/AppText";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, type } from "../theme";
import { Button, EmptyState, Loading, Notice } from "../components/ui";

const ago = (value) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

// Everything the shop has told this customer: order updates, delivery times,
// offers. Tapping one opens the order it is about.
export default function NotificationsScreen({ navigation }) {
  const { signedIn } = useAuth();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!signedIn) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get("/notifications", { limit: 50 });
      setItems(data.items || []);
      setUnread(data.unread || 0);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signedIn]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function markAll() {
    try {
      await api.post("/notifications/read", {});
      setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
      setUnread(0);
    } catch (err) {
      setError(err.message);
    }
  }

  async function open(item) {
    if (!item.readAt) {
      api.post("/notifications/read", { id: item.id }).catch(() => {});
      setItems((list) => list.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnread((n) => Math.max(0, n - 1));
    }
    const orderId = item.order || (item.deeplink || "").replace(/^order:/, "");
    if (orderId && /^[a-f0-9]{24}$/i.test(String(orderId))) navigation.navigate("OrderTrack", { orderId: String(orderId) });
  }

  if (!signedIn) {
    return (
      <EmptyState
        title="Sign in to see your notifications"
        action={<Button title="Sign in" onPress={() => navigation.navigate("Login")} />}
      />
    );
  }
  if (loading) return <Loading />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
      data={items}
      keyExtractor={(item) => String(item.id)}
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
      ListHeaderComponent={
        <View>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {unread > 0 ? (
            <View style={styles.headRow}>
              <Text style={type.small}>{unread} unread</Text>
              <Button title="Mark all as read" size="sm" variant="outline" onPress={markAll} />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={<EmptyState title="No notifications yet" hint="Order updates and delivery times will show up here." />}
      renderItem={({ item }) => (
        <Pressable style={[styles.card, !item.readAt && styles.cardUnread]} onPress={() => open(item)}>
          <View style={[styles.dot, !item.readAt && styles.dotOn]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={type.tiny}>
              {ago(item.createdAt)}
              {item.orderCode ? ` · ${item.orderCode}` : ""}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  card: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6, backgroundColor: "transparent" },
  dotOn: { backgroundColor: colors.primary },
  title: { ...type.h3, marginBottom: 2 },
  body: { ...type.body, color: colors.textMuted, marginBottom: 4 },
});
