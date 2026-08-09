'use client'

import { useEffect, useState } from 'react'
import {
  createApiKey,
  listApiKeys,
  oauthConnectUrl,
  resendVerification,
  revokeApiKey,
  type DaemonApiKey,
  type MemberProfile,
} from '@/lib/api'
import { FieldLabel, Modal, ModalActions, textInputStyle } from '@/components/Modal'
import { initials } from '@/lib/initials'

const card: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  boxShadow: 'var(--shadow)',
}

export function AccountView({ profile }: { profile: MemberProfile }) {
  const { user, member, org } = profile
  const [toast, setToast] = useState<string | null>(null)

  function showToast(t: string) {
    setToast(t)
    setTimeout(() => setToast(null), 2600)
  }

  return (
    <div
      style={{ maxWidth: 800, margin: '0 auto', padding: '30px 28px 100px' }}
      className="fade-in"
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>You</h1>
        <p style={{ color: 'var(--muted)', margin: '8px 0 0', fontSize: 14 }}>
          Your identity, linked providers, and Daemon API Keys.
        </p>
      </div>

      <section id="sec-profile" style={{ scrollMarginTop: 14 }}>
        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
                      fontSize: '10.5px',
                      fontWeight: 600,
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
                      fontSize: '10.5px',
                      fontWeight: 600,
                      color: 'var(--amber)',
                      border: '1px solid var(--amber)',
                      borderRadius: 6,
                      padding: '1px 7px',
                    }}
                  >
                    Unverified{' '}
                    <span
                      onClick={async () => {
                        await resendVerification(user.email)
                        showToast('Verification email sent')
                      }}
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Resend
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2,1fr)',
              gap: 16,
              marginTop: 19,
              paddingTop: 18,
              borderTop: '1px solid var(--border)',
            }}
          >
            <Stat label="Org role" value={member.role} color="var(--accent)" />
            <Stat label="Organization" value={org.name} />
          </div>
        </div>
      </section>

      <section id="sec-linked" style={{ scrollMarginTop: 14, marginTop: 30 }}>
        <SectionHeader title="Linked providers" subtitle="Sign in faster via Google or GitHub." />
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
                  fontSize: '12.5px',
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
                  Sign in with {p === 'google' ? 'Google' : 'GitHub'}
                </div>
              </div>
              <a
                href={oauthConnectUrl(p)}
                style={{
                  background: 'transparent',
                  color: 'var(--text)',
                  border: '1px solid var(--border-2)',
                  borderRadius: 9,
                  padding: '7px 13px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                }}
                className="hover-ghost"
              >
                Connect
              </a>
            </div>
          ))}
        </div>
      </section>

      <ApiKeysSection showToast={showToast} />

      {toast && <Toast text={toast} />}
    </div>
  )
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
          fontSize: '13.5px',
          marginTop: 6,
          color: color ?? 'var(--muted)',
          fontWeight: color ? 600 : 400,
        }}
      >
        {value}
      </div>
    </div>
  )
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: React.ReactNode
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
  )
}

export function Toast({ text }: { text: string }) {
  return (
    <div
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
  )
}

function maskKey(prefix: string) {
  return `${prefix}…`
}

function ApiKeysSection({ showToast }: { showToast: (t: string) => void }) {
  const [keys, setKeys] = useState<DaemonApiKey[] | null>(null)
  const [modal, setModal] = useState<'create' | 'created' | null>(null)
  const [name, setName] = useState('')
  const [fullKey, setFullKey] = useState('')

  useEffect(() => {
    listApiKeys().then((r) => setKeys(r.keys))
  }, [])

  async function submitCreate() {
    const { key } = await createApiKey(name || 'New key')
    setFullKey(key)
    setModal('created')
    setName('')
    listApiKeys().then((r) => setKeys(r.keys))
  }

  async function revoke(id: string) {
    await revokeApiKey(id)
    setKeys((k) => k?.filter((x) => x.id !== id) ?? null)
    showToast('Daemon API Key revoked')
  }

  return (
    <section id="sec-keys" style={{ scrollMarginTop: 14, marginTop: 30 }}>
      <SectionHeader
        title="Daemon API Keys"
        subtitle="Long-lived keys the daemon presents to Cloud."
        action={
          <button
            onClick={() => setModal('create')}
            className="hover-btn"
            style={{
              background: 'var(--accent-grad)',
              color: '#fff',
              border: 'none',
              borderRadius: 9,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              boxShadow: '0 6px 15px -8px rgba(236,48,19,.6)',
            }}
          >
            Create key
          </button>
        }
      />

      {keys === null ? null : keys.length === 0 ? (
        <div style={{ padding: '44px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>No Daemon API Keys yet</div>
          <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 4 }}>
            Create one to connect a daemon to this org.
          </div>
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
                <div style={{ fontSize: 14, fontWeight: 600 }}>{k.name}</div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--faint)',
                    fontFamily: 'var(--mono)',
                    marginTop: 3,
                  }}
                >
                  {maskKey(k.keyPrefix)}
                </div>
              </div>
              <span style={{ fontSize: '12.5px', color: 'var(--faint)', flex: 'none' }}>
                {new Date(k.createdAt).toLocaleDateString()}
              </span>
              <span
                onClick={() => revoke(k.id)}
                style={{
                  fontSize: '12.5px',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Revoke
              </span>
            </div>
          ))}
        </div>
      )}

      {modal === 'create' && (
        <Modal title="Create Daemon API Key" onClose={() => setModal(null)}>
          <FieldLabel htmlFor="key-name">Key name</FieldLabel>
          <input
            id="key-name"
            name="key-name"
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
        <Modal title="Daemon API Key created" onClose={() => setModal(null)}>
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
                fontSize: '12.5px',
                color: 'var(--green)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: 'var(--mono)',
              }}
            >
              {fullKey}
            </span>
            <span
              onClick={() => {
                navigator.clipboard.writeText(fullKey)
                showToast('Key copied to clipboard')
              }}
              title="Copy"
              style={{ cursor: 'pointer', color: 'var(--faint)' }}
            >
              ⧉
            </span>
          </div>
          <ModalActions cta="Done" onSubmit={() => setModal(null)} />
        </Modal>
      )}
    </section>
  )
}
