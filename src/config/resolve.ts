import { homedir } from "node:os";
import { join } from "node:path";
import type { Config } from "./schema";
import { ConfigSchema } from "./schema";
import {
  applyEnvOverrides,
  findProjectConfig,
  loadConfigFiles,
  mergeLayers,
} from "./loader";

export function resolveRefs(
  config: Config,
  env: Record<string, string | undefined>
): Config {
  const walk = (value: unknown, path: string[] = []): unknown => {
    if (typeof value === "string") {
      if (value.startsWith("env:")) {
        const name = value.slice("env:".length);
        const resolved = env[name];
        if (resolved === undefined) {
          if (
            path[0] === "provider" &&
            path[2] === "apiKey" &&
            path.length === 3
          ) {
            return undefined; // a stored credential (src/auth) may supply it
          }
          throw new Error(
            `config references env:${name} but ${name} is not set`
          );
        }
        return resolved;
      }
      if (value.startsWith("~/"))
        return join(homedir(), value.slice("~/".length));
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((v, i) => walk(v, [...path, String(i)]));
    }
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, walk(v, [...path, k])])
      );
    }
    return value;
  };
  return ConfigSchema.parse(walk(config));
}

export interface ResolveOptions {
  globalPath?: string;
  projectPath?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export function resolveConfig(options: ResolveOptions = {}): Config {
  const env = options.env ?? process.env;
  const globalPath =
    options.globalPath ??
    join(homedir(), ".config", "openoffice", "config.json");
  const cwd = options.cwd ?? process.cwd();
  const projectPath = options.projectPath ?? findProjectConfig(cwd);
  const layers = loadConfigFiles(globalPath, projectPath);
  const merged = mergeLayers([{}, ...layers]);
  return resolveRefs(applyEnvOverrides(merged, env), env);
}

/** Collect all resolved `env:` values from a raw config (before resolution). */
export function collectEnvValues(
  config: unknown,
  env: Record<string, string | undefined>
): Set<string> {
  const values = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === "string" && value.startsWith("env:")) {
      const name = value.slice("env:".length);
      const resolved = env[name];
      if (resolved !== undefined && resolved.length >= 8) {
        values.add(resolved);
      }
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value !== null && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(config);
  return values;
}
