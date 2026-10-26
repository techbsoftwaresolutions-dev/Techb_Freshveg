import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../components/Text";
import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import { useStore } from "../context/StoreContext";
import { colors, fontFamily, radius, shadow, spacing, type } from "../theme";
import { Card, EmptyState, IconTile, Loading, Notice, SectionHeader } from "../components/ui";
import ProductCard from "../components/ProductCard";
import VideoHeroBanner, { HeroShade } from "../components/VideoHeroBanner";
import BrandLogo, { primeBranding } from "../components/BrandLogo";
import { useTabBarScroll, useTabBarSpace } from "../navigation/tabBarScroll";

const CARD_WIDTH = 176;

// The website's mobile home, top to bottom: logo + location pill, the search
// pill, category chips, the hero banners, "Shop by Category", the farm story
// band, offers, then one product rail per department.
export default function HomeScreen({ navigation }) {
  const scroll = useTabBarScroll();
  const { space } = useTabBarSpace();
  const insets = useSafeAreaInsets();
  const { store, pincode, storeId } = useStore();
  const cart = useCart();

  const [data, setData] = useState(null);
  const [banners, setBanners] = useState([]);
  const [videoHero, setVideoHero] = useState(null);
  const [heroCopy, setHeroCopy] = useState({ text: "", ctaLabel: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      // The whole home screen is one request — round trips are the expensive
      // thing on a phone connection, not payload size.
      // Banners are the admin's (Marketing → Banners), the same "home_hero"
      // set the website shows. A banner failure never blocks the shelves.
      // The logo is the one uploaded in Admin → Settings → Branding, as on the
      // website; the bundled artwork stands in when none is set.
      // The hero style is Admin → Settings → Apps (app.homeHero): "video"
      // plays the website's Video Hero playlist; with no playable list, or no
      // settings at all, the classic banners show.
      const [home, live, settings] = await Promise.all([
        // platform=app: only the landing sections switched on for the app.
        api.get("/storefront/home", { store: storeId || undefined, platform: "app" }),
        api.get("/banners/live", { placement: "home_hero" }).catch(() => ({ banners: [] })),
        api.get("/settings/public").catch(() => null),
      ]);
      setData(home);
      setBanners(live.banners || []);
      primeBranding(settings?.settings?.branding);
      const site = settings?.settings;
      const video = site?.app?.homeHero === "video" && site.website?.videoHero?.videos?.length ? site.website.videoHero : null;
      setVideoHero(video);
      // The admin's words for the app's hero (Settings → Apps); Video Hero
      // falls back to the website's hero text.
      setHeroCopy({
        text: site?.app?.heroText?.trim() || (video ? video.text : ""),
        ctaLabel: site?.app?.heroCtaLabel ?? "Shop Now",
      });
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

  const categories = data?.categories || [];
  const openCategory = (category) => navigation.navigate("ProductList", { slug: category.slug, title: category.name });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: spacing.xxl + space }}
      {...scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      stickyHeaderIndices={[0]}
    >
      {/* Header: logo, location pill, search, chips — stays on top while scrolling. */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <View style={styles.logoBox} accessibilityRole="image" accessibilityLabel="The Farmers Basket">
            <BrandLogo style={styles.logo} />
          </View>
          <Pressable
            style={styles.locationPill}
            onPress={() => navigation.navigate("Location")}
            accessibilityRole="button"
            accessibilityLabel="Change delivery location"
          >
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {store?.address?.city || pincode || "Set location"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.primaryDark} />
          </Pressable>
        </View>

        <Pressable
          style={styles.search}
          onPress={() => navigation.navigate("Search")}
          accessibilityRole="search"
          accessibilityLabel="Search products"
        >
          <Ionicons name="search-outline" size={19} color={colors.textMuted} />
          <Text style={styles.searchPlaceholder} numberOfLines={1}>
            Search for “Tomatoes”
          </Text>
          <View style={styles.searchButton}>
            <Ionicons name="search" size={18} color={colors.onPrimary} />
          </View>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable style={styles.chip} onPress={() => navigation.navigate("CategoriesTab")}>
            <Ionicons name="menu" size={17} color={colors.primary} />
            <Text style={styles.chipText}>All Categories</Text>
          </Pressable>
          {categories.map((category) => (
            <Pressable key={category.id} style={styles.chip} onPress={() => openCategory(category)}>
              <Text style={styles.chipText}>{category.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.padded}>
          <Notice tone="error">{error}</Notice>
        </View>
      ) : null}

      {data?.store?.isOpen === false ? (
        <View style={styles.padded}>
          <Notice tone="warn">{store?.name || "The store"} is closed right now. You can still browse and build your cart.</Notice>
        </View>
      ) : null}

      {videoHero ? (
        <VideoHeroBanner
          // A new playlist is a new player.
          key={videoHero.videos.map((video) => video.url).join(" ")}
          videos={videoHero.videos}
          text={heroCopy.text}
          ctaLabel={heroCopy.ctaLabel}
          onPress={() => navigation.navigate("CategoriesTab")}
        />
      ) : (
        <BannerStrip banners={banners} copy={heroCopy} navigation={navigation} />
      )}

      {/* Shop by Category — round photos in one swipeable row, in a white
          panel. Every tile is the same fixed width however many categories
          are switched on; more categories only make the row longer. */}
      {categories.length ? (
        <View style={styles.section}>
          <SectionHeader title="Shop by Category" actionLabel="View All" onAction={() => navigation.navigate("CategoriesTab")} />
          <Card style={styles.categoryPanel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {categories.map((category) => (
                <Pressable key={category.id} style={styles.categoryTile} onPress={() => openCategory(category)} accessibilityRole="link">
                  <View style={styles.categoryCircle}>
                    {category.image ? (
                      <Image source={{ uri: category.image }} style={styles.categoryImage} resizeMode="cover" />
                    ) : (
                      <Ionicons name="leaf-outline" size={28} color={colors.primary} />
                    )}
                  </View>
                  <Text style={styles.categoryName} numberOfLines={2}>
                    {category.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        </View>
      ) : null}


      {data?.offers?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offerRow}>
          {data.offers.map((offer) => (
            <Card key={offer.id} style={styles.offerCard}>
              <View style={styles.offerInner}>
                <IconTile name="pricetag-outline" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerTitle} numberOfLines={2}>
                    {offer.title}
                  </Text>
                  <Text style={type.small} numberOfLines={2}>
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
              </View>
            </Card>
          ))}
        </ScrollView>
      ) : null}

      {/* Admin → Landing Page → Sections: which rails, in what order, with
          their products in the admin's order — all decided by the API, so a
          change there needs no app release. A category rail opens its aisle. */}
      {(data?.landing || []).map((section) => (
        <Rail
          key={section.id}
          title={section.name}
          products={section.products}
          cart={cart}
          navigation={navigation}
          onSeeAll={section.category ? () => openCategory(section.category) : undefined}
        />
      ))}

      {!data?.landing?.length ? (
        <EmptyState icon="basket-outline" title="Nothing stocked yet" hint="Once products are published in the admin they will show up here." />
      ) : null}
    </ScrollView>
  );
}

function Rail({ title, products, cart, navigation, onSeeAll }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} actionLabel={onSeeAll ? "View All" : undefined} onAction={onSeeAll} />
      <FlatList
        horizontal
        data={products}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 4 }}
        initialNumToRender={3}
        windowSize={5}
        renderItem={({ item }) => {
          const variantId = item.defaultVariant;
          // Once an item is in the cart its line carries the real step, unit
          // and limits, so the stepper on a listing behaves exactly like the
          // one on the product page.
          const line = cart.items.find((i) => String(i.variant) === String(variantId));

          return (
            <ProductCard
              width={CARD_WIDTH}
              wideAdd
              product={item}
              variant={line}
              quantity={line?.quantity || 0}
              busy={Boolean(cart.pending[variantId])}
              onPress={() => navigation.navigate("ProductDetail", { slug: item.slug })}
              onAdd={() => cart.add(variantId).catch(() => { })}
              onChange={(quantity) => cart.setQuantity(variantId, quantity).catch(() => { })}
              onRemove={() => cart.remove(variantId).catch(() => { })}
            />
          );
        }}
      />
    </View>
  );
}

