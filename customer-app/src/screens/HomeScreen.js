import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "../components/AppText";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useStore } from "../context/StoreContext";
import { colors, fontFamily, radius, rupees, spacing, type } from "../theme";
import { Card, EmptyState, Loading, Notice, Pill, SectionHeader } from "../components/ui";
import ProductTile from "../components/ProductTile";

// Flat product tiles, a little under three to a screen so the next one peeks in.
const TILE_WIDTH = 124;
// Solid, saturated cards with white type — they stand out against the white page
// instead of fading into it. `ink` colours the badge text on its white pill.
const OFFER_THEMES = [
  { bg: "#169B52", ink: "#0F7A3F" },
  { bg: "#F28A1E", ink: "#C46A08" },
  { bg: "#3D6FE6", ink: "#2A54BD" },
  { bg: "#E0475B", ink: "#B72C40" },
  { bg: "#7A4FE0", ink: "#5B35B8" },
];
const AISLE_TINTS = ["#E4F4EE", "#FDF0DF", "#E8EFFB", "#FBE9EF", "#EEF5DF", "#F1EAFB"];

// A department as a soft card with a 2 × 2 collage of its products (or its own
// picture when it has none yet), the name underneath.
function CategoryCard({ category, products, width, onPress }) {
  const pics = products
    .map((p) => p.primaryImage || p.media?.[0]?.url || p.image)
    .filter(Boolean)
    .slice(0, 4);
  const inner = width - 12;
  const cell = (inner - 6) / 2;

  return (
    <Pressable style={[styles.catCard, { width }]} onPress={onPress}>
      {pics.length >= 2 ? (
        <View style={[styles.collage, { width: inner }]}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.collageCell, { width: cell, height: cell }]}>
              {pics[i] ? <Image source={{ uri: pics[i] }} style={styles.collageImage} resizeMode="contain" /> : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.collageSingle, { width: inner, height: inner }]}>
          {category.image ? (
            <Image source={{ uri: category.image }} style={styles.collageImage} resizeMode="contain" />
          ) : (
            <Text style={{ fontSize: 30 }}>{category.icon || "🛍️"}</Text>
          )}
        </View>
      )}
      <Text style={styles.catCardName} numberOfLines={2}>{category.name}</Text>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
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

  const closed = data?.store?.isOpen === false;
  const timeText = String(data?.store?.deliveryTimeLabel || `${data?.store?.prepTimeMinutes ?? 30} min`).replace(/\bmin\b/, "minutes");
  const railOf = Object.fromEntries((data?.rails || []).map((r) => [r.category.id, r.products]));
  const gutter = spacing.lg;
  // Floored with a pixel to spare: an exact fit can wrap the last card of a row.
  const cardW = Math.floor((screenW - gutter * 2 - 10 * 2) / 3) - 1;
  const tileW = Math.floor((screenW - gutter * 2 - 10 * 3) / 4) - 1;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <Pressable style={styles.locationRow} onPress={() => navigation.navigate("Location")}>
            <Text style={styles.deliveryIn}>{closed ? "Store" : /\d/.test(timeText) ? "Delivery in" : "Delivery"}</Text>
            <Text style={styles.deliveryBig} numberOfLines={1}>{closed ? "Closed right now" : timeText}</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              {pincode || "Set your pincode"}
              {store?.area ? ` · ${store.area}` : store?.name ? ` · ${store.name}` : ""} ▾
            </Text>
          </Pressable>

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
          <Pressable style={styles.avatarBtn} onPress={() => navigation.navigate("AccountTab")} accessibilityLabel="Account" hitSlop={8}>
            <Text style={styles.bellIcon}>👤</Text>
          </Pressable>
        </View>

        <Pressable style={styles.searchBar} onPress={() => navigation.navigate("Search")}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search for fruits, grocery, more…</Text>
        </Pressable>

        {/* Departments as tabs: "All" is this page. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          <View style={[styles.tab, styles.tabActive]}>
            <Text style={styles.tabGlyph}>🛒</Text>
            <Text style={[styles.tabText, styles.tabTextActive]}>All</Text>
          </View>
          {(data?.categories || []).map((category) => (
            <Pressable
              key={category.id}
              style={styles.tab}
              onPress={() => navigation.navigate("ProductList", { slug: category.slug, title: category.name })}
            >
              {category.image ? (
                <Image source={{ uri: category.image }} style={styles.tabImage} resizeMode="cover" />
              ) : (
                <Text style={styles.tabGlyph}>{category.icon || "🛍️"}</Text>
              )}
              <Text style={styles.tabText} numberOfLines={1}>{category.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

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

      {/* Departments as picture cards: a collage of what is on the shelf. */}
      <SectionHeader title="Shop by category" actionLabel="See all" onAction={() => navigation.navigate("CategoriesTab")} />
      <View style={styles.cardGrid}>
        {(data?.categories || []).map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            products={railOf[category.id] || []}
            width={cardW}
            onPress={() => navigation.navigate("ProductList", { slug: category.slug, title: category.name })}
          />
        ))}
      </View>

      {/* Featured */}
      {data?.featured?.length ? (
        <Rail
          title="Deals of the day"
          products={data.featured}
          cart={cart}
          navigation={navigation}
        />
      ) : null}

      {/* The aisles inside each department, four to a row. */}
      {(data?.categories || []).map((category, index) =>
        category.children?.length ? (
          <View key={`aisles-${category.id}`} style={{ marginBottom: spacing.xl }}>
            <SectionHeader
              title={category.name}
              actionLabel="See all"
              onAction={() => navigation.navigate("ProductList", { slug: category.slug, title: category.name })}
            />
            <View style={styles.aisleGrid}>
              {category.children.slice(0, 8).map((child) => (
                <Pressable
                  key={child.id}
                  style={{ width: tileW }}
                  onPress={() => navigation.navigate("ProductList", { slug: child.slug, title: child.name })}
                >
                  <View style={[styles.aisleImageBox, { width: tileW, height: tileW, backgroundColor: AISLE_TINTS[index % AISLE_TINTS.length] }]}>
                    {child.image ? (
                      <Image source={{ uri: child.image }} style={styles.aisleImage} resizeMode="contain" />
                    ) : (
                      <Text style={{ fontSize: 26 }}>{child.icon || category.icon || "🛍️"}</Text>
                    )}
                  </View>
                  <Text style={styles.aisleName} numberOfLines={2}>{child.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null
      )}

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
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 10 }}
        renderItem={({ item }) => {
          const variantId = item.defaultVariant;
          // Once an item is in the cart its line carries the real step, unit
          // and limits, so the stepper on a listing behaves exactly like the
          // one on the product page.
          const line = cart.items.find((i) => String(i.variant) === String(variantId));

          return (
            <View style={{ width: TILE_WIDTH }}>
              <ProductTile
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 0,
    backgroundColor: colors.primary,
    gap: spacing.md,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  locationRow: { flex: 1 },
  deliveryIn: { color: "rgba(255,255,255,0.85)", fontSize: 11.5, fontFamily: fontFamily.semibold },
  deliveryBig: { color: "#fff", fontSize: 27, lineHeight: 32, fontFamily: fontFamily.extrabold, letterSpacing: -0.4 },
  locationValue: { color: "rgba(255,255,255,0.92)", fontSize: 13, fontFamily: fontFamily.semibold, marginTop: 1 },
  avatarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  tabRow: { paddingTop: 2, gap: 4 },
  tab: { alignItems: "center", minWidth: 62, paddingHorizontal: 10, paddingTop: 4, paddingBottom: 8, borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#fff" },
  tabGlyph: { fontSize: 22, lineHeight: 28, height: 28 },
  tabImage: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#fff" },
  tabText: { color: "rgba(255,255,255,0.88)", fontSize: 11.5, fontFamily: fontFamily.semibold, marginTop: 3, maxWidth: 84 },
  tabTextActive: { color: "#fff", fontFamily: fontFamily.extrabold },
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
  offerCard: { width: 256, padding: spacing.xs, borderRadius: 18, borderWidth: 0 },
  // A fixed height: the picture is laid over its box, so its own size can no
  // longer stretch the whole card.
  offerRowInner: { flexDirection: "row", alignItems: "stretch", height: 112 },
  offerText: { flex: 1, paddingVertical: 4, paddingHorizontal: spacing.sm, justifyContent: "center" },
  // The picture fills a rounded square with a thin white border, instead of
  // floating as a loose cut-out.
  // A round picture with a white rim, centred on the right of the card.
  offerImageWrap: {
    width: 84,
    height: 84,
    marginLeft: spacing.xs,
    marginRight: spacing.xs,
    borderRadius: 42,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.95)",
    alignSelf: "center",
  },
  offerImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  offerBadgePill: { alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, marginBottom: 4 },
  offerBadge: { fontFamily: fontFamily.extrabold, fontSize: 10.5 },
  offerTitle: { ...type.h3, fontSize: 15, lineHeight: 19, marginBottom: 1, color: "#fff" },
  offerDesc: { ...type.small, fontSize: 11, lineHeight: 14, color: "rgba(255,255,255,0.88)" },
  codeChip: {
    alignSelf: "flex-start",
    marginTop: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  codeText: { color: "#fff", fontWeight: "800", fontSize: 10.5 },
  autoApplied: { ...type.tiny, marginTop: 5, color: "#fff", fontWeight: "700", opacity: 0.95 },

  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  catCard: { backgroundColor: "#EEF3F1", borderRadius: 18, padding: 6, alignItems: "center", paddingBottom: 10 },
  collage: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  collageCell: { backgroundColor: "#fff", borderRadius: 11, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  collageSingle: { backgroundColor: "#fff", borderRadius: 13, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  collageImage: { width: "88%", height: "88%" },
  catCardName: { marginTop: 8, fontSize: 12.5, lineHeight: 16, textAlign: "center", color: colors.text, fontFamily: fontFamily.bold, paddingHorizontal: 2 },

  aisleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: spacing.lg, rowGap: 14 },
  aisleImageBox: { borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  aisleImage: { width: "86%", height: "86%" },
  aisleName: { marginTop: 6, fontSize: 11.5, lineHeight: 14, textAlign: "center", color: colors.text, fontFamily: fontFamily.semibold },
});
