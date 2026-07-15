import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

const STEPS = [
  { key: 'placed',    label: 'Order Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'served',    label: 'Served' }
];
const ORDER = ['placed', 'confirmed', 'preparing', 'served'];

export default function OrderTracker({ orderId: propOrderId }) {
  const [orderId, setOrderId] = useState(
    propOrderId || localStorage.getItem('noqs:lastOrderId') || ''
  );
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/track`);
        if (!res.ok) throw new Error('Order not found');
        const data = await res.json();
        if (!cancelled) { setOrder(data); setError(''); }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }

    poll();
    const id = setInterval(poll, 10000); // 10s live poll
    return () => { cancelled = true; clearInterval(id); };
  }, [orderId]);

  const currentIdx = order ? ORDER.indexOf(order.status) : -1;
  const cancelled = order?.status === 'cancelled';

  return (
    <section className="order-track" id="track" aria-label="Track your order">
      <div className="order-track-inner">
        <h2 className="section-title">Your Order</h2>

        <form
          className="promo-row"
          style={{ maxWidth: 360, margin: '0 auto 24px' }}
          onSubmit={(e) => { e.preventDefault(); }}
        >
          <input
            className="promo-input"
            placeholder="Enter order ID e.g. NOQS-AB12CD"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value.trim().toUpperCase())}
            aria-label="Order ID"
          />
        </form>

        {error && <p className="track-eta" role="alert">{error}</p>}

        {order && !cancelled && (
          <>
            <div className="track-steps" role="list" aria-label="Order progress">
              {STEPS.map((step, idx) => {
                const done = idx < currentIdx;
                const active = idx === currentIdx;
                return (
                  <div
                    key={step.key}
                    role="listitem"
                    className={`track-step${done ? ' track-step--done' : ''}${active ? ' track-step--active' : ''}`}
                  >
                    <div className="step-dot" aria-hidden="true">
                      {done ? '✓' : active ? <span className="pulse-ring" /> : ''}
                    </div>
                    <p className="step-label">{step.label}</p>
                  </div>
                );
              })}
            </div>
            <p className="track-eta" aria-live="polite">
              Status: <strong>{order.status}</strong> · ₹{order.total}
            </p>
          </>
        )}

        {cancelled && (
          <p className="track-eta" role="alert">This order was cancelled.</p>
        )}
      </div>
    </section>
  );
}
