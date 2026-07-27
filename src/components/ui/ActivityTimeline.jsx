/**
 * src/components/ui/ActivityTimeline.jsx
 *
 * Chatter-style "who did what, when" activity feed for an entity. Fetches
 * from GET /api/v1/activity?entity_type=X&entity_id=Y and renders a
 * chronological list (most recent first). Read-only — entries are written
 * server-side as a side effect of real actions (create, status change,
 * approve, deactivate, …), never composed here.
 *
 * Usage:
 *   <ActivityTimeline entityType="supplier" entityId={supplier.id} />
 */

import { useState, useEffect } from 'react';
import { API_BASE } from '../../config.js';

const ACTION_ICON = {
  created:          '＋',
  status_changed:   '→',
  approved:         '✓',
  deactivated:      '⊘',
  updated:          '✎',
  stage_changed:    '→',
  supplier_selected:'✓',
};

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * @param {{ entityType: string, entityId: string }} props
 */
export default function ActivityTimeline({ entityType, entityId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entityId) return;
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/v1/activity?entity_type=${entityType}&entity_id=${entityId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setEntries(d.items ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  if (loading) {
    return <div style={{ fontSize: '12.5px', color: '#9ca3af' }}>Loading activity…</div>;
  }
  if (entries.length === 0) {
    return <div style={{ fontSize: '12.5px', color: '#9ca3af' }}>No activity yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {entries.map((e, i) => (
        <div key={e.id} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: i < entries.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
          <div style={{
            width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
            background: '#f3f4f6', color: '#6b7280', fontSize: '11px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {ACTION_ICON[e.action] || '•'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12.5px', color: '#374151' }}>{e.message}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
              {e.user_name || 'System'} · {timeAgo(e.created_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
