// One place for colour, spacing and type — taken from the website's own
// design tokens (website/app/globals.css :root), so the app and the site's
// mobile view read as one brand. Change a value there, change it here.

export const colors = {
  bg: "#F6F8F7", // --bg-alt: inner pages sit on this, cards on white
  surface: "#FFFFFF",
  surfaceAlt: "#F2F9F3", // --brand-mist
  border: "#E4E8E6",
  borderStrong: "#CFD6D3",

  text: "#12261B",
  textMuted: "#5B6B62",
  textFaint: "#8C9A92",

  primary: "#1B7A3A", // --brand
  primaryDark: "#135C2B", // --brand-dark
  primaryDeep: "#0F4A23", // --brand-deep
  primarySoft: "#E8F5EC", // --brand-soft
  onPrimary: "#FFFFFF",

  accent: "#B45309",
  accentSoft: "#FDF3E4",

  danger: "#B91C1C",
  dangerSoft: "#FDECEC",
  warn: "#B45309",
  warnSoft: "#FDF3E4",
  save: "#0E7C5A",
  saveSoft: "#E3F4EE",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// --radius 10px, --radius-lg 16px.
export const radius = {
  sm: 8,
  md: 10,
  lg: 16,
  pill: 999,
};

// Poppins for everything, DM Serif Display for section headings — the
// website's two faces. Loaded in App.js; components/Text.js picks the weight.
export const fontFamily = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
  extrabold: "Poppins_800ExtraBold",
  serif: "DMSerifDisplay_400Regular",
};

export const type = {
  h1: { fontSize: 24, fontFamily: fontFamily.bold, color: colors.text, letterSpacing: -0.3 },
  h2: { fontSize: 17, fontFamily: fontFamily.semibold, color: colors.text },
  h3: { fontSize: 15, fontFamily: fontFamily.semibold, color: colors.text },
  body: { fontSize: 14, fontFamily: fontFamily.regular, color: colors.text },
  small: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textMuted },
  tiny: { fontSize: 11.5, fontFamily: fontFamily.regular, color: colors.textFaint },
  // The website's section headings ("Best Sellers —").
  section: { fontSize: 22, fontFamily: fontFamily.serif, color: colors.text },
};

// --shadow-card: 0 1px 3px rgba(10,30,20,.06), 0 4px 14px rgba(10,30,20,.05).
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

// Prices come from the API as integer paise and are only ever turned into
// rupees for display.
export function rupees(paise, { decimals = false } = {}) {
  const value = (Number(paise) || 0) / 100;
  const formatted = decimals
    ? value.toFixed(2)
    : Number.isInteger(value)
      ? String(value)
      : value.toFixed(2);
  return `₹${formatted}`;
}

// "1 kg", "0.5 kg", "2 pcs" — quantities can be fractional for loose produce.
export function formatQty(quantity, unit = "") {
  const rounded = Math.round(Number(quantity) * 100) / 100;
  return `${rounded}${unit ? ` ${unit}` : ""}`;
}

// Whether a quantity should be labelled with a weight unit.
//
// Only loose goods count. A 5 KG bag of rice has packSize.unit "kg" too, but
// its quantity means *packs* — labelling "1" as "1 kg" there would tell the
// customer they are buying a kilo when they are buying five. A fractional step
// is the signal that the thing is weighed out rather than picked off a shelf.
export function unitSuffix(item) {
  if (!item) return "";
  const step = Number(item.stepQty ?? 1);
  if (step >= 1) return "";
  return item.packSize?.unit || "";
}
