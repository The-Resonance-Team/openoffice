import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'openoffice — Get office work done with agents you can watch',
  description:
    'Draft decks, reconcile spreadsheets, summarize contracts and clear the inbox — while every step streams live and every change waits for your approval.',
};

export default function LandingPage() {
  return (
    <main
      id="main"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '96px 28px 40px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '.14em',
          color: 'var(--faint)',
          textTransform: 'uppercase',
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: '5px 13px',
          marginBottom: 30,
        }}
      >
        AI workspace for operations · beta
      </div>
      <h1
        style={{
          fontSize: 'clamp(38px,6vw,68px)',
          fontWeight: 700,
          lineHeight: 1.02,
          letterSpacing: '-.03em',
          margin: 0,
          maxWidth: 900,
        }}
      >
        Get office work done with agents you can watch.
      </h1>
      <p
        style={{
          color: 'var(--dim)',
          fontSize: 16,
          maxWidth: 620,
          margin: '26px 0 0',
          lineHeight: 1.6,
        }}
      >
        Draft decks, reconcile spreadsheets, summarize contracts and clear the inbox — while every
        step streams live and every change waits for your approval.
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 38 }}>
        <Link
          href="/register"
          className="hover-btn"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
            border: 'none',
            borderRadius: 9,
            padding: '13px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Start building free
        </Link>
        <Link
          href="/docs/download"
          className="hover-ghost"
          style={{
            background: 'transparent',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            padding: '13px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Connect your apps
        </Link>
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: 940,
          marginTop: 66,
          border: '1px solid var(--border)',
          borderRadius: 14,
          overflow: 'hidden',
          background: 'var(--panel)',
          boxShadow: '0 30px 90px -40px #000a',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            height: 38,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '0 15px',
            borderBottom: '1px solid var(--border-soft)',
            background: 'var(--elev)',
          }}
        >
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#e5555a' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#e0a13a' }} />
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#26c165' }} />
          <span style={{ marginLeft: 12, fontSize: 11.5, color: 'var(--faint)' }}>
            openoffice · task · Q3-Board.pptx
          </span>
        </div>
        <div
          style={{
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            fontSize: 12.5,
            fontFamily: 'var(--mono)',
          }}
        >
          <div style={{ color: 'var(--dim)' }}>
            <span style={{ color: 'var(--accent)' }}>you ▸</span> Draft the Q3 board deck from the
            metrics sheet.
          </div>
          <div style={{ color: 'var(--text)' }}>
            <span style={{ color: 'var(--green)' }}>agent ▸</span> Planning. Opening Q3-Metrics.xlsx
            and the brand template…
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              color: 'var(--dim)',
              background: 'var(--elev)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8,
              padding: '9px 12px',
              width: 'fit-content',
            }}
          >
            <span style={{ color: 'var(--teal)' }}>◆ open</span> Finance / Q3-Metrics.xlsx{' '}
            <span style={{ color: 'var(--faint)' }}>3 tabs · 14 KPIs</span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              color: 'var(--dim)',
              background: 'var(--elev)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8,
              padding: '9px 12px',
              width: 'fit-content',
            }}
          >
            <span style={{ color: 'var(--amber)' }}>◆ edit</span> Finance / Q3-Board.pptx{' '}
            <span style={{ color: 'var(--green)' }}>+3 slides</span>
          </div>
          <div style={{ color: 'var(--text)' }}>
            <span style={{ color: 'var(--green)' }}>agent ▸</span> Building churn + headcount slides
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 15,
                background: 'var(--text)',
                marginLeft: 3,
                verticalAlign: '-2px',
                animation: 'blink 1s steps(1) infinite',
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
