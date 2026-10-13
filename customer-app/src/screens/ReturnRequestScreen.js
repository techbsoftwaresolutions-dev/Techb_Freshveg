import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput } from "../components/Text";
import { api } from "../api/client";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, EmptyState, Loading, Notice } from "../components/ui";

// Which lines can go back, and for how long, is the API's answer (each item's
// category sets its return window) — this screen only lets the customer pick.
export default function ReturnRequestScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [check, setCheck] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/returns/orders/${orderId}/returnable`)
      .then(setCheck)
      .catch((err) => {
        setError(err.message);
        setCheck({ eligible: false, items: [], reason: err.message });
      });
  }, [orderId]);

  const toggle = (id) =>
    setPicked((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function submit() {
    setSending(true);
    setError("");
    try {
      await api.post(`/returns/orders/${orderId}/request`, {
        items: [...picked].map((orderItem) => ({ orderItem })),
        reason: reason.trim(),
      });
      navigation.goBack();
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  if (!check) return <Loading />;
  if (!check.eligible) return <EmptyState title="Nothing to return" hint={check.reason} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Card style={{ padding: spacing.md }}>
        <Text style={type.h3}>Choose items to return</Text>
        {check.items.map((item) => {
          const on = picked.has(item.orderItem);
          return (
            <Pressable
              key={item.orderItem}
              disabled={!item.eligible}
              onPress={() => toggle(item.orderItem)}
              style={[styles.item, !item.eligible && { opacity: 0.5 }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: !item.eligible }}
            >
              <View style={[styles.checkbox, on && styles.checkboxOn]}>{on ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}</View>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>
                  {item.name}
                  {item.variantName ? ` · ${item.variantName}` : ""}
                </Text>
                <Text style={type.tiny}>
                  {item.eligible
                    ? `${item.quantity} × · ${rupees(item.amount)} · ${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} left`
                    : item.reason}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </Card>

      <Card style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={type.h3}>What went wrong?</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Damaged, wrong item, not fresh"
          placeholderTextColor={colors.textFaint}
          multiline
          style={styles.textarea}
        />
      </Card>

      <Button title="Request return" loading={sending} disabled={!picked.size} onPress={submit} />
      <Text style={[type.tiny, { textAlign: "center" }]}>We'll confirm the return and arrange a pickup.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, minHeight: 48 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: "#fff", fontSize: 13, fontWeight: "900" },
  textarea: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: "top",
  },
});
