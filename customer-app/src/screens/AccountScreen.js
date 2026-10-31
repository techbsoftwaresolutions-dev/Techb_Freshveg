import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import { Text, TextInput } from "../components/AppText";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, Divider, EmptyState, Pill } from "../components/ui";

const SUPPORT_PHONE = "+919003597158";
const SUPPORT_PHONE_LABEL = "+91 90035 97158";

export default function AccountScreen({ navigation }) {
  const { user, signedIn, signOut } = useAuth();
  const { store, pincode } = useStore();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return;
      api.get("/notifications", { limit: 1 }).then((d) => setUnread(d.unread || 0)).catch(() => {});
    }, [signedIn])
  );

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
      <Card style={styles.profile} onPress={() => navigation.navigate("EditProfile")}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.h2}>{user.name || "Add your name"}</Text>
          <Text style={type.small}>+91 {user.phone}</Text>
          {user.email ? <Text style={type.small}>{user.email}</Text> : null}
        </View>
        <View style={styles.editPill}>
          <Text style={styles.editPillText}>Edit</Text>
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

      {user.referralCode ? <ReferralCard code={user.referralCode} /> : null}

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
          { label: unread ? `Notifications (${unread} new)` : "Notifications", onPress: () => navigation.navigate("Notifications") },
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
          <Text style={type.small}>Call Hosur Basket on {SUPPORT_PHONE_LABEL}</Text>
        </View>
        <Button title="Call" variant="outline" onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {})} />
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
        Hosur Basket · v0.1.0 · hosurbasket.com
      </Text>
    </ScrollView>
  );
}

// Public website the invite link points at (WEB_BASE_URL in .env).
const WEB_BASE_URL = (Constants.expoConfig?.extra?.webBaseUrl || "https://hosurbasket.com").replace(/\/+$/, "");

// "Share & earn": the customer's own code, what a friend gets and what they
// earn (from the store's referral settings), a button that opens the phone's
// share sheet, and a place to type in a friend's code.
function ReferralCard({ code }) {
  const [info, setInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [entering, setEntering] = useState(false);
  const [friendCode, setFriendCode] = useState("");
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(() => {
    api.get("/referrals/me").then(setInfo).catch(() => {});
  }, []);
  useEffect(load, [load]);

  // Switched off in the admin: the card stays, but promises nothing.
  const running = info ? info.enabled : true;
  const give = info ? rupees(info.friendReward) : "";
  const earn = info ? rupees(info.reward) : "";

  const share = async () => {
    const reward = info && running ? ` We both get a reward: you get ${give} on your first order and I earn ${earn}.` : "";
    const message = `Shop fresh groceries on Hosur Basket! Use my referral code ${code} when you sign up.${reward}\n${WEB_BASE_URL}`;
    try {
      await Share.share({ message });
    } catch {
      // Closing the share sheet is not an error.
    }
  };

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Not fatal.
    }
  };

  const claim = async () => {
    const value = friendCode.trim();
    if (!value) return;
    setClaiming(true);
    try {
      const res = await api.post("/referrals/claim", { code: value });
      Alert.alert("Code applied", res.message || "Your reward arrives after your first delivered order.");
      setEntering(false);
      setFriendCode("");
    } catch (err) {
      Alert.alert("Couldn't apply the code", err.message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Card style={{ padding: spacing.md }}>
      <Text style={type.h3}>Your referral code</Text>
      <View style={styles.referralRow}>
        <Pressable onPress={copy} accessibilityLabel="Copy referral code">
          <Text style={styles.referralCode}>{copied ? "Copied" : code}</Text>
        </Pressable>
        <Pressable style={styles.shareButton} onPress={share} accessibilityRole="button">
          <Text style={styles.shareButtonText}>Share & earn</Text>
        </Pressable>
      </View>

      {info && running ? (
        <Text style={[type.small, { marginTop: spacing.sm }]}>
          Friends get {give}, you earn {earn} after their first delivered order.
          {info.invited ? `  ${info.invited} invited · ${rupees(info.earned)} earned` : ""}
        </Text>
      ) : null}

      <Pressable onPress={() => setEntering((v) => !v)} style={{ marginTop: spacing.sm }}>
        <Text style={styles.haveCode}>{entering ? "Cancel" : "Have a friend's code?"}</Text>
      </Pressable>
      {entering ? (
        <View style={styles.claimRow}>
          <TextInput
            value={friendCode}
            onChangeText={(t) => setFriendCode(t.toUpperCase())}
            placeholder="Enter code"
            autoCapitalize="characters"
            style={styles.claimInput}
          />
          <Button title="Apply" size="sm" loading={claiming} disabled={!friendCode.trim()} onPress={claim} />
        </View>
      ) : null}
    </Card>
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
  editPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.primarySoft },
  editPillText: { color: colors.primaryDark, fontWeight: "700", fontSize: 12.5 },

  balanceCard: { flex: 1, padding: spacing.md, gap: 2 },
  supportCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginBottom: spacing.sm },
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

  shareButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 14, height: 34, alignItems: "center", justifyContent: "center" },
  shareButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  haveCode: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  claimRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  claimInput: { flex: 1, height: 40, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 14, color: colors.text },
  addressLabel: { ...type.body, fontWeight: "700", fontSize: 13.5 },

  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  linkRow: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  chevron: { fontSize: 22, color: colors.textFaint },
});
