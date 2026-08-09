'use client';

import { useMemo, useState } from 'react';

type SessionStatus = 'running' | 'review' | 'done' | 'archived';

interface Session {
  id: string;
  title: string;
  projectId: string;
  branch: string;
  model: string;
  msgs: number;
  status: SessionStatus;
  updated: string;
}

interface Project {
  id: string;
  name: string;
  sessions: number;
  updated: string;
  branch: string;
  tint: string;
}

interface StatusFilter {
  label: string;
  count: number;
  dot: string;
  border: string;
  bg: string;
  color: string;
}

interface GroupedSession {
  name: string;
  tint: string;
  count: string;
  items: SessionRow[];
}

interface SessionRow {
  title: string;
  branch: string;
  model: string;
  msgs: number;
  updated: string;
  status: SessionStatus;
  statusColor: string;
  statusBg: string;
  statusBorder: string;
  dot: string;
  dotGlow: string;
}

const statusMeta: Record<SessionStatus, { c: string; g: string }> = {
  running: { c: 'var(--green)', g: '#26c16533' },
  review: { c: 'var(--amber)', g: '#e0a13a33' },
  done: { c: 'var(--dim)', g: 'transparent' },
  archived: { c: 'var(--faint)', g: 'transparent' },
};

// Mock data — replace with cloud-api endpoints when available
const mockProjects: Project[] = [
  {
    id: 'p1',
    name: 'Finance',
    sessions: 2,
    updated: '2m ago',
    branch: 'Q3-Board.pptx',
    tint: '#2f6bed',
  },
  {
    id: 'p2',
    name: 'Legal',
    sessions: 1,
    updated: '2d ago',
    branch: 'Vendor-MSA.pdf',
    tint: '#26c165',
  },
  {
    id: 'p3',
    name: 'Marketing',
    sessions: 2,
    updated: '38m ago',
    branch: 'Release-Note.docx',
    tint: '#e0a13a',
  },
  {
    id: 'p4',
    name: 'People',
    sessions: 1,
    updated: 'yesterday',
    branch: 'Onboarding.docx',
    tint: '#9b6bed',
  },
];

const mockSessions: Session[] = [
  {
    id: 's1',
    title: 'Draft the Q3 board deck from the metrics sheet',
    projectId: 'p1',
    branch: 'Q3-Board.pptx',
    model: 'claude-sonnet-4.5',
    msgs: 24,
    status: 'running',
    updated: '2m ago',
  },
  {
    id: 's2',
    title: 'Reconcile August expenses against budget',
    projectId: 'p1',
    branch: 'Budget-2026.xlsx',
    model: 'deepseek-v4-flash',
    msgs: 31,
    status: 'done',
    updated: '1h ago',
  },
  {
    id: 's3',
    title: 'Summarize the vendor MSA and flag risks',
    projectId: 'p2',
    branch: 'Vendor-MSA.pdf',
    model: 'claude-sonnet-4.5',
    msgs: 19,
    status: 'review',
    updated: '2d ago',
  },
  {
    id: 's4',
    title: 'Clean and dedupe the CRM export',
    projectId: 'p3',
    branch: 'CRM-Export.csv',
    model: 'claude-sonnet-4.5',
    msgs: 12,
    status: 'review',
    updated: '38m ago',
  },
  {
    id: 's5',
    title: 'Write the customer release announcement',
    projectId: 'p3',
    branch: 'Release-Note.docx',
    model: 'claude-sonnet-4.5',
    msgs: 44,
    status: 'done',
    updated: '3d ago',
  },
  {
    id: 's6',
    title: 'Build the new-hire onboarding checklist',
    projectId: 'p4',
    branch: 'Onboarding.docx',
    model: 'claude-haiku',
    msgs: 8,
    status: 'done',
    updated: 'yesterday',
  },
];

// Static derivations of the mock data — computed once at module level
// (5.3/hoisting) instead of per render or per mount.
const sessionCounts: Record<string, number> = {
  All: mockSessions.length,
  Running: 0,
  Review: 0,
  Done: 0,
  Archived: 0,
};
mockSessions.forEach((s) => {
  const key = s.status[0].toUpperCase() + s.status.slice(1);
  if (sessionCounts[key] !== undefined) sessionCounts[key]++;
});

const projectCards = mockProjects.map((p) => ({ ...p, border: 'var(--border)' }));

