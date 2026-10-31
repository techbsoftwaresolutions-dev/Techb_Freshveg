import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../components/AppText";
import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import { useStore } from "../context/StoreContext";
import { colors, fontFamily, radius, rupees, spacing, type, unitSuffix } from "../theme";
import { Button, Card, Divider, EmptyState, Loading, Notice, Pill } from "../components/ui";
import QtyStepper from "../components/QtyStepper";
import ProductCard from "../components/ProductCard";
import CustomerReviews from "../components/CustomerReviews";
import ShareRow from "../components/ShareRow";

export default function ProductDetailScreen({ route, navigation }) {
  const { slug } = route.params;
  const { storeId } = useStore();
  const cart = useCart();

  const [data, setData] = useState(null);
  // One or several packs can be ticked at once; the first one drives the
  // single-pack price card, and with two or more each gets its own row.
  const [selectedIds, setSelectedIds] = useState([]);
  const variantId = selectedIds[0] || null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryWidth, setGalleryWidth] = useState(Dimensions.get("window").width);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/storefront/products/${slug}`, { store: storeId || undefined })
      .then((detail) => {
        setData(detail);
        const preferred =
          detail.variants.find((v) => v.id === detail.product.defaultVariant) ||
          detail.variants.find((v) => v.availability?.available > 0) ||
          detail.variants[0];
        setSelectedIds(preferred?.id ? [preferred.id] : []);
        navigation.setOptions({ title: detail.product.name });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, storeId, navigation]);

  const variant = useMemo(
    () => data?.variants.find((v) => v.id === variantId) || null,
    [data, variantId]
  );

  const picked = useMemo(
    () => (data?.variants || []).filter((v) => selectedIds.includes(v.id)),
    [data, selectedIds]
  );
  const multi = picked.length > 1;

  // A sold-out pack can be looked at, but only on its own.
  const togglePack = (option) => {
    if ((option.availability?.available ?? 0) <= 0) return setSelectedIds([option.id]);
    setSelectedIds((current) => {
      const live = current.filter((id) => (data.variants.find((v) => v.id === id)?.availability?.available ?? 0) > 0);
      if (live.includes(option.id)) return live.length > 1 ? live.filter((id) => id !== option.id) : live;
      return [...live, option.id];
    });
  };

  const line = cart.items.find((i) => String(i.variant) === String(variantId));
  const quantity = line?.quantity || 0;
  const available = variant?.availability?.available ?? 0;
  const outOfStock = available <= 0;

  if (loading) return <Loading />;
  if (error || !data) {
    return <EmptyState title="Couldn't load this item" hint={error} />;
  }

  const { product, specs, features, related } = data;
  const discount = variant?.mrp > variant?.sellingPrice
    ? Math.round(((variant.mrp - variant.sellingPrice) / variant.mrp) * 100)
    : 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={styles.gallery} onLayout={(e) => setGalleryWidth(e.nativeEvent.layout.width)}>
          {product.media?.length ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = galleryWidth ? Math.round(e.nativeEvent.contentOffset.x / galleryWidth) : 0;
                setGalleryIndex(index);
              }}
            >
              {product.media.map((item, index) => (
                <Image
                  key={item.url || index}
                  source={{ uri: item.url }}
                  style={[styles.image, { width: galleryWidth }]}
                  resizeMode="contain"
                />
              ))}
            </ScrollView>
          ) : null}
          {product.media?.length > 1 ? (
            <View style={styles.galleryDots}>
              {product.media.map((_, index) => (
                <View
                  key={index}
                  style={[styles.galleryDot, index === galleryIndex && styles.galleryDotActive]}
                />
              ))}
            </View>
          ) : null}
          {discount > 0 ? (
            <View style={styles.discountRibbon}>
              <Text style={styles.discountPct}>{discount}%</Text>
              <Text style={styles.discountWord}>OFF</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={type.h1}>{product.name}</Text>
          {product.brand?.name ? <Text style={styles.brand}>by {product.brand.name}</Text> : null}

          {product.shortDescription ? (
            <Text style={[type.small, { marginTop: spacing.sm }]}>{product.shortDescription}</Text>
          ) : null}

          {/* Badges driven by the category's capability flags — a perishable
              department gets a freshness line, a batch-tracked one does not. */}
          <View style={styles.badgeRow}>
 {features?.perishable ?<Pill tone="primary"> Fresh stock</Pill> : null}
            {product.attributes?.organic ? <Pill tone="save">Organic</Pill> : null}
            {features?.returnable ? (
              <Pill>
                {product.returnWindowDays
                  ? `${product.returnWindowDays}-day return`
                  : "Returnable"}
              </Pill>
            ) : (
              <Pill tone="warn">No returns</Pill>
            )}
            {features?.allowSubstitution ? <Pill>Substitution allowed</Pill> : null}
          </View>

          {/* Variants */}
          {data.variants.length > 1 ? (
            <>
              <Text style={styles.sectionTitle}>Choose a pack</Text>
              <View style={styles.variantRow}>
                {data.variants.map((option) => {
                  const isSelected = selectedIds.includes(option.id);
                  const soldOut = (option.availability?.available ?? 0) <= 0;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => togglePack(option)}
                      style={[
                        styles.variantChip,
                        isSelected && styles.variantChipActive,
                        soldOut && { opacity: 0.45 },
                      ]}
                    >
                      <Text style={[styles.variantName, isSelected && { color: colors.primaryDark }]}>
                        {option.name}
                      </Text>
                      <Text style={[styles.variantPrice, isSelected && { color: colors.primaryDark }]}>
                        {rupees(option.sellingPrice)}
                      </Text>
                      {soldOut ? <Text style={styles.variantSoldOut}>Sold out</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {/* Several packs picked: one row each, with its own quantity. */}
          {multi ? (
            <Card style={styles.multiCard}>
              {picked.map((option, index) => {
                const optionLine = cart.items.find((i) => String(i.variant) === String(option.id));
                const optionAvailable = option.availability?.available ?? 0;
                const off = option.mrp > option.sellingPrice;
                return (
                  <View key={option.id}>
                    {index > 0 ? <Divider /> : null}
                    <View style={styles.multiRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.multiName} numberOfLines={1}>
                          {option.name}
                        </Text>
                        <View style={styles.priceRow}>
                          <Text style={styles.multiPrice}>{rupees(option.sellingPrice)}</Text>
                          {off ? <Text style={styles.multiMrp}>{rupees(option.mrp)}</Text> : null}
                        </View>
                      </View>
                      <QtyStepper
                        quantity={optionLine?.quantity || 0}
                        step={option.stepQty ?? 1}
                        min={option.minOrderQty ?? 1}
                        max={Math.min(option.maxOrderQty ?? 50, optionAvailable)}
                        unit={unitSuffix(option)}
                        busy={Boolean(cart.pending[option.id])}
                        onAdd={() => cart.add(option.id).catch(() => {})}
                        onChange={(q) => cart.setQuantity(option.id, q).catch(() => {})}
                        onRemove={() => cart.remove(option.id).catch(() => {})}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>
          ) : null}

          {/* Price */}
          {!multi ? (
          <Card style={styles.priceCard}>
            <View style={{ flex: 1 }}>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{rupees(variant?.sellingPrice)}</Text>
                {discount > 0 ? <Text style={styles.mrp}>{rupees(variant.mrp)}</Text> : null}
              </View>
              {variant?.unitPrice ? (
                // Lets someone compare a 1 kg pack against a 5 kg one honestly.
                <Text style={type.tiny}>
                  {rupees(variant.unitPrice.amount)} per {variant.unitPrice.unit}
                </Text>
              ) : null}
              <Text style={[type.tiny, { marginTop: 2 }]}>Inclusive of all taxes</Text>
            </View>

            {outOfStock ? (
              <Pill tone="danger">Out of stock</Pill>
            ) : (
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <QtyStepper
                  quantity={quantity}
                  step={variant?.stepQty ?? 1}
                  min={variant?.minOrderQty ?? 1}
                  max={Math.min(variant?.maxOrderQty ?? 50, available)}
                  unit={unitSuffix(variant)}
                  busy={Boolean(cart.pending[variantId])}
                  onAdd={() => cart.add(variantId).catch(() => {})}
                  onChange={(q) => cart.setQuantity(variantId, q).catch(() => {})}
                  onRemove={() => cart.remove(variantId).catch(() => {})}
                />
                {available <= 5 ? (
                  <Text style={styles.lowStock}>Only {available} left</Text>
                ) : null}
              </View>
            )}
          </Card>
          ) : null}

          {cart.error ? <Notice tone="error" style={{ marginTop: spacing.md }}>{cart.error}</Notice> : null}

          {/* Specs — labels and grouping come from the category's schema, so a
              hair clip and a bag of rice both render here without a branch. */}
          {specs?.length ? (
            <>
              <Text style={styles.sectionTitle}>Product details</Text>
              <Card style={{ padding: 0 }}>
                {specs.map((spec, index) => (
                  <View key={spec.label}>
                    {index > 0 ? <Divider /> : null}
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>{spec.label}</Text>
                      <Text style={styles.specValue}>
                        {formatSpec(spec.value)}
                        {spec.unit ? ` ${spec.unit}` : ""}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <ShareRow slug={product.slug || slug} name={product.name} />

          {product.description ? (
            <>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={type.body}>{product.description}</Text>
            </>
          ) : null}

          <CustomerReviews
            productId={product.id}
            ratingAverage={product.rating?.average || 0}
            ratingCount={product.rating?.count || 0}
          />

          {related?.length ? (
            <>
              <Text style={styles.sectionTitle}>You might also like</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
                {related.map((item) => {
                  const relatedVariantId = item.defaultVariant;
                  const relatedLine = cart.items.find((i) => String(i.variant) === String(relatedVariantId));
                  return (
                    <ProductCard
                      key={item.id}
                      width={150}
                      product={item}
                      variant={relatedLine}
                      quantity={relatedLine?.quantity || 0}
                      busy={Boolean(cart.pending[relatedVariantId])}
                      onPress={() => navigation.push("ProductDetail", { slug: item.slug })}
                      onAdd={() => cart.add(relatedVariantId).catch(() => {})}
                      onChange={(q) => cart.setQuantity(relatedVariantId, q).catch(() => {})}
                      onRemove={() => cart.remove(relatedVariantId).catch(() => {})}
                    />
                  );
                })}
              </ScrollView>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky cart bar, so the way out of a deep product page is always
          visible. */}
      {cart.count > 0 ? (
        <View style={styles.cartBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cartBarCount}>
              {cart.lineCount} item{cart.lineCount === 1 ? "" : "s"}
            </Text>
            <Text style={styles.cartBarTotal}>{rupees(cart.summary?.total)}</Text>
          </View>
          <Button title="View cart" onPress={() => navigation.navigate("CartTab")} />
        </View>
      ) : null}
    </View>
  );
}

function formatSpec(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  gallery: {
    height: 230,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryDots: {
    position: "absolute",
    bottom: 10,
    flexDirection: "row",
    alignSelf: "center",
    gap: 6,
  },
  galleryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  galleryDotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },
  image: { width: "100%", height: "100%" },
  // The same small stacked tag as on the product cards — "13%" over "OFF".
  discountRibbon: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    minWidth: 46,
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 5,
    borderWidth: 2,
    borderColor: "#fff",
  },
  discountPct: { color: "#fff", fontFamily: fontFamily.extrabold, fontSize: 15, lineHeight: 17 },
  discountWord: { color: "rgba(255,255,255,0.92)", fontFamily: fontFamily.bold, fontSize: 10, lineHeight: 12, letterSpacing: 0.8 },

  body: { padding: spacing.lg },
  brand: { ...type.small, marginTop: 2 },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md },

  sectionTitle: { ...type.h2, marginTop: spacing.xl, marginBottom: spacing.md },

  multiCard: { padding: 0, marginTop: spacing.md },
  multiRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  multiName: { fontSize: 14, fontWeight: "700", color: colors.text },
  multiPrice: { fontSize: 15, fontWeight: "800", color: colors.text },
  multiMrp: { fontSize: 12, color: colors.textFaint, textDecorationLine: "line-through" },
  variantRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  variantChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 82,
  },
  variantChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  variantName: { fontSize: 13, fontWeight: "700", color: colors.text },
  variantPrice: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  variantSoldOut: { fontSize: 10, color: colors.danger, marginTop: 1 },

  priceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  price: { fontSize: 22, fontWeight: "800", color: colors.text },
  mrp: { fontSize: 14, color: colors.textFaint, textDecorationLine: "line-through" },
  lowStock: { fontSize: 10.5, color: colors.danger, fontWeight: "700" },

  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  specLabel: { ...type.small, flex: 1 },
  specValue: { ...type.body, fontWeight: "600", flexShrink: 1, textAlign: "right" },

  cartBar: {
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
  cartBarCount: { ...type.tiny },
  cartBarTotal: { fontSize: 16, fontWeight: "800", color: colors.text },
});
