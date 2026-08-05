// Static prototype data ported from the design source (OpenOffice.dc.html / app.js).
// TODO: no endpoint yet for any of this — the daemon has no APIs for nav, tasks,
// working-folder listing, connectors, skills, model/provider catalogs, or viewer
// content. Chat/session (lib/use-session.ts) is also mocked for standalone UI
// use; lib/api.ts's real createSession/postTurn/streamSession are unused for
// now but kept for when the daemon is wired back in. accept/undo/update are
// mocked alongside chat/session (see components/Viewer.tsx); getUpdateStatus
// is the one real daemon call still wired (components/LeftRail.tsx).

export interface NavItem {
  icon: IconName;
  label: string;
}

export const navPrimary: NavItem[] = [
  { icon: "plus", label: "New" },
  { icon: "grid", label: "Projects" },
  { icon: "shapes", label: "Artifacts" },
  { icon: "calClock", label: "Scheduled" },
  { icon: "sliders", label: "Customize" },
];

export const pinned: NavItem[] = [
  { icon: "msg", label: "Annual report design" },
  { icon: "folder", label: "Marketing plan 2026" },
  { icon: "msg", label: "Investor update deck" },
  { icon: "msg", label: "Pricing model v3" },
];

export const recents: (NavItem & { active?: boolean })[] = [
  { icon: "msg", label: "Q3 board report & model", active: true },
  { icon: "msg", label: "Schedule a recurring task" },
  { icon: "msg", label: "Expense policy rewrite" },
  { icon: "msg", label: "Sales forecast workbook" },
  { icon: "msg", label: "Document review and conversion" },
  { icon: "msg", label: "Onboarding one-pager" },
  { icon: "msg", label: "NDA template cleanup" },
  { icon: "msg", label: "Product roadmap slides" },
];

export const tasks: { text: string; s: "done" | "active" | "todo" }[] = [
  { text: "Pull Q3 actuals from the finance close", s: "done" },
  { text: "Reconcile revenue against source ledger", s: "done" },
  { text: "Break out one-off items", s: "done" },
  { text: "Draft executive summary (.docx)", s: "done" },
  { text: "Build the revenue bridge (.xlsx)", s: "done" },
  { text: "Model Q4 forecast scenarios (.xlsx)", s: "done" },
  { text: "Write variance commentary", s: "done" },
  { text: "Fetch market benchmark from Drive", s: "done" },
  { text: "Chart revenue & margin trends", s: "done" },
  { text: "Assemble the board deck (.pptx)", s: "done" },
  { text: "Write risk & outlook section", s: "done" },
  { text: "Verify figures & citations", s: "done" },
  { text: "Format the appendix tables", s: "active" },
  { text: "Compile the PDF export", s: "todo" },
  { text: "Final proofread pass", s: "todo" },
];

export const connectors: { name: string; icon?: IconName; drive?: boolean }[] =
  [
    { name: "Web Search", icon: "globe" },
    { name: "Google Drive", drive: true },
  ];
export const skills = [
  { name: "docx", icon: "fileText" as IconName },
  { name: "xlsx", icon: "sheet" as IconName },
  { name: "pptx", icon: "presentation" as IconName },
];

export interface Model {
  id: string;
  name: string;
  tier: string;
  desc: string;
}
export const models: Model[] = [
  {
    id: "pro-max",
    name: "Office Pro",
    tier: "Max",
    desc: "Highest quality — deep analysis & long documents",
  },
  {
    id: "pro",
    name: "Office Pro",
    tier: "",
    desc: "Balanced speed and quality for everyday work",
  },
  {
    id: "air",
    name: "Office Air",
    tier: "",
    desc: "Fastest — quick edits and short replies",
  },
  {
    id: "reason",
    name: "Office Reason",
    tier: "",
    desc: "Extended reasoning for hard, multi-step problems",
  },
];

export interface Provider {
  id: string;
  name: string;
  desc: string;
  models: number;
  letter: string;
  color: string;
}
export const providers: Provider[] = [
  {
    id: "openoffice",
    name: "OpenOffice",
    desc: "Built-in office models",
    models: 4,
    letter: "O",
    color: "linear-gradient(135deg,#ff7a5e,#c21f07)",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    desc: "Claude family",
    models: 6,
    letter: "A",
    color: "#d97757",
  },
  {
    id: "openai",
    name: "OpenAI",
    desc: "GPT family",
    models: 8,
    letter: "O",
    color: "#0f9d76",
  },
  {
    id: "google",
    name: "Google",
    desc: "Gemini family",
    models: 5,
    letter: "G",
    color: "#4285f4",
  },
  {
    id: "groq",
    name: "Groq",
    desc: "Ultra-fast inference",
    models: 4,
    letter: "G",
    color: "#f55036",
  },
  {
    id: "local",
    name: "Local (Ollama)",
    desc: "Run models on your machine",
    models: 12,
    letter: "L",
    color: "#6b6b6b",
  },
];

