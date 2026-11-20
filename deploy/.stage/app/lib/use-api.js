"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "./client-api";

// Read one endpoint through TanStack Query:
//   - paints at once from the cache, then refreshes quietly in the background;
//   - identical requests from different components share one network call;
//   - refreshes every `refreshMs` while the tab is visible, and when the shopper returns to it;
//   - while paging or filtering, the previous page stays on screen until the next one arrives.
//
//   const { data, error, loading, refreshing, reload } = useApi("/cart", undefined, { refreshMs: 60000 });
//
// `loading` is true only until the first answer; later fetches set `refreshing`. A failed refresh
// keeps the last good data and sets `error`.
export function useApi(path, query, { refreshMs = 0, enabled = true } = {}) {
  const q = useQuery({
    queryKey: [path, query || {}],
    // force: TanStack Query owns the caching here, so skip the client's own short memory.
    queryFn: () => api.get(path, query, { force: true }),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: refreshMs ? () => (document.hidden ? false : refreshMs) : false,
  });
  return {
    data: q.data,
    error: q.error,
    loading: q.isPending && enabled,
    refreshing: q.isFetching,
    reload: () => q.refetch(),
  };
}
