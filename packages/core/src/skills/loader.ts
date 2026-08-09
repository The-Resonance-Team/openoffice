import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface Skill {
  name: string;
  description: string;
  content: string;
}

export function loadSkill(skillsDir: string, name: string): Skill | null {
  const skillPath = join(skillsDir, name, 'SKILL.md');
  if (!existsSync(skillPath)) return null;

  const raw = readFileSync(skillPath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    frontmatter[key] = value;
  }

  return {
    name: frontmatter.name || name,
    description: frontmatter.description || '',
    content: match[2],
  };
}

export function listSkills(skillsDir: string): Skill[] {
  if (!existsSync(skillsDir)) return [];

  const skills: Skill[] = [];
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skill = loadSkill(skillsDir, entry.name);
    if (skill) skills.push(skill);
  }
  return skills;
}

export function formatSkillList(skills: Skill[]): string {
  if (skills.length === 0) return '';
  const items = skills
    .map(
      (s) =>
        `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n  </skill>`,
    )
    .join('\n');
  return `<available_skills>\n${items}\n</available_skills>`;
}
