"use client";

import Link from "next/link";
import { useWishlist } from "./Providers";
import Carousel from "./Carousel";
import ProductCard from "./ProductCard";

// "Your wishlist" row on the home page: the products the signed-in shopper has
// hearted. Nothing is rendered for guests or when the list is empty.
export default function HomeWishlist() {
  const wishlist = useWishlist();
  const items = wishlist?.items || [];
  if (!items.length) return null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Your Wishlist</h2>
        <Link href="/wishlist" className="section-link">
          View All
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
      <Carousel label="Your wishlist">
        {items.map((item) => (
          <ProductCard key={item.id} product={item.product} />
        ))}
      </Carousel>
    </section>
  );
}
