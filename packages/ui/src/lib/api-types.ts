export interface SessionDto {
  id: string;
  agent: string;
  model: string;
  title: string;
  cwd: string;
  messages: unknown[];
  createdAt: number;
  updatedAt: number;
}

export interface TurnResponse {
  text: string;
}

export interface UpdateStatus {
  check: boolean;
  available: boolean;
  version?: string;
  error?: string;
}

export type StreamEvent =
  | { type: "token"; token: string }
  | { type: "done"; response: unknown }
  | { type: "toolStart"; tool: string; params: unknown }
  | { type: "toolDone"; tool: string; result: unknown }
  | { type: "message"; role: string; content: unknown }
  | { type: "ask"; promptID: string; question: string };

export interface StoredAuth {
  username: string;
  password: string;
}
