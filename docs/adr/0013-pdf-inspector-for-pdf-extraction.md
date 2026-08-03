# 0013 — pdf-inspector replaces pdftotext for PDF extraction

`readPdf` shelled to `pdftotext -layout`, discarding tables, images, and structure — confirmed by reading `src/index.ts`. This issue swaps it for `@firecrawl/pdf-inspector` (Rust core via napi-rs bindings, called in-process): `classifyPdf` for fast text-based/scanned/image-based/mixed detection, `processPdf` for a real Markdown pipeline (tables, image placeholders, headings, reading order).

This is the first native (non-JS/TS) compiled dependency in the codebase, and the first document backend that runs in-process rather than as a subprocess — every other backend (`officecli`, `soffice`, `pdftotext`, `rg`) is a spawned CLI. That's worth recording: after three ADRs favoring "simpler abstractions" over heavier dependencies, pulling in a native addon is exactly the kind of choice a future reader would question without this context. The justification is narrow and concrete: `pdftotext` cannot produce structured output (tables, image position, reading order) at all — there is no simpler dependency that solves this, only cruder ones (regex-scraping raw text) or heavier ones (a full OCR pipeline for every PDF, including text-based ones that don't need it).

pdf-inspector explicitly does not do OCR — for Scanned/ImageBased PDFs it recommends routing to an external OCR service. This ADR covers only the extraction swap; the OCR path is a separate decision (see the OCR issue and its own ADR).

## Considered options

- **Keep `pdftotext`, parse its `-layout` output more aggressively (regex-based table detection)**: rejected — building table/heading/image-position detection from flat text with layout hints is reinventing what pdf-inspector already does correctly, worse.
- **Skip structured extraction, only fix the Scanned/ImageBased silent-failure case**: rejected — the silent failure was one of two problems reported; leaving tables/images unaddressed means text-based PDFs (the common case) still lose most of their information.
