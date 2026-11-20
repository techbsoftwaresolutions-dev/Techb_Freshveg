"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import OrderCard, { OrderSkeletons } from "@/components/OrderCard";
import EmptyHero from "@/components/EmptyHero";


export default function ReturnsPage() {
  const router = useRouter();
  const { ready, signedIn } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/returns");
  }, [ready, signedIn, router]);

  useEffect(() => {
    if (!signedIn) return;
    api
      .get("/orders/mine", { returns: "true", limit: 50 })
      .then((data) => setOrders(data.items || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [signedIn]);

  const waiting = !ready || loading;
  // Only orders with a return or refund (the server picks them out).
  const list = orders;

  return (
    <div className="wrap orders-page">
      <div className="cat-mobile-head">
        <Link href="/account" aria-label="Back" className="cat-mobile-btn">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="cat-mobile-title">Returns & refunds</h1>
      </div>

      <header className="page-title orders-title">
        <h1>Returns & refunds</h1>
        <p>Orders you have returned, and the money given back.</p>
      </header>

      <details className="panel returns-note returns-how">
        <summary>
          <span>How returns work</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <p>
          Fresh produce, dairy and bakery items can&apos;t be returned once delivered, unless the item arrived damaged, expired or
          different from what you ordered — tell us within 24 hours of delivery. To raise a return, open the delivered order from{" "}
          <Link href="/orders">My orders</Link>. Approved refunds go back to your original payment method or wallet. See the{" "}
          <Link href="/terms">terms</Link> for details.
        </p>
      </details>

      {waiting ? (
        <OrderSkeletons />
      ) : !list.length ? (
        <EmptyHero before="No" word="refunds" after="yet" text="Returned and refunded orders show up here. To return something, open a delivered order." cta="See my orders" href="/orders" />
      ) : (
        <>
          <div className="order-list">
            {list.map((order) => (
              <OrderCard key={order.id} order={order} returnAction />
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
