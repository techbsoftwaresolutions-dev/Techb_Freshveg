require("dotenv").config();

export default {
  expo: {
    name: "Samagra Mart",
    slug: "commerce-customer-app",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    scheme: "samagramart",

    splash: {
      backgroundColor: "#16A34A",
      resizeMode: "contain",
    },

    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.samagramart.customer",
    },

    android: {
      package: "com.samagramart.customer",
      adaptiveIcon: { backgroundColor: "#16A34A" },
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
