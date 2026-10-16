import React, { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Text } from "../components/Text";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, EmptyState, Loading, Notice, Pill } from "../components/ui";
import { Input } from "../components/AddressForm";

// Refer & Earn, on the API's rules (backend referrals/referral.service): a
// friend can be referred once, before their first order; the referrer earns
// a coupon each time that friend's qualifying purchases reach a milestone.
// Every count and reward shown comes from the API. (Website twin:
// app/account/refer.)
const STATUS = {
  pending: { label: "Joined", tone: "primary" },
  active: { label: "Shopping", tone: "save" },
  void: { label: "Closed", tone: "danger" },
};
const nth = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
// The website hosts referral links; the app opens with samagramart://?ref=…
const WEB_FALLBACK = "https://thefarmersbasket.in";

export default function ReferralScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [friends, setFriends] = useState(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimed, setClaimed] = useState("");
  const [copied, setCopied] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summary, list] = await Promise.all([api.get("/referrals/me"), api.get("/referrals/me/friends", { limit: 50 })]);
      setData(summary);
      setFriends(list);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function claim() {
    setClaiming(true);
    setClaimError("");
    try {
      const result = await api.post("/referrals/claim", { code: code.trim() });
      setClaimed(result.message);
      setCode("");
      load();
    } catch (err) {
      setClaimError(err.message);
    } finally {
      setClaiming(false);
    }
  }

  if (!data) {
    return error ? (
      <EmptyState title="Couldn't load referrals" hint={error} action={<Button title="Try again" onPress={load} />} />
    ) : (
      <Loading />
    );
  }

  const { rules, stats } = data;
  const link = data.shareUrl || `${WEB_FALLBACK}/?ref=${data.code}`;

  async function copy(what, text) {
    await Clipboard.setStringAsync(text).catch(() => {});
    setCopied(what);
    setTimeout(() => setCopied(""), 2000);
  }

  const share = () =>
    Share.share({ message: `Join me on The Farmers Basket — sign up with my code ${data.code}. ${link}` }).catch(() => {});

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {!data.enabled ? (
          <Notice tone="warn">
            Referrals are paused right now. Your friends and coupons are safe, and progress picks up when we restart.
          </Notice>
        ) : null}

        <Card style={{ padding: spacing.lg, gap: spacing.sm }}>
          <Text style={type.h2}>Invite friends, earn coupons</Text>
          <Text style={type.small}>1. Share your code or link. Your friend signs up with it before their first order.</Text>
          <Text style={type.small}>
            2. Every delivered order of theirs worth {rupees(rules.minQualifyingOrderValue)} or more (items, after offers) counts.
          </Text>
          <Text style={type.small}>
            3. You earn{" "}
            {rules.milestones.map((m) => `${rupees(m.reward)} at their ${nth(m.purchases)} purchase`).join(", ")}
            {rules.repeatEvery ? `, then ${rupees(rules.repeatReward)} every ${rules.repeatEvery} more` : ""}.
            {rules.welcomeReward ? ` They get a ${rupees(rules.welcomeReward)} welcome coupon on their first.` : ""}
          </Text>
          <Text style={type.small}>4. Coupons land in My coupons and last {rules.couponExpiryDays} days.</Text>

          <View style={styles.codeRow}>
            <Text style={styles.code} selectable>
              {data.code}
            </Text>
            <Button title={copied === "code" ? "Copied!" : "Copy code"} size="sm" variant="outline" onPress={() => copy("code", data.code)} />
          </View>
          <Text style={[type.tiny, { marginTop: spacing.xs }]} selectable numberOfLines={1}>
            {link}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              title={copied === "link" ? "Copied!" : "Copy link"}
              variant="outline"
              onPress={() => copy("link", link)}
              style={{ flex: 1 }}
            />
            <Button title="Share" onPress={share} disabled={!data.enabled} style={{ flex: 1 }} />
          </View>
        </Card>

        <View style={styles.stats}>
          <Card style={styles.stat}>
            <Text style={styles.statValue}>{stats.referred}</Text>
            <Text style={type.tiny}>Friends referred · {stats.friendsPurchased} shopped</Text>
          </Card>
          <Card style={styles.stat}>
            <Text style={styles.statValue}>{stats.qualifyingPurchases}</Text>
            <Text style={type.tiny}>Qualifying purchases</Text>
          </Card>
          <Card style={styles.stat}>
            <Text style={styles.statValue}>{stats.couponsEarned}</Text>
            <Text style={type.tiny}>Coupons earned · {rupees(stats.earnedValue)}</Text>
          </Card>
          <Card style={styles.stat} onPress={() => navigation.navigate("Coupons")}>
            <Text style={styles.statValue}>{stats.couponsAvailable}</Text>
            <Text style={[type.tiny, { color: colors.primaryDark }]}>Ready to use →</Text>
          </Card>
        </View>

        <Card style={{ padding: spacing.md, gap: spacing.sm }}>
          <Text style={type.h3}>Your friends</Text>
          {!friends?.items.length ? (
            <Text style={type.small}>No friends yet — share your code to get started.</Text>
          ) : (
            friends.items.map((friend) => {
              const status = STATUS[friend.status] || STATUS.pending;
              const next = friend.nextMilestone;
              return (
                <View key={friend.id} style={styles.friend}>
                  <View style={styles.rowBetween}>
                    <Text style={[type.body, { flex: 1, fontWeight: "700" }]}>{friend.name}</Text>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </View>
                  <Text style={type.tiny}>
                    Joined {new Date(friend.referredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
                    {friend.qualifyingPurchases
                      ? next
                        ? `${friend.qualifyingPurchases} of ${next.purchases} qualifying purchases`
                        : `${friend.qualifyingPurchases} qualifying purchases · all rewards earned`
                      : "No qualifying purchase yet"}
                  </Text>
                  <View
                    style={styles.track}
                    accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: 100, now: friend.percent }}
                  >
                    <View style={[styles.fill, { width: `${friend.percent}%` }]} />
                  </View>
                  <Text style={type.tiny}>
                    {friend.status === "void"
                      ? "This referral is closed."
                      : next
                        ? `Next: ${next.purchases} purchase${next.purchases === 1 ? "" : "s"} → ${rupees(next.reward)} (${next.remaining} to go)`
                        : "Milestones complete."}
                    {friend.rewardsEarned ? ` · ${friend.rewardsEarned} earned` : ""}
                  </Text>
                </View>
              );
            })
          )}
          {friends?.meta?.total > (friends?.items.length || 0) ? (
            <Text style={type.tiny}>Showing your latest {friends.items.length} of {friends.meta.total} friends.</Text>
          ) : null}
        </Card>

        {data.canClaim || claimed ? (
          <Card style={{ padding: spacing.md, gap: spacing.sm }}>
            <Text style={type.h3}>Got a friend's code?</Text>
            <Text style={type.small}>Use it before your first order. It can't be changed later.</Text>
            {claimError ? <Notice tone="error">{claimError}</Notice> : null}
            {claimed ? <Notice tone="save">{claimed}</Notice> : null}
            {!claimed ? (
              <>
                <Input
                  value={code}
                  onChangeText={(text) => setCode(text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
                  placeholder="Enter referral code"
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <Button title="Apply code" variant="outline" loading={claiming} disabled={code.trim().length < 4} onPress={claim} />
              </>
            ) : null}
          </Card>
        ) : null}

        <Pressable onPress={() => navigation.navigate("Coupons")} style={{ alignSelf: "center", padding: spacing.sm }}>
          <Text style={styles.link}>Go to My coupons</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.sm },
  code: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 3,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  stat: { flexBasis: "47%", flexGrow: 1, padding: spacing.md, gap: 2 },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.text },
  friend: { gap: 6, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  track: { height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: colors.save, borderRadius: 999 },
  link: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },
});
