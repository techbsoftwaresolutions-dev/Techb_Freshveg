import React, { useCallback, useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../components/Text";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, radius, spacing, type } from "../theme";
import { Button, Card, Loading, Notice, Pill } from "../components/ui";
import { Input } from "../components/AddressForm";

const SUPPORT_PHONES = [
  { number: "+918072605216", label: "+91 80726 05216" },
  { number: "+916374047119", label: "+91 63740 47119" },
];

export const STATUS = {
  open: { label: "Open", tone: "warn" },
  in_progress: { label: "In progress", tone: "accent" },
  waiting_customer: { label: "Reply needed", tone: "danger" },
  resolved: { label: "Resolved", tone: "save" },
  closed: { label: "Closed", tone: "default" },
};

// Help & support: the customer's tickets, and a form to raise one — linked to
// an order when opened from one (route.params.order).
export default function SupportScreen({ navigation, route }) {
  const order = route.params?.order || null; // { id, code }
  const [tickets, setTickets] = useState(null);
  const [categories, setCategories] = useState([]);
  const [composing, setComposing] = useState(Boolean(order));
  const [form, setForm] = useState({ category: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/support/mine", { limit: 30 });
      setTickets(data.items);
      setError("");
    } catch (err) {
      setError(err.message);
      setTickets((current) => current || []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));
  useEffect(() => {
    api.get("/support/categories").then((data) => setCategories(data.categories)).catch(() => {});
  }, []);

  async function send() {
    setSending(true);
    setError("");
    try {
      const { ticket } = await api.post("/support", { ...form, order: order?.id });
      setComposing(false);
      setForm({ category: "", subject: "", message: "" });
      await load();
      navigation.navigate("SupportTicket", { ticketId: ticket.id });
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (tickets === null) return <Loading />;

  const composer = (
    <Card style={{ padding: spacing.md, gap: spacing.sm }}>
      <Text style={type.h3}>{order ? `Help with order ${order.code}` : "Raise a request"}</Text>
      <Text style={type.tiny}>What is it about?</Text>
      <View style={styles.chips}>
        {categories.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setForm((f) => ({ ...f, category: c.key }))}
            style={[styles.chip, form.category === c.key && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: form.category === c.key }}
          >
            <Text style={[styles.chipText, form.category === c.key && { color: colors.primaryDark }]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <Input placeholder="Subject" value={form.subject} onChangeText={(subject) => setForm((f) => ({ ...f, subject }))} />
      <TextInput
        placeholder="Tell us what happened"
        placeholderTextColor={colors.textFaint}
        value={form.message}
        onChangeText={(message) => setForm((f) => ({ ...f, message }))}
        multiline
        style={styles.textarea}
      />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button title="Cancel" variant="ghost" size="sm" onPress={() => setComposing(false)} style={{ flex: 1 }} />
        <Button
          title="Send"
          size="sm"
          loading={sending}
          disabled={!form.category || !form.subject.trim() || !form.message.trim()}
          onPress={send}
          style={{ flex: 2 }}
        />
      </View>
    </Card>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        style={styles.screen}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        keyboardShouldPersistTaps="handled"
        data={composing ? [] : tickets}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            {error ? <Notice tone="error">{error}</Notice> : null}
            {composing ? composer : <Button title="Raise a new request" onPress={() => setComposing(true)} />}
            {!composing && tickets.length ? <Text style={type.h3}>Your requests</Text> : null}
          </View>
        }
        ListEmptyComponent={
          composing ? null : (
            <Text style={[type.small, { textAlign: "center", marginTop: spacing.md }]}>You haven't raised any requests.</Text>
          )
        }
        renderItem={({ item }) => {
          const status = STATUS[item.status] || STATUS.open;
          return (
            <Card style={{ padding: spacing.md, gap: 4 }} onPress={() => navigation.navigate("SupportTicket", { ticketId: item.id })}>
              <View style={styles.row}>
                <Text style={[type.body, { flex: 1, fontWeight: "700" }]} numberOfLines={1}>
                  {item.subject}
                </Text>
                <Pill tone={status.tone}>{status.label}</Pill>
              </View>
              <Text style={type.tiny}>
                {item.code}
                {item.orderCode ? ` · ${item.orderCode}` : ""} · {new Date(item.createdAt).toLocaleDateString("en-IN")}
              </Text>
            </Card>
          );
        }}
        ListFooterComponent={
          <Card style={[styles.row, { padding: spacing.md, marginTop: spacing.md, gap: spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>Prefer to call?</Text>
              <Text style={type.small}>The Farmers Basket, on either number</Text>
            </View>
            <View style={{ gap: spacing.xs }}>
              {SUPPORT_PHONES.map((phone) => (
                <Button key={phone.number} title={phone.label} size="sm" variant="outline" onPress={() => Linking.openURL(`tel:${phone.number}`).catch(() => {})} />
              ))}
            </View>
          </Card>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
  textarea: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: "top",
  },
});
