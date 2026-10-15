// Old dynamic icon URLs (/app-icon/192 …) now point at the static Hosur Basket
// icons in /public/icons, so an installed copy or a cached manifest that still
// asks for them keeps working.
const SIZES = new Set([96, 192, 512]);

export async function GET(request, { params }) {
  const { size } = await params;
  const px = Number(size);
  if (!SIZES.has(px)) return new Response("Not found", { status: 404 });
  const maskable = new URL(request.url).searchParams.has("maskable") && px !== 96;
  const target = new URL(`/icons/${maskable ? "maskable" : "icon"}-${px}.png`, request.url);
  return Response.redirect(target, 308);
}
