import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, radius, formatQty } from "../theme";

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
  // A small floating circle meant to sit half on top of a product photo
  // (the quick-add button on a listing card), rather than the normal
  // rectangular control used on the product detail page.
  overlay = false,
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
    if (overlay) {
      return (
        <Pressable
          onPress={busy ? undefined : onAdd}
          style={({ pressed }) => [styles.overlayAdd, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Add to cart"
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.overlayAddSymbol}>+</Text>
          )}
        </Pressable>
      );
    }

    return (
      <Pressable
        onPress={busy ? undefined : onAdd}
        style={({ pressed }) => [
          styles.addButton,
          compact && styles.addButtonCompact,
          pressed && { opacity: 0.8 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Add to cart"
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.addText}>ADD</Text>
        )}
      </Pressable>
    );
  }

  return (
    <View style={[styles.stepper, compact && styles.stepperCompact, overlay && styles.stepperOverlay]}>
      <Pressable
        onPress={busy ? undefined : decrease}
        style={styles.stepButton}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Reduce quantity"
      >
        <Text style={styles.stepSymbol}>−</Text>
      </Pressable>

      <View style={styles.quantityBox}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <Text style={[styles.quantityText, overlay && styles.quantityTextOverlay]} numberOfLines={1}>
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
        <Text style={styles.stepSymbol}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    minWidth: 78,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonCompact: { minWidth: 64, height: 30 },
  addText: { color: colors.primary, fontFamily: fontFamily.extrabold, fontSize: 13, letterSpacing: 0.4 },

  // The floating circle on a product card's photo — half the button sits on
  // the image, half on the white card below it, so it needs its own shadow
  // rather than relying on the card's.
  overlayAdd: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0B0F1A",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  overlayAddSymbol: {
    color: colors.primary,
    fontFamily: fontFamily.extrabold,
    fontSize: 18,
    lineHeight: 20,
    includeFontPadding: false,
  },

  stepper: {
    minWidth: 78,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  stepperCompact: { minWidth: 64, height: 30 },
  stepperOverlay: {
    minWidth: 64,
    height: 28,
    borderRadius: 14,
    shadowColor: "#0B0F1A",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  stepButton: { paddingHorizontal: 9, height: "100%", alignItems: "center", justifyContent: "center" },
  stepSymbol: {
    color: colors.onPrimary,
    fontSize: 17,
    lineHeight: 20,
    fontFamily: fontFamily.bold,
    includeFontPadding: false,
  },
  quantityBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  quantityText: { color: colors.onPrimary, fontFamily: fontFamily.extrabold, fontSize: 12.5 },
  quantityTextOverlay: { fontSize: 11.5 },
});
