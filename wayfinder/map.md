# OpenOffice — Wayfinder Map

## Destination

A working openoffice desktop app where non-technical users chat with an agent to create/edit Word/Excel/PowerPoint documents, with auto-approve behind Edit Preview, Version History, and managed sign-in — built from scratch. "Managed sign-in" is the Cloud context (`cloud/CONTEXT.md`): a hosted account/org service so a non-technical member gets working LLM providers and skills because an admin configured them once, not because the member edited a config file.

## Notes

- Building from scratch, not forking opencode
- Reference opencode architecture for patterns, but keep it simple
- Single package until it hurts — no monorepo until needed
- CLI first, desktop later
- Office document focus from day one
- opencode source reference: `/Users/xirothedev/workspace/opencode/` (v1.18.9)

## Decisions so far

<!-- Index — one line per closed ticket -->

_(none yet — building from scratch)_

## Not yet specified

<!-- Fog of war -->

- Provider auth: reuse opencode's OAuth or build new?
- Database: SQLite or JSON files?
- Web UI: build one or TUI+desktop only?

## Out of scope

- 34-package monorepo (over-engineered for v1)
- Effect-TS everywhere (simpler abstractions)
- 20+ LLM providers (start with Anthropic/OpenAI/Google)
- Collaboration/multi-user

Reopened: "Cloud infrastructure" and "Enterprise features" were excluded above through the original build; both are now in scope via the Cloud context (org/team/role, cred proxy, cloud config, cloud skills, analytics) — see the Cloud wayfinder map issue and `cloud/CONTEXT.md`.

## Ticket inventory (20 tickets)

### Phase 1: Project Setup

- [101 Project Scaffolding](tickets/101-project-scaffolding.md) — task
- [102 Package Structure](tickets/102-package-structure.md) — grilling, blocked by 101

### Phase 2: Core Infrastructure

- [103 Config System](tickets/103-config-system.md) — task, blocked by 102
- [104 Event System](tickets/104-event-system.md) — task, blocked by 103

### Phase 3: LLM & Tools

- [105 LLM Provider Abstraction](tickets/105-llm-providers.md) — task, blocked by 103
- [106 Tool System](tickets/106-tool-system.md) — task, blocked by 105
- [107 Session Management](tickets/107-session-management.md) — task, blocked by 104+106

### Phase 4: Document Engine

- [108 officecli Tool](tickets/108-officecli-tool.md) — task, blocked by 106
- [109 Read-Only Tools](tickets/109-read-only-tools.md) — task, blocked by 106
- [110 MCP Integration](tickets/110-mcp-integration.md) — task, blocked by 106+103
- [111 Agent System](tickets/111-agent-system.md) — task, blocked by 107+109+110
- [112 officecli Skill](tickets/112-officecli-skill.md) — task, blocked by 111

### Phase 5: Features

- [113 Draft Lifecycle](tickets/113-draft-lifecycle.md) — task, blocked by 108+112
- [114 Edit Preview](tickets/114-edit-preview.md) — task, blocked by 113
- [115 Accept/Undo Routes](tickets/115-accept-undo.md) — task, blocked by 114
- [116 Version History](tickets/116-version-history.md) — task, blocked by 115

### Phase 6: UI

- [117 TUI](tickets/117-tui.md) — task, blocked by 116+111
- [118 Desktop App](tickets/118-desktop-app.md) — task, blocked by 117

### Phase 7: Polish

- [119 Testing Strategy](tickets/119-testing-strategy.md) — task, blocked by 116
- [120 Branding & Release](tickets/120-branding-release.md) — task, blocked by 118+119
