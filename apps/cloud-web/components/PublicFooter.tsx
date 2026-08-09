import Link from 'next/link';
import { docHref } from '@/lib/docs';

export function PublicFooter() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-soft)',
        padding: '20px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        fontSize: 12,
        color: 'var(--faint)',
      }}
    >
      <span>©2026 openoffice</span>
      <Link href={docHref('legal')} style={{ cursor: 'pointer', color: 'var(--faint)' }}>
        Privacy
      </Link>
      <Link href={docHref('legal')} style={{ cursor: 'pointer', color: 'var(--faint)' }}>
        Terms
      </Link>
      <Link href="/docs" style={{ cursor: 'pointer', color: 'var(--faint)' }}>
        Docs
      </Link>
      <span style={{ marginLeft: 'auto' }}>English ⌄</span>
    </footer>
  );
}
