import React, { useCallback, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, View } from "react-native";
import { Text } from "../components/Text";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, EmptyState, Loading, Notice, Pill } from "../components/ui";
import { Input } from "../components/AddressForm";

// Refer & earn, on the API's own rules (referral.service): a friend's code can
// be used once, before your first order, and both rewards land in the wallet
// when that first order is delivered.
export default function ReferralScreen() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState("");

  const load = useCallback(() => {
    api
      .get("/referrals/me")
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, []);

  useFocusEffect(load);

  async function claim() {
    setClaiming(true);
    setError("");
    try {
      const result = await api.post("/referrals/claim", { code: code.trim() });
      setClaimed(result.message);
      setCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  }

  if (!data) return error ? <EmptyState title="Couldn't load referrals" hint={error} /> : <Loading />;
  if (!data.enabled) return <EmptyState title="Referrals are paused" hint="Check back soon." />;

  const share = () =>
    Share.share({
      message: `Get ${rupees(data.friendReward)} off your first The Farmers Basket order — use my code ${data.code} when you sign up.`,
    }).catch(() => {});

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <Card style={{ padding: spacing.lg, alignItems: "center", gap: spacing.sm }}>
          <Text style={type.h2}>Invite friends, earn {rupees(data.reward)}</Text>
          <Text style={[type.small, { textAlign: "center" }]}>
            Your friend gets {rupees(data.friendReward)} and you get {rupees(data.reward)} in your wallet when their first
            order{data.minFirstOrderValue ? ` of ${rupees(data.minFirstOrderValue)} or more` : ""} is delivered.
          </Text>
          <Text style={styles.code} selectable>
            {data.code}
          </Text>
          <Button title="Share my code" onPress={share} style={{ alignSelf: "stretch" }} />
        </Card>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Card style={styles.stat}>
            <Text style={styles.statValue}>{data.invited}</Text>
            <Text style={type.tiny}>Friends joined</Text>
          </Card>
          <Card style={styles.stat}>
            <Text style={styles.statValue}>{rupees(data.earned)}</Text>
            <Text style={type.tiny}>Earned</Text>
          </Card>
        </View>

        {data.friends.length ? (
          <Card style={{ padding: spacing.md, gap: spacing.sm }}>
            {data.friends.map((friend, index) => (
              <View key={index} style={styles.friend}>
                <Text style={[type.body, { flex: 1 }]}>{friend.name}</Text>
                <Pill tone={friend.status === "rewarded" ? "save" : "default"}>
                  {friend.status === "rewarded" ? "Rewarded" : "Awaiting first order"}
                </Pill>
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={{ padding: spacing.md, gap: spacing.sm }}>
          <Text style={type.h3}>Got a friend's code?</Text>
          <Text style={type.small}>Use it before your first order.</Text>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {claimed ? <Notice tone="save">{claimed}</Notice> : null}
          <Input
            value={code}
            onChangeText={(text) => setCode(text.toUpperCase())}
            placeholder="Enter referral code"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Button title="Apply code" variant="outline" loading={claiming} disabled={code.trim().length < 4} onPress={claim} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
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
  stat: { flex: 1, padding: spacing.md, gap: 2 },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.text },
  friend: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
