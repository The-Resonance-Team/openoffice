# PDF Extraction via pdf-inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@firecrawl/anydoc` PDF reading with `@firecrawl/pdf-inspector` for structured Markdown extraction (tables, images, headings) and honest scanned/image-based PDF error signaling.

**Architecture:** New `read-pdf.ts` module wraps pdf-inspector's `classifyPdf` + `processPdf` with platform fallback. Core `read.ts` gains optional `readPdf` dep for PDF-specific routing. Daemon wires both `readDocument` (anydoc) and `readPdf` (pdf-inspector) to tools.

**Tech Stack:** `@firecrawl/pdf-inspector` (napi-rs), `@firecrawl/anydoc` (retained for non-PDF), TypeScript, Vitest

## Global Constraints

- `@firecrawl/pdf-inspector` ^1.12.0 — napi-rs bindings, no subprocess for supported platforms
- Platform fallback: `pdf2md` CLI (`cargo install pdf-inspector`) for darwin-x64, win32-arm64
- Backward compatible: if `readPdf` not passed to `createReadTool`, falls back to `readDocument`
- Error codes: `PDF_NO_TEXT_LAYER`, `PDF_READ_ERROR`, `PDF_UNSUPPORTED_PLATFORM`
- Image format: `![image](page=X)`

---

### Task 1: Install pdf-inspector dependency

**Files:**
- Modify: `packages/server/package.json`

**Interfaces:**
- Consumes: none
- Produces: `@firecrawl/pdf-inspector` available for import

- [ ] **Step 1: Add dependency**

```bash
cd packages/server && bun add @firecrawl/pdf-inspector
```

- [ ] **Step 2: Verify install**

```bash
cd packages/server && bun run -e "const { classifyPdf } = require('@firecrawl/pdf-inspector'); console.log(typeof classifyPdf)"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add packages/server/package.json packages/server/bun.lock
git commit -m "feat(server): add @firecrawl/pdf-inspector dependency"
```

---

### Task 2: Create read-pdf.ts module

**Files:**
- Create: `packages/server/src/read-pdf.ts`

**Interfaces:**
- Consumes: `@firecrawl/pdf-inspector` (`classifyPdf`, `processPdf`)
- Produces: `readPdf(file: string): Promise<string>`

- [ ] **Step 1: Create read-pdf.ts with platform detection and classifyPdf routing**

```ts
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform, arch } from "node:os";

export class PdfError extends Error {
  constructor(
    message: string,
    public code:
      | "PDF_NO_TEXT_LAYER"
      | "PDF_READ_ERROR"
      | "PDF_UNSUPPORTED_PLATFORM"
  ) {
    super(message);
    this.name = "PdfError";
  }
}

type FallbackMode = "napi" | "cli" | "none";

let cachedFallback: FallbackMode | null = null;

function detectFallback(): FallbackMode {
  if (cachedFallback !== null) return cachedFallback;

  // Check if napi binary exists for this platform
  try {
    const os = platform();
    const cpu = arch();
    const napiPlatform =
      os === "darwin"
        ? "darwin"
        : os === "win32"
          ? "win32"
          : "linux";
    const napiArch = cpu === "arm64" ? "arm64" : "x64";
    const napiLib = os === "linux" ? (existsSync("/lib/ld-musl-x86_64.so1") ? "musl" : "gnu") : "msvc";
    const pkgName = `@firecrawl/pdf-inspector-${napiPlatform}-${napiArch}${napiPlatform === "linux" ? `-${napiLib}` : ""}`;

    // Try to require the platform binary — if it resolves, napi works
    try {
      require.resolve(pkgName);
      cachedFallback = "napi";
      return cachedFallback;
    } catch {
      // Binary not available, try CLI fallback
    }
  } catch {
    // Platform detection failed
  }

  // Check if pdf2md CLI is available
  try {
    execFileSync("pdf2md", ["--version"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: "pipe",
    });
    cachedFallback = "cli";
    return cachedFallback;
  } catch {
    // CLI not available
  }

  cachedFallback = "none";
  return cachedFallback;
}

function processResult(
  result: { type: string; markdown?: string; warning?: string },
  fileType: string
): string {
  const markdown = result.markdown ?? "";

  switch (fileType) {
    case "Scanned":
    case "ImageBased":
      throw new PdfError(
        "Scanned/image PDF detected. Use OCR (oocr) for text extraction.",
        "PDF_NO_TEXT_LAYER"
      );

    case "Mixed":
      return `[Warning: This PDF contains mixed content. Some sections may be incomplete.]\n\n${markdown}`;

    case "EncodingIssue":
      return `[Warning: Font encoding issues detected. Extraction may contain errors.]\n\n${markdown}`;

    case "TextBased":
    default:
      return markdown;
  }
}

function readViaCli(file: string): string {
  try {
    const stdout = execFileSync("pdf2md", [file], {
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch (e: any) {
    throw new PdfError(
      e.message ?? "pdf2md CLI failed",
      "PDF_READ_ERROR"
    );
  }
}

export async function readPdf(file: string): Promise<string> {
  const fallback = detectFallback();

  if (fallback === "none") {
    throw new PdfError(
      "PDF extraction not supported on this platform. Install pdf2md: cargo install pdf-inspector",
      "PDF_UNSUPPORTED_PLATFORM"
    );
  }

  if (fallback === "cli") {
    return readViaCli(file);
  }

  // napi path
  try {
    const { classifyPdf, processPdf } = require("@firecrawl/pdf-inspector");
    const classification = await classifyPdf(file);
    const fileType = classification.type ?? classification;
    const result = await processPdf(file);
    return processResult(result, fileType);
  } catch (e: any) {
    if (e instanceof PdfError) throw e;
    throw new PdfError(
      e.message ?? "pdf-inspector failed",
      "PDF_READ_ERROR"
    );
  }
}
```

