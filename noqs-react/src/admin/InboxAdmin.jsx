import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { adminApi } from './adminApi.js';
import { getStoredToken } from './adminApi.js';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_BASE
    ? import.meta.env.VITE_API_BASE.replace(/\/api\/?$/, '')
    : 'http://localhost:4000');

export default function InboxAdmin() {
  const [sessions, setSessions] = useState([]);      // list of conversation summaries
  const [activeKey, setActiveKey] = useState(null);
  const [thread, setThread] = useState(null);        // { history, cart, mode, ... }
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [reply, setReply] = useState('');
  const socketRef = useRef(null);
  const threadEndRef = useRef(null);

  // Initial load of existing sessions
  const loadSessions = useCallback(async () => {
    try {
      setSessions(await adminApi.listSessions());
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Socket connection for live updates
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], auth: { token: getStoredToken() } });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('conversation:update', (evt) => {
      // Refresh the session list summary
      setSessions((prev) => {
        const others = prev.filter((s) => s.sessionKey !== evt.sessionKey);
        const existing = prev.find((s) => s.sessionKey === evt.sessionKey);
        return [{
          sessionKey: evt.sessionKey,
          phone: evt.phone,
          stage: evt.stage ?? existing?.stage,
          mode: evt.mode ?? existing?.mode ?? 'bot',
          orderId: evt.orderId ?? existing?.orderId ?? null,
          cartCount: (evt.cart || existing?.cart || []).reduce
            ? (evt.cart || []).reduce((n, i) => n + i.qty, 0)
            : existing?.cartCount ?? 0,
          lastMessage: evt.reply || evt.userText || existing?.lastMessage || '',
          updatedAt: evt.at
        }, ...others];
      });

      // If this is the open thread, append messages live
      setThread((prev) => {
        if (!prev || prev.sessionKey !== evt.sessionKey) return prev;
        const additions = [];
        if (evt.userText) additions.push({ role: 'user', content: evt.userText });
        if (evt.reply) additions.push({ role: 'assistant', content: evt.reply });
        return {
          ...prev,
          mode: evt.mode ?? prev.mode,
          cart: evt.cart ?? prev.cart,
          stage: evt.stage ?? prev.stage,
          orderId: evt.orderId ?? prev.orderId,
          history: [...prev.history, ...additions]
        };
      });
    });

    socket.on('conversation:human', (evt) => {
      setThread((prev) => {
        if (!prev || prev.sessionKey !== evt.sessionKey) return prev;
        return { ...prev, history: [...prev.history, { role: 'user', content: evt.userText }] };
      });
    });

    socket.on('conversation:mode', (evt) => {
      setSessions((prev) => prev.map((s) => s.sessionKey === evt.sessionKey ? { ...s, mode: evt.mode } : s));
      setThread((prev) => (prev && prev.sessionKey === evt.sessionKey ? { ...prev, mode: evt.mode } : prev));
    });

    return () => socket.disconnect();
  }, []);

  // Auto-scroll thread
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.history?.length]);

  async function openThread(key) {
    setActiveKey(key);
    setError('');
    try {
      setThread(await adminApi.getSession(key));
    } catch (e) { setError(e.message); }
  }

  async function toggleMode() {
    if (!thread) return;
    const next = thread.mode === 'human' ? 'bot' : 'human';
    try {
      // Prefer socket, fall back to REST
      if (socketRef.current?.connected) {
        socketRef.current.emit('merchant:mode', { sessionKey: thread.sessionKey, mode: next });
      } else {
        await adminApi.setSessionMode(thread.sessionKey, next);
      }
      setThread((prev) => ({ ...prev, mode: next }));
    } catch (e) { setError(e.message); }
  }

  function sendReply(e) {
    e.preventDefault();
    if (!reply.trim() || !thread) return;
    socketRef.current?.emit('merchant:reply', { sessionKey: thread.sessionKey, text: reply.trim() });
    setThread((prev) => ({ ...prev, history: [...prev.history, { role: 'assistant', content: reply.trim() }] }));
    setReply('');
  }

  return (
    <section className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-title">Merchant Inbox</h1>
        <p className="admin-subtitle">
          Live WhatsApp conversations.{' '}
          <span className={`inbox-conn ${connected ? 'on' : 'off'}`}>
            {connected ? '● live' : '○ offline'}
          </span>
        </p>
      </header>

      {error && <p className="admin-error-banner" role="alert">{error}</p>}

      <div className="inbox-layout">
        <aside className="inbox-list">
          {sessions.length === 0 && <p className="admin-empty">No conversations yet.</p>}
          {sessions.map((s) => (
            <button
              key={s.sessionKey}
              className={`inbox-list-item${activeKey === s.sessionKey ? ' active' : ''}`}
              onClick={() => openThread(s.sessionKey)}
            >
              <div className="inbox-list-top">
                <span className="inbox-phone">{s.phone}</span>
                <span className={`inbox-mode-pill ${s.mode}`}>{s.mode}</span>
              </div>
              <p className="inbox-preview">{s.lastMessage || '—'}</p>
              <div className="inbox-list-meta">
                <span>{s.stage}</span>
                {s.cartCount > 0 && <span>🛒 {s.cartCount}</span>}
                {s.orderId && <span>#{s.orderId}</span>}
              </div>
            </button>
          ))}
        </aside>

        <div className="inbox-thread">
          {!thread ? (
            <div className="inbox-empty-thread">
              <p>Select a conversation to view the chat.</p>
            </div>
          ) : (
            <>
              <header className="inbox-thread-head">
                <div>
                  <strong className="inbox-phone">{thread.phone}</strong>
                  <span className={`inbox-mode-pill ${thread.mode}`}>{thread.mode}</span>
                </div>
                <button className="btn-secondary inbox-takeover" onClick={toggleMode}>
                  {thread.mode === 'human' ? 'Hand back to bot' : 'Take over'}
                </button>
              </header>

              <div className="inbox-messages">
                {thread.history.map((m, i) => (
                  <div key={i} className={`inbox-msg inbox-msg--${m.role}`}>
                    <span className="inbox-bubble">{m.content}</span>
                  </div>
                ))}
                <div ref={threadEndRef} />
              </div>

              {(thread.cart?.length > 0) && (
                <div className="inbox-cart">
                  <span className="inbox-cart-label">Cart:</span>{' '}
                  {thread.cart.map((c) => `${c.name}×${c.qty}`).join(', ')}
                </div>
              )}

              <form className="inbox-composer" onSubmit={sendReply}>
                <input
                  type="text"
                  className="admin-input inbox-input"
                  placeholder={thread.mode === 'human'
                    ? 'Type a reply to the customer…'
                    : 'Take over to reply manually…'}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  disabled={thread.mode !== 'human'}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={thread.mode !== 'human' || !reply.trim()}
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
