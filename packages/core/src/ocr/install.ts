import { execFileSync } from 'node:child_process';

let pdftoppmCache: boolean | null = null;

export async function checkPdftoppm(): Promise<boolean> {
  if (pdftoppmCache !== null) return pdftoppmCache;
  try {
    execFileSync('pdftoppm', ['-v'], {
      timeout: 5000,
      stdio: 'pipe',
    });
    pdftoppmCache = true;
  } catch {
    pdftoppmCache = false;
  }
  return pdftoppmCache;
}

export function resetCache(): void {
  pdftoppmCache = null;
}
