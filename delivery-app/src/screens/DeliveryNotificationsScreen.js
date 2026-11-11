import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, radius, spacing, type } from "../theme";
import { EmptyState, Loading, Notice } from "../components/ui";

const ago = (value) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function DeliveryNotificationsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/notifications", { limit: 50 });
      setItems(data.items || []);
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

  async function open(item) {
    if (!item.readAt) {
      try {
        await api.post("/notifications/read", { id: item.id });
        setItems((list) => list.map((notification) =>
          notification.id === item.id
            ? { ...notification, readAt: new Date().toISOString() }
            : notification
        ));
      } catch (err) {
        setError(err.message);
        return;
      }
    }

    const orderId = item.order || item.data?.orderId;
    const actions = [{ text: "Close", style: "cancel" }];
    if (orderId) {
      actions.push({
        text: "View delivery",
        onPress: () => navigation.navigate("Delivery", { orderId: String(orderId) }),
      });
    }
    Alert.alert(item.title || "Notification", item.body || "You have a new notification.", actions);
  }

  if (loading) return <Loading label="Loading notifications" />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
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
      ListHeaderComponent={error ? <Notice tone="error">{error}</Notice> : null}
      ListEmptyComponent={<EmptyState title="No notifications yet" hint="Order assignments and updates will show up here." />}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.card, !item.readAt && styles.cardUnread]}
          onPress={() => open(item)}
          accessibilityRole="button"
        >
          <View style={[styles.dot, !item.readAt && styles.dotUnread]} />
          <View style={styles.message}>
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
  content: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
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
  dotUnread: { backgroundColor: colors.primary },
  message: { flex: 1 },
  title: { ...type.h3, marginBottom: 2 },
  body: { ...type.body, color: colors.textMuted, marginBottom: 4 },
});
