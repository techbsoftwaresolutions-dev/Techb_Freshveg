"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useCart } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees } from "@/lib/format";
import { payWithRazorpay } from "@/lib/razorpay";
import SavedAddresses from "@/components/SavedAddresses";
import { useServiceability } from "@/lib/use-serviceability";

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCart();
  const { user, ready, signedIn, refreshUser } = useAuth();

  const [addressId, setAddressId] = useState(null);
  const [method, setMethod] = useState("cod");
  const [upiTab, setUpiTab] = useState("razorpay");
  const [copied, setCopied] = useState(false);
  const [methods, setMethods] = useState(null);
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/checkout");
  }, [ready, signedIn, router]);

  const addresses = user?.addresses || [];
  const selectedAddress = addresses.find((a) => a.id === addressId) || null;
  const pincodeServiceable = useServiceability(selectedAddress ? [selectedAddress.pincode] : []);
  const addressUnserviceable = Boolean(selectedAddress) && pincodeServiceable(selectedAddress.pincode) === false;

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
      .then((data) => {
        const list = data.methods || [];
        setMethods(list);
        const upi = list.find((m) => m.key === "upi");
        // Default to whichever UPI route this store actually offers.
        if (upi) setUpiTab(upi.razorpay ? "razorpay" : "manual");
      })
      .catch(() => setMethods([]));
  }, [storeId, cartTotal]);

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

      // UPI through Razorpay: the order exists (awaiting payment), now open
      // the payment window. If it is closed unpaid the customer lands on the
      // order page, where "Pay now" lets them try again.
      if (method === "upi" && upiTab === "razorpay") {
        try {
          const result = await payWithRazorpay(order.id);
          router.push(`/orders/${order.id}?placed=1${result.paid ? "&paid=1" : ""}`);
        } catch (err) {
          router.push(`/orders/${order.id}?placed=1&payerror=${encodeURIComponent(err.message)}`);
        }
        return;
      }
      router.push(`/orders/${order.id}?placed=1`);
    } catch (err) {
      setError(err.message);
      setPlacing(false);
    }
  }

  const codMethod = methods?.find((m) => m.key === "cod");
  const upiMethod = methods?.find((m) => m.key === "upi");

  const steps = [
    { label: "Delivery address", short: "Address", done: Boolean(addressId) },
    { label: "Payment", short: "Payment", done: Boolean(method) },
    { label: "Review & place order", short: "Review", done: false },
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
              <span className="step-label-full">{step.label}</span>
              <span className="step-label-short">{step.short}</span>
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
            </div>

            {!addresses.length ? (
              <p className="notice warn" style={{ margin: "12px 0" }}>
                Add an address to continue.
              </p>
            ) : null}
            <SavedAddresses selectedId={addressId} onSelect={setAddressId} />
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

                {upiMethod?.razorpay ? (
                  <label className={`choice choice-main${method === "upi" && upiTab === "razorpay" ? " on" : ""}`}>
                    <input
                      type="radio"
                      name="payment"
                      checked={method === "upi" && upiTab === "razorpay"}
                      onChange={() => {
                        setMethod("upi");
                        setUpiTab("razorpay");
                      }}
                    />
                    <span className="choice-radio" aria-hidden="true" />
                    <span className="choice-copy">
                      <strong>
                        Pay with Razorpay
                        <span className="pill accent choice-tag">Recommended</span>
                      </strong>
                      <span>UPI, cards &amp; netbanking</span>
                    </span>
                  </label>
                ) : null}

                {upiMethod?.manual ? (
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

            {method === "upi" && upiTab === "razorpay" && upiMethod?.razorpay ? (
              <p className="notice info" style={{ marginTop: 14, marginBottom: 0 }}>
                A secure Razorpay window opens when you place the order. Choose your UPI app, pay{" "}
                {rupees(summary.total)}, and your order is confirmed automatically.
              </p>
            ) : null}

            {method === "upi" && upiTab !== "razorpay" && upiMethod?.manual ? (
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

            {method === "upi" && upiTab !== "razorpay" ? (
              <p className="notice warn" style={{ marginTop: 14, marginBottom: 0 }}>
                No payment gateway is connected — the order is created awaiting payment, and we confirm
                it once we see it land.
              </p>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                <span className="step-num">3</span>
                <span className="nowrap-title">Delivery instructions</span> <span className="panel-head-note">Optional</span>
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
              disabled={!addressId || addressUnserviceable || !summary.meetsMinimum || placing}
              onClick={placeOrder}
            >
              {placing ? "Placing order…" : method === "upi" && upiTab === "razorpay" ? "Pay & place order" : "Place order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
