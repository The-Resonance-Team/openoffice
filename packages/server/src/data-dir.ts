import { join } from "node:path";
import { homedir } from "node:os";

export function getDataDir(): string {
  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg ?? join(homedir(), ".local", "share");
  return join(base, "openoffice");
}