// Where a banner tap goes — the same target kinds the website maps to links.
function openBanner(target, navigation) {
  if (!target?.value) return;
  if (target.kind === "category") navigation.navigate("ProductList", { slug: target.value, title: "" });
  else if (target.kind === "product") navigation.navigate("ProductDetail", { slug: target.value });
  else if (target.kind === "search") navigation.navigate("Search", { q: target.value });
  else if (target.kind === "url" && /^https?:\/\//.test(target.value)) Linking.openURL(target.value).catch(() => { });
}

// The classic hero: the admin's banners, or — as on the website, until one is
// added — the bundled harvest photo.
// With hero text set in Settings → Apps, each banner carries it over a shade.
function BannerStrip({ banners, copy, navigation }) {
  // The live window size, so a rotated phone or a browser switched to mobile
  // view re-sizes the banner instead of keeping the width it first saw.
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(windowWidth - spacing.lg * 2, 0);
  // Height follows the width (a 343 x 160 card on a phone), within limits so it
  // is never a thin strip on a wide screen; with words, at least enough for
  // three lines and the button. A fixed height, and fixed photo sizes, not a
  // minimum with a 100% photo: on iOS the bundled photo's own 768pt height
  // then set the card's height, filling the whole screen.
  const height = Math.max(Math.round(Math.min(Math.max(width / 2.15, 150), 280)), copy.text ? 170 : 0);
  const fill = [styles.bannerFill, { width, height }];
  const words = copy.text ? (
    <>
      <HeroShade fromLeft />
      <HeroShade style={styles.bannerShade} />
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerText} numberOfLines={3} maxFontSizeMultiplier={1.3}>
          {copy.text}
        </Text>
        {copy.ctaLabel ? (
          <View style={styles.bannerCta}>
            <Text style={styles.bannerCtaText} maxFontSizeMultiplier={1.3}>{copy.ctaLabel}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.primaryDark} />
          </View>
        ) : null}
      </View>
    </>
  ) : null;

  if (!banners.length) {
    return (
      <Pressable
        style={styles.padded}
        onPress={() => navigation.navigate("CategoriesTab")}
        accessibilityRole="link"
        accessibilityLabel={copy.text || "Basket of farm-fresh vegetables. Shop all categories"}
      >
        <View style={[styles.bannerFrame, { width, height }]}>
          <Image source={require("../../assets/hero.webp")} style={fill} resizeMode="cover" />
          {words}
        </View>
      </Pressable>
    );
  }
  return (
    <ScrollView
      horizontal
      pagingEnabled={banners.length > 1}
      showsHorizontalScrollIndicator={false}
      snapToInterval={width + spacing.sm}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.lg }}
    >
      {banners.map((banner) => (
        <Pressable
          key={banner.id}
          onPress={() => openBanner(banner.target, navigation)}
          accessibilityRole={banner.target?.kind && banner.target.kind !== "none" ? "link" : "image"}
          accessibilityLabel={copy.text || banner.title || "Offer banner"}
        >
          <View style={[styles.bannerFrame, { width, height, backgroundColor: banner.backgroundColor || colors.surfaceAlt }]}>
            <Image source={{ uri: banner.mobileImage || banner.image }} style={fill} resizeMode="cover" />
            {words}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  section: { marginTop: spacing.xl },

  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  // The artwork carries a wide white margin; the box crops it (as .logo does).
  logoBox: { width: 104, height: 52, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  logo: { width: 104, height: 52, transform: [{ scale: 1.25 }] },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 190,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  locationText: { fontSize: 15, fontWeight: "600", color: colors.primaryDark, flexShrink: 1 },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 50,
    paddingLeft: 14,
    paddingRight: 5,
    borderRadius: 14,
    backgroundColor: "#F2F4F3",
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchPlaceholder: { flex: 1, color: colors.textFaint, fontSize: 14.5 },
  searchButton: {
    width: 44,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { fontSize: 13.5, fontWeight: "500", color: colors.text },

  // Taller once it carries words, so they never crowd the photo.
  bannerFrame: { borderRadius: radius.lg, overflow: "hidden", justifyContent: "flex-end" },
  // Sized in numbers by BannerStrip (see there).
  bannerFill: { position: "absolute", top: 0, left: 0 },
  bannerShade: { top: "20%" },
  bannerCopy: { padding: spacing.md, paddingTop: 48, gap: spacing.sm, alignItems: "flex-start" },
  bannerText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: "#fff",
    textShadowColor: "rgba(0, 0, 0, 0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  bannerCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: "#fff",
  },
  bannerCtaText: { fontSize: 13.5, fontWeight: "700", color: colors.primaryDark },

  categoryPanel: {
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
  },
  // Room above and below for the circles' white ring and shadow, which a
  // horizontal ScrollView would otherwise clip.
  categoryRow: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  categoryTile: { width: 92, alignItems: "center", paddingHorizontal: 4 },
  categoryCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: "hidden",
    backgroundColor: colors.primarySoft,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
  },
  categoryImage: { width: "100%", height: "100%" },
  categoryName: { fontSize: 12.5, fontWeight: "500", color: colors.text, textAlign: "center", marginTop: 6 },

  storyBand: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    padding: spacing.lg,
  },
  eyebrow: { fontSize: 11, fontWeight: "600", letterSpacing: 1.5, color: colors.primary },
  storyTitle: { fontFamily: fontFamily.serif, fontSize: 22, color: colors.primaryDeep, marginTop: 4 },
  storyFeatures: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  storyFeature: { flex: 1, alignItems: "center", gap: 6 },
  storyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  storyFeatureText: { fontSize: 11.5, textAlign: "center", color: colors.text, lineHeight: 15 },

  offerRow: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.lg },
  offerCard: { width: 260, padding: spacing.md },
  offerInner: { flexDirection: "row", gap: spacing.md },
  offerTitle: { ...type.h3, marginBottom: 2 },
  codeChip: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
  },
  codeText: { color: colors.primaryDark, fontWeight: "700", fontSize: 12 },
  autoApplied: { ...type.tiny, marginTop: spacing.sm, color: colors.save, fontWeight: "600" },
});
