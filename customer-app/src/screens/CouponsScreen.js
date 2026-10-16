import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Text } from "../components/Text";
import { api } from "../api/client";
import { useCart } from "../context/CartContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, EmptyState, Loading, Notice, Pill } from "../components/ui";

// The customer's reward coupons (website twin: app/account/coupons). Issued by
// the API when a referred friend reaches a milestone; applying one goes
// through the cart, which prices it.
const FILTERS = [
  { key: "available", label: "Available" },
  { key: "", label: "All" },
  { key: "redeemed", label: "Used" },
  { key: "expired", label: "Expired" },
];
const STATUS = {
  available: { label: "Available", tone: "save" },
  reserved: { label: "On an order", tone: "primary" },
  redeemed: { label: "Used", tone: "default" },
  expired: { label: "Expired", tone: "danger" },
  revoked: { label: "Withdrawn", tone: "danger" },
};
const day = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function CouponsScreen({ navigation }) {
  const cart = useCart();
  const [filter, setFilter] = useState("available");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setError("");
    return api
      .get("/coupons", filter ? { status: filter } : undefined)
      .then((data) => setItems(data.items || []))
      .catch((err) => setError(err.message));
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function apply(coupon) {
    setBusy(coupon.id);
    setError("");
    try {
      await cart.applyRewardCoupon(coupon.id);
      navigation.navigate("Main", { screen: "CartTab" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const appliedId = cart.cart?.rewardCouponId;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
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
      <View style={styles.tabs}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key || "all"}
            onPress={() => {
              setItems(null);
              setFilter(f.key);
            }}
            style={[styles.tab, filter === f.key && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f.key }}
          >
            <Text style={[styles.tabText, filter === f.key && styles.tabTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Notice tone="error">
          {error} — pull down to retry.
        </Notice>
      ) : null}

      {items === null && !error ? (
        <Loading label="Loading coupons" />
      ) : items && !items.length ? (
        <EmptyState
          icon="pricetags-outline"
          title={filter === "available" ? "No coupons to use right now" : "Nothing here yet"}
          hint="Earn coupons when friends you refer shop with us. They can take a few minutes to appear after an order is delivered."
          action={<Button title="Refer & earn" onPress={() => navigation.navigate("Referral")} />}
        />
      ) : (
        (items || []).map((coupon) => {
          const status = STATUS[coupon.status] || STATUS.available;
          const applied = coupon.id === appliedId;
          return (
            <Card key={coupon.id} style={[styles.card, coupon.status !== "available" && { opacity: 0.65 }]}>
              <View style={styles.value}>
                <Text style={styles.valueText}>{rupees(coupon.amount)}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.rowBetween}>
                  <Text style={[type.h3, { flex: 1 }]} numberOfLines={2}>
                    {coupon.title}
                  </Text>
                  <Pill tone={applied ? "primary" : status.tone}>{applied ? "In your cart" : status.label}</Pill>
                </View>
                <Text style={type.tiny}>
                  {coupon.minOrderValue ? `On orders of ${rupees(coupon.minOrderValue)}+ · ` : ""}
                  {coupon.status === "available" ? `Valid until ${day(coupon.expiresAt)}` : ""}
                  {coupon.status === "redeemed" ? `Used on ${coupon.orderCode}` : ""}
                  {coupon.status === "expired" ? `Expired ${day(coupon.expiresAt)}` : ""}
                </Text>
                {open === coupon.id ? (
                  <View style={{ gap: 2, marginTop: 4 }}>
                    <Text style={type.tiny}>{coupon.description}</Text>
                    {coupon.milestone ? <Text style={type.tiny}>Referral milestone: purchase #{coupon.milestone}</Text> : null}
                    <Text style={type.tiny}>
                      Issued {day(coupon.issuedAt)} · expires {day(coupon.expiresAt)}
                    </Text>
                    <Text style={type.tiny} selectable>
                      Code {coupon.code} · one use · only on your account
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.rowBetween, { marginTop: 4 }]}>
                  <Pressable onPress={() => setOpen(open === coupon.id ? null : coupon.id)} hitSlop={8}>
                    <Text style={styles.link}>{open === coupon.id ? "Hide details" : "Details"}</Text>
                  </Pressable>
                  {coupon.status === "available" && !applied ? (
                    <Button title="Apply to cart" size="sm" loading={busy === coupon.id} disabled={Boolean(busy)} onPress={() => apply(coupon)} />
                  ) : null}
                </View>
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  tabs: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  tabTextOn: { color: colors.onPrimary },
  card: { padding: spacing.md, flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  value: {
    minWidth: 68,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
  },
  valueText: { fontSize: 17, fontWeight: "800", color: colors.primaryDark },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  link: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },
});
