require("dotenv").config();

const isProduction = (process.env.NODE_ENV || "development") === "production";

/**
 * Reads a variable, with a development-only fallback.
 *
 * The fallback is a convenience for running locally without a .env — it must
 * never apply in production. A missing MONGODB_URI silently falling back to
 * localhost means a deployed API talks to a database that isn't there; a
 * missing JWT_SECRET falling back means every token is signed with a string
 * published in this repository, and anyone can mint an admin session.
 * In production a missing variable is a startup failure, which is loud,
 * immediate, and fixable — unlike either of those.
 */
const required = (key, devFallback) => {
  const value = process.env[key];
  if (value !== undefined && value !== "") return value;

  if (isProduction || devFallback === undefined) {
    throw new Error(
      `Missing required environment variable: ${key}` +
        (isProduction ? " (no development fallback is used in production)" : "")
    );
  }
  return devFallback;
};

const port = Number(process.env.PORT || 5055);

const config = {
  env: process.env.NODE_ENV || "development",
  // 5055, not 6000: browsers refuse to connect to port 6000 at all — it is on
  // Chrome's and Firefox's blocked-ports list (X11), so a fetch to it fails
  // with ERR_UNSAFE_PORT before it leaves the browser. curl and Postman work
  // fine, which makes it a confusing thing to debug. Every browser-based
  // client (the web build of the customer app, the storefront site) depends on
  // this staying off that list.
  port,
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  mongoUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/commerce_engine"),
  // Optional, comma-separated, e.g. "8.8.8.8,1.1.1.1" — see config/db.js.
  dnsServers: (process.env.DNS_SERVERS || "").split(",").map((s) => s.trim()).filter(Boolean),

  jwt: {
    secret: required("JWT_SECRET", "dev-only-insecure-secret"),
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    refreshSecret: required("JWT_REFRESH_SECRET", "dev-only-insecure-refresh"),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },

  redisUrl: process.env.REDIS_URL || "",

  currency: process.env.DEFAULT_CURRENCY || "INR",
  country: process.env.DEFAULT_COUNTRY || "IN",
};

config.isProd = config.env === "production";

// Until an SMS provider is connected, the login code can be sent back to the
// screen and filled in automatically. Always on outside production; on the
// live site only when OTP_ON_SCREEN=true is set deliberately — anyone could
// then sign in as any number, so it is for launch/testing only.
// Read leniently ("true", "True", " TRUE ", "\"true\"", "1", "yes"): a value
// typed into a hosting panel with a stray quote or space must not silently
// leave it off.
const otpFlag = String(process.env.OTP_ON_SCREEN || "").trim().replace(/^["']|["']$/g, "").toLowerCase();
config.otpOnScreen = !config.isProd || ["true", "1", "yes", "on"].includes(otpFlag);

module.exports = config;
