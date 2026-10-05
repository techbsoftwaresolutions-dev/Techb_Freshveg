import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamily, radius, rupees, spacing, type, unitSuffix } from "../theme";
import { Pill } from "./ui";
import QtyStepper from "./QtyStepper";
import { useStore } from "../context/StoreContext";
import { useWishlist } from "../context/WishlistContext";

// A product card has to answer four things at a glance: what it is, what one
// unit is, what it costs, and how to add it. Everything else is noise on a
// phone-width grid.
export default function ProductCard({ product, variant, quantity, busy, onPress, onAdd, onChange, onRemove, width }) {
  const { store } = useStore();
  const { isSaved, toggle } = useWishlist();

  // Listing endpoints return the product with a price band; the detail
  // endpoint returns full variants. Handle both so one card works everywhere.
  const price = variant?.sellingPrice ?? product.priceFrom;
  const mrp = variant?.mrp ?? product.mrpFrom;
  const discount = useMemo(() => {
    if (!mrp || mrp <= price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  }, [mrp, price]);

  const image = variant?.media?.[0]?.url || product.media?.[0]?.url || product.primaryImage;
  const packLabel =
    variant?.name || product.packLabel || (product.variantCount > 1 ? `${product.variantCount} sizes` : product.unit);
  const outOfStock = variant ? variant.availability?.available <= 0 : product.inStock === false;
  // Real, not a placeholder — the store's own prep-time estimate, the same
  // number the home screen's header pill shows. Only rendered when it's
  // actually present, rather than defaulting to a made-up "12 MINS".
  const prepTime = store?.prepTimeMinutes ?? store?.settings?.prepTimeMinutes;
  const saved = isSaved(product.id);

  return (
    <Pressable onPress={onPress} style={[styles.card, width ? { width } : null]}>
      <View style={styles.imageWrap}>
        <View style={styles.imageBox}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} resizeMode="contain" />
          ) : null}

          {outOfStock ? (
            <View style={styles.outOverlay}>
              <Pill tone="danger" style={styles.outOfStockPill}>
                Out of stock
              </Pill>
            </View>
          ) : null}
        </View>

        {/* Saved items work whether or not the product is in stock right
            now — that's what a wishlist is for, a "remind me" rather than
            an add-to-cart shortcut. */}
        <Pressable
          onPress={() => toggle(product.id, variant?.variant || product.defaultVariant)}
          hitSlop={8}
          style={styles.saveBtn}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Remove from saved" : "Save for later"}
        >
          <Text style={[styles.saveIcon, saved && styles.saveIconActive]}>{saved ? "♥" : "♡"}</Text>
        </Pressable>

        {!outOfStock ? (
          <View style={styles.quickAdd}>
            <QtyStepper
              overlay
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
          </View>
        ) : null}
      </View>

      {prepTime ? <Text style={styles.prepTime}>{prepTime} MINS</Text> : null}

      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>

      {packLabel ? (
        <View style={styles.packChip}>
          <Text style={styles.packChipText} numberOfLines={1}>
            {packLabel}
          </Text>
        </View>
      ) : null}

      {discount > 0 && !outOfStock ? <Text style={styles.discountLine}>{discount}% OFF</Text> : null}

      <View style={styles.priceRow}>
        <Text style={styles.price}>{rupees(price)}</Text>
        {discount > 0 ? <Text style={styles.mrp}>{rupees(mrp)}</Text> : null}
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

  // Overflow stays visible here — the save button and the quick-add circle
  // both straddle the image's bottom/top edge on purpose, so clipping can't
  // live on this wrapper (it lives on imageBox instead, around just the
  // photo).
  imageWrap: { position: "relative", marginBottom: spacing.md },
  imageBox: {
    height: 118,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },

  saveBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  saveIcon: { fontSize: 15, lineHeight: 17, fontFamily: fontFamily.regular, color: colors.textMuted },
  saveIconActive: { color: colors.danger },

  quickAdd: { position: "absolute", right: 6, bottom: -14 },

  outOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 30,
  },
  outOfStockPill: { paddingVertical: 6 },

  prepTime: {
    fontSize: 10.5,
    fontFamily: fontFamily.semibold,
    color: colors.textFaint,
    letterSpacing: 0.3,
    marginBottom: 2,
  },

  name: {
    ...type.body,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    minHeight: 34,
    lineHeight: 17,
  },

  packChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 3,
    marginBottom: 4,
  },
  packChipText: { fontSize: 10.5, fontFamily: fontFamily.semibold, color: colors.accent },

  discountLine: {
    fontSize: 11.5,
    fontFamily: fontFamily.extrabold,
    color: colors.save,
    marginBottom: 2,
  },

  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
  price: { fontSize: 14, fontFamily: fontFamily.extrabold, color: colors.text },
  mrp: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    color: colors.textFaint,
    textDecorationLine: "line-through",
  },
});
