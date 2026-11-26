// require("dotenv").config();
import "dotenv/config";

export default {
  expo: {
    // The name under the icon on the phone. The scheme and the iOS/Android
    // IDs below are permanent once the app is in a store.
    name: "Hosur Basket",
    slug: "commerce-customer-app",
    // The Expo account that owns the EAS project below (same account as the
    // delivery app). The project used to point at another person's account,
    // which made every `eas build` fail with "Entity not authorized".
    owner: "baranidharansm098",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    scheme: "hosurbasket",

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
      bundleIdentifier: "com.hosurbasket.customer",
    },

    android: {
      package: "com.hosurbasket.customer",
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
      // @baranidharansm098/commerce-customer-app on expo.dev
      eas: { projectId: "b9efc147-1c4f-4463-b5e0-2587129e4e0b" },
    },
  },
};
