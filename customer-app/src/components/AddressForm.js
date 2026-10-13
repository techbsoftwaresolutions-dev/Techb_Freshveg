import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, TextInput } from "./Text";
import { api } from "../api/client";
import { colors, radius, spacing } from "../theme";
import { Button, Notice } from "./ui";

// Add a new address, or edit `address` in place. Used by checkout and by the
// saved-addresses screen, so both validate the same way.
export default function AddressForm({ address, onCancel, onSaved }) {
  const [form, setForm] = useState({
    label: address?.label || "Home",
    line1: address?.line1 || "",
    landmark: address?.landmark || "",
    city: address?.city || "",
    pincode: address?.pincode || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      const data = address
        ? await api.patch(`/auth/me/addresses/${address.id}`, form)
        : await api.post("/auth/me/addresses", form);
      onSaved(data.addresses);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      {error ? <Notice tone="error">{error}</Notice> : null}

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {["Home", "Work", "Other"].map((label) => (
          <Pressable
            key={label}
            onPress={() => set("label")(label)}
            style={[styles.labelChip, form.label === label && styles.labelChipActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: form.label === label }}
          >
            <Text style={[styles.labelChipText, form.label === label && { color: colors.primaryDark }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input placeholder="Flat / house, street" value={form.line1} onChangeText={set("line1")} />
      <Input placeholder="Landmark (optional)" value={form.landmark} onChangeText={set("landmark")} />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Input placeholder="City" value={form.city} onChangeText={set("city")} style={{ flex: 1 }} />
        <Input
          placeholder="Pincode"
          value={form.pincode}
          onChangeText={(text) => set("pincode")(text.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          style={{ flex: 1 }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} style={{ flex: 1 }} />
        <Button
          title={address ? "Save changes" : "Save address"}
          size="sm"
          loading={saving}
          disabled={!form.line1 || !form.city || form.pincode.length !== 6}
          onPress={save}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
}

export function Input({ style, ...props }) {
  return <TextInput placeholderTextColor={colors.textFaint} style={[styles.input, style]} {...props} />;
}

const styles = StyleSheet.create({
  form: { gap: spacing.sm, marginTop: spacing.md },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  labelChip: {
    paddingHorizontal: spacing.md,
    minHeight: 34,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  labelChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  labelChipText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
});
