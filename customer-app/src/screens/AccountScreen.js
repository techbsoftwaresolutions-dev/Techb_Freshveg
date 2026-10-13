import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../components/Text";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { colors, radius, rupees, shadow, spacing, type } from "../theme";
import { Button, Card, Divider, EmptyState, IconTile } from "../components/ui";
import { statusLook } from "./OrdersScreen";

// The website's mobile account page (components/AccountMobile.jsx): a green
// profile card, four balance tiles, recent orders, saved addresses and a menu.
export default function AccountScreen({ navigation }) {
  const { user, signedIn, signOut } = useAuth();
  const { store, pincode } = useStore();
  const [recent, setRecent] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return;
      api
        .get("/orders/mine", { limit: 3 })
        .then((data) => setRecent(data.items))
        .catch(() => setRecent([]));
    }, [signedIn])
  );

  if (!signedIn) {
    return (
      <EmptyState
        icon="person-outline"
        title="Sign in to your account"
        hint="Track orders, save addresses, and use your wallet and loyalty points."
        action={<Button title="Sign in" onPress={() => navigation.navigate("Login")} style={{ minWidth: 180 }} />}
      />
    );
  }

  const initial = (user.name || "?").trim().charAt(0).toUpperCase() || "?";
  const addresses = user.addresses || [];

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "Your cart stays saved to this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);

  const shareCode = () =>
    Share.share({ message: `Use my The Farmers Basket referral code ${user.referralCode} on your first order!` }).catch(() => {});

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
      {/* Profile */}
      <View style={styles.hero}>
        <View style={styles.heroAvatar}>
          <Text style={styles.heroInitial}>{initial}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.heroName} numberOfLines={1}>
            {user.name || "Add your name"}
          </Text>
          <Text style={styles.heroPhone}>+91 {user.phone}</Text>
          <Pressable onPress={() => navigation.navigate("EditProfile")} hitSlop={8} accessibilityRole="link">
            <Text style={styles.heroEdit}>Edit profile</Text>
          </Pressable>
        </View>
        <Pressable onPress={confirmSignOut} style={styles.signOut} accessibilityRole="button">
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

      {/* Tiles */}
      <View style={styles.tiles}>
        <Tile icon="wallet-outline" label="Wallet balance" value={rupees(user.walletBalance)} />
        <Tile icon="ribbon-outline" label="Loyalty points" value={String(user.loyaltyPoints ?? 0)} note="100 points = ₹10 off" />
        {user.referralCode ? (
          <Tile icon="gift-outline" label="Refer a friend" value={user.referralCode} onPress={() => navigation.navigate("Referral")}>
            <Pressable onPress={shareCode} style={styles.shareBtn} hitSlop={6} accessibilityLabel="Share referral code">
              <Ionicons name="share-social-outline" size={18} color={colors.primary} />
            </Pressable>
          </Tile>
        ) : null}
        <Tile
          icon="location-outline"
          label="Delivery location"
          value={store?.address?.city || pincode || "Not set"}
          note={store?.name}
          onPress={() => navigation.navigate("Location")}
        />
      </View>

      {/* Recent orders */}
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={type.h3}>Recent orders</Text>
          <Pressable onPress={() => navigation.navigate("OrdersTab")} hitSlop={8}>
            <Text style={styles.link}>View all</Text>
          </Pressable>
        </View>
        {recent?.length ? (
          recent.map((order, index) => {
            const look = statusLook(order.status);
            return (
              <View key={order.id}>
                {index > 0 ? <Divider /> : null}
                <Pressable style={styles.orderRow} onPress={() => navigation.navigate("OrderTrack", { orderId: order.id })}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.orderCode} numberOfLines={1}>
                      {order.code}
                    </Text>
                    <Text style={type.tiny}>
                      {order.items.length} item{order.items.length === 1 ? "" : "s"} · {rupees(order.pricing.total)}
                    </Text>
                  </View>
                  <View style={[styles.status, { backgroundColor: look.bg }]}>
                    <Text style={[styles.statusText, { color: look.fg }]} numberOfLines={1}>
                      {look.label}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </Pressable>
              </View>
            );
          })
        ) : (
          <Text style={[type.small, { marginTop: spacing.sm }]}>
            {recent === null ? "Loading…" : "No orders yet — when you place one it will show up here."}
          </Text>
        )}
      </Card>

      {/* Addresses */}
      <Card style={styles.card} onPress={() => navigation.navigate("Addresses")}>
        <View style={styles.cardHead}>
          <View style={styles.titleWithIcon}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text style={type.h3}>Saved addresses</Text>
          </View>
          <Text style={styles.link}>Manage</Text>
        </View>
        {addresses.length ? (
          addresses.slice(0, 2).map((address) => (
            <View key={address.id} style={{ marginTop: spacing.sm }}>
              <Text style={styles.addressLabel}>
                {address.label}
                {address.isDefault ? <Text style={styles.defaultTag}>  Default</Text> : null}
              </Text>
              <Text style={type.small} numberOfLines={2}>
                {[address.line1, address.line2, address.landmark, address.city, address.pincode].filter(Boolean).join(", ")}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[type.small, { marginTop: spacing.sm }]}>No addresses saved yet — tap to add one.</Text>
        )}
        {addresses.length > 2 ? <Text style={[type.tiny, { marginTop: spacing.sm }]}>+{addresses.length - 2} more saved</Text> : null}
      </Card>

      {/* Menu */}
      <Card style={{ paddingVertical: spacing.xs }}>
        {[
          { label: "Edit profile", hint: "Update your name and email", icon: "person-outline", to: "EditProfile" },
          { label: "Refer & earn", hint: "Your rewards, or use a friend's code", icon: "gift-outline", to: "Referral" },
          { label: "Notifications", hint: "Inbox and what we send you", icon: "notifications-outline", to: "Notifications" },
          { label: "Help & support", hint: "Raise a request or call us", icon: "headset-outline", to: "Support" },
        ].map((item, index) => (
          <View key={item.label}>
            {index > 0 ? <Divider style={{ marginLeft: 68 }} /> : null}
            <Pressable style={styles.menuRow} onPress={() => navigation.navigate(item.to)} accessibilityRole="button">
              <IconTile name={item.icon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={type.tiny}>{item.hint}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>
          </View>
        ))}
      </Card>

      <Text style={[type.tiny, { textAlign: "center", marginTop: spacing.sm }]}>The Farmers Basket · thefarmersbasket.in</Text>
    </ScrollView>
  );
}

