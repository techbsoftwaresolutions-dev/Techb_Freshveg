"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MorphingSquare } from "@/components/ui/morphing-square";
import { useAuth, useCart } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees } from "@/lib/format";
import BackLink from "@/components/BackLink";

// The customer's reward coupons. Issued by the API when a referred friend
// reaches a milestone; applying one goes through the cart, which prices it.
const FILTERS = [
  { key: "available", label: "Available" },
  { key: "", label: "All" },
  { key: "redeemed", label: "Used" },
  { key: "expired", label: "Expired" },
];
const STATUS = {
  available: { label: "Available", tone: "save" },
  reserved: { label: "On an order", tone: "brand" },
  redeemed: { label: "Used", tone: "" },
  expired: { label: "Expired", tone: "danger" },
  revoked: { label: "Withdrawn", tone: "danger" },
};
const day = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function CouponsPage() {
  const router = useRouter();
  const { ready, signedIn } = useAuth();
  const cart = useCart();
  const [filter, setFilter] = useState("available");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/account/coupons");
  }, [ready, signedIn, router]);

  const load = useCallback(() => {
    setError("");
    api
      .get("/coupons", filter ? { status: filter } : undefined)
      .then((data) => setItems(data.items || []))
      .catch((err) => setError(err.message));
  }, [filter]);
  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  async function apply(coupon) {
    setBusy(coupon.id);
    setError("");
    try {
      await cart.applyRewardCoupon(coupon.id);
      router.push("/cart");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const appliedId = cart.cart?.rewardCouponId;

  return (
    <div className="wrap wrap-narrow">
      <header className="page-title has-back">
        <BackLink />
        <h1>My coupons</h1>
      </header>

      <div className="coupon-tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key || "all"}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`btn sm${filter === f.key ? " primary" : ""}`}
            onClick={() => {
              setItems(null);
              setFilter(f.key);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="notice error">
          {error}{" "}
          <button type="button" className="btn sm" onClick={load}>
            Retry
          </button>
        </p>
      ) : null}

      {!ready || (items === null && !error) ? (
        <div className="page-loading">
          <MorphingSquare message="Loading coupons…" />
        </div>
      ) : items && !items.length ? (
        <section className="panel">
          <h3>{filter === "available" ? "No coupons to use right now" : "Nothing here yet"}</h3>
          <p className="muted-line">
            Earn coupons when friends you refer shop with us. Rewards can take a few minutes to appear after their order is
            delivered.
          </p>
          <Link href="/account/refer" className="btn primary" style={{ marginTop: 10 }}>
            Refer &amp; earn
          </Link>
        </section>
      ) : (
        (items || []).map((coupon) => {
          const status = STATUS[coupon.status] || STATUS.available;
          const applied = coupon.id === appliedId;
          return (
            <article key={coupon.id} className={`coupon-card${coupon.status === "available" ? "" : " muted"}`}>
              <div className="coupon-value">{rupees(coupon.amount)}</div>
              <div className="coupon-body">
                <div className="row">
                  <strong>{coupon.title}</strong>
                  <span className={`pill ${status.tone}`}>{applied ? "In your cart" : status.label}</span>
                </div>
                <p>
                  {coupon.minOrderValue ? `On orders of ${rupees(coupon.minOrderValue)} or more · ` : ""}
                  {coupon.status === "available" ? `Valid until ${day(coupon.expiresAt)}` : null}
                  {coupon.status === "redeemed" ? `Used on ${coupon.orderCode} (${day(coupon.redeemedAt)})` : null}
                  {coupon.status === "expired" ? `Expired ${day(coupon.expiresAt)}` : null}
                </p>
                <div className="row">
                  <button type="button" className="section-link" onClick={() => setOpen(open === coupon.id ? null : coupon.id)}>
                    {open === coupon.id ? "Hide details" : "Details"}
                  </button>
                  {coupon.status === "available" && !applied ? (
                    <button type="button" className="btn primary sm" disabled={Boolean(busy)} onClick={() => apply(coupon)}>
                      {busy === coupon.id ? "Applying…" : "Apply to cart"}
                    </button>
                  ) : null}
                </div>
                {open === coupon.id ? (
                  <div className="coupon-details">
                    <span>{coupon.description}</span>
                    {coupon.milestone ? <span>Referral milestone: purchase #{coupon.milestone}</span> : null}
                    <span>Issued {day(coupon.issuedAt)} · expires {day(coupon.expiresAt)}</span>
                    <span>
                      Code <span className="coupon-code">{coupon.code}</span> · one use · only on your account · cannot
                      exceed the value of the items
                    </span>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
