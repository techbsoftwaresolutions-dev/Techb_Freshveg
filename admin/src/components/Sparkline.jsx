// A tiny inline trend line for a stat card — no charting library, just a
// hand-built polyline over whatever numbers the caller already has (real
// daily figures, never invented).
export default function Sparkline({ points, tone = "accent", width = 60, height = 28 }) {
  if (!points || points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);

  const path = points
    .map((value, index) => {
      const x = (index * step).toFixed(1);
      const y = (height - ((value - min) / range) * height).toFixed(1);
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="sparkline"
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke={`var(--${tone})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
