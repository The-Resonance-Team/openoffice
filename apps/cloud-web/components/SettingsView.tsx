'use client';

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';

const card: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  boxShadow: 'var(--shadow)',
};

export function SettingsView() {
  const [notif, setNotif] = useState(true);
  const [updates, setUpdates] = useState(false);
  const [role, setRole] = useState('Owner');
  const showToast = useToast();

  return (
    <div
      style={{ maxWidth: 800, margin: '0 auto', padding: '30px 28px 100px' }}
      className="fade-in"
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>
          Settings
        </h1>
        <p style={{ color: 'var(--muted)', margin: '8px 0 0', fontSize: 14 }}>
          Preferences and security for your account.
        </p>
      </div>

      <div style={{ ...card, padding: '4px 20px' }}>
        <SettingRow title="Appearance" detail="Interface theme." bottom>
          <span
            style={{
              fontSize: 11.5,
              color: 'var(--muted)',
              border: '1px solid var(--border-2)',
              borderRadius: 8,
              padding: '6px 11px',
            }}
          >
            ☾ Dark
          </span>
        </SettingRow>
        <SettingRow
          title="Email notifications"
          detail="Session, security and billing alerts."
          bottom
        >
          <Toggle on={notif} onToggle={() => setNotif((n) => !n)} label="Email notifications" />
        </SettingRow>
        <SettingRow title="Product updates" detail="Occasional news about what's new." bottom>
          <Toggle on={updates} onToggle={() => setUpdates((u) => !u)} label="Product updates" />
        </SettingRow>
        <SettingRow
          title="Two-factor authentication"
          detail="Add an extra layer of security at sign-in."
        >
          <button
            onClick={() => showToast('Two-factor setup started')}
            className="hover-ghost"
            style={{
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border-2)',
              borderRadius: 9,
              padding: '8px 13px',
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            Enable
          </button>
        </SettingRow>
      </div>

      <div
        style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', margin: '28px 0 12px' }}
      >
        Preview
      </div>
      <div
        style={{
          ...card,
          padding: '15px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>View as role</div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 3 }}>
            Preview what each role sees. Organization is visible to Owner and Admin only.
          </div>
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="View as role"
          style={{
            flex: 'none',
            background: 'var(--bg)',
            color: 'var(--text)',
            border: '1px solid var(--border-2)',
            borderRadius: 8,
            padding: '8px 11px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <option>Owner</option>
          <option>Admin</option>
          <option>Team Leader</option>
          <option>Member</option>
        </select>
      </div>

      <div
        style={{
          border: '1px solid var(--accent)',
          borderRadius: 18,
          padding: '16px 20px',
          marginTop: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 700 }}>
            Delete account
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 3 }}>
            Permanently remove your account and personal data.
          </div>
        </div>
        <button
          onClick={() => showToast('Account deletion requires confirmation')}
          className="hover-danger"
          style={{
            flex: 'none',
            background: 'transparent',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            borderRadius: 9,
            padding: '8px 13px',
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function SettingRow({
  title,
  detail,
  bottom,
  children,
}: {
  title: string;
  detail: string;
  bottom?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '15px 0',
        borderBottom: bottom ? '1px solid var(--border)' : 'none',
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 3 }}>{detail}</div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        padding: 3,
        display: 'flex',
        background: on ? 'var(--green)' : 'var(--panel-2)',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'transform .15s',
          transform: on ? 'translateX(18px)' : 'translateX(0)',
        }}
      />
    </button>
  );
}
