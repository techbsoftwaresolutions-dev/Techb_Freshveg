import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { colors, radius, spacing, type } from "../theme";
import { EmptyState, Loading, Notice } from "../components/ui";

// Departments down the left, their subcategories on the right — the layout
// every Indian grocery app converged on, because it fits a deep tree on a
// narrow screen. The tree itself comes from the engine, so a new department
// appears here on its own.
export default function CategoriesScreen({ navigation }) {
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

  return (
    <View style={styles.screen}>
      {/* Departments */}
      <ScrollView style={styles.rail} contentContainerStyle={{ paddingVertical: spacing.sm }}>
        {categories.map((category, index) => {
          const isActive = index === activeIndex;
          return (
            <Pressable
              key={category.id}
              onPress={() => setActiveIndex(index)}
              style={[styles.railItem, isActive && styles.railItemActive]}
            >
              {isActive ? <View style={styles.railMarker} /> : null}
<Text style={{ fontSize: 22}}>{category.icon ||""}</Text>
              <Text style={[styles.railLabel, isActive && styles.railLabelActive]} numberOfLines={2}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Subcategories */}
      <ScrollView style={styles.panel} contentContainerStyle={{ padding: spacing.md }}>
        <Pressable
          style={styles.allButton}
          onPress={() =>
            navigation.navigate("ProductList", { slug: active.slug, title: active.name })
          }
        >
          <Text style={styles.allText}>
            Browse all {active.name} {active.productCount ? `(${active.productCount})` : ""} →
          </Text>
        </Pressable>

        {active.children?.length ? (
          <View style={styles.grid}>
            {active.children.map((child) => (
              <Pressable
                key={child.id}
                style={styles.tile}
                onPress={() =>
                  navigation.navigate("ProductList", { slug: child.slug, title: child.name })
                }
              >
                <View style={styles.tileIcon}>
<Text style={{ fontSize: 26}}>{child.icon ||""}</Text>
                </View>
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {child.name}
                </Text>
                {child.productCount ? (
                  <Text style={type.tiny}>{child.productCount} {child.productCount === 1 ? "item" : "items"}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <Notice tone="info" style={{ marginTop: spacing.md }}>
            {active.name} has no subcategories — tap above to see everything in it.
          </Notice>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: "row", backgroundColor: colors.bg },

  rail: { width: 92, backgroundColor: colors.surfaceAlt },
  railItem: { alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: 6, gap: 4 },
  railItemActive: { backgroundColor: colors.surface },
  railMarker: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    backgroundColor: colors.primary,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  railLabel: { ...type.tiny, textAlign: "center", fontWeight: "600" },
  railLabelActive: { color: colors.primaryDark },

  panel: { flex: 1, backgroundColor: colors.surface },
  allButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  allText: { color: colors.primaryDark, fontWeight: "700", fontSize: 13.5 },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  tile: { width: "33.33%", alignItems: "center", marginBottom: spacing.lg, paddingHorizontal: 4 },
  tileIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  tileLabel: { ...type.tiny, color: colors.text, fontWeight: "600", textAlign: "center" },
});
