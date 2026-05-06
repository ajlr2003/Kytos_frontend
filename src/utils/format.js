/**
 * src/utils/format.js
 *
 * Pure number and currency formatting helpers used across Sales, Purchases,
 * Invoicing, and any other module that displays monetary values.
 * All functions are side-effect-free and safe to call with null/undefined.
 */

/**
 * Formats a number to exactly two decimal places with thousands separators.
 * Returns "0.00" when the value is falsy.
 *
 * @param {number|string|null|undefined} n - Raw numeric value.
 * @returns {string} e.g. "1,234.56"
 */
export function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats a SAR revenue value using M/K shorthand for large amounts.
 * Returns an em-dash when the value is null or undefined.
 *
 * @param {number|null|undefined} n - Revenue in SAR.
 * @returns {string} e.g. "SAR 1.2M", "SAR 450.0K", "SAR 320.00", or "—"
 */
export function fmtRevenue(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `SAR ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `SAR ${(n / 1_000).toFixed(1)}K`;
  return `SAR ${n.toFixed(2)}`;
}

/**
 * Generates a locally-unique quotation reference number.
 * Uses the current year and the last four digits of Date.now() to avoid
 * collisions within a session. The server assigns the canonical number
 * on save; this is used only as a placeholder in the form header.
 *
 * @returns {string} e.g. "QUO-2026-4821"
 */
export function genQuoteNo() {
  return `QUO-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
}
