# 0011 — Compaction is prune + single-summary, not opencode's turn-tail model

Issue #17 builds session compaction. opencode's reference implementation (`session/compaction.ts`, 562 lines) does turn-boundary splitting, per-turn token budgeting, tail-truncation-with-replay-on-overflow, and a dedicated "compaction agent" — all inside its Effect-TS service layer. openoffice reimplements only the two ideas that carry their weight at this project's scale: pruning old tool outputs (cheap, no LLM call) and summarizing everything before a fixed recent tail (one LLM call) when pruning alone isn't enough.

The rest of opencode's machinery solves problems that come from being a general coding agent with long sessions and large file-diff tool outputs across many turns. openoffice's sessions are document-editing chats — smaller in practice, and the codebase deliberately doesn't use Effect-TS (`map.md` excludes it as over-engineered for v1). Copying the full system would mean building infrastructure for a problem openoffice doesn't have yet.

## Considered options

- **Port opencode's compaction service as-is**: rejected — Effect-TS is out of scope, and the turn/tail-splitting complexity assumes session sizes and tool-output volumes openoffice's document-chat use case doesn't produce.
- **No pruning, summarize-only**: rejected — officecli's `get`/`list`/`search` can return large JSON document dumps that are cheap to drop without an LLM call; skipping prune wastes an easy, free win before ever needing to spend a summarization call.
