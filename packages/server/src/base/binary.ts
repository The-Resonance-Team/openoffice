import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Vendored base binary location (ADR 0033): the update machinery swaps
// `opencode-<os>-<arch>` into <dataDir>/bin/opencode with a checksum check.
export function vendoredBaseBinaryPath(dataDir: string): string {
  return join(dataDir, 'bin', process.platform === 'win32' ? 'opencode.exe' : 'opencode');
}

/**
 * Resolves the base binary the daemon spawns, in order:
 * 1. OPENOFFICE_OPENCODE_BIN (explicit override — dev, tests, custom installs)
 * 2. the vendored binary at <dataDir>/bin/opencode (Update-managed, ADR 0033)
 * 3. `opencode` on PATH (last resort)
 * Fail-fast with a clear message: a daemon without the base is dead on arrival,
 * and a silent PATH fallback would mask a broken vendoring.
 */
export function resolveBaseBinary(dataDir: string): string {
  const explicit = process.env.OPENOFFICE_OPENCODE_BIN;
  if (explicit) return explicit;
  const vendored = vendoredBaseBinaryPath(dataDir);
  if (existsSync(vendored)) return vendored;
  return 'opencode';
}
