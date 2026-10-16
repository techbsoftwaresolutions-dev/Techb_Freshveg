import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { useCart } from "../context/CartContext";
import { useStore } from "../context/StoreContext";
import { colors, rupees, spacing, type } from "../theme";

// The website's FreeDeliveryProgress (website/components/FreeDeliveryProgress.jsx):
// the store's free-delivery rule, from the cart's own summary once it has
// loaded (the number the server prices with), otherwise from the selected
// store. "Cart total" is the subtotal after offers, as on the server. Amounts
// are paise. Nothing shows when the rule is off or the amount is unusable.
//
// variant: "inline" (a card in the cart) or "bar" (a strip along the bottom of
// a browsing screen, just above the tab bar).
export default function FreeDeliveryProgress({ variant = "inline", style }) {
  const { summary } = useCart();
  const { store } = useStore();

  const fromSummary = summary && typeof summary.freeDeliveryThreshold === "number";
  const amount = Number(fromSummary ? summary.freeDeliveryThreshold : store?.freeDeliveryAbove ?? store?.settings?.freeDeliveryAbove);
  const flag = fromSummary ? summary.freeDeliveryEnabled : store?.freeDeliveryEnabled ?? store?.settings?.freeDeliveryEnabled;
  const threshold = Number.isFinite(amount) && amount > 0 ? amount : 0;

  // Until the cart has loaded there is no honest number to show.
  if (!summary || flag === false || !threshold) return null;

  const subtotal = Math.max(0, (summary.subtotal || 0) - (summary.offerDiscount || 0));
  const remaining = Math.max(threshold - subtotal, 0);
  const unlocked = subtotal >= threshold;
  // Whole rupees, rounded up: never "₹0 to go" while a few paise are missing.
  const toGo = rupees(Math.ceil(remaining / 100) * 100);
  const title = unlocked
    ? "FREE DELIVERY unlocked"
    : subtotal === 0
      ? `Add ${toGo} more to get FREE DELIVERY`
      : `${toGo} to go for FREE DELIVERY`;

  return (
    <View
      style={[variant === "bar" ? styles.bar : styles.card, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={title}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(subtotal / threshold, 1) * 100) }}
    >
      <View style={styles.row}>
        <Ionicons name={unlocked ? "checkmark-circle" : "bus-outline"} size={18} color={colors.primary} />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {unlocked ? null : (
          <Text style={type.tiny}>
            {rupees(subtotal)} / {rupees(threshold)}
          </Text>
        )}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(subtotal / threshold, 1) * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    gap: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.primaryDark },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.primarySoft, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3, backgroundColor: colors.primary },
});
