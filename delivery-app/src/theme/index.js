// The customer app's design tokens (customer-app/src/theme/index.js, itself
// taken from the website's globals.css), so both apps read as one brand.
// Change a value there, change it here. The delivery-only tones (success,
// cash) sit at the end.

export const colors = {
  bg: "#F6F8F7",
  surface: "#FFFFFF",
  surfaceAlt: "#F2F9F3",
  border: "#E4E8E6",
  borderStrong: "#CFD6D3",

  text: "#12261B",
  textMuted: "#5B6B62",
  textFaint: "#8C9A92",

  primary: "#1B7A3A",
  primaryDark: "#135C2B",
  primaryDeep: "#0F4A23",
  primarySoft: "#E8F5EC",
  onPrimary: "#FFFFFF",

  danger: "#B91C1C",
  dangerSoft: "#FDECEC",
  warn: "#B45309",
  warnSoft: "#FDF3E4",

  success: "#0E7C5A",
  successSoft: "#E3F4EE",
  cash: "#B45309",
  cashSoft: "#FDF3E4",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 10, lg: 16, pill: 999 };

// Poppins, as in the customer app. Loaded in App.js; components/Text.js picks
// the file for the weight.
export const fontFamily = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
  extrabold: "Poppins_800ExtraBold",
};

export const type = {
  h1: { fontSize: 24, fontFamily: fontFamily.bold, color: colors.text, letterSpacing: -0.3 },
  h2: { fontSize: 17, fontFamily: fontFamily.semibold, color: colors.text },
  h3: { fontSize: 15, fontFamily: fontFamily.semibold, color: colors.text },
  body: { fontSize: 14, fontFamily: fontFamily.regular, color: colors.text },
  small: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textMuted },
  tiny: { fontSize: 11.5, fontFamily: fontFamily.regular, color: colors.textFaint },
};

export const shadow = {
  card: {
    shadowColor: "#0A1E14",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  bar: {
    shadowColor: "#0A1E14",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
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
