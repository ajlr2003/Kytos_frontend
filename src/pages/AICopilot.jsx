/**
 * src/pages/AICopilot.jsx
 *
 * AI Copilot module. Provides a conversational AI interface integrated with
 * Kytos business context:
 *   - Conversation tab: chat with the AI assistant (POST /api/v1/ai/chat),
 *     which calls Claude grounded with a live snapshot of this workspace's
 *     real KPIs (revenue, RFQs, inventory, expenses).
 *   - History tab: browse and resume previous conversations (local only).
 *   - Saved Prompts: reusable prompt templates for common business queries (local only).
 *   - Context tab: set the scope/time period/focus area injected into the session (local only —
 *     not yet sent to the backend).
 *   - Citations: sources behind the most recent AI answer (illustrative — the
 *     backend doesn't return citations yet).
 *   - Quick Actions: one-click jumps to the relevant live module, or canned prompts.
 *
 * If ANTHROPIC_API_KEY isn't configured on the backend, /chat returns a 503
 * with a clear message, shown inline in the conversation.
 */

import { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import { API_BASE } from '../config.js';
import '../styles/AICopilot.css';

const TABS = ['Conversation', 'History', 'Saved Prompts', 'Context', 'Citations', 'Quick Actions'];

const TAB_ICONS = {
  'Conversation':   <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  'History':        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  'Saved Prompts':  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  'Context':        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  'Citations':      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  'Quick Actions':  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
};

const SUGGESTED = [
  'What are the top performing suppliers?',
  'Show me high-risk purchase orders',
  'Compare Q3 vs Q4 spend',
  'Generate procurement summary',
];

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: 'ai',
    text: "Hello! I'm your AI Copilot. Ask me about your suppliers, RFQs, inventory, or expenses — I can see live numbers from this workspace. What would you like to explore today?",
    time: 'Just now',
    cards: null,
    actions: null,
  },
];

const DEFAULT_CONTEXT = { scope: 'All Suppliers', timePeriod: 'Q4 2024', focusArea: 'Budget Analysis' };

const DEFAULT_PROMPTS = [
  { id: 'p1', title: 'Procurement Summary', text: 'Generate a procurement summary for this quarter.' },
  { id: 'p2', title: 'Overdue Invoices', text: 'List all overdue invoices and their days past due.' },
  { id: 'p3', title: 'Top Customers', text: 'Who are our top 5 customers by revenue this year?' },
];

const QUICK_ACTIONS = [
  { label: 'Open Purchases Dashboard', desc: 'Suppliers, RFQs, and spend', page: 'purchases' },
  { label: 'Open Sales Reporting',     desc: 'Quotations and order analysis', page: 'sales' },
  { label: 'Open Inventory',           desc: 'Stock levels and warehouse status', page: 'inventory' },
  { label: 'Open Accounting',          desc: 'Invoices, payments, reconciliation', page: 'accounting' },
];

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore malformed local data */ }
  return fallback;
}

function AiAvatar() {
  return (
    <div className="aico-ai-avatar">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="12" rx="2"/>
        <path d="M9 8V6a3 3 0 0 1 6 0v2"/>
        <circle cx="9" cy="14" r="1" fill="#fff" stroke="none"/>
        <circle cx="15" cy="14" r="1" fill="#fff" stroke="none"/>
        <path d="M9 17h6"/>
      </svg>
    </div>
  );
}

