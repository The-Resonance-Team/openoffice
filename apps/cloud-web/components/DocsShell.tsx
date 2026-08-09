'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { DOCS, DOC_SECTIONS, docHref, tagStyle, type Doc } from '@/lib';

export function DocsShell({ doc }: { doc: Doc }) {
  const [query, setQuery] = useState('');
  const isChangelogPage = !!doc.changelog;
  const q = query.trim().toLowerCase();

  const navGroups = useMemo(
    () =>
      DOC_SECTIONS.map((section) => ({
        section,
        items: DOCS.filter(
          (d) => d.section === section && (!q || d.title.toLowerCase().includes(q)),
        ),
      })).filter((g) => g.items.length),
    [q],
  );

  const idx = DOCS.findIndex((d) => d.id === doc.id);
  const prev = idx > 0 ? DOCS[idx - 1] : null;
  const next = idx >= 0 && idx < DOCS.length - 1 ? DOCS[idx + 1] : null;

  const tocItems = isChangelogPage
    ? (doc.releases ?? []).map((rl, i) => ({
        label: `${rl.version}  ·  ${rl.dateShort}`,
        id: `doc-sec-${i}`,
      }))
    : (doc.blocks ?? []).map((b, i) => ({ label: b.h, id: `doc-sec-${i}` }));

  const secIds = tocItems.map((t) => t.id);
  const [activeSec, setActiveSec] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!secIds.length) return;
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
        setActiveSec((prev) => (prev === cur ? prev : cur));
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  const activeSecId = activeSec ?? secIds[0];

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
                  const active = it.id === doc.id;
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
            <span>{doc.section}</span>
            <span style={{ opacity: 0.45 }}>/</span>
            <span style={{ color: 'var(--dim)' }}>{doc.title}</span>
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
            {doc.title}
          </h1>
          <p style={{ color: 'var(--dim)', fontSize: 15.5, lineHeight: 1.6, margin: '0 0 30px' }}>
            {doc.lede}
          </p>
          <div style={{ height: 1, background: 'var(--border-soft)', marginBottom: 34 }} />

          {!isChangelogPage && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              {(doc.blocks ?? []).map((b, i) => (
                <div key={i} id={`doc-sec-${i}`} style={{ scrollMarginTop: 84 }}>
                  <h2
                    style={{
                      fontSize: 19,
                      fontWeight: 600,
                      letterSpacing: '-.01em',
                      margin: '0 0 9px',
                    }}
                  >
                    {b.h}
                  </h2>
                  <p style={{ color: 'var(--dim)', fontSize: 14, lineHeight: 1.75, margin: 0 }}>
                    {b.p}
                  </p>
                </div>
              ))}
            </div>
          )}

          {isChangelogPage && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(doc.releases ?? []).map((rl, i) => {
                const style = tagStyle(rl.tag);
                return (
                  <div
                    key={i}
                    id={`doc-sec-${i}`}
                    style={{
                      position: 'relative',
                      padding: '0 0 32px 26px',
                      borderLeft: '1px solid var(--border)',
                      scrollMarginTop: 84,
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
                      <span style={{ fontSize: 12, color: 'var(--faint)' }}>{rl.date}</span>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--dim)',
                          border: '1px solid var(--border)',
                          borderRadius: 5,
                          padding: '1px 7px',
                        }}
                      >
                        {rl.version}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: '.04em',
                          textTransform: 'uppercase',
                          color: style.color,
                          background: style.bg,
                          borderRadius: 5,
                          padding: '2px 7px',
                        }}
                      >
                        {rl.tag}
                      </span>
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
                      {rl.h}
                    </div>
                    <div style={{ color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.65 }}>
                      {rl.p}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
          {isChangelogPage ? 'Releases' : 'On this page'}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid var(--border-soft)',
          }}
        >
          {tocItems.map((t) => {
            const active = t.id === activeSecId;
            return (
              <a
                key={t.id}
                href={`#${t.id}`}
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
                {t.label}
              </a>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
