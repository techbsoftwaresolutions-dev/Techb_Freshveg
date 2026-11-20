"use client";

import { useEffect, useState } from "react";

// One home for the browser's "install this app" prompt, shared by everything
// that offers to install (the phone install bar and the homepage app section).
//
// Chrome and Edge fire `beforeinstallprompt` once per page load, often before
// any component has mounted, so it is caught here at module load rather than
// in a component effect, and handed to whoever asks.
let deferred = null;
let installed = false;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

// Already running as the installed app (home-screen icon).
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// "ios" (Safari has no prompt — Share → Add to Home Screen), "android", or "desktop".
export function detectPlatform() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

// Shows the browser's own install dialog. Resolves to "accepted",
// "dismissed", or "unavailable" when the browser has not offered one.
export async function promptInstall() {
  if (!deferred) return "unavailable";
  const event = deferred;
  // The event can be used once only.
  deferred = null;
  notify();
  event.prompt();
  const { outcome } = await event.userChoice.catch(() => ({ outcome: "dismissed" }));
  if (outcome === "accepted") installed = true;
  notify();
  return outcome;
}

// Re-renders when the prompt arrives or the app gets installed. Everything is
// false until mounted, so the server HTML and the first client render match.
export function useInstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [, rerender] = useState(0);

  useEffect(() => {
    setMounted(true);
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  return {
    mounted,
    canPrompt: mounted && Boolean(deferred),
    installed: mounted && (installed || isStandalone()),
  };
}
