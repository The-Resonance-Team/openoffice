import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDataDir } from '../data-dir';

export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const REPO = 'The-Resonance-Team/openoffice';
const CHECK_TTL_MS = 24 * 60 * 60 * 1000;

export interface ReleaseInfo {
  tag: string;
  version: string;
  prerelease: boolean;
}

export interface UpdateStatus {
  check: boolean;
  available: boolean;
  version?: string;
  current?: string;
}

export type ParsedVersion = {
  core: [number, number, number];
  pre: string | null;
};

export function parseVersion(v: string): ParsedVersion | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim());
  if (!m) return null;
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ?? null,
  };
}

export function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] - b.core[i];
  }
  if (a.pre === b.pre) return 0;
  if (a.pre === null) return 1; // stable beats pre-release at same core
  if (b.pre === null) return -1;
  const pa = a.pre.split('.');
  const pb = b.pre.split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '';
    const y = pb[i] ?? '';
    if (x === y) continue;
    if (x === '') return -1;
    if (y === '') return 1;
    const xn = Number(x);
    const yn = Number(y);
    if (!Number.isNaN(xn) && !Number.isNaN(yn)) return xn - yn;
    return x < y ? -1 : 1;
  }
  return 0;
}

export function newestRelease(releases: ReleaseInfo[], current: string): ReleaseInfo | null {
  const cur = parseVersion(current);
  if (!cur) return null;
  let best: ReleaseInfo | null = null;
  for (const rel of releases) {
    const v = parseVersion(rel.tag);
    if (!v) continue;
    if (compareVersions(v, cur) <= 0) continue;
    if (!best || compareVersions(v, parseVersion(best.tag)!) > 0) best = rel;
  }
  return best;
}

