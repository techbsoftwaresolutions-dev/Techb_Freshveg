import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./AppText";
import { colors, fontFamily, radius, rupees, shadow, spacing, type, unitSuffix } from "../theme";
import { Pill } from "./ui";
import QtyStepper from "./QtyStepper";
import { useStore } from "../context/StoreContext";
import { useWishlist } from "../context/WishlistContext";

// A product card has to answer four things at a glance: what it is, what one
// unit is, what it costs, and how to add it. Everything else is noise on a
// phone-width grid.
export default function ProductCard({ product, variant, quantity, busy, onPress, onAdd, onChange, onRemove, width, fill }) {
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
  const prepTime = store?.deliveryTimeLabel || (store?.prepTimeMinutes ?? store?.settings?.prepTimeMinutes);
  const saved = isSaved(product.id);

  return (
    <Pressable onPress={onPress} style={[styles.card, fill ? { flex: 1 } : null, width ? { width } : null]}>
      <View style={styles.imageBox}>
        {image ? <Image source={{ uri: image }} style={styles.image} resizeMode="contain" /> : null}

        {discount > 0 && !outOfStock ? (
          <View style={styles.offBadge}>
            <Text style={styles.offPct}>{discount}%</Text>
            <Text style={styles.offWord}>OFF</Text>
          </View>
        ) : null}

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

        {outOfStock ? (
          <View style={styles.outOverlay}>
            <Pill tone="danger" style={styles.outOfStockPill}>
              Out of stock
            </Pill>
          </View>
        ) : null}
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>

      {/* Pack size and delivery time share one line to keep the card short. */}
      <View style={styles.metaRow}>
        {packLabel ? (
          <View style={styles.packChip}>
            <Text style={styles.packChipText} numberOfLines={1}>
              {packLabel}
            </Text>
          </View>
        ) : (
          <View />
        )}
        {prepTime ? (
          <Text style={styles.prepTime} numberOfLines={1}>
            {String(prepTime).toUpperCase()}
            {typeof prepTime === "number" ? " MINS" : ""}
          </Text>
        ) : null}
      </View>

      {/* Price on the left, the add control on the right — always on one
          line at the bottom of the card, so a row of cards lines up whether
          a name wraps or not. */}
      <View style={styles.bottomRow}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.price}>{rupees(price)}</Text>
          {discount > 0 ? <Text style={styles.mrp}>{rupees(mrp)}</Text> : <View style={{ height: 14 }} />}
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
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    ...shadow.card,
  },

  imageBox: {
    height: 92,
    borderRadius: radius.md,
    backgroundColor: "#FAFBFC",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 6,
  },
  image: { width: "86%", height: "86%" },

  // A small stacked tag — "13%" over "OFF" — sitting inside the photo's corner.
  offBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    minWidth: 36,
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingTop: 3,
    paddingBottom: 4,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  offPct: { fontSize: 12, lineHeight: 13, fontFamily: fontFamily.extrabold, color: "#fff" },
  offWord: { fontSize: 8.5, lineHeight: 10, fontFamily: fontFamily.bold, color: "rgba(255,255,255,0.92)", letterSpacing: 0.6 },

  saveBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  saveIcon: { fontSize: 15, lineHeight: 17, fontFamily: fontFamily.regular, color: colors.textMuted },
  saveIconActive: { color: colors.danger },

  outOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  outOfStockPill: { paddingVertical: 6 },

  prepTime: {
    fontSize: 9.5,
    fontFamily: fontFamily.bold,
    color: colors.textFaint,
    letterSpacing: 0.3,
    flexShrink: 1,
  },

  name: {
    ...type.body,
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    minHeight: 32,
    lineHeight: 16,
  },

  packChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  packChipText: { fontSize: 10.5, fontFamily: fontFamily.semibold, color: colors.accent },

  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 4 },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: "auto",
    paddingTop: 6,
  },
  price: { fontSize: 15, lineHeight: 19, fontFamily: fontFamily.extrabold, color: colors.text },
  mrp: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fontFamily.regular,
    color: colors.textFaint,
    textDecorationLine: "line-through",
  },
});
