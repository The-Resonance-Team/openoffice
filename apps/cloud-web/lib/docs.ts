// Content copied verbatim from the design's `DOCS` array (openoffice.dc.html,
// Claude Design project 14513ceb-a521-49e5-b7d3-b2c1a85ae59f). Swap to MDX if
// docs ever need authoring outside the build.

export interface DocBlock {
  h: string
  p: string
}

export interface Release {
  date: string
  dateShort: string
  version: string
  tag: 'New' | 'Improved' | 'Fixed'
  h: string
  p: string
}

export type DocSection = 'Getting Started' | 'Working with agents' | 'Reference'

export interface Doc {
  id: string
  section: DocSection
  title: string
  lede: string
  changelog?: boolean
  blocks?: DocBlock[]
  releases?: Release[]
}

export const DOCS: Doc[] = [
  {
    id: 'docs',
    section: 'Getting Started',
    title: 'Introduction',
    lede: 'openoffice runs office work as agents you can watch — drafting decks, reconciling spreadsheets, clearing the inbox — with every change waiting for your approval.',
    blocks: [
      {
        h: 'What openoffice is',
        p: 'A workspace where agents open your real documents and data, do the work step by step, and stream every action live. Nothing is saved or sent until you approve it.',
      },
      {
        h: 'How it works',
        p: 'Connect your apps, describe a task in plain language and pick a model. The agent plans, opens the files it needs, and proposes edits you review in a diff before they land.',
      },
      {
        h: 'Who it’s for',
        p: 'Operations, finance and RevOps teams who live inside Drive, Microsoft 365, a CRM and an inbox — and want the busywork done without losing control of it.',
      },
    ],
  },
  {
    id: 'quickstart',
    section: 'Getting Started',
    title: 'Quickstart',
    lede: 'From zero to your first completed task in about five minutes.',
    blocks: [
      {
        h: 'Create a workspace',
        p: 'Sign in and create a workspace for a team or project. Workspaces keep sessions, integrations and history scoped and separate.',
      },
      {
        h: 'Connect an app',
        p: 'Link at least one source — Google Drive is the fastest — so the agent has documents to work with.',
      },
      {
        h: 'Start a session',
        p: 'Click New session, describe what you need, choose a model, and watch the plan appear step by step.',
      },
      {
        h: 'Approve the result',
        p: 'Open Review, step through each proposed change, and approve, undo or revert before anything is written back.',
      },
    ],
  },
  {
    id: 'concepts',
    section: 'Getting Started',
    title: 'Core concepts',
    lede: 'The handful of ideas that everything else builds on.',
    blocks: [
      {
        h: 'Sessions',
        p: 'A session is one task with its own live stream of steps, tool calls and document edits, grouped under the workspace it belongs to.',
      },
      {
        h: 'The stream',
        p: 'Every action the agent takes appears in order as it happens — files opened, cells edited, drafts written — so there is never a black box.',
      },
      {
        h: 'Review & diffs',
        p: 'Changes to documents and emails collect in Review as diffs. Nothing is committed to the source until you approve it.',
      },
      {
        h: 'Integrations',
        p: 'Connected apps the agent is allowed to read from and write to, scoped per workspace or across the org.',
      },
    ],
  },
  {
    id: 'tasks',
    section: 'Working with agents',
    title: 'Starting a task',
    lede: 'Describe the outcome, not the steps — the agent plans the rest.',
    blocks: [
      {
        h: 'Write a good prompt',
        p: 'Name the deliverable, the source and the destination: "Draft the Q3 board deck from the metrics sheet." The clearer the target, the tighter the plan.',
      },
      {
        h: 'Pick a model',
        p: 'Choose a model per session — heavier reasoning for analysis, faster models for routine cleanup and formatting.',
      },
      {
        h: 'Watch it work',
        p: 'The stream shows each opened file and proposed edit. Steer mid-task with a follow-up message at any point.',
      },
    ],
  },
  {
    id: 'review',
    section: 'Working with agents',
    title: 'Review & approvals',
    lede: 'Every change waits for you. Approve, undo or revert — one edit or all of them.',
    blocks: [
      {
        h: 'The Review tab',
        p: 'Pending document and email changes gather here as diffs, grouped by the file they touch.',
      },
      {
        h: 'Approve or revert',
        p: 'Approve a single edit, approve everything at once, or revert an edit back to the original before it is saved or sent.',
      },
      {
        h: 'Audit trail',
        p: 'Every approval is logged with who, what and when, so a completed task is fully accountable after the fact.',
      },
    ],
  },
  {
    id: 'download',
    section: 'Working with agents',
    title: 'Integrations',
    lede: 'Link the tools your team already uses so the agent can read, draft and edit across them.',
    blocks: [
      {
        h: 'Google Workspace',
        p: 'Connect Drive, Docs, Sheets and Gmail so the agent can open files and draft replies for your approval.',
      },
      {
        h: 'Microsoft 365',
        p: 'Link SharePoint, Word, Excel and Outlook with one click from the org console.',
      },
      {
        h: 'CRM & more',
        p: 'Add Salesforce, HubSpot, Slack and DocuSign as integrations, scoped to org or team.',
      },
      {
        h: 'Scopes & permissions',
        p: 'Every integration is granted per workspace or org-wide, and can be revoked at any time from Settings.',
      },
    ],
  },
  {
    id: 'legal',
    section: 'Reference',
    title: 'Security & privacy',
    lede: 'The short version, in plain language.',
    blocks: [
      {
        h: 'Your documents stay yours',
        p: 'We never train on your files or data. Session history is retained only to render your timeline and can be deleted at any time.',
      },
      {
        h: 'Credentials',
        p: 'Provider keys are stored through the Cred Proxy and are never exposed to the client.',
      },
      {
        h: 'Data location',
        p: 'You control whether models hosted in specific regions are enabled for routing.',
      },
    ],
  },
  {
    id: 'changelog',
    section: 'Reference',
    title: 'Changelog',
    changelog: true,
    lede: 'Product updates, shipped weekly.',
    releases: [
      {
        date: 'August 7, 2026',
        dateShort: 'Aug 7',
        version: 'v1.9',
        tag: 'New',
        h: 'Approvals for every change',
        p: 'Documents and emails now wait in Review — approve, undo or revert each edit before it is saved or sent.',
      },
      {
        date: 'August 1, 2026',
        dateShort: 'Aug 1',
        version: 'v1.8',
        tag: 'New',
        h: 'Usage dashboard',
        p: 'Cost broken down by model and workspace, with a 12-day chart and exportable history.',
      },
      {
        date: 'July 24, 2026',
        dateShort: 'Jul 24',
        version: 'v1.7',
        tag: 'Improved',
        h: 'Cloud Plugins',
        p: 'Add integrations org-wide or per team — Drive, CRM, Slack and more.',
      },
      {
        date: 'July 18, 2026',
        dateShort: 'Jul 18',
        version: 'v1.6',
        tag: 'New',
        h: 'Spreadsheet actions',
        p: 'The agent can now read and edit spreadsheets cell-by-cell, with a live activity log.',
      },
      {
        date: 'July 9, 2026',
        dateShort: 'Jul 9',
        version: 'v1.5',
        tag: 'Fixed',
        h: 'Faster session streaming',
        p: 'Reduced latency on the live stream and fixed occasional reconnect drops on long sessions.',
      },
    ],
  },
]

export const DOC_SECTIONS: DocSection[] = ['Getting Started', 'Working with agents', 'Reference']

export function docHref(id: string): string {
  if (id === 'changelog') return '/changelog'
  if (id === 'docs') return '/docs'
  return `/docs/${id}`
}

export function findDoc(id: string): Doc | undefined {
  return DOCS.find((d) => d.id === id)
}

const TAG_STYLE: Record<Release['tag'], { color: string; bg: string }> = {
  New: { color: 'var(--green)', bg: '#26c1651f' },
  Improved: { color: 'var(--accent)', bg: 'var(--accent-soft)' },
  Fixed: { color: 'var(--amber)', bg: '#e0a13a1f' },
}

export function tagStyle(tag: Release['tag']) {
  return TAG_STYLE[tag]
}
