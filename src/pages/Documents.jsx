import Sidebar from '../components/Sidebar';
import '../styles/Documents.css';

function Documents({ goPage }) {
  return (
    <div id="documents-page">
      <Sidebar activePage="documents" goPage={goPage} />
      <div className="db-main">
        <div className="tb"><span className="tb-title"></span><div className="tb-right"><div className="tb-bell"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><div className="tb-user"><div className="tb-avatar" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>SJ</div><div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div></div></div></div>
        <div className="pg">
          <div className="pg-header">
            <div className="pg-header-left"><h1>Document Center</h1><p>Organize, search, and manage all business documents with AI-powered extraction</p></div>
            <div className="pg-header-actions">
              <button className="btn-action btn-purple"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>OCR Extract</button>
              <button className="btn-action btn-blue"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload Document</button>
            </div>
          </div>
          <div className="kpi-row" style={{ marginBottom: '20px' }}>
            <div className="kpi"><div className="kpi-label">Total Documents</div><div className="kpi-body"><div className="kpi-value">2,847</div><div className="kpi-icon ic-b"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div></div><div className="kpi-chg up"><svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>+142 this month</div></div>
            <div className="kpi"><div className="kpi-label">Pending Review</div><div className="kpi-body"><div className="kpi-value">23</div><div className="kpi-icon ic-o"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div></div><div style={{ fontSize: '13px', fontWeight: 500, color: '#d97706', marginTop: '6px' }}>Needs processing</div></div>
            <div className="kpi"><div className="kpi-label">Storage Used</div><div className="kpi-body"><div className="kpi-value">847 GB</div><div className="kpi-icon ic-g"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div></div><div style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280', marginTop: '6px' }}>68% of limit</div></div>
            <div className="kpi"><div className="kpi-label">OCR Processed</div><div className="kpi-body"><div className="kpi-value">1,924</div><div className="kpi-icon ic-p"><svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div></div><div style={{ fontSize: '13px', fontWeight: 500, color: '#7c3aed', marginTop: '6px' }}>AI extracted</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr 260px', gap: '18px', alignItems: 'start' }}>
            {/* Left: Folders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '18px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Folders</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: '8px', background: '#ede9fe', marginBottom: '3px', cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span style={{ fontSize: '13.5px', fontWeight: 700, color: '#7c3aed' }}>All Documents</span></div><span style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed', background: '#ddd6fe', padding: '1px 8px', borderRadius: '10px' }}>2,847</span></div>
                {[['Invoices',847],['Contracts',234],['Reports',412],['Purchase Orders',156],['HR Documents',89]].map(([name,count]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: '8px', marginBottom: '3px', cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style={{ fontSize: '13.5px', color: '#374151' }}>{name}</span></div><span style={{ fontSize: '12px', color: '#9ca3af' }}>{count}</span></div>
                ))}
              </div>
            </div>
            {/* Center: Document List */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.06)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative', flex: 1 }}><svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', stroke: '#9ca3af', fill: 'none' }} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input style={{ width: '100%', height: '36px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 14px 0 34px', fontSize: '13.5px', color: '#374151', outline: 'none' }} placeholder="Search documents..."/></div>
                <button style={{ height: '36px', padding: '0 14px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>Filter</button>
                <button style={{ height: '36px', padding: '0 14px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg>Sort</button>
              </div>
              {[
                { name:'Invoice_TechCorp_2024_001.pdf', type:'PDF', date:'Dec 15, 2024', size:'2.4 MB', tags:['Invoice','Financial'], modified:'Dec 14, 2024', linked:'Invoice #INV-2024-001' },
                { name:'Service_Agreement_GlobalInd.docx', type:'DOCX', date:'Dec 12, 2024', size:'1.8 MB', tags:['Contract','Legal'], modified:'Dec 13, 2024', linked:'Client: Global Industries' },
                { name:'Q4_Financial_Report_2024.xlsx', type:'XLSX', date:'Dec 10, 2024', size:'5.2 MB', tags:['Report','Financial'], modified:'Dec 11, 2024', linked:'FY2024 Q4' },
                { name:'Vendor_Contract_TechSupply.pdf', type:'PDF', date:'Dec 8, 2024', size:'3.8 MB', tags:['Contract','Legal'], modified:'Dec 11, 2024', linked:'Vendor #VEN-2024-012' },
              ].map(doc => (
                <div key={doc.name} style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '38px', background: doc.type === 'PDF' ? '#dc2626' : doc.type === 'XLSX' ? '#16a34a' : '#2563eb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ fontSize: '8px', fontWeight: 800, color: '#fff' }}>{doc.type}</span></div>
                      <div><div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>{doc.name}</div></div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '5px' }}>Connected to: {doc.linked} &nbsp;·&nbsp; Size: {doc.size} &nbsp;·&nbsp; Modified: {doc.modified}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>{doc.tags.map(t => <span key={t} style={{ background: '#f3f4f6', color: '#374151', fontSize: '11.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px' }}>{t}</span>)}</div>
                </div>
              ))}
              <div style={{ padding: '14px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>Showing 1-4 of 2,847 documents</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button style={{ height: '32px', padding: '0 12px', border: '1px solid #e5e7eb', borderRadius: '7px', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>Previous</button>
                  <button style={{ height: '32px', width: '32px', border: 'none', borderRadius: '7px', background: '#7c3aed', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>1</button>
                  <button style={{ height: '32px', width: '32px', border: '1px solid #e5e7eb', borderRadius: '7px', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>2</button>
                  <button style={{ height: '32px', width: '32px', border: '1px solid #e5e7eb', borderRadius: '7px', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>3</button>
                  <button style={{ height: '32px', padding: '0 12px', border: '1px solid #e5e7eb', borderRadius: '7px', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>Next</button>
                </div>
              </div>
            </div>
            {/* Right: Preview + Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '18px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#111827', marginBottom: '14px' }}>Document Preview</div>
                <div style={{ background: '#f8fafc', borderRadius: '9px', border: '1px solid #e5e7eb', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', minHeight: '120px' }}>
                  <div style={{ width: '40px', height: '48px', background: '#dc2626', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}><span style={{ fontSize: '9px', fontWeight: 800, color: '#fff' }}>PDF</span></div>
                  <div style={{ fontSize: '11.5px', color: '#374151', fontWeight: 500, textAlign: 'center' }}>Invoice_TechCorp_2024_001.pdf</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Click to view full document</div>
                </div>
                <div style={{ marginBottom: '8px' }}><div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '2px' }}>File Type</div><div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>PDF Document</div></div>
                <div style={{ marginBottom: '8px' }}><div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '2px' }}>Created</div><div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>Dec 10, 2024</div></div>
                <div style={{ marginBottom: '8px' }}><div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '2px' }}>Last Modified</div><div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>Dec 14, 2024</div></div>
                <div><div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '2px' }}>Permissions</div><div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>Admin, Accounting Team</div></div>
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: '18px' }}>
                <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>Quick Actions</div>
                {[['Share Document','#7c3aed'],['Edit Document','#16a34a'],['Add Tag','#7c3aed']].map(([label,color]) => (
                  <div key={label} style={{ padding: '11px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}><span style={{ fontSize: '13.5px', fontWeight: 600, color }}>{label}</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></div>
                ))}
                <div style={{ padding: '11px 12px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}><span style={{ fontSize: '13.5px', fontWeight: 600, color: '#dc2626' }}>Delete Document</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Documents;
