// Old dynamic screenshot URLs now point at the static files in /public/screenshots.
export async function GET(request, { params }) {
  const { kind } = await params;
  if (kind !== "wide" && kind !== "narrow") return new Response("Not found", { status: 404 });
  return Response.redirect(new URL(`/screenshots/${kind}.png`, request.url), 308);
}
