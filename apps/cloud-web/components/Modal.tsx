'use client';

import { useEffect, useEffectEvent, useRef } from 'react';

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // 8.3/8.4: keep the effect subscribed once — parents pass fresh inline
  // onClose closures on every render, which would re-run the focus trap and
  // body-overflow toggle (and refocus the panel) on each keystroke.
  const onCloseEvent = useEffectEvent(onClose);

  useEffect(() => {
    const panel = panelRef.current;
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panel?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseEvent();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus();
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        overscrollBehavior: 'contain',
      }}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.6)',
          backdropFilter: 'blur(2px)',
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="fade-up"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          background: 'var(--panel)',
          border: '1px solid var(--border-2)',
          borderRadius: 18,
          padding: '22px 24px 20px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 18 }}>
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        fontSize: 11,
        color: 'var(--faint)',
        textTransform: 'uppercase',
        letterSpacing: '.04em',
        fontWeight: 600,
        marginBottom: 7,
      }}
    >
      {children}
    </label>
  );
}

export const textInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border-2)',
  color: 'var(--text)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
};

export function ModalActions({
  onCancel,
  cta,
  onSubmit,
  disabled,
}: {
  onCancel?: () => void;
  cta: string;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 22 }}>
      {onCancel && (
        <button
          onClick={onCancel}
          className="hover-ghost"
          style={{
            background: 'transparent',
            color: 'var(--muted)',
            border: '1px solid var(--border-2)',
            borderRadius: 9,
            padding: '9px 15px',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Cancel
        </button>
      )}
      <button
        onClick={onSubmit}
        disabled={disabled}
        className="hover-btn"
        style={{
          background: 'var(--accent-grad)',
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          padding: '9px 17px',
          fontSize: 13,
          fontWeight: 600,
          opacity: disabled ? 0.6 : 1,
          boxShadow: '0 6px 15px -8px rgba(236,48,19,.6)',
        }}
      >
        {cta}
      </button>
    </div>
  );
}
