import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkill, listSkills, type Skill } from "@openoffice/core";
import { createSkillTool } from "@openoffice/core";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "openoffice-test-"));
}

describe("loadSkill", () => {
  test("parses frontmatter and body", () => {
    const dir = tempDir();
    const skillsDir = join(dir, "skills", "test-skill");
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(
      join(skillsDir, "SKILL.md"),
      `---
name: test-skill
description: A test skill
---
# Test Skill

This is the skill content.`
    );

    const skill = loadSkill(join(dir, "skills"), "test-skill");
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("test-skill");
    expect(skill!.description).toBe("A test skill");
    expect(skill!.content).toContain("# Test Skill");
    expect(skill!.content).toContain("This is the skill content.");
  });

  test("returns null for missing skill", () => {
    const dir = tempDir();
    mkdirSync(join(dir, "skills"), { recursive: true });
    const skill = loadSkill(join(dir, "skills"), "nonexistent");
    expect(skill).toBeNull();
  });

  test("returns null for malformed frontmatter", () => {
    const dir = tempDir();
    const skillsDir = join(dir, "skills", "bad");
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, "SKILL.md"), "No frontmatter here");

    const skill = loadSkill(join(dir, "skills"), "bad");
    expect(skill).toBeNull();
  });

  test("uses name fallback from directory", () => {
    const dir = tempDir();
    const skillsDir = join(dir, "skills", "my-skill");
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(
      join(skillsDir, "SKILL.md"),
      `---
description: Has description but no name
---
Content here`
    );

    const skill = loadSkill(join(dir, "skills"), "my-skill");
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe("my-skill");
  });
});

describe("listSkills", () => {
  test("lists all skills in directory", () => {
    const dir = tempDir();
    const skillsDir = join(dir, "skills");
    mkdirSync(join(skillsDir, "alpha"), { recursive: true });
    mkdirSync(join(skillsDir, "beta"), { recursive: true });
    writeFileSync(
      join(skillsDir, "alpha", "SKILL.md"),
      `---
name: alpha
description: Alpha skill
---
Alpha content`
    );
    writeFileSync(
      join(skillsDir, "beta", "SKILL.md"),
      `---
name: beta
description: Beta skill
---
Beta content`
    );

    const skills = listSkills(skillsDir);
    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.name).sort()).toEqual(["alpha", "beta"]);
  });

  test("skips directories without SKILL.md", () => {
    const dir = tempDir();
    const skillsDir = join(dir, "skills");
    mkdirSync(join(skillsDir, "valid"), { recursive: true });
    mkdirSync(join(skillsDir, "empty"), { recursive: true });
    writeFileSync(
      join(skillsDir, "valid", "SKILL.md"),
      `---
name: valid
---
Content`
    );

    const skills = listSkills(skillsDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("valid");
  });

  test("returns empty array for nonexistent directory", () => {
    const skills = listSkills("/nonexistent/path");
    expect(skills).toEqual([]);
  });
});

describe("formatSkillList", () => {
  test("formats skills as XML", () => {
    const { formatSkillList } = require("@openoffice/core");
    const skills: Skill[] = [
      { name: "officecli", description: "Office document tool", content: "" },
      { name: "firecrawl", description: "Web scraping", content: "" },
    ];
    const xml = formatSkillList(skills);
    expect(xml).toContain("<available_skills>");
    expect(xml).toContain("<name>officecli</name>");
    expect(xml).toContain("<description>Office document tool</description>");
    expect(xml).toContain("</available_skills>");
  });
});

describe("skill tool", () => {
  function makeSkillsDir(): string {
    const dir = tempDir();
    const skillDir = join(dir, "skills", "demo");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      `---
name: demo
description: Demo skill
---
# Demo content`
    );
    return join(dir, "skills");
  }

  test("loads a skill and wraps content", async () => {
    const tool = createSkillTool(makeSkillsDir());
    const result = await tool.execute({ name: "demo" }, { sessionID: "test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toContain('<skill_content name="demo">');
      expect(result.output).toContain("# Demo content");
    }
  });

  test("returns SKILL_NOT_FOUND for unknown skill", async () => {
    const tool = createSkillTool(makeSkillsDir());
    const result = await tool.execute(
      { name: "missing" },
      { sessionID: "test" }
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("SKILL_NOT_FOUND");
      expect(result.error).toContain('"missing"');
    }
  });
});
