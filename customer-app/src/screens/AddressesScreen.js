import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../components/Text";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, type } from "../theme";
import { Button, Card, Notice, Pill } from "../components/ui";
import AddressForm from "../components/AddressForm";

export default function AddressesScreen() {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(null); // an address id, "new", or null
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState("");

  const addresses = user?.addresses || [];

  async function saved() {
    setEditing(null);
    await refreshUser();
  }

  function remove(address) {
    Alert.alert("Remove this address?", [address.line1, address.city].filter(Boolean).join(", "), [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setRemoving(address.id);
          setError("");
          try {
            await api.del(`/auth/me/addresses/${address.id}`);
            await refreshUser();
          } catch (err) {
            setError(err.message);
          } finally {
            setRemoving(null);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Notice tone="error">{error}</Notice> : null}

        {addresses.map((address) => (
          <Card key={address.id} style={{ padding: spacing.md }}>
            {editing === address.id ? (
              <AddressForm address={address} onCancel={() => setEditing(null)} onSaved={saved} />
            ) : (
              <>
                <View style={styles.titleRow}>
                  <Text style={styles.label}>{address.label}</Text>
                  {address.isDefault ? <Pill tone="primary">Default</Pill> : null}
                </View>
                <Text style={[type.small, { marginTop: 4 }]}>
                  {[address.line1, address.line2, address.landmark, address.city, address.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
                <View style={styles.actions}>
                  <Button title="Edit" size="sm" variant="outline" onPress={() => setEditing(address.id)} />
                  <Button
                    title="Remove"
                    size="sm"
                    variant="ghost"
                    loading={removing === address.id}
                    onPress={() => remove(address)}
                  />
                </View>
              </>
            )}
          </Card>
        ))}

        {!addresses.length && editing !== "new" ? (
          <Text style={[type.small, { textAlign: "center", marginVertical: spacing.lg }]}>
            No saved addresses yet.
          </Text>
        ) : null}

        {editing === "new" ? (
          <Card style={{ padding: spacing.md }}>
            <Text style={type.h3}>New address</Text>
            <AddressForm onCancel={() => setEditing(null)} onSaved={saved} />
          </Card>
        ) : (
          <Pressable style={styles.add} onPress={() => setEditing("new")} accessibilityRole="button">
            <Text style={styles.addText}>+ Add a new address</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { ...type.body, fontWeight: "700", fontSize: 14 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  add: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
});
