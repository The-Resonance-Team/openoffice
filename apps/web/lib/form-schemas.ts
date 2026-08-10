import { z } from 'zod';

// Daemon Basic-auth credentials. Both fields optional by design: a blank
// submission clears stored credentials (run without a password).
export const daemonCredentialsSchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type DaemonCredentials = z.infer<typeof daemonCredentialsSchema>;
