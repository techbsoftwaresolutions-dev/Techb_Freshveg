import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import { useStore } from "./StoreContext";

const CartContext = createContext(null);

// The cart lives on the server, so it survives a reinstall and follows the
// shopper between the app and the website. This context is a thin cache over
// it plus optimistic quantity updates, because a stepper that waits for a
// round trip feels broken.
export function CartProvider({ children }) {
  const { signedIn } = useAuth();
  const { storeId } = useStore();

  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Variant ids with a request in flight, so a card can show a spinner on just
  // its own stepper.
  const [pending, setPending] = useState({});

  const mergedFor = useRef(null);

  const apply = useCallback((response) => {
    setCart(response.cart);
    setError("");
    return response.cart;
  }, []);

  const refresh = useCallback(async () => {
    if (!storeId) return null;
    setLoading(true);
    try {
      return apply(await api.get("/cart", { store: storeId }));
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [storeId, apply]);

  useEffect(() => {
    if (storeId) refresh();
  }, [storeId, refresh]);

  // Signing in merges whatever the guest had into the account's cart. Guarded
  // so it runs once per sign-in, not on every render.
  useEffect(() => {
    if (!signedIn || !storeId) return;
    if (mergedFor.current === storeId) return;
    mergedFor.current = storeId;

    api
      .post("/cart/merge", { store: storeId })
      .then(apply)
      .catch(() => refresh());
  }, [signedIn, storeId, apply, refresh]);

  const withPending = useCallback(async (variantId, work) => {
    setPending((p) => ({ ...p, [variantId]: true }));
    try {
      return await work();
    } catch (err) {
      setError(err.message);
      // Re-read rather than guessing: the failure was probably "only 2 left",
      // and the server knows the real quantity.
      await refresh();
      throw err;
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[variantId];
        return next;
      });
    }
  }, [refresh]);

  const add = useCallback(
    (variantId, quantity) =>
      withPending(variantId, async () =>
        apply(await api.post("/cart/items", { variant: variantId, quantity, store: storeId }))
      ),
    [withPending, apply, storeId]
  );

  const setQuantity = useCallback(
    (variantId, quantity) =>
      withPending(variantId, async () =>
        apply(await api.patch(`/cart/items/${variantId}`, { quantity, store: storeId }))
      ),
    [withPending, apply, storeId]
  );

  const remove = useCallback(
    (variantId) =>
      withPending(variantId, async () =>
        apply(await api.del(`/cart/items/${variantId}`, { store: storeId }))
      ),
    [withPending, apply, storeId]
  );

  const applyCoupon = useCallback(
    async (code) => apply(await api.post("/cart/coupon", { code, store: storeId })),
    [apply, storeId]
  );

  // With a code, only that coupon comes off (an offer code or a reward
  // coupon); without, both do.
  const removeCoupon = useCallback(
    async (code) => apply(await api.del("/cart/coupon", { store: storeId, ...(code ? { code } : {}) })),
    [apply, storeId]
  );

  // A reward coupon from My coupons, by id. The API prices it and refuses an
  // unusable one with the reason.
  const applyRewardCoupon = useCallback(
    async (couponId) => apply(await api.post("/cart/reward-coupon", { coupon: couponId, store: storeId })),
    [apply, storeId]
  );

  const setCredits = useCallback(
    async (credits) => apply(await api.post("/cart/credits", { ...credits, store: storeId })),
    [apply, storeId]
  );

  const clear = useCallback(async () => apply(await api.del("/cart", { store: storeId })), [apply, storeId]);

  // How many of a given variant are in the cart — what a product card's
  // stepper reads to decide between "ADD" and a quantity control.
  const quantityOf = useCallback(
    (variantId) => cart?.items?.find((i) => String(i.variant) === String(variantId))?.quantity || 0,
    [cart]
  );

  const value = useMemo(
    () => ({
      cart,
      summary: cart?.summary || null,
      items: cart?.items || [],
      unavailable: cart?.unavailable || [],
      offers: cart?.offers || { applied: [], rejected: [] },
      count: cart?.summary?.unitCount || 0,
      lineCount: cart?.items?.length || 0,
      loading,
      error,
      pending,
      refresh,
      add,
      setQuantity,
      remove,
      applyCoupon,
      removeCoupon,
      applyRewardCoupon,
      setCredits,
      clear,
      quantityOf,
      setCart,
    }),
    [cart, loading, error, pending, refresh, add, setQuantity, remove, applyCoupon, removeCoupon, applyRewardCoupon, setCredits, clear, quantityOf]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}
