import { execFileSync } from "node:child_process";
import {
  createOfficeCliTool,
  isMutating,
  parseError,
  type OfficeCliDeps,
} from "./tool";
import { checkInstalled, resetCache } from "./install";

export { isMutating, parseError, checkInstalled, resetCache };
export { createOfficeCliTool };
export type { OfficeCliDeps } from "./tool";

export function createDefaultOfficeCliTool(
  extraDeps: Partial<OfficeCliDeps> = {}
) {
  return createOfficeCliTool({
    checkInstalled,
    execCli: (args, opts) => {
      const output = execFileSync("officecli", args, {
        timeout: opts?.timeout ?? 30000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return Promise.resolve(output);
    },
    ...extraDeps,
  });
}
