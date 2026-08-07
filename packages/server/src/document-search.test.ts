import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { readDocumentSearchData, readSearchExtras } from "./document-search";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "openoffice-document-search-"));
}

function testPdf(): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R /Outlines 5 0 R /PageMode /UseOutlines >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Annots [7 0 R] >>",
    "<< /Length 0 >>\nstream\n\nendstream",
    "<< /Type /Outlines /First 6 0 R /Last 6 0 R /Count 1 >>",
    "<< /Title (Appendix) /Parent 5 0 R /Dest [3 0 R /Fit] >>",
    "<< /Type /Annot /Subtype /Text /Rect [0 0 20 20] /Contents (Review note) /T (Alice) >>",
    "<< /Title (Quarterly report) /Author (Alice) >>",
  ];
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(chunks.join("")));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(""));
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  for (const offset of offsets.slice(1)) {
    chunks.push(`${offset.toString().padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );
  return Buffer.from(chunks.join(""));
}

describe("document search extras", () => {
  test("reads PDF bookmarks and annotations with PDF.js", async () => {
    const file = join(tempDir(), "manual.pdf");
    writeFileSync(file, testPdf());

    const result = await readSearchExtras(file);

    expect(result).toContain("PDF bookmark: Appendix");
    expect(result).toContain("PDF annotation (page 1): Review note");
  });

  test("reads PDF metadata and structure in one PDF.js pass", async () => {
    const file = join(tempDir(), "manual.pdf");
    writeFileSync(file, testPdf());

    const result = await readDocumentSearchData(file, async () => ({}));

    expect(result.metadata?.Title).toBe("Quarterly report");
    expect(result.metadata?.Author).toBe("Alice");
    expect(result.structured).toContain("PDF bookmark: Appendix");
    expect(result.structured).toContain("PDF annotation (page 1): Review note");
  });

  test("reads Excel formulas and comments with ExcelJS", async () => {
    const file = join(tempDir(), "budget.xlsx");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Alice";
    workbook.title = "Quarterly budget";
    workbook.lastModifiedBy = "Bob";
    const worksheet = workbook.addWorksheet("Sheet1");
    worksheet.getCell("A1").value = 10;
    worksheet.getCell("A2").value = 20;
    worksheet.getCell("B1").value = { formula: "A1+A2", result: 30 };
    worksheet.getCell("A1").note = "budget note";
    await workbook.xlsx.writeFile(file);

    const result = await readSearchExtras(file);

    expect(result).toContain("Excel formula: Sheet1!B1 = A1+A2");
    expect(result).toContain("Excel comment: Sheet1!A1 = budget note");
  });

  test("reads Excel metadata and structure in one ExcelJS pass", async () => {
    const file = join(tempDir(), "budget.xlsx");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Alice";
    workbook.title = "Quarterly budget";
    const worksheet = workbook.addWorksheet("Sheet1");
    worksheet.getCell("A1").value = { formula: "SUM(B1:B2)", result: 30 };
    worksheet.getCell("A1").note = "review budget";
    await workbook.xlsx.writeFile(file);

    const result = await readDocumentSearchData(file, async () => ({}));

    expect(result.metadata?.creator).toBe("Alice");
    expect(result.metadata?.title).toBe("Quarterly budget");
    expect(result.structured).toContain(
      "Excel formula: Sheet1!A1 = SUM(B1:B2)"
    );
    expect(result.structured).toContain(
      "Excel comment: Sheet1!A1 = review budget"
    );
  });

  test("uses metadata fallback for legacy Office files", async () => {
    for (const extension of [".doc", ".xls", ".ppt"]) {
      let calls = 0;
      const result = await readDocumentSearchData(
        `legacy${extension}`,
        async () => {
          calls++;
          return { Author: "Alice" };
        }
      );

      expect(calls).toBe(1);
      expect(result.metadata?.Author).toBe("Alice");
      expect(result.structured).toBe("");
    }
  });

  test("falls back to ExifTool metadata when PDF.js fails", async () => {
    const result = await readDocumentSearchData(
      join(tempDir(), "broken.pdf"),
      async () => ({ Author: "Alice" })
    );

    expect(result.metadata?.Author).toBe("Alice");
    expect(result.notes).toContain(
      "PDF.js search failed; used ExifTool metadata fallback"
    );
  });

  test("falls back to ExifTool metadata when ExcelJS fails", async () => {
    const result = await readDocumentSearchData(
      join(tempDir(), "broken.xlsx"),
      async () => ({ Author: "Alice" })
    );

    expect(result.metadata?.Author).toBe("Alice");
    expect(result.notes).toContain(
      "ExcelJS search failed; used ExifTool metadata fallback"
    );
  });
});
