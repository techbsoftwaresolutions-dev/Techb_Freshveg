import React, { useCallback, useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api, uploadImage } from "../api/client";
import { colors, clockTime, formatAddress, radius, rupees, spacing, type } from "../theme";
import QrScanModal from "../components/QrScanModal";
import PhotoCaptureModal from "../components/PhotoCaptureModal";
import {
  Button, Card, Divider, EmptyState, Loading, Notice, Pill,
  callNumber, openMaps,
} from "../components/ui";

// The customer-QR scan step is switched off: the rider only enters the 4-digit
// handover code, and may add an optional delivery photo. Set to true to bring
// the QR scan back (the backend still accepts and checks a QR if one is sent).
const QR_STEP = false;

// The rider's run, one screen. Exactly one primary action is offered at a
// time, and which one comes from the engine's `actions` list rather than from
// a second copy of the state machine living here — so a stage added to the
// backend shows up without touching this app.
const STEP_COPY = {
  ASSIGNED_TO_DELIVERY: {
    heading: "Head to the store",
    sub: "Collect the order from the counter.",
    leg: "pickup",
    action: { status: "PICKED_UP", label: "I've picked it up" },
  },
  PICKED_UP: {
    heading: "Order collected",
    sub: "Start the run to the customer.",
    leg: "pickup",
    action: { status: "OUT_FOR_DELIVERY", label: "Start delivery" },
  },
  OUT_FOR_DELIVERY: {
    heading: "On the way",
    sub: "Tell the customer when you reach.",
    leg: "drop",
    action: { status: "ARRIVED", label: "I've arrived" },
  },
  ARRIVED: {
    heading: "At the address",
    sub: "Ask the customer for their 4-digit code.",
    leg: "drop",
    action: null, // handover is its own flow, below
  },
};

// Orders assigned to this rider that the store is still preparing: the rider
// can read the whole job but has nothing to press yet.
const PREPARING = [
  "ORDER_PLACED", "PAYMENT_PENDING", "PAYMENT_CONFIRMED", "ORDER_CONFIRMED",
  "ORDER_ACCEPTED", "PICKING", "PACKING", "READY_FOR_PICKUP",
];
const PREPARING_STEP = {
  heading: "Store is preparing",
  sub: "This order is yours. You can start once the store marks it ready.",
  leg: "pickup",
  action: null,
  waiting: true,
};