export interface FileEntry {
  id: string;
  name: string;
  ext: string;
  typeLabel: string;
  icon: IconName;
  draft: boolean;
  local: boolean;
  tab: string;
  connector?: string;
}
export const files: Record<string, FileEntry> = {
  docx: {
    id: "docx",
    name: "q3-board-report.docx",
    ext: "DOCX",
    typeLabel: "Document · DOCX",
    icon: "fileText",
    draft: true,
    local: true,
    tab: "Report",
  },
  xlsx: {
    id: "xlsx",
    name: "financial-model-q3.xlsx",
    ext: "XLSX",
    typeLabel: "Spreadsheet · XLSX",
    icon: "sheet",
    draft: true,
    local: true,
    tab: "Model",
  },
  pptx: {
    id: "pptx",
    name: "board-deck-q3.pptx",
    ext: "PPTX",
    typeLabel: "Presentation · PPTX",
    icon: "presentation",
    draft: true,
    local: true,
    tab: "Deck",
  },
  pdf: {
    id: "pdf",
    name: "market-benchmark-2026.pdf",
    ext: "PDF",
    typeLabel: "Reference · PDF",
    icon: "filePdf",
    draft: false,
    local: false,
    connector: "Google Drive",
    tab: "Benchmark",
  },
};
export const turnOrder = ["docx", "xlsx", "pptx", "pdf"];

export const workingRaw: {
  name: string;
  icon: IconName;
  open: string | null;
  badge?: "draft" | "drive";
  dim?: boolean;
}[] = [
  {
    name: "q3-board-report.docx",
    icon: "fileText",
    open: "docx",
    badge: "draft",
  },
  {
    name: "financial-model-q3.xlsx",
    icon: "sheet",
    open: "xlsx",
    badge: "draft",
  },
  {
    name: "board-deck-q3.pptx",
    icon: "presentation",
    open: "pptx",
    badge: "draft",
  },
  {
    name: "market-benchmark-2026.pdf",
    icon: "filePdf",
    open: "pdf",
    badge: "drive",
  },
  { name: "revenue-actuals.json", icon: "json", open: "fb" },
  { name: "forecast-scenarios.json", icon: "json", open: "fb" },
  { name: "build_charts.py", icon: "code", open: "fb" },
  { name: "revenue-trend.png", icon: "image", open: "fb" },
  { name: "margin-trend.png", icon: "image", open: "fb" },
  { name: "requirements.txt", icon: "file", open: "fb" },
  { name: "~$q3-board-report.docx", icon: "lock", open: null, dim: true },
  { name: ".DS_Store", icon: "file", open: null, dim: true },
];

export const pageCounts: Record<string, number> = { docx: 2, pdf: 1 };

