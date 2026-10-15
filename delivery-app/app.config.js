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
    icon: "./assets/icon.png",
    splash: { image: "./assets/splash-icon.png", backgroundColor: "#FFFDF6", resizeMode: "contain" },
    ios: { supportsTablet: false, bundleIdentifier: "com.samagramart.partner" },
    android: { package: "com.samagramart.partner", adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#FFFDF6" } },
    web: { bundler: "metro", favicon: "./assets/favicon.png" },
    plugins: [["expo-camera", { cameraPermission: "Hosur Basket Partner uses the camera to scan the customer's order QR." }]],
    extra: {
      apiBaseUrl: process.env.API_BASE_URL,
    },
  },
};
