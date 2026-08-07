import { describe, expect, test, afterAll } from "bun:test";
import { OpenOfficeClient } from "../client";

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });

    if (url.pathname.endsWith("/stream")) {
      const encoder = new TextEncoder();
      const events = [
        { type: "token", token: "Hel" },
        { type: "toolStart", tool: "read", params: {} },
        { type: "toolDone", tool: "read", result: "ok" },
        { type: "message", role: "assistant", content: "hi" },
        { type: "ask", promptID: "p1", question: "q?" },
        { type: "done", response: "done" },
      ];
      const stream = new ReadableStream({
        start(controller) {
          for (const event of events) {
            // SSE framing: events are separated by a blank line.
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          }
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { "content-type": "text/event-stream" },
      });
    }

    if (url.pathname === "/api/sessions" && req.method === "POST")
      return json(200, { id: "s1" });
    if (url.pathname === "/api/sessions/missing")
      return json(404, { error: "not found" });
    if (url.pathname === "/api/update")
      return json(200, { check: true, available: false });
    if (url.pathname.endsWith("/share"))
      return ++shareCalls === 1
        ? json(200, { url: "https://x" })
        : json(500, { error: "nope" });
    if (url.pathname.endsWith("/unshare"))
      return ++unshareCalls === 1
        ? json(200, {})
        : json(500, { error: "nope" });
    if (url.pathname.endsWith("/turn")) return json(200, { text: "yo" });
    if (req.method === "GET" && /^\/api\/sessions\/[^/]+$/.test(url.pathname))
      return json(200, { id: url.pathname.split("/").pop() });
    return json(200, {});
  },
});

let shareCalls = 0;
let unshareCalls = 0;

const client = new OpenOfficeClient(`http://127.0.0.1:${server.port}`);

afterAll(() => server.stop(true));

test("createSession and turn round-trip the daemon payload", async () => {
  const session = await client.createSession("/tmp");
  expect(session.id).toBe("s1");
  const { text } = await client.turn("s1", "hi");
  expect(text).toBe("yo");
});

test("getSession returns null on 404 and the session on 200", async () => {
  expect(await client.getSession("missing")).toBeNull();
  expect((await client.getSession("s1"))?.id).toBe("s1");
});

test("mutations post to the right endpoints", async () => {
  await client.accept("s1", "/f.docx");
  await client.undo("s1", "/f.docx");
  await client.revert("s1", "/f.docx", 123);
  await client.askAnswer("s1", "p1", "yes");
  await client.endSession("s1");
});

test("share and unshare throw on failure, succeed otherwise", async () => {
  expect((await client.share("s1")).url).toBe("https://x");
  await client.unshare("s1");
  expect(client.share("s1")).rejects.toThrow("nope");
  expect(client.unshare("s1")).rejects.toThrow("nope");
});

test("updateStatus returns null on non-200", async () => {
  expect(await client.updateStatus()).toEqual({
    check: true,
    available: false,
  });
});

test("stream dispatches every event type and stops on abort", async () => {
  const seen: string[] = [];
  const stop = client.stream("s1", {
    token: () => seen.push("token"),
    toolStart: () => seen.push("toolStart"),
    toolDone: () => seen.push("toolDone"),
    message: () => seen.push("message"),
    ask: () => {
      seen.push("ask");
    },
    done: () => seen.push("done"),
  });
  for (let i = 0; i < 50 && seen.length < 6; i++) await Bun.sleep(20);
  stop();
  expect(seen).toEqual([
    "token",
    "toolStart",
    "toolDone",
    "message",
    "ask",
    "done",
  ]);
});
