"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { MorphingSquare } from "@/components/ui/morphing-square";
import { useAuth, useWishlist } from "@/components/Providers";
import ProductCard from "@/components/ProductCard";
import EmptyState from "@/components/EmptyState";
import BackLink from "@/components/BackLink";

// Everything the shopper hearted, as the same cards the shop uses — so the
// heart takes an item off this page and "Add" puts it in the cart. The list is
// the one Providers already keeps (GET /wishlist), refreshed after each toggle.
export default function WishlistPage() {
  const router = useRouter();
  const { ready, signedIn } = useAuth();
  const wishlist = useWishlist();

  useEffect(() => {
    if (ready && !signedIn) router.replace("/login?next=/account/wishlist");
  }, [ready, signedIn, router]);

  if (!signedIn || !wishlist.ready) {
    return (
      <div className="wrap">
        <div className="page-loading"><MorphingSquare message="Loading your wishlist…" /></div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header className="page-title has-back">
        <BackLink />
        <h1>Your wishlist</h1>
        {wishlist.count ? (
          <p>
            {wishlist.count} saved item{wishlist.count === 1 ? "" : "s"}
          </p>
        ) : null}
      </header>

      {wishlist.count ? (
        <div className="product-grid">
          {wishlist.items.map((item) => (
            // The wishlist API has no pack label; the saved variant's name ("1 kg") is one.
            <ProductCard key={item.id} product={{ ...item.product, packLabel: item.variant?.name }} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="heart"
          title="Your wishlist is empty"
          actions={[{ href: "/", label: "Start shopping" }]}
        >
          Tap the heart on any product to save it here for later.
        </EmptyState>
      )}
    </div>
  );
}
