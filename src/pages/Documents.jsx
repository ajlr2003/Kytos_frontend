import { useEffect, useRef, useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { API_BASE } from '../config.js';
import '../styles/Documents.css';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const TYPE_COLOR  = { pdf: '#dc2626', excel: '#16a34a', word: '#2563eb', image: '#d97706', other: '#6b7280' };
const TYPE_LABEL  = { pdf: 'PDF', excel: 'XLSX', word: 'DOCX', image: 'IMG', other: 'FILE' };
const FOLDER_TYPES = ['all', 'pdf', 'excel', 'word', 'image', 'other'];
const FOLDER_NAMES = { all: 'All Documents', pdf: 'PDFs', excel: 'Spreadsheets', word: 'Word Docs', image: 'Images', other: 'Other' };

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Toast({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', padding: '10px 20px', borderRadius: '8px', fontSize: '13.5px', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '8px' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{msg}
    </div>
  );
}

function UploadModal({ onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [desc, setDesc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef();

  async function upload() {
    if (!file) { setError('Select a file first.'); return; }
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = `${API_BASE}/api/v1/documents/upload${desc ? `?description=${encodeURIComponent(desc)}` : ''}`;
      const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: fd });
      if (!res.ok) throw new Error((await res.json()).detail || 'Upload failed');
      onUploaded(await res.json());
      onClose();
    } catch (e) { setError(e.message); setUploading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '440px', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontSize: '17px', fontWeight: 700, color: '#111827', marginBottom: '20px' }}>Upload Document</div>

        <div
          onClick={() => inputRef.current.click()}
          style={{ border: '2px dashed #d1d5db', borderRadius: '10px', padding: '32px', textAlign: 'center', cursor: 'pointer', marginBottom: '16px', background: file ? '#f0fdf4' : '#fafafa' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={file ? '#16a34a' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          {file ? (
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#16a34a' }}>{file.name} ({fmtSize(file.size)})</div>
          ) : (
            <div style={{ fontSize: '13.5px', color: '#6b7280' }}>Click to browse or drop a file here</div>
          )}
          <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0] || null)} />
        </div>

        <textarea
          placeholder="Description (optional)"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          rows={2}
          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '9px 12px', fontSize: '13.5px', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
        />

        {error && <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', color: '#374151', fontSize: '13.5px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={upload} disabled={uploading} style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', background: '#7c3aed', color: '#fff', fontSize: '13.5px', fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? .7 : 1 }}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Documents({ goPage }) {
  const [docs, setDocs]       = useState([]);
  const [kpis, setKpis]       = useState(null);
  const [folder, setFolder]   = useState('all');
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast]     = useState('');
  const [deleting, setDeleting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  async function loadCurrentUser() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/me`, { headers: authHeaders() });
      if (res.ok) setCurrentUser(await res.json());
    } catch {}
  }

  async function loadDocs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folder !== 'all') params.set('doc_type', folder);
      if (search) params.set('search', search);
      const res = await fetch(`${API_BASE}/api/v1/documents?${params}`, { headers: authHeaders() });
      const data = await res.json();
      setDocs(data.items || []);
    } finally { setLoading(false); }
  }

  async function loadKpis() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/documents/kpis`, { headers: authHeaders() });
      setKpis(await res.json());
    } catch {}
  }

  useEffect(() => { loadDocs(); }, [folder, search]);
  useEffect(() => { loadKpis(); loadCurrentUser(); }, []);

  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/api/v1/documents/${selected.id}`, { method: 'DELETE', headers: authHeaders() });
      setDocs(d => d.filter(x => x.id !== selected.id));
      setSelected(null);
      setToast('Document deleted');
      loadKpis();
    } finally { setDeleting(false); }
  }

  async function handleDownload(doc) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/documents/${doc.id}/download`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.original_filename; a.click();
      URL.revokeObjectURL(url);
    } catch { setToast('Download failed'); }
  }

  function onUploaded(doc) {
    setDocs(d => [doc, ...d]);
    setToast(`Uploaded: ${doc.original_filename}`);
    loadKpis();
  }

  const totalSize = kpis?.total_size_bytes || 0;
  const fmtStorage = totalSize < 1024 * 1024 * 1024
    ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
    : `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;

  return (
    <div id="documents-page">
      <Sidebar activePage="documents" goPage={goPage} />
      <div className="db-main">

        {/* Top bar */}
        <div className="tb">
          <div className="tb-title tb-title-block">
            <div>Document Center</div>
            <div className="tb-subtitle">Upload, organize, and download all business documents</div>
          </div>
          <div className="tb-right">
            <div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div className="tb-user"><div className="tb-avatar" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>{currentUser?.full_name ? currentUser.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U'}</div><div><div className="tb-uname">{currentUser?.full_name ?? 'User'}</div><div className="tb-urole">{currentUser?.role ?? ''}</div></div></div>
          </div>
        </div>

        <div className="pg">
          {/* Header */}
          <div className="pg-header">
            <div className="pg-header-left"></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-blue" onClick={() => setShowUpload(true)}>
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload Document
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="kpi-row" style={{ marginBottom: '20px' }}>
            <div className="kpi"><div className="kpi-label">Total Documents</div><div className="kpi-body"><div className="kpi-value">{kpis?.total_documents ?? '—'}</div><div className="kpi-icon ic-b"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div></div></div>
            <div className="kpi"><div className="kpi-label">PDFs</div><div className="kpi-body"><div className="kpi-value">{kpis?.by_type?.pdf ?? 0}</div><div className="kpi-icon ic-o"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div></div></div>
            <div className="kpi"><div className="kpi-label">Storage Used</div><div className="kpi-body"><div className="kpi-value">{fmtStorage}</div><div className="kpi-icon ic-g"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div></div></div>
            <div className="kpi"><div className="kpi-label">Other Files</div><div className="kpi-body"><div className="kpi-value">{kpis ? (kpis.total_documents - (kpis.by_type?.pdf ?? 0)) : '—'}</div><div className="kpi-icon ic-p"><svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div></div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 260px', gap: '18px', alignItems: 'start' }}>

            {/* Left: Folders */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '18px' }}>
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Folders</div>
              {FOLDER_TYPES.map(ft => {
                const count = ft === 'all' ? (kpis?.total_documents ?? 0) : (kpis?.by_type?.[ft] ?? 0);
                const active = folder === ft;
                return (
                  <div key={ft} onClick={() => setFolder(ft)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: '8px', marginBottom: '3px', cursor: 'pointer', background: active ? '#ede9fe' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? '#7c3aed' : '#374151'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                      <span style={{ fontSize: '13.5px', fontWeight: active ? 700 : 400, color: active ? '#7c3aed' : '#374151' }}>{FOLDER_NAMES[ft]}</span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: active ? '#7c3aed' : '#9ca3af', background: active ? '#ddd6fe' : '#f3f4f6', padding: '1px 8px', borderRadius: '10px' }}>{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Center: Document list */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.06)', overflow: 'hidden' }}>
              {/* Search bar */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <svg style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', width: '14px', stroke: '#9ca3af', fill: 'none' }} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…" style={{ width: '100%', height: '36px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 12px 0 34px', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* List */}
              {loading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Loading…</div>
              ) : docs.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <div style={{ color: '#9ca3af', fontSize: '13.5px' }}>No documents yet — upload one to get started</div>
                </div>
              ) : docs.map(doc => (
                <div key={doc.id} onClick={() => setSelected(doc)} style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selected?.id === doc.id ? '#faf5ff' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{ width: '32px', height: '38px', background: TYPE_COLOR[doc.document_type] || '#6b7280', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '8px', fontWeight: 800, color: '#fff' }}>{TYPE_LABEL[doc.document_type] || 'FILE'}</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>{doc.original_filename}</div>
                        <div style={{ fontSize: '11.5px', color: '#9ca3af', marginTop: '2px' }}>{fmtSize(doc.file_size_bytes)} · {fmtDate(doc.created_at)}</div>
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDownload(doc); }} style={{ padding: '5px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', color: '#374151', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                  </div>
                  {doc.description && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px', paddingLeft: '42px' }}>{doc.description}</div>}
                </div>
              ))}

              <div style={{ padding: '12px 18px', borderTop: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Right: Preview + Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '18px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#111827', marginBottom: '14px' }}>Document Details</div>
                {selected ? (
                  <>
                    <div style={{ background: '#f8fafc', borderRadius: '9px', border: '1px solid #e5e7eb', padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '14px' }}>
                      <div style={{ width: '40px', height: '48px', background: TYPE_COLOR[selected.document_type] || '#6b7280', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: '#fff' }}>{TYPE_LABEL[selected.document_type] || 'FILE'}</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#374151', fontWeight: 500, textAlign: 'center', wordBreak: 'break-all' }}>{selected.original_filename}</div>
                    </div>
                    {[['Type', (TYPE_LABEL[selected.document_type] || 'File') + ' Document'], ['Size', fmtSize(selected.file_size_bytes)], ['Uploaded', fmtDate(selected.created_at)], ['Description', selected.description || '—']].map(([label, val]) => (
                      <div key={label} style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', wordBreak: 'break-word' }}>{val}</div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: '13px' }}>Select a document to see details</div>
                )}
              </div>

              {selected && (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '18px' }}>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Actions</div>
                  <button onClick={() => handleDownload(selected)} style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff', color: '#7c3aed', fontWeight: 600, fontSize: '13.5px' }}>
                    Download File
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                  <button onClick={handleDelete} disabled={deleting} style={{ width: '100%', padding: '11px 12px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#dc2626', fontWeight: 600, fontSize: '13.5px' }}>
                    {deleting ? 'Deleting…' : 'Delete Document'}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onUploaded={onUploaded} />}
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  );
}

export default Documents;
