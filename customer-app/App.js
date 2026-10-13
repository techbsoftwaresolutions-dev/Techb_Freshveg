import React from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from "@expo-google-fonts/poppins";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";

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
// Loading our own fonts here (the website's Poppins and DM Serif Display) and
// routing every Text through components/Text.js means the app renders the
// same regardless of the phone's own font setting. Block first render on the
// font load so there's no flash of the wrong font.
export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    DMSerifDisplay_400Regular,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color="#1B7A3A" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StoreProvider>
          <CartProvider>
            <WishlistProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </WishlistProvider>
          </CartProvider>
        </StoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