- [ ] **Step 2: Verify module loads**

```bash
cd packages/server && bun run -e "const { readPdf } = require('./src/read-pdf'); console.log(typeof readPdf)"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/read-pdf.ts
git commit -m "feat(server): add readPdf module with classifyPdf routing and platform fallback"
```

---

### Task 3: Add readPdf to ReadDeps and routing in read.ts

**Files:**
- Modify: `packages/core/src/tool/builtins/read.ts:73-76` (ReadDeps interface)
- Modify: `packages/core/src/tool/builtins/read.ts:117-127` (routing logic)

**Interfaces:**
- Consumes: none
- Produces: `ReadDeps.readPdf` optional dep, PDF routing to readPdf when available

- [ ] **Step 1: Add readPdf to ReadDeps interface**

At `packages/core/src/tool/builtins/read.ts:73-76`, change:

```ts
export interface ReadDeps {
  readDocument: (file: string, ctx: ToolContext) => Promise<string>;
  readPdf?: (file: string) => Promise<string>;
  draftManager?: DraftManager;
}
```

- [ ] **Step 2: Update routing logic to check readPdf first**

At `packages/core/src/tool/builtins/read.ts:117-127`, change:

```ts
      if (ext === ".pdf" && deps.readPdf) {
        try {
          const content = await deps.readPdf(file);
          return { success: true, output: content };
        } catch (e: any) {
          return {
            success: false,
            error: e.message ?? "Failed to read PDF",
            code: e.code === "PDF_NO_TEXT_LAYER" ? "PDF_NO_TEXT_LAYER" : "PDF_READ_ERROR",
          };
        }
      }

      if (DOCUMENT_EXTENSIONS.has(ext)) {
        try {
          const content = await deps.readDocument(file, ctx);
          return { success: true, output: content };
        } catch (e: any) {
          return {
            success: false,
            error: e.message ?? "Failed to read office document",
            code: ext === ".pdf" ? "PDF_READ_ERROR" : "DOCUMENT_READ_ERROR",
          };
        }
      }
```

- [ ] **Step 3: Run existing read tests to verify backward compat**

```bash
cd apps/cli && bun test test/builtins.test.ts -- --grep "read"
```

Expected: All existing tests pass (no readPdf passed = falls through to readDocument)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/tool/builtins/read.ts
git commit -m "feat(core): add readPdf optional dep to ReadDeps with PDF-specific routing"
```

---

### Task 4: Write unit tests for read.ts PDF routing

**Files:**
- Create: `packages/core/src/tool/builtins/read.test.ts`

**Interfaces:**
- Consumes: `createReadTool` from read.ts
- Produces: unit tests for PDF routing logic

- [ ] **Step 1: Create read.test.ts with PDF routing tests**

```ts
import { describe, test, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createReadTool } from "./read";

