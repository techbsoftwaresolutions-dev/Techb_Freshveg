import { ImageResponse } from "next/og";

// /app-screenshot/wide and /app-screenshot/narrow — the pictures Chrome shows
// in its richer install dialog. They are branded cards drawn on request, so the
// manifest is valid without image files. To show real screenshots instead,
// drop PNGs in /public (e.g. public/shots/home-narrow.png) and point the
// "screenshots" list in app/manifest.js at them.
const KINDS = {
  wide: { width: 1280, height: 720 },
  narrow: { width: 720, height: 1280 },
};

export async function GET(_request, { params }) {
  const { kind } = await params;
  const size = KINDS[kind];
  if (!size) return new Response("Not found", { status: 404 });

  const wide = kind === "wide";
  const mark = wide ? 150 : 170;

  const response = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #1f8a43 0%, #0f4a23 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: 60,
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 48 48" fill="none">
          <path d="M22 44C9 42 2 31 4 14c11 1 19 8 20 20 0 4-1 7-2 10Z" fill="#a5e0a9" />
          <path d="M24 44c1-14 7-26 20-32 2 17-5 29-18 32h-2Z" fill="#ffffff" />
        </svg>
        <div style={{ display: "flex", fontSize: wide ? 84 : 78, fontWeight: 800, marginTop: 28 }}>Hosur Basket</div>
        <div style={{ display: "flex", fontSize: wide ? 38 : 36, marginTop: 14, opacity: 0.92 }}>
          Fresh food, better life
        </div>
        <div style={{ display: "flex", fontSize: wide ? 30 : 30, marginTop: 40, opacity: 0.8 }}>
          Fruits · Vegetables · Groceries · Delivered fast
        </div>
      </div>
    ),
    size
  );
  response.headers.set("Cache-Control", "public, max-age=604800, immutable");
  return response;
}
