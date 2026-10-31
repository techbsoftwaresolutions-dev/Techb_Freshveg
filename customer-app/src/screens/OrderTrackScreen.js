import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../components/AppText";
import { api } from "../api/client";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, Divider, EmptyState, Loading, Notice, Pill } from "../components/ui";

// The order QR is switched off: the delivery partner only needs the OTP.
const SHOW_QR = false;

const laterDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

const CLOSED = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];

export default function OrderTrackScreen({ route, navigation }) {
  const { orderId } = route.params;

  const [tracking, setTracking] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const poller = useRef(null);

  const load = useCallback(async () => {
    try {
      const [track, mine] = await Promise.all([
        api.get(`/orders/${orderId}/track`),
        api.get("/orders/mine", { limit: 30 }),
      ]);
      setTracking(track.tracking);
      setOrder(mine.items.find((o) => o.id === orderId) || null);
      setError("");
      return track.tracking;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while the order is live. A websocket would be better, but polling a
  // small endpoint every 20s is honest about what exists today and costs
  // nothing while the order is closed.
  useEffect(() => {
    clearInterval(poller.current);
    if (!tracking || CLOSED.includes(tracking.status)) return undefined;

    poller.current = setInterval(load, 20000);
    return () => clearInterval(poller.current);
  }, [tracking, load]);

  async function cancel() {
    setCancelling(true);
    try {
      await api.post(`/orders/${orderId}/cancel`, { reason: "Cancelled from the app" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  // Order lines remember the product's id, which the product page accepts in
  // place of a slug.
  function openProduct(item) {
    if (item?.product) navigation.navigate("ProductDetail", { slug: String(item.product) });
  }

  if (loading) return <Loading />;
  if (!tracking) return <EmptyState title="Couldn't load this order" hint={error} />;

  const waitingItems = (order?.items || []).filter((i) => i.deferred?.expectedOn && !i.deferred.deliveredAt);
  const isClosed = CLOSED.includes(tracking.status);
  const canCancel = !isClosed && !["OUT_FOR_DELIVERY", "ARRIVED", "PICKED_UP"].includes(tracking.status);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {error ? <Notice tone="error">{error}</Notice> : null}

      {/* What was ordered: the first product's photo, its name, and how it is paid. */}
      {order && order.items?.length ? (
        <Card style={{ padding: spacing.md }} onPress={() => openProduct(order.items[0])}>
          <View style={styles.summaryRow}>
            <Thumb item={order.items[0]} size={88} extra={order.items.length - 1} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryCode} numberOfLines={1}>
                Order #{order.code}
              </Text>
              <Text style={styles.summaryName} numberOfLines={2}>
                {order.items[0].name}
                {order.items.length > 1 ? ` + ${order.items.length - 1} more` : ""}
              </Text>
              <Text style={type.small} numberOfLines={1}>
                {[order.items[0].variantName || order.items[0].unit, paymentLabel(order.payment)]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Text style={type.tiny}>
                Placed{" "}
                {new Date(order.placedAt).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Card style={{ padding: spacing.lg, alignItems: "center" }}>
        <Text style={styles.statusLabel}>{tracking.statusLabel}</Text>
        <Text style={type.tiny}>{tracking.code}</Text>

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
      </Card>

      {/* The delivery time the shop promised (15 min / 30 min / 1 hour / next day). */}
      {tracking.etaLabel && !isClosed ? (
        <Card style={styles.etaCard}>
          <Text style={styles.etaLabel}>Delivery time</Text>
          <Text style={styles.etaValue}>{tracking.etaLabel}</Text>
          {tracking.expectedBy ? (
            <Text style={type.small}>
              {tracking.etaOption === "next_day" || new Date(tracking.expectedBy).toDateString() !== new Date().toDateString()
                ? `Arriving ${laterDate(tracking.expectedBy)}`
                : `Expected by ${new Date(tracking.expectedBy).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {/* The handover code. Only shown while it is actually needed. */}
      {tracking.otp ? (
        <Card style={styles.otpCard}>
          <Text style={type.small}>Share this code with your delivery partner</Text>
          <Text style={styles.otp}>{tracking.otp}</Text>
          {/* QR hidden for now — only the OTP is shown. Set SHOW_QR = true to bring it back. */}
          {SHOW_QR && tracking.qr ? (
            <View style={styles.qrWrap}>
              <Image source={{ uri: tracking.qr }} style={styles.qr} />
              <Text style={type.tiny}>Show this QR to your delivery partner to scan first</Text>
              <Text style={[type.tiny, { fontWeight: "700" }]}>{tracking.code}</Text>
            </View>
          ) : null}
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
                  {step.state === "done" ? <Text style={styles.tick}>✓</Text> : null}
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
          <Text style={type.h3}>
            {order.items.length - waitingItems.length} items
            {waitingItems.length ? ` · ${waitingItems.length} arriving later` : ""}
          </Text>
          {waitingItems.length ? (
            <Notice tone="warn" style={{ marginTop: spacing.sm }}>
              {`${waitingItems.length === 1 ? "1 item" : `${waitingItems.length} items`} will be delivered separately on ${laterDate(waitingItems[0].deferred.expectedOn)}${waitingItems[0].deferred.reason ? ` — ${waitingItems[0].deferred.reason}` : ""}. We're sorry for the wait.`}
            </Notice>
          ) : null}
          <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
            {[...order.items.filter((i) => !waitingItems.includes(i)), ...waitingItems].map((item) => (
              <Pressable key={item.id || item.sku} style={styles.itemRow} onPress={() => openProduct(item)}>
                <Thumb item={item} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={type.small} numberOfLines={2}>
                    {item.name} {item.variantName ? `· ${item.variantName}` : ""}
                  </Text>
                  {item.deferred?.expectedOn ? (
                    <Text style={[type.tiny, { color: item.deferred.deliveredAt ? colors.save : colors.warn, fontWeight: "700" }]}>
                      {item.deferred.deliveredAt ? "Delivered later" : `Arriving ${laterDate(item.deferred.expectedOn)}`}
                    </Text>
                  ) : null}
                </View>
                <Text style={type.tiny}>×{item.quantity}</Text>
                <Text style={styles.itemPrice}>{rupees(item.payable)}</Text>
              </Pressable>
            ))}
          </View>

          <Divider style={{ marginVertical: spacing.md }} />

          <View style={{ gap: 5 }}>
            <Row label="Subtotal" value={rupees(order.pricing.subtotal)} />
            {order.pricing.offerDiscount > 0 ? (
              <Row label="Offers" value={`− ${rupees(order.pricing.offerDiscount)}`} tone="save" />
            ) : null}
            <Row
              label="Delivery"
              value={order.pricing.deliveryFree ? "FREE" : rupees(order.pricing.deliveryCharge)}
            />
            <Divider style={{ marginVertical: 6 }} />
            <Row label="Total paid" value={rupees(order.pricing.total)} bold />
            <Text style={type.tiny}>
              {order.payment.method.toUpperCase()} · {order.payment.status}
            </Text>
          </View>
        </Card>
      ) : null}

      {order?.delivery?.address?.line1 ? (
        <Card style={{ padding: spacing.md }}>
          <Text style={type.h3}>Delivery address</Text>
          <Text style={[type.body, { marginTop: spacing.sm, fontWeight: "700" }]}>
            {order.delivery.address.contactName}
          </Text>
          <Text style={[type.small, { marginTop: 2 }]}>
            {[
              order.delivery.address.line1,
              order.delivery.address.line2,
              order.delivery.address.landmark,
              order.delivery.address.city,
              order.delivery.address.pincode,
            ]
              .filter(Boolean)
              .join(", ")}
          </Text>
          {order.delivery.address.contactPhone ? (
            <Text style={[type.small, { marginTop: 2 }]}>{order.delivery.address.contactPhone}</Text>
          ) : null}
        </Card>
      ) : null}

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

// "Cash on delivery", or "Prepaid" once an online payment has gone through.
function paymentLabel(payment) {
  if (!payment) return "";
  if (payment.method === "cod") return "Cash on delivery";
  return payment.status === "paid" ? "Prepaid" : "Payment pending";
}

// A product photo in a rounded box. Shows the product's first letter when it
// has no photo, and "+N" over the corner when more items sit behind it.
function Thumb({ item, size, extra = 0 }) {
  return (
    <View style={[styles.thumb, { width: size, height: size }]}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.thumbImage} resizeMode="contain" />
      ) : (
        <Text style={[styles.thumbLetter, { fontSize: size * 0.34 }]}>
          {(item.name || "?").charAt(0).toUpperCase()}
        </Text>
      )}
      {extra > 0 ? (
        <View style={styles.thumbBadge}>
          <Text style={styles.thumbBadgeText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
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
  etaCard: { padding: spacing.lg, alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 1 },
  etaLabel: { ...type.small, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  etaValue: { fontSize: 26, fontWeight: "800", color: colors.primaryDark, marginVertical: 2 },
  screen: { flex: 1, backgroundColor: colors.bg },
  statusLabel: { fontSize: 19, fontWeight: "800", color: colors.text, textAlign: "center" },

  otpCard: { padding: spacing.lg, alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary },
  qrWrap: { alignItems: "center", gap: 4, marginTop: spacing.md },
  qr: { width: 180, height: 180, borderRadius: radius.sm, backgroundColor: "#fff" },
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

  summaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  summaryCode: { fontSize: 15, fontWeight: "800", color: colors.text },
  summaryName: { ...type.body, fontWeight: "600", marginTop: 2 },
  thumb: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbImage: { width: "100%", height: "100%" },
  thumbLetter: { fontWeight: "800", color: colors.textFaint },
  thumbBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    minWidth: 24,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(20,23,31,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  itemPrice: { ...type.small, fontWeight: "700", color: colors.text, minWidth: 54, textAlign: "right" },
});
