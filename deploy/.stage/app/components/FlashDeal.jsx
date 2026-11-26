"use client";

import { useEffect, useState } from "react";
import Carousel from "./Carousel";
import ProductCard from "./ProductCard";

// The countdown is only as honest as the deadline behind it — deal.endsAt
// comes straight from an admin-set schedule.endsAt on a real Offer (see the
// /home route), so when the clock hits zero here it's actually over, and the
// section removes itself rather than freezing on 00:00:00.
function timeLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  return ms > 0 ? ms : 0;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function FlashDeal({ deal }) {
  const [remaining, setRemaining] = useState(() => timeLeft(deal.endsAt));

  useEffect(() => {
    const timer = setInterval(() => setRemaining(timeLeft(deal.endsAt)), 1000);
    return () => clearInterval(timer);
  }, [deal.endsAt]);

  if (remaining <= 0) return null;

  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2>Flash Deal</h2>
          <p>{deal.title}</p>
        </div>
        <span className="flash-timer" aria-live="polite">
          Ends in {formatDuration(remaining)}
        </span>
      </div>
      <Carousel label="Flash Deal">
        {deal.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </Carousel>
    </section>
  );
}
