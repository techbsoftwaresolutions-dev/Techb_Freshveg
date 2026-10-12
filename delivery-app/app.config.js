require("dotenv").config();

export default {
  expo: {
    // The name under the icon. The scheme and app IDs below are left as they
    // are — an ID is permanent once published.
    name: "Hosur Basket Partner",
    slug: "commerce-delivery-app",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    scheme: "samagrapartner",
    splash: { backgroundColor: "#1D3A8A", resizeMode: "contain" },
    ios: { supportsTablet: false, bundleIdentifier: "com.samagramart.partner" },
    android: { package: "com.samagramart.partner", adaptiveIcon: { backgroundColor: "#1D3A8A" } },
    web: { bundler: "metro" },
    extra: {
      apiBaseUrl: process.env.API_BASE_URL,
    },
  },
};
