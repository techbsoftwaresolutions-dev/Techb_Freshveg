"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth, useWishlist } from "./Providers";

// The heart on a product card — wired to the wishlist API that already
// existed on the backend (add / remove / list) but had no storefront UI
// before this. Signed out, it sends the shopper to log in rather than
// pretending to save anything.
export default function WishlistButton({ productId, variantId }) {
  const { signedIn } = useAuth();
  const wishlist = useWishlist();
  const router = useRouter();
  const pathname = usePathname();

  const saved = wishlist.has(productId);
  const busy = Boolean(wishlist.pending[productId]);

  return (
    <button
      type="button"
      className={`wishlist-btn${saved ? " saved" : ""}`}
      aria-label={saved ? "Remove from your list" : "Save to your list"}
      aria-pressed={saved}
      disabled={busy}
      onClick={(event) => {
        // The button sits inside the card's own Link — without this the
        // click would also navigate to the product page underneath it.
        event.preventDefault();
        event.stopPropagation();
        if (!signedIn) {
          router.push(`/login?next=${encodeURIComponent(pathname || "/")}`);
          return;
        }
        wishlist.toggle(productId, variantId).catch(() => {});
      }}
    >
      <IconHeart filled={saved} />
    </button>
  );
}

function IconHeart({ filled }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="17"
      height="17"
      aria-hidden="true"
    >
      <path d="M12 20.5s-7.5-4.6-10-9.3C.6 8 1.8 4.5 5 3.4c2.1-.7 4.2 0 5.6 1.8l1.4 1.8 1.4-1.8c1.4-1.8 3.5-2.5 5.6-1.8 3.2 1.1 4.4 4.6 3 7.8-2.5 4.7-10 9.3-10 9.3Z" />
    </svg>
  );
}
