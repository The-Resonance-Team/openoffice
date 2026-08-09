export { setTransport, getTransport, type Transport } from "./lib/transport";
export type {
  SessionDto,
  TurnResponse,
  UpdateStatus,
  StreamEvent,
  StoredAuth,
} from "./lib/api-types";
export { loadAuth, saveAuth } from "./lib/api-helpers";
export {
  createSession,
  getSession,
  listSessions,
  deleteSession,
  renameSession,
  postTurn,
  acceptFile,
  undoFile,
  getUpdateStatus,
  streamSession,
} from "./lib/api-client";
export { Icon, IconFill, GDriveIcon, CheckSm } from "./lib/icons";
export type { IconName } from "./lib/mock";
export {
  navPrimary,
  pinned,
  recents,
  tasks,
  connectors,
  skills,
  models,
  providers,
  files,
  turnOrder,
  workingRaw,
  pageCounts,
  excel,
  sheetOrder,
  sheetNames,
  slides,
} from "./lib/mock";
export type {
  NavItem,
  Model,
  Provider,
  FileEntry,
  SheetData,
  Slide,
} from "./lib/mock";
export { mockGreeting, pickMockReply, mockSessionId } from "./lib/mock-chat";
export { useUiStore, type RightRegion } from "./lib/store";
export { QueryProvider } from "./lib/query-provider";
export { useSession, type ChatPart, type ChatMessage } from "./lib/use-session";
export { Shell } from "./components/Shell";
export { ChatPanel } from "./components/ChatPanel";
export { Composer } from "./components/Composer";
export { LeftRail } from "./components/LeftRail";
export { Sidebar } from "./components/Sidebar";
export { Viewer } from "./components/Viewer";
export { Markdown } from "./components/Markdown";
export { ToolCallCard } from "./components/ToolCall";
export { ResizeHandle } from "./components/ResizeHandle";
export { ProviderDialog } from "./components/ProviderDialog";
export { LoginDialog } from "./components/LoginDialog";
export { DocxBody } from "./components/viewer/Docx";
export { XlsxBody } from "./components/viewer/Xlsx";
export { PptxBody } from "./components/viewer/Pptx";
export { PdfBody } from "./components/viewer/Pdf";
export { FallbackBody } from "./components/viewer/Fallback";
