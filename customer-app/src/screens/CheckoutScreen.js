import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "../components/AppText";
import { api, API_BASE_URL } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { colors, radius, rupees, spacing, type } from "../theme";
import { Button, Card, Divider, Loading, Notice, Pill } from "../components/ui";

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

  const codBlocked = useMemo(
    () => method === "cod" && codMethod && codMethod.available === false,
    [method, codMethod]
  );

  async function placeOrder() {
    setPlacing(true);
    setError("");
    try {
      const { order } = await api.post("/orders", {
        cart: cart.cart.id,
        address: addressId,
        paymentMethod: method,
        note,
        source: "app",
      });

      await Promise.all([cart.refresh(), refreshUser()]);
      navigation.replace("OrderPlaced", { orderId: order.id, code: order.code });
    } catch (err) {
      setError(err.message);
    } finally {
      setPlacing(false);
    }
  }

  if (!summary) return <Loading />;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, gap: spacing.md }}>
        {error ? <Notice tone="error">{error}</Notice> : null}

        {/* Address */}
        <Card style={{ padding: spacing.md }}>
          <View style={styles.cardHead}>
            <Text style={type.h3}>Delivery address</Text>
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
              <View style={styles.radio}>
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
        <Card style={{ padding: spacing.md }}>
          <Text style={type.h3}>Payment method</Text>

          {methods === null ? (
            <Text style={[type.small, { marginTop: spacing.sm }]}>Loading payment options…</Text>
          ) : (
            <>
              {codMethod ? (
                <Pressable
                  onPress={() => setMethod("cod")}
                  style={[styles.option, method === "cod" && styles.optionActive]}
                >
                  <View style={styles.radio}>
                    {method === "cod" ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Cash on delivery</Text>
                    <Text style={type.tiny}>Pay the delivery partner</Text>
                  </View>
                  {codMethod.available === false ? <Pill tone="warn">{codMethod.reason}</Pill> : null}
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
                    <View style={styles.radio}>
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
                    <View style={styles.radio}>
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
        {user?.walletBalance > 0 ? (
          <Card style={{ padding: spacing.md }}>
            <Pressable style={styles.walletRow} onPress={() => setUseWallet((v) => !v)}>
              <View style={[styles.checkbox, useWallet && styles.checkboxOn]}>
                {useWallet ? <Text style={styles.checkmark}>✓</Text> : null}
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
        <Card style={{ padding: spacing.md }}>
          <Text style={type.h3}>Delivery instructions</Text>
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
        <Card style={{ padding: spacing.md }}>
          <Text style={type.h3}>Order summary</Text>
          <View style={{ marginTop: spacing.sm, gap: 6 }}>
            <Row label={`${summary.itemCount} ${summary.itemCount === 1 ? "item" : "items"}`} value={rupees(summary.subtotal)} />
            {summary.offerDiscount > 0 ? (
              <Row label="Offers" value={`− ${rupees(summary.offerDiscount)}`} tone="save" />
            ) : null}
            <Row
              label="Delivery"
              value={summary.deliveryFree ? "FREE" : rupees(summary.deliveryCharge)}
              tone={summary.deliveryFree ? "save" : undefined}
            />
            {summary.walletApplied > 0 ? (
              <Row label="Wallet" value={`− ${rupees(summary.walletApplied)}`} tone="save" />
            ) : null}
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
          <Text style={type.tiny}>{method === "cod" ? "Pay on delivery" : "Payable"}</Text>
          <Text style={styles.barTotal}>{rupees(summary.total)}</Text>
        </View>
        <Button
          title="Place order"
          loading={placing}
          disabled={!addressId || !summary.meetsMinimum || codBlocked}
          onPress={placeOrder}
        />
      </View>
    </View>
  );
}

function AddressForm({ onCancel, onSaved }) {
  const [form, setForm] = useState({
    label: "Home",
    line1: "",
    landmark: "",
    city: "",
    pincode: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      const data = await api.post("/auth/me/addresses", form);
      onSaved(data.addresses);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      {error ? <Notice tone="error">{error}</Notice> : null}

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {["Home", "Work", "Other"].map((label) => (
          <Pressable
            key={label}
            onPress={() => set("label")(label)}
            style={[styles.labelChip, form.label === label && styles.labelChipActive]}
          >
            <Text style={[styles.labelChipText, form.label === label && { color: colors.primaryDark }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input placeholder="Flat / house, street" value={form.line1} onChangeText={set("line1")} />
      <Input placeholder="Landmark (optional)" value={form.landmark} onChangeText={set("landmark")} />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Input placeholder="City" value={form.city} onChangeText={set("city")} style={{ flex: 1 }} />
        <Input
          placeholder="Pincode"
          value={form.pincode}
          onChangeText={(text) => set("pincode")(text.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          style={{ flex: 1 }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} style={{ flex: 1 }} />
        <Button
          title="Save address"
          size="sm"
          loading={saving}
          disabled={!form.line1 || !form.city || form.pincode.length !== 6}
          onPress={save}
          style={{ flex: 2 }}
        />
      </View>
    </View>
  );
}

function Input({ style, ...props }) {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      style={[styles.input, style]}
      {...props}
    />
  );
}

function Row({ label, value, tone, bold }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={[type.small, bold && { color: colors.text, fontWeight: "800", fontSize: 14 }]}>{label}</Text>
      <Text
        style={[
          type.body,
          { fontWeight: bold ? "800" : "600", fontSize: bold ? 16 : 14 },
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
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  link: { color: colors.primary, fontWeight: "700", fontSize: 13 },

  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTitle: { ...type.body, fontWeight: "700", fontSize: 13.5 },

  radio: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: "900" },
  walletRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  walletApplied: { color: colors.save, fontWeight: "800" },

  upiBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    gap: 4,
  },
  upiId: { fontSize: 15, fontWeight: "700", color: colors.text, letterSpacing: 0.2 },
  upiQr: { width: 180, height: 180, borderRadius: 10, backgroundColor: "#fff" },

  noteInput: {
    marginTop: spacing.sm,
    minHeight: 62,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.text,
    fontSize: 13.5,
    textAlignVertical: "top",
  },

  form: { gap: spacing.sm, marginTop: spacing.md },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 13.5,
  },
  labelChip: {
    paddingHorizontal: spacing.md,
    height: 30,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  labelChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  labelChipText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  barTotal: { fontSize: 18, fontWeight: "800", color: colors.text },
});
