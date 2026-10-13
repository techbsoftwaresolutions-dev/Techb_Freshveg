import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { Text } from "../components/Text";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, type } from "../theme";
import { Button, Card, Notice } from "../components/ui";
import { Input } from "../components/AddressForm";

// Name and email — the only self-editable profile fields (the API refuses
// the rest). The phone number is the login, so it is shown, not edited.
export default function EditProfileScreen({ navigation }) {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const emailOk = !form.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

  async function save() {
    setSaving(true);
    setError("");
    try {
      const data = await api.patch("/auth/me", { name: form.name.trim(), email: form.email.trim() });
      setUser(data.user);
      navigation.goBack();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Card style={{ padding: spacing.md, gap: spacing.sm }}>
          <Text style={type.tiny}>Full name</Text>
          <Input value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} placeholder="Your name" autoComplete="name" />
          <Text style={[type.tiny, { marginTop: spacing.sm }]}>Email (optional)</Text>
          <Input
            value={form.email}
            onChangeText={(email) => setForm((f) => ({ ...f, email }))}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {!emailOk ? <Text style={styles.fieldError}>Enter a valid email address</Text> : null}
          <Text style={[type.tiny, { marginTop: spacing.sm }]}>Mobile number</Text>
          <Text style={type.body}>+91 {user?.phone}</Text>
        </Card>
        <Button title="Save" loading={saving} disabled={!form.name.trim() || !emailOk} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fieldError: { color: colors.danger, fontSize: 12 },
});
