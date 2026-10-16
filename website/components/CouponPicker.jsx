"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth, useCart } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees } from "@/lib/format";

// "Your coupons" inside the cart and checkout: the signed-in customer's usable
// reward coupons, one tap to apply or remove. The discount and the new total
// come back from the API — nothing is worked out here.
export default function CouponPicker({ compact = false }) {
  const { signedIn } = useAuth();
  const cart = useCart();
  const [coupons, setCoupons] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const appliedId = cart.cart?.rewardCouponId || null;
  const reward = cart.cart?.rewardCoupon || null;

  useEffect(() => {
    if (!signedIn) return;
    api
      .get("/coupons", { status: "available" })
      .then((data) => setCoupons(data.items || []))
      .catch(() => setCoupons([]));
  }, [signedIn, appliedId]);

  if (!signedIn || coupons === null) return null;
  // The applied one is reserved by nobody yet, so it is still "available".
  if (!coupons.length && !appliedId) {
    return compact ? null : (
      <p className="coupon-pick-empty">
        No reward coupons yet — <Link href="/account/refer">refer a friend</Link> to earn some.
      </p>
    );
  }

  async function run(id, action) {
    setBusy(id);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="coupon-pick">
      <div className="coupon-pick-head">
        <strong>Your coupons</strong>
        <Link href="/account/coupons">View all</Link>
      </div>
      {reward && !reward.ok ? <p className="notice warn">{reward.code}: {reward.reason}</p> : null}
      {coupons.map((coupon) => {
        const applied = coupon.id === appliedId;
        return (
          <div key={coupon.id} className={`coupon-pick-row${applied ? " applied" : ""}`}>
            <span className="coupon-pick-main">
              <strong>{rupees(coupon.amount)} off</strong>
              <span>
                {coupon.title}
                {coupon.minOrderValue ? ` · on ${rupees(coupon.minOrderValue)}+` : ""}
                {` · until ${new Date(coupon.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
              </span>
            </span>
            {applied ? (
              <button
                type="button"
                className="btn sm"
                disabled={busy === coupon.id}
                onClick={() => run(coupon.id, () => cart.removeCoupon(coupon.code))}
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                className="btn primary sm"
                disabled={Boolean(busy)}
                onClick={() => run(coupon.id, () => cart.applyRewardCoupon(coupon.id))}
              >
                {busy === coupon.id ? "…" : "Apply"}
              </button>
            )}
          </div>
        );
      })}
      {error ? <p className="notice error">{error}</p> : null}
    </div>
  );
}
