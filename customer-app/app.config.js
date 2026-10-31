// require("dotenv").config();
import "dotenv/config";

export default {
  expo: {
    // The name under the icon on the phone. The scheme and the iOS/Android
    // IDs below still say "samagramart" on purpose: an ID is permanent once
    // the app is in a store, and changing it ships a separate app.
    name: "Hosur Basket",
    slug: "commerce-customer-app",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    scheme: "samagramart",

    // SDK 58 wants these listed ("expo install --fix" could not add them to a
    // dynamic config on its own).
    plugins: ["expo-font", "expo-status-bar"],
    icon: "./assets/icon.png",

    splash: {
      image: "./assets/splash-icon.png",
      backgroundColor: "#FFFDF6",
      resizeMode: "contain",
    },

    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.samagramart.customer",
    },

    android: {
      package: "com.samagramart.customer",
      adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#FFFDF6" },
    },

    web: {
      bundler: "metro",
      favicon: "./assets/favicon.png",
    },

    extra: {
      // Read by src/api/client.js. Set API_BASE_URL in .env — on a physical
      // device this has to be your machine's LAN IP, not localhost.
      apiBaseUrl: process.env.API_BASE_URL,
      // Website used for shared product links (src/components/ShareRow.js).
      webBaseUrl: process.env.WEB_BASE_URL,
      eas: { projectId: "7eb234bb-513d-4593-b9ed-7e9697189a13" },
    },
  },
};
