import React, { useCallback, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Text, TextInput } from "../components/Text";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, Loading, Notice } from "../components/ui";
import { SITE_URL } from "./LegalScreen";

// Deletes the account for good (backend: accountDeletion.service.js). The
// server decides what stops it and what is forfeited; this screen shows that,
// asks for a typed DELETE, and signs out once it is done.
export default function DeleteAccountScreen({ navigation }) {
  const { signOut } = useAuth();
  const [check, setCheck] = useState(null);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useFocusEffect(
    useCallback(() => {
      api.get("/auth/me/deletion").then(setCheck).catch((err) => setError(err.message));
    }, [])
  );

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const result = await api.post("/auth/me/deletion", { confirm: typed, acknowledge: acknowledged, source: "app" });
      setDone(result.deletion);
    } catch (err) {
      setError(err.message);
      api.get("/auth/me/deletion").then(setCheck).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
        <Ionicons name="checkmark-circle" size={48} color={colors.primary} style={{ alignSelf: "center" }} />
        <Text style={[type.h1, { textAlign: "center" }]}>Your account has been deleted</Text>
        <Text style={[type.small, { textAlign: "center" }]}>
          Your profile, saved addresses, reviews and preferences are erased. Order and payment records are kept without
          your name or contact details, as the law requires for invoices and tax.
        </Text>
        <Card style={{ padding: spacing.md }}>
          <Text style={type.small}>Reference</Text>
          <Text style={[type.h2, { letterSpacing: 1 }]} selectable>
            {done.reference}
          </Text>
          <Text style={type.tiny}>Quote this if you contact us about the deletion.</Text>
        </Card>
        <Button title="Done" onPress={signOut} />
      </ScrollView>
    );
  }

  if (!check) return error ? <Notice tone="error" style={{ margin: spacing.lg }}>{error}</Notice> : <Loading />;

  const ready = typed.trim().toUpperCase() === "DELETE" && (acknowledged || !check.warnings.length);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={type.h1}>Delete your account</Text>
      <Text style={type.small}>
        This cannot be undone. Your name, phone number, email, saved addresses, reviews, wishlist, cart and notifications
        are erased and you are signed out everywhere. Past orders, payments and refunds are kept without your name or
        contact details, because invoices and tax records must be kept by law.
      </Text>
      <Pressable onPress={() => Linking.openURL(`${SITE_URL}/account-deletion`).catch(() => {})} accessibilityRole="link">
        <Text style={styles.link}>What is deleted and what is kept</Text>
      </Pressable>

      {check.blockers.length ? (
        <Card style={{ padding: spacing.md, gap: spacing.sm }}>
          <Text style={type.h3}>Before you can delete</Text>
          {check.blockers.map((b) => (
            <Notice key={`${b.kind}-${b.ref}`} tone="warn">{b.message}</Notice>
          ))}
          <Button title="Go to my orders" variant="outline" onPress={() => navigation.navigate("OrdersTab")} />
          <Button title="Contact support" variant="ghost" onPress={() => navigation.navigate("Support")} />
        </Card>
      ) : (
        <>
          {check.warnings.length ? (
            <Card style={{ padding: spacing.md, gap: spacing.sm }}>
              <Text style={type.h3}>You will lose</Text>
              {check.warnings.map((w) => (
                <Text key={w.kind} style={type.body}>
                  • {w.kind === "wallet" ? `Wallet balance of ${rupees(w.amount)}` : w.kind === "points" ? `${w.points} loyalty points` : `${w.count} unused reward coupon(s)`}
                </Text>
              ))}
              <Pressable
                style={styles.checkRow}
                onPress={() => setAcknowledged((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acknowledged }}
              >
                <Ionicons name={acknowledged ? "checkbox" : "square-outline"} size={22} color={colors.primary} />
                <Text style={[type.small, { flex: 1 }]}>I understand these will be forfeited and cannot be restored.</Text>
              </Pressable>
            </Card>
          ) : null}

          <Text style={type.small}>Type DELETE to confirm</Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="DELETE"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            accessibilityLabel="Type DELETE to confirm"
          />
          <Notice tone="error">{error}</Notice>
          <Button title="Delete my account" onPress={remove} loading={busy} disabled={!ready || busy} style={{ backgroundColor: ready ? colors.danger : undefined }} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  link: { color: colors.primary, fontWeight: "600", fontSize: 13.5 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
