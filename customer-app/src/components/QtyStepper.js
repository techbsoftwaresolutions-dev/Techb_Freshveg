import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, formatQty, radius } from "../theme";

// The website's add control: a solid green "Add" (or full-width "Add to
// Basket") that turns into a "− 3 +" stepper once the item is in the basket.
// `soft` is the cart's pale-green stepper.
//
// The stepper does not assume 1. Loose vegetables come back from the API with
// stepQty 0.25 and unit "kg", so tapping + on a tomato adds a quarter kilo and
// the label reads "1.25 kg" — the same control, driven by the category's rules.
export default function QtyStepper({
  quantity = 0,
  step = 1,
  min = step,
  max = 99,
  unit = "",
  busy = false,
  compact = false,
  wide = false,
  soft = false,
  onAdd,
  onChange,
  onRemove,
}) {
  const atMax = quantity + step > max + 0.0001;

  const increase = () => {
    // Rounded because 0.1 + 0.2 arithmetic shows up as 0.30000000000000004 in
    // a quantity label.
    const next = Math.round((quantity + step) * 100) / 100;
    onChange?.(Math.min(next, max));
  };

  const decrease = () => {
    const next = Math.round((quantity - step) * 100) / 100;
    if (next < min - 0.0001) onRemove?.();
    else onChange?.(next);
  };

  if (quantity <= 0) {
    return (
      <Pressable
        onPress={busy ? undefined : onAdd}
        style={({ pressed }) => [
          styles.add,
          compact && styles.compact,
          wide && styles.wide,
          pressed && { backgroundColor: colors.primaryDark },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Add to basket"
        accessibilityState={{ busy }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <>
            {wide ? <Ionicons name="cart-outline" size={16} color={colors.onPrimary} /> : null}
            <Text style={[styles.addText, wide && { fontSize: 13.5 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {wide ? "Add to Basket" : "Add"}
            </Text>
          </>
        )}
      </Pressable>
    );
  }

  const fg = soft ? colors.primaryDark : colors.onPrimary;
  return (
    <View style={[styles.stepper, soft && styles.stepperSoft, compact && styles.compact, wide && styles.wide]}>
      <Pressable
        onPress={busy ? undefined : decrease}
        style={styles.stepButton}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Reduce quantity"
      >
        <Ionicons name="remove" size={18} color={fg} />
      </Pressable>

      <View style={styles.quantityBox}>
        {busy ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Text style={[styles.quantityText, { color: fg }]} numberOfLines={1} accessibilityLiveRegion="polite">
            {formatQty(quantity, unit)}
          </Text>
        )}
      </View>

      <Pressable
        onPress={busy || atMax ? undefined : increase}
        style={[styles.stepButton, atMax && { opacity: 0.4 }]}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
      >
        <Ionicons name="add" size={18} color={fg} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  add: {
    minWidth: 76,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addText: { color: colors.onPrimary, fontWeight: "600", fontSize: 14 },
  compact: { minWidth: 68, height: 36 },
  wide: { alignSelf: "stretch", minWidth: undefined, paddingHorizontal: 8, gap: 5 },

  stepper: {
    minWidth: 92,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  stepperSoft: { backgroundColor: colors.primarySoft },
  stepButton: { width: 34, height: "100%", alignItems: "center", justifyContent: "center" },
  quantityBox: { flex: 1, alignItems: "center", justifyContent: "center", minWidth: 22 },
  quantityText: { fontWeight: "700", fontSize: 14 },
});
