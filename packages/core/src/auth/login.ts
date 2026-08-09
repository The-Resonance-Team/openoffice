import { createInterface } from 'node:readline';
import type { ApiCredential, CredentialStore } from './store';

// ponytail: every provider is prompted for an API key in v1 — none of the
// pinned @ai-sdk providers implement OAuth. The store already accepts
// OAuth-shaped credentials; the one-shot callback listener lands with SDK
// OAuth support (anthropic's SDK can already send `authToken` as Bearer).
export async function login(store: CredentialStore, provider: string): Promise<ApiCredential> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await new Promise<string>((resolve) => {
    rl.question(`Paste your ${provider} API key (input is visible):\n> `, resolve);
  });
  rl.close();
  const key = answer.trim();
  if (!key) throw new Error('No key entered — login aborted.');
  const credential: ApiCredential = { type: 'api', key };
  store.set(provider, credential);
  return credential;
}
