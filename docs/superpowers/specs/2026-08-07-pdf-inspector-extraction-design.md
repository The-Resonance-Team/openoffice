# Design: PDF Extraction via pdf-inspector

**Issue:** #22
**Date:** 2026-08-07
**Status:** Approved

## Problem

The current PDF reader uses `@firecrawl/anydoc`'s `toMarkdown()` — a general document converter that produces flat text dumps. Tables, images, headings, and structure are lost. Scanned/image-based PDFs return empty/garbage output with no error signal. There is no way to distinguish text-based PDFs from scanned ones.

## Solution

Replace `@firecrawl/anydoc` for PDF reading with `@firecrawl/pdf-inspector` (napi-rs bindings), which provides:
- `classifyPdf`: detects TextBased / Scanned / ImageBased / Mixed in ~20ms
- `processPdf`: full pipeline — text extraction with reading-order/column detection, dual-mode table detection formatted as Markdown tables, image placeholders at their position, heading/list/caption classification
- Honest error signaling for scanned/image-based PDFs

Retain `@firecrawl/anydoc` for non-PDF formats (docx, xlsx, pptx).

## Architecture

```
Agent calls read(file.pdf)
  → read.ts: ext === '.pdf' && deps.readPdf → deps.readPdf(file)
  → read-pdf.ts: classifyPdf(file)
      → TextBased → processPdf(file) → Markdown
      → Scanned/ImageBased → throw PDF_NO_TEXT_LAYER error
      → Mixed → processPdf(file) → Markdown + warning
      → Encoding issue → processPdf(file) → Markdown + warning
  → If pdf-inspector unavailable → fallback to pdf2md CLI
  → If CLI unavailable → throw PDF_UNSUPPORTED_PLATFORM

Agent calls read(file.docx)
  → read.ts: ext !== '.pdf' → deps.readDocument(file) → anydoc (unchanged)

grep tool also receives readPdf for PDF content extraction
```

## Changes

### 1. New file: `packages/server/src/read-pdf.ts`

Public API:
```ts
export async function readPdf(file: string): Promise<string>
```

Internal:
- Platform check at module load: detect if napi binary exists for current platform
- If no napi → fallback to `pdf2md` CLI (`execFileSync("pdf2md", [...])`)
- If neither available → `fallback = "none"`
- `classifyPdf(file)` → route to appropriate handler (see flow above)
- All errors include `code` field: `PDF_NO_TEXT_LAYER`, `PDF_READ_ERROR`, `PDF_UNSUPPORTED_PLATFORM`

### 2. Modified: `packages/core/src/tool/builtins/read.ts`

Add optional `readPdf` to `ReadDeps`:
```ts
export interface ReadDeps {
  readDocument: (file: string, ctx: ToolContext) => Promise<string>;
  readPdf?: (file: string) => Promise<string>;  // NEW
  draftManager?: DraftManager;
}
```

Routing in execute:
- If `ext === ".pdf" && deps.readPdf` → use `readPdf` (new path)
- If `ext === ".pdf" && !deps.readPdf` → fall through to `readDocument` (backward compat)
- Other document extensions → `readDocument` (unchanged)

Error codes: `PDF_NO_TEXT_LAYER` for scanned errors, `PDF_READ_ERROR` for other failures.

### 3. Modified: `packages/server/src/server/daemon.ts`

Import `readPdf` from `../read-pdf` and pass to tools:
```ts
import { readPdf } from "../read-pdf";

createReadTool({ draftManager, readDocument, readPdf }),
createGrepTool({ readDocument, readSearchData, readPdf, ... }),
```

### 4. Modified: `CONTEXT.md`

Tool definition: reference `pdf-inspector` (PDF) + `anydoc` (other formats) instead of `pdf-parse`.

Document toolkit entry: updated to describe pdf-inspector's classifyPdf routing, anydoc retention for non-PDF, and oocr as not-yet-built fallback.

## Platform Coverage

| Platform | Binary | Fallback |
|----------|--------|----------|
| darwin-arm64 | ✅ napi | — |
| darwin-x64 | ❌ | pdf2md CLI |
| linux-x64-gnu | ✅ napi | — |
| linux-x64-musl | ✅ napi | — |
| linux-arm64-gnu | ✅ napi | — |
| linux-arm64-musl | ✅ napi | — |
| win32-x64-msvc | ✅ napi | — |
| win32-arm64 | ❌ | pdf2md CLI |

Build docs must note: `cargo install pdf-inspector` required for darwin-x64 and win32-arm64.

## Error Handling

| Code | Condition | Agent message |
|------|-----------|---------------|
| `PDF_NO_TEXT_LAYER` | Scanned/ImageBased detected | "Scanned/image PDF detected. Use OCR (oocr) for text extraction." |
| `PDF_READ_ERROR` | pdf-inspector crash/failure | Original error message |
| `PDF_UNSUPPORTED_PLATFORM` | No napi + no pdf2md | "PDF extraction not supported on this platform. Install pdf2md: cargo install pdf-inspector" |

## Tests

### Unit test: `packages/core/src/tool/builtins/read.test.ts`
- PDF + `readPdf` provided → routes to readPdf
- PDF + no `readPdf` → falls back to readDocument
- Scanned PDF error → returns `PDF_NO_TEXT_LAYER`
- Non-PDF document → routes to readDocument (unchanged)

### Integration test: `packages/server/src/read-pdf.test.ts`
- TextBased PDF → Markdown with tables/headings
- Scanned PDF → throws `PDF_NO_TEXT_LAYER`
- Mixed PDF → Markdown with warning prefix
- Missing platform binary → falls back or throws `PDF_UNSUPPORTED_PLATFORM`

## Image Format

Images represented as `![image](page=X)` in the Markdown output.

## Acceptance Criteria

- [ ] `readPdf` uses `classifyPdf` + `processPdf` in-process, no subprocess for supported platforms
- [ ] TextBased PDFs return real Markdown: tables as Markdown tables, images at position, headings/lists preserved
- [ ] Scanned/ImageBased PDFs return clear `PDF_NO_TEXT_LAYER` error
- [ ] Mixed/encoding PDFs return partial extraction with warning
- [ ] Platform coverage verified; pdf2md fallback documented for darwin-x64, win32-arm64
- [ ] `CONTEXT.md` updated (Document toolkit + Tool definition)
- [ ] Unit tests pass
- [ ] Integration tests pass