export default function DeliveryScreen({ route, navigation }) {
  const { orderId } = route.params;

  const [order, setOrder] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  // The customer's order QR, once scanned. Required before the OTP step.
  const [scanned, setScanned] = useState("");
  const [scanning, setScanning] = useState(false);
  // Optional proof photo: the local file from the camera, uploaded on confirm.
  const [photoUri, setPhotoUri] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      // The queue carries the pickup store; the order endpoint has the detail.
      const [detail, queue] = await Promise.all([
        api.get(`/orders/${orderId}`),
        api.get("/orders/delivery/queue"),
      ]);
      setOrder(detail.order);
      setPickup(
        [...queue.orders, ...(queue.upcoming || [])].find((o) => o.id === orderId)?.pickup || null
      );
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // While the store is still preparing it, check back so the "Start" button
  // appears the moment the order is ready.
  const waiting = order && PREPARING.includes(order.status);
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [waiting, load]);

  async function advance(status) {
    setBusy(true);
    setError("");
    try {
      const data = await api.post(`/orders/${orderId}/status`, { status });
      setOrder(data.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handOver() {
    setBusy(true);
    setError("");
    try {
      // Upload the optional photo first; if that fails the rider can retry or
      // remove the photo — the delivery itself is never lost.
      const photo = photoUri ? await uploadImage(photoUri) : undefined;
      await api.post(`/orders/${orderId}/deliver`, {
        otp,
        ...(photo ? { photo } : {}),
        ...(QR_STEP && scanned ? { scanned } : {}),
      });
      // Nothing left to do on this order, so go back to the queue rather than
      // leaving the rider on a dead screen.
      navigation.replace("Delivered", { orderId, code: order.code });
    } catch (err) {
      setError(err.message);
      setOtp("");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading the order" />;
 if (!order) return<EmptyState icon="" title="Couldn't load this order" hint={error} />;

  const step = STEP_COPY[order.status] || (PREPARING.includes(order.status) ? PREPARING_STEP : null);

  if (!step) {
    return (
      <EmptyState
 icon={order.status ==="DELIVERED" ?"" :""}
        title={order.status === "DELIVERED" ? "Already delivered" : "This order is no longer yours"}
        hint={`It is now "${order.status.replace(/_/g, " ").toLowerCase()}".`}
        action={<Button title="Back to queue" onPress={() => navigation.navigate("Queue")} />}
      />
    );
  }

  const goingToStore = step.leg === "pickup";
  const destination = goingToStore
    ? { name: pickup?.name || "Store", address: pickup?.address, location: pickup?.location, phone: pickup?.phone }
    : {
        name: order.delivery?.address?.contactName || order.customerSnapshot?.name || "Customer",
        address: order.delivery?.address,
        location: order.delivery?.address?.location,
        phone: order.delivery?.address?.contactPhone || order.customerSnapshot?.phone,
      };

  const otpReady = !QR_STEP || Boolean(scanned);
  const collectCash = order.payment?.method === "cod" && order.payment?.status !== "paid";

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 190, gap: spacing.md }}>
        {error ? <Notice tone="error">{error}</Notice> : null}

        {/* Where the rider is in the run */}
        <Card style={styles.stepCard}>
          <RiderProgress status={order.status} />
          <Text style={styles.stepHeading}>{step.heading}</Text>
          <Text style={styles.stepSub}>{step.sub}</Text>
          <Text style={styles.code}>{order.code}</Text>
        </Card>

        {/* Destination */}
        <Card style={{ padding: spacing.md, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
<Text style={{ fontSize: 22}}>{goingToStore ?"" :""}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.legLabel}>{goingToStore ? "Pick up from" : "Deliver to"}</Text>
              <Text style={type.h3}>{destination.name}</Text>
            </View>
          </View>

          <Text style={type.body}>{formatAddress(destination.address)}</Text>

          {!goingToStore && order.delivery?.instructions ? (
            <Notice tone="warn">“{order.delivery.instructions}”</Notice>
          ) : null}

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              title="Navigate"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() =>
                openMaps({
                  coordinates: destination.location?.coordinates,
                  address: formatAddress(destination.address),
                })
              }
            />
            <Button
              title="Call"
              variant="outline"
              style={{ flex: 1 }}
              disabled={!destination.phone}
              onPress={() => callNumber(destination.phone)}
            />
          </View>
        </Card>

        {/* Payment — the thing a rider must not get wrong */}
        <Card style={[styles.payCard, collectCash ? styles.payCash : styles.payPrepaid]}>
          <Text style={styles.payLabel}>{collectCash ? "COLLECT CASH" : "PREPAID"}</Text>
          <Text style={styles.payAmount}>{collectCash ? rupees(order.pricing?.total) : "Nothing to collect"}</Text>
          {collectCash ? (
            <Text style={type.tiny}>Hand the order over only after taking the cash.</Text>
          ) : (
            <Text style={type.tiny}>The customer has already paid online.</Text>
          )}
        </Card>

        {/* Items — so a rider can check the bag at the counter */}
        <Card style={{ padding: spacing.md }}>
          <Text style={type.h3}>
            {order.items.length} item{order.items.length === 1 ? "" : "s"}
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            {order.items.map((item, index) => (
              <View key={item.id || item.sku}>
                {index > 0 ? <Divider style={{ marginVertical: spacing.sm }} /> : null}
                <View style={styles.itemRow}>
                  <Text style={[type.body, { flex: 1 }]} numberOfLines={2}>
                    {item.name}
                    {item.variantName ? ` · ${item.variantName}` : ""}
                  </Text>
                  <Text style={styles.itemQty}>×{item.pickedQuantity ?? item.quantity}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Handover: 1) optional delivery photo, 2) the customer's OTP */}
        {order.status === "ARRIVED" ? (
          <Card style={{ padding: spacing.md, gap: spacing.md }}>
            {/* QR scan step — hidden (QR_STEP = false). Kept for easy re-enable.
            <Text style={type.h3}>Scan customer's QR</Text>
            {scanned ? <Notice tone="success">QR verified for {order.code}</Notice> : null}
            <Button title={scanned ? "Scan again" : "Scan QR"} variant={scanned ? "outline" : "primary"} onPress={() => setScanning(true)} />
            */}
            {QR_STEP ? (
              <>
                <Text style={type.h3}>Step 1 · Scan customer's QR</Text>
                {scanned ? <Notice tone="success">QR verified for {order.code}</Notice> : null}
                <Button
                  title={scanned ? "Scan again" : "Scan QR"}
                  variant={scanned ? "outline" : "primary"}
                  onPress={() => setScanning(true)}
                />
                <Divider />
              </>
            ) : null}

            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={type.h3}>Delivery photo</Text>
              <Pill>Optional</Pill>
            </View>
            <Text style={type.small}>Take a quick photo of the order at the door as proof of delivery.</Text>
            {photoUri ? (
              <View style={styles.photoRow}>
                <Image source={{ uri: photoUri }} style={styles.photoThumb} />
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Button title="Retake" variant="outline" onPress={() => setPhotoOpen(true)} />
                  <Button title="Remove" variant="ghost" onPress={() => setPhotoUri("")} />
                </View>
              </View>
            ) : (
              <Button title="Take photo" variant="outline" onPress={() => setPhotoOpen(true)} />
            )}

            <Divider />

            <Text style={type.h3}>Handover code</Text>
            <Text style={type.small}>Ask the customer to read the 4-digit code from their order screen.</Text>
            <TextInput
              value={otp}
              editable={otpReady}
              onChangeText={(text) => setOtp(text.replace(/\D/g, "").slice(0, 4))}
              placeholder="0000"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={4}
              style={[styles.otpInput, !otpReady && { opacity: 0.45 }]}
            />
          </Card>
        ) : null}

        <Button
          title="Report a problem"
          variant="ghost"
          onPress={() =>
            Alert.alert(
              "Report a problem",
              "Call the store to sort it out — in-app issue reporting is not built yet.",
              [
                { text: "Close", style: "cancel" },
                { text: "Call store", onPress: () => callNumber(pickup?.phone) },
              ]
            )
          }
        />
      </ScrollView>

      <PhotoCaptureModal
        visible={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onCaptured={(uri) => {
          setPhotoUri(uri);
          setPhotoOpen(false);
        }}
      />

      <QrScanModal
        visible={scanning}
        expected={`HBORDER:${order.code}`}
        onClose={() => setScanning(false)}
        onScanned={(value) => {
          setScanned(value);
          setScanning(false);
        }}
      />

      {/* One primary action, always in the same place under the thumb. */}
      <View style={styles.actionBar}>
        {order.status === "ARRIVED" ? (
          <Button
            title="Confirm delivery"
            subtitle={collectCash ? `after collecting ${rupees(order.pricing?.total)}` : undefined}
            loading={busy}
            disabled={!otpReady || otp.length !== 4}
            onPress={handOver}
          />
        ) : step.waiting ? (
          <Button title="Waiting for the store to finish…" disabled onPress={load} />
        ) : (
          <Button
            title={step.action.label}
            loading={busy}
            onPress={() => advance(step.action.status)}
          />
        )}
      </View>
    </View>
  );
}

// The rider's own five steps, from being handed the order to handing it over —
// done ones filled, the current one ringed. The store's steps before this
// (picking, packing) are not the rider's to see.
const RIDER_STEPS = [
  { status: "ASSIGNED_TO_DELIVERY", label: "Assigned" },
  { status: "PICKED_UP", label: "Picked up" },
  { status: "OUT_FOR_DELIVERY", label: "On the way" },
  { status: "ARRIVED", label: "Arrived" },
  { status: "DELIVERED", label: "Delivered" },
];

function RiderProgress({ status }) {
  const current = RIDER_STEPS.findIndex((s) => s.status === status);
  return (
    <View style={styles.progress} accessibilityLabel={`Step ${current + 1} of ${RIDER_STEPS.length}`}>
      {RIDER_STEPS.map((s, index) => {
        const done = index < current;
        const here = index === current;
        return (
          <View key={s.status} style={styles.progressStep}>
            {/* The line into this step from the one before. */}
            {index > 0 ? (
              <View style={[styles.progressLine, index <= current && styles.progressLineDone]} />
            ) : null}
            <View style={[styles.progressDot, done && styles.progressDotDone, here && styles.progressDotHere]}>
              <Text
                style={[styles.progressDotText, done && styles.progressDotTextOn, here && styles.progressDotTextHere]}
              >
                {done ? "✓" : index + 1}
              </Text>
            </View>
            <Text style={[styles.progressLabel, (done || here) && styles.progressLabelOn]} numberOfLines={1}>
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  stepCard: { padding: spacing.lg, backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  stepHeading: { fontSize: 22, fontWeight: "800", color: "#fff" },
  stepSub: { ...type.small, color: "rgba(255,255,255,0.8)" },

  progress: { flexDirection: "row", marginBottom: spacing.lg },
  progressStep: { flex: 1, alignItems: "center", gap: 4 },
  progressLine: {
    position: "absolute",
    top: 11,
    right: "50%",
    width: "100%",
    height: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  progressLineDone: { backgroundColor: "#fff" },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: colors.primaryDark,
  },
  progressDotDone: { backgroundColor: "#fff", borderColor: "#fff" },
  progressDotHere: { borderColor: "#fff", backgroundColor: "rgba(255,255,255,0.18)" },
  progressDotText: { fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.6)" },
  progressDotTextOn: { color: colors.primaryDark },
  progressDotTextHere: { color: "#fff" },
  progressLabel: { fontSize: 10.5, fontWeight: "600", color: "rgba(255,255,255,0.55)" },
  progressLabelOn: { color: "#fff" },
  code: { color: "rgba(255,255,255,0.7)", fontWeight: "700", marginTop: spacing.sm, letterSpacing: 1 },

  legLabel: { ...type.tiny, textTransform: "uppercase", fontWeight: "800", letterSpacing: 0.5 },

  payCard: { padding: spacing.lg, alignItems: "center", gap: 2 },
  payCash: { backgroundColor: colors.cashSoft, borderColor: colors.cash },
  payPrepaid: { backgroundColor: colors.successSoft, borderColor: colors.success },
  payLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, color: colors.textMuted },
  payAmount: { fontSize: 30, fontWeight: "800", color: colors.text },

  photoRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  photoThumb: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.border },

  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  itemQty: { ...type.body, fontWeight: "800", minWidth: 46, textAlign: "right" },

  otpInput: {
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    height: 64,
    textAlign: "center",
    fontSize: 30,
    letterSpacing: 14,
    fontWeight: "800",
    color: colors.text,
  },

  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
