import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput } from "../components/Text";
import { api, API_BASE_URL } from "../api/client";
import { onlinePaymentSupported, payOnline } from "../api/razorpay";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { colors, radius, rupees, shadow, spacing, type } from "../theme";
import { Button, Card, Divider, Loading, Notice, Pill } from "../components/ui";
import AddressForm from "../components/AddressForm";
import CouponPicker from "../components/CouponPicker";

export default function CheckoutScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const cart = useCart();

  const [addressId, setAddressId] = useState(null);
  const [method, setMethod] = useState("cod");
  const [upiTab, setUpiTab] = useState("manual");
  const [methods, setMethods] = useState(null);
  const [note, setNote] = useState("");
  const [useWallet, setUseWallet] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);

  const addresses = user?.addresses || [];
  const summary = cart.summary;
  const storeId = cart.cart?.store?.id;

  useEffect(() => {
    if (!addressId && addresses.length) {
      setAddressId((addresses.find((a) => a.isDefault) || addresses[0]).id);
    }
  }, [addresses, addressId]);

  // Wallet is applied by re-pricing the cart, so the total shown here is the
  // same number the order will be written with.
  useEffect(() => {
    cart
      .setCredits({ wallet: useWallet ? user?.walletBalance || 0 : 0 })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useWallet]);

  // What this store actually accepts — cash on delivery, and UPI once the
  // store has a VPA configured in Admin → Stores.
  useEffect(() => {
    if (!storeId || summary?.total == null) return;
    api
      .get("/payments/methods", { store: storeId, total: summary.total })
      .then((data) => setMethods(data.methods || []))
      .catch(() => setMethods([]));
  }, [storeId, summary?.total]);

  const codMethod = methods?.find((m) => m.key === "cod");
  const upiMethod = methods?.find((m) => m.key === "upi");
  // Offered by the API once Razorpay is set up; shown only where this build
  // can open the Razorpay sheet (not in Expo Go).
  const onlineMethod = onlinePaymentSupported ? methods?.find((m) => m.key === "online") : null;

  // "upi_app" is UPI through Razorpay (GPay, PhonePe, any UPI app) — to the
  // API an online payment like any other, as on the website.
  const payingOnline = method === "online" || method === "upi_app";

  const codBlocked = useMemo(
    () => (method === "cod" && codMethod && codMethod.available === false) || (payingOnline && !onlineMethod?.available),
    [method, codMethod, onlineMethod, payingOnline]
  );

  async function placeOrder() {
    setPlacing(true);
    setError("");
    let order;
    try {
      ({ order } = await api.post("/orders", {
        cart: cart.cart.id,
        address: addressId,
        paymentMethod: payingOnline ? "online" : method,
        note,
        source: "app",
      }));
    } catch (err) {
      setError(err.message);
      setPlacing(false);
      return;
    }

    // Online: the order exists, awaiting payment, with its stock held. It is
    // only shown as placed once the API has verified the payment; otherwise
    // the tracking screen says what happened and offers "Pay now" again.
    let result = { status: "paid" };
    if (payingOnline) {
      result = await payOnline(order.id, { upiOnly: method === "upi_app" }).catch((err) => ({
        status: "failed",
        message: err.message,
      }));
    }

    await Promise.all([cart.refresh(), refreshUser()]).catch(() => {});
    setPlacing(false);
    if (result.status === "paid") {
      navigation.replace("OrderPlaced", { orderId: order.id, code: order.code });
    } else {
      navigation.replace("OrderTrack", { orderId: order.id, payment: result });
    }
  }

  if (!summary) return <Loading />;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, gap: spacing.md }}>
        {error ? <Notice tone="error">{error}</Notice> : null}

        {/* Address */}
        <Card style={styles.panel}>
          <View style={styles.cardHead}>
            <StepTitle n={1} title="Delivery address" />
            <Pressable onPress={() => setAddingAddress(true)}>
              <Text style={styles.link}>+ Add new</Text>
            </Pressable>
          </View>

          {addresses.length === 0 && !addingAddress ? (
            <Notice tone="warn" style={{ marginTop: spacing.sm }}>
              Add an address to continue.
            </Notice>
          ) : null}

          {addresses.map((address) => (
            <Pressable
              key={address.id}
              onPress={() => setAddressId(address.id)}
              style={[styles.option, addressId === address.id && styles.optionActive]}
            >
              <View style={[styles.radio, (addressId === address.id) && styles.radioOn]}>
                {addressId === address.id ? <View style={styles.radioDot} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.optionTitle}>{address.label}</Text>
                  {address.isDefault ? <Pill tone="primary">Default</Pill> : null}
                </View>
                <Text style={type.small} numberOfLines={2}>
                  {[address.line1, address.line2, address.landmark, address.city, address.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>
            </Pressable>
          ))}

          {addingAddress ? (
            <AddressForm
              onCancel={() => setAddingAddress(false)}
              onSaved={async (saved) => {
                setAddingAddress(false);
                const fresh = await refreshUser();
                const latest = fresh?.addresses?.[fresh.addresses.length - 1];
                if (latest) setAddressId(latest.id);
              }}
            />
          ) : null}
        </Card>

        {/* Payment */}
        <Card style={styles.panel}>
          <StepTitle n={2} title="Payment method" />

          {methods === null ? (
            <Text style={[type.small, { marginTop: spacing.sm }]}>Loading payment options…</Text>
          ) : (
            <>
              {codMethod ? (
                <Pressable
                  onPress={() => setMethod("cod")}
                  style={[styles.option, method === "cod" && styles.optionActive]}
                >
                  <View style={[styles.radio, (method === "cod") && styles.radioOn]}>
                    {method === "cod" ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Cash on delivery</Text>
                    <Text style={type.tiny}>Pay the delivery partner</Text>
                  </View>
                  {codMethod.available === false ? <Pill tone="warn">{codMethod.reason}</Pill> : null}
                </Pressable>
              ) : null}

              {onlineMethod ? (
                <Pressable
                  onPress={() => setMethod("upi_app")}
                  style={[styles.option, method === "upi_app" && styles.optionActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: method === "upi_app" }}
                >
                  <View style={[styles.radio, (method === "upi_app") && styles.radioOn]}>
                    {method === "upi_app" ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>UPI</Text>
                    <Text style={type.tiny}>Google Pay, PhonePe, Paytm or any UPI app</Text>
                  </View>
                  {onlineMethod.available === false ? <Pill tone="warn">{onlineMethod.reason}</Pill> : null}
                </Pressable>
              ) : null}

              {onlineMethod ? (
                <Pressable
                  onPress={() => setMethod("online")}
                  style={[styles.option, method === "online" && styles.optionActive]}
                >
                  <View style={[styles.radio, (method === "online") && styles.radioOn]}>
                    {method === "online" ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Cards, netbanking & wallets</Text>
                    <Text style={type.tiny}>Debit/credit cards, netbanking, wallets or UPI via Razorpay</Text>
                  </View>
                  {onlineMethod.available === false ? <Pill tone="warn">{onlineMethod.reason}</Pill> : null}
                </Pressable>
              ) : null}

              {upiMethod ? (
                <>
                  <Pressable
                    onPress={() => {
                      setMethod("upi");
                      setUpiTab("manual");
                    }}
                    style={[styles.option, method === "upi" && upiTab === "manual" && styles.optionActive]}
                  >
                    <View style={[styles.radio, (method === "upi" && upiTab === "manual") && styles.radioOn]}>
                      {method === "upi" && upiTab === "manual" ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>UPI ID / Number</Text>
                      <Text style={type.tiny}>Pay {upiMethod.payeeName} from your UPI app</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setMethod("upi");
                      setUpiTab("scan");
                    }}
                    style={[styles.option, method === "upi" && upiTab === "scan" && styles.optionActive]}
                  >
                    <View style={[styles.radio, (method === "upi" && upiTab === "scan") && styles.radioOn]}>
                      {method === "upi" && upiTab === "scan" ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>Scan QR</Text>
                      <Text style={type.tiny}>GPay, PhonePe or any UPI app</Text>
                    </View>
                  </Pressable>
                </>
              ) : null}
            </>
          )}

          {method === "upi" && upiMethod ? (
            <View style={styles.upiBox}>
              {upiTab === "manual" ? (
                <>
                  <Text style={type.tiny}>Pay to</Text>
                  <Text selectable style={styles.upiId}>
                    {upiMethod.vpa}
                  </Text>
                  <Text style={type.tiny}>
                    {upiMethod.payeeName} · pay {rupees(summary.total)}, then place the order
                  </Text>
                </>
              ) : (
                <>
                  <Image
                    source={{ uri: `${API_BASE_URL}/api/v1/payments/upi-qr?store=${storeId}&amount=${summary.total}` }}
                    style={styles.upiQr}
                  />
                  <Text style={type.tiny}>Scan, pay {rupees(summary.total)}, then place the order</Text>
                </>
              )}
            </View>
          ) : null}

          {method === "upi" ? (
            <Notice tone="warn" style={{ marginTop: spacing.sm }}>
              No payment gateway is connected — the order is created awaiting payment, and we confirm it
              once we see it land.
            </Notice>
          ) : null}
        </Card>

        {/* Wallet */}
        {/* Hidden when the admin has switched wallet use off at checkout. */}
        {user?.walletBalance > 0 && cart.cart?.credits?.wallet !== false ? (
          <Card style={styles.panel}>
            <Pressable style={styles.walletRow} onPress={() => setUseWallet((v) => !v)}>
              <View style={[styles.checkbox, useWallet && styles.checkboxOn]}>
                {useWallet ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Use wallet balance</Text>
                <Text style={type.tiny}>{rupees(user.walletBalance)} available</Text>
              </View>
              {summary.walletApplied > 0 ? (
                <Text style={styles.walletApplied}>− {rupees(summary.walletApplied)}</Text>
              ) : null}
            </Pressable>
          </Card>
        ) : null}

        {/* Note */}
        <Card style={styles.panel}>
          <StepTitle n={3} title="Delivery instructions" note="Optional" />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Ring the bell twice, leave at the door"
            placeholderTextColor={colors.textFaint}
            multiline
            style={styles.noteInput}
          />
        </Card>

        {/* Summary */}
        <Card style={styles.panel}>
          <Text style={type.h3}>Order summary</Text>
          <CouponPicker compact onViewAll={() => navigation.navigate("Coupons")} />
          <View style={{ marginTop: spacing.sm, gap: 6 }}>
            <Row label={`${summary.itemCount} ${summary.itemCount === 1 ? "item" : "items"}`} value={rupees(summary.subtotal)} />
            {summary.rewardDiscount > 0 ? (
              <Row label="Reward coupon" value={`− ${rupees(summary.rewardDiscount)}`} tone="save" />
            ) : null}
            {summary.offerDiscount - (summary.rewardDiscount || 0) > 0 ? (
              <Row label="Offers" value={`− ${rupees(summary.offerDiscount - (summary.rewardDiscount || 0))}`} tone="save" />
            ) : null}
            <Row
              label="Delivery"
              value={summary.deliveryFree ? "FREE" : rupees(summary.deliveryCharge)}
              tone={summary.deliveryFree ? "save" : undefined}
            />
            {/* Every charge in the total is listed, so the rows add up to it. */}
            {summary.packagingCharge > 0 ? <Row label="Packaging" value={rupees(summary.packagingCharge)} /> : null}
            {summary.walletApplied > 0 ? (
              <Row label="Wallet" value={`− ${rupees(summary.walletApplied)}`} tone="save" />
            ) : null}
            {summary.roundOff ? <Row label="Round off" value={rupees(summary.roundOff, { decimals: true })} /> : null}
            <Divider style={{ marginVertical: spacing.sm }} />
            <Row label="To pay" value={rupees(summary.total)} bold />
          </View>

          {summary.cashbackEarned > 0 ? (
            <Notice tone="save" style={{ marginTop: spacing.md }}>
              You'll get {rupees(summary.cashbackEarned)} cashback after delivery.
            </Notice>
          ) : null}
        </Card>
      </ScrollView>

      <View style={styles.bar}>
        <View style={{ flex: 1 }}>
          <Text style={type.tiny}>{method === "cod" ? "Pay on delivery" : "To pay"}</Text>
          <Text style={styles.barTotal}>{rupees(summary.total)}</Text>
        </View>
        <Button
          title={
            method === "upi_app"
              ? `Pay ${rupees(summary.total)} with UPI`
              : method === "online"
                ? `Pay ${rupees(summary.total)}`
                : "Place order"
          }
          loading={placing}
          disabled={!addressId || !summary.meetsMinimum || codBlocked}
          onPress={placeOrder}
          style={{ minWidth: 180 }}
        />
      </View>
    </View>
  );
}

// The website's numbered panel heading: a green step number and the title.
function StepTitle({ n, title, note }) {
  return (
    <View style={styles.stepTitle}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={type.h3}>{title}</Text>
      {note ? <Text style={type.tiny}>{note}</Text> : null}
    </View>
  );
}

function Row({ label, value, tone, bold }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={[type.small, { fontSize: 14 }, bold && { color: colors.text, fontWeight: "700", fontSize: 17 }]}>{label}</Text>
      <Text
        style={[
          type.body,
          { fontWeight: bold ? "700" : "500", fontSize: bold ? 18 : 14 },
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
  panel: { padding: spacing.lg },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  link: { color: colors.primary, fontWeight: "600", fontSize: 13.5 },

  stepTitle: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: colors.onPrimary, fontSize: 13, fontWeight: "700" },

  // The website's .choice: a bordered card that turns green when chosen.
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  optionTitle: { ...type.body, fontWeight: "600", fontSize: 14 },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  walletRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  walletApplied: { color: colors.save, fontWeight: "700" },

  upiBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surfaceAlt,
    gap: 4,
  },
  upiId: { fontSize: 15, fontWeight: "700", color: colors.text, letterSpacing: 0.2 },
  upiQr: { width: 180, height: 180, borderRadius: 10, backgroundColor: "#fff" },

  noteInput: {
    marginTop: spacing.md,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: "top",
  },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow.bar,
  },
  barTotal: { fontSize: 20, fontWeight: "700", color: colors.text },
});
