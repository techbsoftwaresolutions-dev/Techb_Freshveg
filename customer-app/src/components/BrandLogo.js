import React, { useEffect, useState, useSyncExternalStore } from "react";
import { AppState, Image } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";

// The brand images from Admin → Settings → Branding (settings.branding on
// /settings/public). The last copy is kept on the phone, so the logo shows at
// once on launch and offline; a fresh one is fetched in the background on
// launch, and again when the app comes back to the front after 10 minutes.
// Nothing waits on it: until it loads, or if it never does, the bundled logo
// shows. Same file in customer-app and delivery-app.
//
// The launcher icon and splash screen are not here: they are part of the app
// build (npm run brand:sync), not something a running app can change.

const CACHE_KEY = "brand.v1";
const MAX_AGE_MS = 10 * 60 * 1000;
const DEFAULT_LOGO = require("../../assets/logo.png");

let state = { branding: {}, fetchedAt: 0 };
let started = false;
let inflight = null;
const listeners = new Set();

function publish(branding, fetchedAt = Date.now()) {
  state = { branding: branding || {}, fetchedAt };
  listeners.forEach((listener) => listener());
}

function refresh() {
  if (inflight || Date.now() - state.fetchedAt < MAX_AGE_MS) return;
  inflight = api
    .get("/settings/public")
    .then((data) => {
      publish(data?.settings?.branding);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(state)).catch(() => {});
    })
    .catch(() => {}) // keep what is showing
    .finally(() => {
      inflight = null;
    });
}

function start() {
  if (started) return;
  started = true;
  AsyncStorage.getItem(CACHE_KEY)
    .then((raw) => {
      const cached = raw ? JSON.parse(raw) : null;
      if (cached && !state.fetchedAt) publish(cached.branding, cached.fetchedAt || 0);
    })
    .catch(() => {})
    .finally(refresh);
  AppState.addEventListener("change", (status) => status === "active" && refresh());
}

/** A screen that has just fetched /settings/public can pass its branding on. */
export function primeBranding(branding) {
  if (!branding) return;
  publish(branding);
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(state)).catch(() => {});
}

export function useBranding() {
  useEffect(start, []);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state.branding
  );
}

// A Cloudinary upload, resized for the screen it lands on.
const sized = (url, width) =>
  url.includes("/image/upload/") ? url.replace("/image/upload/", `/image/upload/q_auto,w_${width}/`) : url;

/** The primary logo; the bundled one until an uploaded one loads, or if it fails to. */
export default function BrandLogo({ style, width = 480, ...props }) {
  const { logo } = useBranding();
  const [failed, setFailed] = useState("");
  const remote = logo && logo !== failed ? { uri: sized(logo, width) } : null;
  return (
    <Image
      source={remote || DEFAULT_LOGO}
      onError={() => remote && setFailed(logo)}
      style={style}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      {...props}
    />
  );
}
