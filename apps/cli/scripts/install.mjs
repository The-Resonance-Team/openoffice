#!/usr/bin/env node
// npm postinstall: download the platform binary for the published version from
// GitHub Releases and verify it against the release's SHA256SUMS before saving.
// Skips local (non-global) installs — the repo is built with bun, not npm.
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.npm_config_global) {
  process.exit(0);
}

const REPO = 'The-Resonance-Team/openoffice';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const pkg = JSON.parse(
  await (await import('node:fs/promises')).readFile(join(root, 'package.json'), 'utf-8'),
);
const version = process.env.npm_package_version ?? pkg.version;
const tag = `v${version}`;

function artifactName() {
  const os =
    process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'darwin' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return `openoffice-${os}-${arch}${os === 'win32' ? '.exe' : ''}`;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const asset = artifactName();
  const binDir = join(root, 'bin');
  const binPath = join(binDir, asset);
  const metaPath = join(binDir, '.binary-path.json');

  // Skip only when the binary for THIS version is already installed — the
  // filename alone cannot tell 0.1.0 from 0.2.0.
  let installedVersion = null;
  try {
    installedVersion = JSON.parse(
      await (await import('node:fs/promises')).readFile(metaPath, 'utf-8'),
    ).version;
  } catch {
    // no prior install record
  }
  if (existsSync(binPath) && installedVersion === version) {
    process.exit(0);
  }
  mkdirSync(binDir, { recursive: true });

  const [data, sumsText] = await Promise.all([
    download(`https://github.com/${REPO}/releases/download/${tag}/${asset}`),
    download(`https://github.com/${REPO}/releases/download/${tag}/SHA256SUMS`),
  ]);

  const expected = sumsText
    .toString('utf-8')
    .split('\n')
    .map((l) => /^([0-9a-f]{64})\s{2}(\S+)$/.exec(l.trim()))
    .filter(Boolean)
    .find((m) => m[2] === asset)?.[1];
  if (!expected) {
    throw new Error(`openoffice ${tag}: no checksum published for ${asset}`);
  }
  const actual = createHash('sha256').update(data).digest('hex');
  if (actual !== expected) {
    throw new Error(`openoffice ${tag}: checksum mismatch for ${asset}`);
  }

  writeFileSync(binPath, data);
  if (process.platform !== 'win32') chmodSync(binPath, 0o755);
  writeFileSync(metaPath, JSON.stringify({ path: binPath, version }));
}

main().catch((e) => {
  console.error(`openoffice postinstall failed: ${e.message}`);
  console.error(
    `The binary for ${tag} could not be installed. Reinstall with npm install -g openoffice once the release exists.`,
  );
  process.exit(1);
});
