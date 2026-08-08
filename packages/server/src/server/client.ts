import { getDataDir, readDaemonInfo, isAlive, spawnDaemon } from "./daemon";
import { loadAuthConfig, authHeaders } from "./auth";
import type { Session } from "@openoffice/schema";
import type {
  DaemonClient,
  StreamHandlers,
  UpdateStatus,
  McpServerStatusInfo,
} from "@openoffice/protocol";

export type { StreamHandlers, UpdateStatus } from "@openoffice/protocol";

export async function connectClient(): Promise<OpenOfficeClient> {
  const dataDir = getDataDir();
  let info = readDaemonInfo(dataDir);
  if (!info || !isAlive(info.pid)) {
    info = await spawnDaemon(dataDir);
  }
  const auth = loadAuthConfig();
  return new OpenOfficeClient(`http://127.0.0.1:${info.port}`, auth);
}

export class OpenOfficeClient implements DaemonClient {
  private auth: ReturnType<typeof loadAuthConfig>;

  constructor(
    private baseUrl: string,
    auth?: ReturnType<typeof loadAuthConfig>
  ) {
    this.auth = auth ?? loadAuthConfig();
  }

  private async request<T>(
    path: string,
    init?: RequestInit
  ): Promise<{ status: number; data: T }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...authHeaders(this.auth),
        ...((init?.headers as Record<string, string>) ?? {}),
      },
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

  async share(id: string): Promise<{ url: string }> {
    const { status, data } = await this.request<{
      url?: string;
      error?: string;
    }>(`/api/sessions/${id}/share`, { method: "POST" });
    if (status !== 200 || !data.url) {
      throw new Error(data.error ?? `share failed (${status})`);
    }
    return { url: data.url };
  }

  async unshare(id: string): Promise<void> {
    const { status, data } = await this.request<{ error?: string }>(
      `/api/sessions/${id}/unshare`,
      { method: "POST" }
    );
    if (status !== 200) {
      throw new Error(data.error ?? `unshare failed (${status})`);
    }
  }

  async updateStatus(): Promise<{
    check: boolean;
    available: boolean;
    version?: string;
  } | null> {
    const { status, data } = await this.request<{
      check: boolean;
      available: boolean;
      version?: string;
    }>(`/api/update`);
    return status === 200 ? data : null;
  }

  async mcpStatus(): Promise<Record<string, McpServerStatusInfo>> {
    const { status, data } =
      await this.request<Record<string, McpServerStatusInfo>>(`/api/mcp`);
    return status === 200 ? data : {};
  }

  async mcpEnable(name: string): Promise<McpServerStatusInfo> {
    const { data } = await this.request<
      McpServerStatusInfo & { error?: string }
    >(`/api/mcp/${name}/enable`, { method: "POST" });
    return data;
  }

  async mcpDisable(name: string): Promise<McpServerStatusInfo> {
    const { data } = await this.request<
      McpServerStatusInfo & { error?: string }
    >(`/api/mcp/${name}/disable`, { method: "POST" });
    return data;
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
            headers: authHeaders(this.auth),
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