export default function AICopilot({ goPage, onLogout }) {
  const [activeTab, setActiveTab]   = useState('Conversation');
  const [messages,  setMessages]    = useState(INITIAL_MESSAGES);
  const [input,     setInput]       = useState('');
  const bottomRef = useRef(null);

  const [conversations, setConversations] = useState(() => loadLocal('aico_conversations', []));
  const [savedPrompts,  setSavedPrompts]  = useState(() => loadLocal('aico_saved_prompts', DEFAULT_PROMPTS));
  const [activeContext, setActiveContext] = useState(() => loadLocal('aico_context', DEFAULT_CONTEXT));
  const [editingContext, setEditingContext] = useState(false);
  const [ctxDraft, setCtxDraft] = useState(activeContext);
  const [newPromptTitle, setNewPromptTitle] = useState('');
  const [newPromptText,  setNewPromptText]  = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function persistConversations(next) {
    setConversations(next);
    localStorage.setItem('aico_conversations', JSON.stringify(next));
  }
  function persistPrompts(next) {
    setSavedPrompts(next);
    localStorage.setItem('aico_saved_prompts', JSON.stringify(next));
  }
  function persistContext(next) {
    setActiveContext(next);
    localStorage.setItem('aico_context', JSON.stringify(next));
  }

  async function sendMessage(text) {
    const msg = text.trim() || input.trim();
    if (!msg || sending) return;
    setInput('');
    setActiveTab('Conversation');

    const userMsg = { id: Date.now(), role: 'user', text: msg, time: 'Just now' };
    const history = [...messages, userMsg]
      .filter(m => m.role === 'user' || m.role === 'ai')
      .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));

    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `AI Copilot error (${res.status})`);
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'ai', time: 'Just now',
        text: data.reply, cards: null, actions: null,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'ai', time: 'Just now',
        text: `⚠️ ${e.message}`, cards: null, actions: null,
      }]);
    } finally {
      setSending(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function startNewChat() {
    if (messages.length > 1) {
      const firstUserMsg = messages.find(m => m.role === 'user');
      const conv = {
        id: Date.now(),
        title: firstUserMsg ? firstUserMsg.text.slice(0, 60) : 'Untitled conversation',
        savedAt: new Date().toISOString(),
        messages,
      };
      persistConversations([conv, ...conversations].slice(0, 30));
    }
    setMessages(INITIAL_MESSAGES);
    setActiveTab('Conversation');
  }

  function loadConversation(conv) {
    setMessages(conv.messages);
    setActiveTab('Conversation');
  }

  function deleteConversation(id) {
    persistConversations(conversations.filter(c => c.id !== id));
  }

  function usePrompt(p) {
    sendMessage(p.text);
  }

  function addPrompt() {
    if (!newPromptTitle.trim() || !newPromptText.trim()) return;
    persistPrompts([...savedPrompts, { id: `p${Date.now()}`, title: newPromptTitle.trim(), text: newPromptText.trim() }]);
    setNewPromptTitle(''); setNewPromptText('');
  }

  function deletePrompt(id) {
    persistPrompts(savedPrompts.filter(p => p.id !== id));
  }

  function saveContext() {
    persistContext(ctxDraft);
    setEditingContext(false);
  }

  const lastCitedMessage = [...messages].reverse().find(m => m.cards && m.cards.length);

  return (
    <div id="aico-page">
      <Sidebar activePage="aicopilot" goPage={goPage} />

      <div className="db-main">
        {/* Top bar */}
        <div className="tb">
          <div>
            <div className="tb-title" style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>AI Copilot</div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '1px' }}>Your intelligent assistant for procurement insights and analysis</div>
          </div>
          <div className="tb-right">
            <button className="aico-newchat-btn" onClick={startNewChat} title="Start a new conversation">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Chat
            </button>
            <div className="tb-bell">
              <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div className="tb-user">
              <div className="tb-avatar" style={{ background: 'linear-gradient(135deg,#074E3B,#10b981)' }}>SJ</div>
              <div><div className="tb-uname">Sarah Johns</div><div className="tb-urole">Administrator</div></div>
            </div>
          </div>
        </div>

        <div className="aico-wrap">
          {/* Tab bar */}
          <div className="aico-tabs">
            {TABS.map(tab => (
              <button
                key={tab}
                className={`aico-tab${activeTab === tab ? ' active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {TAB_ICONS[tab]}{tab}
                {tab === 'History' && conversations.length > 0 && <span className="aico-tab-count">{conversations.length}</span>}
                {tab === 'Saved Prompts' && savedPrompts.length > 0 && <span className="aico-tab-count">{savedPrompts.length}</span>}
              </button>
            ))}
          </div>

          {activeTab === 'Conversation' && (
          <div className="aico-body">
            {/* ── Chat area ── */}
            <div className="aico-chat-col">
              <div className="aico-messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`aico-msg-row ${msg.role}`}>
                    {msg.role === 'ai' && <AiAvatar />}
                    <div className="aico-msg-content">
                      <div className={`aico-bubble ${msg.role}`}>
                        <p>{msg.text}</p>

                        {/* Cards */}
                        {msg.cards && (
                          <div className="aico-cards">
                            {msg.cards.map((c, i) => (
                              <div key={i} className={`aico-card aico-card-${c.badgeCls?.replace('badge-', '')}`}>
                                <div className="aico-card-left">
                                  <div className="aico-card-name">{c.name}</div>
                                  <div className="aico-card-detail">{c.detail}</div>
                                </div>
                                <span className={`aico-badge ${c.badgeCls}`}>{c.badge}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action buttons */}
                        {msg.actions && (
                          <div className="aico-actions">
                            {msg.actions.map((a, i) => (
                              <button key={i} className={`aico-action-btn${i === 0 ? ' primary' : ''}`}>
                                {i === 0 && <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                                {i === 1 && <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
                                {i === 2 && <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>}
                                {a}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="aico-time">{msg.time}</div>
                    </div>
                    {msg.role === 'user' && (
                      <div className="aico-user-avatar">SJ</div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="aico-input-wrap">
                <textarea
                  className="aico-input"
                  placeholder={sending ? 'Waiting for a response…' : 'Ask me anything about your procurement...'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                  disabled={sending}
                />
                <button className="aico-send" onClick={() => sendMessage(input)} disabled={!input.trim() || sending}>
                  {sending ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="9" strokeOpacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  )}
                </button>
              </div>
              <div className="aico-input-hint">
                <button className="aico-hint-btn" disabled title="Coming soon">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  Attach
                </button>
                <button className="aico-hint-btn" disabled title="Coming soon">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  Voice
                </button>
                <span className="aico-hint-enter">Press Enter to send</span>
              </div>
            </div>

            {/* ── Right panel ── */}
            <div className="aico-right-col">
              {/* Suggested Questions */}
              <div className="aico-panel">
                <div className="aico-panel-title">Suggested Questions</div>
                {SUGGESTED.map((q, i) => (
                  <button key={i} className="aico-suggest" onClick={() => sendMessage(q)}>{q}</button>
                ))}
              </div>

              {/* Active Context */}
              <div className="aico-panel">
                <div className="aico-panel-title">Active Context</div>
                {Object.entries(activeContext).map(([k, v]) => (
                  <div key={k} className="aico-ctx-row">
                    <span className="aico-ctx-label">{k === 'timePeriod' ? 'Time Period' : k === 'focusArea' ? 'Focus Area' : 'Scope'}</span>
                    <span className="aico-ctx-value">{v}</span>
                  </div>
                ))}
                <button className="aico-ctx-btn" onClick={() => { setCtxDraft(activeContext); setActiveTab('Context'); }}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Change Context
                </button>
              </div>
            </div>
          </div>
          )}

          {/* ── History tab ── */}
          {activeTab === 'History' && (
            <div className="aico-panel" style={{ maxWidth: '720px' }}>
              <div className="aico-panel-title">Conversation History</div>
              {conversations.length === 0 ? (
                <div className="aico-empty">No saved conversations yet. Click "New Chat" from an active conversation to archive it here.</div>
              ) : conversations.map(c => (
                <div key={c.id} className="aico-hist-row">
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => loadConversation(c)}>
                    <div className="aico-hist-title">{c.title}</div>
                    <div className="aico-hist-meta">{new Date(c.savedAt).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {c.messages.length} messages</div>
                  </div>
                  <button className="aico-hist-del" onClick={() => deleteConversation(c.id)} title="Delete">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Saved Prompts tab ── */}
          {activeTab === 'Saved Prompts' && (
            <div className="aico-panel" style={{ maxWidth: '720px' }}>
              <div className="aico-panel-title">Saved Prompts</div>
              {savedPrompts.map(p => (
                <div key={p.id} className="aico-hist-row">
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => usePrompt(p)}>
                    <div className="aico-hist-title">{p.title}</div>
                    <div className="aico-hist-meta">{p.text}</div>
                  </div>
                  <button className="aico-hist-del" onClick={() => deletePrompt(p.id)} title="Delete">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
              <div className="aico-prompt-form">
                <input placeholder="Prompt title" value={newPromptTitle} onChange={e => setNewPromptTitle(e.target.value)} />
                <input placeholder="Prompt text" value={newPromptText} onChange={e => setNewPromptText(e.target.value)} />
                <button className="aico-ctx-btn" style={{ marginTop: 0, width: 'auto', padding: '8px 16px' }} onClick={addPrompt}>Add Prompt</button>
              </div>
            </div>
          )}

          {/* ── Context tab ── */}
          {activeTab === 'Context' && (
            <div className="aico-panel" style={{ maxWidth: '480px' }}>
              <div className="aico-panel-title">Active Context</div>
              <div className="aico-prompt-form">
                <label className="aico-ctx-label" style={{ display: 'block', marginBottom: '4px' }}>Scope</label>
                <input value={ctxDraft.scope} onChange={e => setCtxDraft(d => ({ ...d, scope: e.target.value }))} />
                <label className="aico-ctx-label" style={{ display: 'block', margin: '10px 0 4px' }}>Time Period</label>
                <input value={ctxDraft.timePeriod} onChange={e => setCtxDraft(d => ({ ...d, timePeriod: e.target.value }))} />
                <label className="aico-ctx-label" style={{ display: 'block', margin: '10px 0 4px' }}>Focus Area</label>
                <input value={ctxDraft.focusArea} onChange={e => setCtxDraft(d => ({ ...d, focusArea: e.target.value }))} />
                <button className="aico-ctx-btn" style={{ marginTop: '14px' }} onClick={saveContext}>Save Context</button>
              </div>
              <div className="aico-empty" style={{ marginTop: '14px' }}>Sets what's shown in "Active Context" and is included with future messages — stored locally, not yet fed into a real model.</div>
            </div>
          )}

          {/* ── Citations tab ── */}
          {activeTab === 'Citations' && (
            <div className="aico-panel" style={{ maxWidth: '720px' }}>
              <div className="aico-panel-title">Citations</div>
              {!lastCitedMessage ? (
                <div className="aico-empty">No sourced answers in this conversation yet. Ask a question that references your data (e.g. "Show me suppliers with budget overruns") to see citations here.</div>
              ) : (
                <>
                  <div className="aico-empty" style={{ marginBottom: '10px' }}>Illustrative sources behind the most recent data-backed answer — real citation tracing isn't wired to a live retrieval backend yet.</div>
                  {lastCitedMessage.cards.map((c, i) => (
                    <div key={i} className="aico-hist-row">
                      <div style={{ flex: 1 }}>
                        <div className="aico-hist-title">{c.name}</div>
                        <div className="aico-hist-meta">{c.source?.label || 'Unknown source'}</div>
                      </div>
                      {c.source?.page && (
                        <button className="aico-ctx-btn" style={{ marginTop: 0, width: 'auto', padding: '6px 12px' }} onClick={() => goPage(c.source.page)}>Open</button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Quick Actions tab ── */}
          {activeTab === 'Quick Actions' && (
            <div className="aico-quick-grid">
              {QUICK_ACTIONS.map(qa => (
                <button key={qa.label} className="aico-quick-card" onClick={() => goPage(qa.page)}>
                  <div className="aico-quick-title">{qa.label}</div>
                  <div className="aico-quick-desc">{qa.desc}</div>
                </button>
              ))}
              {SUGGESTED.map(q => (
                <button key={q} className="aico-quick-card aico-quick-card-prompt" onClick={() => sendMessage(q)}>
                  <div className="aico-quick-title">{q}</div>
                  <div className="aico-quick-desc">Ask the Copilot</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
