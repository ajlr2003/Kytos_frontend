import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Modal   from '../components/ui/Modal';
import Toast   from '../components/ui/Toast';
import AuthedImage from '../components/ui/AuthedImage';
import { API_BASE } from '../config.js';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmt(n, decimals = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-SA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtShort(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `SAR ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `SAR ${(n / 1_000).toFixed(0)}K`;
  return `SAR ${fmt(n)}`;
}

function daysUntil(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

// Group items by warehouse_location — returns top locations by qty
function groupByLocation(items) {
  const map = {};
  for (const item of items) {
    const loc = item.warehouse_location || 'Unassigned';
    if (!map[loc]) map[loc] = { name: loc, count: 0, qty: 0, value: 0 };
    map[loc].count += 1;
    map[loc].qty += item.stock_qty ?? 0;
    if (item.unit_price != null) map[loc].value += (item.unit_price * (item.stock_qty ?? 0));
  }
  return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
}

// Group items by supplier for valuation summary
function groupBySupplier(items) {
  const map = {};
  let grand = 0;
  for (const item of items) {
    const sup = item.supplier_manufacturer || 'Other';
    if (!map[sup]) map[sup] = { name: sup, count: 0, value: 0 };
    map[sup].count += 1;
    const val = (item.unit_price ?? 0) * (item.stock_qty ?? 0);
    map[sup].value += val;
    grand += val;
  }
  return { groups: Object.values(map).sort((a, b) => b.value - a.value).slice(0, 4), grand };
}

const PALETTE = ['#074E3B', '#1d4ed8', '#a16207', '#7c3aed'];

const EMPTY_ITEM = {
  warehouse_location: '', box_number: '', supplier_manufacturer: '',
  part_number: '', serial_number: '', description: '',
  expiry_date: '', stock_qty: 0, received_file_no: '', po_number: '',
  unit_price: '', receiving_delivery_status: '', customer_name: '', image_url: '',
};
const EMPTY_MOV = { item_id: '', movement_type: 'IN', quantity: 1, reference_no: '', delivery_note_no: '', notes: '' };

const CSV_FIELDS = [
  'warehouse_location', 'box_number', 'supplier_manufacturer', 'part_number', 'serial_number',
  'description', 'expiry_date', 'stock_qty', 'received_file_no', 'po_number', 'unit_price',
  'receiving_delivery_status', 'customer_name',
];

/* Minimal CSV parse/serialize — handles quoted fields with embedded commas. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(filename, rows) {
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Inventory({ goPage }) {
  const [items, setItems]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [kpis, setKpis]           = useState(null);
  const [search, setSearch]       = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [loading, setLoading]     = useState(false);
  const [toast, setToast]         = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // modals
  const [showAddItem, setShowAddItem]   = useState(false);
  const [editItem, setEditItem]         = useState(null);
  const [showMov, setShowMov]           = useState(false);

  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [movForm, setMovForm]   = useState(EMPTY_MOV);
  const [saving, setSaving]     = useState(false);

  const showToast = (msg) => setToast(msg);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: 500 });
      if (search) p.set('search', search);
      if (supplierFilter) p.set('supplier', supplierFilter);
      const r = await fetch(`${API_BASE}/api/v1/inventory/items?${p}`, { headers: authHeaders() });
      if (r.ok) { const d = await r.json(); setItems(d.items); setTotal(d.total); }
    } finally { setLoading(false); }
  }, [search, supplierFilter]);

  const fetchKpis = useCallback(async () => {
    const r = await fetch(`${API_BASE}/api/v1/inventory/kpis`, { headers: authHeaders() });
    if (r.ok) setKpis(await r.json());
  }, []);

  useEffect(() => { fetchItems(); fetchKpis(); }, [fetchItems, fetchKpis]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const supplierOptions = Array.from(new Set(items.map(i => i.supplier_manufacturer).filter(Boolean))).sort();
  const locationData = groupByLocation(items);
  const { groups: supplierGroups, grand: grandVal } = groupBySupplier(items);
  // Prefer the server-computed KPI (accurate over ALL items) over the client
  // sum, which only covers the currently-loaded page of items.
  const totalValuation = kpis?.total_valuation ?? grandVal;
  const lowStock = items.filter(i => i.stock_qty > 0 && i.stock_qty <= 5).sort((a, b) => a.stock_qty - b.stock_qty).slice(0, 5);
  const expiringSoon = items
    .filter(i => i.expiry_date && daysUntil(i.expiry_date) <= 30)
    .sort((a, b) => daysUntil(a.expiry_date) - daysUntil(b.expiry_date))
    .slice(0, 5);

  // ── Add / Edit ─────────────────────────────────────────────────────────────
  const openAdd = () => { setItemForm(EMPTY_ITEM); setEditItem(null); setShowAddItem(true); };
  const openEdit = (item) => {
    setItemForm({
      warehouse_location: item.warehouse_location ?? '', box_number: item.box_number ?? '',
      supplier_manufacturer: item.supplier_manufacturer ?? '', part_number: item.part_number ?? '',
      serial_number: item.serial_number ?? '', description: item.description ?? '',
      expiry_date: item.expiry_date ?? '', stock_qty: item.stock_qty ?? 0,
      received_file_no: item.received_file_no ?? '', po_number: item.po_number ?? '',
      unit_price: item.unit_price ?? '', receiving_delivery_status: item.receiving_delivery_status ?? '',
      customer_name: item.customer_name ?? '', image_url: item.image_url ?? '',
    });
    setEditItem(item);
    setShowAddItem(true);
  };

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  const uploadItemPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file'); return; }
    setUploadingPhoto(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const r = await fetch(`${API_BASE}/api/v1/documents/upload?description=Stock%20item%20photo`, { method: 'POST', headers: authHeaders(), body });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(data.detail ?? 'Failed to upload image'); return; }
      setItemForm(f => ({ ...f, image_url: `/api/v1/documents/${data.id}/download` }));
    } finally { setUploadingPhoto(false); }
  };

  const saveItem = async () => {
    if (!itemForm.part_number.trim()) { showToast('Part number is required'); return; }
    setSaving(true);
    try {
      const body = { ...itemForm, unit_price: itemForm.unit_price === '' ? null : Number(itemForm.unit_price), stock_qty: Number(itemForm.stock_qty) };
      const url = editItem ? `${API_BASE}/api/v1/inventory/items/${editItem.id}` : `${API_BASE}/api/v1/inventory/items`;
      const r = await fetch(url, { method: editItem ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) });
      if (r.ok) { showToast(editItem ? 'Item updated' : 'Item added'); setShowAddItem(false); fetchItems(); fetchKpis(); }
      else { const e = await r.json().catch(() => ({})); showToast(e.detail ?? 'Failed to save'); }
    } finally { setSaving(false); }
  };

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete ${item.part_number}?`)) return;
    const r = await fetch(`${API_BASE}/api/v1/inventory/items/${item.id}`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok || r.status === 204) { showToast('Item deleted'); fetchItems(); fetchKpis(); }
    else showToast('Delete failed');
  };

  // ── Movement ───────────────────────────────────────────────────────────────
  const openMov = (item, type = 'IN') => {
    setMovForm({ ...EMPTY_MOV, item_id: item?.id ?? '', movement_type: type });
    setShowMov(true);
  };

  const saveMov = async () => {
    if (!movForm.item_id) { showToast('Select an item'); return; }
    setSaving(true);
    try {
      const body = { ...movForm, quantity: Number(movForm.quantity) };
      const r = await fetch(`${API_BASE}/api/v1/inventory/movements`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) });
      if (r.ok) { showToast(`Stock ${movForm.movement_type} recorded`); setShowMov(false); fetchItems(); fetchKpis(); }
      else { const e = await r.json().catch(() => ({})); showToast(e.detail ?? 'Failed'); }
    } finally { setSaving(false); }
  };

  // ── Template / Import / Export ────────────────────────────────────────────
  const downloadTemplate = () => downloadCsv('stock-template.csv', [CSV_FIELDS]);

  const exportCsv = () => {
    const rows = [CSV_FIELDS, ...items.map(i => CSV_FIELDS.map(f => i[f] ?? ''))];
    downloadCsv(`stock-export-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const triggerUpload = () => fileInputRef.current?.click();

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) { showToast('CSV has no data rows'); return; }
    const header = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1);
    setImporting(true);
    let ok = 0, failed = 0;
    for (const r of dataRows) {
      const rec = {};
      header.forEach((h, idx) => { if (CSV_FIELDS.includes(h)) rec[h] = r[idx]?.trim() ?? ''; });
      if (!rec.part_number) { failed++; continue; }
      const body = {
        ...rec,
        stock_qty: rec.stock_qty ? Number(rec.stock_qty) : 0,
        unit_price: rec.unit_price ? Number(rec.unit_price) : null,
        expiry_date: rec.expiry_date || null,
      };
      try {
        const res = await fetch(`${API_BASE}/api/v1/inventory/items`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body),
        });
        if (res.ok) ok++; else failed++;
      } catch { failed++; }
    }
    setImporting(false);
    showToast(`Imported ${ok} item(s)${failed ? `, ${failed} failed` : ''}`);
    fetchItems(); fetchKpis();
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const inp = { width: '100%', height: 36, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
  const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

  return (
    <div id="inventory-page">
      <Sidebar activePage="inventory" goPage={goPage} />
      <div className="db-main">
        {/* Topbar */}
        <div className="tb">
          <div className="tb-title tb-title-block">
            <div>Warehouse Stock</div>
            <div className="tb-subtitle">Every stock item, its location, and its live IN/OUT status</div>
          </div>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user">
              <div className="tb-avatar" style={{background:'linear-gradient(135deg,#16a34a,#10b981)'}}>
                {(JSON.parse(localStorage.getItem('user')||'{}').full_name??'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div>
                <div className="tb-uname">{JSON.parse(localStorage.getItem('user')||'{}').full_name??'User'}</div>
                <div className="tb-urole">{JSON.parse(localStorage.getItem('user')||'{}').role??''}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="pg">
          {/* Header actions */}
          <div className="pg-header">
            <div className="pg-header-left"></div>
            <div className="pg-header-actions">
              <button className="nrfq-btn-ghost" onClick={downloadTemplate}>↓ Template</button>
              <button className="nrfq-btn-ghost" onClick={triggerUpload} disabled={importing}>
                {importing ? 'Importing…' : '↑ Upload Excel/CSV'}
              </button>
              <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleUpload} />
              <button className="btn-action btn-green" onClick={exportCsv}>
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export CSV
              </button>
              <button className="btn-action btn-blue" onClick={openAdd}>
                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Stock
              </button>
            </div>
          </div>

          {/* KPI Row */}
          <div className="kpi-row" style={{marginBottom:'20px'}}>
            <div className="kpi">
              <div className="kpi-label">Stock Items</div>
              <div className="kpi-body">
                <div className="kpi-value">{kpis ? kpis.total_items.toLocaleString() : '—'}</div>
                <div className="kpi-icon ic-b"><svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></div>
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Low Stock</div>
              <div className="kpi-body">
                <div className="kpi-value" style={{color: kpis?.low_stock_count > 0 ? '#a16207' : '#111827'}}>{kpis?.low_stock_count ?? '—'}</div>
                <div className="kpi-icon ic-o"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Out of Stock</div>
              <div className="kpi-body">
                <div className="kpi-value" style={{color: kpis?.zero_stock_count > 0 ? '#b91c1c' : '#111827'}}>{kpis?.zero_stock_count ?? '—'}</div>
                <div className="kpi-icon ic-p"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Expiring ≤30d</div>
              <div className="kpi-body">
                <div className="kpi-value" style={{color: kpis?.expiring_soon_count > 0 ? '#a16207' : '#111827'}}>{kpis?.expiring_soon_count ?? '—'}</div>
                <div className="kpi-icon ic-o"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Txn Today</div>
              <div className="kpi-body">
                <div className="kpi-value">{kpis?.movements_today ?? '—'}</div>
                <div className="kpi-icon ic-g"><svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>
              </div>
            </div>
          </div>

          {/* Main dashboard grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '18px', alignItems: 'start' }}>
            <div>

              {/* Stock by Location */}
              <div className="rfq-odoo-card" style={{ padding: '20px 22px', marginBottom: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Stock by Location</div>
                {locationData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0', fontSize: '13px' }}>No stock data yet — add items to see location breakdown.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(locationData.length, 5)},1fr)`, gap: '12px' }}>
                    {locationData.map(loc => (
                      <div key={loc.name} style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px 16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginBottom: '12px', wordBreak: 'break-all' }}>{loc.name}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12.5px', color: '#6b7280' }}>Items</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>{loc.count}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12.5px', color: '#6b7280' }}>Qty</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>{loc.qty}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12.5px', color: '#6b7280' }}>Value</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>{loc.value > 0 ? fmtShort(loc.value) : '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Stock table */}
              <div className="rfq-odoo-card">
                <div className="rfq-toolbar">
                  <div className="rfq-breadcrumb">
                    Stock Items
                    <span style={{ fontSize: '12px', fontWeight: 400, color: '#9ca3af', marginLeft: '8px' }}>{total.toLocaleString()} item(s)</span>
                  </div>
                  <div className="rfq-toolbar-search">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <select
                    value={supplierFilter}
                    onChange={e => setSupplierFilter(e.target.value)}
                    style={{ height: '36px', padding: '0 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', color: '#374151', background: '#fff', cursor: 'pointer' }}
                    title="Filter by supplier/manufacturer — this app has no separate category field yet"
                  >
                    <option value="">All Suppliers</option>
                    {supplierOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="rfq-odoo-table">
                    <thead>
                      <tr>
                        <th>Location / Box</th>
                        <th>Description</th>
                        <th>Part No.</th>
                        <th>Serial No.</th>
                        <th>Supplier / MFG</th>
                        <th className="right">Qty</th>
                        <th>Expiry</th>
                        <th>File Ref</th>
                        <th className="center">Status</th>
                        <th style={{ width: '110px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && <tr><td colSpan={10} style={{ padding: '28px 22px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Loading…</td></tr>}
                      {!loading && items.length === 0 && (
                        <tr><td colSpan={10} style={{ padding: '28px 22px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No items found. Click "Add Stock" to get started.</td></tr>
                      )}
                      {items.map(item => {
                        const out = item.stock_qty === 0;
                        return (
                          <tr key={item.id} className="rfq-odoo-row">
                            <td>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{item.warehouse_location || '—'}</div>
                              {item.box_number && <div style={{ fontSize: '11.5px', color: '#9ca3af' }}>{item.box_number}</div>}
                            </td>
                            <td style={{ maxWidth: 220 }}>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{item.description || item.part_number}</div>
                            </td>
                            <td style={{ color: '#374151' }}>{item.part_number}</td>
                            <td style={{ color: '#6b7280', fontSize: '13px' }}>{item.serial_number || '—'}</td>
                            <td style={{ color: '#374151' }}>{item.supplier_manufacturer || '—'}</td>
                            <td className="right">
                              <div style={{ fontWeight: 700, color: out ? '#dc2626' : item.stock_qty <= 5 ? '#d97706' : '#15803d' }}>{item.stock_qty}</div>
                            </td>
                            <td style={{ color: '#6b7280', fontSize: '13px' }}>{item.expiry_date ? fmtDate(item.expiry_date) : '—'}</td>
                            <td style={{ color: '#374151' }}>{item.received_file_no || '—'}</td>
                            <td className="center">
                              <span style={{ background: out ? '#fee2e2' : '#dcfce7', color: out ? '#b91c1c' : '#15803d', fontSize: '11.5px', fontWeight: 700, padding: '2px 9px', borderRadius: '10px' }}>
                                {out ? 'Out of Stock' : 'In Stock'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <button onClick={() => openMov(item, 'IN')} title="Stock IN" style={{ height: 24, padding: '0 8px', background: '#ecfef6', color: '#074E3B', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↓ IN</button>
                                <button onClick={() => openMov(item, 'OUT')} title="Stock OUT" style={{ height: 24, padding: '0 8px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↑ OUT</button>
                                <button onClick={() => openEdit(item)} title="Edit" style={{ height: 24, width: 24, background: '#f3f4f6', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>✎</button>
                                <button onClick={() => deleteItem(item)} title="Delete" style={{ height: 24, width: 24, background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>✕</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>{/* end left col */}

            {/* Right sidebar widgets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Low Stock Alerts */}
              <div className="rfq-odoo-card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#111827', marginBottom: '14px' }}>Low Stock Alerts</div>
                {lowStock.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#074E3B', fontSize: '13px', padding: '12px 0' }}>All items are sufficiently stocked.</div>
                )}
                {lowStock.map(item => (
                  <div key={item.id} style={{ padding: '12px 14px', borderRadius: '9px', background: '#fffbeb', border: '1px solid #fde68a', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{item.part_number}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{item.description ? item.description.slice(0, 26) : (item.supplier_manufacturer || '—')}</div>
                        <div style={{ fontSize: '12px', color: '#d97706', fontWeight: 600 }}>Only {item.stock_qty} left</div>
                      </div>
                      <button style={{ height: '28px', padding: '0 12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }} onClick={() => openMov(item, 'IN')}>Reorder</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Expiring Soon */}
              <div className="rfq-odoo-card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#111827', marginBottom: '14px' }}>Expiring Soon</div>
                {expiringSoon.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#074E3B', fontSize: '13px', padding: '12px 0' }}>Nothing expiring in the next 30 days.</div>
                )}
                {expiringSoon.map(item => {
                  const d = daysUntil(item.expiry_date);
                  return (
                    <div key={item.id} style={{ padding: '12px 14px', borderRadius: '9px', background: d < 0 ? '#fff5f5' : '#fff7ed', border: `1px solid ${d < 0 ? '#fecaca' : '#fed7aa'}`, marginBottom: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{item.part_number}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>{item.description ? item.description.slice(0, 26) : (item.supplier_manufacturer || '—')}</div>
                      <div style={{ fontSize: '12px', color: d < 0 ? '#dc2626' : '#c2410c', fontWeight: 600 }}>{d < 0 ? `Expired ${Math.abs(d)}d ago` : d === 0 ? 'Expires today' : `Expires in ${d}d`}</div>
                    </div>
                  );
                })}
              </div>

              {/* Stock Valuation Summary */}
              <div className="rfq-odoo-card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Stock Valuation Summary</div>
                {supplierGroups.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '12px 0' }}>No valuation data yet.</div>
                )}
                {supplierGroups.map((s, i) => {
                  const pct = totalValuation > 0 ? ((s.value / totalValuation) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={s.name} style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>{s.name}</span>
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827' }}>{fmtShort(s.value)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>{s.count} item{s.count !== 1 ? 's' : ''}</span>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: PALETTE[i % PALETTE.length] }}>{pct}% of total</span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ padding: '14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Total Valuation</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>{fmtShort(totalValuation)}</span>
                </div>
              </div>

            </div>{/* end right col */}
          </div>
        </div>
      </div>

      {/* ── Add / Edit Item Modal ── */}
      {showAddItem && (
        <Modal title={editItem ? 'Edit Item' : 'Add Stock Item'} onClose={() => setShowAddItem(false)} width={680}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
            <div
              onClick={() => !uploadingPhoto && photoInputRef.current?.click()}
              style={{width:72,height:72,borderRadius:10,border:'1.5px dashed #d1d5db',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',cursor:uploadingPhoto?'wait':'pointer',flexShrink:0,background:'#fafafa'}}
            >
              <input ref={photoInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={uploadItemPhoto} />
              {itemForm.image_url ? (
                <AuthedImage
                  src={itemForm.image_url}
                  alt="Item"
                  style={{width:'100%',height:'100%',objectFit:'cover'}}
                  fallback={<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#9ca3af" strokeWidth="1.6"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
                />
              ) : (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#9ca3af" strokeWidth="1.6"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              )}
            </div>
            <div style={{fontSize:12,color:'#6b7280'}}>{uploadingPhoto ? 'Uploading…' : 'Click to add a photo of this item'}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {[
              ['part_number','Part Number *','text'],
              ['serial_number','Serial Number','text'],
              ['description','Description','text'],
              ['supplier_manufacturer','Supplier / MFG','text'],
              ['warehouse_location','W. Location (e.g. BAY05-C03-R04)','text'],
              ['box_number','Box #','text'],
              ['stock_qty','Stock Qty','number'],
              ['unit_price','Unit Price (SAR)','number'],
              ['expiry_date','Expiry Date','date'],
              ['received_file_no','File Ref (Received File No.)','text'],
              ['po_number','PO No.','text'],
              ['receiving_delivery_status','Status / Delivery Note','text'],
              ['customer_name','Reserved For (Customer)','text'],
            ].map(([field,label,type])=>(
              <div key={field} style={['description','receiving_delivery_status'].includes(field)?{gridColumn:'span 2'}:{}}>
                <label style={lbl}>{label}</label>
                <input
                  type={type}
                  style={inp}
                  value={itemForm[field]}
                  onChange={e=>setItemForm(f=>({...f,[field]:e.target.value}))}
                  min={type==='number'?0:undefined}
                  step={field==='unit_price'?'0.01':undefined}
                />
              </div>
            ))}
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:22}}>
            <button className="nrfq-btn-ghost" onClick={()=>setShowAddItem(false)}>Cancel</button>
            <button className="nrfq-btn-primary" onClick={saveItem} disabled={saving}>{saving?'Saving…':editItem?'Update':'Add Item'}</button>
          </div>
        </Modal>
      )}

      {/* ── Stock Movement Modal ── */}
      {showMov && (
        <Modal title="Record Stock Movement" onClose={() => setShowMov(false)} width={460}>
          <div style={{display:'flex',gap:10,marginBottom:16}}>
            {['IN','OUT'].map(t=>(
              <button key={t} style={{flex:1,height:40,borderRadius:8,border:movForm.movement_type===t?'none':'1px solid #e5e7eb',background:movForm.movement_type===t?(t==='IN'?'#074E3B':'#dc2626'):'#fff',color:movForm.movement_type===t?'#fff':'#374151',fontWeight:700,cursor:'pointer'}} onClick={()=>setMovForm(f=>({...f,movement_type:t}))}>
                {t==='IN'?'↓ Stock IN':'↑ Stock OUT'}
              </button>
            ))}
          </div>
          <div style={{marginBottom:12}}>
            <label style={lbl}>Item *</label>
            <select style={{...inp}} value={movForm.item_id} onChange={e=>setMovForm(f=>({...f,item_id:e.target.value}))}>
              <option value="">— Select item —</option>
              {items.map(i=><option key={i.id} value={i.id}>{i.part_number}{i.description?` — ${i.description.slice(0,40)}`:''}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={lbl}>Quantity *</label>
              <input type="number" min={1} style={inp} value={movForm.quantity} onChange={e=>setMovForm(f=>({...f,quantity:e.target.value}))}/>
            </div>
            <div>
              <label style={lbl}>{movForm.movement_type==='IN'?'PO / RFQ Reference':'SO Reference'}</label>
              <input style={inp} placeholder="e.g. PO-16012" value={movForm.reference_no} onChange={e=>setMovForm(f=>({...f,reference_no:e.target.value}))}/>
            </div>
            <div>
              <label style={lbl}>Delivery Note No.</label>
              <input style={inp} value={movForm.delivery_note_no} onChange={e=>setMovForm(f=>({...f,delivery_note_no:e.target.value}))}/>
            </div>
            <div>
              <label style={lbl}>Notes</label>
              <input style={inp} value={movForm.notes} onChange={e=>setMovForm(f=>({...f,notes:e.target.value}))}/>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:22}}>
            <button className="nrfq-btn-ghost" onClick={()=>setShowMov(false)}>Cancel</button>
            <button className="nrfq-btn-primary" onClick={saveMov} disabled={saving}>{saving?'Saving…':`Record ${movForm.movement_type}`}</button>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

export default Inventory;
