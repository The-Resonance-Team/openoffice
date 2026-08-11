// Stub `opencode serve` for tests: speaks the same wire contract as the real
// server — prints the listening line, requires Basic auth (OPENCODE_SERVER_PASSWORD),
// implements the SDK endpoints the daemon uses, emits scripted SSE events.

const args = process.argv.slice(2);
const port = Number(args.find((a) => a.startsWith('--port='))?.split('=')[1] ?? 0);
const hostname = args.find((a) => a.startsWith('--hostname='))?.split('=')[1] ?? '127.0.0.1';
const expectedPassword = process.env.OPENCODE_SERVER_PASSWORD ?? '';

const authOk = (req: Request) => {
  const header = req.headers.get('authorization') ?? '';
  return header === 'Basic ' + Buffer.from(`opencode:${expectedPassword}`).toString('base64');
};

const session = (id: string) => ({
  id,
  projectID: 'proj_1',
  directory: '/tmp',
  title: 'stub session',
  version: '1.18.15',
  time: { created: 1000, updated: 1001 },
});

const message = (id: string, sessionID: string) => ({
  info: {
    id,
    sessionID,
    role: 'assistant',
    time: { created: 2000, completed: 2001 },
    parentID: 'msg_0',
    modelID: 'stub',
    providerID: 'stub',
    mode: 'default',
    path: { cwd: '/tmp', root: '/tmp' },
    cost: 0,
    tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
    finish: 'done',
  },
  parts: [{ id: 'part_1', sessionID, messageID: id, type: 'text', text: 'stub reply' }],
});

const server = Bun.serve({
  port,
  hostname,
  async fetch(req) {
    if (!authOk(req)) return new Response('unauthorized', { status: 401 });
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/session') {
      return Response.json(session('sess_1'));
    }
    if (req.method === 'POST' && url.pathname === '/session/sess_1/message') {
      return Response.json(message('msg_1', 'sess_1'));
    }
    if (req.method === 'GET' && url.pathname === '/event') {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const frames = [
            {
              type: 'session.next.text.delta',
              properties: { sessionID: 'sess_1', textID: 't1', delta: 'Hel' },
            },
            {
              type: 'session.next.text.delta',
              properties: { sessionID: 'sess_1', textID: 't1', delta: 'lo' },
            },
            {
              type: 'session.next.text.ended',
              properties: { sessionID: 'sess_1', textID: 't1', text: 'Hello' },
            },
          ];
          frames.forEach((f, i) => {
            controller.enqueue(
              new TextEncoder().encode(`event: message\ndata: ${JSON.stringify(f)}\n\n`),
            );
            if (i === frames.length - 1) controller.close();
          });
        },
      });
      return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
    }
    return new Response('not found', { status: 404 });
  },
});

console.log(`opencode server listening on http://${hostname}:${server.port}`);

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
