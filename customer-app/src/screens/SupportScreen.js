import React, { useCallback, useState } from "react";
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../components/AppText";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, type } from "../theme";
import { Button, Card, EmptyState, Loading, Pill } from "../components/ui";

export const STATUS_LABEL = {
  open: "Open",
  in_progress: "In progress",
  waiting_customer: "Waiting for you",
  resolved: "Resolved",
  closed: "Closed",
};
export const statusTone = (s) =>
  s === "resolved" || s === "closed" ? "save" : s === "waiting_customer" ? "warn" : "accent";

const SUPPORT_PHONE = "+919003597158";

// Help & support: the customer's tickets, newest first, and a way to raise one.
export default function SupportScreen({ navigation }) {
  const { signedIn } = useAuth();
  const [tickets, setTickets] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get("/support/mine", { limit: 50 });
      setTickets(data.items || []);
    } catch {
      setTickets((current) => current || []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (signedIn) load();
    }, [signedIn, load])
  );

  if (!signedIn) {
    return (
      <EmptyState
        title="Sign in to contact support"
        hint="Or call us any time."
        action={<Button title="Sign in" onPress={() => navigation.navigate("Login")} />}
      />
    );
  }
  if (tickets === null) return <Loading />;

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        data={tickets}
        keyExtractor={(t) => t.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <Card style={styles.callCard}>
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>Need an answer right now?</Text>
              <Text style={type.small}>Call the shop — we pick up during store hours.</Text>
            </View>
            <Button title="Call" variant="outline" size="sm" onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {})} />
          </Card>
        }
        ListEmptyComponent={
          <Text style={[type.small, { textAlign: "center", marginTop: spacing.xl }]}>
            No tickets yet. Raise one and we'll reply here.
          </Text>
        }
        renderItem={({ item }) => {
          const last = item.messages?.[item.messages.length - 1];
          return (
            <Card onPress={() => navigation.navigate("Ticket", { id: item.id })} style={{ padding: spacing.md, gap: 4 }}>
              <View style={styles.rowTop}>
                <Text style={styles.code}>{item.code}</Text>
                <Pill tone={statusTone(item.status)}>{STATUS_LABEL[item.status] || item.status}</Pill>
              </View>
              <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
              {last ? <Text style={type.small} numberOfLines={1}>{last.authorRole === "customer" ? "You: " : ""}{last.body}</Text> : null}
              <Text style={type.tiny}>{new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</Text>
            </Card>
          );
        }}
      />
      <View style={styles.bar}>
        <Button title="Raise a new ticket" onPress={() => navigation.navigate("NewTicket")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  callCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  code: { fontSize: 12.5, fontWeight: "700", color: colors.textMuted },
  subject: { fontSize: 15, fontWeight: "700", color: colors.text },
  bar: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
