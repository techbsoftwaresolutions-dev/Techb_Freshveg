import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../components/Text";
import { api } from "../api/client";
import { clockTime, colors, formatAddress, rupees, spacing, type } from "../theme";
import { Button, Card, Divider, EmptyState, Loading, Notice, Pill, callNumber, openMaps } from "../components/ui";

// A finished run, read-only, opened from History: when each step happened,
// who it went to, what was in the bag, the bill and what was collected.
// The customer's handover code is never sent to this app.

const PAYMENT_LABEL = {
  cod: "Cash on delivery",
  upi: "UPI",
  online: "Paid online",
  card: "Card",
  netbanking: "Netbanking",
  wallet: "Wallet",
  paylater: "Pay later",
  store_credit: "Store credit",
};

const dayAndTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

const minutesBetween = (a, b) => (a && b ? Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000)) : null);

export default function RunDetailScreen({ route }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/orders/${orderId}`);
      setOrder(data.order);
      setPickup(data.pickup || null);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading label="Loading the delivery" />;
  if (!order) return <EmptyState icon="cloud-offline-outline" title="Couldn't load this delivery" hint={error} action={<Button title="Try again" onPress={load} />} />;

  const delivery = order.delivery || {};
  const address = delivery.address || {};
  const customerName = address.contactName || order.customerSnapshot?.name || "Customer";
  const customerPhone = address.contactPhone || order.customerSnapshot?.phone || "";
  const pricing = order.pricing || {};
  const cod = order.payment?.method === "cod";
  const total = minutesBetween(delivery.assignedAt, delivery.deliveredAt);

  const steps = [
    { label: "Assigned to you", at: delivery.assignedAt },
    { label: "Picked up from store", at: delivery.pickedUpAt },
    { label: "Reached the customer", at: delivery.arrivedAt },
    { label: "Delivered", at: delivery.deliveredAt },
  ];

  // Only the lines that apply to this order.
  const bill = [
    ["Items", pricing.subtotal],
    ["Offer discount", -(pricing.offerDiscount || 0)],
    ["Delivery fee", pricing.deliveryCharge],
    ["Packaging", pricing.packagingCharge],
    ["Wallet used", -(pricing.walletApplied || 0)],
    ["Points used", -(pricing.loyaltyApplied || 0)],
    ["Round off", pricing.roundOff],
  ].filter(([, value]) => value);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.primary}
        />
      }
    >
      {error ? <Notice tone="error">{error}</Notice> : null}

      {/* The order and when it was finished */}
      <Card style={styles.headCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.code}>{order.code}</Text>
          <Pill tone={order.status === "DELIVERED" ? "success" : "default"}>
            {order.status === "DELIVERED" ? "Delivered" : order.status.replace(/_/g, " ").toLowerCase()}
          </Pill>
        </View>
        <Text style={type.small}>{dayAndTime(delivery.deliveredAt || order.placedAt)}</Text>
        {total !== null ? <Text style={type.tiny}>{total} min from assignment to handover</Text> : null}
      </Card>

      {/* Each step of the run */}
      <Card style={styles.card}>
        <Text style={type.h3}>Timeline</Text>
        <View style={{ marginTop: spacing.sm, gap: 10 }}>
          {steps.map((step) => (
            <View key={step.label} style={styles.step}>
              <View style={[styles.dot, step.at && styles.dotDone]} />
              <Text style={[type.body, { flex: 1 }, !step.at && { color: colors.textFaint }]}>{step.label}</Text>
              <Text style={styles.stepTime}>{step.at ? clockTime(step.at) : "—"}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Who it went to */}
      <Card style={styles.card}>
        <Text style={styles.label}>Delivered to</Text>
        <Text style={type.h3}>{customerName}</Text>
        {customerPhone ? <Text style={type.small}>+91 {customerPhone}</Text> : null}
        <Text style={[type.body, { marginTop: spacing.sm }]}>{formatAddress(address) || "—"}</Text>
        {delivery.instructions ? <Notice tone="warn" style={{ marginTop: spacing.sm }}>“{delivery.instructions}”</Notice> : null}
        <View style={styles.buttons}>
          <Button
            title="Map"
            icon="map-outline"
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => openMaps({ coordinates: address.location?.coordinates, address: formatAddress(address) })}
          />
          <Button title="Call" icon="call-outline" variant="outline" style={{ flex: 1 }} disabled={!customerPhone} onPress={() => callNumber(customerPhone)} />
        </View>
      </Card>

      {/* Where it was collected */}
      {pickup ? (
        <Card style={styles.card}>
          <Text style={styles.label}>Picked up from</Text>
          <Text style={type.h3}>{pickup.name}</Text>
          <Text style={type.body}>{formatAddress(pickup.address)}</Text>
        </Card>
      ) : null}

      {/* What was in the bag */}
      <Card style={styles.card}>
        <Text style={type.h3}>
          {order.items.length} item{order.items.length === 1 ? "" : "s"}
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          {order.items.map((item, index) => {
            const qty = item.pickedQuantity ?? item.quantity;
            return (
              <View key={item.id || item.sku || index}>
                {index > 0 ? <Divider style={{ marginVertical: spacing.sm }} /> : null}
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text style={type.body} numberOfLines={2}>
                      {item.name}
                      {item.variantName ? ` · ${item.variantName}` : ""}
                    </Text>
                    <Text style={type.tiny}>
                      {qty} × {rupees(item.unitPrice)}
                    </Text>
                  </View>
                  <Text style={styles.amount}>{rupees(item.lineTotal || item.unitPrice * qty)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {/* The bill and the money */}
      <Card style={styles.card}>
        <Text style={type.h3}>Bill</Text>
        <View style={{ marginTop: spacing.sm, gap: 6 }}>
          {bill.map(([label, value]) => (
            <View key={label} style={styles.rowBetween}>
              <Text style={type.small}>{label}</Text>
              <Text style={type.body}>{value < 0 ? `− ${rupees(-value, { decimals: true })}` : rupees(value, { decimals: true })}</Text>
            </View>
          ))}
          <Divider style={{ marginVertical: 4 }} />
          <View style={styles.rowBetween}>
            <Text style={[type.body, { fontWeight: "700" }]}>Total</Text>
            <Text style={[type.body, { fontWeight: "700", fontSize: 18 }]}>{rupees(pricing.total)}</Text>
          </View>
        </View>
      </Card>

      <Card style={[styles.card, cod ? styles.payCash : styles.payPrepaid]}>
        <Text style={styles.label}>Payment</Text>
        <View style={styles.rowBetween}>
          <Text style={type.h3}>{PAYMENT_LABEL[order.payment?.method] || order.payment?.method}</Text>
          <Pill tone={order.payment?.status === "paid" ? "success" : "warn"}>{order.payment?.status}</Pill>
        </View>
        <Text style={[type.small, { marginTop: 4 }]}>
          {cod
            ? order.payment?.status === "paid"
              ? `You collected ${rupees(pricing.total)} in cash.`
              : `${rupees(pricing.total)} in cash was due.`
            : "Paid before delivery — nothing was collected."}
        </Text>
      </Card>

      {/* Proof of the handover */}
      <Card style={styles.card}>
        <Text style={styles.label}>Handover</Text>
        <Text style={type.body}>
          {delivery.otpVerifiedAt
            ? `Confirmed with the customer's code at ${clockTime(delivery.otpVerifiedAt)}.`
            : "No handover code was recorded."}
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { padding: spacing.md, gap: 2 },
  headCard: { padding: spacing.md, gap: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  code: { ...type.h2, fontVariant: ["tabular-nums"] },
  label: { ...type.tiny, textTransform: "uppercase", fontWeight: "600", letterSpacing: 0.5, marginBottom: 2 },
  buttons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },

  step: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.borderStrong },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepTime: { ...type.small, fontVariant: ["tabular-nums"] },

  amount: { ...type.body, fontWeight: "600" },
  payCash: { backgroundColor: colors.cashSoft, borderColor: colors.cash },
  payPrepaid: { backgroundColor: colors.successSoft, borderColor: colors.success },
});
