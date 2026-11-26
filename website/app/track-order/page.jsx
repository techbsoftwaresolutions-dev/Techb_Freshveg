"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { CLOSED_STATUSES } from "@/lib/orderStatus";
import OrderCard, { OrderSkeletons } from "@/components/OrderCard";
import EmptyHero from "@/components/EmptyHero";


export default function TrackOrderPage() {
  const router = useRouter();
  const { ready, signedIn } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/track-order");
  }, [ready, signedIn, router]);

  useEffect(() => {
    if (!signedIn) return;
    api
      .get("/orders/mine", { limit: 30 })
      .then((data) => setOrders(data.items || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [signedIn]);

  const waiting = !ready || loading;
  const list = orders.filter((order) => !CLOSED_STATUSES.includes(order.status));

  return (
    <div className="wrap orders-page">
      <div className="cat-mobile-head">
        <Link href="/account" aria-label="Back" className="cat-mobile-btn">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="cat-mobile-title">Track your order</h1>
      </div>

      {waiting ? (
        <OrderSkeletons />
      ) : !list.length ? (
        <EmptyHero before="No active" word="orders" after="to track" text="When you place an order you can follow it here, step by step." cta="See my orders" href="/orders" />
      ) : (
        <>
          <header className="page-title orders-title">
            <h1>Track your order</h1>
            <p>Orders on their way. Open one to see where it is, live.</p>
          </header>

          <div className="order-list">
            {list.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
          <p className="orders-count">
            <Link href="/orders">See all my orders</Link>
          </p>
        </>
      )}
    </div>
  );
}
