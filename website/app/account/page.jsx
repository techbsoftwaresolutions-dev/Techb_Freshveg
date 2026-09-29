"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useStore } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees, when } from "@/lib/format";
import StatusPill from "@/components/StatusPill";

export default function AccountPage() {
  const router = useRouter();
  const { user, ready, signedIn, signOut } = useAuth();
  const { store, pincode } = useStore();

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/account");
  }, [ready, signedIn, router]);

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
      <div className="wrap">
        <div className="page-loading">Loading your account…</div>
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

  return (
    <div className="wrap">
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
        </div>
        <button
          type="button"
          className="btn sm account-signout"
          onClick={() => {
            signOut();
            router.push("/");
          }}
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
            <strong className="stat-code">{user.referralCode}</strong>
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
    </div>
  );
}
