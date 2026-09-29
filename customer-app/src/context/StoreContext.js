import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";

const StoreContext = createContext(null);
const PINCODE_KEY = "commerce.pincode";

// Which store is serving this shopper. Everything price- and stock-related
// hangs off it, so it is resolved once at launch and passed down rather than
// re-derived on every screen.
export function StoreProvider({ children }) {
  const [pincode, setPincodeState] = useState(null);
  const [store, setStore] = useState(null);
  const [serviceable, setServiceable] = useState(null); // null = not asked yet
  const [checking, setChecking] = useState(true);

  const check = useCallback(async (code) => {
    setChecking(true);
    try {
      const data = await api.get("/storefront/serviceability", { pincode: code });
      setServiceable(data.serviceable);
      setStore(data.serviceable ? { ...data.store, ...data } : null);
      return data;
    } catch {
      setServiceable(false);
      return { serviceable: false };
    } finally {
      setChecking(false);
    }
  }, []);

  const setPincode = useCallback(
    async (code) => {
      setPincodeState(code);
      try {
        await AsyncStorage.setItem(PINCODE_KEY, code);
      } catch {
        // Not fatal — they will just be asked again next launch.
      }
      return check(code);
    },
    [check]
  );

  useEffect(() => {
    (async () => {
      let saved = null;
      try {
        saved = await AsyncStorage.getItem(PINCODE_KEY);
      } catch {
        saved = null;
      }

      if (saved) {
        setPincodeState(saved);
        await check(saved);
        return;
      }

      // No pincode chosen yet: fall back to the default store so the app has
      // something to show rather than opening on an empty gate.
      try {
        const { stores } = await api.get("/stores/public");
        if (stores?.length) {
          setStore(stores[0]);
          setPincodeState(stores[0].address?.pincode || null);
        }
      } catch {
        // Leave store null; screens render their offline state.
      } finally {
        setChecking(false);
      }
    })();
  }, [check]);

  const value = useMemo(
    () => ({ pincode, store, storeId: store?.id || null, serviceable, checking, setPincode, check }),
    [pincode, store, serviceable, checking, setPincode, check]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside <StoreProvider>");
  return context;
}
