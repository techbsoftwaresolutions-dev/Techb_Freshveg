"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useCart, useStore } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees } from "@/lib/format";
import { payOnline } from "@/lib/razorpay";

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCart();
  const { areaId } = useStore();
  const { user, ready, signedIn, refreshUser } = useAuth();

  const [addressId, setAddressId] = useState(null);
  const [method, setMethod] = useState("cod");
  const [upiTab, setUpiTab] = useState("manual");
  const [copied, setCopied] = useState(false);
  const [methods, setMethods] = useState(null);
  const [note, setNote] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/checkout");
  }, [ready, signedIn, router]);

  const addresses = user?.addresses || [];

  useEffect(() => {
    if (!addressId && addresses.length) {
      setAddressId((addresses.find((a) => a.isDefault) || addresses[0]).id);
    }
  }, [addresses, addressId]);

  // What this store actually accepts — cash on delivery, and UPI once the
  // store has a VPA configured in Admin → Stores. No static guesswork here,
  // so turning UPI on for a store needs no code change on this page.
  const storeId = cart.cart?.store?.id;
  const cartTotal = cart.summary?.total;
  useEffect(() => {
    if (!storeId || cartTotal == null) return;
    api
      .get("/payments/methods", { store: storeId, total: cartTotal })
      .then((data) => setMethods(data.methods || []))
      .catch(() => setMethods([]));
  }, [storeId, cartTotal]);

  async function removeAddress(id) {
    setRemovingId(id);
    try {
      const { addresses: fresh } = await api.del(`/auth/me/addresses/${id}`);
      if (addressId === id) {
        const next = fresh.find((a) => a.isDefault) || fresh[0];
        setAddressId(next?.id || null);
      }
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  const summary = cart.summary;
  const walletOn = (summary?.walletApplied || 0) > 0;

  // Wallet is applied by re-pricing the cart on the server, so the total
  // shown is the one the order is written with — same as the app.
  async function toggleWallet(on) {
    setWalletBusy(true);
    setError("");
    try {
      await cart.setCredits({ wallet: on ? user?.walletBalance || 0 : 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setWalletBusy(false);
    }
  }

  if (!ready || !summary) {
    return (
      <div className="wrap">
        <div className="empty">Loading checkout…</div>
      </div>
    );
  }

  // "upi_app" is UPI through Razorpay (GPay, PhonePe, any UPI app); to the API
  // it is an online payment like any other.
  const payingOnline = method === "online" || method === "upi_app";

  async function placeOrder() {
    setPlacing("Placing order…");
    setError("");
    let order;
    try {
      ({ order } = await api.post("/orders", {
        cart: cart.cart.id,
        address: addressId,
        // The delivery area picked in "Deliver to"; the API re-checks it.
        deliveryArea: areaId || undefined,
        paymentMethod: payingOnline ? "online" : method,
        note,
        source: "web",
      }));
    } catch (err) {
      setError(err.message);
      setPlacing(false);
      return;
    }

    // Online: the order now exists, awaiting payment, with its stock held. It
    // is only shown as placed once the API has verified the payment; anything
    // short of that lands on the order page, which offers "Pay now" again.
    let next = `/orders/${order.id}?placed=1`;
    if (payingOnline) {
      const upiOnly = method === "upi_app";
      setPlacing(upiOnly ? "Opening UPI…" : "Opening payment…");
      const result = await payOnline(order.id, {
        upiOnly,
        onVerifying: () => setPlacing("Verifying payment…"),
      }).catch(() => ({ status: "failed" }));
      // The order page carries on from here — "Pay now" retries the same way.
      if (result.status !== "paid") next = `/orders/${order.id}?payment=${result.status}${upiOnly ? "&via=upi" : ""}`;
    }

    await Promise.all([cart.refresh(), refreshUser()]).catch(() => {});
    router.push(next);
  }

  const codMethod = methods?.find((m) => m.key === "cod");
  const upiMethod = methods?.find((m) => m.key === "upi");
  const onlineMethod = methods?.find((m) => m.key === "online");

  const steps = [
    { label: "Delivery address", done: Boolean(addressId) },
    { label: "Payment", done: Boolean(method) },
    { label: "Review & place order", done: false },
  ];

  return (
    <div className="wrap">
      <header className="page-title">
        <h1>Checkout</h1>
      </header>

      <ol className="checkout-steps" aria-label="Checkout progress">
        {steps.map((step, index) => {
          const active = !step.done && steps.slice(0, index).every((s) => s.done);
          return (
            <li key={step.label} className={`checkout-step${step.done ? " done" : ""}${active ? " active" : ""}`}>
              <span className="num" aria-hidden="true">{step.done ? "\u2713" : index + 1}</span>
              {step.label}
              {index < steps.length - 1 ? <span className="checkout-step-line" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>

      {error ? <p className="notice error">{error}</p> : null}

      <div className="split cart">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h3>
                <span className="step-num">1</span>
                Delivery address
              </h3>
              {addresses.length ? (
                <button
                  className="btn sm"
                  onClick={() => {
                    setEditingId(null);
                    setAdding((v) => !v);
                  }}
                >
                  {adding ? "Cancel" : "+ Add new"}
                </button>
              ) : null}
            </div>

            {!addresses.length ? (
              <p className="notice warn" style={{ marginTop: 12, marginBottom: 0 }}>
                Add an address to continue — fill in the form below.
              </p>
            ) : null}

            <div className="choice-list">
              {addresses.map((address) =>
                editingId === address.id ? (
                  <AddressForm
                    key={address.id}
                    address={address}
                    onCancel={() => setEditingId(null)}
                    onSaved={async () => {
                      setEditingId(null);
                      await refreshUser();
                    }}
                  />
                ) : (
                  <div key={address.id} className={`choice${addressId === address.id ? " on" : ""}`}>
                    <label className="choice-main">
                      <input
                        type="radio"
                        name="address"
                        checked={addressId === address.id}
                        onChange={() => setAddressId(address.id)}
                      />
                      <span className="choice-radio" aria-hidden="true" />
                      <span className="choice-copy">
                        <strong>
                          {address.label}
                          {address.isDefault ? <span className="pill brand">Default</span> : null}
                        </strong>
                        <span>
                          {[address.line1, address.line2, address.landmark, address.city, address.pincode]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </span>
                    </label>
                    <div className="choice-actions">
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => {
                          setAdding(false);
                          setEditingId(address.id);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn sm"
                        disabled={removingId === address.id}
                        onClick={() => removeAddress(address.id)}
                      >
                        {removingId === address.id ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>

            {adding || !addresses.length ? (
              <AddressForm
                onSaved={async () => {
                  setAdding(false);
                  const fresh = await refreshUser();
                  const latest = fresh?.addresses?.[fresh.addresses.length - 1];
                  if (latest) setAddressId(latest.id);
                }}
              />
            ) : null}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <span className="step-num">2</span>
                Payment method
              </h3>
            </div>

            {methods === null ? (
              <p className="muted-line">Loading payment options…</p>
            ) : (
              <div className="choice-list">
                {codMethod ? (
                  <label className={`choice choice-main${method === "cod" ? " on" : ""}`}>
                    <input
                      type="radio"
                      name="payment"
                      checked={method === "cod"}
                      onChange={() => setMethod("cod")}
                    />
                    <span className="choice-radio" aria-hidden="true" />
                    <span className="choice-copy">
                      <strong>Cash on delivery</strong>
                      <span>Pay the delivery partner</span>
                    </span>
                    {!codMethod.available ? <span className="pill accent">{codMethod.reason}</span> : null}
                  </label>
                ) : null}

                {onlineMethod ? (
                  <label className={`choice choice-main${method === "upi_app" ? " on" : ""}`}>
                    <input
                      type="radio"
                      name="payment"
                      checked={method === "upi_app"}
                      disabled={!onlineMethod.available}
                      onChange={() => setMethod("upi_app")}
                    />
                    <span className="choice-radio" aria-hidden="true" />
                    <span className="choice-copy">
                      <strong>UPI</strong>
                      <span>Google Pay, PhonePe, Paytm or any UPI app</span>
                    </span>
                    {!onlineMethod.available ? <span className="pill accent">{onlineMethod.reason}</span> : null}
                  </label>
                ) : null}

                {onlineMethod ? (
                  <label className={`choice choice-main${method === "online" ? " on" : ""}`}>
                    <input
                      type="radio"
                      name="payment"
                      checked={method === "online"}
                      disabled={!onlineMethod.available}
                      onChange={() => setMethod("online")}
                    />
                    <span className="choice-radio" aria-hidden="true" />
                    <span className="choice-copy">
                      <strong>Cards, netbanking &amp; wallets</strong>
                      <span>Debit/credit cards, netbanking, wallets or UPI — paid securely via Razorpay</span>
                    </span>
                    {!onlineMethod.available ? <span className="pill accent">{onlineMethod.reason}</span> : null}
                  </label>
                ) : null}

                {upiMethod ? (
                  <>
                    <label className={`choice choice-main${method === "upi" && upiTab === "manual" ? " on" : ""}`}>
                      <input
                        type="radio"
                        name="payment"
                        checked={method === "upi" && upiTab === "manual"}
                        onChange={() => {
                          setMethod("upi");
                          setUpiTab("manual");
                        }}
                      />
                      <span className="choice-radio" aria-hidden="true" />
                      <span className="choice-copy">
                        <strong>UPI ID / Number</strong>
                        <span>Pay {upiMethod.payeeName} directly from your UPI app</span>
                      </span>
                    </label>
                    <label className={`choice choice-main${method === "upi" && upiTab === "scan" ? " on" : ""}`}>
                      <input
                        type="radio"
                        name="payment"
                        checked={method === "upi" && upiTab === "scan"}
                        onChange={() => {
                          setMethod("upi");
                          setUpiTab("scan");
                        }}
                      />
                      <span className="choice-radio" aria-hidden="true" />
                      <span className="choice-copy">
                        <strong>Scan QR</strong>
                        <span>Scan with GPay, PhonePe or any UPI app</span>
                      </span>
                    </label>
                  </>
                ) : null}
              </div>
            )}

            {method === "upi_app" ? (
              <div className="upi-pay-box">
                <span className="upi-pay-label">How it works</span>
                <span className="upi-pay-note">
                  Tap <strong>Pay {rupees(summary.total)} with UPI</strong> below. On a computer, scan the QR code
                  with your UPI app; on a phone, pick Google Pay, PhonePe or Paytm, or enter your UPI ID. Approve
                  the payment in the app and you&apos;ll be taken to your order confirmation.
                </span>
              </div>
            ) : null}

            {method === "upi" && upiMethod ? (
              <div className="upi-pay-box">
                {upiTab === "manual" ? (
                  <>
                    <span className="upi-pay-label">Pay to</span>
                    <div className="upi-pay-id">
                      <strong>{upiMethod.vpa}</strong>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(upiMethod.vpa);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch {
                            // Clipboard permission denied — the VPA is still shown to copy by hand.
                          }
                        }}
                      >
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <span className="upi-pay-note">
                      {upiMethod.payeeName} · pay {rupees(summary.total)}, then place the order
                    </span>
                  </>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a
                        store-specific, amount-specific image generated by our
                        own API; next/image's static optimization adds nothing here. */}
                    <img
                      src={`/api/v1/payments/upi-qr?store=${storeId}&amount=${summary.total}`}
                      alt={`UPI QR for ${upiMethod.payeeName}`}
                      width={200}
                      height={200}
                      className="upi-qr-img"
                    />
                    <span className="upi-pay-note">Scan, pay {rupees(summary.total)}, then place the order</span>
                  </>
                )}
              </div>
            ) : null}

            {method === "upi" ? (
              <p className="notice warn" style={{ marginTop: 14, marginBottom: 0 }}>
                No payment gateway is connected — the order is created awaiting payment, and we confirm
                it once we see it land.
              </p>
            ) : null}
          </section>

          {user?.walletBalance > 0 && cart.cart?.credits?.wallet !== false ? (
            <section className="panel">
              <label className={`choice choice-main${walletOn ? " on" : ""}`}>
                <input type="checkbox" checked={walletOn} disabled={walletBusy} onChange={(e) => toggleWallet(e.target.checked)} />
                <span className="choice-radio choice-check" aria-hidden="true" />
                <span className="choice-copy">
                  <strong>Use wallet balance</strong>
                  <span>{rupees(user.walletBalance)} available</span>
                </span>
                {summary.walletApplied > 0 ? <span className="pill save">− {rupees(summary.walletApplied)}</span> : null}
              </label>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-head">
              <h3>
                <span className="step-num">3</span>
                Delivery instructions <span className="panel-head-note">Optional</span>
              </h3>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Ring the bell twice, leave with the watchman"
            />
          </section>
        </div>

        <div className="sticky">
          <div className="panel">
            <h3>Order summary</h3>
            <div className="bill">
              <div className="bill-row">
                <span className="label">
                  {summary.itemCount} item{summary.itemCount === 1 ? "" : "s"}
                </span>
                <span>{rupees(summary.subtotal)}</span>
              </div>
              {summary.offerDiscount > 0 ? (
                <div className="bill-row save-row">
                  <span className="label">Offers</span>
                  <span>− {rupees(summary.offerDiscount)}</span>
                </div>
              ) : null}
              <div className={`bill-row${summary.deliveryFree ? " save-row" : ""}`}>
                <span className="label">Delivery</span>
                <span>{summary.deliveryFree ? "FREE" : rupees(summary.deliveryCharge)}</span>
              </div>
              {summary.walletApplied > 0 ? (
                <div className="bill-row save-row">
                  <span className="label">Wallet</span>
                  <span>− {rupees(summary.walletApplied)}</span>
                </div>
              ) : null}
              {/* Every charge in the total is listed, so the rows add up to it. */}
              {summary.packagingCharge > 0 ? (
                <div className="bill-row">
                  <span className="label">Packaging</span>
                  <span>{rupees(summary.packagingCharge)}</span>
                </div>
              ) : null}
              {summary.roundOff ? (
                <div className="bill-row">
                  <span className="label">Round off</span>
                  <span>{rupees(summary.roundOff, { decimals: true })}</span>
                </div>
              ) : null}
              <div className="bill-row total">
                <span>{method === "cod" ? "Pay on delivery" : "To pay"}</span>
                <span>{rupees(summary.total)}</span>
              </div>
            </div>

            {summary.cashbackEarned > 0 ? (
              <p className="notice save" style={{ marginTop: 14, marginBottom: 0 }}>
                {rupees(summary.cashbackEarned)} cashback after delivery.
              </p>
            ) : null}

            {/* Say why the button is disabled rather than leave it grey. */}
            {!summary.meetsMinimum ? (
              <p className="notice warn" style={{ marginTop: 14, marginBottom: 0 }}>
                Minimum order is {rupees(summary.minOrderValue)} — add {rupees(summary.shortfallToMinimum)} more
                to place this order.
              </p>
            ) : !addressId ? (
              <p className="notice warn" style={{ marginTop: 14, marginBottom: 0 }}>
                Add a delivery address to place this order.
              </p>
            ) : null}

            <button
              className="btn primary block lg"
              style={{ marginTop: 16 }}
              disabled={
                !addressId ||
                !summary.meetsMinimum ||
                Boolean(placing) ||
                (payingOnline && !onlineMethod?.available)
              }
              onClick={placeOrder}
            >
              {placing ||
                (method === "upi_app"
                  ? `Pay ${rupees(summary.total)} with UPI`
                  : method === "online"
                    ? `Pay ${rupees(summary.total)}`
                    : "Place order")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddressForm({ address, onSaved, onCancel }) {
  const [form, setForm] = useState(
    address
      ? {
          label: address.label || "Home",
          line1: address.line1 || "",
          landmark: address.landmark || "",
          city: address.city || "",
          pincode: address.pincode || "",
        }
      : { label: "Home", line1: "", landmark: "", city: "", pincode: "" }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (address) {
        await api.patch(`/auth/me/addresses/${address.id}`, form);
      } else {
        await api.post("/auth/me/addresses", form);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="address-form">
      {error ? <p className="notice error">{error}</p> : null}

      <div className="field">
        <label htmlFor="label">Label</label>
        <select id="label" value={form.label} onChange={set("label")} style={{ width: 160 }}>
          <option>Home</option>
          <option>Work</option>
          <option>Other</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="line1">Flat / house, street</label>
        <input id="line1" type="text" value={form.line1} onChange={set("line1")} required />
      </div>

      <div className="field">
        <label htmlFor="landmark">Landmark (optional)</label>
        <input id="landmark" type="text" value={form.landmark} onChange={set("landmark")} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="city">City</label>
          <input id="city" type="text" value={form.city} onChange={set("city")} required />
        </div>
        <div className="field">
          <label htmlFor="pincode">Pincode</label>
          <input
            id="pincode"
            type="tel"
            value={form.pincode}
            onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
            required
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="btn primary"
          disabled={saving || !form.line1 || !form.city || form.pincode.length !== 6}
        >
          {saving ? "Saving…" : address ? "Save changes" : "Save address"}
        </button>
        {onCancel ? (
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
