import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import { useStore } from "../context/StoreContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Card, EmptyState, Loading, Notice, Pill, SectionHeader } from "../components/ui";
import ProductCard from "../components/ProductCard";

const CARD_WIDTH = 150;

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { store, pincode, storeId } = useStore();
  const cart = useCart();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      // The whole home screen is one request — round trips are the expensive
      // thing on a phone connection, not payload size.
      const home = await api.get("/storefront/home", { store: storeId || undefined });
      setData(home);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([load(), cart.refresh()]);
  };

  if (loading) return <Loading label="Loading the store" />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.locationRow} onPress={() => navigation.navigate("Location")}>
          <Text style={styles.locationLabel}>Deliver to</Text>
          <Text style={styles.locationValue} numberOfLines={1}>
 {pincode ||"Set your pincode"} {store?.name ?`· ${store.name}` :""} ▾
          </Text>
        </Pressable>

        {store ? (
          <Pill tone={data?.store?.isOpen === false ? "danger" : "primary"}>
            {data?.store?.isOpen === false
              ? "Closed"
              : `${data?.store?.prepTimeMinutes ?? 30} min`}
          </Pill>
        ) : null}
      </View>

      <Pressable style={styles.searchBar} onPress={() => navigation.navigate("Search")}>
        <Text style={styles.searchPlaceholder}>Search for fruits, grocery, more…</Text>
      </Pressable>

      {error ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Notice tone="error">{error}</Notice>
        </View>
      ) : null}

      {data?.store?.isOpen === false ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Notice tone="warn">
            {store?.name} is closed right now. You can still browse and build your cart.
          </Notice>
        </View>
      ) : null}

      {/* Offers */}
      {data?.offers?.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.offerRow}
        >
          {data.offers.map((offer) => (
            <Card key={offer.id} style={styles.offerCard}>
              <View style={styles.offerRowInner}>
                <View style={styles.offerText}>
                  <Text style={styles.offerBadge}>{offer.badge || "OFFER"}</Text>
                  <Text style={styles.offerTitle} numberOfLines={2}>
                    {offer.title}
                  </Text>
                  <Text style={styles.offerDesc} numberOfLines={2}>
                    {offer.description}
                  </Text>
                  {offer.code ? (
                    <View style={styles.codeChip}>
                      <Text style={styles.codeText}>Code {offer.code}</Text>
                    </View>
                  ) : (
                    <Text style={styles.autoApplied}>Applied automatically</Text>
                  )}
                </View>
                {offer.image ? (
                  <Image source={{ uri: offer.image }} style={styles.offerImage} resizeMode="contain" />
                ) : null}
              </View>
            </Card>
          ))}
        </ScrollView>
      ) : null}

      {/* Categories — the six departments, straight from the engine. Add a
          seventh in the admin and it appears here on the next pull. */}
      <SectionHeader title="Shop by category" actionLabel="See all" onAction={() => navigation.navigate("CategoriesTab")} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryGrid}
      >
        {(data?.categories || []).map((category) => (
          <Pressable
            key={category.id}
            style={styles.categoryTile}
            onPress={() =>
              navigation.navigate("ProductList", { slug: category.slug, title: category.name })
            }
          >
            <View style={[styles.categoryIcon, { backgroundColor: category.color || colors.primarySoft }]}>
              {category.image ? (
                <Image source={{ uri: category.image }} style={styles.categoryImage} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 26 }}>{category.icon || ""}</Text>
              )}
            </View>
            <Text style={styles.categoryName} numberOfLines={2}>
              {category.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Featured */}
      {data?.featured?.length ? (
        <Rail
          title="Deals of the day"
          products={data.featured}
          cart={cart}
          navigation={navigation}
        />
      ) : null}

      {/* One rail per department, so the home screen grows by itself. */}
      {(data?.rails || []).map((rail) => (
        <Rail
          key={rail.category.id}
          title={`${rail.category.icon || ""} ${rail.category.name}`.trim()}
          products={rail.products}
          cart={cart}
          navigation={navigation}
          onSeeAll={() =>
            navigation.navigate("ProductList", { slug: rail.category.slug, title: rail.category.name })
          }
        />
      ))}

      {!data?.rails?.length && !data?.featured?.length ? (
        <EmptyState
          title="Nothing stocked yet"
          hint="Once products are published in the admin they will show up here."
        />
      ) : null}
    </ScrollView>
  );
}

function Rail({ title, products, cart, navigation, onSeeAll }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <SectionHeader title={title} actionLabel={onSeeAll ? "See all" : undefined} onAction={onSeeAll} />
      <FlatList
        horizontal
        data={products}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        renderItem={({ item }) => {
          const variantId = item.defaultVariant;
          // Once an item is in the cart its line carries the real step, unit
          // and limits, so the stepper on a listing behaves exactly like the
          // one on the product page.
          const line = cart.items.find((i) => String(i.variant) === String(variantId));

          return (
            <ProductCard
              width={CARD_WIDTH}
              product={item}
              variant={line}
              quantity={line?.quantity || 0}
              busy={Boolean(cart.pending[variantId])}
              onPress={() => navigation.navigate("ProductDetail", { slug: item.slug })}
              onAdd={() => cart.add(variantId).catch(() => {})}
              onChange={(quantity) => cart.setQuantity(variantId, quantity).catch(() => {})}
              onRemove={() => cart.remove(variantId).catch(() => {})}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  locationRow: { flex: 1 },
  locationLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "600" },
  locationValue: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 1 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: 2,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: 14 },
  searchPlaceholder: { color: colors.textFaint, fontSize: 14 },

  offerRow: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  offerCard: { width: 230, padding: spacing.md },
  offerRowInner: { flexDirection: "row", alignItems: "center" },
  offerText: { flex: 1 },
  offerImage: { width: 56, height: 56, marginLeft: spacing.sm },
  offerBadge: { color: colors.save, fontWeight: "800", fontSize: 13, marginBottom: 4 },
  offerTitle: { ...type.h3, marginBottom: 2 },
  offerDesc: { ...type.small, minHeight: 32 },
  codeChip: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
  },
  codeText: { color: colors.primaryDark, fontWeight: "800", fontSize: 11.5 },
  autoApplied: { ...type.tiny, marginTop: spacing.sm, color: colors.save, fontWeight: "600" },

  categoryGrid: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  categoryTile: { width: 78, alignItems: "center", marginRight: spacing.md },
  categoryIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    overflow: "hidden",
  },
  categoryImage: {
    width: "100%",
    height: "100%",
  },
  categoryName: { ...type.tiny, textAlign: "center", color: colors.text, fontWeight: "600", paddingHorizontal: 2 },
});
