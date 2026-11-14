"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { CLOSED_STATUSES } from "@/lib/orderStatus";
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
      .get("/orders/mine", { limit: 30 })
      .then((data) => setOrders(data.items || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [signedIn]);

  const waiting = !ready || loading;
  const list = orders.filter((order) => ["DELIVERED", "REFUNDED"].includes(order.status) || /RETURN|REFUND/.test(order.status));

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

      {waiting ? (
        <OrderSkeletons />
      ) : !list.length ? (
        <EmptyHero before="No" word="returns" after="to show" text="Delivered orders appear here. Open one to raise a return." cta="See my orders" href="/orders" />
      ) : (
        <>
          <header className="page-title orders-title">
            <h1>Returns & refunds</h1>
            <p>Open a delivered order to raise a return or see its refund.</p>
          </header>
          <section className="panel returns-note">
            <h2>How returns work</h2>
            <p>
              Fresh produce, dairy and bakery items can&apos;t be returned once delivered, unless the item arrived damaged, expired or
              different from what you ordered — tell us within 24 hours of delivery. Approved refunds go back to your original payment
              method or wallet. See the <Link href="/terms">terms</Link> for details.
            </p>
          </section>

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
