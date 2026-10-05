import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
            <Pressable
              key={category.id}
              onPress={() => setActiveIndex(index)}
              style={[styles.railItem, isActive && styles.railItemActive]}
            >
              <View style={[styles.railIcon, { backgroundColor: tileColor }]}>
                {category.image ? (
                  <Image source={{ uri: category.image }} style={styles.railIconImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.railIconGlyph}>{category.icon || "•"}</Text>
                )}
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
        <Pressable
          style={styles.ctaCard}
          onPress={() => navigation.navigate("ProductList", { slug: active.slug, title: active.name })}
        >
          <View style={styles.ctaTextWrap}>
            <Text style={styles.ctaText}>
              Browse all{"\n"}
              {active.name} {active.productCount ? `(${active.productCount})` : ""}
            </Text>
          </View>
          <View style={styles.ctaArrow}>
            <Text style={styles.ctaArrowGlyph}>→</Text>
          </View>
        </Pressable>

        <View style={styles.pillRow}>
          <Pressable
            style={styles.pill}
            onPress={() =>
              navigation.navigate("ProductList", { slug: active.slug, title: active.name, openFilter: true })
            }
          >
            <Text style={styles.pillText}>Filter</Text>
          </Pressable>
          <Pressable
            style={styles.pill}
            onPress={() =>
              navigation.navigate("ProductList", { slug: active.slug, title: active.name, openSort: true })
            }
          >
            <Text style={styles.pillText}>Sort By ▾</Text>
          </Pressable>
        </View>

        {active.children?.length ? (
          <View style={styles.statList}>
            {active.children.map((child, index) => (
              <Pressable
                key={child.id}
                style={styles.statCard}
                onPress={() => navigation.navigate("ProductList", { slug: child.slug, title: child.name })}
              >
                <View style={[styles.statIcon, { backgroundColor: STAT_COLORS[index % STAT_COLORS.length] }]}>
                  {child.image ? (
                    <Image source={{ uri: child.image }} style={styles.statIconImage} resizeMode="cover" />
                  ) : (
                    <Text style={styles.statIconGlyph}>{child.icon || "•"}</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.statTitle} numberOfLines={1}>
                    {child.name}
                  </Text>
                  {child.productCount ? (
                    <Text style={styles.statSub}>
                      {child.productCount} {child.productCount === 1 ? "item" : "items"}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <Notice tone="info" style={{ marginTop: spacing.md }}>
            {active.name} has no subcategories — tap above to see everything in it.
          </Notice>
        )}

        {freeDeliveryAbove ? (
          <View style={styles.promoStrip}>
            <Text style={styles.promoText}>
              Free delivery on orders above <Text style={styles.promoBold}>{rupees(freeDeliveryAbove)}</Text>
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

  rail: { width: 92, flexGrow: 0, flexShrink: 0, backgroundColor: colors.surfaceAlt, paddingVertical: spacing.sm, paddingBottom: spacing.xxl },
  railItem: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 6, gap: 7, marginHorizontal: 6, marginBottom: 2, borderRadius: radius.lg },
  railItemActive: { backgroundColor: colors.accentSoft },
  railIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  railIconImage: { width: "100%", height: "100%" },
  railIconGlyph: { fontSize: 22, color: "#fff" },
  railLabel: { fontSize: 10.8, lineHeight: 13.5, fontFamily: fontFamily.bold, color: colors.textMuted, textAlign: "center" },
  railLabelActive: { color: colors.text },

  panel: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingBottom: spacing.xxl },

  ctaCard: {
    backgroundColor: colors.saveSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: spacing.md,
  },
  // A Text sibling in a row, with no width of its own, can mis-measure and
  // wrap after just a word or two — this View is what actually gives it
  // something to measure against, with the arrow button pinned at a fixed
  // size beside it rather than squeezed by whatever the text decides.
  ctaTextWrap: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
  ctaText: { fontSize: 18, lineHeight: 23, fontFamily: fontFamily.extrabold, color: colors.save },
  ctaArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ctaArrowGlyph: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.save },

  pillRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  pill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontSize: 12, fontFamily: fontFamily.bold, color: colors.text },

  statList: { gap: spacing.sm },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  statIconImage: { width: "100%", height: "100%" },
  statIconGlyph: { fontSize: 18, color: "#fff" },
  statTitle: { fontSize: 13.5, fontFamily: fontFamily.extrabold, color: colors.text },
  statSub: { fontSize: 11, fontFamily: fontFamily.semibold, color: colors.textMuted, marginTop: 1 },

  promoStrip: {
    backgroundColor: "#111417",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  promoText: { fontSize: 11.5, fontFamily: fontFamily.semibold, color: "#fff" },
  promoBold: { fontFamily: fontFamily.extrabold, color: "#64E0B4" },
});
