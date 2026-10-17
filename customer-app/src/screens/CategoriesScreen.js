import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../components/Text";
import { api } from "../api/client";
import { useStore } from "../context/StoreContext";
import { colors, fontFamily, radius, rupees, shadow, spacing } from "../theme";
import { EmptyState, Loading, Notice } from "../components/ui";
import { useTabBarScroll, useTabBarSpace } from "../navigation/tabBarScroll";

// A small, repeating palette for the department and subcategory icon tiles —
// categories don't carry a brand color of their own, so this is what stands
// in for the mockup's per-department gradients (no SVG/gradient library in
// this project, so flat color is the honest equivalent).

// Departments down the left, their subcategories on the right — the layout
// every Indian grocery app converged on, because it fits a deep tree on a
// narrow screen. The tree itself comes from the engine, so a new department
// appears here on its own.
export default function CategoriesScreen({ navigation }) {
  const scroll = useTabBarScroll();
  const { space } = useTabBarSpace();
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
  const freeDeliveryOn = (store?.freeDeliveryEnabled ?? store?.settings?.freeDeliveryEnabled) !== false;

  return (
    // One ScrollView for the whole screen — the left department list and the
    // right subcategory panel used to scroll independently of each other,
    // which felt like two separate screens glued together. Now a single
    // swipe moves both at once, like any normal page.
    <ScrollView style={styles.screen} contentContainerStyle={[styles.screenContent, { paddingBottom: space }]} showsVerticalScrollIndicator={false} {...scroll}>
      {/* Departments */}
      <View style={styles.rail}>
        {categories.map((category, index) => {
          const isActive = index === activeIndex;
          return (
            <Pressable
              key={category.id}
              onPress={() => setActiveIndex(index)}
              style={[styles.railItem, isActive && styles.railItemActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              {isActive ? <View style={styles.railBar} /> : null}
              <View style={styles.railIcon}>
                {category.image ? (
                  <Image source={{ uri: category.image }} style={styles.railIconImage} resizeMode="cover" />
                ) : (
                  <Ionicons name="leaf-outline" size={20} color={colors.primary} />
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
            <Ionicons name="arrow-forward" size={18} color={colors.primary} />
          </View>
        </Pressable>

        <View style={styles.pillRow}>
          <Pressable
            style={styles.pill}
            onPress={() =>
              navigation.navigate("ProductList", { slug: active.slug, title: active.name, openFilter: true })
            }
          >
            <Ionicons name="options-outline" size={16} color={colors.text} />
            <Text style={styles.pillText}>Filters</Text>
          </Pressable>
          <Pressable
            style={styles.pill}
            onPress={() =>
              navigation.navigate("ProductList", { slug: active.slug, title: active.name, openSort: true })
            }
          >
            <Ionicons name="swap-vertical" size={16} color={colors.text} />
            <Text style={styles.pillText}>Sort by</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
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
                <View style={styles.statIcon}>
                  {child.image ? (
                    <Image source={{ uri: child.image }} style={styles.statIconImage} resizeMode="cover" />
                  ) : (
                    <Ionicons name="leaf-outline" size={18} color={colors.primary} />
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
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
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
            <Ionicons name="bus-outline" size={18} color={colors.primary} />
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

  // The website's category rail: pale column, active item white with a green
  // bar on its left edge and a green label.
  rail: { width: 92, flexGrow: 0, flexShrink: 0, backgroundColor: colors.surfaceAlt, paddingVertical: spacing.sm, paddingBottom: spacing.xxl, borderRightWidth: 1, borderRightColor: colors.border },
  railItem: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 6, gap: 6 },
  railItemActive: { backgroundColor: colors.surface },
  railBar: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: colors.primary },
  railIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.primarySoft,
  },
  railIconImage: { width: "100%", height: "100%" },
  railLabel: { fontSize: 11.5, lineHeight: 15, fontFamily: fontFamily.medium, color: colors.textMuted, textAlign: "center" },
  railLabelActive: { color: colors.primary, fontFamily: fontFamily.semibold },

  panel: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, paddingBottom: spacing.xxl },

  ctaCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  // A Text sibling in a row, with no width of its own, can mis-measure and
  // wrap after just a word or two — this View is what actually gives it
  // something to measure against, with the arrow button pinned at a fixed
  // size beside it rather than squeezed by whatever the text decides.
  ctaTextWrap: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
  ctaText: { fontSize: 17, lineHeight: 23, fontFamily: fontFamily.semibold, color: colors.onPrimary },
  ctaArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  pillRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 38,
    ...shadow.card,
  },
  pillText: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.text },

  statList: { gap: spacing.sm },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.primarySoft,
  },
  statIconImage: { width: "100%", height: "100%" },
  statTitle: { fontSize: 14, fontFamily: fontFamily.semibold, color: colors.text },
  statSub: { fontSize: 12, fontFamily: fontFamily.regular, color: colors.textFaint, marginTop: 1 },

  // The website's free-delivery strip.
  promoStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  promoText: { flex: 1, fontSize: 12.5, fontFamily: fontFamily.medium, color: colors.primaryDark },
  promoBold: { fontFamily: fontFamily.bold, color: colors.primary },
});
