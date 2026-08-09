'use client';

import { useRef, useState } from 'react';
import { canManageOrg, isUnauthorized } from '@/lib/api';
import { useMe } from '@/lib/use-api';
import { initials } from '@/lib/initials';
import { AccountView } from '@/components/AccountView';
import { OrgView } from '@/components/OrgView';
import { SettingsView } from '@/components/SettingsView';
import { DashboardHome } from '@/components/DashboardHome';
import { ToastProvider } from '@/components/ToastProvider';

type View = 'home' | 'account' | 'org' | 'settings';

const I = {
  home: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.85, flex: 'none' }}
    >
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v9h5v-6h4v6h5v-9" />
    </svg>
  ),
  person: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.85, flex: 'none' }}
    >
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </svg>
  ),
  org: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.85, flex: 'none' }}
    >
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h6" />
    </svg>
  ),
  settings: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.85, flex: 'none' }}
    >
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2" />
      <circle cx="7" cy="16" r="2" />
    </svg>
  ),
};

export function Dashboard() {
  const { data, isLoading, error } = useMe();
  const [view, setView] = useState<View>('home');
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [collapse, setCollapse] = useState<{ account: boolean; org: boolean }>({
    account: false,
    org: false,
  });
  const mainRef = useRef<HTMLDivElement>(null);

  const profile = data?.profile ?? null;
  const status = isLoading
    ? 'loading'
    : error
      ? isUnauthorized(error)
        ? 'unauthorized'
        : 'error'
      : 'ready';

  function nav(v: View) {
    setView(v);
    setCollapse((c) => ({ ...c, [v]: false }));
    requestAnimationFrame(() => mainRef.current?.scrollTo({ top: 0 }));
  }

  if (status === 'loading') return <Centered>Loading…</Centered>;
  if (status === 'unauthorized')
    return <Centered>Sign in required — no session cookie found.</Centered>;
  if (status === 'error' || !profile)
    return <Centered>Couldn&apos;t reach the Cloud API.</Centered>;

  const canManage = canManageOrg(profile.member.role);
  const displayName = profile.user.name ?? profile.user.email;

  return (
    <ToastProvider>
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

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setOrgMenuOpen((o) => !o)}
                aria-expanded={orgMenuOpen}
                className="hover-ghost"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  cursor: 'pointer',
                  padding: '4px 9px',
                  borderRadius: 9,
                  background: 'transparent',
                  border: 'none',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
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
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    lineHeight: 1.15,
                    minWidth: 0,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{profile.org.name}</span>
                  <span
                    style={{
                      fontSize: 10.5,
                      color: 'var(--faint)',
                      maxWidth: 160,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Default workspace
                  </span>
                </div>
                <span style={{ color: 'var(--faint)', fontSize: 10, marginLeft: 1 }}>▾</span>
              </button>
              {orgMenuOpen && (
                <>
                  <div
                    onClick={() => setOrgMenuOpen(false)}
                    aria-hidden="true"
                    style={{ position: 'fixed', inset: 0, zIndex: 150 }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 7px)',
                      left: 0,
                      zIndex: 160,
                      width: 266,
                      background: 'var(--panel)',
                      border: '1px solid var(--border-2)',
                      borderRadius: 12,
                      boxShadow: 'var(--shadow-lg)',
                      padding: 7,
                      animation: 'fadeup .14s ease',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10.5,
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        color: 'var(--faint)',
                        fontWeight: 600,
                        padding: '6px 9px 7px',
                      }}
                    >
                      Switch workspace
                    </div>
                    <button
                      className="hover-ghost"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 9px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: 'var(--panel-2)',
                        border: 'none',
                        font: 'inherit',
                        color: 'inherit',
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: 'var(--av-grad)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10.5,
                          fontWeight: 700,
                          flex: 'none',
                        }}
                      >
                        {initials(profile.org.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Default workspace
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--faint)',
                            fontFamily: 'var(--mono)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          oo.ai/{profile.org.slug}
                        </div>
                      </div>
                      <span
                        style={{
                          color: 'var(--accent)',
                          fontSize: 13,
                          fontWeight: 700,
                          width: 14,
                          textAlign: 'center',
                          flex: 'none',
                        }}
                      >
                        ✓
                      </span>
                    </button>
                    <div style={{ height: 1, background: 'var(--border)', margin: '6px 5px' }} />
                    <button
                      onClick={() => setOrgMenuOpen(false)}
                      className="hover-ghost"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 9px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        color: 'var(--muted)',
                        background: 'transparent',
                        border: 'none',
                        font: 'inherit',
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: '1px solid var(--border-2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          lineHeight: 1,
                          color: 'var(--faint)',
                          flex: 'none',
                        }}
                      >
                        +
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Create workspaces</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
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
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              {initials(displayName)}
            </div>
            <span
              style={{
                fontSize: 12.5,
                color: 'var(--muted)',
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {profile.user.email}
            </span>
          </div>
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

            <NavItem
              icon={I.home}
              label="Home"
              active={view === 'home'}
              onClick={() => nav('home')}
            />
            <NavItem
              icon={I.person}
              label="My Account"
              active={view === 'account'}
              onClick={() => nav('account')}
              right={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapse((c) => ({ ...c, account: !c.account }));
                  }}
                  aria-label={collapse.account ? 'Expand submenu' : 'Collapse submenu'}
                  style={{
                    color: 'var(--faint)',
                    fontSize: 10,
                    padding: '2px 3px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {collapse.account ? '▸' : '▾'}
                </button>
              }
            />
            {view === 'account' && !collapse.account && (
              <SubNav items={['Profile', 'Linked accounts', 'API keys', 'Sessions']} />
            )}

            {canManage && (
              <>
                <NavItem
                  icon={I.org}
                  label="Organization"
                  active={view === 'org'}
                  onClick={() => nav('org')}
                  right={
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollapse((c) => ({ ...c, org: !c.org }));
                      }}
                      aria-label={collapse.org ? 'Expand submenu' : 'Collapse submenu'}
                      style={{
                        color: 'var(--faint)',
                        fontSize: 10,
                        padding: '2px 3px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {collapse.org ? '▸' : '▾'}
                    </button>
                  }
                />
                {view === 'org' && !collapse.org && (
                  <SubNav items={['Overview', 'Members', 'Teams', 'Invites']} />
                )}
              </>
            )}

            <div style={{ height: 1, background: 'var(--border)', margin: '10px 4px' }} />
            <NavItem
              icon={I.settings}
              label="Settings"
              active={view === 'settings'}
              onClick={() => nav('settings')}
            />

            <div style={{ marginTop: 'auto', paddingTop: 14 }}>
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '13px 14px',
                  background: 'var(--bg)',
                  boxShadow: 'var(--shadow)',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--faint)',
                      textTransform: 'uppercase',
                      letterSpacing: '.05em',
                      fontWeight: 600,
                    }}
                  >
                    Plan
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: '.02em',
                      color: 'var(--accent)',
                      border: '1px solid var(--accent)',
                      borderRadius: 6,
                      padding: '2px 7px',
                    }}
                  >
                    Free
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 9, lineHeight: 1.5 }}>
                  Free during beta
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--accent)',
                    marginTop: 9,
                    fontWeight: 600,
                  }}
                >
                  Upgrade →
                </div>
              </div>
            </div>
          </nav>

          <main
            ref={mainRef}
            id="main"
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: 'auto',
              position: 'relative',
              background: 'var(--bg)',
            }}
          >
            {view === 'home' && (
              <DashboardHome userName={profile.user.name ?? profile.user.email} />
            )}
            {view === 'account' && <AccountView profile={profile} />}
            {view === 'org' && canManage && <OrgView profile={profile} />}
            {view === 'settings' && <SettingsView />}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="hover-ghost"
      style={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 9,
        background: active ? 'var(--panel-2)' : 'transparent',
      }}
    >
      <button
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '8px 11px',
          background: 'transparent',
          border: 'none',
          borderRadius: 9,
          cursor: 'pointer',
          fontSize: 14,
          color: active ? 'var(--text)' : 'var(--muted)',
          fontWeight: active ? 600 : 500,
          textAlign: 'left',
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
        {icon}
        <span style={{ flex: 1 }}>{label}</span>
      </button>
      {right}
    </div>
  );
}

function SubNav({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, margin: '1px 0 4px' }}>
      {items.map((label) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 11px 6px 38px',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--muted)',
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--faint)',
              flex: 'none',
            }}
          />
          {label}
        </div>
      ))}
    </div>
  );
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
  );
}
