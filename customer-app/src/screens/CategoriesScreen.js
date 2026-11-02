import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../components/AppText";
import { api } from "../api/client";
import { useStore } from "../context/StoreContext";
import { colors, fontFamily, radius, rupees, spacing, type } from "../theme";
import { EmptyState, Loading, Notice } from "../components/ui";

// A small, repeating palette for the department and subcategory icon tiles —
// categories don't carry a brand color of their own, so this is what stands
// in for the mockup's per-department gradients (no SVG/gradient library in
// this project, so flat color is the honest equivalent).
const RAIL_COLORS = ["#E8714A", "#53925E", "#E8B957", "#D98AA0", "#6E8CB2", "#9A7B56"];
const STAT_COLORS = ["#6D5DF6", "#E6912A", "#1FA98C", "#D9663F", "#2F6BE0", "#C97B8C"];

// Departments down the left, their subcategories on the right — the layout
// every Indian grocery app converged on, because it fits a deep tree on a
// narrow screen. The tree itself comes from the engine, so a new department
// appears here on its own.
export default function CategoriesScreen({ navigation }) {
  const { store } = useStore();
  const [categories, setCategories] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Tile width is worked out from the space actually there, so two always fit
  // side by side — percentages plus a gap can add up to just over 100% and
  // push the second tile onto its own line on some phones.
  const [gridWidth, setGridWidth] = useState(0);
  const tileWidth = gridWidth ? Math.floor((gridWidth - spacing.sm) / 2) : "48%";

  useEffect(() => {
    api
      .get("/storefront/categories", { depth: 3 })
      .then((data) => setCategories(data.categories))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <EmptyState title="Couldn't load categories" hint={error} />;
  if (!categories.length) {
    return <EmptyState title="No categories yet" hint="Create them in the admin." />;
  }

  const active = categories[activeIndex];
  const freeDeliveryAbove = store?.freeDeliveryAbove ?? store?.settings?.freeDeliveryAbove;
  const freeDeliveryOn = (store?.freeDeliveryEnabled ?? store?.settings?.freeDeliveryEnabled) !== false;

  return (
    // One ScrollView for the whole screen — the left department list and the
    // right subcategory panel used to scroll independently of each other,
    // which felt like two separate screens glued together. Now a single
    // swipe moves both at once, like any normal page.
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      {/* Departments */}
      <View style={styles.rail}>
        {categories.map((category, index) => {
          const isActive = index === activeIndex;
          const tileColor = RAIL_COLORS[index % RAIL_COLORS.length];
          return (
            <Pressable key={category.id} onPress={() => setActiveIndex(index)} style={[styles.railItem, isActive && styles.railItemActive]}>
              {isActive ? <View style={styles.railMarker} /> : null}
              <View style={[styles.railRing, isActive && styles.railRingActive]}>
                <View style={[styles.railIcon, { backgroundColor: category.image ? "#fff" : tileColor }]}>
                  {category.image ? (
                    <Image source={{ uri: category.image }} style={styles.railIconImage} resizeMode="cover" />
                  ) : (
                    <Text style={styles.railIconGlyph}>{category.icon || "•"}</Text>
                  )}
                </View>
              </View>
              <Text style={[styles.railLabel, isActive && styles.railLabelActive]} numberOfLines={2}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Subcategories */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle} numberOfLines={1}>
          {active.name}
        </Text>

        <Pressable style={styles.ctaCard} onPress={() => navigation.navigate("ProductList", { slug: active.slug, title: active.name })}>
          <View style={styles.ctaTextWrap}>
            <Text style={styles.ctaKicker}>Browse all</Text>
            <Text style={styles.ctaText} numberOfLines={2}>
              {active.productCount ? `${active.productCount} products` : "See everything"}
            </Text>
          </View>
          <View style={styles.ctaArrow}>
            <Text style={styles.ctaArrowGlyph}>→</Text>
          </View>
        </Pressable>

        <View style={styles.pillRow}>
          <Pressable
            style={styles.pill}
            onPress={() => navigation.navigate("ProductList", { slug: active.slug, title: active.name, openFilter: true })}
          >
            <Text style={styles.pillText}>Filter</Text>
          </Pressable>
          <Pressable
            style={styles.pill}
            onPress={() => navigation.navigate("ProductList", { slug: active.slug, title: active.name, openSort: true })}
          >
            <Text style={styles.pillText}>Sort by ▾</Text>
          </Pressable>
        </View>

        {active.children?.length ? (
          <View style={styles.grid} onLayout={(e) => setGridWidth(Math.floor(e.nativeEvent.layout.width))}>
            {active.children.map((child, index) => (
              <Pressable
                key={child.id}
                style={[styles.tile, { width: tileWidth }]}
                onPress={() => navigation.navigate("ProductList", { slug: child.slug, title: child.name })}
              >
                <View style={[styles.tileIcon, { backgroundColor: child.image ? "#fff" : STAT_COLORS[index % STAT_COLORS.length] }]}>
                  {child.image ? (
                    <Image source={{ uri: child.image }} style={styles.tileIconImage} resizeMode="cover" />
                  ) : (
                    <Text style={styles.tileIconGlyph}>{child.icon || "•"}</Text>
                  )}
                </View>
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {child.name}
                </Text>
                {child.productCount ? (
                  <Text style={styles.tileSub}>
                    {child.productCount} {child.productCount === 1 ? "item" : "items"}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <Notice tone="info" style={{ marginTop: spacing.md }}>
            {active.name} has no subcategories — tap above to see everything in it.
          </Notice>
        )}

        {freeDeliveryOn && freeDeliveryAbove ? (
          <View style={styles.promoStrip}>
            <Text style={styles.promoText}>
              🚚 Free delivery on orders above <Text style={styles.promoBold}>{rupees(freeDeliveryAbove)}</Text>
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { flexDirection: "row", minHeight: "100%" },

  rail: { width: 84, flexGrow: 0, flexShrink: 0, backgroundColor: colors.surface, paddingVertical: spacing.sm, paddingBottom: spacing.xxl, borderRightWidth: 1, borderRightColor: colors.border },
  railItem: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, gap: 6 },
  railItemActive: { backgroundColor: colors.primarySoft },
  railMarker: { position: "absolute", left: 0, top: 12, bottom: 12, width: 3.5, backgroundColor: colors.primary, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  railRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 3,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#0B0F1A",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  railRingActive: { borderColor: colors.primary },
  railIcon: { flex: 1, borderRadius: 24, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  railIconImage: { width: "100%", height: "100%" },
  railIconGlyph: { fontSize: 20, color: "#fff" },
  railLabel: { fontSize: 10.5, lineHeight: 13, fontFamily: fontFamily.semibold, color: colors.textMuted, textAlign: "center" },
  railLabelActive: { color: colors.primaryDark, fontFamily: fontFamily.bold },

  panel: { flex: 1, backgroundColor: colors.bg, padding: spacing.md, paddingBottom: spacing.xxl },
  panelTitle: { fontSize: 17, fontFamily: fontFamily.extrabold, color: colors.text, marginBottom: spacing.sm },

  ctaCard: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  ctaTextWrap: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
  ctaKicker: { fontSize: 11, fontFamily: fontFamily.bold, color: "rgba(255,255,255,0.8)", letterSpacing: 0.6, textTransform: "uppercase" },
  ctaText: { fontSize: 17, lineHeight: 22, fontFamily: fontFamily.extrabold, color: "#fff", marginTop: 1 },
  ctaArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  ctaArrowGlyph: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.primaryDark },

  pillRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  pill: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 32, alignItems: "center", justifyContent: "center" },
  pillText: { fontSize: 12, fontFamily: fontFamily.semibold, color: colors.textMuted },

  // Two to a row — a tile with a round picture, its name and how many items.
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 6,
  },
  tileIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tileIconImage: { width: "100%", height: "100%" },
  tileIconGlyph: { fontSize: 24, color: "#fff" },
  tileTitle: { fontSize: 13, lineHeight: 16, fontFamily: fontFamily.bold, color: colors.text, textAlign: "center", minHeight: 16 },
  tileSub: { fontSize: 10.5, fontFamily: fontFamily.semibold, color: colors.textMuted },

  promoStrip: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  promoText: { fontSize: 12, fontFamily: fontFamily.semibold, color: colors.text },
  promoBold: { fontFamily: fontFamily.extrabold, color: colors.primaryDark },
});
