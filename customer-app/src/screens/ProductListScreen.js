import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import { useStore } from "../context/StoreContext";
import { colors, radius, spacing, type } from "../theme";
import { EmptyState, Loading, Notice } from "../components/ui";
import ProductCard from "../components/ProductCard";

const SORTS = [
  { key: "", label: "Relevance" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
  { key: "discount", label: "Discount" },
  { key: "newest", label: "Newest" },
];

export default function ProductListScreen({ route, navigation }) {
  const { slug, title } = route.params;
  const { storeId } = useStore();
  const cart = useCart();

  const [landing, setLanding] = useState(null);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("");
  // { attributeCode: [selectedValues] } — the codes are whatever the category
  // binds, so nothing here is named in the app.
  const [selected, setSelected] = useState({});
  const [subcategory, setSubcategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    navigation.setOptions({ title: title || "Browse" });
  }, [navigation, title]);

  // The category landing tells us which filters exist. The app renders
  // whatever comes back — a vegetable page gets Variety and Organic, a rice
  // page gets Grain Length, and neither is written into this screen.
  useEffect(() => {
    api
      .get(`/storefront/categories/${slug}`)
      .then(setLanding)
      .catch((err) => setError(err.message));
  }, [slug]);

  const fetchPage = useCallback(
    async (nextPage, replace) => {
      const query = {
        category: subcategory || slug,
        sort: sort || undefined,
        page: nextPage,
        limit: 20,
        store: storeId || undefined,
      };
      for (const [code, values] of Object.entries(selected)) {
        if (values.length) query[`attr.${code}`] = values.join(",");
      }

      const data = await api.get("/storefront/products", query);
      setMeta(data.meta);
      setProducts((current) => (replace ? data.items : [...current, ...data.items]));
    },
    [slug, subcategory, sort, selected, storeId]
  );

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchPage(1, true)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [fetchPage]);

  const loadMore = () => {
    if (loadingMore || !meta?.hasNext) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    fetchPage(next, false)
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const toggle = (code, value) => {
    setSelected((current) => {
      const values = current[code] || [];
      const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
      return { ...current, [code]: next };
    });
  };

  const activeFilterCount = Object.values(selected).reduce((sum, v) => sum + v.length, 0);

  return (
    <View style={styles.screen}>
      {/* Subcategories */}
      {landing?.children?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="All" active={!subcategory} onPress={() => setSubcategory(null)} />
          {landing.children.map((child) => (
            <Chip
              key={child.id}
              label={`${child.icon || ""} ${child.name}`.trim()}
              active={subcategory === child.slug}
              onPress={() => setSubcategory(subcategory === child.slug ? null : child.slug)}
            />
          ))}
        </ScrollView>
      ) : null}

      {/* Sort */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {SORTS.map((option) => (
          <Chip
            key={option.key || "relevance"}
            label={option.label}
            active={sort === option.key}
            onPress={() => setSort(option.key)}
          />
        ))}
      </ScrollView>

      {/* Filters resolved from the category's schema, narrowed to the values
          this shelf's products actually have (facets) — so no chip is offered
          that would return nothing. Falls back to the plain schema list on an
          API from before facets existed. */}
      {(landing?.facets || landing?.filters)?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {(landing.facets || landing.filters).map((filter) =>
            filter.inputType === "boolean" ? (
              <Chip
                key={filter.code}
                label={filter.label}
                active={(selected[filter.code] || []).includes("true")}
                onPress={() => toggle(filter.code, "true")}
              />
            ) : (
              (filter.options || []).map((option) => (
                <Chip
                  key={`${filter.code}:${option.value}`}
                  label={option.label}
                  swatch={option.hex}
                  active={(selected[filter.code] || []).includes(option.value)}
                  onPress={() => toggle(filter.code, option.value)}
                />
              ))
            )
          )}
          {activeFilterCount > 0 ? (
            <Chip label="Clear" onPress={() => setSelected({})} tone="danger" />
          ) : null}
        </ScrollView>
      ) : null}

      {error ? (
        <View style={{ padding: spacing.lg }}>
          <Notice tone="error">{error}</Notice>
        </View>
      ) : null}

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.xxl }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            meta ? (
              <Text style={styles.count}>
                {meta.total} item{meta.total === 1 ? "" : "s"}
                {activeFilterCount ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"}` : ""}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title="Nothing matches"
              hint={
                activeFilterCount
                  ? "Try clearing a filter or two."
                  : "This category has no products published yet."
              }
            />
          }
          renderItem={({ item }) => {
            const variantId = item.defaultVariant;
            const line = cart.items.find((i) => String(i.variant) === String(variantId));
            return (
              <View style={{ flex: 1 }}>
                <ProductCard
                  product={item}
                  variant={line}
                  quantity={line?.quantity || 0}
                  busy={Boolean(cart.pending[variantId])}
                  onPress={() => navigation.navigate("ProductDetail", { slug: item.slug })}
                  onAdd={() => cart.add(variantId).catch(() => {})}
                  onChange={(quantity) => cart.setQuantity(variantId, quantity).catch(() => {})}
                  onRemove={() => cart.remove(variantId).catch(() => {})}
                />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function Chip({ label, active, onPress, swatch, tone }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && styles.chipActive,
        tone === "danger" && { borderColor: colors.danger },
      ]}
    >
      {swatch ? <View style={[styles.swatch, { backgroundColor: swatch }]} /> : null}
      <Text
        style={[
          styles.chipText,
          active && styles.chipTextActive,
          tone === "danger" && { color: colors.danger },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  chipRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 12.5, color: colors.textMuted, fontWeight: "600" },
  chipTextActive: { color: colors.primaryDark },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  count: { ...type.small, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});
