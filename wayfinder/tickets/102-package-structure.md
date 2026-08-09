# Package Structure

**Type**: grilling
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Config System](103-config-system.md)
**Blocked by**: [Project Scaffolding](101-project-scaffolding.md)
**Assignee**: _(unclaimed)_

## Question

How should the codebase be organized? opencode has34 packages — that's over-engineered for a from-scratch build.

### Options

**A. Single package (start here)**
```
openoffice/
  src/
    config/       — configuration loading
    llm/          — LLM provider abstraction
    tool/         — tool definitions and execution
    agent/        — agent management
    session/      — conversation/session state
    mcp/          — MCP client
    tui/          — terminal UI
    desktop/      — electron wrapper (later)
    office/       — officecli integration
    ui/           — shared UI components
```
Pros: Simple, fast to iterate, no build complexity.
Cons: Gets messy at ~10K lines.

**B. Monorepo from day one**
```
openoffice/
  packages/
    core/         — config, events, database
    llm/          — LLM abstraction
    tool/         — tool system
    agent/        — agent management
    session/      — session state
    mcp/          — MCP client
    ui/           — shared components
    tui/          — terminal app
    desktop/      — electron app
```
Pros: Clean separation, each package independently testable.
Cons: Build complexity, package linking, version management.

**C. Hybrid — core + apps**
```
openoffice/
  packages/
    core/         — everything except UI
    tui/          — terminal app
    desktop/      — electron app
```
Pros: Core is reusable, apps are thin shells.
Cons: Core becomes a god package.

### My recommendation

Start with **A (single package)**. The decision is reversible — extracting a package is a mechanical refactor. opencode's 34 packages exist because it grew organically over years; starting there is cargo-culting.

When does single package break? ~15-20K lines, or when you need independent testing/deployment of sub-systems. That's a future problem.

### Decision needed

Which structure? This shapes every subsequent ticket.
