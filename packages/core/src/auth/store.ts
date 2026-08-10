import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type ApiCredential = { type: 'api'; key: string };
export type OAuthCredential = {
  type: 'oauth';
  access: string;
  refresh?: string;
  expires?: number;
};
export type Credential = ApiCredential | OAuthCredential;

export function authFilePath(): string {
  return join(homedir(), '.local', 'share', 'openoffice', 'auth.json');
}

const CORRUPT_MESSAGE =
  'credentials file is corrupt — fix or delete it before running auth commands';

export class CredentialStore {
  constructor(private readonly filePath: string = authFilePath()) {}

  get(provider: string): Credential | undefined {
    return this.readAll()[provider];
  }

  set(provider: string, credential: Credential): void {
    const all = this.readAll();
    all[provider] = credential;
    this.writeAll(all);
  }

  remove(provider: string): boolean {
    const all = this.readAll();
    if (!(provider in all)) return false;
    delete all[provider];
    this.writeAll(all);
    return true;
  }

  list(): string[] {
    return Object.keys(this.readAll());
  }

  private readAll(): Record<string, Credential> {
    let raw: string;
    try {
      raw = readFileSync(this.filePath, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw err;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`${this.filePath}: ${CORRUPT_MESSAGE}`);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${this.filePath}: ${CORRUPT_MESSAGE}`);
    }
    return parsed as Record<string, Credential>;
  }

  private writeAll(all: Record<string, Credential>): void {
    const dir = dirname(this.filePath);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(all, null, 2)}\n`, { mode: 0o600 });
    renameSync(tmp, this.filePath);
    chmodSync(this.filePath, 0o600);
  }
}
