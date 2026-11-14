import { api } from "@/lib/client-api";

// One shared list of the variants this customer asked to hear about, so every
// "Notify me" button on the page agrees without each one asking the server.
let waiting = new Set();
let loaded = false;
let loading = null;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn(waiting));

export function subscribe(fn) {
  listeners.add(fn);
  fn(waiting);
  return () => listeners.delete(fn);
}

/** Server state: { waiting: [variantId], ready: [{ id, variant, product }] }. */
export async function refresh() {
  const data = await api.get("/stock-alerts/mine", undefined, { force: true });
  waiting = new Set(data.waiting || []);
  loaded = true;
  emit();
  return data;
}

export function ensureLoaded() {
  if (loaded) return Promise.resolve();
  if (!loading) loading = refresh().catch(() => {}).finally(() => { loading = null; });
  return loading;
}

export async function watch(variantId) {
  await api.post("/stock-alerts", { variant: variantId });
  waiting = new Set(waiting).add(String(variantId));
  emit();
}

export async function unwatch(variantId) {
  await api.del(`/stock-alerts/${variantId}`);
  const next = new Set(waiting);
  next.delete(String(variantId));
  waiting = next;
  emit();
}

/** Signed out: forget everything. */
export function reset() {
  waiting = new Set();
  loaded = false;
  emit();
}

export const isWaiting = () => waiting.size > 0;
