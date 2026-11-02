import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../components/AppText";
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
  // The left list scrolls on its own; picking an item brings it into view.
  const railRef = useRef(null);
  const railY = useRef({});
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
          <ScrollView
            ref={railRef}
            style={styles.rail}
            contentContainerStyle={{ paddingVertical: spacing.sm, paddingBottom: spacing.xxl }}
            showsVerticalScrollIndicator
            persistentScrollbar
            nestedScrollEnabled
            bounces
          >
            <RailItem
              label="All"
              glyph="▦"
              active={!subcategory}
              onLayout={(e) => (railY.current.all = e.nativeEvent.layout.y)}
              onPress={() => {
                setSubcategory(null);
                railRef.current?.scrollTo({ y: 0, animated: true });
              }}
            />
            {landing.children.map((child, index) => (
              <RailItem
                key={child.id}
                label={child.name}
                image={child.image}
                glyph={child.icon || child.name?.[0]}
                tint={RAIL_TINTS[index % RAIL_TINTS.length]}
                active={subcategory === child.slug}
                onLayout={(e) => (railY.current[child.slug] = e.nativeEvent.layout.y)}
                onPress={() => {
                  setSubcategory(subcategory === child.slug ? null : child.slug);
                  const y = railY.current[child.slug];
                  if (y != null) railRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
                }}
              />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.panel}>
          {/* Toolbar — wraps to a second line instead of clipping. A
              horizontal ScrollView would be the obvious fix for "three
              pills wider than a narrow phone", but ScrollView clips its
              own content to its bounds, which would cut off the Sort By
              dropdown below it. flexWrap keeps everything reachable
              without that trap. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.toolbarScroll}
            contentContainerStyle={styles.toolbar}
          >
            <Pressable
              style={[styles.toolbarBtn, (filtersOpen || activeFilterCount > 0) && styles.toolbarBtnActive]}
              onPress={() => setFiltersOpen((v) => !v)}
            >
              <Text style={[styles.toolbarText, (filtersOpen || activeFilterCount > 0) && styles.toolbarTextActive]}>
                Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.toolbarBtn, sort && sort !== "discount" && styles.toolbarBtnActive]}
              onPress={() => setSortMenuOpen(true)}
            >
              <Text style={[styles.toolbarText, sort && sort !== "discount" && styles.toolbarTextActive]} numberOfLines={1}>
                {sort && !priceDropActive ? activeSortLabel : "Sort by"} ▾
              </Text>
            </Pressable>

            <Pressable
              style={[styles.toolbarBtn, priceDropActive && styles.toolbarBtnActive]}
              onPress={() => setSort(priceDropActive ? "" : "discount")}
            >
              <Text style={[styles.toolbarText, priceDropActive && styles.toolbarTextActive]}>Price drop</Text>
            </Pressable>
          </ScrollView>

          {/* Sort choices open as a sheet from the bottom, so nothing is
              clipped by the narrow panel. */}
          <Modal transparent animationType="fade" visible={sortMenuOpen} onRequestClose={() => setSortMenuOpen(false)}>
            <Pressable style={styles.sheetBackdrop} onPress={() => setSortMenuOpen(false)}>
              <Pressable style={styles.sheet} onPress={() => {}}>
                <View style={styles.sheetGrip} />
                <Text style={styles.sheetTitle}>Sort by</Text>
                {SORTS.map((option) => {
                  const isActive = sort === option.key;
                  return (
                    <Pressable
                      key={option.key || "relevance"}
                      style={styles.sheetRow}
                      onPress={() => {
                        setSort(option.key);
                        setSortMenuOpen(false);
                      }}
                    >
                      <Text style={[styles.sheetText, isActive && styles.sheetTextActive]}>{option.label}</Text>
                      <View style={[styles.radio, isActive && styles.radioOn]}>{isActive ? <View style={styles.radioDot} /> : null}</View>
                    </Pressable>
                  );
                })}
              </Pressable>
            </Pressable>
          </Modal>

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
              contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.xxl }}
              showsVerticalScrollIndicator={false}
              onEndReached={loadMore}
              onEndReachedThreshold={0.4}
              onScrollBeginDrag={() => setSortMenuOpen(false)}
              ListHeaderComponent={
                meta ? (
                  <Text style={styles.count}>
                    {title ? `${title} · ` : ""}{meta.total} item{meta.total === 1 ? "" : "s"}
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
                      fill
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

const RAIL_TINTS = ["#FDE9E2", "#E5F3E7", "#FCF1D6", "#F9E3EA", "#E3ECF7", "#F1E8DC"];

// One subcategory down the left: a round picture (or its emoji / first
// letter when it has none) above its name, with a green bar on the active one.
function RailItem({ label, image, glyph, tint, active, onPress, onLayout }) {
  return (
    <Pressable style={[styles.railItem, active && styles.railItemActive]} onPress={onPress} onLayout={onLayout}>
      {active ? <View style={styles.railMarker} /> : null}
      <View style={[styles.railIcon, { backgroundColor: image ? "#fff" : tint || colors.primarySoft }, active && styles.railIconActive]}>
        {image ? (
          <Image source={{ uri: image }} style={styles.railImage} resizeMode="cover" />
        ) : (
          <Text style={styles.railGlyph}>{glyph}</Text>
        )}
      </View>
      <Text style={[styles.railLabel, active && styles.railLabelActive]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
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

  rail: { width: 76, flexGrow: 0, backgroundColor: colors.surfaceAlt },
  railItem: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, gap: 5 },
  railItemActive: { backgroundColor: colors.surface },
  railMarker: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3.5,
    backgroundColor: colors.primary,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  railIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  railIconActive: { borderColor: colors.primary },
  railImage: { width: "100%", height: "100%" },
  railGlyph: { fontSize: 20, color: colors.text },
  railLabel: { fontSize: 10.5, lineHeight: 13, textAlign: "center", fontFamily: fontFamily.semibold, color: colors.textMuted },
  railLabelActive: { color: colors.primaryDark, fontFamily: fontFamily.bold },

  panel: { flex: 1, backgroundColor: colors.bg },

  toolbarScroll: { flexGrow: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  toolbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10 },
  toolbarBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarBtnActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  toolbarText: { fontSize: 12, lineHeight: 15, color: colors.textMuted, fontFamily: fontFamily.semibold, includeFontPadding: false },
  toolbarTextActive: { color: colors.primaryDark },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(11,15,26,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: spacing.xxl,
  },
  sheetGrip: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { ...type.h2, marginBottom: spacing.sm },
  sheetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border },
  sheetText: { fontSize: 14.5, fontFamily: fontFamily.regular, color: colors.text },
  sheetTextActive: { fontFamily: fontFamily.bold, color: colors.primaryDark },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  // A fixed height on the ScrollView itself, not just its content — a
  // horizontal ScrollView with no height of its own can measure taller than
  // one pill row needs (a wide system font's line-height is enough to do
  // it), which shows up as a dead gap below a perfectly normal-looking row.
  chipScroll: { flexGrow: 0, height: 48, backgroundColor: colors.surface },
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
  count: { ...type.small, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
