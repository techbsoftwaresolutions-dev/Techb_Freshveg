import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../components/AppText";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, type } from "../theme";
import { Button, Card, EmptyState, Notice, Pill } from "../components/ui";

const LABELS = ["Home", "Work", "Other"];
const blank = { label: "Home", line1: "", line2: "", landmark: "", city: "", pincode: "", isDefault: false };

// Saved addresses: add, edit, delete and pick the default — the same places
// checkout offers, without having to be mid-order to manage them.
export default function AddressesScreen({ navigation }) {
  const { user, signedIn, setUser } = useAuth();
  const [editing, setEditing] = useState(null); // null | "new" | address
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!signedIn) {
    return (
      <EmptyState
        title="Sign in to manage addresses"
        action={<Button title="Sign in" onPress={() => navigation.navigate("Login")} />}
      />
    );
  }

  const addresses = user?.addresses || [];
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const applyList = (list) => setUser({ ...user, addresses: list });

  function open(address) {
    setError("");
    setEditing(address || "new");
    setForm(address ? { ...blank, ...address } : { ...blank, isDefault: addresses.length === 0 });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const body = {
        label: form.label,
        line1: form.line1.trim(),
        line2: (form.line2 || "").trim(),
        landmark: (form.landmark || "").trim(),
        city: form.city.trim(),
        pincode: form.pincode,
        isDefault: Boolean(form.isDefault),
      };
      const data =
        editing === "new"
          ? await api.post("/auth/me/addresses", body)
          : await api.patch(`/auth/me/addresses/${editing.id}`, body);
      applyList(data.addresses);
      setEditing(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmRemove(address) {
    Alert.alert("Delete this address?", [address.line1, address.city].filter(Boolean).join(", "), [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const data = await api.del(`/auth/me/addresses/${address.id}`);
            applyList(data.addresses);
          } catch (err) {
            Alert.alert("Couldn't delete", err.message);
          }
        },
      },
    ]);
  }

  async function makeDefault(address) {
    try {
      const data = await api.patch(`/auth/me/addresses/${address.id}`, { isDefault: true });
      applyList(data.addresses);
    } catch (err) {
      Alert.alert("Couldn't update", err.message);
    }
  }

  const valid = form.line1.trim() && form.city.trim() && form.pincode.length === 6;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        {editing ? (
          <Card style={{ padding: spacing.md, gap: spacing.sm }}>
            <Text style={type.h3}>{editing === "new" ? "New address" : "Edit address"}</Text>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {LABELS.map((label) => (
                <Pressable key={label} onPress={() => set("label")(label)} style={[styles.chip, form.label === label && styles.chipOn]}>
                  <Text style={[styles.chipText, form.label === label && { color: colors.primaryDark }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="Flat / house, street" placeholderTextColor={colors.textFaint} value={form.line1} onChangeText={set("line1")} />
            <TextInput style={styles.input} placeholder="Area (optional)" placeholderTextColor={colors.textFaint} value={form.line2 || ""} onChangeText={set("line2")} />
            <TextInput style={styles.input} placeholder="Landmark (optional)" placeholderTextColor={colors.textFaint} value={form.landmark || ""} onChangeText={set("landmark")} />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="City" placeholderTextColor={colors.textFaint} value={form.city} onChangeText={set("city")} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Pincode"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                value={form.pincode}
                onChangeText={(t) => set("pincode")(t.replace(/\D/g, "").slice(0, 6))}
              />
            </View>
            <Pressable style={styles.defaultRow} onPress={() => set("isDefault")(!form.isDefault)}>
              <View style={[styles.check, form.isDefault && styles.checkOn]}>{form.isDefault ? <Text style={styles.tick}>✓</Text> : null}</View>
              <Text style={type.body}>Make this my default address</Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} style={{ flex: 1 }} />
              <Button title="Save address" loading={saving} disabled={!valid} onPress={save} style={{ flex: 2 }} />
            </View>
          </Card>
        ) : (
          <Button title="+ Add new address" onPress={() => open(null)} />
        )}

        {!addresses.length && !editing ? (
          <Text style={[type.small, { textAlign: "center", marginTop: spacing.md }]}>No addresses saved yet.</Text>
        ) : null}

        {addresses.map((address) => (
          <Card key={address.id} style={{ padding: spacing.md, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.label}>{address.label}</Text>
              {address.isDefault ? <Pill tone="primary">Default</Pill> : null}
            </View>
            <Text style={type.small}>
              {[address.line1, address.line2, address.landmark, address.city, address.pincode].filter(Boolean).join(", ")}
            </Text>
            <View style={styles.actions}>
              <Pressable onPress={() => open(address)}><Text style={styles.action}>Edit</Text></Pressable>
              {!address.isDefault ? <Pressable onPress={() => makeDefault(address)}><Text style={styles.action}>Make default</Text></Pressable> : null}
              <Pressable onPress={() => confirmRemove(address)}><Text style={[styles.action, { color: colors.danger }]}>Delete</Text></Pressable>
            </View>
          </Card>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 12, height: 44, fontSize: 14, color: colors.text, backgroundColor: colors.surface },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13, color: colors.text },
  defaultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  check: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: "#fff", fontSize: 13, fontWeight: "800" },
  label: { fontSize: 15, fontWeight: "700", color: colors.text },
  actions: { flexDirection: "row", gap: spacing.lg, marginTop: 4 },
  action: { color: colors.primary, fontWeight: "700", fontSize: 13 },
});
