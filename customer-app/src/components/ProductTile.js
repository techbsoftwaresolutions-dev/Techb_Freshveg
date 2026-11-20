import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./AppText";
import { colors, fontFamily, radius, rupees, spacing, type, unitSuffix } from "../theme";
import QtyStepper from "./QtyStepper";
import { useStore } from "../context/StoreContext";
import { useWishlist } from "../context/WishlistContext";

// The product as a flat tile on the listing screen: a large picture, the pack
// size and ADD straddling its bottom edge, then price, name and delivery time.
// No card border — the whitespace does the separating.
export default function ProductTile({ product, variant, quantity, busy, onPress, onAdd, onChange, onRemove }) {
  const { store } = useStore();
  const { isSaved, toggle } = useWishlist();

  const price = variant?.sellingPrice ?? product.priceFrom;
  const mrp = variant?.mrp ?? product.mrpFrom;
  const discount = useMemo(() => (!mrp || mrp <= price ? 0 : Math.round(((mrp - price) / mrp) * 100)), [mrp, price]);

  const image = variant?.media?.[0]?.url || product.media?.[0]?.url || product.primaryImage;
  const packLabel = variant?.name || product.packLabel || (product.variantCount > 1 ? `${product.variantCount} sizes` : product.unit);
  const outOfStock = variant ? variant.availability?.available <= 0 : product.inStock === false;
  const prep = store?.deliveryTimeLabel || (store?.prepTimeMinutes ?? store?.settings?.prepTimeMinutes);
  const prepText = prep ? (typeof prep === "number" ? `${prep} mins` : String(prep).replace(/\bmin\b/, "mins")) : "";
  const saved = isSaved(product.id);

  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <View style={styles.imageBox}>
        {image ? <Image source={{ uri: image }} style={[styles.image, outOfStock && { opacity: 0.45 }]} resizeMode="contain" /> : null}

        {discount > 0 && !outOfStock ? (
          <View style={styles.offBadge}>
            <Text style={styles.offPct}>{discount}%</Text>
            <Text style={styles.offWord}>OFF</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => toggle(product.id, variant?.variant || product.defaultVariant)}
          hitSlop={8}
          style={styles.saveBtn}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Remove from saved" : "Save for later"}
        >
          <Text style={[styles.saveIcon, saved && styles.saveIconActive]}>{saved ? "♥" : "♡"}</Text>
        </Pressable>

      </View>

      <View style={styles.packRow}>
        {outOfStock ? (
          <View style={styles.soldOut}>
            <Text style={styles.soldOutText}>Out of stock</Text>
          </View>
        ) : (
          <QtyStepper
            tile
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
        )}
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceTag}>
          <Text style={styles.price}>{rupees(price)}</Text>
        </View>
        {discount > 0 ? <Text style={styles.mrp}>{rupees(mrp)}</Text> : null}
      </View>

      <Text style={styles.name} numberOfLines={2}>{product.name}</Text>

      <View style={styles.timeRow}>
        {packLabel ? <Text style={styles.packText} numberOfLines={1}>{packLabel}</Text> : null}
        {packLabel && prepText ? <Text style={styles.timeDot}>·</Text> : null}
        {prepText ? (
          <>
            <Text style={styles.timeGlyph}>◷</Text>
            <Text style={styles.timeText}>{prepText}</Text>
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1 },

  imageBox: {
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: "#F4F6F5",
    borderWidth: 1,
    borderColor: "#E9ECEB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "84%", height: "84%" },

  offBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    minWidth: 32,
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 9,
    paddingHorizontal: 5,
    paddingTop: 3,
    paddingBottom: 4,
  },
  offPct: { fontSize: 11, lineHeight: 12, fontFamily: fontFamily.extrabold, color: "#fff" },
  offWord: { fontSize: 7.5, lineHeight: 9, fontFamily: fontFamily.bold, color: "rgba(255,255,255,0.92)", letterSpacing: 0.6 },

  saveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  saveIcon: { fontSize: 16, lineHeight: 18, fontFamily: fontFamily.regular, color: colors.textMuted },
  saveIconActive: { color: colors.danger },

  // Same size and place as ADD, greyed out, so a sold-out tile lines up with its neighbours.
  soldOut: { height: 30, paddingHorizontal: 10, borderRadius: 9, backgroundColor: "#F1F3F4", borderWidth: 1.5, borderColor: "#D5D9DC", alignItems: "center", justifyContent: "center" },
  soldOutText: { color: "#7B838B", fontSize: 11, fontFamily: fontFamily.bold },

  // Straddles the picture's bottom edge.
  packRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: -15, paddingHorizontal: 6 },
  packText: { fontSize: 11, fontFamily: fontFamily.bold, color: colors.text, flexShrink: 1 },
  timeDot: { color: colors.textFaint, fontSize: 11 },

  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  priceTag: { backgroundColor: colors.primarySoft, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  price: { fontSize: 15, lineHeight: 20, fontFamily: fontFamily.extrabold, color: colors.text },
  mrp: { fontSize: 11, color: colors.textFaint, textDecorationLine: "line-through" },

  name: { ...type.body, fontFamily: fontFamily.semibold, fontSize: 12.5, lineHeight: 16, marginTop: 3 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, flexWrap: "nowrap" },
  timeGlyph: { fontSize: 11, color: colors.textMuted },
  timeText: { fontSize: 11, fontFamily: fontFamily.semibold, color: colors.textMuted, flexShrink: 0 },
});
