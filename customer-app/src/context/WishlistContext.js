import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const WishlistContext = createContext(null);
const GUEST_KEY = "commerce.guestWishlist";

async function loadGuestIds() {
  try {
    const raw = await AsyncStorage.getItem(GUEST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveGuestIds(ids) {
  try {
    await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(ids));
  } catch {
    // Not fatal — it just won't survive a relaunch.
  }
}

// Saved items follow the account when signed in — the server is the source
// of truth, same as the cart. A guest's taps are kept on-device instead of
// thrown away, and merge into the account the moment they sign in, mirroring
// how CartContext merges a guest cart on sign-in.
export function WishlistProvider({ children }) {
  const { signedIn } = useAuth();
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const mergedOnce = useRef(false);

  const loadAccountWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get("/wishlist");
      setSavedIds(new Set((data.items || []).map((item) => String(item.product.id))));
    } catch {
      // Leave whatever was already there — a failed refresh shouldn't blank
      // out a list the shopper can already see on screen.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (signedIn) {
      (async () => {
        if (!mergedOnce.current) {
          mergedOnce.current = true;
          const guestIds = await loadGuestIds();
          if (guestIds.length) {
            await Promise.all(
              guestIds.map((id) => api.post("/wishlist", { product: id }).catch(() => {}))
            );
            await saveGuestIds([]);
          }
        }
        loadAccountWishlist();
      })();
    } else {
      mergedOnce.current = false;
      loadGuestIds().then((ids) => setSavedIds(new Set(ids)));
    }
  }, [signedIn, loadAccountWishlist]);

  const toggle = useCallback(
    async (productId, variantId) => {
      if (!productId) return;
      const id = String(productId);
      const wasSaved = savedIds.has(id);

      // Optimistic — a bookmark that waits on a round trip to fill in feels
      // broken, same call CartContext makes for the quantity stepper.
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.delete(id);
        else next.add(id);
        return next;
      });

      if (signedIn) {
        try {
          if (wasSaved) await api.del(`/wishlist/${id}`);
          else await api.post("/wishlist", { product: id, variant: variantId });
        } catch {
          // Revert — the server didn't agree with the optimistic flip.
          setSavedIds((current) => {
            const next = new Set(current);
            if (wasSaved) next.add(id);
            else next.delete(id);
            return next;
          });
        }
      } else {
        const next = wasSaved ? [...savedIds].filter((x) => x !== id) : [...savedIds, id];
        await saveGuestIds(next);
      }
    },
    [savedIds, signedIn]
  );

  const isSaved = useCallback((productId) => savedIds.has(String(productId)), [savedIds]);

  const value = useMemo(
    () => ({ savedIds, isSaved, toggle, loading, refresh: loadAccountWishlist }),
    [savedIds, isSaved, toggle, loading, loadAccountWishlist]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return context;
}
