const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const mongoose = require("mongoose");

const config = require("./config");
const routes = require("./routes");
const storage = require("./modules/storage/storage.routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

if (!config.isProd) app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    success: true,
    service: "commerce-engine-api",
    env: config.env,
    database: {
      state: states[mongoose.connection.readyState] || "unknown",
      name: mongoose.connection.name || null,
    },
    time: new Date().toISOString(),
  });
});

// Uploaded images are served straight off disk. immutable because every file
// gets a unique name — an image is never rewritten in place.
//
// helmet()'s default Cross-Origin-Resource-Policy is "same-origin", which
// tells the *browser* to silently refuse to render a resource inside a page
// from a different origin — even though the request itself succeeds with a
// normal 200. The storefront and admin apps run on their own origins (their
// own ports), not this API's, and both embed these images directly via
// <img src>, so the default policy blocked every one of them client-side
// with no server-visible error. This route is the one thing on this API
// that is meant to be loaded cross-origin, so it gets its own explicit
// policy rather than loosening helmet() globally.
app.use(
  storage.PUBLIC_PREFIX,
  helmet.crossOriginResourcePolicy({ policy: "cross-origin" }),
  express.static(storage.UPLOAD_DIR, { maxAge: "30d", immutable: true, fallthrough: true })
);

app.use(config.apiPrefix, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
