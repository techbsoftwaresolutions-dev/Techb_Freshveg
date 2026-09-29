// This app is used one-handed, outdoors, often in sunlight and in a hurry.
// So: high contrast, large type, big tap targets, and one obvious next action
// per screen. Blue rather than the storefront's green, because a rider
// switching between the two apps should never confuse them.

export const colors = {
  bg: "#F4F6FA",
  surface: "#FFFFFF",
  surfaceAlt: "#EEF1F7",
  border: "#DDE2EC",
  borderStrong: "#C7CEDC",

  text: "#101423",
  textMuted: "#59617A",
  textFaint: "#8F97AC",

  primary: "#2547C8",
  primaryDark: "#1D3A8A",
  primarySoft: "#E7ECFC",
  onPrimary: "#FFFFFF",

  success: "#0E8A4F",
  successSoft: "#E3F5EC",
  warn: "#A66A00",
  warnSoft: "#FDF2DF",
  danger: "#C62F28",
  dangerSoft: "#FDEBEA",
  cash: "#0E7C5A",
  cashSoft: "#E2F4EE",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export const type = {
  // A size up from the storefront across the board — this is read at arm's
  // length, in daylight, while holding a bag.
  h1: { fontSize: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  h2: { fontSize: 18, fontWeight: "700", color: colors.text },
  h3: { fontSize: 16, fontWeight: "700", color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13.5, color: colors.textMuted },
  tiny: { fontSize: 12, color: colors.textFaint },
};

export const shadow = {
  card: {
    shadowColor: "#0A0E1A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};

export const rupees = (paise, { decimals = false } = {}) => {
  const value = (Number(paise) || 0) / 100;
  return `₹${decimals ? value.toFixed(2) : Math.round(value)}`;
};

export const clockTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "—";

// "12 min ago" / "in 8 min" — a rider cares about elapsed time, not timestamps.
export function relativeTime(value) {
  if (!value) return "";
  const diffMinutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (Math.abs(diffMinutes) < 1) return "just now";
  if (diffMinutes > 0) {
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    return `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m ago`;
  }
  const ahead = -diffMinutes;
  return ahead < 60 ? `in ${ahead} min` : `in ${Math.floor(ahead / 60)}h`;
}

export const formatAddress = (address = {}) =>
  [address.line1, address.line2, address.landmark, address.city, address.pincode]
    .filter(Boolean)
    .join(", ");
