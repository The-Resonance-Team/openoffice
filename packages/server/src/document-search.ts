import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import ExcelJS from 'exceljs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const EXCEL_EXTENSIONS = new Set(['.xlsx', '.xlsm', '.xltx', '.xltm']);

export interface DocumentSearchData {
  metadata: Record<string, unknown>;
  structured: string;
  notes?: string[];
}

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

async function readPdfSearchData(file: string): Promise<DocumentSearchData> {
  const loadingTask = getDocument({
    data: new Uint8Array(await readFile(file)),
  });
  const lines: string[] = [];
  let metadata: Record<string, unknown> = {};

  try {
    const document = await loadingTask.promise;
    const pdfMetadata = await document.getMetadata();
    const xmp = pdfMetadata.metadata ? Object.fromEntries(pdfMetadata.metadata) : undefined;
    metadata = {
      ...pdfMetadata.info,
      ...(xmp && Object.keys(xmp).length ? { XMP: xmp } : {}),
    };
    outlineText((await document.getOutline()) ?? [], lines);
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      try {
        for (const annotation of await page.getAnnotations({
          intent: 'display',
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

  return { metadata, structured: lines.join('\n') };
}

function noteText(note: string | { texts?: Array<{ text: string }> }): string {
  return typeof note === 'string' ? note : (note.texts ?? []).map(({ text }) => text).join('');
}

async function readExcelSearchData(file: string): Promise<DocumentSearchData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const metadata = {
    creator: workbook.creator,
    title: workbook.title,
    subject: workbook.subject,
    description: workbook.description,
    keywords: workbook.keywords,
    category: workbook.category,
    lastModifiedBy: workbook.lastModifiedBy,
    created: workbook.created,
    modified: workbook.modified,
    lastPrinted: workbook.lastPrinted,
    company: workbook.company,
    manager: workbook.manager,
    properties: workbook.properties,
  };
  const lines: string[] = [];

  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.formula) {
          lines.push(`Excel formula: ${worksheet.name}!${cell.address} = ${cell.formula}`);
        }
        if (cell.note) {
          const text = noteText(cell.note);
          if (text) {
            lines.push(`Excel comment: ${worksheet.name}!${cell.address} = ${text}`);
          }
        }
      });
    });
  }

  return { metadata, structured: lines.join('\n') };
}

export async function readDocumentSearchData(
  file: string,
  readMetadata: (file: string) => Promise<Record<string, unknown>>,
): Promise<DocumentSearchData> {
  const extension = extname(file).toLowerCase();
  if (extension === '.pdf') {
    try {
      return await readPdfSearchData(file);
    } catch {
      return {
        metadata: await readMetadata(file),
        structured: '',
        notes: ['PDF.js search failed; used ExifTool metadata fallback'],
      };
    }
  }
  if (EXCEL_EXTENSIONS.has(extension)) {
    try {
      return await readExcelSearchData(file);
    } catch {
      return {
        metadata: await readMetadata(file),
        structured: '',
        notes: ['ExcelJS search failed; used ExifTool metadata fallback'],
      };
    }
  }
  return { metadata: await readMetadata(file), structured: '' };
}

export async function readSearchExtras(file: string): Promise<string> {
  return (await readDocumentSearchData(file, async () => ({}))).structured;
}
