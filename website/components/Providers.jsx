"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, loadSession, saveSession } from "@/lib/client-api";

const AuthContext = createContext(null);
const CartContext = createContext(null);
const StoreContext = createContext(null);
const WishlistContext = createContext(null);

const PINCODE_KEY = "commerce.web.pincode";
// The place name the shopper picked for that pincode ("Sarjapura"), and the
// delivery area's id (Admin → Delivery Areas), which checkout sends with the order.
const AREA_KEY = "commerce.web.area";
const AREA_ID_KEY = "commerce.web.areaId";

const remember = (pairs) => {
  try {
    for (const [key, value] of pairs) {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    }
  } catch {
    // Not fatal — they will be asked again next visit.
  }
};

export function Providers({ children }) {
  // --- store / delivery location ---------------------------------------
  const [store, setStore] = useState(null);
  const [pincode, setPincodeState] = useState(null);
  const [area, setArea] = useState("");
  const [areaId, setAreaId] = useState("");
  // Shown in the location picker when a saved area has been switched off.
  const [locationNotice, setLocationNotice] = useState("");
  const [storeReady, setStoreReady] = useState(false);

  useEffect(() => {
    let saved = null;
    let savedArea = "";
    let savedAreaId = "";
    try {
      saved = localStorage.getItem(PINCODE_KEY);
      savedArea = localStorage.getItem(AREA_KEY) || "";
      savedAreaId = localStorage.getItem(AREA_ID_KEY) || "";
    } catch {
      saved = null;
    }

    (async () => {
      if (saved) {
        try {
          // Re-checked every visit: the shop may have stopped delivering
          // there since this shopper picked it.
          const data = await api.get("/storefront/serviceability", { pincode: saved, area: savedAreaId || undefined });
          if (data.serviceable) {
            // Picked before areas had ids: matched by the saved name.
            const picked =
              data.deliveryAreas?.find((a) => a.id === savedAreaId) ||
              data.deliveryAreas?.find((a) => a.name === savedArea) ||
              data.deliveryAreas?.[0];
            setPincodeState(saved);
            setArea(picked?.name || savedArea || data.areas?.[0] || "");
            setAreaId(picked?.id || "");
            setStore({ ...data.store, ...data });
            setStoreReady(true);
            return;
          }
          remember([[PINCODE_KEY, ""], [AREA_KEY, ""], [AREA_ID_KEY, ""]]);
          setLocationNotice(
            `We no longer deliver to ${savedArea || saved}. Please choose another location.`
          );
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

  // areaName: the place picked from the list; a typed pincode takes the
  // first place the shop has named for it.
  // pickedAreaId: the delivery area chosen from the list (else the first the
  // shop has for that pincode).
  const setPincode = useCallback(async (code, areaName, pickedAreaId) => {
    const data = await api.get("/storefront/serviceability", { pincode: code });
    if (data.serviceable) {
      const picked = data.deliveryAreas?.find((a) => a.id === pickedAreaId) || data.deliveryAreas?.[0];
      const name = areaName || picked?.name || data.areas?.[0] || "";
      setPincodeState(code);
      setArea(name);
      setAreaId(picked?.id || "");
      setLocationNotice("");
      setStore({ ...data.store, ...data });
      remember([[PINCODE_KEY, code], [AREA_KEY, name], [AREA_ID_KEY, picked?.id || ""]]);
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
  const [soldOut, setSoldOut] = useState({}); // variantId -> true, learnt from a refused add
  const storeId = store?.id || null;
  useEffect(() => setSoldOut({}), [storeId]);

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

  // Cart changes go to the server one after another. Each response carries
  // the whole cart, so if two were in flight together the older reply could
  // land last and wipe out the newer item. Queued, the last reply is always
  // the newest cart. (The API also handles one change per cart at a time.)
  const queue = useRef(Promise.resolve());

  const run = useCallback(
    (variantId, work) => {
      setPending((p) => ({ ...p, [variantId]: true }));
      const job = queue.current.then(async () => {
        try {
          const data = await work();
          setCart(data.cart);
          setCartError("");
          return data.cart;
        } catch (err) {
          // The server knows the real quantity — "only 2 left" is the usual
          // cause, so re-read rather than guessing. The message is set after
          // the re-read, which would otherwise clear it.
          await refreshCart();
          // None left at all (sold since the page was drawn, or a different
          // store from the one the page was drawn for): the card turns into
          // "Out of stock" instead of saying so in a message.
          if (err.status === 409 && !err.details?.available) setSoldOut((s) => ({ ...s, [variantId]: true }));
          else setCartError(err.message);
          throw err;
        }
      });
      queue.current = job.catch(() => {});
      return job.finally(() => {
        setPending((p) => {
          const next = { ...p };
          delete next[variantId];
          return next;
        });
      });
    },
    [refreshCart]
  );

  // A failed change (out of stock, limit reached) is said once, briefly,
  // wherever the tap happened — the cart itself has already been re-read.
  useEffect(() => {
    if (!cartError) return undefined;
    const timer = setTimeout(() => setCartError(""), 4000);
    return () => clearTimeout(timer);
  }, [cartError]);

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
      soldOut,
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
    [cart, cartError, pending, soldOut, refreshCart, run, storeId]
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
    () => ({ store, storeId, pincode, area, areaId, locationNotice, ready: storeReady, setPincode }),
    [store, storeId, pincode, area, areaId, locationNotice, storeReady, setPincode]
  );

  return (
    <AuthContext.Provider value={auth}>
      <StoreContext.Provider value={storeValue}>
        <CartContext.Provider value={cartApi}>
          <WishlistContext.Provider value={wishlistApi}>
            {children}
            {cartError ? (
              <div className="cart-toast" role="alert">
                {cartError}
              </div>
            ) : null}
          </WishlistContext.Provider>
        </CartContext.Provider>
      </StoreContext.Provider>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export const useCart = () => useContext(CartContext);
export const useStore = () => useContext(StoreContext);
export const useWishlist = () => useContext(WishlistContext);
