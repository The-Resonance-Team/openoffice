// Shared data model — pure types, zero dependencies.
// Consumed by core (engine), server (daemon wiring), protocol (wire contract),
// and the web/cloud clients. Ported from opencode's SessionV1 part model
// (`@opencode-ai/core/v1/session`) and `util/token`.

export type Role = "user" | "assistant" | "tool" | "system";

export interface ModelRef {
  providerID: string;
  modelID: string;
  variant?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface MessageInfo {
  id: string;
  role: Role;
  parentID?: string;
  agent?: string;
  model?: ModelRef;
  summary?: boolean;
  finish?: "done" | "error";
  error?: { message: string };
  time: { created: number };
  tokens?: TokenUsage;
}

export interface PartBase {
  id?: string;
  type: string;
  messageID?: string;
  time?: { start?: number; end?: number };
}

export interface TextPart extends PartBase {
  type: "text";
  text: string;
  synthetic?: boolean;
  metadata?: Record<string, unknown>;
}

export type ToolState =
  | {
      status: "pending";
      input: string | Record<string, unknown>;
      time?: { compacted?: number };
    }
  | {
      status: "completed";
      input: string | Record<string, unknown>;
      output: string;
      time?: { compacted?: number };
    }
  | {
      status: "error";
      input: string | Record<string, unknown>;
      error: { message: string };
      time?: { compacted?: number };
    };

export interface ToolPart extends PartBase {
  type: "tool";
  tool: string;
  callID?: string;
  state: ToolState;
}

export interface CompactionPart extends PartBase {
  type: "compaction";
  auto: boolean;
  overflow?: boolean;
  tail_start_id?: string;
}

export type Part = TextPart | ToolPart | CompactionPart;

export interface WithParts {
  info: MessageInfo;
  parts: Part[];
}

export interface Session {
  id: string;
  agent: string;
  model: string;
  title: string;
  cwd: string;
  messages: WithParts[];
  createdAt: number;
  updatedAt: number;
}
