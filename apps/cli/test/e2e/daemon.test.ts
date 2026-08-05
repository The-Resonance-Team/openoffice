import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { OpenOfficeClient } from "../../src/server/client";
import {
  startFakeLLM,
  fakeConfig,
  tempDir,
  officecliAvailable,
  docContains,
} from "./helpers";

const skip = !officecliAvailable();

describe("daemon E2E (real process over HTTP/SSE)", () => {
  test.skipIf(skip)(
    "spawn → turn with tool calls → accept → update status → shutdown",
    async () => {
      const dataDir = tempDir("ooo-daemon-data-");
      const projectDir = tempDir("ooo-daemon-project-");
      const file = join(projectDir, "report.docx");

      const fake = await startFakeLLM((call) => {
        const calls: any[] = [
          {
            kind: "tool-call",
            name: "officecli",
            args: JSON.stringify({ command: "create", file }),
          },
          {
            kind: "tool-call",
            name: "officecli",
            args: JSON.stringify({
              command: "add",
              file,
              parent: "/body",
              type: "paragraph",
              props: { text: "Hello Daemon" },
            }),
          },
          { kind: "text", content: "Created." },
        ];
        return calls[call.index] ?? { kind: "text", content: "Done." };
      });

      // Project config: fake OpenAI endpoint + updates disabled (offline-safe).
      const cfg = fakeConfig(`http://127.0.0.1:${fake.port}/v1`);
      writeFileSync(
        join(projectDir, "openoffice.json"),
        JSON.stringify({ ...cfg, update: { check: false } })
      );

      const repoRoot = join(import.meta.dir, "..", "..");
      const daemon = spawn(
        process.execPath,
        [join(repoRoot, "src/index.ts"), "serve"],
        {
          cwd: projectDir,
          env: { ...process.env, XDG_DATA_HOME: dataDir },
          stdio: ["ignore", "pipe", "pipe"],
        }
      );
      let daemonLog = "";
      daemon.stdout!.on("data", (d) => (daemonLog += d));
      daemon.stderr!.on("data", (d) => (daemonLog += d));

      try {
        // Auto-spawn detection: the daemon writes its PID/port file
        let info: { pid: number; port: number } | null = null;
        const infoPath = join(dataDir, "openoffice", "daemon.json");
        for (let i = 0; i < 200 && !info; i++) {
          if (existsSync(infoPath)) {
            info = JSON.parse(readFileSync(infoPath, "utf-8"));
          }
          await Bun.sleep(50);
        }
        expect(info).not.toBeNull();
        expect(info!.pid).toBe(daemon.pid!);

        const client = new OpenOfficeClient(`http://127.0.0.1:${info!.port}`);
        const session = await client.createSession(projectDir);

        // SSE token streaming end-to-end
        let tokens = "";
        let doneText = "";
        const toolCalls: string[] = [];
        const abort = client.stream(session.id, {
          token: (t) => (tokens += t),
          done: (r) => (doneText = r),
          toolStart: (tool) => toolCalls.push(tool),
        });

        await client.turn(
          session.id,
          "Create report.docx with paragraph 'Hello Daemon'"
        );
        await Bun.sleep(500); // let the stream flush

        abort();
        expect(tokens).toContain("Created.");
        expect(doneText).toBe("Created.");
        expect(toolCalls).toContain("officecli");

        // Real draft lifecycle over the wire
        await client.accept(session.id, file);
        expect(existsSync(file)).toBe(true);
        expect(docContains(file, "Hello Daemon")).toBe(true);

        // update.check:false → daemon reports the gate, no network
        const upd = await client.updateStatus();
        expect(upd).toEqual({ check: false, available: false });

        await client.endSession(session.id);
      } finally {
        daemon.kill("SIGTERM");
        await new Promise<void>((resolve) => {
          daemon.on("exit", () => resolve());
          setTimeout(resolve, 2000);
        });
        fake.stop();
      }
      expect(daemonLog).not.toContain("Error");
    }
  );
});
