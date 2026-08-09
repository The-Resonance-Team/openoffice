'use client';

import { format } from 'date-fns';
import { useState } from 'react';
import { oauthConnectUrl, type MemberProfile } from '@/lib/api';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useResendVerification } from '@/lib/use-api';
import { FieldLabel, Modal, ModalActions, textInputStyle } from '@/components/Modal';
import { ComingSoon } from '@/components/ComingSoon';
import { useToast } from '@/components/ToastProvider';
import { initials } from '@/lib/initials';

const card: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  boxShadow: 'var(--shadow)',
};

const btnStyle: React.CSSProperties = {
  flex: 'none',
  background: 'var(--accent-grad)',
  color: '#fff',
  border: 'none',
  borderRadius: 9,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  boxShadow: '0 6px 15px -8px rgba(236,48,19,.6)',
};

export function AccountView({ profile }: { profile: MemberProfile }) {
  const { user, member, org } = profile;
  const showToast = useToast();
  const resendVerificationMutation = useResendVerification();

  return (
    <div
      style={{ maxWidth: 800, margin: '0 auto', padding: '30px 28px 100px' }}
      className="fade-in"
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>
          My Account
        </h1>
        <p style={{ color: 'var(--muted)', margin: '8px 0 0', fontSize: 14 }}>
          Manage your profile, connected identities, keys and sessions.
        </p>
      </div>

      <section id="sec-profile" style={{ scrollMarginTop: 14 }}>
        <div style={{ ...card, padding: '20px 22px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 14,
                  background: 'var(--av-grad)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 21,
                  fontWeight: 700,
                  flex: 'none',
                }}
              >
                {initials(user.name ?? user.email)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em' }}>
                  {user.name ?? user.email}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    marginTop: 5,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{user.email}</span>
                  {user.emailVerified ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10.5,
                        fontWeight: 600,
                        letterSpacing: '.02em',
                        color: 'var(--green)',
                        border: '1px solid var(--green)',
                        borderRadius: 6,
                        padding: '1px 7px',
                      }}
                    >
                      ✓ Verified
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 10.5,
                        fontWeight: 600,
                        letterSpacing: '.02em',
                        color: 'var(--amber)',
                        border: '1px solid var(--amber)',
                        borderRadius: 6,
                        padding: '1px 7px',
                      }}
                    >
                      Unverified{' '}
                      <button
                        onClick={() => {
                          resendVerificationMutation.mutate(
                            { email: user.email },
                            { onSuccess: () => showToast('Verification email sent') },
                          );
                        }}
                        style={{
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          font: 'inherit',
                          color: 'inherit',
                        }}
                      >
                        Resend
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => showToast('Profile editing — coming soon')}
              className="hover-ghost"
              style={{
                flex: 'none',
                background: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--border-2)',
                borderRadius: 9,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Edit profile
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap: 16,
              marginTop: 19,
              paddingTop: 18,
              borderTop: '1px solid var(--border)',
            }}
          >
            <Stat
              label="Org role"
              value={member.role}
              color={member.role === 'OWNER' ? 'var(--accent)' : 'var(--amber)'}
            />
            <Stat label="Member since" value="—" />
            <Stat label="Organization" value={org.name} />
          </div>
        </div>
      </section>

      <section id="sec-linked" style={{ scrollMarginTop: 14, marginTop: 30 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>
            Linked accounts
          </div>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
            Sign in faster and sync identity from these providers.
          </div>
        </div>
        <div style={{ ...card, overflow: 'hidden' }}>
          {(['google', 'github'] as const).map((p, i) => (
            <div
              key={p}
              className="hover-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                padding: '13px 16px',
                borderBottom: i === 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: 'var(--panel-2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 12.5,
                  color: p === 'google' ? 'var(--amber)' : 'var(--text)',
                  flex: 'none',
                }}
              >
                {p === 'google' ? 'G' : 'GH'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {p === 'google' ? 'Google' : 'GitHub'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>
                  Not connected
                </div>
              </div>
              <a
                href={oauthConnectUrl(p)}
                style={{
                  background: 'var(--accent-grad)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 9,
                  padding: '7px 14px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  boxShadow: '0 6px 15px -8px rgba(236,48,19,.6)',
                }}
                className="hover-btn"
              >
                Connect
              </a>
            </div>
          ))}
        </div>
      </section>

      <ApiKeysSection />

      <section id="sec-sessions" style={{ scrollMarginTop: 14, marginTop: 30 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>
              Active sessions
            </div>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>
              Devices currently signed in to your account.
            </div>
          </div>
        </div>
        <ComingSoon
          title="Session management isn't wired up yet"
          detail="Listing and revoking active browser sessions needs a cloud-api endpoint that doesn't exist yet."
        />
      </section>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--faint)',
          textTransform: 'uppercase',
          letterSpacing: '.04em',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13.5,
          marginTop: 6,
          color: color ?? 'var(--muted)',
          fontWeight: color ? 600 : 400,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>{subtitle}</div>
      </div>
      {action}
    </div>
  );
}

const KeyIcon = (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--faint)"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="14" r="3.2" />
    <path d="M10.3 11.7 20 2" />
    <path d="M17 5l2.5 2.5" />
    <path d="M14.5 7.5 17 10" />
  </svg>
);

