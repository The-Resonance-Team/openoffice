import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import ExcelJS from "exceljs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const EXCEL_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xltx", ".xltm"]);

interface PdfOutlineItem {
  title?: string;
  items?: PdfOutlineItem[];
}

function outlineText(items: PdfOutlineItem[], lines: string[]): void {
  for (const item of items) {
    if (item.title) lines.push(`PDF bookmark: ${item.title}`);
    if (item.items?.length) outlineText(item.items, lines);
  }
}

async function readPdfExtras(file: string): Promise<string> {
  const loadingTask = getDocument({
    data: new Uint8Array(await readFile(file)),
  });
  const lines: string[] = [];

  try {
    const document = await loadingTask.promise;
    outlineText((await document.getOutline()) ?? [], lines);
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      try {
        for (const annotation of await page.getAnnotations({
          intent: "display",
        })) {
          const text =
            annotation.contentsObj?.str ??
            annotation.titleObj?.str ??
            annotation.contents ??
            annotation.title;
          if (text) lines.push(`PDF annotation (page ${pageNumber}): ${text}`);
        }
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await loadingTask.destroy();
  }

  return lines.join("\n");
}

function noteText(note: string | { texts?: Array<{ text: string }> }): string {
  return typeof note === "string"
    ? note
    : (note.texts ?? []).map(({ text }) => text).join("");
}

async function readExcelExtras(file: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const lines: string[] = [];

  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.formula) {
          lines.push(
            `Excel formula: ${worksheet.name}!${cell.address} = ${cell.formula}`
          );
        }
        if (cell.note) {
          const text = noteText(cell.note);
          if (text) {
            lines.push(
              `Excel comment: ${worksheet.name}!${cell.address} = ${text}`
            );
          }
        }
      });
    });
  }

  return lines.join("\n");
}

export async function readSearchExtras(file: string): Promise<string> {
  const extension = extname(file).toLowerCase();
  if (extension === ".pdf") return readPdfExtras(file);
  if (EXCEL_EXTENSIONS.has(extension)) return readExcelExtras(file);
  return "";
}
