import React, { useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput } from "../components/Text";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { colors, radius, rupees, shadow, spacing, type, unitSuffix } from "../theme";
import { Button, Card, Divider, EmptyState, IconTile, Loading, Notice, Pill } from "../components/ui";
import QtyStepper from "../components/QtyStepper";
import CouponPicker from "../components/CouponPicker";
import FreeDeliveryProgress from "../components/FreeDeliveryProgress";

// The website's mobile cart: free-delivery progress, item cards with a soft
// stepper, offers & coupons, the bill, and a sticky "Proceed to checkout".
export default function CartScreen({ navigation }) {
  const cart = useCart();
  const { signedIn } = useAuth();
  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [applying, setApplying] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const summary = cart.summary;

  if (cart.loading && !cart.cart) return <Loading label="Loading your cart" />;

  if (!cart.items.length) {
    return (
      <EmptyState
        icon="cart-outline"
        title="Your cart is empty"
        hint="Add a few things and they will show up here."
        action={<Button title="Start shopping" onPress={() => navigation.navigate("HomeTab")} style={{ minWidth: 180 }} />}
      />
    );
  }

  async function applyCoupon() {
    setApplying(true);
    setCouponError("");
    try {
      await cart.applyCoupon(code.trim());
      setCode("");
    } catch (err) {
      // The engine explains *why* — "Add ₹120 more to use this" — which is far
      // more useful than "invalid coupon".
      setCouponError(err.message);
    } finally {
      setApplying(false);
    }
  }

  // An in-app modal rather than Alert.alert, which does nothing on Expo web.
  const clearCart = () => {
    setConfirmClear(false);
    cart.clear().catch(() => {});
  };

  const itemCount = cart.items.length;
  const couponApplied = cart.offers.applied.some((o) => o.code);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, gap: spacing.md }}>
        <View style={styles.titleRow}>
          <Text style={type.small}>
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </Text>
          <Pressable onPress={() => setConfirmClear(true)} style={styles.clear} hitSlop={8} accessibilityRole="button">
            <Ionicons name="trash-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.clearText}>Clear Cart</Text>
          </Pressable>
        </View>

        <FreeDeliveryProgress />

        {cart.unavailable.length ? (
          <Notice tone="error">
            {cart.unavailable.length} item{cart.unavailable.length === 1 ? "" : "s"} went out of stock and won't be ordered.
          </Notice>
        ) : null}

        {/* Lines */}
        {cart.items.map((item) => (
          <Card key={item.itemId} style={styles.line}>
            <View style={styles.thumb}>
              {item.image ? <Image source={{ uri: item.image }} style={styles.thumbImage} resizeMode="cover" /> : null}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.lineName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.linePack} numberOfLines={1}>
                {item.variantName || item.unit}
              </Text>
              <View style={styles.linePriceRow}>
                <Text style={styles.linePrice}>{rupees(item.pricing?.payable ?? item.sellingPrice)}</Text>
                {item.pricing?.discount > 0 ? <Text style={styles.lineStrike}>{rupees(item.pricing.lineTotal)}</Text> : null}
              </View>
              {!item.inStock ? <Pill tone="danger" style={{ alignSelf: "flex-start", marginTop: 4 }}>Only {item.available} left</Pill> : null}
            </View>

            <View style={styles.lineActions}>
              <QtyStepper
                soft
                compact
                quantity={item.quantity}
                step={item.stepQty ?? 1}
                min={item.minOrderQty ?? 1}
                max={item.maxOrderQty ?? 50}
                unit={unitSuffix(item)}
                busy={Boolean(cart.pending[item.variant])}
                onChange={(q) => cart.setQuantity(item.variant, q).catch(() => {})}
                onRemove={() => cart.remove(item.variant).catch(() => {})}
              />
              <Pressable
                onPress={() => cart.remove(item.variant).catch(() => {})}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name}`}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
              </Pressable>
            </View>
          </Card>
        ))}

        <Pressable onPress={() => navigation.navigate("HomeTab")} style={styles.continueRow} accessibilityRole="link">
          <Ionicons name="arrow-back" size={16} color={colors.primary} />
          <Text style={styles.continueText}>Continue shopping</Text>
        </Pressable>

        {/* Offers & coupons */}
        <Card style={{ padding: spacing.md }}>
          <Pressable style={styles.offerHead} onPress={() => setCouponOpen((v) => !v)} accessibilityRole="button">
            <IconTile name="pricetag-outline" />
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>Offers & coupons</Text>
              <Text style={type.small}>
                {cart.offers.applied.length ? `${cart.offers.applied.length} applied` : "Enter coupon code to get discount"}
              </Text>
            </View>
            <Ionicons name={couponOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
          </Pressable>

          {cart.offers.applied.length ? (
            <View style={{ gap: 6, marginTop: spacing.md }}>
              {cart.offers.applied.map((offer) => (
                <View key={offer.id} style={styles.appliedOffer}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.save} />
                  <Text style={styles.appliedText} numberOfLines={1}>
                    {offer.title}
                    {offer.discount ? ` — saved ${rupees(offer.discount)}` : ""}
                  </Text>
                  {offer.code ? (
                    <Pressable onPress={() => cart.removeCoupon(offer.code).catch(() => {})} hitSlop={8}>
                      <Text style={styles.removeLink}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {/* A stored coupon that no longer qualifies is not in `applied`,
              so the box must stay open to replace it. */}
          {couponOpen && !couponApplied ? (
            <View style={styles.couponRow}>
              <TextInput
                value={code}
                onChangeText={(text) => setCode(text.toUpperCase().replace(/\s/g, ""))}
                placeholder="Coupon code"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                style={styles.couponInput}
              />
              <Button title="Apply" size="sm" loading={applying} disabled={!code.trim()} onPress={applyCoupon} />
            </View>
          ) : null}

          {couponError ? <Notice tone="error" style={{ marginTop: spacing.sm }}>{couponError}</Notice> : null}
          {signedIn ? <CouponPicker onViewAll={() => navigation.navigate("Coupons")} /> : null}
        </Card>

        {/* Bill */}
        <Card style={{ padding: spacing.lg }}>
          <Text style={type.h3}>Bill details</Text>
          <View style={{ marginTop: spacing.md, gap: 10 }}>
            <Row label="Item total" value={rupees(summary.mrpTotal)} />
            {summary.catalogueSavings > 0 ? <Row label="Product discount" value={`− ${rupees(summary.catalogueSavings)}`} tone="save" /> : null}
            {summary.offerDiscount - (summary.rewardDiscount || 0) > 0 ? (
              <Row label="Offer discount" value={`− ${rupees(summary.offerDiscount - (summary.rewardDiscount || 0))}`} tone="save" />
            ) : null}
            {summary.rewardDiscount > 0 ? <Row label="Reward coupon" value={`− ${rupees(summary.rewardDiscount)}`} tone="save" /> : null}
            <Row label="Delivery fee" value={summary.deliveryFree ? "FREE" : rupees(summary.deliveryCharge)} tone={summary.deliveryFree ? "save" : undefined} />
            {summary.packagingCharge > 0 ? <Row label="Packaging" value={rupees(summary.packagingCharge)} /> : null}
            {summary.walletApplied > 0 ? <Row label="Wallet" value={`− ${rupees(summary.walletApplied)}`} tone="save" /> : null}
            {summary.roundOff !== 0 ? <Row label="Round off" value={rupees(summary.roundOff, { decimals: true })} /> : null}
            <Divider style={{ marginVertical: 4, borderStyle: "dashed" }} />
            <Row label="To pay" value={rupees(summary.total)} bold />
          </View>

          {summary.totalSavings > 0 ? (
            <View style={styles.savingsBanner}>
              <Text style={styles.savingsText}>You save {rupees(summary.totalSavings)} on this order</Text>
            </View>
          ) : null}
        </Card>

        {!summary.meetsMinimum ? (
          <Notice tone="warn">
            Minimum order is {rupees(summary.minOrderValue)} — add {rupees(summary.shortfallToMinimum)} more to check out.
          </Notice>
        ) : null}
      </ScrollView>

      <View style={styles.checkoutBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.checkoutTotal}>{rupees(summary.total)}</Text>
          <Text style={type.tiny}>
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </Text>
        </View>
        <Button
          title={signedIn ? "Proceed to checkout" : "Sign in to checkout"}
          icon={signedIn ? undefined : "log-in-outline"}
          disabled={!summary.meetsMinimum}
          onPress={() => navigation.navigate(signedIn ? "Checkout" : "Login")}
          style={{ minWidth: 200 }}
        />
      </View>

      {/* Back button (Android) and a tap on the dimmed backdrop both cancel. */}
      <Modal visible={confirmClear} transparent animationType="fade" onRequestClose={() => setConfirmClear(false)}>
        <Pressable style={styles.confirmBackdrop} onPress={() => setConfirmClear(false)} accessibilityLabel="Cancel">
          <Pressable style={styles.confirmBox} onPress={() => {}} accessibilityViewIsModal>
            <Text style={styles.confirmTitle} accessibilityRole="header">
              Clear your cart?
            </Text>
            <Text style={styles.confirmText}>
              {itemCount === 1 ? "The item" : `All ${itemCount} items`} will be removed from your cart.
            </Text>
            <View style={styles.confirmActions}>
              <Button title="Cancel" variant="outline" onPress={() => setConfirmClear(false)} style={{ flex: 1 }} />
              <Button title="Clear cart" variant="danger" onPress={clearCart} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Row({ label, value, tone, bold }) {
  return (
    <View style={styles.billRow}>
      <Text style={[type.small, { color: colors.textMuted, fontSize: 14 }, bold && styles.billBold]}>{label}</Text>
      <Text style={[{ fontSize: 14, fontWeight: "500", color: colors.text }, bold && { fontSize: 18, fontWeight: "700" }, tone === "save" && { color: colors.save }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  confirmBackdrop: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: "rgba(10, 30, 20, 0.45)" },
  confirmBox: { width: "100%", maxWidth: 400, alignSelf: "center", padding: 22, borderRadius: 16, backgroundColor: colors.surface, ...shadow.card },
  confirmTitle: { fontSize: 19, fontWeight: "700", color: colors.text, marginBottom: 6 },
  confirmText: { fontSize: 14, color: colors.textMuted, marginBottom: 20 },
  confirmActions: { flexDirection: "row", gap: 10 },

  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clear: { flexDirection: "row", alignItems: "center", gap: 4 },
  clearText: { color: colors.primaryDark, fontSize: 13.5, fontWeight: "600" },


  line: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: { width: "100%", height: "100%" },
  lineName: { fontSize: 14.5, fontWeight: "600", color: colors.text },
  linePack: { fontSize: 12.5, color: colors.textFaint },
  linePriceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
  linePrice: { fontSize: 15, fontWeight: "700", color: colors.text },
  lineStrike: { fontSize: 12, color: colors.textFaint, textDecorationLine: "line-through" },
  lineActions: { alignItems: "flex-end", gap: spacing.sm },

  continueRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  continueText: { color: colors.primary, fontWeight: "600", fontSize: 14 },

  offerHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  couponRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, alignItems: "center" },
  couponInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 14,
    letterSpacing: 1,
  },
  appliedOffer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.saveSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    gap: 6,
  },
  appliedText: { color: colors.save, fontSize: 13, fontWeight: "600", flex: 1 },
  removeLink: { color: colors.danger, fontSize: 12.5, fontWeight: "600" },

  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  billBold: { color: colors.text, fontWeight: "700", fontSize: 18 },

  savingsBanner: {
    marginTop: spacing.md,
    backgroundColor: colors.saveSoft,
    borderRadius: radius.md,
    paddingVertical: 9,
    alignItems: "center",
  },
  savingsText: { color: colors.save, fontWeight: "600", fontSize: 13 },

  checkoutBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow.bar,
  },
  checkoutTotal: { fontSize: 20, fontWeight: "700", color: colors.text },
});