export async function listReleases(fetchFn: FetchFn = fetch): Promise<ReleaseInfo[]> {
  const res = await fetchFn(`https://api.github.com/repos/${REPO}/releases?per_page=50`, {
    headers: { accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    throw new Error(`GitHub releases request failed: ${res.status}`);
  }
  const data = (await res.json()) as Array<{
    tag_name?: string;
    prerelease?: boolean;
  }>;
  return data
    .filter((r) => r.tag_name && parseVersion(r.tag_name))
    .map((r) => ({
      tag: r.tag_name!,
      version: r.tag_name!.replace(/^v/, ''),
      prerelease: r.prerelease ?? false,
    }));
}

export function artifactName(platform: string, arch: string): string {
  // bun types call it "windows", node calls it "win32" — the release
  // artifact name is openoffice-windows-x64.exe (matches build.yml).
  const os =
    platform === 'win32' || platform === 'windows'
      ? 'windows'
      : platform === 'darwin'
        ? 'darwin'
        : 'linux';
  const a = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : 'x64';
  const suffix = os === 'windows' ? '.exe' : '';
  return `openoffice-${os}-${a}${suffix}`;
}

/** The base (opencode fork) binary asset in the same release + SHA256SUMS. */
export function baseBinaryAssetName(platform: string, arch: string): string {
  const os =
    platform === 'win32' || platform === 'windows'
      ? 'windows'
      : platform === 'darwin'
        ? 'darwin'
        : 'linux';
  const a = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : 'x64';
  const suffix = os === 'windows' ? '.exe' : '';
  return `opencode-${os}-${a}${suffix}`;
}

export async function downloadAsset(
  tag: string,
  asset: string,
  fetchFn: FetchFn = fetch,
): Promise<Buffer> {
  const res = await fetchFn(`https://github.com/${REPO}/releases/download/${tag}/${asset}`);
  if (!res.ok) throw new Error(`download failed: ${res.status} (${asset})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function fetchChecksums(
  tag: string,
  fetchFn: FetchFn = fetch,
): Promise<Map<string, string>> {
  const res = await fetchFn(`https://github.com/${REPO}/releases/download/${tag}/SHA256SUMS`);
  if (!res.ok) return new Map();
  const text = await res.text();
  const map = new Map<string, string>();
  for (const line of text.split('\n')) {
    const m = /^([0-9a-f]{64})\s{2}(\S+)$/.exec(line.trim());
    if (m) map.set(m[2], m[1]);
  }
  return map;
}

export function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function verifySha256(data: Buffer, expected: string): boolean {
  return sha256(data) === expected.toLowerCase();
}

export function swapBinary(data: Buffer, binPath: string): string {
  // The base binary lives under <dataDir>/bin, which may not exist yet
  // (first update on an old install). swapBinary stays directory-agnostic.
  const dir = binPath.slice(0, Math.max(binPath.lastIndexOf('/'), binPath.lastIndexOf('\\')));
  if (dir) mkdirSync(dir, { recursive: true });
  writeFileSync(`${binPath}.new`, data, { mode: 0o755 });
  // First placement (no existing binary — e.g. the base engine on an old
  // install) has nothing to keep; only an existing file is renamed to .old.
  const oldPath = `${binPath}.old`;
  if (existsSync(oldPath)) rmSync(oldPath, { force: true });
  if (existsSync(binPath)) renameSync(binPath, oldPath);
  try {
    renameSync(`${binPath}.new`, binPath);
  } catch (e) {
    if (existsSync(oldPath)) renameSync(oldPath, binPath); // roll back
    throw e;
  }
  return oldPath;
}

function pendingMarkerPath(dataDir: string): string {
  return join(dataDir, 'update-pending.json');
}

/** The swapped-away binary stays as .old until the next run succeeds. */
export function cleanupPendingUpdate(dataDir = getDataDir()): void {
  try {
    const marker = pendingMarkerPath(dataDir);
    if (!existsSync(marker)) return;
    const { oldPath, baseOldPath } = JSON.parse(readFileSync(marker, 'utf-8')) as {
      oldPath?: string;
      baseOldPath?: string;
    };
    if (typeof oldPath === 'string' && existsSync(oldPath)) {
      rmSync(oldPath, { force: true });
    }
    if (typeof baseOldPath === 'string' && existsSync(baseOldPath)) {
      rmSync(baseOldPath, { force: true });
    }
    rmSync(marker, { force: true });
  } catch {
    // marker is best-effort housekeeping; never crash startup on it
  }
}

interface CheckCache {
  checkedAt: number;
  current: string;
  available: boolean;
  version?: string;
}

export function readCheckCache(dataDir: string): CheckCache | null {
  const path = join(dataDir, 'update-check.json');
  if (!existsSync(path)) return null;
  try {
    const c = JSON.parse(readFileSync(path, 'utf-8')) as CheckCache;
    if (typeof c.checkedAt !== 'number' || typeof c.current !== 'string') {
      return null;
    }
    return c;
  } catch {
    return null;
  }
}

export function writeCheckCache(dataDir: string, status: CheckCache): void {
  writeFileSync(
    join(dataDir, 'update-check.json'),
    JSON.stringify({ ...status, checkedAt: Date.now() }),
  );
}

export async function checkForUpdate(
  currentVersion: string,
  dataDir = getDataDir(),
  fetchFn: FetchFn = fetch,
): Promise<UpdateStatus> {
  const cached = readCheckCache(dataDir);
  // The cache is only valid for the version it was computed against — after
  // an upgrade the old "X available" result must not be served for 24h.
  if (cached && cached.current === currentVersion && Date.now() - cached.checkedAt < CHECK_TTL_MS) {
    return {
      check: true,
      available: cached.available,
      version: cached.version,
      current: currentVersion,
    };
  }
  const releases = await listReleases(fetchFn);
  const newest = newestRelease(releases, currentVersion);
  const status: UpdateStatus = {
    check: true,
    available: newest !== null,
    version: newest?.version,
    current: currentVersion,
  };
  writeCheckCache(dataDir, {
    checkedAt: Date.now(),
    current: currentVersion,
    available: status.available,
    version: status.version,
  });
  return status;
}

export async function performUpdate(
  currentVersion: string,
  binPath: string,
  dataDir = getDataDir(),
  fetchFn: FetchFn = fetch,
): Promise<
  | { status: 'up-to-date' }
  | { status: 'updated'; version: string }
  | { status: 'error'; error: string }
> {
  const releases = await listReleases(fetchFn);
  const newest = newestRelease(releases, currentVersion);
  if (!newest) return { status: 'up-to-date' };

  const asset = artifactName(process.platform, process.arch);
  const [data, checksums] = await Promise.all([
    downloadAsset(newest.tag, asset, fetchFn),
    fetchChecksums(newest.tag, fetchFn),
  ]);
  const expected = checksums.get(asset);
  if (!expected) {
    return { status: 'error', error: `no checksum published for ${asset}` };
  }
  if (!verifySha256(data, expected)) {
    return { status: 'error', error: `checksum mismatch for ${asset}` };
  }
  const oldPath = swapBinary(data, binPath);

  // The base engine binary rides the same release, pinned and checksum-
  // verified (ADR 0033). A missing or mismatched base artifact fails the
  // update — the daemon cannot run without it — and nothing is swapped.
  const baseAsset = baseBinaryAssetName(process.platform, process.arch);
  const [baseData, baseChecksums] = await Promise.all([
    downloadAsset(newest.tag, baseAsset, fetchFn),
    checksums.size > 0 ? Promise.resolve(checksums) : fetchChecksums(newest.tag, fetchFn),
  ]);
  const baseExpected = baseChecksums.get(baseAsset);
  if (!baseExpected) {
    return { status: 'error', error: `no checksum published for ${baseAsset}` };
  }
  if (!verifySha256(baseData, baseExpected)) {
    return { status: 'error', error: `checksum mismatch for ${baseAsset}` };
  }
  const baseBinPath = join(
    dataDir,
    'bin',
    process.platform === 'win32' ? 'opencode.exe' : 'opencode',
  );
  const baseOld = swapBinary(baseData, baseBinPath);

  writeFileSync(pendingMarkerPath(dataDir), JSON.stringify({ oldPath, baseOldPath: baseOld }));
  return { status: 'updated', version: newest.version };
}
