import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "./src/context/AuthContext";
import { StoreProvider } from "./src/context/StoreContext";
import { CartProvider } from "./src/context/CartContext";
import RootNavigator from "./src/navigation/RootNavigator";

// Provider order matters: the cart needs to know who is signed in (to merge a
// guest cart) and which store is serving them (stock and prices are per store).
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StoreProvider>
          <CartProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </CartProvider>
        </StoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
