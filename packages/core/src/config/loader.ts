import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { ConfigSchema, type Config } from './schema';

export function stripJsonc(text: string): string {
  return stripTrailingCommas(stripComments(text));
}

function stripComments(text: string): string {
  let out = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inLineComment) {
      if (c === '\n') {
        inLineComment = false;
        out += c;
      }
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (c === '\\') {
        if (next !== undefined) out += next;
        i++;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

function stripTrailingCommas(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === '\\') {
        if (text[i + 1] !== undefined) out += text[i + 1]!;
        i++;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j]!)) j++;
      if (text[j] === '}' || text[j] === ']') continue;
    }
    out += c;
  }
  return out;
}

export function parseConfigFile(path: string): unknown {
  const text = readFileSync(path, 'utf8');
  try {
    return JSON.parse(stripJsonc(text));
  } catch (err) {
    throw new Error(`invalid config ${path}: ${(err as Error).message}`, { cause: err });
  }
}

export function findProjectConfig(startDir: string): string | null {
  let dir = resolve(startDir);
  for (;;) {
    for (const name of ['openoffice.json', 'openoffice.jsonc']) {
      const path = join(dir, name);
      if (existsSync(path)) return path;
    }
    const parent = dirname(dir);
    if (parent === dir || existsSync(join(dir, '.git'))) return null;
    dir = parent;
  }
}

export function loadConfigFiles(globalPath: string | null, projectPath: string | null): Config[] {
  const layers: Config[] = [];
  for (const path of [globalPath, projectPath]) {
    if (!path || !existsSync(path)) continue;
    try {
      layers.push(ConfigSchema.parse(parseConfigFile(path)));
    } catch (err) {
      throw new Error(`invalid config ${path}: ${(err as Error).message}`, { cause: err });
    }
  }
  return layers;
}

export function mergeLayers(layers: Config[]): Config {
  const out: Record<string, unknown> = {};
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      const prev = out[key];
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        prev !== null &&
        typeof prev === 'object' &&
        !Array.isArray(prev)
      ) {
        out[key] = { ...(prev as object), ...(value as object) };
      } else {
        out[key] = value;
      }
    }
  }
  return out as Config;
}

export function applyEnvOverrides(config: Config, env: Record<string, string | undefined>): Config {
  const out: Record<string, unknown> = { ...config };
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('OPENOFFICE_') || value === undefined) continue;
    const name = key
      .slice('OPENOFFICE_'.length)
      .toLowerCase()
      .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const field = ConfigSchema.shape[name as keyof typeof ConfigSchema.shape];
    if (field === undefined) continue;
    const inner = field instanceof z.ZodOptional ? field.unwrap() : field;
    if (inner instanceof z.ZodString) out[name] = value;
  }
  return out as Config;
}
