/**
 * src/constants/index.js
 *
 * Application-wide shared constants: currency symbols, line-item units,
 * status metadata for quotations and sales orders, and icon colour palettes.
 * Import from this file instead of repeating literals across pages.
 */

/* ─── Currency ─────────────────────────────────────────────────── */

/** Maps ISO-4217 currency code → display symbol prefix. */
export const CURRENCY_SYMBOLS = {
  SAR: 'SAR ',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
};

/* ─── Line Items ────────────────────────────────────────────────── */

/** Allowed unit-of-measure values for quotation/order line items. */
export const LINE_ITEM_UNITS = ['EA', 'LOT', 'PCS', 'DAYS', 'MONTH'];

/* ─── Quotation Status ──────────────────────────────────────────── */

/**
 * Display metadata for each quotation lifecycle status.
 * bg / color are badge background and text colours.
 */
export const QUOTATION_STATUS_META = {
  draft:     { label: 'Draft',     bg: '#f3f4f6', color: '#374151' },
  sent:      { label: 'Sent',      bg: '#dbeafe', color: '#1d4ed8' },
  accepted:  { label: 'Accepted',  bg: '#dcfce7', color: '#15803d' },
  rejected:  { label: 'Rejected',  bg: '#fee2e2', color: '#b91c1c' },
  converted: { label: 'Converted', bg: '#f5f3ff', color: '#7c3aed' },
};

/** Ordered list of all quotation status filter keys. */
export const QUOTATION_STATUS_FILTERS = [
  'all', 'draft', 'sent', 'accepted', 'rejected', 'converted',
];

/* ─── Sales Order Status ────────────────────────────────────────── */

/**
 * Display metadata for each sales order status.
 * Mirrors the backend SalesOrderStatus enum values.
 */
export const ORDER_STATUS_META = {
  confirmed:  { label: 'Confirmed', bg: '#dbeafe', color: '#1d4ed8' },
  shipped:    { label: 'Shipped',   bg: '#ffedd5', color: '#c2410c' },
  delivered:  { label: 'Delivered', bg: '#dcfce7', color: '#15803d' },
  cancelled:  { label: 'Cancelled', bg: '#fee2e2', color: '#b91c1c' },
};

/* ─── UI Colours ────────────────────────────────────────────────── */

/**
 * Rotating icon-background / icon-foreground colour pairs used for
 * product cards and category icons. Index into this array with `idx % length`.
 */
export const PRODUCT_ICON_COLORS = [
  { bg: '#FFEED5', ic: '#9F3E1D' },
  { bg: '#ECFEF6', ic: '#3F7868' },
  { bg: '#EFF6FF', ic: '#4F82EF' },
  { bg: '#FFF7ED', ic: '#EE7334' },
  { bg: '#FFE2E2', ic: '#991B1B' },
];
