import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, rupees, spacing, type, unitSuffix } from "../theme";
import { Pill } from "./ui";
import QtyStepper from "./QtyStepper";

// A product card has to answer four things at a glance: what it is, what one
// unit is, what it costs, and how to add it. Everything else is noise on a
// phone-width grid.
export default function ProductCard({ product, variant, quantity, busy, onPress, onAdd, onChange, onRemove, width }) {
  // Listing endpoints return the product with a price band; the detail
  // endpoint returns full variants. Handle both so one card works everywhere.
  const price = variant?.sellingPrice ?? product.priceFrom;
  const mrp = variant?.mrp ?? product.mrpFrom;
  const discount = useMemo(() => {
    if (!mrp || mrp <= price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  }, [mrp, price]);

  const image = variant?.media?.[0]?.url || product.media?.[0]?.url || product.primaryImage;
  const packLabel = variant?.name || (product.variantCount > 1 ? `${product.variantCount} sizes` : product.unit);
  const outOfStock = variant ? variant.availability?.available <= 0 : product.inStock === false;

  return (
    <Pressable onPress={onPress} style={[styles.card, width ? { width } : null]}>
      <View style={styles.imageBox}>
        {/* No image pipeline yet. An empty tinted box is a quieter gap than a
            stand-in picture, and it keeps the grid's rhythm either way. */}
        {image ? (
          <Image source={{ uri: image }} style={styles.image} resizeMode="contain" />
        ) : null}

        {discount > 0 && !outOfStock ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}%{"\n"}OFF</Text>
          </View>
        ) : null}

        {outOfStock ? (
          <View style={styles.outOverlay}>
            <Pill tone="danger">Out of stock</Pill>
          </View>
        ) : null}
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>

      <Text style={styles.pack} numberOfLines={1}>
        {packLabel}
      </Text>

      <View style={styles.footer}>
        <View style={styles.priceBox}>
          <Text style={styles.price}>{rupees(price)}</Text>
          {discount > 0 ? <Text style={styles.mrp}>{rupees(mrp)}</Text> : null}
        </View>

        {!outOfStock ? (
          <QtyStepper
            compact
            quantity={quantity}
            step={variant?.stepQty ?? 1}
            min={variant?.minOrderQty ?? 1}
            max={variant?.maxOrderQty ?? 50}
            unit={unitSuffix(variant)}
            busy={busy}
            onAdd={onAdd}
            onChange={onChange}
            onRemove={onRemove}
          />
        ) : (
          <View style={{ height: 30 }} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  imageBox: {
    height: 96,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  placeholder: { fontSize: 34 },

  discountBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: colors.save,
    borderTopLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  discountText: { color: "#fff", fontSize: 9, fontWeight: "800", lineHeight: 11, textAlign: "center" },

  outOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },

  name: { ...type.body, fontWeight: "600", fontSize: 13, minHeight: 34, lineHeight: 17 },
  pack: { ...type.tiny, marginTop: 1, marginBottom: spacing.sm },

  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  priceBox: { flexShrink: 1 },
  price: { fontSize: 14, fontWeight: "800", color: colors.text },
  mrp: { fontSize: 11, color: colors.textFaint, textDecorationLine: "line-through" },
});
