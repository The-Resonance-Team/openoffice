// Renders the design's empty-state visual pattern (icon + title + subtitle)
// for sections cloud-api doesn't expose a list endpoint for yet — never a
// faked "0 items" empty state, which would misreport real backend data.
export function ComingSoon({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      style={{
        padding: '44px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        border: '1px dashed var(--border-2)',
        borderRadius: 18,
        background: 'var(--panel)',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--faint)', maxWidth: 360, lineHeight: 1.5 }}>
        {detail}
      </div>
    </div>
  );
}
