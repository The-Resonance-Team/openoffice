import { getDataDir, readDaemonInfo, isAlive, spawnDaemon } from "./daemon";
import type { Session } from "../session";

export interface StreamHandlers {
  token?: (token: string) => void;
  done?: (response: string) => void;
  toolStart?: (tool: string, params: unknown) => void;
  toolDone?: (tool: string, result: unknown) => void;
  message?: (role: string, content: string) => void;
  ask?: (promptID: string, question: string) => Promise<void> | void;
}

export async function connectClient(): Promise<OpenOfficeClient> {
  const dataDir = getDataDir();
  let info = readDaemonInfo(dataDir);
  if (!info || !isAlive(info.pid)) {
    info = await spawnDaemon(dataDir);
  }
  return new OpenOfficeClient(`http://127.0.0.1:${info.port}`);
}

export class OpenOfficeClient {
  constructor(private baseUrl: string) {}

  private async request<T>(
    path: string,
    init?: RequestInit
  ): Promise<{ status: number; data: T }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
    return {
      status: res.status,
      data: (await res.json().catch(() => null)) as T,
    };
  }

  async createSession(cwd: string): Promise<Session> {
    const { data } = await this.request<Session>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ cwd }),
    });
    return data;
  }

  async getSession(id: string): Promise<Session | null> {
    const { status, data } = await this.request<Session>(`/api/sessions/${id}`);
    return status === 200 ? data : null;
  }

  async turn(id: string, message: string): Promise<{ text: string }> {
    const { data } = await this.request<{ text: string }>(
      `/api/sessions/${id}/turn`,
      { method: "POST", body: JSON.stringify({ message }) }
    );
    return data;
  }

  async accept(id: string, filePath: string): Promise<void> {
    await this.request(`/api/sessions/${id}/accept`, {
      method: "POST",
      body: JSON.stringify({ filePath }),
    });
  }

  async undo(id: string, filePath: string): Promise<void> {
    await this.request(`/api/sessions/${id}/undo`, {
      method: "POST",
      body: JSON.stringify({ filePath }),
    });
  }

  async revert(id: string, filePath: string, timestamp: number): Promise<void> {
    await this.request(`/api/sessions/${id}/revert`, {
      method: "POST",
      body: JSON.stringify({ filePath, timestamp }),
    });
  }

  async askAnswer(id: string, promptID: string, answer: string): Promise<void> {
    await this.request(`/api/sessions/${id}/ask-answer`, {
      method: "POST",
      body: JSON.stringify({ promptID, answer }),
    });
  }

  async endSession(id: string): Promise<void> {
    await this.request(`/api/sessions/${id}/end`, { method: "POST" });
  }

  /**
   * Subscribe to the session's event stream. Reconnects on drop; handlers
   * run in event order. Returns an abort function.
   */
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
          const res = await fetch(`${this.baseUrl}/api/sessions/${id}/stream`, {
            signal: controller.signal,
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
              let event: any;
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
                  await handlers.ask?.(event.promptID, event.question);
                  break;
              }
            }
          }
        } catch {
          // connection dropped; reconnect below unless aborted
        }
        await Bun.sleep(1000);
      }
    })();

    return abort;
  }
}
