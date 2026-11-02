import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../components/AppText";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, fontFamily, radius, spacing, type } from "../theme";
import { Button, Notice } from "../components/ui";

// Name and email are the customer's own to change. The mobile number is the
// sign-in, so it is shown but not editable here.
export default function EditProfileScreen({ navigation }) {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const initials = (name || user?.phone || "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const changed = name.trim() !== (user?.name || "") || email.trim().toLowerCase() !== (user?.email || "");

  async function save() {
    setError("");
    if (!name.trim()) return setError("Enter your name");
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address, or leave it empty");
    setSaving(true);
    try {
      const res = await api.patch("/auth/me", { name: name.trim(), email: email.trim() });
      setUser(res.user);
      navigation.goBack();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {error ? <Notice tone="error">{error}</Notice> : null}

        <View style={styles.field}>
          <Text style={styles.label}>Full name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Your name" maxLength={60} autoCapitalize="words" style={styles.input} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email (optional)</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mobile number</Text>
          <View style={[styles.input, styles.locked]}>
            <Text style={styles.lockedText}>+91 {user?.phone}</Text>
          </View>
        </View>

        <Button title="Save changes" loading={saving} disabled={!changed || !name.trim()} onPress={save} style={{ marginTop: spacing.sm }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  avatar: { alignSelf: "center", width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginVertical: spacing.sm },
  avatarText: { fontSize: 30, fontFamily: fontFamily.extrabold, color: colors.primaryDark },
  field: { gap: 6 },
  label: { fontSize: 12.5, fontFamily: fontFamily.bold, color: colors.textMuted },
  input: { height: 48, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, fontSize: 15, color: colors.text },
  locked: { justifyContent: "center", backgroundColor: colors.surfaceAlt },
  lockedText: { fontSize: 15, color: colors.textMuted },
});
