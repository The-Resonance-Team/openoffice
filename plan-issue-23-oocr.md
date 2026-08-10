# Plan: Issue #23 — OCR for scanned PDFs and images

## Goal

Add local OCR (Tesseract) as an internal fallback in the `read` tool so scanned/image-based PDFs and standalone images are automatically extracted — no new public tool, no agent intervention needed.

## Decisions (from grilling)

| # | Decision | Value |
|---|---|---|
| 1 | Architecture | Internal module in `read`, not standalone tool |
| 2 | PDF rasterize | `pdftoppm` binary (poppler-utils) |
| 3 | Fallback behavior | Auto-fallback: `readPdf` → OCR → result |
| 4 | Image routing | `IMAGE_EXTENSIONS` set in `read.ts`, route to OCR directly |
| 5 | readOcr interface | `(file: string) => Promise<string>` |
| 6 | Processing | Sequential, 100 page limit |
| 7 | Missing Tesseract | Throw error with install instructions |
| 8 | Module location | `packages/core/src/ocr/` |
| 9 | Output format | Text prefix `[OCR: ...]` + `source: "ocr"` metadata |
| 10 | Default language | `eng+vie` |
| 11 | Config | Hardcode for v1 |
| 12 | Temp cleanup | `fs.mkdtemp` + `try/finally` |

## Files to create

### 1. `packages/core/src/ocr/install.ts`
- `checkInstalled()` — probe `tesseract --version`, cached (same pattern as `office/install.ts`)
- `checkPdftoppm()` — probe `pdftoppm -v`, cached
- `resetCache()` — clear both caches

### 2. `packages/core/src/ocr/ocr.ts`
- `readOcr(file: string): Promise<string>` — main entry point
  - If `.pdf`: rasterize with `pdftoppm` → OCR each page with Tesseract → concat
  - If image extension: OCR directly with Tesseract
  - Page limit: 100, prepend warning if exceeded
  - Temp dir: `fs.mkdtemp` + `try/finally` cleanup
  - Tesseract args: `-l eng+vie` default
  - Output prefix: `[OCR: Extracted from scanned document via Tesseract. May contain recognition errors.]`

### 3. `packages/core/src/ocr/index.ts`
- Barrel exports: `readOcr`, `checkInstalled`, `checkPdftoppm`, `resetCache`

### 4. `packages/core/src/ocr/ocr.test.ts`
- Unit tests with mock deps (mock `execFileSync`)
- Test: PDF rasterize → OCR path
- Test: Direct image OCR path
- Test: Missing Tesseract throws error with install message
- Test: Missing pdftoppm throws error
- Test: Page limit warning prepended
- Test: OCR source flag present in output

## Files to modify

### 5. `packages/core/src/tool/builtins/read.ts`
- Add `IMAGE_EXTENSIONS` set: `.png`, `.jpg`, `.jpeg`, `.tiff`, `.bmp`
- Add `readOcr?: (file: string) => Promise<string>` to `ReadDeps`
- **PDF auto-fallback** (line ~118-133): when `readPdf` throws `PDF_NO_TEXT_LAYER` AND `deps.readOcr` exists → retry via `readOcr` → return `{ success: true, output: ocrResult, data: { source: "ocr" } }`
- **Image routing** (new branch before TEXT_EXTENSIONS): if `IMAGE_EXTENSIONS.has(ext)` AND `deps.readOcr` → call `readOcr(file)` → return with `data: { source: "ocr" }`
- Update `createReadTool` description to mention OCR support

### 6. `packages/core/src/tool/builtins/read.test.ts`
- Add tests for OCR auto-fallback on `PDF_NO_TEXT_LAYER`
- Add tests for image extension routing to OCR
- Add tests for OCR source flag in result
- Add tests for OCR not provided (graceful fallback to error)

### 7. `packages/server/src/server/daemon.ts`
- Import `readOcr` from `@openoffice/core` (via ocr module)
- Add `readOcr` to `createReadTool({ ..., readOcr })` call (line ~140-144)

### 8. `packages/core/src/tool/builtins/index.ts`
- No change needed (ReadDeps already exported)

### 9. `CONTEXT.md`
- Update "Document toolkit" entry: change "oocr (OCR fallback... not yet built)" to reflect actual implementation

## Implementation order

1. Create `packages/core/src/ocr/install.ts` — dependency checks
2. Create `packages/core/src/ocr/ocr.ts` — main OCR logic
3. Create `packages/core/src/ocr/index.ts` — barrel exports
4. Modify `packages/core/src/tool/builtins/read.ts` — add IMAGE_EXTENSIONS, readOcr dep, auto-fallback
5. Create `packages/core/src/ocr/ocr.test.ts` — unit tests
6. Modify `packages/core/src/tool/builtins/read.test.ts` — OCR integration tests
7. Modify `packages/server/src/server/daemon.ts` — wire readOcr into ReadDeps
8. Update `CONTEXT.md` — Document toolkit entry

## Key patterns to follow

- **Subprocess wrapping**: `execFileSync` + timeout + `encoding: "utf-8"` + `stdio: ["pipe", "pipe", "pipe"]` (officecli pattern)
- **Install check**: cached boolean, `resetCache()` for testing (office/install.ts pattern)
- **Error handling**: typed error codes, ENOENT caught separately (read-pdf.ts pattern)
- **Tests**: `bun:test`, mock deps, `tempDir()` helper (read.test.ts pattern)
- **Barrel exports**: `export *` from index.ts (AGENTS.md rule 5)

## Verification

1. `bun test packages/core/src/ocr/ocr.test.ts` — OCR unit tests pass
2. `bun test packages/core/src/tool/builtins/read.test.ts` — read tests pass (including new OCR fallback tests)
3. `cd packages/core && pnpm run typecheck` — no type errors
4. `cd packages/core && pnpm run lint` — no lint errors
5. Manual test: create a scanned PDF, run `read` on it → should get OCR text with source flag
