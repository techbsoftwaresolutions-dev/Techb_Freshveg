// All amounts in the engine are integer paise. These helpers are the only
// place rounding happens, so a discount and the tax on it round the same way.

// Percentage of an amount, rounded half-up to the nearest paisa.
const pctOf = (paise, percentage) => Math.round((Number(paise) * Number(percentage)) / 100);

// Splits a tax-inclusive amount into base + tax.
const splitInclusiveTax = (grossPaise, ratePct) => {
  const base = Math.round((grossPaise * 100) / (100 + Number(ratePct)));
  return { base, tax: grossPaise - base };
};

// Quantity can be fractional for weight-based items (0.5 kg), so line totals
// round once, at the line, never per unit.
const lineTotal = (unitPaise, quantity) => Math.round(Number(unitPaise) * Number(quantity));

module.exports = { pctOf, splitInclusiveTax, lineTotal };
