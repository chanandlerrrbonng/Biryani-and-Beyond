import { useEffect, useReducer } from 'react';
import StepReview from './StepReview.jsx';
import StepDetails from './StepDetails.jsx';
import StepConfirm from './StepConfirm.jsx';
import { useCart } from '../../context/CartContext.jsx';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

const STORAGE_KEY = 'noqs:checkout:draft';

const initial = {
  step: 0, // 0 review, 1 details, 2 confirm
  details: { name: '', phone: '', notes: '' },
  placedOrderId: null
};

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':       return { ...state, ...action.payload };
    case 'NEXT':          return { ...state, step: Math.min(state.step + 1, 2) };
    case 'BACK':          return { ...state, step: Math.max(state.step - 1, 0) };
    case 'SET_DETAILS':   return { ...state, details: { ...state.details, ...action.patch } };
    case 'PLACED':        return { ...state, placedOrderId: action.id, step: 2 };
    case 'RESET':         return initial;
    default:              return state;
  }
}

function lazyInit() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...initial, ...JSON.parse(raw) };
  } catch {}
  return initial;
}

export default function CheckoutFlow({ onExit, onDone }) {
  const [state, dispatch] = useReducer(reducer, initial, lazyInit);
  const { items, totals, clearCart } = useCart();

  // Persist draft on every change (Ticket 611 Phase 1)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  // On unmount, if order was placed, clear the draft to avoid stale data
  useEffect(() => {
    return () => {
      if (state.placedOrderId) {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
      }
    };
  }, [state.placedOrderId]);

async function placeOrder() {
  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: state.details,
        tableId: 'T07',
        items,
        promoCode: undefined,
        dineIn: true
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert((data.details || [data.message]).join('\n'));
      return;
    }

    dispatch({ type: 'PLACED', id: data.id });

    try {
      localStorage.setItem('noqs:lastOrderId', data.id);
    } catch {}

  } catch (err) {
    console.error('[order] place order failed:', err);
    alert('Could not reach the kitchen. Please try again.');
  }
}


  function finish() {
    clearCart();
    dispatch({ type: 'RESET' });
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    onDone();
  }

  return (
    <div className="checkout-flow">
      <div className="checkout-progress" role="list">
        {['Review', 'Details', 'Confirm'].map((label, idx) => (
          <div
            key={label}
            role="listitem"
            className={`checkout-step${idx === state.step ? ' active' : ''}${idx < state.step ? ' done' : ''}`}
          >
            <span className="checkout-step-num">{idx + 1}</span>
            <span className="checkout-step-label">{label}</span>
          </div>
        ))}
      </div>

      {state.step === 0 && (
        <StepReview
          items={items}
          totals={totals}
          onBack={onExit}
          onNext={() => dispatch({ type: 'NEXT' })}
        />
      )}

      {state.step === 1 && (
        <StepDetails
          details={state.details}
          onChange={(patch) => dispatch({ type: 'SET_DETAILS', patch })}
          onBack={() => dispatch({ type: 'BACK' })}
          onSubmit={placeOrder}
        />
      )}

      {state.step === 2 && (
        <StepConfirm
          orderId={state.placedOrderId}
          totals={totals}
          details={state.details}
          onFinish={finish}
        />
      )}
    </div>
  );
}
