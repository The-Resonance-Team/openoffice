import { invoke } from "@tauri-apps/api/core";

export interface DaemonConfig {
  port: number;
  username: string;
  password: string | null;
}

export interface Session {
  id: string;
  agent: string;
  model: string;
  title: string;
  cwd: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  endedAt?: number;
}

export interface Message {
  id?: string;
  info: { role: "user" | "assistant"; time?: { created: number } };
  parts: { type: string; text?: string; tool?: string }[];
}

export type StreamEvent =
  | { type: "token"; token: string }
  | { type: "done"; response: string }
  | { type: "toolStart"; tool: string; params: unknown }
  | { type: "toolDone"; tool: string; result: unknown }
  | { type: "message"; role: string; content: string }
  | { type: "ask"; promptID: string; question: string };

export interface StreamHandlers {
  token?: (token: string) => void;
  done?: (response: string) => void;
  toolStart?: (tool: string, params: unknown) => void;
  toolDone?: (tool: string, result: unknown) => void;
  message?: (role: string, content: string) => void;
  ask?: (promptID: string, question: string) => void;
}

const textOf = (m: Message): string =>
  m.parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("");

export class DaemonClient {
  private constructor(
    private base: string,
    private auth: { username: string; password: string | null }
  ) {}

  static async connect(): Promise<DaemonClient> {
    const cfg = await invoke<DaemonConfig>("daemon_start");
    return new DaemonClient(`http://127.0.0.1:${cfg.port}`, {
      username: cfg.username,
      password: cfg.password,
    });
  }

  private headers(init?: HeadersInit): HeadersInit {
    const headers = new Headers(init);
    headers.set("content-type", "application/json");
    if (this.auth.password) {
      headers.set(
        "authorization",
        `Basic ${btoa(`${this.auth.username}:${this.auth.password}`)}`
      );
    }
    return headers;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: this.headers(init?.headers),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? `request failed (${res.status})`);
    }
    return (await res.json()) as T;
  }

  listSessions(): Promise<Session[]> {
    return this.request<Session[]>("/api/sessions");
  }

  createSession(cwd?: string): Promise<Session> {
    return this.request<Session>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(cwd ? { cwd } : {}),
    });
  }

  getSession(id: string): Promise<Session> {
    return this.request<Session>(`/api/sessions/${id}`);
  }

  turn(id: string, message: string): Promise<{ text: string }> {
    return this.request(`/api/sessions/${id}/turn`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  }

  accept(id: string, filePath: string): Promise<void> {
    return this.request(`/api/sessions/${id}/accept`, {
      method: "POST",
      body: JSON.stringify({ filePath }),
    });
  }

  undo(id: string, filePath: string): Promise<void> {
    return this.request(`/api/sessions/${id}/undo`, {
      method: "POST",
      body: JSON.stringify({ filePath }),
    });
  }

  askAnswer(id: string, promptID: string, answer: string): Promise<void> {
    return this.request(`/api/sessions/${id}/ask-answer`, {
      method: "POST",
      body: JSON.stringify({ promptID, answer }),
    });
  }

  endSession(id: string): Promise<void> {
    return this.request(`/api/sessions/${id}/end`, { method: "POST" });
  }

  /** SSE subscription, reconnecting. Mirrors src/server/client.ts. */
  stream(id: string, handlers: StreamHandlers): () => void {
    let aborted = false;
    let controller: AbortController | undefined;
    const abort = () => {
      aborted = true;
      controller?.abort();
    };

    void (async () => {
      while (!aborted) {
        controller = new AbortController();
        try {
          const res = await fetch(`${this.base}/api/sessions/${id}/stream`, {
            signal: controller.signal,
            headers: this.headers(),
          });
          if (!res.ok) throw new Error(`stream failed: ${res.status}`);
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buf.indexOf("\n\n")) >= 0) {
              const raw = buf.slice(0, idx);
              buf = buf.slice(idx + 2);
              const dataLine = raw
                .split("\n")
                .find((l) => l.startsWith("data: "));
              if (!dataLine) continue;
              let event: StreamEvent;
              try {
                event = JSON.parse(dataLine.slice(6));
              } catch {
                continue;
              }
              switch (event.type) {
                case "token":
                  handlers.token?.(event.token);
                  break;
                case "done":
                  handlers.done?.(event.response);
                  break;
                case "toolStart":
                  handlers.toolStart?.(event.tool, event.params);
                  break;
                case "toolDone":
                  handlers.toolDone?.(event.tool, event.result);
                  break;
                case "message":
                  handlers.message?.(event.role, event.content);
                  break;
                case "ask":
                  handlers.ask?.(event.promptID, event.question);
                  break;
              }
            }
          }
        } catch {
          // connection dropped; reconnect below unless aborted
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    })();

    return abort;
  }
}

export { textOf };