export function DashboardHome({ userName = 'there' }: { userName?: string }) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filteredSessions = useMemo(() => {
    let sessions = mockSessions;
    if (filter !== 'All') sessions = sessions.filter((s) => s.status === filter.toLowerCase());
    if (search) {
      const q = search.toLowerCase();
      sessions = sessions.filter(
        (s) => s.title.toLowerCase().includes(q) || s.branch.toLowerCase().includes(q),
      );
    }
    return sessions;
  }, [filter, search]);

  const statusFilters: StatusFilter[] = ['All', 'Running', 'Review', 'Done', 'Archived'].map(
    (f) => {
      const active = filter === f;
      const statusKey = f.toLowerCase() as SessionStatus;
      const dotColor = f === 'All' ? 'var(--faint)' : (statusMeta[statusKey]?.c ?? 'var(--faint)');
      return {
        label: f,
        count: sessionCounts[f],
        dot: dotColor,
        border: active ? 'var(--accent)' : 'var(--border)',
        bg: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--dim)',
      };
    },
  );

  const groupedSessions: GroupedSession[] = useMemo(() => {
    const groups: Record<string, Session[]> = {};
    filteredSessions.forEach((s) => {
      (groups[s.projectId] ??= []).push(s);
    });
    const projById = Object.fromEntries(mockProjects.map((p) => [p.id, p]));
    return Object.keys(groups).map((pid) => {
      const p = projById[pid];
      return {
        name: p?.name ?? pid,
        tint: p?.tint ?? 'var(--faint)',
        count: groups[pid].length + ' sessions',
        items: groups[pid].map((x) => {
          const m = statusMeta[x.status];
          return {
            title: x.title,
            branch: x.branch,
            model: x.model,
            msgs: x.msgs,
            updated: x.updated,
            status: x.status,
            statusColor: m.c,
            statusBg: x.status === 'running' ? 'var(--panel)' : 'transparent',
            statusBorder: m.c === 'var(--dim)' ? 'var(--border)' : m.c,
            dot: m.c,
            dotGlow: m.g,
          };
        }),
      };
    });
  }, [filteredSessions]);

  const greeting = `Welcome back, ${userName}`;
  const noResults = filteredSessions.length === 0;

  return (
    <div
      style={{ maxWidth: 1080, margin: '0 auto', padding: '34px 40px 90px' }}
      className="fade-in"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 26,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-.01em' }}>
            {greeting}
          </h1>
          <p style={{ color: 'var(--dim)', margin: '6px 0 0', fontSize: 13 }}>
            {mockSessions.length} sessions across {mockProjects.length} workspaces.
          </p>
        </div>
        <button
          className="hover-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 6px 15px -8px rgba(236,48,19,.6)',
          }}
        >
          <span style={{ fontSize: 15 }}>+</span> New session
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 9,
            padding: '9px 13px',
          }}
        >
          <span style={{ color: 'var(--faint)' }}>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions, projects, branches…"
            aria-label="Search sessions"
            autoComplete="off"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--text)',
              fontSize: 13,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: 'var(--faint)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              padding: '2px 6px',
            }}
          >
            ⌘K
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 26, flexWrap: 'wrap' }}>
        {statusFilters.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.label)}
            aria-pressed={filter === f.label}
            className="hover-ghost"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 999,
              cursor: 'pointer',
              fontSize: 12,
              border: `1px solid ${f.border}`,
              background: f.bg,
              color: f.color,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.dot }} />
            {f.label}
            <span style={{ color: 'var(--faint)' }}>{f.count}</span>
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
          gap: 12,
          marginBottom: 34,
        }}
      >
        {projectCards.map((p) => (
          <div
            key={p.id}
            style={{
              border: `1px solid ${p.border}`,
              background: 'var(--panel)',
              borderRadius: 11,
              padding: '15px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 2, background: p.tint }} />
                {p.name}
              </span>
              <span style={{ color: 'var(--faint)', fontSize: 11 }}>{p.updated}</span>
            </div>
            <div style={{ color: 'var(--dim)', fontSize: 11.5, marginTop: 12 }}>
              {p.sessions} sessions · {p.branch}
            </div>
          </div>
        ))}
      </div>

      {groupedSessions.map((g) => (
        <div key={g.name} style={{ marginBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: g.tint }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</span>
            <span style={{ color: 'var(--faint)', fontSize: 11.5 }}>{g.count}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {g.items.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  borderRadius: 9,
                  border: '1px solid transparent',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: s.dot,
                    flex: 'none',
                    boxShadow: `0 0 0 3px ${s.dotGlow}`,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.title}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      color: 'var(--faint)',
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    <span>{s.branch}</span>
                    <span>·</span>
                    <span>{s.model}</span>
                    <span>·</span>
                    <span>{s.msgs} msgs</span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    color: s.statusColor,
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                    border: `1px solid ${s.statusBorder}`,
                    borderRadius: 6,
                    padding: '3px 8px',
                    background: s.statusBg,
                  }}
                >
                  {s.status}
                </span>
                <span
                  style={{ fontSize: 11, color: 'var(--faint)', width: 70, textAlign: 'right' }}
                >
                  {s.updated}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {noResults && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--faint)' }}>
          No sessions match &ldquo;{search}&rdquo;.
        </div>
      )}
    </div>
  );
}
