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
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") {
      if (value.startsWith("env:")) {
        const name = value.slice("env:".length);
        const resolved = env[name];
        if (resolved === undefined) {
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
    if (Array.isArray(value)) return value.map(walk);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, walk(v)])
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
