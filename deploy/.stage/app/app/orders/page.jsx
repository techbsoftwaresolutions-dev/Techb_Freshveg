"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import OrderCard, { OrderSkeletons, OrdersEmpty } from "@/components/OrderCard";

// The order list only lists. Opening an order, tracking it and everything else
// about one stays on the order's own page.
export default function OrdersPage() {
  const router = useRouter();
  const { ready, signedIn } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/orders");
  }, [ready, signedIn, router]);

  useEffect(() => {
    if (!signedIn) return;
    api
      .get("/orders/mine", { limit: 30 })
      .then((data) => setOrders(data.items))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [signedIn]);

  const waiting = !ready || loading;
  const count = `${orders.length} order${orders.length === 1 ? "" : "s"}`;

  return (
    <div className="wrap orders-page">
      {/* Phone: a compact app header in place of the site's (the header, its
          category bar and the footer step aside on this page — see CSS). */}
      <div className="cat-mobile-head">
        <Link href="/account" aria-label="Back" className="cat-mobile-btn">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="cat-mobile-title">My Orders</h1>
      </div>

      {waiting ? (
        <OrderSkeletons />
      ) : !orders.length ? (
        <OrdersEmpty />
      ) : (
        <>
          <header className="page-title orders-title">
            <h1>My Orders</h1>
            <p>{count}</p>
          </header>
          <p className="orders-count">{count}</p>

          <div className="order-list">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