function Tile({ icon, label, value, note, onPress, children }) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={styles.tile} onPress={onPress}>
      <View style={styles.tileHead}>
        <IconTile name={icon} size={17} box={32} />
        <Text style={styles.tileLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={styles.tileValueRow}>
        <Text style={styles.tileValue} numberOfLines={1}>
          {value}
        </Text>
        {children}
      </View>
      {note ? (
        <Text style={type.tiny} numberOfLines={2}>
          {note}
        </Text>
      ) : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  // The website's green profile card.
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.primary,
    ...shadow.card,
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroInitial: { color: colors.onPrimary, fontSize: 22, fontWeight: "700" },
  heroName: { color: colors.onPrimary, fontSize: 19, fontWeight: "700" },
  heroPhone: { color: "rgba(255,255,255,0.85)", fontSize: 13.5 },
  heroEdit: { color: colors.onPrimary, fontSize: 13.5, fontWeight: "600", textDecorationLine: "underline", marginTop: 2 },
  signOut: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.75)",
    justifyContent: "center",
  },
  signOutText: { color: colors.onPrimary, fontSize: 13.5, fontWeight: "600" },

  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tile: {
    width: "47.5%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  tileHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tileLabel: { flex: 1, fontSize: 12.5, color: colors.textMuted },
  tileValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  tileValue: { flexShrink: 1, fontSize: 19, fontWeight: "700", color: colors.text },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  card: { padding: spacing.lg },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleWithIcon: { flexDirection: "row", alignItems: "center", gap: 6 },
  link: { color: colors.primary, fontWeight: "600", fontSize: 13.5 },

  orderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, marginTop: 4 },
  orderCode: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  status: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, maxWidth: 130 },
  statusText: { fontSize: 11, fontWeight: "600" },

  addressLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  defaultTag: { fontSize: 11.5, color: colors.primary, fontWeight: "600" },

  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, minHeight: 64 },
  menuLabel: { fontSize: 14.5, fontWeight: "600", color: colors.text },
});
