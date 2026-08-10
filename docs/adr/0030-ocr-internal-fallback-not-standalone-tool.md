# 0030 — OCR is an internal fallback in `read`, not a standalone tool

Issue #23 originally proposed a standalone `oocr` tool — same subprocess-wrapper shape as `officecli`/`soffice`, with its own `ToolDefinition` that the agent would call directly. During implementation, we chose instead to make scanned-document reading an internal fallback within the `read` tool: `readPdf` returns `PDF_NO_TEXT_LAYER` → `read` auto-retries by handing the rasterized pages to the session model → result returned with `data.source: "ocr"`.

## Decision

The vision read lives at `packages/core/src/llm/vision.ts` (`readViaVision`), consumed by `read` as an optional dependency (`ReadDeps.readScanned`). It is not a standalone tool exposed to agents — and not a separate OCR subsystem: since the session model is vision-capable, reading scanned pages is just another LLM call, not an OCR domain of its own.

## Reasoning

1. **ADR 0006 binds this.** "The LLM always reaches for `read`, format detection happens internally." A standalone `oocr` tool would require the agent to know *when* to call it — an implementation detail (scanned PDF vs text PDF) that the `read` tool already detects via `pdf-inspector`. Forcing agents to distinguish scanned from text PDFs leaks internal routing logic.

2. **Reduced agent surface area.** Each new tool adds cognitive load: the agent must learn its name, parameters, when to reach for it, and how to handle its errors. Internal fallback means zero new tools — `read` just works for more file types.

3. **Auto-fallback > manual routing.** When `readPdf` throws `PDF_NO_TEXT_LAYER`, the `read` tool catches it and retries via OCR automatically. The agent never sees the error unless OCR also fails. This is strictly better than requiring the agent to catch the error and decide to call `oocr`.

4. **Image files route the same way.** Standalone images (`.png`/`.jpg`/`.jpeg` — the formats vision APIs accept; tiff/bmp were dropped from the routing set for this reason) also route through `read` → `readScanned`, with a clear error (`OCR_NOT_AVAILABLE`) when the vision read isn't wired. No separate tool needed.

## Consequences

- The vision read lives at `packages/core/src/llm/vision.ts` (`readViaVision`): PDF pages are rasterized via `pdftoppm` (poppler-utils, same family as `pdftotext`), then read by the session model via a nested model call (`complete`). See ADR 0014 for the model choice and its privacy implications.
- `ReadDeps` gains an optional `readScanned` field — backward-compatible, server wires it in `daemon.ts`.
- OCR output is flagged via text prefix (`[OCR: ...]`) and structured metadata (`data.source: "ocr"`) so consumers can distinguish it from text-layer extraction.
- If a future need arises for direct OCR access (e.g., batch processing outside `read`), `readScanned` can be promoted to a standalone tool without changing its internal implementation.
