require("dotenv").config();
const fs = require("fs");
const path = require("path");

// The launcher icon and splash artwork from Admin → Settings → Branding, once
// `npm run brand:sync` has pulled them into assets/brand/ — else the bundled
// ones. Read at build time: an installed app changes only with a new build.
const brandAsset = (file, fallback) =>
  fs.existsSync(path.join(__dirname, "assets", "brand", file)) ? `./assets/brand/${file}` : fallback;
const brandedIcon = fs.existsSync(path.join(__dirname, "assets", "brand", "adaptive-icon.png"));

export default {
  expo: {
    // The name under the icon. The scheme and app IDs below are left as they
    // are — an ID is permanent once published.
    name: "Farmers Basket Delivery",
    slug: "commerce-delivery-app",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    scheme: "samagrapartner",
    icon: brandAsset("icon.png", "./assets/icon.png"),
    splash: { image: brandAsset("splash.png", "./assets/splash.png"), backgroundColor: "#FBF9EF", resizeMode: "contain" },
    ios: { supportsTablet: false, bundleIdentifier: "com.samagramart.partner" },
    android: {
      package: "com.samagramart.partner",
      adaptiveIcon: { foregroundImage: brandAsset("adaptive-icon.png", "./assets/adaptive-icon.png"), backgroundColor: brandedIcon ? "#FFFFFF" : "#295110" },
      // The session token lives in AsyncStorage; keep it out of device backups.
      allowBackup: false,
      // Added by Expo's default template, used by nothing in this app. See
      // docs/legal/permissions-audit.md.
      blockedPermissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW",
      ],
    },
    web: { bundler: "metro" },
    extra: {
      apiBaseUrl: process.env.API_BASE_URL,
      // Where the legal notices live (Profile → Legal & account).
      siteUrl: process.env.SITE_URL || "https://thefarmersbasket.in",
    },
  },
};
