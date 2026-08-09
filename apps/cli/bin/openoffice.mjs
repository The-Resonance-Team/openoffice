#!/usr/bin/env node
// npm bin shim: spawn the platform binary recorded by postinstall.
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const metaPath = join(here, '.binary-path.json');
if (!existsSync(metaPath)) {
  console.error('openoffice binary is missing. Reinstall: npm install -g openoffice');
  process.exit(1);
}
const { path } = JSON.parse(readFileSync(metaPath, 'utf-8'));
const result = spawnSync(path, process.argv.slice(2), { stdio: 'inherit' });
process.exit(result.status ?? 1);