function tempDir(): string {
  const dir = join(tmpdir(), `read-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("createReadTool — PDF routing", () => {
  test("routes .pdf to readPdf when provided", async () => {
    const dir = tempDir();
    const file = join(dir, "test.pdf");
    writeFileSync(file, "%PDF-1.4");

    let calledWith = "";
    const tool = createReadTool({
      readDocument: async () => "anydoc result",
      readPdf: async (f: string) => {
        calledWith = f;
        return "pdf-inspector result";
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
    if (result.success) expect(result.output).toBe("pdf-inspector result");
  });

  test("falls back to readDocument when readPdf not provided", async () => {
    const dir = tempDir();
    const file = join(dir, "test.pdf");
    writeFileSync(file, "%PDF-1.4");

    let calledWith = "";
    const tool = createReadTool({
      readDocument: async (f: string) => {
        calledWith = f;
        return "anydoc result";
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });

  test("returns PDF_NO_TEXT_LAYER for scanned PDF error", async () => {
    const dir = tempDir();
    const file = join(dir, "scanned.pdf");
    writeFileSync(file, "%PDF-1.4");

    const tool = createReadTool({
      readDocument: async () => "anydoc",
      readPdf: async () => {
        const err = new Error("Scanned PDF") as any;
        err.code = "PDF_NO_TEXT_LAYER";
        throw err;
      },
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("PDF_NO_TEXT_LAYER");
  });

  test("routes non-PDF documents to readDocument", async () => {
    const dir = tempDir();
    const file = join(dir, "test.docx");
    writeFileSync(file, "binary");

    let calledWith = "";
    const tool = createReadTool({
      readDocument: async (f: string) => {
        calledWith = f;
        return "docx content";
      },
      readPdf: async () => "should not be called",
    });
    const result = await tool.execute({ file }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(calledWith).toBe(file);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd packages/core && bun test src/tool/builtins/read.test.ts
```

Expected: 4 tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/tool/builtins/read.test.ts
git commit -m "test(core): add unit tests for readPdf routing in createReadTool"
```

---

### Task 5: Wire readPdf in daemon.ts

**Files:**
- Modify: `packages/server/src/server/daemon.ts:7` (import)
- Modify: `packages/server/src/server/daemon.ts:131-155` (tool wiring)

**Interfaces:**
- Consumes: `readPdf` from `../read-pdf`
- Produces: tools receive `readPdf` dep

- [ ] **Step 1: Add import for readPdf**

At `packages/server/src/server/daemon.ts:7`, after the anydoc import, add:

```ts
import { readPdf } from "../read-pdf";
```

- [ ] **Step 2: Pass readPdf to createReadTool and createGrepTool**

At `packages/server/src/server/daemon.ts:139-154`, change:

```ts
    createReadTool({
      draftManager,
      readDocument,
      readPdf,
    }),
    createWriteTool(),
    createGlobTool(),
    createGrepTool({
      readDocument,
      readSearchData,
      readPdf,
      resolveDocument: async (file, ctx) => {
        const resolved = await draftManager.resolve(file, ctx.sessionID, false);
        if (resolved.lockError) throw new Error(resolved.lockError);
        return resolved.path ?? file;
      },
      officeExtractLimit: config.grep?.officeExtractLimit,
    }),
```

- [ ] **Step 3: Add readPdf to GrepDeps interface**

At `packages/core/src/tool/builtins/grep.ts:13-24`, add `readPdf`:

```ts
export interface GrepDeps {
  readDocument: (file: string, ctx: ToolContext) => Promise<string>;
  readPdf?: (file: string) => Promise<string>;
  readMetadata?: (
    file: string,
    ctx: ToolContext
  ) => Promise<Record<string, unknown>>;
  readSearchExtras?: (file: string, ctx: ToolContext) => Promise<string>;
  readSearchData?: (file: string, ctx: ToolContext) => Promise<GrepSearchData>;
  officeExtractLimit?: number;
  listFiles?: (path: string, include?: string) => Promise<string[]>;
  resolveDocument?: (file: string, ctx: ToolContext) => Promise<string>;
}
```

- [ ] **Step 4: Use readPdf in grep's document extraction**

At `packages/core/src/tool/builtins/grep.ts:232-241`, update extraction to prefer readPdf for PDFs:

```ts
          if (shouldExtract) {
            try {
              const ext = require("node:path").extname(resolvedFile).toLowerCase();
              const reader =
                ext === ".pdf" && deps?.readPdf ? deps.readPdf : deps!.readDocument;
              const content = await reader(resolvedFile, ctx);
              extractedMatches.push(
                ...(await matchExtractedText(file, content, params.query))
              );
            } catch {
              extractionFailed++;
            }
          }
```

- [ ] **Step 5: Build to verify no type errors**

```bash
cd packages/core && bun run build
cd packages/server && bun run build
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/server/daemon.ts packages/core/src/tool/builtins/grep.ts
git commit -m "feat(server): wire readPdf to read and grep tools via daemon"
```

---

### Task 6: Write integration tests for read-pdf.ts

**Files:**
- Create: `packages/server/src/read-pdf.test.ts`

**Interfaces:**
- Consumes: `readPdf` from `./read-pdf`
- Produces: integration tests with real PDF files

- [ ] **Step 1: Create test PDF fixtures**

Create `packages/server/test/fixtures/` directory with small test PDFs:
- `text-based.pdf` — simple PDF with text, tables, headings
- `scanned.pdf` — image-only PDF (no text layer)
- `mixed.pdf` — PDF with both text and scanned pages

Note: These can be minimal valid PDFs. A text-based PDF can be created programmatically; a scanned PDF can be a single-page image wrapped in PDF.

- [ ] **Step 2: Create read-pdf.test.ts**

```ts
import { describe, test, expect, beforeAll } from "vitest";
import { join } from "node:path";
import { readPdf, PdfError } from "./read-pdf";

const fixtures = join(__dirname, "fixtures");

describe("readPdf", () => {
  test("extracts Markdown from text-based PDF", async () => {
    const file = join(fixtures, "text-based.pdf");
    const result = await readPdf(file);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // Should contain some structural content
    expect(result).toMatch(/#{1,3}\s|[\|].*[\|]|!\[image/);
  });

  test("throws PDF_NO_TEXT_LAYER for scanned PDF", async () => {
    const file = join(fixtures, "scanned.pdf");
    await expect(readPdf(file)).rejects.toThrow(PdfError);
    try {
      await readPdf(file);
    } catch (e) {
      expect(e).toBeInstanceOf(PdfError);
      expect((e as PdfError).code).toBe("PDF_NO_TEXT_LAYER");
    }
  });

  test("returns Markdown with warning for mixed PDF", async () => {
    const file = join(fixtures, "mixed.pdf");
    const result = await readPdf(file);
    expect(result).toMatch(/\[Warning:.*mixed/);
  });

  test("throws PDF_UNSUPPORTED_PLATFORM when no binary available", async () => {
    // This test only runs on platforms without napi or CLI
    // Skip on supported platforms
    const { execFileSync } = require("node:child_process");
    let hasCli = false;
    try {
      execFileSync("pdf2md", ["--version"], { stdio: "pipe", timeout: 5000 });
      hasCli = true;
    } catch {}

    // Check napi availability
    let hasNapi = false;
    try {
      const os = require("node:os");
      const pkg = `@firecrawl/pdf-inspector-${os.platform()}-${os.arch()}`;
      require.resolve(pkg);
      hasNapi = true;
    } catch {}

    if (hasNapi || hasCli) {
      // Platform is supported, skip this test
      return;
    }

    await expect(readPdf("/fake/file.pdf")).rejects.toThrow(PdfError);
    try {
      await readPdf("/fake/file.pdf");
    } catch (e) {
      expect((e as PdfError).code).toBe("PDF_UNSUPPORTED_PLATFORM");
    }
  });
});
```

- [ ] **Step 3: Run integration tests**

```bash
cd packages/server && bun test src/read-pdf.test.ts
```

Expected: Tests pass (text-based and scanned tests depend on fixture quality; platform test may skip)

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/read-pdf.test.ts packages/server/test/fixtures/
git commit -m "test(server): add integration tests for readPdf with PDF fixtures"
```

---

### Task 7: Update CONTEXT.md

**Files:**
- Modify: `CONTEXT.md`

**Interfaces:**
- Consumes: none
- Produces: updated glossary entries

- [ ] **Step 1: Update Tool definition**

Find the Tool definition paragraph that mentions "pdf-parse" and replace:

Old:
```
a document reader delegates to officecli or pdf-parse based on file extension
```

New:
```
a document reader delegates to pdf-inspector (PDF) or anydoc (other formats) based on file extension
```

- [ ] **Step 2: Update Document toolkit entry**

Find the Document toolkit entry and replace with:

```
Document toolkit: officecli (OOXML editing), pdf-inspector (PDF reading via 
napi-rs — classifyPdf detects TextBased/Scanned/ImageBased/Mixed; TextBased → 
full Markdown with tables/images/structure, Scanned/ImageBased → honest error, 
Mixed/encoding issues → partial extraction with warning; owned by #22), anydoc 
(docx/xlsx/pptx to Markdown — retained for non-PDF formats), oocr (OCR fallback 
for scanned/image-based PDFs via local Tesseract — owned by #23, not yet built), 
pandoc (format conversion). Each tool has its own ToolDefinition and can reference 
other tools for chaining. The read tool auto-detects file format and delegates to 
the appropriate backend.
```

- [ ] **Step 3: Commit**

```bash
git add CONTEXT.md
git commit -m "docs: update CONTEXT.md Document toolkit and Tool definition for pdf-inspector"
```

---

### Task 8: Verify full build and test suite

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: all previous tasks
- Produces: green build and tests

- [ ] **Step 1: Build all packages**

```bash
bun run build
```

Expected: No type errors across all packages

- [ ] **Step 2: Run full test suite**

```bash
bun test
```

Expected: All tests pass including new read.test.ts and read-pdf.test.ts

- [ ] **Step 3: Manual smoke test**

```bash
cd packages/server && bun run -e "
const { readPdf } = require('./src/read-pdf');
readPdf('test/fixtures/text-based.pdf')
  .then(r => console.log('OK:', r.substring(0, 200)))
  .catch(e => console.error('FAIL:', e.message));
"
```

Expected: Prints extracted Markdown content

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address review feedback from verification"
```