function ApiKeysSection() {
  const showToast = useToast();
  const { data } = useApiKeys();
  const createApiKeyMutation = useCreateApiKey();
  const revokeApiKeyMutation = useRevokeApiKey();
  const [modal, setModal] = useState<'create' | 'created' | null>(null);
  const [name, setName] = useState('');
  const [fullKey, setFullKey] = useState('');

  const keys = data?.keys ?? null;

  async function submitCreate() {
    const { key } = await createApiKeyMutation.mutateAsync({ name: name || 'New key' });
    setFullKey(key);
    setModal('created');
    setName('');
  }

  async function revoke(id: string) {
    await revokeApiKeyMutation.mutateAsync({ id });
    showToast('API key revoked');
  }

  return (
    <section id="sec-keys" style={{ scrollMarginTop: 14, marginTop: 30 }}>
      <SectionHeader
        title="API keys"
        subtitle="Daemon keys for integrations, automations and CI."
        action={
          <button onClick={() => setModal('create')} className="hover-btn" style={btnStyle}>
            Create key
          </button>
        }
      />

      {keys === null ? null : keys.length === 0 ? (
        <div
          style={{
            padding: '44px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {KeyIcon}
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No API keys yet</div>
            <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 4 }}>
              Create a daemon key to connect integrations and CI.
            </div>
          </div>
          <button
            onClick={() => setModal('create')}
            className="hover-btn"
            style={{ ...btnStyle, padding: '8px 15px' }}
          >
            Create key
          </button>
        </div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          {keys.map((k, i) => (
            <div
              key={k.id}
              className="hover-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '11px 16px',
                borderBottom: i === keys.length - 1 ? 'none' : '1px solid var(--border)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {k.name}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: 'var(--faint)',
                    fontFamily: 'var(--mono)',
                    marginTop: 3,
                  }}
                >
                  {k.keyPrefix}…
                  <button
                    onClick={() => showToast('Key prefix copied')}
                    aria-label="Copy key prefix"
                    title="Copy"
                    style={{
                      cursor: 'pointer',
                      opacity: 0.7,
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      color: 'inherit',
                    }}
                  >
                    ⧉
                  </button>
                </div>
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--faint)', flex: 'none' }}>
                {format(new Date(k.createdAt), 'MMM d, yyyy')}
              </span>
              <button
                onClick={() => {
                  if (!window.confirm(`Revoke API key "${k.name}"?`)) return;
                  revoke(k.id);
                }}
                style={{
                  fontSize: 12.5,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  flex: 'none',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {modal === 'create' && (
        <Modal title="Create API key" onClose={() => setModal(null)}>
          <FieldLabel htmlFor="key-name">Key name</FieldLabel>
          <input
            id="key-name"
            name="key-name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production daemon"
            style={textInputStyle}
          />
          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 11, lineHeight: 1.5 }}>
            The full key is shown once on creation. Store it somewhere safe.
          </div>
          <ModalActions onCancel={() => setModal(null)} cta="Create key" onSubmit={submitCreate} />
        </Modal>
      )}

      {modal === 'created' && (
        <Modal title="API key created" onClose={() => setModal(null)}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
            Copy your key now — you won&apos;t be able to see it again.
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--bg)',
              border: '1px solid var(--border-2)',
              borderRadius: 9,
              padding: '11px 13px',
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 12.5,
                color: 'var(--green)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: 'var(--mono)',
              }}
            >
              {fullKey}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(fullKey);
                showToast('Key copied to clipboard');
              }}
              aria-label="Copy key"
              title="Copy"
              style={{
                cursor: 'pointer',
                color: 'var(--faint)',
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
              }}
            >
              ⧉
            </button>
          </div>
          <ModalActions cta="Done" onSubmit={() => setModal(null)} />
        </Modal>
      )}
    </section>
  );
}