export interface SheetData {
  title: string;
  headers: string[];
  hi: [number, number];
  rows: string[][];
}
export const excel: Record<string, SheetData> = {
  summary: {
    title: "Summary — Q3 FY26 (US$ 000s)",
    headers: ["Metric", "Q1", "Q2", "Q3", "QoQ %", "FY Plan"],
    hi: [9, 3],
    rows: [
      ["Total revenue", "19,240", "21,010", "24,830", "+18.2%", "92,500"],
      ["  Subscription", "15,900", "17,480", "20,910", "+19.6%", "78,000"],
      ["  Services", "3,340", "3,530", "3,920", "+11.0%", "14,500"],
      ["COGS", "(5,120)", "(5,470)", "(6,180)", "+13.0%", "(23,900)"],
      ["Gross profit", "14,120", "15,540", "18,650", "+20.0%", "68,600"],
      ["Gross margin", "73.4%", "74.0%", "75.1%", "+1.1pp", "74.2%"],
      [
        "Sales & marketing",
        "(6,900)",
        "(7,240)",
        "(8,050)",
        "+11.2%",
        "(30,800)",
      ],
      ["R&D", "(4,100)", "(4,360)", "(4,720)", "+8.3%", "(18,600)"],
      ["G&A", "(2,050)", "(2,180)", "(2,330)", "+6.9%", "(9,200)"],
      ["EBITDA", "1,070", "1,760", "3,550", "+101.7%", "10,000"],
      ["EBITDA margin", "5.6%", "8.4%", "14.3%", "+5.9pp", "10.8%"],
    ],
  },
  revenue: {
    title: "Revenue detail — Q3 FY26 (US$ 000s)",
    headers: ["Segment", "Q2", "Q3", "QoQ %", "Mix"],
    hi: [4, 2],
    rows: [
      ["Enterprise", "9,120", "11,240", "+23.2%", "45.3%"],
      ["Mid-market", "5,410", "6,180", "+14.2%", "24.9%"],
      ["SMB", "2,950", "3,490", "+18.3%", "14.1%"],
      ["Services", "3,530", "3,920", "+11.0%", "15.8%"],
      ["Total revenue", "21,010", "24,830", "+18.2%", "100.0%"],
    ],
  },
  costs: {
    title: "Operating costs — Q3 FY26 (US$ 000s)",
    headers: ["Category", "Q2", "Q3", "QoQ %", "% rev"],
    hi: [4, 2],
    rows: [
      ["Cost of revenue", "5,470", "6,180", "+13.0%", "24.9%"],
      ["Sales & marketing", "7,240", "8,050", "+11.2%", "32.4%"],
      ["R&D", "4,360", "4,720", "+8.3%", "19.0%"],
      ["G&A", "2,180", "2,330", "+6.9%", "9.4%"],
      ["Total opex", "13,780", "15,100", "+9.6%", "60.8%"],
    ],
  },
  forecast: {
    title: "Q4 FY26 forecast scenarios (US$ 000s)",
    headers: ["Scenario", "Revenue", "EBITDA", "Margin", "Prob."],
    hi: [3, 1],
    rows: [
      ["Conservative", "25,900", "3,100", "12.0%", "25%"],
      ["Base", "27,400", "4,050", "14.8%", "55%"],
      ["Upside", "29,600", "5,200", "17.6%", "20%"],
      ["Weighted", "27,530", "4,120", "15.0%", "—"],
    ],
  },
};
export const sheetOrder = ["summary", "revenue", "costs", "forecast"];
export const sheetNames: Record<string, string> = {
  summary: "Summary",
  revenue: "Revenue",
  costs: "Costs",
  forecast: "Forecast",
};

export type Slide =
  | { k: "title"; t: string; s?: string }
  | { k: "kpi"; t: string; kpis: [string, string, string][] }
  | { k: "chart"; t: string; bars: [string, number][] }
  | { k: "agenda"; t: string; items: string[] }
  | { k: "quote"; t: string; s?: string }
  | { k: "closing"; t: string; s?: string };

export const slides: Slide[] = [
  {
    k: "title",
    t: "Q3 FY2026 Board Review",
    s: "Meridian Labs · October 2026",
  },
  {
    k: "kpi",
    t: "The quarter at a glance",
    kpis: [
      ["$24.8M", "Revenue", "+18% QoQ"],
      ["75.1%", "Gross margin", "+1.1pp"],
      ["$3.55M", "EBITDA", "+102% QoQ"],
    ],
  },
  {
    k: "chart",
    t: "Revenue trend",
    bars: [
      ["Q1", 52],
      ["Q2", 58],
      ["Q3", 72],
      ["Q4E", 86],
    ],
  },
  {
    k: "agenda",
    t: "Agenda",
    items: [
      "Financial results",
      "Product & go-to-market",
      "Hiring plan",
      "Q4 outlook",
      "Board asks",
    ],
  },
  {
    k: "chart",
    t: "Net revenue retention",
    bars: [
      ["Q1", 108],
      ["Q2", 112],
      ["Q3", 119],
      ["Q4E", 121],
    ],
  },
  {
    k: "quote",
    t: "“We crossed breakeven a full quarter ahead of plan.”",
    s: "— CFO commentary, Q3 close",
  },
  {
    k: "kpi",
    t: "Efficiency",
    kpis: [
      ["0.8", "Magic number", "healthy"],
      ["14mo", "CAC payback", "improving"],
      ["122%", "Net retention", "above target"],
    ],
  },
  { k: "closing", t: "Thank you", s: "Questions & discussion" },
];

export type IconName =
  | "panelRight"
  | "panelLeft"
  | "search"
  | "home"
  | "codeXml"
  | "plus"
  | "grid"
  | "shapes"
  | "calClock"
  | "sliders"
  | "palette"
  | "flask"
  | "folderPlus"
  | "download"
  | "msg"
  | "folder"
  | "folderOpen"
  | "fileText"
  | "sheet"
  | "presentation"
  | "filePdf"
  | "file"
  | "json"
  | "code"
  | "lock"
  | "image"
  | "globe"
  | "chevronDown"
  | "chevronRight"
  | "maximize"
  | "minimize"
  | "x"
  | "mic"
  | "arrowUp"
  | "modeAuto"
  | "copy"
  | "volume"
  | "thumbUp"
  | "thumbDown"
  | "more"
  | "sparkles"
  | "loader"
  | "check";
