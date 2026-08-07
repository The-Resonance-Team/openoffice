import { describe, expect, test } from "bun:test";
import { parse } from "bun:yaml";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Job = { "timeout-minutes"?: number };
type Workflow = {
  jobs?: Record<string, Job>;
  permissions?: { contents?: string };
  concurrency?: { group?: string; "cancel-in-progress"?: boolean };
  on?: Record<string, unknown>;
};

const DIR = join(import.meta.dir, "../../../.github/workflows");
const workflowFiles = readdirSync(DIR).filter((f) => f.endsWith(".yml"));

const EXPECTED_TIMEOUTS: Record<string, Record<string, number>> = {
  "ci.yml": {
    typecheck: 10,
    lint: 10,
    unit: 15,
    coverage: 15,
    e2e: 20,
    "build-web": 10,
  },
  "build.yml": { "build-release": 60 },
  "release.yml": { release: 10 },
  "opencode.yml": { review: 20, comment: 20 },
  "triage.yml": { triage: 5 },
};

function raw(file: string): string {
  return readFileSync(`${DIR}/${file}`, "utf8");
}

function workflow(file: string): Workflow {
  return parse(raw(file)) as Workflow;
}

describe("CI contract", () => {
  test("every job has the agreed timeout-minutes budget", () => {
    for (const [file, budgets] of Object.entries(EXPECTED_TIMEOUTS)) {
      const jobs = workflow(file).jobs ?? {};
      for (const [name, budget] of Object.entries(budgets)) {
        expect(jobs[name]?.["timeout-minutes"], `${file}:${name}`).toBe(budget);
      }
    }
  });

  test("the timeout budget map covers every workflow job", () => {
    for (const file of workflowFiles) {
      const jobs = workflow(file).jobs ?? {};
      expect(Object.keys(jobs).length, file).toBeGreaterThan(0);
      for (const name of Object.keys(jobs)) {
        expect(
          EXPECTED_TIMEOUTS[file]?.[name],
          `${file}:${name}`
        ).toBeDefined();
      }
    }
  });

  test("ci.yml grants the minimum workflow permission (contents: read)", () => {
    expect(workflow("ci.yml").permissions?.contents).toBe("read");
  });

  test("release.yml serializes releases (no cancel) and hands off to build.yml via workflow_dispatch", () => {
    const concurrency = workflow("release.yml").concurrency;
    expect(concurrency?.group).toBeTruthy();
    expect(concurrency?.["cancel-in-progress"]).not.toBe(true);
    expect(raw("release.yml")).toContain("gh workflow run build.yml");
  });

  test("build.yml is dispatchable and derives the version from the dispatch input or tag ref", () => {
    expect(workflow("build.yml").on?.workflow_dispatch).toBeTruthy();
    const text = raw("build.yml");
    expect(text).toContain("inputs.version");
    expect(text).toContain("github.ref_name");
  });

  test("actions/checkout is pinned to a single major version across workflows", () => {
    const majors = workflowFiles
      .map((f) => raw(f).match(/actions\/checkout@v(\d+)/)?.[1])
      .filter(Boolean);
    expect(majors.length).toBeGreaterThan(0);
    expect(new Set(majors).size).toBe(1);
  });
});
