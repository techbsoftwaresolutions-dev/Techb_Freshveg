"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, loadSession, saveSession } from "@/lib/client-api";

const AuthContext = createContext(null);
const CartContext = createContext(null);
const StoreContext = createContext(null);
const WishlistContext = createContext(null);

const PINCODE_KEY = "commerce.web.pincode";

export function Providers({ children }) {
  // --- store / delivery location ---------------------------------------
  const [store, setStore] = useState(null);
  const [pincode, setPincodeState] = useState(null);
  const [storeReady, setStoreReady] = useState(false);

  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(PINCODE_KEY);
    } catch {
      saved = null;
    }

    (async () => {
      if (saved) {
        try {
          const data = await api.get("/storefront/serviceability", { pincode: saved });
          if (data.serviceable) {
            setPincodeState(saved);
            setStore({ ...data.store, ...data });
            setStoreReady(true);
            return;
          }
        } catch {
          // fall through to the default store
        }
      }
      try {
        const { stores } = await api.get("/stores/public");
        if (stores?.length) setStore(stores[0]);
      } catch {
        // Leave store null; the cart simply has nowhere to price against yet.
      } finally {
        setStoreReady(true);
      }
    })();
  }, []);

  const setPincode = useCallback(async (code) => {
    const data = await api.get("/storefront/serviceability", { pincode: code });
    if (data.serviceable) {
      setPincodeState(code);
      setStore({ ...data.store, ...data });
      try {
        localStorage.setItem(PINCODE_KEY, code);
      } catch {
        // Not fatal — they will be asked again next visit.
      }
    }
    return data;
  }, []);

  // --- auth -------------------------------------------------------------
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (!session?.accessToken) {
      setAuthReady(true);
      return;
    }
    api
      .get("/auth/me")
      .then(({ user: fresh }) => setUser(fresh))
      .catch(() => saveSession(null))
      .finally(() => setAuthReady(true));
  }, []);

  const requestOtp = useCallback((phone) => api.post("/auth/otp/request", { phone }), []);

  const verifyOtp = useCallback(async (phone, code, name) => {
    const data = await api.post("/auth/otp/verify", { phone, code, name });
    saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(data.user);
    return data;
  }, []);

  const signOut = useCallback(() => {
    saveSession(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user: fresh } = await api.get("/auth/me");
      setUser(fresh);
      return fresh;
    } catch {
      return null;
    }
  }, []);

  // --- cart -------------------------------------------------------------
  const [cart, setCart] = useState(null);
  const [pending, setPending] = useState({});
  const [cartError, setCartError] = useState("");
  const storeId = store?.id || null;

  const refreshCart = useCallback(async () => {
    if (!storeId) return null;
    try {
      const data = await api.get("/cart", { store: storeId });
      setCart(data.cart);
      setCartError("");
      return data.cart;
    } catch (err) {
      setCartError(err.message);
      return null;
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId) refreshCart();
  }, [storeId, refreshCart]);

  // Signing in folds the anonymous cart into the account's.
  useEffect(() => {
    if (!user || !storeId) return;
    api
      .post("/cart/merge", { store: storeId })
      .then((data) => setCart(data.cart))
      .catch(() => refreshCart());
  }, [user, storeId, refreshCart]);

  const run = useCallback(
    async (variantId, work) => {
      setPending((p) => ({ ...p, [variantId]: true }));
      try {
        const data = await work();
        setCart(data.cart);
        setCartError("");
        return data.cart;
      } catch (err) {
        setCartError(err.message);
        // The server knows the real quantity — "only 2 left" is the usual
        // cause, so re-read rather than guessing.
        await refreshCart();
        throw err;
      } finally {
        setPending((p) => {
          const next = { ...p };
          delete next[variantId];
          return next;
        });
      }
    },
    [refreshCart]
  );

  const cartApi = useMemo(
    () => ({
      cart,
      items: cart?.items || [],
      summary: cart?.summary || null,
      offers: cart?.offers || { applied: [], rejected: [] },
      unavailable: cart?.unavailable || [],
      count: cart?.summary?.unitCount || 0,
      lineCount: cart?.items?.length || 0,
      error: cartError,
      pending,
      refresh: refreshCart,
      add: (variantId, quantity) =>
        run(variantId, () => api.post("/cart/items", { variant: variantId, quantity, store: storeId })),
      setQuantity: (variantId, quantity) =>
        run(variantId, () => api.patch(`/cart/items/${variantId}`, { quantity, store: storeId })),
      remove: (variantId) => run(variantId, () => api.del(`/cart/items/${variantId}`, { store: storeId })),
      applyCoupon: async (code) => {
        const data = await api.post("/cart/coupon", { code, store: storeId });
        setCart(data.cart);
        return data.cart;
      },
      removeCoupon: async () => {
        const data = await api.del("/cart/coupon", { store: storeId });
        setCart(data.cart);
        return data.cart;
      },
      quantityOf: (variantId) =>
        cart?.items?.find((i) => String(i.variant) === String(variantId))?.quantity || 0,
      lineFor: (variantId) => cart?.items?.find((i) => String(i.variant) === String(variantId)) || null,
    }),
    [cart, cartError, pending, refreshCart, run, storeId]
  );


  // --- wishlist -----------------------------------------------------------
  // A real, already-built backend feature (see backend/src/modules/wishlist)
  // that simply had no UI on the storefront yet — this wires it up rather
  // than faking a heart icon that does nothing. Sign-in is required
  // server-side, so a guest's toggle just sends them to log in.
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistPending, setWishlistPending] = useState({});
  const [wishlistReady, setWishlistReady] = useState(false);

  const refreshWishlist = useCallback(async () => {
    if (!user) {
      setWishlistItems([]);
      setWishlistReady(true);
      return;
    }
    try {
      const data = await api.get("/wishlist");
      setWishlistItems(data.items || []);
    } catch {
      // Leave whatever was last known — a saved heart disappearing on a
      // flaky request is worse than it being briefly stale.
    } finally {
      setWishlistReady(true);
    }
  }, [user]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  const wishlistApi = useMemo(() => {
    const savedIds = new Set(wishlistItems.map((i) => i.product.id));
    return {
      ready: wishlistReady,
      items: wishlistItems,
      count: wishlistItems.length,
      pending: wishlistPending,
      has: (productId) => savedIds.has(productId),
      toggle: async (productId, variantId) => {
        if (!user) return { needsSignIn: true, saved: false };
        setWishlistPending((p) => ({ ...p, [productId]: true }));
        try {
          if (savedIds.has(productId)) {
            await api.del(`/wishlist/${productId}`);
          } else {
            await api.post("/wishlist", { product: productId, variant: variantId || undefined });
          }
          await refreshWishlist();
          return { needsSignIn: false, saved: !savedIds.has(productId) };
        } finally {
          setWishlistPending((p) => {
            const next = { ...p };
            delete next[productId];
            return next;
          });
        }
      },
    };
  }, [wishlistItems, wishlistPending, wishlistReady, user, refreshWishlist]);

  const auth = useMemo(
    () => ({ user, ready: authReady, signedIn: Boolean(user), requestOtp, verifyOtp, signOut, refreshUser }),
    [user, authReady, requestOtp, verifyOtp, signOut, refreshUser]
  );

  const storeValue = useMemo(
    () => ({ store, storeId, pincode, ready: storeReady, setPincode }),
    [store, storeId, pincode, storeReady, setPincode]
  );

  return (
    <AuthContext.Provider value={auth}>
      <StoreContext.Provider value={storeValue}>
        <CartContext.Provider value={cartApi}>
          <WishlistContext.Provider value={wishlistApi}>{children}</WishlistContext.Provider>
        </CartContext.Provider>
      </StoreContext.Provider>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export const useCart = () => useContext(CartContext);
export const useStore = () => useContext(StoreContext);
export const useWishlist = () => useContext(WishlistContext);
