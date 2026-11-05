import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../components/AppText";
import { api } from "../api/client";
import { colors, radius, spacing, type } from "../theme";
import { Button, Notice } from "../components/ui";

const FALLBACK = [
  ["order_issue", "Order issue"],
  ["payment_issue", "Payment issue"],
  ["missing_product", "Missing product"],
  ["wrong_product", "Wrong product"],
  ["damaged_product", "Damaged product"],
  ["late_delivery", "Late delivery"],
  ["refund", "Refund"],
  ["account_issue", "Account issue"],
  ["other", "Something else"],
];

export default function NewTicketScreen({ navigation, route }) {
  const orderId = route.params?.orderId;
  const [categories, setCategories] = useState(FALLBACK.map(([key, label]) => ({ key, label })));
  const [category, setCategory] = useState(route.params?.category || "other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/support/categories").then((d) => d.categories?.length && setCategories(d.categories)).catch(() => {});
  }, []);

  async function send() {
    setSending(true);
    setError("");
    try {
      const { ticket } = await api.post("/support", {
        category,
        subject: subject.trim(),
        message: message.trim(),
        ...(orderId ? { order: orderId } : {}),
      });
      navigation.replace("Ticket", { id: ticket.id });
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        {error ? <Notice tone="error">{error}</Notice> : null}

        <Text style={type.h3}>What is this about?</Text>
        <View style={styles.chips}>
          {categories.map((c) => (
            <Pressable key={c.key} onPress={() => setCategory(c.key)} style={[styles.chip, category === c.key && styles.chipOn]}>
              <Text style={[styles.chipText, category === c.key && { color: colors.primaryDark, fontWeight: "700" }]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={type.h3}>Subject</Text>
        <TextInput style={styles.input} value={subject} onChangeText={setSubject} maxLength={100} placeholder="A few words, e.g. “Milk packet leaked”" placeholderTextColor={colors.textFaint} />

        <Text style={type.h3}>Tell us what happened</Text>
        <TextInput
          style={[styles.input, { height: 130, paddingTop: 12, textAlignVertical: "top" }]}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={1000}
          placeholder="Include the order number and what you expected."
          placeholderTextColor={colors.textFaint}
        />

        <Button title="Send" loading={sending} disabled={subject.trim().length < 3 || message.trim().length < 5} onPress={send} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13, color: colors.text },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 12, height: 46, fontSize: 14, color: colors.text, backgroundColor: colors.surface },
});
