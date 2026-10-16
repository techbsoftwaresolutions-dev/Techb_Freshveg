// Expo's CLI loads .env (and .env.local) into process.env before reading
// this file, in development and in EAS builds alike — no dotenv needed.
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
    // The name under the icon on the phone. The scheme and the iOS/Android
    // IDs below still say "samagramart" on purpose: an ID is permanent once
    // the app is in a store, and changing it ships a separate app.
    name: "The Farmers Basket",
    slug: "commerce-customer-app",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    scheme: "samagramart",

    icon: brandAsset("icon.png", "./assets/icon.png"),

    splash: {
      image: brandAsset("splash.png", "./assets/splash.png"),
      backgroundColor: "#FBF9EF",
      resizeMode: "contain",
    },

    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.samagramart.customer",
    },

    android: {
      package: "com.samagramart.customer",
      adaptiveIcon: {
        foregroundImage: brandAsset("adaptive-icon.png", "./assets/adaptive-icon.png"),
        backgroundColor: brandedIcon ? "#FFFFFF" : "#295110",
      },
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
