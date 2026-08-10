/** Stable error-message extraction — the one place `err.message` is reached into. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
