// Expo's CLI loads .env (and .env.local) into process.env before reading
// this file, in development and in EAS builds alike — no dotenv needed.

export default {
  expo: {
    // The name under the icon on the phone. The scheme and the iOS/Android
    // IDs below still say "samagramart" on purpose: an ID is permanent once
    // the app is in a store, and changing it ships a separate app.
    name: "The Farmers Basket",
    slug: "commerce-customer-app",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    scheme: "samagramart",

    icon: "./assets/icon.png",

    splash: {
      image: "./assets/splash.png",
      backgroundColor: "#FBF9EF",
      resizeMode: "contain",
    },

    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.samagramart.customer",
    },

    android: {
      package: "com.samagramart.customer",
      adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#295110" },
    },

    web: {
      bundler: "metro",
    },

    extra: {
      // Read by src/api/client.js. Set API_BASE_URL in .env — on a physical
      // device this has to be your machine's LAN IP, not localhost.
      apiBaseUrl: process.env.API_BASE_URL,
    },
  },
};
