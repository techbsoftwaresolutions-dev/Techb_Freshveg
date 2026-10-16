import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Notice } from "./ui";

// "Your coupons" inside the cart and checkout: the customer's usable reward
// coupons, one tap to apply or remove. The discount and the new total come
// back from the API — nothing is worked out here. (Website twin:
// website/components/CouponPicker.jsx.)
export default function CouponPicker({ compact = false, onViewAll }) {
  const cart = useCart();
  const [coupons, setCoupons] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const appliedId = cart.cart?.rewardCouponId || null;
  const reward = cart.cart?.rewardCoupon || null;

  useEffect(() => {
    api
      .get("/coupons", { status: "available" })
      .then((data) => setCoupons(data.items || []))
      .catch(() => setCoupons([]));
  }, [appliedId]);

  if (coupons === null || (!coupons.length && !appliedId)) {
    return compact || coupons === null ? null : (
      <Text style={[type.small, { marginTop: spacing.md }]}>No reward coupons yet — refer a friend to earn some.</Text>
    );
  }

  async function run(id, action) {
    setBusy(id);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      <View style={styles.head}>
        <Text style={type.h3}>Your coupons</Text>
        {onViewAll ? (
          <Pressable onPress={onViewAll} hitSlop={8} accessibilityRole="link">
            <Text style={styles.link}>View all</Text>
          </Pressable>
        ) : null}
      </View>
      {reward && !reward.ok ? (
        <Notice tone="warn">
          {reward.code}: {reward.reason}
        </Notice>
      ) : null}
      {coupons.map((coupon) => {
        const applied = coupon.id === appliedId;
        return (
          <View key={coupon.id} style={[styles.row, applied && styles.applied]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.amount}>{rupees(coupon.amount)} off</Text>
              <Text style={type.tiny} numberOfLines={2}>
                {coupon.title}
                {coupon.minOrderValue ? ` · on ${rupees(coupon.minOrderValue)}+` : ""}
                {` · until ${new Date(coupon.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
              </Text>
            </View>
            {applied ? (
              <Button
                title="Remove"
                size="sm"
                variant="outline"
                loading={busy === coupon.id}
                onPress={() => run(coupon.id, () => cart.removeCoupon(coupon.code))}
              />
            ) : (
              <Button
                title="Apply"
                size="sm"
                loading={busy === coupon.id}
                disabled={Boolean(busy)}
                onPress={() => run(coupon.id, () => cart.applyRewardCoupon(coupon.id))}
              />
            )}
          </View>
        );
      })}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
  },
  applied: { borderColor: colors.save, backgroundColor: colors.saveSoft },
  amount: { fontSize: 15, fontWeight: "800", color: colors.text },
});
