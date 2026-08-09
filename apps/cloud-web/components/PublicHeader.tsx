'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function PublicHeader() {
  const pathname = usePathname()
  const isDocs = pathname?.startsWith('/docs')
  const isChangelog = pathname?.startsWith('/changelog')

  return (
    <header
      style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        borderBottom: '1px solid var(--border-soft)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'var(--bg)',
      }}
    >
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}>
        <div
          style={{
            width: 24,
            height: 24,
            border: '2px solid var(--text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: 8, height: 8, background: 'var(--text)' }} />
        </div>
        <span style={{ fontWeight: 700, letterSpacing: '-.01em', color: 'var(--text)' }}>
          openoffice
        </span>
      </Link>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          fontSize: 12.5,
          color: 'var(--dim)',
        }}
      >
        <Link
          href="/docs"
          style={{ cursor: 'pointer', color: isDocs ? 'var(--text)' : 'var(--dim)' }}
        >
          Docs
        </Link>
        <Link
          href="/changelog"
          style={{ cursor: 'pointer', color: isChangelog ? 'var(--text)' : 'var(--dim)' }}
        >
          Changelog
        </Link>
        <Link href="/login" style={{ cursor: 'pointer' }}>
          Sign in
        </Link>
        <Link
          href="/register"
          className="hover-btn"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            border: 'none',
            borderRadius: 7,
            padding: '8px 15px',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Get started
        </Link>
      </div>
    </header>
  )
}
