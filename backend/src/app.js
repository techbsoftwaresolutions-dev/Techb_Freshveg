const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const mongoose = require("mongoose");

const config = require("./config");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
// Which websites may call this API from a browser. In production the admin
// (admin.hosurbasket.com) and the site (hosurbasket.com) live on different
// addresses from the API (api.hosurbasket.com), so they are listed in
// CORS_ORIGINS; any other site's browser requests are refused. Unset — as in
// development — allows every origin. The phone apps send no Origin header and
// are unaffected either way.
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);
app.use(
  cors(
    allowedOrigins.length
      ? {
          origin: (origin, done) => done(null, !origin || allowedOrigins.includes(origin)),
          credentials: true,
        }
      : undefined
  )
);
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

app.use(config.apiPrefix, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
