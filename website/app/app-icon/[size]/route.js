import { appIcon } from "@/lib/app-icon";

// /app-icon/192 and /app-icon/512 — the manifest's icons. Only the sizes the
// manifest names are served, so this cannot be used to render arbitrary
// images on demand.
const SIZES = new Set([192, 512]);

export async function GET(request, { params }) {
  const { size } = await params;
  const px = Number(size);
  if (!SIZES.has(px)) return new Response("Not found", { status: 404 });

  const maskable = new URL(request.url).searchParams.has("maskable");
  const response = appIcon(px, { maskable });
  response.headers.set("Cache-Control", "public, max-age=604800, immutable");
  return response;
}
