import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../components/AppText";
import { useStore } from "../context/StoreContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, Notice, Pill } from "../components/ui";

// Serviceability is a real gate: which store serves a pincode decides prices,
// stock and delivery charges, so it is asked once and remembered.
export default function LocationScreen({ navigation }) {
  const { pincode, store, setPincode, setArea } = useStore();
  const [value, setValue] = useState(pincode || "");
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    setResult(null);
    try {
      const data = await setPincode(value);
      setResult(data);
      // With several named areas on this pincode they pick theirs first;
      // otherwise give them a moment to read the confirmation and leave.
      if (data.serviceable && !(data.areas?.length > 1)) {
        setTimeout(() => navigation.goBack(), 900);
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={type.h1}>Where should we deliver?</Text>
      <Text style={type.small}>
        Enter your pincode so we can show what's in stock near you, and what delivery will cost.
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={(text) => setValue(text.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit pincode"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          style={styles.input}
        />
        <Button title="Check" loading={checking} disabled={value.length !== 6} onPress={check} />
      </View>

      {result && !result.serviceable ? (
        <Notice tone="error">
          {result.message || "We don't deliver to this pincode yet."}
        </Notice>
      ) : null}

      {result?.serviceable && result.areas?.length > 1 ? (
        <Card style={{ padding: spacing.md, gap: spacing.sm }}>
          <Text style={type.h3}>Choose your area</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {result.areas.map((name) => {
              const on = store?.area === name;
              return (
                <Pressable
                  key={name}
                  onPress={async () => {
                    await setArea(name);
                    navigation.goBack();
                  }}
                  style={{
                    paddingHorizontal: 14,
                    height: 36,
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: on ? colors.primary : colors.borderStrong,
                    backgroundColor: on ? colors.primarySoft : colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 13, color: on ? colors.primaryDark : colors.text }}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      {result?.serviceable ? (
        <Card style={{ padding: spacing.md, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text style={type.h3}>{result.store.name}</Text>
            <Pill tone={result.isOpen ? "primary" : "danger"}>
              {result.isOpen ? "Open now" : "Closed"}
            </Pill>
          </View>
          <Text style={type.small}>
            {result.afterHours
              ? `Delivers ${result.afterHours.when}`
              : result.deliveryTime === "next_day"
              ? "Delivers the next day"
              : result.deliveryTimeLabel
                ? `Delivers in about ${result.deliveryTimeLabel.replace(/\bmin\b/, "minutes")}`
                : `Delivers in about ${result.prepTimeMinutes} minutes`}
          </Text>
          <Text style={type.small}>
            Minimum order {rupees(result.minOrderValue)} · Free delivery above{" "}
            {rupees(result.freeDeliveryAbove)}
          </Text>
        </Card>
      ) : null}

      {store && !result ? (
        <Card style={{ padding: spacing.md }}>
          <Text style={type.tiny}>Currently delivering from</Text>
          <Text style={type.h3}>{store.name}</Text>
          {pincode ? <Text style={type.small}>Pincode {pincode}{store.area ? ` · ${store.area}` : ""}</Text> : null}
        </Card>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <Text style={type.small}>Seeded pincodes you can try:</Text>
        <View style={styles.chipRow}>
          {["635109", "635110", "560100", "110001"].map((code) => (
            <Pressable key={code} style={styles.chip} onPress={() => setValue(code)}>
              <Text style={styles.chipText}>{code}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[type.tiny, { marginTop: 6 }]}>
          110001 is deliberately outside the delivery area.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  inputRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: spacing.sm },
  input: {
    flex: 1,
    height: 46,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  chipRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: spacing.md,
    height: 30,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { fontSize: 12.5, color: colors.textMuted, fontWeight: "600", letterSpacing: 1 },
});
