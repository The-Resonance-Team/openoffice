# Branding & Release

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocked by**: [Desktop App](118-desktop-app.md), [Testing Strategy](119-testing-strategy.md)
**Assignee**: _(unclaimed)_

## Question

Final branding, packaging, and release preparation.

### Branding

- App name: "OpenOffice" (or chosen name)
- CLI binary: `openoffice`
- Config file: `openoffice.json`
- Data directory: `~/.local/share/openoffice/`
- Protocol: `openoffice://`

### Packaging

**CLI binary**:
```bash
bun build src/index.ts --compile --outfile bin/openoffice
```

**Desktop app**:
```bash
bunx electron-builder  # builds DMG/NSIS/AppImage
```

### Release checklist

- [ ] All tests pass
- [ ] CLI binary builds for macOS/Linux/Windows
- [ ] Desktop app builds for macOS/Windows/Linux
- [ ] README written
- [ ] LICENSE chosen
- [ ] npm package ready (if publishing CLI)
- [ ] GitHub release created

### Documentation

- README.md: installation, usage, configuration
- CLI help: `openoffice --help`
- Config reference: `openoffice.json` schema

### Reference

- opencode release: `script/publish.ts`
- opencode CLI build: `packages/opencode/script/build.ts` (12 targets)
