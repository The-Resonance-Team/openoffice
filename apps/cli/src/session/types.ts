import type { WithParts } from "./parts";

export interface Session {
  id: string;
  agent: string;
  model: string;
  title: string;
  cwd: string;
  messages: WithParts[];
  createdAt: number;
  updatedAt: number;
  endedAt?: number;
}
