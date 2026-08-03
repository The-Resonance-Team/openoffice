import type { ModelMessage } from "ai";

export interface Session {
  id: string;
  agent: string;
  model: string;
  title: string;
  cwd: string;
  messages: ModelMessage[];
  createdAt: number;
  updatedAt: number;
}
