/**
 * src/components/layout/Sidebar.jsx
 *
 * Fixed-position left navigation sidebar shared by every authenticated page.
 * Renders the Kytos logo, the full application navigation menu, and any
 * page-specific extra nav items passed via the `extraNav` prop.
 *
 * Nav items are organized into collapsible sections (Finance, Revenue,
 * Operations, Insights) so the sidebar doesn't read as one long flat list —
 * only the section containing the current page starts expanded.
 *
 * Props:
 *   activePage {string}       - Key of the currently active page (sets .active class).
 *   goPage     {(key) => void} - Callback to change the active page in App state.
 *   extraNav   {ReactNode}    - Optional additional nav items rendered below the list.
 *
 * Requires `.sb`, `.sb-*`, `.ni`, and `.ni.active` CSS classes from shared.css.
 */

import { useState, useEffect } from 'react';
import { API_BASE } from '../../config.js';

/* ─── Navigation item definitions ──────────────────────────────── */
const DASHBOARD_ITEM = {
  key: 'dashboard',
  label: 'Dashboard',
  icon: (
    <svg viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
};

const PURCHASES_ITEM = {
  key: 'purchases',
  label: 'Purchases',
  icon: (
    <svg viewBox="0 0 24 24">
      <circle cx="9" cy="21" r="1"/>
      <circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  ),
};

const SALES_ITEM = {
  key: 'sales',
  label: 'Sales',
  icon: (
    <svg viewBox="0 0 24 24">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
};

const CRM_ITEM = {
  key: 'crm',
  label: 'CRM',
  icon: (
    <svg viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
};

const ACCOUNTING_ITEM = {
  key: 'accounting',
  label: 'Accounting',
  icon: (
    <svg viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
};

const INVOICING_ITEM = {
  key: 'invoicing',
  label: 'Invoicing',
  icon: (
    <svg viewBox="0 0 24 24">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
};

const EXPENSES_ITEM = {
  key: 'expenses',
  label: 'Expenses',
  icon: (
    <svg viewBox="0 0 24 24">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
};

const INVENTORY_ITEM = {
  key: 'inventory',
  label: 'Inventory',
  icon: (
    <svg viewBox="0 0 24 24">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
};

const PROJECTS_ITEM = {
  key: 'projects',
  label: 'Projects',
  icon: (
    <svg viewBox="0 0 24 24">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
};

const CONTRACTS_ITEM = {
  key: 'contracts',
  label: 'Contracts',
  icon: (
    <svg viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9.5 15.5c0 .83.9 1.5 2 1.5s2-.67 2-1.5-.9-1.5-2-1.5-2-.67-2-1.5.9-1.5 2-1.5 2 .67 2 1.5"/>
      <line x1="11.5" y1="11" x2="11.5" y2="12"/>
      <line x1="11.5" y1="17.5" x2="11.5" y2="18.5"/>
    </svg>
  ),
};

const DOCUMENTS_ITEM = {
  key: 'documents',
  label: 'Documents',
  icon: (
    <svg viewBox="0 0 24 24">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
};

const INTELLIGENCE_ITEM = {
  key: 'intelligence',
  label: 'Intelligence',
  icon: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4"/>
      <path d="M12 8h.01"/>
    </svg>
  ),
};

const AICOPILOT_ITEM = {
  key: 'aicopilot',
  label: 'AI Copilot',
  icon: (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="8" width="18" height="12" rx="2"/>
      <path d="M9 8V6a3 3 0 0 1 6 0v2"/>
      <circle cx="9" cy="14" r="1" fill="currentColor"/>
      <circle cx="15" cy="14" r="1" fill="currentColor"/>
      <path d="M9 17h6"/>
    </svg>
  ),
};

const USERS_NAV_ITEM = {
  key: 'users',
  label: 'Users',
  icon: (
    <svg viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
};

/* Top-level entries: standalone items render like before; groups collapse
   into a single header line until expanded (or until they contain the
   active page). Keeps every existing page/route unchanged — this only
   reorganizes navigation, nothing gets merged. */
const NAV_STRUCTURE = [
  { type: 'item', item: DASHBOARD_ITEM },
  { type: 'group', key: 'revenue',    label: 'Revenue',    items: [SALES_ITEM, CRM_ITEM] },
  { type: 'group', key: 'finance',    label: 'Finance',    items: [ACCOUNTING_ITEM, INVOICING_ITEM, EXPENSES_ITEM] },
  { type: 'item', item: PURCHASES_ITEM },
  { type: 'group', key: 'operations', label: 'Operations', items: [INVENTORY_ITEM, PROJECTS_ITEM, CONTRACTS_ITEM, DOCUMENTS_ITEM] },
  { type: 'group', key: 'insights',   label: 'Insights',   items: [INTELLIGENCE_ITEM, AICOPILOT_ITEM] },
];

function defaultOpenSection(activePage) {
  const group = NAV_STRUCTURE.find(e => e.type === 'group' && e.items.some(i => i.key === activePage));
  return group?.key ?? null;
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function Sidebar({ activePage, goPage, extraNav, subNavGroups }) {
  const [openGroup, setOpenGroup] = useState(subNavGroups?.[0]?.key ?? null);
  const [openSection, setOpenSection] = useState(() => defaultOpenSection(activePage));
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_BASE}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(u => { if (u?.role === 'admin') setIsAdmin(true); })
      .catch(() => {});
  }, []);

  function renderNavItem(item) {
    return (
      <div key={item.key}>
        <a
          className={`ni${activePage === item.key ? ' active' : ''}`}
          href="#"
          onClick={e => { e.preventDefault(); goPage(item.key); }}
        >
          {item.icon}
          {item.label}
        </a>
        {activePage === item.key && subNavGroups && subNavGroups.length > 0 && (
          <div className="sb-subnav">
            {subNavGroups.map(group => (
              <div key={group.key}>
                <a
                  className={`sb-navgroup${openGroup === group.key ? ' open' : ''}`}
                  href="#"
                  onClick={e => { e.preventDefault(); setOpenGroup(p => p === group.key ? null : group.key); }}
                >
                  {group.label}
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </a>
                {openGroup === group.key && (
                  <div className="sb-subnav2">
                    {group.children.map(sub => (
                      <a
                        key={sub.label}
                        className={`sb-navsub${sub.active ? ' active' : ''}`}
                        href="#"
                        onClick={e => { e.preventDefault(); sub.onClick(); }}
                      >
                        {sub.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="sb">
      {/* ── Brand / Logo ── */}
      <div className="sb-brand">
        <div className="sb-ico">
          <img
            src="/kytos logo.jpg"
            alt="Kytos logo"
            style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '8px' }}
          />
        </div>
        <div>
          <div className="sb-name">KYTOS</div>
          <div className="sb-sub">Smart Management</div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="sb-nav">
        {NAV_STRUCTURE.map(entry => {
          if (entry.type === 'item') return renderNavItem(entry.item);

          const isOpen = openSection === entry.key;
          return (
            <div key={entry.key}>
              <a
                className={`ni${isOpen ? ' active' : ''}`}
                href="#"
                onClick={e => { e.preventDefault(); setOpenSection(p => p === entry.key ? null : entry.key); }}
                style={{ justifyContent: 'space-between' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {entry.label}
                </span>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </a>
              {isOpen && (
                <div style={{ paddingLeft: '14px' }}>
                  {entry.items.map(renderNavItem)}
                </div>
              )}
            </div>
          );
        })}

        {/* Extra items injected by the host page (e.g. sub-routes) */}
        {extraNav}
      </nav>

      {/* ── Admin-only account area ── */}
      {isAdmin && (
        <a
          className={`ni${activePage === 'users' ? ' active' : ''}`}
          href="#"
          onClick={e => { e.preventDefault(); goPage('users'); }}
          style={{ marginTop: 'auto' }}
        >
          {USERS_NAV_ITEM.icon}
          {USERS_NAV_ITEM.label}
        </a>
      )}

      {/* ── Log out ── */}
      <a
        className="ni"
        href="#"
        onClick={e => {
          e.preventDefault();
          localStorage.removeItem('token');
          window.location.reload();
        }}
        style={{ marginTop: isAdmin ? 0 : 'auto', color: '#dc2626' }}
      >
        <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Log Out
      </a>
    </div>
  );
}
