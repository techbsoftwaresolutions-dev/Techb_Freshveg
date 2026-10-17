// The Farmers Basket icon set: duotone line icons on a 24 x 24 grid, a
// dark-green 1.8 outline over a light-green fill. The same shapes live in
// customer-app/src/components/Icon.js and delivery-app/src/components/Icon.js
// — change one, change all three.
//
// Colours come from CSS variables so a surface can recolour them (the green
// cart pill sets them to white): --icon-line, --icon-tint, --icon-inverse.
//
// Each shape's role: "both" light fill + dark outline, "line" outline only,
// "tint" light fill only, "solid" dark fill, "inverse" white outline (a mark
// drawn on a solid shape).
export const ICONS = {
  home: [
    { path: "M5.5 10.4 12 5l6.5 5.4V20h-13z", role: "tint" },
    { path: "M3 11.4 12 4l9 7.4", role: "line" },
    { path: "M5.5 9.6V20h13V9.6", role: "line" },
    { path: "M15.6 6.6V3.9h2.4v4.6", role: "line" },
    { path: "M10.1 20v-4.6a1 1 0 0 1 1-1h1.8a1 1 0 0 1 1 1V20z", role: "solid" },
  ],
  categories: [
    { rect: [3.5, 3.5, 7, 7, 2.2], role: "both" },
    { rect: [13.5, 3.5, 7, 7, 2.2], role: "both" },
    { rect: [3.5, 13.5, 7, 7, 2.2], role: "both" },
    { circle: [17, 17, 3.6], role: "solid" },
  ],
  cart: [
    { rect: [8.6, 4.4, 4.2, 3.8, 0.7], role: "both" },
    { path: "M14.2 8.2c-.3-1.9.9-3.4 2.6-3.4s2.9 1.5 2.6 3.4", role: "both" },
    { path: "M2.4 3.8h2.2l1.1 4.4", role: "line" },
    { path: "M5.7 8.2h15l-1.7 7.3H7.4z", role: "both" },
    { path: "M10.6 10.7v2.4M13.2 10.7v2.4M15.8 10.7v2.4", role: "line" },
    { path: "M7.4 15.5l-.6 2.6h12.4", role: "line" },
    { circle: [9, 20.3, 1.4], role: "solid" },
    { circle: [17, 20.3, 1.4], role: "solid" },
  ],
  orders: [
    { path: "M4.8 7.6h11.6l.5 6.6-4.5 6H3.9z", role: "tint" },
    { path: "M4.8 7.6h11.6l.5 6.6M12.4 20.2H3.9l.9-12.6", role: "line" },
    { path: "M7.8 9.8V6.2a2.8 2.8 0 0 1 5.6 0v3.6", role: "line" },
    { path: "M9.7 11.6h1.8v2.2l-.9.8-.9-.8z", role: "line" },
    { circle: [17.6, 17.4, 4.4], role: "solid" },
    { path: "M15.7 17.5l1.3 1.3 2.6-2.7", role: "inverse" },
  ],
  account: [
    { circle: [12, 8, 4], role: "both" },
    { path: "M4.5 20.2c0-4.1 3.4-6.7 7.5-6.7s7.5 2.6 7.5 6.7a.8.8 0 0 1-.8.8H5.3a.8.8 0 0 1-.8-.8z", role: "both" },
  ],
  run: [
    { path: "M1 9.4h2.2M1.6 11.6h1.8", role: "line" },
    { rect: [4.4, 7.6, 5.2, 4.4, 0.9], role: "both" },
    { path: "M3.6 16.4c0-2.3 1.8-3.8 4-3.8h5l1.4 3.8z", role: "both" },
    { path: "M14 16.4h1.4L17.6 8h2", role: "line" },
    { path: "M10.6 12.6l.8-3.9a1.8 1.8 0 0 1 2.5-1.3l3 2.4", role: "line" },
    { circle: [13.2, 4.3, 2], role: "both" },
    { circle: [7.2, 18.4, 2.1], role: "both" },
    { circle: [18.2, 18.4, 2.1], role: "both" },
  ],
  history: [
    { circle: [12, 12, 7.5], role: "tint" },
    { path: "M8.25 18.5A7.5 7.5 0 1 0 4.5 12", role: "line" },
    { path: "M2 11.4h5l-2.5 3.4z", role: "solid" },
    { path: "M12 8v4.3l2.8 1.8", role: "line" },
  ],
};

const LINE = "var(--icon-line, #135c2b)";
const TINT = "var(--icon-tint, #c6e6cf)";
const ROLE = {
  both: { fill: TINT, stroke: LINE },
  line: { fill: "none", stroke: LINE },
  tint: { fill: TINT, stroke: "none" },
  solid: { fill: LINE, stroke: "none" },
  inverse: { fill: "none", stroke: "var(--icon-inverse, #fff)" },
};

// Decorative by default: every place it is used carries its own text label.
export default function Icon({ name, size = 24, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {ICONS[name].map(({ path, rect, circle, role }, i) => {
        const style = ROLE[role];
        if (path) return <path key={i} d={path} style={style} />;
        if (rect) return <rect key={i} x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} rx={rect[4]} style={style} />;
        return <circle key={i} cx={circle[0]} cy={circle[1]} r={circle[2]} style={style} />;
      })}
    </svg>
  );
}
