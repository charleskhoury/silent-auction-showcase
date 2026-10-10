/**
 * All money is stored and computed as integer cents to avoid floating-point
 * rounding. These helpers convert to/from the dollar strings shown in the UI.
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Parse a user-entered dollar amount ("475", "$475.50") into integer cents. */
export function dollarsToCents(input: string | number): number | null {
  const raw = typeof input === "number" ? String(input) : input;
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Math.round(parseFloat(cleaned) * 100);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** Digits-only normalisation so a mobile keys a bidder regardless of spacing. */
export function normaliseMobile(input: string): string {
  return input.replace(/[^\d+]/g, "").replace(/^\+/, "00");
}
