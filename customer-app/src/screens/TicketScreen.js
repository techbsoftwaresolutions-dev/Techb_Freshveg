import React, { useCallback, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text, TextInput } from "../components/AppText";
import { api } from "../api/client";
import { colors, radius, spacing, type } from "../theme";
import { Button, Loading, Notice, Pill } from "../components/ui";
import { STATUS_LABEL, statusTone } from "./SupportScreen";

// One ticket as a chat thread. Staff replies show on the left, yours on the right.
export default function TicketScreen({ route }) {
  const { id } = route.params;
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get("/support/mine", { limit: 50 });
      const found = (data.items || []).find((t) => t.id === id);
      if (found) setTicket(found);
      else setError("Ticket not found");
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function send() {
    setSending(true);
    setError("");
    try {
      await api.post(`/support/${id}/messages`, { body: reply.trim() });
      setReply("");
      await load();
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (!ticket) return error ? <Notice tone="error" style={{ margin: spacing.lg }}>{error}</Notice> : <Loading />;
  const closed = ["resolved", "closed"].includes(ticket.status);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.code}>{ticket.code}{ticket.orderCode ? ` · Order ${ticket.orderCode}` : ""}</Text>
          <Text style={type.h3} numberOfLines={2}>{ticket.subject}</Text>
        </View>
        <Pill tone={statusTone(ticket.status)}>{STATUS_LABEL[ticket.status] || ticket.status}</Pill>
      </View>

      <FlatList
        ref={listRef}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        data={ticket.messages}
        keyExtractor={(m, i) => m.id || String(i)}
        renderItem={({ item }) => {
          const mine = item.authorRole === "customer";
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              {!mine ? <Text style={styles.who}>{item.authorName || "Support"}</Text> : null}
              <Text style={[type.body, mine && { color: "#fff" }]}>{item.body}</Text>
              <Text style={[styles.time, mine && { color: "rgba(255,255,255,.75)" }]}>
                {new Date(item.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          );
        }}
      />

      {error ? <Notice tone="error" style={{ marginHorizontal: spacing.lg }}>{error}</Notice> : null}

      {closed ? (
        <Text style={[type.small, styles.closed]}>This ticket is {ticket.status}. Raise a new one if you still need help.</Text>
      ) : (
        <View style={styles.composer}>
          <TextInput style={styles.input} value={reply} onChangeText={setReply} placeholder="Write a reply…" placeholderTextColor={colors.textFaint} multiline maxLength={1000} />
          <Button title="Send" size="sm" loading={sending} disabled={!reply.trim()} onPress={send} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  code: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  bubble: { maxWidth: "82%", padding: spacing.md, borderRadius: 14, gap: 3 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  who: { fontSize: 11.5, fontWeight: "700", color: colors.primaryDark },
  time: { fontSize: 10.5, color: colors.textFaint, alignSelf: "flex-end" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 110, minHeight: 40, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 12, paddingTop: 10, fontSize: 14, color: colors.text, backgroundColor: colors.bg },
  closed: { textAlign: "center", padding: spacing.lg, backgroundColor: colors.surface },
});
