"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth, useWishlist } from "@/components/Providers";
import EmptyHero from "@/components/EmptyHero";
import ProductCard from "@/components/ProductCard";

// Everything the shopper has hearted, shown as the same product cards used
// everywhere else. Removing a heart here takes the card off the page.
export default function WishlistPage() {
  const router = useRouter();
  const { ready, signedIn } = useAuth();
  const wishlist = useWishlist();

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/wishlist");
  }, [ready, signedIn, router]);

  const items = wishlist.items || [];
  const waiting = !ready || !wishlist.ready;
  const count = `${items.length} item${items.length === 1 ? "" : "s"}`;

  return (
    <div className="wrap wishlist-page">
      <div className="cat-mobile-head">
        <Link href="/account" aria-label="Back" className="cat-mobile-btn">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="cat-mobile-title">Your wishlist</h1>
      </div>

      {!waiting && items.length ? (
        <header className="page-title wishlist-title">
          <h1>Your wishlist</h1>
          <p>{count}</p>
        </header>
      ) : null}

      {waiting ? (
        <p className="wishlist-empty">Loading…</p>
      ) : !items.length ? (
        <EmptyHero before="Your" word="wishlist" after="is empty" />
      ) : (
        <div className="product-grid">
          {items.map((item) => (
            <ProductCard key={item.id} product={item.product} />
          ))}
        </div>
      )}
    </div>
  );
}
