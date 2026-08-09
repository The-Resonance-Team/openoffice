'use client';

// 2.3 state-lift-state: one provider owns toast state (and its timer) instead
// of each view duplicating the useState+setTimeout pair — which also fixes the
// stale-timer race (a fast second toast was cleared early by the first timer).

import { createContext, useEffect, useRef, useState, use } from 'react';

const ToastContext = createContext<{ show: (text: string) => void } | null>(null);

export function useToast() {
  const ctx = use(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.show;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function show(text: string) {
    setToast(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 2600);
  }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && <Toast text={toast} />}
    </ToastContext.Provider>
  );
}

export function Toast({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="fade-up"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        background: 'var(--panel-2)',
        color: 'var(--text)',
        border: '1px solid var(--border-2)',
        borderRadius: 11,
        padding: '11px 18px',
        fontSize: 13,
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
      {text}
    </div>
  );
}
