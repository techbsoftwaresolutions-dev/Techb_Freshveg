import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../components/AppText";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useStore } from "../context/StoreContext";
import { colors, fontFamily, radius, rupees, spacing, type } from "../theme";
import { Card, EmptyState, Loading, Notice, Pill, SectionHeader } from "../components/ui";
import ProductCard from "../components/ProductCard";

const CARD_WIDTH = 150;
// Solid, saturated cards with white type — they stand out against the white page
// instead of fading into it. `ink` colours the badge text on its white pill.
const OFFER_THEMES = [
  { bg: "#169B52", ink: "#0F7A3F" },
  { bg: "#F28A1E", ink: "#C46A08" },
  { bg: "#3D6FE6", ink: "#2A54BD" },
  { bg: "#E0475B", ink: "#B72C40" },
  { bg: "#7A4FE0", ink: "#5B35B8" },
];
const CATEGORY_TINTS = ["#FDE9E2", "#E5F3E7", "#FCF1D6", "#F9E3EA", "#E3ECF7", "#F1E8DC"];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { store, pincode, storeId } = useStore();
  const cart = useCart();
  const { signedIn } = useAuth();
  const [unread, setUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!signedIn) {
        setUnread(0);
        return;
      }
      api.get("/notifications", { limit: 1 }).then((d) => setUnread(d.unread || 0)).catch(() => {});
    }, [signedIn])
  );

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
        <View style={styles.headerTop}>
          <Pressable style={styles.locationRow} onPress={() => navigation.navigate("Location")}>
            <Text style={styles.locationLabel}>Deliver to</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              {pincode || "Set your pincode"}
              {store?.area ? ` · ${store.area}` : store?.name ? ` · ${store.name}` : ""} ▾
            </Text>
          </Pressable>

          {store ? (
            <View style={[styles.timePill, data?.store?.isOpen === false && styles.timePillClosed]}>
              <Text style={[styles.timePillText, data?.store?.isOpen === false && styles.timePillTextClosed]} numberOfLines={1}>
                {data?.store?.isOpen === false
                  ? "Closed"
                  : `⚡ ${data?.store?.deliveryTimeLabel || `${data?.store?.prepTimeMinutes ?? 30} min`}`}
              </Text>
            </View>
          ) : null}

          {signedIn ? (
            <Pressable style={styles.bell} onPress={() => navigation.navigate("Notifications")} accessibilityLabel="Notifications" hitSlop={8}>
              <Text style={styles.bellIcon}>🔔</Text>
              {unread > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unread > 9 ? "9+" : unread}</Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </View>

        <Pressable style={styles.searchBar} onPress={() => navigation.navigate("Search")}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search for fruits, grocery, more…</Text>
        </Pressable>
      </View>

      {/* What the shop promises, at a glance. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.perkRow}>
        {data?.store?.deliveryTimeLabel ? (
          <View style={styles.perk}>
            <Text style={styles.perkText}>⚡ Delivery in {data.store.deliveryTimeLabel.replace(/\bmin\b/, "minutes")}</Text>
          </View>
        ) : null}
        {data?.store?.freeDeliveryEnabled && data?.store?.freeDeliveryAbove ? (
          <View style={styles.perk}>
            <Text style={styles.perkText}>🚚 Free delivery above {rupees(data.store.freeDeliveryAbove)}</Text>
          </View>
        ) : null}
        <View style={styles.perk}>
          <Text style={styles.perkText}>🌿 Fresh, quality checked</Text>
        </View>
      </ScrollView>

      {error ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Notice tone="error">{error}</Notice>
        </View>
      ) : null}

      {data?.store?.isOpen !== false && data?.store?.afterHours ? (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Notice tone="info">
            You can order now — delivery is {data.store.afterHours.when}. {data.store.afterHours.message}
          </Notice>
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
          {data.offers.map((offer, index) => {
            const theme = OFFER_THEMES[index % OFFER_THEMES.length];
            return (
            <Card key={offer.id} style={[styles.offerCard, { backgroundColor: theme.bg }]}>
              <View style={styles.offerRowInner}>
                <View style={styles.offerText}>
                  <View style={styles.offerBadgePill}>
                    <Text style={[styles.offerBadge, { color: theme.ink }]}>{offer.badge || "OFFER"}</Text>
                  </View>
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
                  <View style={styles.offerImageWrap}>
                    <Image source={{ uri: offer.image }} style={styles.offerImage} resizeMode="cover" />
                  </View>
                ) : null}
              </View>
            </Card>
            );
          })}
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
            <View style={styles.categoryRing}>
              <View style={[styles.categoryIcon, { backgroundColor: category.image ? "#fff" : category.color || CATEGORY_TINTS[data.categories.indexOf(category) % CATEGORY_TINTS.length] }]}>
                {category.image ? (
                  <Image source={{ uri: category.image }} style={styles.categoryImage} resizeMode="cover" />
                ) : (
                  <Text style={{ fontSize: 26 }}>{category.icon || ""}</Text>
                )}
              </View>
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
    paddingBottom: spacing.lg,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    gap: spacing.md,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  locationRow: { flex: 1 },
  locationLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontFamily: fontFamily.semibold },
  locationValue: { color: "#fff", fontSize: 14.5, fontFamily: fontFamily.extrabold, marginTop: 1 },
  timePill: { backgroundColor: "#fff", borderRadius: radius.pill, paddingHorizontal: 11, height: 30, alignItems: "center", justifyContent: "center" },
  timePillClosed: { backgroundColor: colors.dangerSoft },
  timePillText: { color: colors.primaryDark, fontSize: 12, fontFamily: fontFamily.extrabold },
  timePillTextClosed: { color: colors.danger },
  bell: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  bellIcon: { fontSize: 18 },
  bellBadge: { position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 3, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.primary },
  bellBadgeText: { color: "#fff", fontSize: 9.5, fontFamily: fontFamily.extrabold },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  searchIcon: { fontSize: 14 },
  searchPlaceholder: { color: colors.textFaint, fontSize: 14 },

  perkRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  perk: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, height: 30, alignItems: "center", justifyContent: "center" },
  perkText: { fontSize: 11.5, fontFamily: fontFamily.semibold, color: colors.text },

  offerRow: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  offerCard: { width: 290, padding: spacing.sm, borderRadius: 22, borderWidth: 0 },
  // A fixed height: the picture is laid over its box, so its own size can no
  // longer stretch the whole card.
  offerRowInner: { flexDirection: "row", alignItems: "stretch", height: 142 },
  offerText: { flex: 1, padding: spacing.sm, justifyContent: "center" },
  // The picture fills a rounded square with a thin white border, instead of
  // floating as a loose cut-out.
  // A round picture with a white rim, centred on the right of the card.
  offerImageWrap: {
    width: 108,
    height: 108,
    marginLeft: spacing.xs,
    marginRight: spacing.xs,
    borderRadius: 54,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.95)",
    alignSelf: "center",
  },
  offerImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  offerBadgePill: { alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, marginBottom: 6 },
  offerBadge: { fontFamily: fontFamily.extrabold, fontSize: 11.5 },
  offerTitle: { ...type.h3, marginBottom: 2, color: "#fff" },
  offerDesc: { ...type.small, minHeight: 32, color: "rgba(255,255,255,0.88)" },
  codeChip: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  codeText: { color: "#fff", fontWeight: "800", fontSize: 11.5 },
  autoApplied: { ...type.tiny, marginTop: spacing.sm, color: "#fff", fontWeight: "700", opacity: 0.95 },

  categoryGrid: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  categoryTile: { width: 80, alignItems: "center", marginRight: spacing.md },
  // A round picture with a white rim and a soft shadow, lifted off the page.
  categoryRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    padding: 3,
    marginBottom: 7,
    shadowColor: "#0B0F1A",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  categoryIcon: {
    flex: 1,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  categoryImage: {
    width: "100%",
    height: "100%",
  },
  categoryName: { fontSize: 11.5, lineHeight: 14, textAlign: "center", color: colors.text, fontFamily: fontFamily.bold, paddingHorizontal: 2 },
});
