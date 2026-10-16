import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../components/Text";
import { api } from "../api/client";
import { onlinePaymentSupported, payOnline } from "../api/razorpay";
import { useCart } from "../context/CartContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, Divider, EmptyState, Loading, Notice, Pill } from "../components/ui";

const CLOSED = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];

// What a payment attempt came back with, as a notice.
function paymentNotice(result) {
  if (!result) return null;
  if (result.status === "dismissed") {
    return { tone: "warn", text: "Payment not completed. Your order is held for 30 minutes — pay now, or cancel it." };
  }
  if (result.status === "failed") {
    return { tone: "error", text: result.message || "The payment didn't go through. Please try again." };
  }
  if (result.status === "pending") {
    return { tone: "warn", text: `${result.message} This screen updates on its own.` };
  }
  return null;
}

export default function OrderTrackScreen({ route, navigation }) {
  const { orderId } = route.params;
  const cart = useCart();

  const [tracking, setTracking] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState(paymentNotice(route.params.payment));
  const [error, setError] = useState("");
  const poller = useRef(null);

  const load = useCallback(async () => {
    try {
      const track = await api.get(`/orders/${orderId}/track`);
      setTracking(track.tracking);
      setOrder(track.order);
      setError("");
      return track.tracking;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // On every visit, so coming back from a return or a review shows the
  // order's new state (focus also fires on first open).
  useEffect(() => navigation.addListener("focus", load), [navigation, load]);

  // Poll while the order is live. A websocket would be better, but polling a
  // small endpoint every 20s is honest about what exists today and costs
  // nothing while the order is closed.
  // Every few seconds while an online payment is being confirmed.
  const awaitingPayment = tracking?.status === "PAYMENT_PENDING" && order?.payment.method === "online";
  useEffect(() => {
    clearInterval(poller.current);
    if (!tracking || CLOSED.includes(tracking.status)) return undefined;

    poller.current = setInterval(load, awaitingPayment ? 5000 : 20000);
    return () => clearInterval(poller.current);
  }, [tracking, load, awaitingPayment]);

  useEffect(() => {
    if (tracking && tracking.status !== "PAYMENT_PENDING") setNotice(null);
  }, [tracking]);

  async function payNow() {
    setPaying(true);
    setError("");
    try {
      setNotice(paymentNotice(await payOnline(orderId)));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying(false);
    }
  }

  async function cancel() {
    setCancelling(true);
    try {
      await api.post(`/orders/${orderId}/cancel`, { reason: "Cancelled from the app" });
      // Cancelling an unpaid online order gives the cart back (API side).
      await Promise.all([load(), cart.refresh()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <Loading />;
  if (!tracking) return <EmptyState title="Couldn't load this order" hint={error} />;

  const isClosed = CLOSED.includes(tracking.status);
  const canCancel = !isClosed && !["OUT_FOR_DELIVERY", "ARRIVED", "PICKED_UP"].includes(tracking.status);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {awaitingPayment && notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      {/* The website's order hero: an icon for the state, the customer-facing
          status, and the order code. */}
      <View
        style={[
          styles.hero,
          tracking.status === "DELIVERED" ? styles.heroDone : isClosed ? styles.heroStopped : null,
        ]}
      >
        <View
          style={[
            styles.heroIcon,
            tracking.status === "DELIVERED" ? styles.heroIconDone : isClosed ? styles.heroIconStopped : null,
          ]}
        >
          <Ionicons
            name={tracking.status === "DELIVERED" ? "checkmark" : isClosed ? "close" : "bus-outline"}
            size={26}
            color={tracking.status === "DELIVERED" ? colors.onPrimary : isClosed ? colors.danger : colors.primary}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.statusLabel}>{tracking.statusLabel}</Text>
        <Text style={type.small}>
          Order <Text style={{ fontWeight: "600", color: colors.text }}>{tracking.code}</Text>
        </Text>

        {tracking.expectedBy && !isClosed ? (
          <Text style={[type.small, { marginTop: spacing.sm }]}>
            Expected by{" "}
            <Text style={{ fontWeight: "700", color: colors.text }}>
              {new Date(tracking.expectedBy).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </Text>
        ) : null}

        {tracking.deliveredAt ? (
          <Text style={[type.small, { marginTop: spacing.sm }]}>
            Delivered{" "}
            {new Date(tracking.deliveredAt).toLocaleString("en-IN", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        ) : null}
        </View>
      </View>

      {/* The handover code. Only shown while it is actually needed. */}
      {tracking.otp ? (
        <Card style={styles.otpCard}>
          <Text style={type.small}>Share this code with your delivery partner</Text>
          <Text style={styles.otp}>{tracking.otp}</Text>
        </Card>
      ) : null}

      {/* Delivery partner */}
      {tracking.partner ? (
        <Card style={{ padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={styles.avatar}>
            {/* The rider's initial rather than a scooter: it identifies this
                person, which is what the customer is actually checking. */}
            <Text style={styles.avatarInitial}>
              {(tracking.partner.name || "?").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>{tracking.partner.name}</Text>
            <Text style={type.tiny}>Your delivery partner</Text>
          </View>
          <Button
            title="Call"
            size="sm"
            variant="outline"
            onPress={() => Linking.openURL(`tel:${tracking.partner.phone}`)}
          />
        </Card>
      ) : null}

      {/* Timeline — steps this order skipped (a COD order never passes through
          "payment received") are not shown at all. */}
      <Card style={{ padding: spacing.lg }}>
        <Text style={[type.h3, { marginBottom: spacing.md }]}>Order progress</Text>
        {tracking.timeline
          .filter((step) => step.state !== "skipped")
          .map((step, index, visible) => (
            <View key={step.status} style={styles.step}>
              <View style={styles.stepRail}>
                <View
                  style={[
                    styles.dot,
                    step.state === "done" && styles.dotDone,
                    step.state === "active" && styles.dotActive,
                  ]}
                >
                  {step.state === "done" ? <Ionicons name="checkmark" size={12} color={colors.onPrimary} /> : null}
                </View>
                {index < visible.length - 1 ? (
                  <View style={[styles.connector, step.state === "done" && { backgroundColor: colors.primary }]} />
                ) : null}
              </View>

              <View style={{ flex: 1, paddingBottom: spacing.lg }}>
                <Text
                  style={[
                    styles.stepLabel,
                    step.state === "pending" && { color: colors.textFaint, fontWeight: "500" },
                    step.state === "active" && { color: colors.primaryDark },
                  ]}
                >
                  {step.label}
                </Text>
                {step.at ? (
                  <Text style={type.tiny}>
                    {new Date(step.at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
      </Card>

      {/* Items and bill */}
      {order ? (
        <Card style={{ padding: spacing.md }}>
          <Text style={type.h3}>{order.items.length} items</Text>
          <View style={{ marginTop: spacing.sm, gap: 6 }}>
            {order.items.map((item) => (
              <View key={item.id || item.sku} style={styles.itemRow}>
                <Text style={[type.small, { flex: 1 }]} numberOfLines={1}>
                  {item.name} {item.variantName ? `· ${item.variantName}` : ""}
                </Text>
                <Text style={type.tiny}>×{item.quantity}</Text>
                <Text style={styles.itemPrice}>{rupees(item.payable)}</Text>
              </View>
            ))}
          </View>

          <Divider style={{ marginVertical: spacing.md }} />

          <View style={{ gap: 5 }}>
            <Row label="Subtotal" value={rupees(order.pricing.subtotal)} />
            {order.pricing.offerDiscount - (order.pricing.rewardDiscount || 0) > 0 ? (
              <Row label="Offers" value={`− ${rupees(order.pricing.offerDiscount - (order.pricing.rewardDiscount || 0))}`} tone="save" />
            ) : null}
            {order.pricing.rewardDiscount > 0 ? (
              <Row label="Reward coupon" value={`− ${rupees(order.pricing.rewardDiscount)}`} tone="save" />
            ) : null}
            <Row
              label="Delivery"
              value={order.pricing.deliveryFree ? "FREE" : rupees(order.pricing.deliveryCharge)}
            />
            {/* Every charge in the total is listed, so the rows add up to it. */}
            {order.pricing.packagingCharge > 0 ? <Row label="Packaging" value={rupees(order.pricing.packagingCharge)} /> : null}
            {order.pricing.walletApplied > 0 ? (
              <Row label="Wallet" value={`− ${rupees(order.pricing.walletApplied)}`} tone="save" />
            ) : null}
            {order.pricing.roundOff ? <Row label="Round off" value={rupees(order.pricing.roundOff, { decimals: true })} /> : null}
            <Divider style={{ marginVertical: 6 }} />
            <Row label={order.payment.status === "paid" ? "Total paid" : "Total"} value={rupees(order.pricing.total)} bold />
            <Text style={type.tiny}>
              {order.payment.method === "cod" ? "Cash on delivery" : order.payment.method === "online" ? "Online (Razorpay)" : order.payment.method.toUpperCase()} ·{" "}
              {order.payment.status}
            </Text>
          </View>
        </Card>
      ) : null}

      {awaitingPayment && onlinePaymentSupported ? (
        <Button title={`Pay ${rupees(order.pricing.total)} now`} loading={paying} disabled={cancelling} onPress={payNow} />
      ) : null}

      {tracking.status === "DELIVERED" ? (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button title="Rate items" variant="outline" onPress={() => navigation.navigate("RateOrder", { orderId })} style={{ flex: 1 }} />
          <Button title="Return items" variant="outline" onPress={() => navigation.navigate("ReturnRequest", { orderId })} style={{ flex: 1 }} />
        </View>
      ) : null}

      <Button
        title="Get help with this order"
        variant="ghost"
        onPress={() => navigation.navigate("Support", { order: { id: orderId, code: tracking.code } })}
      />

      {canCancel ? (
        <Button
          title="Cancel order"
          variant="ghost"
          loading={cancelling}
          onPress={() =>
            Alert.alert("Cancel this order?", "This cannot be undone.", [
              { text: "Keep it", style: "cancel" },
              { text: "Cancel order", style: "destructive", onPress: cancel },
            ])
          }
        />
      ) : null}
    </ScrollView>
  );
}

function Row({ label, value, tone, bold }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={[type.small, bold && { color: colors.text, fontWeight: "800" }]}>{label}</Text>
      <Text
        style={[
          type.body,
          { fontWeight: bold ? "800" : "600" },
          tone === "save" && { color: colors.save },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  heroDone: { backgroundColor: colors.saveSoft, borderColor: colors.saveSoft },
  heroStopped: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconDone: { backgroundColor: colors.save },
  heroIconStopped: { backgroundColor: colors.surface },
  statusLabel: { fontSize: 19, fontWeight: "700", color: colors.text },

  otpCard: { padding: spacing.lg, alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary },
  otp: { fontSize: 32, fontWeight: "800", letterSpacing: 10, color: colors.primaryDark, marginTop: 4 },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 17, fontWeight: "700", color: colors.text },

  step: { flexDirection: "row", gap: spacing.md },
  stepRail: { alignItems: "center", width: 22 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotActive: { borderColor: colors.primary, borderWidth: 5 },
  tick: { color: "#fff", fontSize: 10, fontWeight: "900" },
  connector: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  stepLabel: { ...type.body, fontWeight: "700", fontSize: 13.5 },

  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  itemPrice: { ...type.small, fontWeight: "700", color: colors.text, minWidth: 54, textAlign: "right" },
});
