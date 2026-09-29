"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import { api } from "@/lib/client-api";
import { rupees, when } from "@/lib/format";
import EmptyState from "@/components/EmptyState";
import StatusPill from "@/components/StatusPill";

const CLOSED = ["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"];

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

  if (!ready || loading) {
    return (
      <div className="wrap">
        <div className="page-loading">Loading your orders…</div>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="wrap">
        <EmptyState icon="box" title="No orders yet" actions={[{ href: "/", label: "Start shopping" }]}>
          When you place an order it will appear here with live tracking.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header className="page-title">
        <h1>My Orders</h1>
        <p>
          {orders.length} order{orders.length === 1 ? "" : "s"}
        </p>
      </header>

      <div className="order-list">
        {orders.map((order) => {
          const open = !CLOSED.includes(order.status);
          const shown = order.items.slice(0, 4);
          const more = order.items.length - shown.length;
          return (
            <Link key={order.id} href={`/orders/${order.id}`} className="panel order-card">
              <div className="order-card-top">
                <span className="order-card-id">
                  <strong className="tabular">{order.code}</strong>
                  <span>{when(order.placedAt)}</span>
                </span>
                <StatusPill status={order.status} />
              </div>

              <div className="order-card-body">
                <div className="order-thumbs">
                  {shown.map((item, index) => (
                    <span key={item.id || item.sku || index} className="order-thumb" title={item.name}>
                      {item.image ? <img src={item.image} alt="" /> : item.name?.[0]}
                    </span>
                  ))}
                  {more > 0 ? <span className="order-thumb more">+{more}</span> : null}
                </div>
                <span className="order-card-items">{order.items.map((item) => item.name).join(", ")}</span>
              </div>

              <div className="order-card-foot">
                <strong>{rupees(order.pricing?.total)}</strong>
                <span className="section-link">{open ? "Track order →" : "View details →"}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
