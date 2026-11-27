import { QueryClient } from "@tanstack/react-query";
import { hooks } from "./client";

// One cache for every screen: answers are reused for 10 s, kept 5 min for instant repaint,
// de-duplicated while in flight, and refreshed in the background (on focus and on intervals).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      gcTime: 5 * 60000,
      refetchOnWindowFocus: true,
      // Retry network blips and server errors twice; never retry a 4xx (the answer will not change).
      retry: (count, err) => count < 2 && !(err?.status >= 400 && err.status < 500),
    },
  },
});

// A saved/edited/deleted record makes every cached list stale at once; signing in or out drops them all.
hooks.onWrite = () => queryClient.invalidateQueries();
hooks.onSession = () => queryClient.clear();
