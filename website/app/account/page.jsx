"use client";

import Link from "next/link";
import { MorphingSquare } from "@/components/ui/morphing-square";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useStore } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees, when } from "@/lib/format";
import StatusPill from "@/components/StatusPill";
import AccountMobile, { AccountHead } from "@/components/AccountMobile";

export default function AccountPage() {
  const router = useRouter();
  const { user, ready, signedIn, signOut } = useAuth();
  const { store, pincode } = useStore();
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/account");
  }, [ready, signedIn, router]);

  async function shareReferral(code) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const text = `Use my Farmers Basket referral code ${code} and get a discount on your first order!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "The Farmers Basket referral", text, url: origin });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${origin}`);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  }

  const [recentOrders, setRecentOrders] = useState(null);
  useEffect(() => {
    if (!signedIn) return;
    api
      .get("/orders/mine", { limit: 3 })
      .then((data) => setRecentOrders(data.items || []))
      .catch(() => setRecentOrders([]));
  }, [signedIn]);

  if (!ready || !user) {
    return (
      <div className="wrap acct-page">
        <AccountHead settings={false} />
        <div className="page-loading"><MorphingSquare message="Loading your account…" /></div>
      </div>
    );
  }

  const initials = (user.name || "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = () => {
    signOut();
    router.push("/");
  };

  return (
    <div className="wrap acct-page">
      {/* Phone layout: same data and handlers, arranged for a small screen. */}
      <AccountMobile
        user={user}
        initials={initials}
        store={store}
        pincode={pincode}
        recentOrders={recentOrders}
        shared={shared}
        onShare={shareReferral}
        onSignOut={handleSignOut}
      />

      {/* Desktop dashboard, unchanged — hidden on phones. */}
      <div className="acct-d">
      <header className="page-title">
        <h1>My Account</h1>
      </header>

      <section className="account-hero">
        <span className="avatar" aria-hidden="true">{initials}</span>
        <div className="account-hero-copy">
          <strong>{user.name || "Add your name"}</strong>
          <span>
            +91 {user.phone}
            {user.email ? ` · ${user.email}` : ""}
          </span>
          <Link href="/account/edit" className="account-hero-edit">
            Edit profile
          </Link>
        </div>
        <button
          type="button"
          className="btn sm account-signout"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </section>

      <div className="stat-tiles">
        <div className="stat-tile">
          <span>Wallet balance</span>
          <strong>{rupees(user.walletBalance)}</strong>
        </div>
        <div className="stat-tile">
          <span>Loyalty points</span>
          <strong>{user.loyaltyPoints ?? 0}</strong>
          <em>100 points = ₹10 off</em>
        </div>
        {user.referralCode ? (
          <div className="stat-tile">
            <span>Refer a friend</span>
            <div className="stat-tile-row">
              <strong className="stat-code">{user.referralCode}</strong>
              <button type="button" className="stat-share-btn" onClick={() => shareReferral(user.referralCode)}>
                {shared ? "Copied!" : "Share"}
              </button>
            </div>
          </div>
        ) : null}
        <div className="stat-tile">
          <span>Delivery location</span>
          <strong>{pincode || store?.address?.city || "Not set"}</strong>
          {store?.name ? <em>{store.name}</em> : null}
        </div>
      </div>

      <div className="split cart">
        <section className="panel">
          <div className="panel-head">
            <h3>Recent orders</h3>
            <Link href="/orders" className="section-link">
              View all →
            </Link>
          </div>

          {recentOrders === null ? (
            <p className="muted-line">Loading…</p>
          ) : recentOrders.length ? (
            <div className="list-rows">
              {recentOrders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`} className="list-row">
                  <span className="list-row-main">
                    <strong className="tabular">{order.code}</strong>
                    <span>{when(order.placedAt)}</span>
                  </span>
                  <span className="list-row-side">
                    <strong>{rupees(order.pricing?.total)}</strong>
                    <StatusPill status={order.status} />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted-line">No orders yet — when you place one it will show up here.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Saved addresses</h3>
          </div>
          {user.addresses?.length ? (
            <div className="list-rows">
              {user.addresses.map((address) => (
                <div key={address.id} className="list-row static">
                  <span className="list-row-main">
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
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-line">No addresses saved yet — you can add one at checkout.</p>
          )}
        </section>
      </div>

      <section className="panel account-more">
        <div className="panel-head">
          <h3>More</h3>
        </div>
        <div className="list-rows">
          <Link href="/account/edit" className="list-row">
            <span className="list-row-main">
              <strong>Edit profile</strong>
              <span>Update your name and email</span>
            </span>
          </Link>
          <Link href="/account/refer" className="list-row">
            <span className="list-row-main">
              <strong>Refer &amp; earn</strong>
              <span>Your code, rewards, and use a friend&apos;s code</span>
            </span>
          </Link>
          <Link href="/help" className="list-row">
            <span className="list-row-main">
              <strong>Help &amp; support</strong>
              <span>Raise a request or follow up on one</span>
            </span>
          </Link>
          <Link href="/terms" className="list-row">
            <span className="list-row-main">
              <strong>Terms &amp; Conditions</strong>
            </span>
          </Link>
        </div>
      </section>
      </div>
    </div>
  );
}
