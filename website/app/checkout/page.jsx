"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useCart } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees } from "@/lib/format";

const PAYMENT_METHODS = [
  { key: "cod", label: "Cash on delivery", hint: "Pay the delivery partner", live: true },
  { key: "upi", label: "UPI", hint: "GPay, PhonePe, Paytm", live: false },
  { key: "card", label: "Card", hint: "Credit or debit", live: false },
];

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCart();
  const { user, ready, signedIn, refreshUser } = useAuth();

  const [addressId, setAddressId] = useState(null);
  const [method, setMethod] = useState("cod");
  const [note, setNote] = useState("");
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

  if (!ready || !summary) {
    return (
      <div className="wrap">
        <div className="empty">Loading checkout…</div>
      </div>
    );
  }

  async function placeOrder() {
    setPlacing(true);
    setError("");
    try {
      const { order } = await api.post("/orders", {
        cart: cart.cart.id,
        address: addressId,
        paymentMethod: method,
        note,
        source: "web",
      });
      await Promise.all([cart.refresh(), refreshUser()]);
      router.push(`/orders/${order.id}?placed=1`);
    } catch (err) {
      setError(err.message);
      setPlacing(false);
    }
  }

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
            <div className="choice-list">
              {PAYMENT_METHODS.map((option) => (
                <label key={option.key} className={`choice choice-main${method === option.key ? " on" : ""}`}>
                  <input
                    type="radio"
                    name="payment"
                    checked={method === option.key}
                    onChange={() => setMethod(option.key)}
                  />
                  <span className="choice-radio" aria-hidden="true" />
                  <span className="choice-copy">
                    <strong>{option.label}</strong>
                    <span>{option.hint}</span>
                  </span>
                  {!option.live ? <span className="pill accent">Coming soon</span> : null}
                </label>
              ))}
            </div>

            {method !== "cod" ? (
              <p className="notice warn" style={{ marginTop: 14, marginBottom: 0 }}>
                No payment gateway is connected yet — the order will be created awaiting payment.
              </p>
            ) : null}
          </section>

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
              disabled={!addressId || !summary.meetsMinimum || placing}
              onClick={placeOrder}
            >
              {placing ? "Placing order…" : "Place order"}
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
