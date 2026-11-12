"use client";

import { QueryClient } from "@tanstack/react-query";
import { hooks } from "./client-api";

// One cache for every client component: answers are reused for 10 s, kept 5 min for an instant
// repaint, de-duplicated while in flight, and refreshed in the background (focus, intervals).
export function makeQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10000,
        gcTime: 5 * 60000,
        refetchOnWindowFocus: true,
        // Retry network blips and server errors twice; never a 4xx (the answer will not change).
        retry: (count, err) => count < 2 && !(err?.status >= 400 && err.status < 500),
      },
    },
  });
  // A write (add to cart, save address, ...) makes every cached list stale; signing in or out drops them all.
  hooks.onWrite = () => client.invalidateQueries();
  hooks.onSession = () => client.clear();
  return client;
}
