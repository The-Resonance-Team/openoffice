'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { DOC_SECTIONS, type DocMeta } from '@/lib/docs-loader';

interface DocsLayoutProps {
  docs: DocMeta[];
  currentDoc: DocMeta;
  children: React.ReactNode;
}

export function DocsLayout({ docs, currentDoc, children }: DocsLayoutProps) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const navGroups = useMemo(
    () =>
      DOC_SECTIONS.map((section) => ({
        section,
        items: docs.filter(
          (d) => d.section === section && (!q || d.title.toLowerCase().includes(q)),
        ),
      })).filter((g) => g.items.length),
    [docs, q],
  );

  const idx = docs.findIndex((d) => d.id === currentDoc.id);
  const prev = idx > 0 ? docs[idx - 1] : null;
  const next = idx >= 0 && idx < docs.length - 1 ? docs[idx + 1] : null;

  const [headings, setHeadings] = useState<{ id: string; text: string }[]>([]);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    const h2s = main.querySelectorAll('h2[id]');
    const items = Array.from(h2s).map((el) => ({
      id: el.id,
      text: el.textContent ?? '',
    }));
    setHeadings(items);

    const secIds = items.map((h) => h.id);
    function onScroll() {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const y = window.scrollY + 100;
        let cur = secIds[0];
        for (const id of secIds) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top + window.scrollY <= y) cur = id;
        }
        setActiveHeading((prev) => (prev === cur ? prev : cur));
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [currentDoc.id]);

  function docHref(id: string): string {
    if (id === 'introduction') return '/docs';
    return `/docs/${id}`;
  }

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        maxWidth: 1360,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '256px minmax(0,1fr) 236px',
        alignItems: 'start',
      }}
    >
      <aside
        style={{
          position: 'sticky',
          top: 60,
          alignSelf: 'start',
          maxHeight: 'calc(100vh - 60px)',
          overflowY: 'auto',
          padding: '28px 16px 48px',
          borderRight: '1px solid var(--border-soft)',
        }}
      >
        <div style={{ position: 'relative', marginBottom: 22 }}>
          <span
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--faint)',
              fontSize: 13,
            }}
          >
            ⌕
          </span>
          <input
            name="docs-search"
            aria-label="Search docs"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search docs"
            style={{
              width: '100%',
              background: 'var(--elev)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: 8,
              padding: '8px 11px 8px 32px',
              fontSize: 12.5,
            }}
          />
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {navGroups.map((grp) => (
            <div key={grp.section}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '.05em',
                  color: 'var(--faint)',
                  textTransform: 'uppercase',
                  margin: '0 0 9px 10px',
                }}
              >
                {grp.section}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {grp.items.map((it) => {
                  const active = it.id === currentDoc.id;
                  return (
                    <Link
                      key={it.id}
                      href={docHref(it.id)}
                      className="hover-ghost"
                      style={{
                        padding: '6px 10px',
                        borderRadius: 7,
                        cursor: 'pointer',
                        fontSize: 13,
                        color: active ? 'var(--text)' : 'var(--dim)',
                        fontWeight: active ? 600 : 400,
                        background: active ? 'var(--elev2)' : 'transparent',
                        borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                      }}
                    >
                      {it.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main id="main" style={{ minWidth: 0, padding: '46px 54px 72px' }}>
        <div style={{ maxWidth: 720 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              fontSize: 12,
              color: 'var(--faint)',
              marginBottom: 15,
            }}
          >
            <span>{currentDoc.section}</span>
            <span style={{ opacity: 0.45 }}>/</span>
            <span style={{ color: 'var(--dim)' }}>{currentDoc.title}</span>
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
            {currentDoc.title}
          </h1>
          <p style={{ color: 'var(--dim)', fontSize: 15.5, lineHeight: 1.6, margin: '0 0 30px' }}>
            {currentDoc.lede}
          </p>
          <div style={{ height: 1, background: 'var(--border-soft)', marginBottom: 34 }} />

          {children}

          <div style={{ display: 'flex', gap: 14, marginTop: 50 }}>
            {prev && (
              <Link
                href={docHref(prev.id)}
                className="hover-card"
                style={{
                  flex: 1,
                  border: '1px solid var(--border)',
                  borderRadius: 11,
                  padding: '14px 17px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 5 }}>
                  ← Previous
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {prev.title}
                </div>
              </Link>
            )}
            {next && (
              <Link
                href={docHref(next.id)}
                className="hover-card"
                style={{
                  flex: 1,
                  border: '1px solid var(--border)',
                  borderRadius: 11,
                  padding: '14px 17px',
                  cursor: 'pointer',
                  textAlign: 'right',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 5 }}>Next →</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {next.title}
                </div>
              </Link>
            )}
          </div>
        </div>
      </main>

      <aside
        style={{
          position: 'sticky',
          top: 60,
          alignSelf: 'start',
          maxHeight: 'calc(100vh - 60px)',
          overflowY: 'auto',
          padding: '46px 22px 48px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.06em',
            color: 'var(--faint)',
            textTransform: 'uppercase',
            marginBottom: 13,
          }}
        >
          On this page
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid var(--border-soft)',
          }}
        >
          {headings.map((h) => {
            const active = h.id === activeHeading;
            return (
              <a
                key={h.id}
                href={`#${h.id}`}
                className="doc-toc-link"
                style={{
                  cursor: 'pointer',
                  fontSize: 12.5,
                  lineHeight: 1.4,
                  color: active ? 'var(--text)' : 'var(--dim)',
                  padding: '5px 0 5px 14px',
                  marginLeft: -1,
                  borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                {h.text}
              </a>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
