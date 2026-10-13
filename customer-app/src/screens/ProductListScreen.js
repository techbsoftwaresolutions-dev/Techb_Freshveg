import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../components/Text";
import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import { useStore } from "../context/StoreContext";
import { colors, fontFamily, radius, shadow, spacing, type } from "../theme";
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
  const { slug, title, openFilter, openSort } = route.params;
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

  // Toolbar: Filter / Sort By / Price Drop, the compact row an Indian
  // grocery app puts above the grid instead of an always-visible chip wall.
  // The Categories tab's own Filter/Sort pills land here with these flags
  // set, so the right panel is already open rather than making someone tap
  // twice.
  const [filtersOpen, setFiltersOpen] = useState(Boolean(openFilter));
  const [sortMenuOpen, setSortMenuOpen] = useState(Boolean(openSort));

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

  // One pick per filter group ("1 kg" vs "2 kg", "Hosur" vs "Mysuru") rather
  // than a checkbox list — tapping a chip replaces whatever else was picked
  // in its own group, tapping the same chip again clears it. Different
  // groups still combine (pick a weight AND a store), just not two values
  // inside the same group at once.
  const toggle = (code, value) => {
    setSelected((current) => {
      const values = current[code] || [];
      const next = values.includes(value) ? [] : [value];
      return { ...current, [code]: next };
    });
  };

  const activeFilterCount = Object.values(selected).reduce((sum, v) => sum + v.length, 0);
  const activeSortLabel = SORTS.find((s) => s.key === sort)?.label || "Sort By";
  const priceDropActive = sort === "discount";
  const hasFilters = (landing?.facets || landing?.filters)?.length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        {/* Departments — the same left rail as the Categories tab, so
            switching between a department's subcategories feels like one
            continuous flow instead of two different screens. */}
        {landing?.children?.length ? (
          <ScrollView style={styles.rail} contentContainerStyle={{ paddingVertical: spacing.sm }}>
            <Pressable
              style={[styles.railItem, !subcategory && styles.railItemActive]}
              onPress={() => setSubcategory(null)}
            >
              {!subcategory ? <View style={styles.railMarker} /> : null}
              <View style={styles.railThumb}>
                <Ionicons name="basket-outline" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.railLabel, !subcategory && styles.railLabelActive]} numberOfLines={2}>
                All
              </Text>
            </Pressable>
            {landing.children.map((child) => {
              const isActive = subcategory === child.slug;
              return (
                <Pressable
                  key={child.id}
                  style={[styles.railItem, isActive && styles.railItemActive]}
                  onPress={() => setSubcategory(isActive ? null : child.slug)}
                >
                  {isActive ? <View style={styles.railMarker} /> : null}
                  <View style={styles.railThumb}>
                    {child.image ? (
                      <Image source={{ uri: child.image }} style={styles.railThumbImage} resizeMode="cover" />
                    ) : (
                      <Ionicons name="leaf-outline" size={18} color={colors.primary} />
                    )}
                  </View>
                  <Text style={[styles.railLabel, isActive && styles.railLabelActive]} numberOfLines={2}>
                    {child.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.panel}>
          {/* Toolbar — wraps to a second line instead of clipping. A
              horizontal ScrollView would be the obvious fix for "three
              pills wider than a narrow phone", but ScrollView clips its
              own content to its bounds, which would cut off the Sort By
              dropdown below it. flexWrap keeps everything reachable
              without that trap. */}
          <View style={styles.toolbar}>
            <Pressable
              style={[styles.toolbarBtn, (filtersOpen || activeFilterCount > 0) && styles.toolbarBtnActive]}
              onPress={() => {
                setSortMenuOpen(false);
                setFiltersOpen((v) => !v);
              }}
            >
              <Ionicons name="options-outline" size={15} color={filtersOpen || activeFilterCount > 0 ? colors.primaryDark : colors.text} />
              <Text style={[styles.toolbarText, (filtersOpen || activeFilterCount > 0) && styles.toolbarTextActive]}>
                Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </Text>
            </Pressable>

            <View style={styles.sortWrap}>
              <Pressable
                style={[styles.toolbarBtn, (sortMenuOpen || sort) && styles.toolbarBtnActive]}
                onPress={() => {
                  setFiltersOpen(false);
                  setSortMenuOpen((v) => !v);
                }}
              >
                <Text
                  style={[styles.toolbarText, (sortMenuOpen || sort) && styles.toolbarTextActive]}
                  numberOfLines={1}
                >
                  {sort ? activeSortLabel : "Sort by"}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
              </Pressable>
              {sortMenuOpen ? (
                <View style={styles.sortMenu}>
                  {SORTS.map((option) => {
                    const isActive = sort === option.key;
                    return (
                      <Pressable
                        key={option.key || "relevance"}
                        style={styles.sortMenuItem}
                        onPress={() => {
                          setSort(option.key);
                          setSortMenuOpen(false);
                        }}
                      >
                        <Text style={[styles.sortMenuText, isActive && styles.sortMenuTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <Pressable
              style={[styles.toolbarBtn, priceDropActive && styles.toolbarBtnActive]}
              onPress={() => {
                setSortMenuOpen(false);
                setSort(priceDropActive ? "" : "discount");
              }}
            >
              <View style={styles.offerDot}>
                <Ionicons name="pricetag" size={10} color={colors.onPrimary} />
              </View>
              <Text style={[styles.toolbarText, priceDropActive && styles.toolbarTextActive]}>
                Offers
              </Text>
            </Pressable>
          </View>

          {/* Filters resolved from the category's schema, narrowed to the
              values this shelf's products actually have (facets) — tucked
              behind the Filter button instead of always on screen. */}
          {filtersOpen && hasFilters ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroll}
              contentContainerStyle={styles.chipRow}
            >
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
              columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.sm }}
              contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.xxl }}
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              onScrollBeginDrag={() => setSortMenuOpen(false)}
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
                  // Half the row even when a product is alone on the last row.
                  <View style={{ flex: 1, maxWidth: "50%" }}>
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
      </View>
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
  body: { flex: 1, flexDirection: "row" },

  // flexGrow/flexShrink 0: a ScrollView grows by default on the web build,
  // which let this rail swallow half the screen.
  rail: { width: 80, flexGrow: 0, flexShrink: 0, backgroundColor: colors.surfaceAlt, borderRightWidth: 1, borderRightColor: colors.border },
  railItem: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, gap: 5 },
  railItemActive: { backgroundColor: colors.surface },
  railMarker: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    backgroundColor: colors.primary,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  railThumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  railThumbImage: { width: "100%", height: "100%" },
  railLabel: { fontSize: 11, lineHeight: 14, textAlign: "center", fontFamily: fontFamily.medium, color: colors.textMuted },
  railLabelActive: { color: colors.primary, fontFamily: fontFamily.semibold },

  panel: { flex: 1, backgroundColor: colors.bg },

  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  toolbarBtn: {
    flexDirection: "row",
    gap: 6,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  offerDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  toolbarBtnActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  toolbarText: { fontSize: 12.5, lineHeight: 16, color: colors.text, fontFamily: fontFamily.medium, includeFontPadding: false },
  toolbarTextActive: { color: colors.primaryDark },

  sortWrap: { position: "relative" },
  sortMenu: {
    position: "absolute",
    top: 40,
    left: 0,
    minWidth: 190,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    zIndex: 30,
    elevation: 12,
    ...shadow.card,
  },
  sortMenuItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sortMenuText: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.text },
  sortMenuTextActive: { color: colors.primaryDark, fontFamily: fontFamily.semibold },

  // A fixed height on the ScrollView itself, not just its content — a
  // horizontal ScrollView with no height of its own can measure taller than
  // one pill row needs (a wide system font's line-height is enough to do
  // it), which shows up as a dead gap below a perfectly normal-looking row.
  chipScroll: { flexGrow: 0, height: 48 },
  chipRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm, alignItems: "center" },
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
  chipText: { fontSize: 12.5, lineHeight: 15, color: colors.textMuted, fontFamily: fontFamily.semibold, includeFontPadding: false },
  chipTextActive: { color: colors.primaryDark },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  count: { ...type.small, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});
