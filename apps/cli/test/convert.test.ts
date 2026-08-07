import { describe, expect, test } from "bun:test";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConvertTool } from "@openoffice/core";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "openoffice-convert-test-"));
}

function makeTool(overrides?: {
  askUser?: (q: string) => Promise<string>;
  convertFile?: (file: string, format: string) => Promise<string>;
}) {
  return createConvertTool({
    askUser: overrides?.askUser ?? (async () => "y"),
    convertFile: overrides?.convertFile ?? (async (f, fmt) => `${f}.${fmt}`),
  });
}

describe("convert tool", () => {
  test("asks user before converting", async () => {
    let asked = "";
    const tool = makeTool({
      askUser: async (q: string) => {
        asked = q;
        return "y";
      },
    });
    const result = await tool.execute(
      { file: "report.doc" },
      { sessionID: "test" }
    );
    expect(asked).toContain("report.doc");
    expect(asked).toContain("docx");
    expect(result.success).toBe(true);
  });

  test("cancels when user says no", async () => {
    const tool = makeTool({ askUser: async () => "n" });
    const result = await tool.execute(
      { file: "report.doc" },
      { sessionID: "test" }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("CANCELLED");
    }
  });

  test("infers docx from .doc", async () => {
    let convertedFormat = "";
    const tool = makeTool({
      convertFile: async (_f, fmt) => {
        convertedFormat = fmt;
        return "report.docx";
      },
    });
    await tool.execute({ file: "report.doc" }, { sessionID: "test" });
    expect(convertedFormat).toBe("docx");
  });

  test("infers xlsx from .xls and pptx from .ppt", async () => {
    const formats: string[] = [];
    const tool = makeTool({
      convertFile: async (_f, fmt) => {
        formats.push(fmt);
        return "out." + fmt;
      },
    });
    await tool.execute({ file: "data.xls" }, { sessionID: "test" });
    await tool.execute({ file: "deck.ppt" }, { sessionID: "test" });
    expect(formats).toEqual(["xlsx", "pptx"]);
  });

  test("honors explicit format override", async () => {
    let convertedFormat = "";
    const tool = makeTool({
      convertFile: async (_f, fmt) => {
        convertedFormat = fmt;
        return "out." + fmt;
      },
    });
    await tool.execute(
      { file: "report.doc", format: "pptx" },
      { sessionID: "test" }
    );
    expect(convertedFormat).toBe("pptx");
  });

  test("rejects non-legacy source files", async () => {
    const tool = makeTool();
    const result = await tool.execute(
      { file: "report.docx" },
      { sessionID: "test" }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("NOT_LEGACY");
    }
  });

  test("rejects unknown legacy extensions", async () => {
    const tool = makeTool();
    const result = await tool.execute(
      { file: "archive.rtf" },
      { sessionID: "test" }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("UNSUPPORTED_SOURCE_FORMAT");
    }
  });

  test("reports conversion failure", async () => {
    const tool = makeTool({
      convertFile: async () => {
        throw new Error("soffice failed");
      },
    });
    const result = await tool.execute(
      { file: "report.doc" },
      { sessionID: "test" }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("CONVERT_ERROR");
      expect(result.error).toContain("soffice failed");
    }
  });

  test("returns converted file path on success", async () => {
    const tool = makeTool({
      convertFile: async () => "/tmp/report.docx",
    });
    const result = await tool.execute(
      { file: "report.doc" },
      { sessionID: "test" }
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain("/tmp/report.docx");
    }
  });

  test("integration: converts real .doc via soffice when available", async () => {
    const have = (cmd: string) =>
      Bun.spawnSync(["which", cmd], { stdout: "pipe", stderr: "pipe" })
        .exitCode === 0;
    // Runs on the unit CI matrix (ubuntu/windows) where neither binary is
    // installed — skip instead of failing on ENOENT.
    if (!have("soffice") || !have("officecli")) {
      return;
    }

    const dir = tempDir();
    const docx = join(dir, "seed.docx");

    const { execFileSync } = await import("node:child_process");
    const { dirname, basename, extname } = await import("node:path");

    // Concurrent headless soffice runs collide on the shared user profile;
    // give each conversion a private profile dir.
    const profileFlag = (name: string) =>
      `-env:UserInstallation=file://${join(dir, name).replace(/\\/g, "/")}`;

    // Generate a real legacy .doc by down-converting a .docx
    execFileSync("officecli", ["create", docx, "--json"], {
      encoding: "utf-8",
      timeout: 30000,
    });
    execFileSync(
      "soffice",
      [
        "--headless",
        profileFlag("lo-profile-down"),
        "--convert-to",
        "doc",
        "--outdir",
        dir,
        docx,
      ],
      {
        encoding: "utf-8",
        timeout: 60000,
      }
    );
    const source = join(dir, "seed.doc");
    expect(existsSync(source)).toBe(true);

    const target = join(dir, "seed.docx");
    const tool = createConvertTool({
      askUser: async () => "y",
      convertFile: async (file: string, format: string) => {
        const outDir = dirname(file);
        execFileSync(
          "soffice",
          [
            "--headless",
            profileFlag("lo-profile-up"),
            "--convert-to",
            format,
            "--outdir",
            outDir,
            file,
          ],
          {
            encoding: "utf-8",
            timeout: 60000,
          }
        );
        return join(outDir, `${basename(file, extname(file))}.${format}`);
      },
    });

    const result = await tool.execute({ file: source }, { sessionID: "test" });
    expect(result.success).toBe(true);
    expect(existsSync(target)).toBe(true);
    expect(existsSync(source)).toBe(true);
  });
});
