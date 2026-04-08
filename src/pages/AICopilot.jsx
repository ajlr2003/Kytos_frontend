import { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
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
    text: "Hello! I'm your AI Copilot. I can help you analyze procurement performance, identify risks, generate reports, and provide insights across your suppliers and purchase orders. What would you like to explore today?",
    time: '2 minutes ago',
    cards: null,
    actions: null,
  },
  {
    id: 2,
    role: 'user',
    text: 'Show me suppliers with budget overruns in Q4 2024',
    time: '1 minute ago',
  },
  {
    id: 3,
    role: 'ai',
    text: 'I found 3 suppliers with budget overruns in Q4 2024:',
    time: 'Just now',
    cards: [
      { name: 'TechSupply Co.',    detail: 'Budget: $2.5M | Actual: $2.875M', badge: '15% over', badgeCls: 'badge-red' },
      { name: 'OfficePlus Ltd.',   detail: 'Budget: $3.2M | Actual: $3.456M', badge: '8% over',  badgeCls: 'badge-orange' },
      { name: 'DataTech Systems',  detail: 'Budget: $4.0M | Actual: $4.2M',   badge: '5% over',  badgeCls: 'badge-orange' },
    ],
    actions: ['Generate Report', 'View Dashboard', 'Flag Risks'],
  },
];

const ACTIVE_CONTEXT = [
  { label: 'Scope',       value: 'All Suppliers' },
  { label: 'Time Period', value: 'Q4 2024' },
  { label: 'Focus Area',  value: 'Budget Analysis' },
];

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage(text) {
    const msg = text.trim() || input.trim();
    if (!msg) return;
    setInput('');
    setMessages(prev => [
      ...prev,
      { id: Date.now(), role: 'user', text: msg, time: 'Just now' },
      {
        id: Date.now() + 1, role: 'ai', time: 'Just now',
        text: `Analyzing your query: "${msg}". This feature will connect to your live data once the backend integration is complete.`,
        cards: null, actions: null,
      },
    ]);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

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
            <div className="tb-bell">
              <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <div className="tb-user">
              <div className="tb-avatar" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>SJ</div>
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
              </button>
            ))}
          </div>

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
                              <div key={i} className="aico-card">
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
                  placeholder="Ask me anything about your procurement..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                />
                <button className="aico-send" onClick={() => sendMessage(input)} disabled={!input.trim()}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
              <div className="aico-input-hint">
                <button className="aico-hint-btn">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  Attach
                </button>
                <button className="aico-hint-btn">
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
                {ACTIVE_CONTEXT.map((row, i) => (
                  <div key={i} className="aico-ctx-row">
                    <span className="aico-ctx-label">{row.label}</span>
                    <span className="aico-ctx-value">{row.value}</span>
                  </div>
                ))}
                <button className="aico-ctx-btn">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Change Context
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
