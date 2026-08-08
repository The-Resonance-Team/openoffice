# 0013 — pdf-inspector replaces anydoc for PDF extraction

## Status

Accepted (implemented in PR #67, Issue #22)

## Context

The `read` tool used `@firecrawl/anydoc`'s `toMarkdown()` for all document formats including PDF. Anydoc is a general document converter — it produces flat text dumps from PDFs, losing tables, images, headings, and reading order. Scanned/image-based PDFs returned empty or garbage output with no error signal. There was no way to distinguish text-based PDFs from scanned ones.

`@firecrawl/pdf-inspector` (Rust core via napi-rs bindings, called in-process) provides:
- `classifyPdf`: detects TextBased / Scanned / ImageBased / Mixed in ~20ms
- `processPdf`: full Markdown pipeline — tables as Markdown tables, image placeholders at position, headings/lists preserved, reading-order detection
- Honest error signaling for scanned/image-based PDFs via `PDF_NO_TEXT_LAYER`

This is the first native (non-JS/TS) compiled dependency in the codebase, and the first document backend that runs in-process rather than as a subprocess. The justification is narrow: anydoc cannot produce structured PDF output at all — there is no simpler dependency that solves this.

## Decision

**pdf-inspector for PDFs, anydoc retained for non-PDF formats (docx/xlsx/pptx).**

The `readPdf` function in `packages/server/src/read-pdf.ts` handles routing:
- `classifyPdf` → TextBased: run `processPdf`, return Markdown
- `classifyPdf` → Scanned/ImageBased: throw `PDF_NO_TEXT_LAYER` error
- `classifyPdf` → Mixed: run `processPdf`, prepend warning about incomplete extraction
- `hasEncodingIssues` from `processPdf`: prepend warning about encoding reliability

Platform fallback: napi binary → `pdf2md` CLI (`cargo install pdf-inspector`) → clear error.

`ReadDeps.readPdf` is optional — if not provided, PDFs fall through to anydoc (backward compatible).

## Consequences

- Text-based PDFs now return structured Markdown with tables, images, and headings
- Scanned/image-based PDFs return a clear error instead of silent garbage
- Mixed/encoding PDFs return partial extraction with warnings
- Anydoc remains for docx/xlsx/pptx — no change to those formats
- Native dependency adds platform-specific binary requirements (napi-rs prebuilt for 6/8 platforms, CLI fallback for darwin-x64 and win32-arm64)
- `classifyPdf`/`processPdf` are synchronous napi calls wrapped in `setImmediate` to avoid blocking the daemon event loop on large PDFs
