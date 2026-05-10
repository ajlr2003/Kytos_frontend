// =============================================================================
// src/config.js
// -----------------------------------------------------------------------------
// Central configuration. In production (Vercel), VITE_API_BASE_URL points to
// the Render backend. In local dev the value is empty so fetch('/api/...')
// is handled by the Vite dev-server proxy.
// =============================================================================

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
