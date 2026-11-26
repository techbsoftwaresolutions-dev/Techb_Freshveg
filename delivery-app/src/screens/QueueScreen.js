import React, { useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import useQueue from "../hooks/useQueue";
import { colors, radius, rupees, shadow, spacing, type } from "../theme";
import { Card, Loading, Notice } from "../components/ui";
import { LiveRunCard, UpcomingRunCard } from "../components/RunCards";

const LOGO = require("../../assets/hb-logo.png");
const BANNER = require("../../assets/home-header.png");
const BANNER_RATIO = 1520 / 376;
// The banner fades into this green at the top, so the status bar area blends in.
const HEADER_GREEN = "#0C8A45";

// Home: who you are, today's numbers, the cash you are holding, and the runs
// that need you (live ones first, then orders still being prepared).
export default function QueueScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const bannerHeight = Math.round(width / BANNER_RATIO);
  const { orders, upcoming, stats, loading, refreshing, error, refresh } = useQueue();
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");

  async function showNotifications() {
    setNotificationsVisible(true);
    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const data = await api.get("/notifications", { limit: 50 });
      setNotifications(data.items || []);
    } catch (err) {
      setNotificationsError(err.message);
    } finally {
      setNotificationsLoading(false);
    }
  }

  if (loading) return <Loading label="Loading your runs" />;

  const open = (item) => navigation.navigate("Delivery", { orderId: item.id });
  const subtitle = orders.length
    ? `${orders.length} ${orders.length === 1 ? "delivery" : "deliveries"} in hand`
    : upcoming.length
      ? `${upcoming.length} coming up — the store is preparing`
      : "Nothing assigned right now";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, height: insets.top + bannerHeight + 92 }]}>
        {/* The rider banner sits along the bottom; its white wave is the header's curve. */}
        <Image
          pointerEvents="none"
          source={BANNER}
          resizeMode="cover"
          style={[styles.banner, { height: bannerHeight }]}
        />

        <View style={styles.topRow}>
          <View style={styles.brand}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <View>
              <Text style={styles.brandName}>Hosur Basket</Text>
              <Text style={styles.brandTag}>Fresh Produce • Better Life</Text>
            </View>
          </View>
          <View style={styles.topActions}>
            <Pressable
              style={styles.iconBtn}
              onPress={showNotifications}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {upcoming.length + orders.length > 0 ? <View style={styles.dot} /> : null}
            </Pressable>
            <Pressable style={styles.avatar} onPress={() => navigation.navigate("Profile")}>
              <Ionicons name="person" size={22} color={colors.primaryDark} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.greeting}>Hi, {user?.name?.split(" ")[0] || "partner"}</Text>
        <Text style={styles.sub} numberOfLines={1} adjustsFontSizeToFit>{subtitle}</Text>
      </View>

      {/* Stats overlap the header */}
      <View style={styles.statRow}>
        <StatCard
          icon="truck-delivery-outline"
          tint={colors.success}
          soft={colors.successSoft}
          value={stats?.deliveredToday ?? 0}
          label="Delivered today"
          onPress={() => navigation.navigate("Orders", { tab: "done", at: Date.now() })}
        />
        <StatCard
          icon="package-variant-closed"
          tint={colors.blue}
          soft={colors.blueSoft}
          value={stats?.pending ?? 0}
          label="In hand"
          onPress={() => navigation.navigate("Orders", { tab: "active", at: Date.now() })}
        />
      </View>

      {/* Cash to deposit */}
      <View style={styles.cashCard}>
        <View style={styles.cashIcon}>
          <Ionicons name="wallet-outline" size={22} color="#fff" />
        </View>
        <View style={styles.cashContent}>
          <Text style={styles.cashLabel} numberOfLines={1}>Cash to deposit:</Text>
          <Text style={styles.cashValue} numberOfLines={1}>
            {rupees(stats?.codCollected)}
          </Text>
        </View>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Notice tone="error">{error}</Notice>
        </View>
      ) : null}

      {orders.length ? (
        <Section title="Active deliveries" onAll={() => navigation.navigate("Orders")}>
          {orders.slice(0, 3).map((item) => (
            <LiveRunCard key={item.id} item={item} onPress={() => open(item)} />
          ))}
        </Section>
      ) : null}

      {upcoming.length ? (
        <Section title="Upcoming Order" onAll={() => navigation.navigate("Orders")}>
          {upcoming.slice(0, 3).map((item) => (
            <UpcomingRunCard key={item.id} item={item} onPress={() => open(item)} />
          ))}
        </Section>
      ) : null}

      {!orders.length && !upcoming.length ? (
        <Card style={styles.empty}>
          <MaterialCommunityIcons name="moped-outline" size={44} color={colors.primary} />
          <Text style={[type.h3, { marginTop: spacing.sm }]}>No deliveries assigned</Text>
          <Text style={[type.small, { textAlign: "center", marginTop: 4 }]}>
            When the store assigns you an order it will appear here. Pull down to refresh.
          </Text>
        </Card>
      ) : null}
      <Modal
        visible={notificationsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotificationsVisible(false)}
      >
        <View style={styles.notificationBackdrop}>
          <View style={styles.notificationPanel}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationHeading}>Notifications</Text>
              <Pressable
                onPress={() => setNotificationsVisible(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close notifications"
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {notificationsLoading ? (
              <ActivityIndicator style={{ margin: spacing.xl }} color={colors.primary} />
            ) : notificationsError ? (
              <Text style={styles.notificationEmpty}>{notificationsError}</Text>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={notifications.length ? { padding: spacing.md, gap: spacing.sm } : styles.notificationEmptyWrap}
                ListEmptyComponent={
                  <Text style={styles.notificationEmpty}>No notifications yet.</Text>
                }
                renderItem={({ item }) => (
                  <View style={[styles.notificationCard, !item.readAt && styles.notificationUnread]}>
                    <View style={[styles.notificationDot, !item.readAt && styles.notificationDotUnread]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notificationTitle}>{item.title}</Text>
                      <Text style={styles.notificationBody}>{item.body}</Text>
                      <Text style={styles.notificationTime}>
                        {notificationAge(item.createdAt)}
                        {item.orderCode ? ` · ${item.orderCode}` : ""}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function notificationAge(value) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function StatCard({ icon, tint, soft, value, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.stat, { backgroundColor: soft }]}>
      {/* The coloured swoosh along the bottom edge. */}
      <View pointerEvents="none" style={[styles.swoosh, { backgroundColor: tint }]} />
      <View style={[styles.statIcon, { backgroundColor: tint }]}>
        <MaterialCommunityIcons name={icon} size={22} color="#fff" />
      </View>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <View style={styles.statFoot}>
        <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
        <View style={[styles.statArrow, { backgroundColor: tint }]}>
          <Ionicons name="chevron-forward" size={13} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}

function Section({ title, onAll, children }) {
  return (
    <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.md }}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable onPress={onAll} style={styles.viewAll} hitSlop={8}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  notificationBackdrop: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 62,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  notificationPanel: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  notificationHeader: {
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notificationHeading: { ...type.h3, color: colors.text },
  notificationEmptyWrap: { flexGrow: 1, justifyContent: "center" },
  notificationEmpty: { ...type.small, color: colors.textMuted, textAlign: "center", padding: spacing.lg },
  notificationCard: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationUnread: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  notificationDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  notificationDotUnread: { backgroundColor: colors.primary },
  notificationTitle: { ...type.h3, marginBottom: 2 },
  notificationBody: { ...type.small, color: colors.textMuted },
  notificationTime: { ...type.tiny, color: colors.textFaint, marginTop: 4 },

  header: {
    backgroundColor: HEADER_GREEN,
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
  },
  banner: { position: "absolute", left: 0, right: 0, bottom: 0, width: "100%" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logo: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#FFFDF6" },
  brandName: { color: "#fff", fontSize: 19, fontWeight: "800" },
  brandTag: { color: "rgba(255,255,255,0.8)", fontSize: 10.5, fontWeight: "600" },
  topActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBtn: { padding: 4 },
  dot: {
    position: "absolute",
    top: 3,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: HEADER_GREEN,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: { color: "#fff", fontSize: 32, fontWeight: "800", marginTop: spacing.md, letterSpacing: -0.5 },
  sub: { color: "rgba(255,255,255,0.95)", fontSize: 13, fontWeight: "600", marginTop: 2, maxWidth: "62%" },

  statRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: 6 },
  stat: {
    flex: 1,
    borderRadius: 18,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: 6,
    overflow: "hidden",
    ...shadow.card,
  },
  swoosh: {
    position: "absolute",
    left: "-15%",
    bottom: -24,
    width: "130%",
    height: 36,
    borderRadius: 999,
    opacity: 0.9,
    transform: [{ rotate: "-4deg" }],
  },
  statIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 26, fontWeight: "800", color: colors.text, marginTop: 2 },
  statFoot: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 4 },
  statLabel: { flex: 1, fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
  statArrow: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  cashCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.primaryDeep,
    borderRadius: 18,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadow.card,
  },
  cashIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cashContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 6,
  },
  cashLabel: { color: "rgba(255,255,255,0.92)", fontSize: 14.5, fontWeight: "600" },
  cashValue: { color: "#fff", fontSize: 22, fontWeight: "800" },

  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  viewAll: { flexDirection: "row", alignItems: "center" },
  viewAllText: { color: colors.primaryDark, fontWeight: "800", fontSize: 14.5 },

  empty: { margin: spacing.lg, marginTop: spacing.xl, padding: spacing.xl, alignItems: "center" },
});
