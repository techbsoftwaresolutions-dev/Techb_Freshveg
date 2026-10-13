import React, { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../components/Text";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, radius, spacing, type } from "../theme";
import { Button, EmptyState, Loading, Notice, Pill } from "../components/ui";
import { STATUS } from "./SupportScreen";

// One support conversation. The API has no customer "get one ticket" route,
// so it is read from the customer's own list (internal notes already removed).
export default function SupportTicketScreen({ route }) {
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState(undefined);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/support/mine", { limit: 100 });
      setTicket(data.items.find((t) => t.id === ticketId) || null);
    } catch (err) {
      setError(err.message);
      setTicket((current) => current ?? null);
    }
  }, [ticketId]);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function send() {
    setSending(true);
    setError("");
    try {
      const data = await api.post(`/support/${ticketId}/messages`, { body: reply.trim() });
      setTicket(data.ticket);
      setReply("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (ticket === undefined) return <Loading />;
  if (!ticket) return <EmptyState title="Couldn't find this request" hint={error} />;

  const status = STATUS[ticket.status] || STATUS.open;
  const closed = ["resolved", "closed"].includes(ticket.status);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={[type.h2, { flex: 1 }]}>{ticket.subject}</Text>
          <Pill tone={status.tone}>{status.label}</Pill>
        </View>
        <Text style={type.tiny}>
          {ticket.code}
          {ticket.orderCode ? ` · Order ${ticket.orderCode}` : ""}
        </Text>

        {ticket.messages.map((message) => {
          const mine = message.authorRole === "customer";
          return (
            <View key={message.id || message._id || message.at} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={type.tiny}>{mine ? "You" : message.authorName || "Support"}</Text>
              <Text style={type.body}>{message.body}</Text>
              <Text style={[type.tiny, { alignSelf: "flex-end" }]}>
                {new Date(message.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.composer}>
        {error ? <Notice tone="error" style={{ marginBottom: spacing.sm }}>{error}</Notice> : null}
        {closed ? (
          <Text style={[type.small, { textAlign: "center" }]}>This request is {status.label.toLowerCase()}. Raise a new one if you still need help.</Text>
        ) : (
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Write a reply"
              placeholderTextColor={colors.textFaint}
              multiline
              style={styles.input}
            />
            <Button title="Send" size="sm" loading={sending} disabled={!reply.trim()} onPress={send} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  bubble: { maxWidth: "85%", padding: spacing.md, borderRadius: radius.md, gap: 3 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.primarySoft },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  composer: { padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
});
