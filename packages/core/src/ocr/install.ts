import { execFileSync } from "node:child_process";

let tesseractCache: boolean | null = null;
let pdftoppmCache: boolean | null = null;

export async function checkTesseract(): Promise<boolean> {
  if (tesseractCache !== null) return tesseractCache;
  try {
    execFileSync("tesseract", ["--version"], {
      timeout: 5000,
      stdio: "pipe",
    });
    tesseractCache = true;
  } catch {
    tesseractCache = false;
  }
  return tesseractCache;
}

export async function checkPdftoppm(): Promise<boolean> {
  if (pdftoppmCache !== null) return pdftoppmCache;
  try {
    execFileSync("pdftoppm", ["-v"], {
      timeout: 5000,
      stdio: "pipe",
    });
    pdftoppmCache = true;
  } catch {
    pdftoppmCache = false;
  }
  return pdftoppmCache;
}

export function resetCache(): void {
  tesseractCache = null;
  pdftoppmCache = null;
}
