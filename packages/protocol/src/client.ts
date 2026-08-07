// The daemon HTTP client contract — the shape both sides compile against.
// The fetch implementation lives in packages/server (it also owns daemon
// spawn/auth plumbing); clients (CLI, web) depend only on this surface.

import type { Session } from "@openoffice/schema";

export interface StreamHandlers {
  token?: (token: string) => void;
  done?: (response: string) => void;
  toolStart?: (tool: string, params: unknown) => void;
  toolDone?: (tool: string, result: unknown) => void;
  message?: (role: string, content: string) => void;
  ask?: (promptID: string, question: string) => Promise<void> | void;
}

export interface UpdateStatus {
  check: boolean;
  available: boolean;
  version?: string;
  current?: string;
}

export interface DaemonClient {
  createSession(cwd: string): Promise<Session>;
  getSession(id: string): Promise<Session | null>;
  turn(id: string, message: string): Promise<{ text: string }>;
  accept(id: string, filePath: string): Promise<void>;
  undo(id: string, filePath: string): Promise<void>;
  revert(id: string, filePath: string, timestamp: number): Promise<void>;
  askAnswer(id: string, promptID: string, answer: string): Promise<void>;
  endSession(id: string): Promise<void>;
  updateStatus(): Promise<UpdateStatus | null>;
  /** Subscribe to the session's event stream. Returns an abort function. */
  stream(id: string, handlers: StreamHandlers): () => void;
}
