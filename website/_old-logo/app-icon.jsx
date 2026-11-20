import { ImageResponse } from "next/og";

// The app icon, drawn from the same two-leaf mark as the header logo so the
// home-screen icon and the site agree. Rendered to PNG on request (and cached
// by the browser) rather than kept as image files that could drift from the
// logo.
//
// `maskable` icons are cropped to a circle or squircle by Android, so the mark
// shrinks into the middle "safe zone" and the green runs to every edge.
export function appIcon(size, { maskable = false } = {}) {
  const mark = Math.round(size * (maskable ? 0.52 : 0.64));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #1f8a43 0%, #0f4a23 100%)",
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 48 48" fill="none">
          <path d="M22 44C9 42 2 31 4 14c11 1 19 8 20 20 0 4-1 7-2 10Z" fill="#a5e0a9" />
          <path d="M24 44c1-14 7-26 20-32 2 17-5 29-18 32h-2Z" fill="#ffffff" />
          <path d="M8 18c6 6 11 14 14 24" stroke="#1f8a43" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
          <path d="M40 17c-7 6-11 14-14 25" stroke="#1f8a43" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
