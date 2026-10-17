import React, { useCallback, useEffect, useState } from "react";
import { Alert, Image, Linking, ScrollView, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, TextInput } from "../components/Text";
import { api } from "../api/client";
import { colors, formatAddress, radius, rupees, shadow, spacing, type } from "../theme";
import {
  Button, Card, Divider, EmptyState, IconTile, ItemThumb, Loading, Notice, Pill,
  callNumber, openMaps,
} from "../components/ui";

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
    sub: "Photograph the products, then ask the customer for their 4-digit code.",
    leg: "drop",
    action: null, // handover is its own flow, below
  },
};

export default function DeliveryScreen({ route, navigation }) {
  const { orderId } = route.params;
  const { bottom } = useSafeAreaInsets();

  const [order, setOrder] = useState(null);
  const [pickup, setPickup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [photoRequired, setPhotoRequired] = useState(false);

  const load = useCallback(async () => {
    try {
      // The queue carries the pickup store; the order endpoint has the detail.
      const [detail, queue] = await Promise.all([
        api.get(`/orders/${orderId}`),
        api.get("/orders/delivery/queue"),
      ]);
      setOrder(detail.order);
      setPhotoRequired(Boolean(detail.photoRequired));
      setPickup(queue.orders.find((o) => o.id === orderId)?.pickup || null);
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
      await api.post(`/orders/${orderId}/deliver`, { otp });
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
  if (!order) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load this order"
        hint={error}
        action={<Button title="Try again" onPress={load} />}
      />
    );
  }

  const step = STEP_COPY[order.status];

  if (!step) {
    return (
      <EmptyState
        icon={order.status === "DELIVERED" ? "checkmark-done-outline" : "swap-horizontal-outline"}
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

  const collectCash = order.payment?.method === "cod" && order.payment?.status !== "paid";
  const photoSaved = Boolean(order.delivery?.productPhoto);
  const photoMissing = photoRequired && !photoSaved;

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
<IconTile name={goingToStore ? "storefront-outline" : "location-outline"} />
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
              icon="navigate-outline"
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
              icon="call-outline"
              variant="outline"
              style={{ flex: 1 }}
              disabled={!destination.phone}
              onPress={() => callNumber(destination.phone)}
            />
          </View>
        </Card>

        {/* Payment — the thing a rider must not get wrong */}
        <Card style={[styles.payCard, collectCash ? styles.payCash : styles.payPrepaid]}>
          <Ionicons
            name={collectCash ? "cash-outline" : "checkmark-circle-outline"}
            size={26}
            color={collectCash ? colors.cash : colors.success}
          />
          <Text style={[styles.payLabel, { color: collectCash ? colors.cash : colors.success }]}>{collectCash ? "COLLECT CASH" : "PREPAID"}</Text>
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
                  <ItemThumb uri={item.image} />
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

        {/* Product photo, then handover */}
        {order.status === "ARRIVED" ? (
          <ProductPhotoCard orderId={orderId} order={order} required={photoRequired} onSaved={setOrder} />
        ) : null}

        {order.status === "ARRIVED" ? (
          <Card style={{ padding: spacing.md, gap: spacing.md }}>
            <Text style={type.h2}>Handover code</Text>
            <Text style={type.small}>
              Ask the customer to read the 4-digit code from their order screen.
            </Text>
            <TextInput
              value={otp}
              onChangeText={(text) => setOtp(text.replace(/\D/g, "").slice(0, 4))}
              placeholder="0000"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={4}
              style={styles.otpInput}
            />
          </Card>
        ) : null}

        <Button
          title="Report a problem"
          icon="help-circle-outline"
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

      {/* One primary action, always in the same place under the thumb. */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(bottom, spacing.md) + spacing.sm }]}>
        {order.status === "ARRIVED" ? (
          <Button
            title="Confirm delivery"
            subtitle={
              photoMissing
                ? "take the product photo first"
                : collectCash ? `after collecting ${rupees(order.pricing?.total)}` : undefined
            }
            loading={busy}
            disabled={otp.length !== 4 || photoMissing}
            onPress={handOver}
          />
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

// The photo of the products at the door, before they are handed over. It is
// proof of what was brought, not of the handover: saving it moves nothing on.
// "Saved" is shown only once the API has the photo — a preview on this phone
// is not a saved photo.
function ProductPhotoCard({ orderId, order, required, onSaved }) {
  const saved = order.delivery?.productPhoto;
  const [pending, setPending] = useState(null); // taken, not yet uploaded
  const [progress, setProgress] = useState(null); // 0..1 while uploading
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false); // camera permission refused for good
  const uploading = progress !== null;

  async function takePhoto() {
    setError("");
    // Asked here, when the rider taps, never on opening the screen.
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setBlocked(!permission.canAskAgain);
      setError(
        permission.canAskAgain
          ? "The camera is needed to photograph the products. Tap again and allow it."
          : "Camera access is turned off for this app. Turn it on in your phone's settings."
      );
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.5, exif: false });
      if (!result.canceled && result.assets?.[0]) setPending(result.assets[0]);
    } catch {
      setError("The camera could not be opened on this phone.");
    }
  }

  async function confirm() {
    if (uploading) return;
    setError("");
    setProgress(0);
    try {
      const data = await api.uploadImage(
        `/orders/${orderId}/product-photo`,
        { uri: pending.uri, type: pending.mimeType || "image/jpeg" },
        setProgress
      );
      onSaved(data.order);
      setPending(null);
    } catch (err) {
      // The photo stays on screen, so a retry needs no new picture.
      setError(err.message);
    } finally {
      setProgress(null);
    }
  }

  const shown = pending ? { uri: pending.uri, width: pending.width, height: pending.height } : saved ? { uri: saved.url, width: saved.width, height: saved.height } : null;
  const time = saved?.uploadedAt ? new Date(saved.uploadedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

  return (
    <Card style={{ padding: spacing.md, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
        <Text style={type.h2}>Product photo</Text>
        {saved && !pending ? (
          <Pill tone="success">Photo saved</Pill>
        ) : pending ? (
          <Pill tone="warn">Not saved yet</Pill>
        ) : (
          <Pill tone={required ? "danger" : "default"}>{required ? "Required" : "Not taken"}</Pill>
        )}
      </View>
      <Text style={type.small}>
        Photograph the products before you hand them over. Keep the customer, the inside of their home and
        any papers out of the picture.
      </Text>

      {shown?.uri ? (
        <Image
          source={{ uri: shown.uri }}
          style={[styles.photo, shown.width && shown.height ? { aspectRatio: shown.width / shown.height } : null]}
          resizeMode="contain"
          accessibilityLabel={pending ? "Preview of the product photo" : "Saved product photo"}
        />
      ) : null}

      {saved && !pending ? (
        <Text style={type.tiny}>Saved{time ? ` at ${time}` : ""}. This is not the handover — confirm it below with the customer's code.</Text>
      ) : null}

      <Notice tone="error">{error}</Notice>
      {blocked ? <Button title="Open settings" variant="outline" icon="settings-outline" onPress={() => Linking.openSettings()} /> : null}

      {pending ? (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button title="Retake" variant="outline" icon="camera-reverse-outline" style={{ flex: 1 }} disabled={uploading} onPress={takePhoto} />
          <Button
            title={error ? "Retry upload" : "Use this photo"}
            subtitle={uploading ? `Uploading ${Math.round(progress * 100)}%` : undefined}
            icon={uploading ? undefined : "cloud-upload-outline"}
            style={{ flex: 1 }}
            disabled={uploading}
            onPress={confirm}
          />
        </View>
      ) : (
        <Button
          title={saved ? "Retake photo" : "Take Product Photo"}
          variant={saved ? "outline" : "primary"}
          icon="camera-outline"
          onPress={takePhoto}
        />
      )}
    </Card>
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

  stepCard: { padding: spacing.lg },
  stepHeading: { ...type.h1, fontSize: 22 },
  stepSub: type.small,

  progress: { flexDirection: "row", marginBottom: spacing.lg },
  progressStep: { flex: 1, alignItems: "center", gap: 4 },
  progressLine: {
    position: "absolute",
    top: 11,
    right: "50%",
    width: "100%",
    height: 2,
    backgroundColor: colors.border,
  },
  progressLineDone: { backgroundColor: colors.primary },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  progressDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  progressDotHere: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  progressDotText: { fontSize: 11, fontWeight: "700", color: colors.textFaint },
  progressDotTextOn: { color: colors.onPrimary },
  progressDotTextHere: { color: colors.primaryDark },
  progressLabel: { fontSize: 10.5, fontWeight: "500", color: colors.textFaint },
  progressLabelOn: { color: colors.primaryDark },
  code: { ...type.small, fontWeight: "600", marginTop: spacing.sm, letterSpacing: 1 },

  legLabel: { ...type.tiny, textTransform: "uppercase", fontWeight: "600", letterSpacing: 0.5 },

  payCard: { padding: spacing.lg, alignItems: "center", gap: 2 },
  payCash: { backgroundColor: colors.cashSoft, borderColor: colors.cash },
  payPrepaid: { backgroundColor: colors.successSoft, borderColor: colors.success },
  payLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.2, marginTop: 2 },
  payAmount: { fontSize: 28, fontWeight: "700", color: colors.text },

  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  itemQty: { ...type.body, fontWeight: "700", minWidth: 46, textAlign: "right" },

  photo: { width: "100%", aspectRatio: 4 / 3, maxHeight: 360, borderRadius: radius.md, backgroundColor: colors.bg },

  otpInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    height: 60,
    textAlign: "center",
    fontSize: 28,
    letterSpacing: 14,
    fontWeight: "700",
    color: colors.text,
  },

  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow.bar,
  },
});
