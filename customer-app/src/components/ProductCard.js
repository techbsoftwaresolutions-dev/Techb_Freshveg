import React, { memo, useMemo } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, radius, rupees, shadow, spacing, unitSuffix } from "../theme";
import { Pill } from "./ui";
import QtyStepper from "./QtyStepper";
import { useWishlist } from "../context/WishlistContext";

// The website's product card (website/components/ProductCard.jsx + .card CSS):
// square photo with the admin's quality flags and a heart, a one-line name,
// the pack size, price / struck MRP / "% OFF", and the add control.
//
// `wideAdd` gives the home carousels' full-width "Add to Basket"; listing
// grids keep the compact "Add".
function ProductCard({ product, variant, quantity, busy, onPress, onAdd, onChange, onRemove, width, wideAdd = false }) {
  const { isSaved, toggle } = useWishlist();

  // Listing endpoints return the product with a price band; the detail
  // endpoint returns full variants. Handle both so one card works everywhere.
  const price = variant?.sellingPrice ?? product.priceFrom;
  const mrp = variant?.mrp ?? product.mrpFrom;
  const discount = useMemo(() => (!mrp || mrp <= price ? 0 : Math.round(((mrp - price) / mrp) * 100)), [mrp, price]);

  const image = variant?.media?.[0]?.url || product.media?.[0]?.url || product.primaryImage;
  // `variant` is either a product variant (its `name` is the pack, "500 ml") or
  // a cart line (its `name` is the product; the pack is `variantName`).
  const variantPack = variant && "variantName" in variant ? variant.variantName : variant?.name;
  const packLabel =
    variantPack || product.packLabel || (product.variantCount > 1 ? `${product.variantCount} sizes` : product.unit);
  const outOfStock = variant ? variant.availability?.available <= 0 : product.inStock === false;
  // Best Seller / Trending (`badges`, from the API) first, then the quality
  // flags the admin tags products with — the same chips the website shows.
  const flags = [
    ...(product.badges || []),
    ...(product.tags || []).filter((tag) => /^(fresh|organic|export quality)$/i.test(tag)),
  ].slice(0, 2);
  const saved = isSaved(product.id);

  return (
    <View style={[styles.card, width ? { width } : null]}>
      <Pressable onPress={outOfStock ? undefined : onPress} accessibilityRole="link" accessibilityLabel={product.name}>
        <View style={styles.media}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.noImage}>
              <Ionicons name="leaf-outline" size={34} color={colors.primary} style={{ opacity: 0.45 }} />
            </View>
          )}
          {flags.length && !outOfStock ? (
            <View style={styles.flags}>
              {flags.map((flag, i) => (
                <View key={flag} style={[styles.flag, i === 0 && styles.flagFirst]}>
                  <Text style={[styles.flagText, i === 0 && { color: colors.onPrimary }]}>
                    {flag.replace(/^\w/, (c) => c.toUpperCase())}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {outOfStock ? (
            <View style={styles.outOverlay}>
              <Pill tone="danger">Out of stock</Pill>
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* A wishlist works whether or not the product is in stock right now. */}
      <Pressable
        onPress={() => toggle(product.id, variant?.variant || product.defaultVariant)}
        hitSlop={8}
        style={styles.heart}
        accessibilityRole="button"
        accessibilityLabel={saved ? "Remove from saved" : "Save for later"}
      >
        <Ionicons name={saved ? "heart" : "heart-outline"} size={18} color={saved ? "#E0454F" : colors.text} />
      </Pressable>

      <Pressable style={styles.body} onPress={outOfStock ? undefined : onPress}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.pack} numberOfLines={1}>
          {packLabel || " "}
        </Text>
      </Pressable>

      <View style={[styles.foot, wideAdd && { flexDirection: "column", alignItems: "stretch" }]}>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{rupees(price)}</Text>
          {discount > 0 ? <Text style={styles.mrp}>{rupees(mrp)}</Text> : null}
          {discount > 0 && !outOfStock ? (
            <View style={styles.off}>
              <Text style={styles.offText}>{discount}% OFF</Text>
            </View>
          ) : null}
        </View>
        {!outOfStock ? (
          <View style={wideAdd ? null : styles.addSlot}>
            <QtyStepper
              wide={wideAdd}
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
    </View>
  );
}

// Cards sit in long lists and carousels; re-render only when their own data
// or cart line changes.
export default memo(ProductCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow.card,
  },
  media: { aspectRatio: 1.05, backgroundColor: colors.bg, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  noImage: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceAlt },

  flags: { position: "absolute", top: 7, left: 7, gap: 4, alignItems: "flex-start" },
  flag: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  flagFirst: { backgroundColor: colors.primary },
  flagText: { fontSize: 10.5, fontWeight: "600", color: colors.primaryDark },

  heart: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0A1E14",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },

  outOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  body: { paddingHorizontal: 10, paddingTop: 8 },
  name: { fontSize: 14, fontWeight: "600", color: colors.text },
  pack: { fontSize: 12, color: colors.textFaint, marginTop: 1 },

  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: spacing.sm,
    paddingBottom: 10,
  },
  // Right-aligned, so when a narrow card wraps it under the price it still
  // sits where the website puts it.
  addSlot: { marginLeft: "auto" },
  priceRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 6, rowGap: 2, flexShrink: 1 },
  price: { fontSize: 16, fontWeight: "700", color: colors.primaryDeep },
  mrp: { fontSize: 12, color: colors.textFaint, textDecorationLine: "line-through" },
  off: { backgroundColor: colors.saveSoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  offText: { fontSize: 10.5, fontWeight: "700", color: colors.save },
});
