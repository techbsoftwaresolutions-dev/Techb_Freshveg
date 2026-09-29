// One place for colour, spacing and type. A grocery app lives or dies on
// scanability, so the palette is deliberately quiet — green only carries
// meaning (fresh, in stock, savings), never decoration.

export const colors = {
  bg: "#F7F8FA",
  surface: "#FFFFFF",
  surfaceAlt: "#F2F4F7",
  border: "#E6E8EC",
  borderStrong: "#D5D9E0",

  text: "#14171F",
  textMuted: "#61697A",
  textFaint: "#9AA1AF",

  // Fresh-produce green as the primary, because most of the catalogue is food.
  primary: "#16A34A",
  primaryDark: "#12813B",
  primarySoft: "#E8F7EE",
  onPrimary: "#FFFFFF",

  accent: "#2F6DF6",
  accentSoft: "#EAF1FF",

  danger: "#D6382F",
  dangerSoft: "#FDECEA",
  warn: "#B7791F",
  warnSoft: "#FDF4E3",
  save: "#0E7C5A",
  saveSoft: "#E4F5EF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const type = {
  h1: { fontSize: 22, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  h2: { fontSize: 17, fontWeight: "700", color: colors.text, letterSpacing: -0.2 },
  h3: { fontSize: 15, fontWeight: "600", color: colors.text },
  body: { fontSize: 14, color: colors.text },
  small: { fontSize: 12.5, color: colors.textMuted },
  tiny: { fontSize: 11, color: colors.textFaint },
};

export const shadow = {
  card: {
    shadowColor: "#0B0F1A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bar: {
    shadowColor: "#0B0F1A",
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
