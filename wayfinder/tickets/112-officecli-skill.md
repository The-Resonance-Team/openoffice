# officecli Skill

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Draft Lifecycle](113-draft-lifecycle.md)
**Blocked by**: [Agent System](111-agent-system.md)
**Assignee**: _(unclaimed)_

## Question

Port the officecli skill into openoffice so the LLM knows how to use officecli effectively.

### What the skill provides

The officecli skill is417 lines of markdown that teaches the LLM:

- All officecli commands and their parameters
- DOM path syntax for navigating documents
- Batch operation syntax
- Error handling patterns
- Best practices for document manipulation

### Implementation

**Skill loading**:

```ts
interface Skill {
  name: string;
  description: string;
  content: string;
}

function loadSkill(name: string): Skill | null {
  // For v1: inline skill content or load from file
  const skillPath = path.join(__dirname, `skills/${name}.md`);
  if (!fs.existsSync(skillPath)) return null;

  const raw = fs.readFileSync(skillPath, 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = Object.fromEntries(
    match[1].split('\n').map((line) => {
      const [key, ...value] = line.split(':');
      return [key.trim(), value.join(':').trim()];
    }),
  );

  return {
    name: frontmatter.name || name,
    description: frontmatter.description || '',
    content: match[2],
  };
}
```

**Skill injection into system prompt**:

```ts
function getSystemPrompt(agent: Agent): string {
  const parts = [agent.system];

  if (agent.tools.includes('skill')) {
    const skill = loadSkill('officecli');
    if (skill) {
      parts.push(`\n\n## officecli Skill\n\n${skill.content}`);
    }
  }

  return parts.join('\n');
}
```

### Skill file location

`skills/officecli.md`:

```markdown
---
name: officecli
description: Create, read, and edit Word/Excel/PowerPoint documents via officecli CLI
---

# officecli Skill

## Commands

### get — Read a property

...

### set — Set a property

...

[rest of the 417-line skill content]
```

### Reference

- Source: `~/.claude/skills/officecli/SKILL.md` (417 lines)
- opencode skill system: `packages/opencode/src/skill/index.ts`
- opencode bundled skills: `packages/core/src/plugin/skill.ts`
