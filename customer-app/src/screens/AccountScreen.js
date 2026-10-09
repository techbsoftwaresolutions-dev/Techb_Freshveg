import React from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, Divider, EmptyState, Pill } from "../components/ui";

const SUPPORT_PHONES = [
  { number: "+918072605216", label: "+91 80726 05216" },
  { number: "+916374047119", label: "+91 63740 47119" },
];

export default function AccountScreen({ navigation }) {
  const { user, signedIn, signOut } = useAuth();
  const { store, pincode } = useStore();

  if (!signedIn) {
    return (
      <EmptyState
        title="Sign in to your account"
        hint="Track orders, save addresses, and use your wallet and loyalty points."
        action={<Button title="Sign in" onPress={() => navigation.navigate("Login")} />}
      />
    );
  }

  const initials = (user.name || user.phone || "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.h2}>{user.name || "Add your name"}</Text>
          <Text style={type.small}>+91 {user.phone}</Text>
        </View>
      </Card>

      {/* Wallet and loyalty are real balances the engine credits on delivery. */}
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Card style={styles.balanceCard}>
          <Text style={type.tiny}>Wallet</Text>
          <Text style={styles.balanceValue}>{rupees(user.walletBalance)}</Text>
          <Text style={type.tiny}>Usable at checkout</Text>
        </Card>
        <Card style={styles.balanceCard}>
          <Text style={type.tiny}>Loyalty points</Text>
          <Text style={styles.balanceValue}>{user.loyaltyPoints}</Text>
          <Text style={type.tiny}>100 points = ₹10</Text>
        </Card>
      </View>

      {user.referralCode ? (
        <Card style={{ padding: spacing.md }}>
          <Text style={type.h3}>Your referral code</Text>
          <View style={styles.referralRow}>
            <Text style={styles.referralCode}>{user.referralCode}</Text>
            <Pill tone="primary">Share & earn</Pill>
          </View>
        </Card>
      ) : null}

      {/* Addresses */}
      <Card style={{ padding: spacing.md }}>
        <Text style={type.h3}>Saved addresses</Text>
        {user.addresses?.length ? (
          user.addresses.map((address, index) => (
            <View key={address.id}>
              {index > 0 ? <Divider style={{ marginVertical: spacing.sm }} /> : null}
              <View style={{ marginTop: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.addressLabel}>{address.label}</Text>
                  {address.isDefault ? <Pill tone="primary">Default</Pill> : null}
                </View>
                <Text style={type.small} numberOfLines={2}>
                  {[address.line1, address.line2, address.city, address.pincode].filter(Boolean).join(", ")}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={[type.small, { marginTop: spacing.sm }]}>
            No addresses saved. You can add one at checkout.
          </Text>
        )}
      </Card>

      {/* Delivery location */}
      <Card style={{ padding: spacing.md }} onPress={() => navigation.navigate("Location")}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>Delivery location</Text>
            <Text style={type.small}>
              {pincode ? `${pincode}${store?.name ? ` · ${store.name}` : ""}` : "Not set"}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Card>

      {/* Links */}
      <Card style={{ padding: 0 }}>
        {[
          { label: "My orders", onPress: () => navigation.navigate("OrdersTab") },
          { label: "Help & support", onPress: () => Alert.alert("Support", "Support tickets are not built yet.") },
          { label: "Notification settings", onPress: () => Alert.alert("Notifications", "Preferences screen is not built yet.") },
        ].map((item, index) => (
          <View key={item.label}>
            {index > 0 ? <Divider /> : null}
            <Pressable style={styles.linkRow} onPress={item.onPress}>
              <Text style={[type.body, { flex: 1, fontWeight: "600" }]}>{item.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      {/* The shop's own line, for anything the app can't sort out. */}
      <Card style={styles.supportCard}>
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>Need help?</Text>
          <Text style={type.small}>Call The Farmers Basket on either number</Text>
        </View>
        <View style={styles.supportCalls}>
          {SUPPORT_PHONES.map((phone) => (
            <Button
              key={phone.number}
              title={phone.label}
              variant="outline"
              onPress={() => Linking.openURL(`tel:${phone.number}`).catch(() => {})}
            />
          ))}
        </View>
      </Card>

      <Button
        title="Sign out"
        variant="ghost"
        onPress={() =>
          Alert.alert("Sign out?", "Your cart stays saved to this device.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: signOut },
          ])
        }
      />

      <Text style={[type.tiny, { textAlign: "center", marginTop: spacing.md }]}>
        The Farmers Basket · v0.1.0 · thefarmersbasket.in
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primaryDark, fontWeight: "800", fontSize: 17 },

  balanceCard: { flex: 1, padding: spacing.md, gap: 2 },
  supportCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm },
  supportCalls: { gap: spacing.xs },
  balanceValue: { fontSize: 20, fontWeight: "800", color: colors.text },

  referralRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  referralCode: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },

  addressLabel: { ...type.body, fontWeight: "700", fontSize: 13.5 },

  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  linkRow: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  chevron: { fontSize: 22, color: colors.textFaint },
});
