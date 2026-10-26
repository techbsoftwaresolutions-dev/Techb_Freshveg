import React, { useCallback, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Text, TextInput } from "../components/Text";
import { api } from "../api/client";
import { colors, radius, spacing, type } from "../theme";
import { Button, Card, ConfirmModal, Divider, IconTile, Notice, Pill } from "../components/ui";

// Legal notices for the delivery app, and the employee's account-deletion
// request. Delivery staff are store employees: the store's admin completes or
// declines the request (Admin → Delivery Boys), because it holds the
// employment and cash-handling records (backend: accountDeletion.service.js).
const SITE_URL = Constants.expoConfig?.extra?.siteUrl || "https://thefarmersbasket.in";

const NOTICES = [
  { label: "Delivery staff privacy notice", path: "/delivery-app-privacy", icon: "shield-checkmark-outline" },
  { label: "Delivery app usage terms", path: "/delivery-app-terms", icon: "document-text-outline" },
  { label: "Account deletion & data retention", path: "/account-deletion#delivery-staff", icon: "trash-outline" },
];

const STATUS = {
  requested: { tone: "warn", label: "Sent to your store" },
  completed: { tone: "success", label: "Completed" },
  rejected: { tone: "danger", label: "Declined" },
};

export default function AboutScreen() {
  const [state, setState] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.get("/auth/me/deletion").then(setState).catch((err) => setError(err.message));
  }, []);
  useFocusEffect(load);

  async function request() {
    setBusy(true);
    setError("");
    try {
      await api.post("/auth/me/deletion", { confirm: "DELETE", reason });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const latest = state?.request;
  const look = latest ? STATUS[latest.status] : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
      <Card style={{ paddingVertical: spacing.xs }}>
        {NOTICES.map((item, index) => (
          <View key={item.path}>
            {index > 0 ? <Divider style={{ marginLeft: 68 }} /> : null}
            <Pressable
              style={styles.row}
              onPress={() => Linking.openURL(`${SITE_URL}${item.path}`).catch(() => {})}
              accessibilityRole="link"
            >
              <IconTile name={item.icon} />
              <Text style={styles.label}>{item.label}</Text>
              <Ionicons name="open-outline" size={18} color={colors.textFaint} />
            </Pressable>
          </View>
        ))}
      </Card>

      <Card style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={type.h3}>Delete my account</Text>
        <Text style={type.small}>
          Leaving, or no longer want this account? Send a request to your store. Switching your account off
          (deactivation) is not deletion — only a completed request erases your details.
        </Text>
        {latest ? (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Pill tone={look.tone}>{look.label}</Pill>
              <Text style={type.tiny}>Ref {latest.reference}</Text>
            </View>
            {latest.status === "rejected" && latest.note ? <Text style={type.small}>Store's reply: {latest.note}</Text> : null}
          </View>
        ) : null}
        {state?.canRequest ? (
          <>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (optional)"
              placeholderTextColor={colors.textFaint}
              maxLength={500}
              style={styles.input}
            />
            <Button title="Request account deletion" variant="danger" icon="trash-outline" loading={busy} onPress={() => setConfirming(true)} />
          </>
        ) : null}
        <Notice tone="error">{error}</Notice>
      </Card>

      <Text style={[type.tiny, { textAlign: "center" }]}>
        {Constants.expoConfig?.name || "Delivery app"} · v{Constants.expoConfig?.version || "—"}
      </Text>

      <ConfirmModal
        visible={confirming}
        title="Ask your store to delete your account?"
        message="Your account stays active until an admin completes the request. Records the store must keep (deliveries you made and cash you handled) are kept without your phone number."
        confirmText="Send request"
        busy={busy}
        onConfirm={request}
        onCancel={() => setConfirming(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, minHeight: 60 },
  label: { flex: 1, fontSize: 14.5, fontWeight: "600", color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
