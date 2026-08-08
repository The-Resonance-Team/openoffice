import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildSystemPrompt } from "../system";
import type { Agent } from "../../agent";

const agent: Agent = {
  name: "test",
  description: "Test agent",
  system: "You are a test agent.",
  permission: [],
};

describe("buildSystemPrompt", () => {
  test("includes agent system and environment context", () => {
    const prompt = buildSystemPrompt({ agent, cwd: "/work" });
    expect(prompt).toContain("You are a test agent.");
    expect(prompt).toContain("Working directory: /work");
    expect(prompt).toContain("Date:");
  });

  test("defaults cwd to process.cwd()", () => {
    const prompt = buildSystemPrompt({ agent });
    expect(prompt).toContain(`Working directory: ${process.cwd()}`);
  });

  test("appends skills section when skillsDir has skills", () => {
    const dir = mkdtempSync(join(tmpdir(), "oo-skills-"));
    const skillDir = join(dir, "demo");
    mkdirSync(skillDir);
    writeFileSync(
      join(skillDir, "SKILL.md"),
      "---\nname: demo\ndescription: A demo skill\n---\n# Demo\n"
    );

    const prompt = buildSystemPrompt({ agent, skillsDir: dir });
    expect(prompt).toContain("Skills provide specialized instructions");
    expect(prompt).toContain("demo");

    // cleanup
    rmSync(dir, { recursive: true, force: true });
  });

  test("omits skills section when no skills found", () => {
    const dir = mkdtempSync(join(tmpdir(), "oo-skills-empty-"));
    const prompt = buildSystemPrompt({ agent, skillsDir: dir });
    expect(prompt).not.toContain("Skills provide specialized instructions");
    rmSync(dir, { recursive: true, force: true });
  });

  test("appends mcp instructions when servers are connected", () => {
    const mcp = {
      status: () => ({ filesystem: { status: "connected" } }),
    };
    const prompt = buildSystemPrompt({ agent, mcp: mcp as any });
    expect(prompt).toContain('<server name="filesystem">');
  });

  test("omits non-connected servers from mcp instructions", () => {
    const mcp = {
      status: () => ({
        filesystem: { status: "connected" },
        broken: { status: "error", error: "down" },
        off: { status: "disabled" },
      }),
    };
    const prompt = buildSystemPrompt({ agent, mcp: mcp as any });
    expect(prompt).toContain('<server name="filesystem">');
    expect(prompt).not.toContain('name="broken"');
    expect(prompt).not.toContain('name="off"');
  });

  test("omits mcp section when no servers connected", () => {
    const mcp = { status: () => ({}) };
    const prompt = buildSystemPrompt({ agent, mcp: mcp as any });
    expect(prompt).not.toContain("mcp_instructions");
  });
});
