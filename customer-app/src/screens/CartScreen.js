import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { colors, radius, rupees, spacing, type, unitSuffix } from "../theme";
import { Button, Card, Divider, EmptyState, Loading, Notice, Pill } from "../components/ui";
import QtyStepper from "../components/QtyStepper";

export default function CartScreen({ navigation }) {
  const cart = useCart();
  const { signedIn } = useAuth();
  const [code, setCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [applying, setApplying] = useState(false);

  const summary = cart.summary;

  if (cart.loading && !cart.cart) return <Loading label="Loading your cart" />;

  if (!cart.items.length) {
    return (
      <EmptyState
        title="Your cart is empty"
        hint="Add a few things and they will show up here."
        action={<Button title="Start shopping" onPress={() => navigation.navigate("HomeTab")} />}
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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.md }}>
        {/* Free delivery nudge */}
        {summary?.amountToFreeDelivery > 0 ? (
          <Notice tone="info">
            Add {rupees(summary.amountToFreeDelivery)} more for free delivery.
          </Notice>
        ) : summary?.deliveryFree ? (
<Notice tone="save">Free delivery unlocked</Notice>
        ) : null}

        {cart.unavailable.length ? (
          <Notice tone="error">
            {cart.unavailable.length} item{cart.unavailable.length === 1 ? "" : "s"} went out of
            stock and won't be ordered.
          </Notice>
        ) : null}

        {/* Lines */}
        <Card style={{ padding: 0 }}>
          {cart.items.map((item, index) => (
            <View key={item.itemId}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.line}>
                <View style={styles.thumb}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.thumbImage} resizeMode="contain" />
                  ) : null}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={type.tiny}>{item.variantName || item.unit}</Text>

                  <View style={styles.linePriceRow}>
                    <Text style={styles.linePrice}>{rupees(item.pricing?.payable ?? item.sellingPrice)}</Text>
                    {item.pricing?.discount > 0 ? (
                      <Text style={styles.lineStrike}>{rupees(item.pricing.lineTotal)}</Text>
                    ) : null}
                  </View>

                  {!item.inStock ? <Pill tone="danger">Only {item.available} left</Pill> : null}
                </View>

                <QtyStepper
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
              </View>
            </View>
          ))}
        </Card>

        {/* Coupon */}
        <Card style={{ padding: spacing.md }}>
          <Text style={type.h3}>Offers</Text>

          {cart.offers.applied.length ? (
            <View style={{ gap: 6, marginTop: spacing.sm }}>
              {cart.offers.applied.map((offer) => (
                <View key={offer.id} style={styles.appliedOffer}>
                  <Text style={styles.appliedText} numberOfLines={1}>
                    {offer.title}
                    {offer.discount ? ` — saved ${rupees(offer.discount)}` : ""}
                  </Text>
                  {offer.code ? (
                    <Pressable onPress={() => cart.removeCoupon().catch(() => {})}>
                      <Text style={styles.removeLink}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {!cart.cart?.couponCode ? (
            <View style={styles.couponRow}>
              <TextInput
                value={code}
                onChangeText={(text) => setCode(text.toUpperCase().replace(/\s/g, ""))}
                placeholder="Coupon code"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                style={styles.couponInput}
              />
              <Button title="Apply" size="sm" variant="outline" loading={applying} disabled={!code.trim()} onPress={applyCoupon} />
            </View>
          ) : null}

          {couponError ? <Notice tone="error" style={{ marginTop: spacing.sm }}>{couponError}</Notice> : null}
        </Card>

        {/* Bill */}
        <Card style={{ padding: spacing.md }}>
          <Text style={type.h3}>Bill details</Text>
          <View style={{ marginTop: spacing.sm, gap: 6 }}>
            <Row label="Item total" value={rupees(summary.mrpTotal)} />
            {summary.catalogueSavings > 0 ? (
              <Row label="Catalogue savings" value={`− ${rupees(summary.catalogueSavings)}`} tone="save" />
            ) : null}
            {summary.offerDiscount > 0 ? (
              <Row label="Offer discount" value={`− ${rupees(summary.offerDiscount)}`} tone="save" />
            ) : null}
            <Row
              label="Delivery"
              value={summary.deliveryFree ? "FREE" : rupees(summary.deliveryCharge)}
              tone={summary.deliveryFree ? "save" : undefined}
            />
            {summary.packagingCharge > 0 ? (
              <Row label="Packaging" value={rupees(summary.packagingCharge)} />
            ) : null}
            {summary.walletApplied > 0 ? (
              <Row label="Wallet" value={`− ${rupees(summary.walletApplied)}`} tone="save" />
            ) : null}
            {summary.roundOff !== 0 ? (
              <Row label="Round off" value={rupees(summary.roundOff, { decimals: true })} />
            ) : null}

            <Divider style={{ marginVertical: spacing.sm }} />
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
            Minimum order is {rupees(summary.minOrderValue)} — add {rupees(summary.shortfallToMinimum)} more
            to check out.
          </Notice>
        ) : null}
      </ScrollView>

      <View style={styles.checkoutBar}>
        <View style={{ flex: 1 }}>
          <Text style={type.tiny}>Total</Text>
          <Text style={styles.checkoutTotal}>{rupees(summary.total)}</Text>
        </View>
        <Button
          title={signedIn ? "Checkout" : "Sign in to checkout"}
          disabled={!summary.meetsMinimum}
          onPress={() => navigation.navigate(signedIn ? "Checkout" : "Login")}
        />
      </View>
    </View>
  );
}

function Row({ label, value, tone, bold }) {
  return (
    <View style={styles.billRow}>
      <Text style={[type.small, bold && styles.billBold]}>{label}</Text>
      <Text
        style={[
          type.body,
          { fontWeight: bold ? "800" : "600" },
          bold && { fontSize: 16 },
          tone === "save" && { color: colors.save },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  line: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: { width: "100%", height: "100%" },
  lineName: { ...type.body, fontWeight: "600", fontSize: 13.5 },
  linePriceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 3 },
  linePrice: { fontSize: 14, fontWeight: "800", color: colors.text },
  lineStrike: { fontSize: 11.5, color: colors.textFaint, textDecorationLine: "line-through" },

  couponRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" },
  couponInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 13.5,
    letterSpacing: 1,
  },
  appliedOffer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.saveSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: spacing.sm,
  },
  appliedText: { color: colors.save, fontSize: 12.5, fontWeight: "700", flex: 1 },
  removeLink: { color: colors.danger, fontSize: 12, fontWeight: "700" },

  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  billBold: { color: colors.text, fontWeight: "800", fontSize: 14 },

  savingsBanner: {
    marginTop: spacing.md,
    backgroundColor: colors.saveSoft,
    borderRadius: radius.sm,
    paddingVertical: 7,
    alignItems: "center",
  },
  savingsText: { color: colors.save, fontWeight: "800", fontSize: 12.5 },

  checkoutBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkoutTotal: { fontSize: 18, fontWeight: "800", color: colors.text },
});
