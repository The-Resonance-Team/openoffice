// Self-contained share viewer: no build step, no external assets. Fetches the
// session's transcript + live updates from <this page>/stream over SSE and
// renders message events. Never offers accept/undo/revert — those routes
// require daemon Basic auth, not a share token.
export const shareViewerPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shared session</title>
<style>
  body { background: #0d1117; color: #e6edf3; font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; }
  header { padding: 12px 20px; border-bottom: 1px solid #21262d; color: #8b949e; }
  #transcript { max-width: 860px; margin: 0 auto; padding: 20px; }
  .msg { margin: 0 0 16px; }
  .msg .role { color: #58a6ff; font-weight: 600; margin-bottom: 2px; }
  .msg.user .role { color: #f0883e; }
  .msg .content { white-space: pre-wrap; word-break: break-word; }
  .ask { color: #d29922; border-left: 3px solid #d29922; padding-left: 10px; margin: 0 0 16px; }
</style>
</head>
<body>
<header>Read-only view — this session is shared. You can watch; you cannot edit.</header>
<div id="transcript"></div>
<script>
  const transcript = document.getElementById("transcript");
  function message(role, content) {
    const m = document.createElement("div");
    m.className = "msg " + role;
    const r = document.createElement("div");
    r.className = "role";
    r.textContent = role === "user" ? "You" : "Assistant";
    const b = document.createElement("div");
    b.className = "content";
    b.textContent = content;
    m.append(r, b);
    transcript.appendChild(m);
  }
  function ask(question) {
    const p = document.createElement("p");
    p.className = "ask";
    p.textContent = "Question: " + question;
    transcript.appendChild(p);
  }
  const es = new EventSource(location.pathname + "/stream");
  const status = document.createElement("p");
  status.className = "ask";
  transcript.appendChild(status);
  es.onmessage = (ev) => {
    status.textContent = "";
    const data = JSON.parse(ev.data);
    if (data.type === "message") message(data.role, data.content);
    else if (data.type === "ask") ask(data.question);
  };
  // EventSource reconnects on its own; don't close on transient errors. A
  // revoked share makes every reconnect 410 — the view goes stale but never
  // pretends to be live.
  es.onerror = () => {
    status.textContent = "Disconnected — retrying…";
  };
</script>
</body>
</html>`;
