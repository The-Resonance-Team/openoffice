import { execFileSync } from "node:child_process";

let cached: boolean | null = null;

export async function checkInstalled(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    execFileSync("officecli", ["--version"], {
      timeout: 5000,
      stdio: "pipe",
    });
    cached = true;
  } catch {
    cached = false;
  }
  return cached;
}

export function resetCache(): void {
  cached = null;
}
