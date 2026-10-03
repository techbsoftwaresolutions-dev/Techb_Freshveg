import React from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";

import { AuthProvider } from "./src/context/AuthContext";
import { StoreProvider } from "./src/context/StoreContext";
import { CartProvider } from "./src/context/CartContext";
import { WishlistProvider } from "./src/context/WishlistContext";
import RootNavigator from "./src/navigation/RootNavigator";

// Android lets a person pick a decorative/script system font in Settings ->
// Display, and most Text in this app has no fontFamily of its own, so it
// falls back to whatever that setting is. That's been the root cause of a
// string of small layout bugs (clipped pills, badges wrapping, oversized
// line-heights) that only showed up on a phone with that setting changed.
// Loading our own font here and naming it in the shared theme (see
// theme/index.js's `type` scale, and components/ui.js's Pill) means the app
// renders the same regardless of the phone's own font setting. Block first
// render on the font load so there's no flash of the wrong font.
export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color="#16A34A" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StoreProvider>
          <CartProvider>
            <WishlistProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </WishlistProvider>
          </CartProvider>
        </StoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
