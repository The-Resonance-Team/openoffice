export type Action = "allow" | "deny";

export interface Rule {
  tool: string;
  action: Action;
}

export type Ruleset = Rule[];

// ponytail: last-write-wins — later rules override earlier ones.
// This is intentional: wildcard deny + specific allow = allow for that tool.
export function evaluate(toolName: string, rules: Ruleset): Action {
  let result: Action = "allow";
  for (const rule of rules) {
    if (rule.tool === "*" || rule.tool === toolName) {
      result = rule.action;
    }
  }
  return result;
}

export function fromConfig(tools: string[] | undefined): Ruleset {
  if (!tools) return [];
  if (tools.length === 0) return [{ tool: "*", action: "deny" }];
  return [
    { tool: "*", action: "deny" },
    ...tools.map((t) => ({ tool: t, action: "allow" as const })),
  ];
}

export function merge(...rulesets: Ruleset[]): Ruleset {
  return rulesets.flat();
}
