import type { Ruleset } from './permission';

export interface Agent {
  name: string;
  description: string;
  system: string;
  permission: Ruleset;
  model?: string;
}
