'use client'

import { useEffect, useState } from 'react'
import { canManageOrg, getMe, isUnauthorized, logout, type MemberProfile } from '@/lib/api'
import { initials } from '@/lib/initials'
import { AccountView } from '@/components/AccountView'
import { OrgView } from '@/components/OrgView'

type View = 'home' | 'you' | 'org'

export function Dashboard() {
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'unauthorized' | 'error'>('loading')
  const [view, setView] = useState<View>('home')

  useEffect(() => {
    getMe()
      .then((r) => {
        setProfile(r.profile)
        setStatus('ready')
      })
      .catch((err) => setStatus(isUnauthorized(err) ? 'unauthorized' : 'error'))
  }, [])

  if (status === 'loading') return <Centered>Loading…</Centered>
  if (status === 'unauthorized')
    return <Centered>Sign in required — no session cookie found.</Centered>
  if (status === 'error' || !profile) return <Centered>Couldn&apos;t reach the Cloud API.</Centered>

  const canManage = canManageOrg(profile.member.role)
  const displayName = profile.user.name ?? profile.user.email

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <header
        style={{
          height: 54,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              style={{
                width: 22,
                height: 22,
                border: '2px solid var(--text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 8, height: 8, background: 'var(--accent)' }} />
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-.02em' }}>
              openoffice
            </span>
          </div>
          <span style={{ width: 1, height: 18, background: 'var(--border-2)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 9px' }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                background: 'var(--av-grad)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 800,
                flex: 'none',
              }}
            >
              {initials(profile.org.name)}
            </div>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{profile.org.name}</span>
          </div>
        </div>
        <button
          onClick={async () => {
            await logout()
            window.location.reload()
          }}
          className="hover-ghost"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            background: 'transparent',
            border: 'none',
            padding: '4px 10px 4px 4px',
            borderRadius: 9,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'var(--av-grad)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10.5px',
              fontWeight: 700,
            }}
          >
            {initials(displayName)}
          </div>
          <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>Sign out</span>
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <nav
          style={{
            width: 224,
            flex: 'none',
            borderRight: '1px solid var(--border)',
            background: 'var(--panel)',
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: '.06em',
              color: 'var(--faint)',
              textTransform: 'uppercase',
              fontWeight: 600,
              padding: '6px 11px 8px',
            }}
          >
            Menu
          </div>
          <NavItem label="Home" active={view === 'home'} onClick={() => setView('home')} />
          <NavItem label="You" active={view === 'you'} onClick={() => setView('you')} />
          {canManage && (
            <NavItem label="Organization" active={view === 'org'} onClick={() => setView('org')} />
          )}
        </nav>

        <main
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            position: 'relative',
            background: 'var(--bg)',
          }}
        >
          {view === 'home' && <HomeView onGo={setView} canManage={canManage} />}
          {view === 'you' && <AccountView profile={profile} />}
          {view === 'org' && canManage && <OrgView profile={profile} />}
        </main>
      </div>
    </div>
  )
}

function NavItem({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="hover-ghost"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: '8px 11px',
        borderRadius: 9,
        cursor: 'pointer',
        fontSize: 14,
        color: active ? 'var(--text)' : 'var(--muted)',
        background: active ? 'var(--panel-2)' : 'transparent',
        fontWeight: active ? 600 : 500,
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: -12,
          top: 8,
          bottom: 8,
          width: 3,
          borderRadius: '0 3px 3px 0',
          background: active ? 'var(--accent)' : 'transparent',
        }}
      />
      {label}
    </div>
  )
}

function HomeView({ onGo, canManage }: { onGo: (v: View) => void; canManage: boolean }) {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '30px 28px 90px' }} className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>
          Welcome back
        </h1>
        <p style={{ color: 'var(--muted)', margin: '8px 0 0', fontSize: 14 }}>
          Your identity and organization, in one place.
        </p>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
          gap: 13,
        }}
      >
        <HomeCard
          title="You"
          detail="Identity, linked providers, and Daemon API Keys."
          onClick={() => onGo('you')}
        />
        {canManage && (
          <HomeCard
            title="Organization"
            detail="Members, teams, roles and pending invitations."
            onClick={() => onGo('org')}
          />
        )}
      </div>
    </div>
  )
}

function HomeCard({
  title,
  detail,
  onClick,
}: {
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="hover-card"
      style={{
        border: '1px solid var(--border)',
        background: 'var(--panel)',
        borderRadius: 18,
        padding: '20px 22px',
        cursor: 'pointer',
        boxShadow: 'var(--shadow)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', flex: 1 }}>
          {title}
        </span>
        <span style={{ color: 'var(--faint)' }}>→</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12, lineHeight: 1.55 }}>
        {detail}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted)',
        fontSize: 14,
      }}
    >
      {children}
    </div>
  )
}
