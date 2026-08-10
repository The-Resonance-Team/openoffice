import type { Metadata } from 'next';
import { fetchChangelog } from '@/lib/changelog';

export const metadata: Metadata = {
  title: 'Changelog — openoffice',
  description: 'Product updates, shipped weekly.',
};

export default async function ChangelogPage() {
  const entries = await fetchChangelog();

  return (
    <main
      id="main"
      style={{
        flex: 1,
        width: '100%',
        maxWidth: 800,
        margin: '0 auto',
        padding: '46px 24px 72px',
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: 'var(--faint)',
          marginBottom: 15,
        }}
      >
        Reference / Changelog
      </div>
      <h1
        style={{
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: '-.025em',
          lineHeight: 1.08,
          margin: '0 0 14px',
        }}
      >
        Changelog
      </h1>
      <p style={{ color: 'var(--dim)', fontSize: 15.5, lineHeight: 1.6, margin: '0 0 30px' }}>
        Product updates, shipped weekly.
      </p>
      <div style={{ height: 1, background: 'var(--border-soft)', marginBottom: 34 }} />

      {entries.length === 0 ? (
        <p style={{ color: 'var(--dim)', fontSize: 14 }}>No releases found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {entries.map((entry, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                padding: '0 0 32px 26px',
                borderLeft: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: -5,
                  top: 4,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  boxShadow: '0 0 0 4px var(--bg)',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>{entry.date}</span>
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 11,
                    color: 'var(--dim)',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    padding: '1px 7px',
                    textDecoration: 'none',
                  }}
                >
                  {entry.version}
                </a>
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: '-.01em',
                  marginBottom: 6,
                  color: 'var(--text)',
                }}
              >
                {entry.title}
              </div>
              <div
                style={{
                  color: 'var(--dim)',
                  fontSize: 13.5,
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {entry.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
