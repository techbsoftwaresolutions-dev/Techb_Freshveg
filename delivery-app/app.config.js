require("dotenv").config();
const { existsSync } = require("node:fs");
const { join } = require("node:path");

const googleServicesFile = join(__dirname, "google-services.json");
if (!existsSync(googleServicesFile)) {
  console.warn("[delivery-app] google-services.json is missing; Android push notifications cannot register.");
}

export default {
  expo: {
    // The name under the icon. The scheme and app IDs below are left as they
    // are — an ID is permanent once published.
    name: "Hosur Basket Partner",
    slug: "commerce-delivery-app",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    scheme: "hosurpartner",
    icon: "./assets/icon.png",
    splash: { image: "./assets/splash-icon.png", backgroundColor: "#FFFDF6", resizeMode: "contain" },
    ios: { supportsTablet: false, bundleIdentifier: "com.hosurbasket.partner" },
    android: {
      package: "com.hosurbasket.partner",
      adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#FFFDF6" },
      ...(existsSync(googleServicesFile) ? { googleServicesFile: "./google-services.json" } : {}),
    },
    web: { bundler: "metro", favicon: "./assets/favicon.png" },
    updates: {
      enabled: false,
      checkAutomatically: "NEVER",
    },
    plugins: [
      ["expo-notifications", { defaultChannel: "delivery_assignments_v2" }],
      ["expo-camera", { cameraPermission: "Hosur Basket Partner uses the camera to take a delivery photo." }],
    ],
    extra: {
      apiBaseUrl: process.env.API_BASE_URL,
      eas: {
        projectId: "15f3e6b1-3d41-411b-8428-e567f71383e9",
      },
    },
  },
};
