# Project Scaffolding

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Package Structure](102-package-structure.md)
**Blocked by**: _(none — frontier)_
**Assignee**: _(unclaimed)_

## Question

Initialize the openoffice project from scratch. Single package first, split later if needed.

### What to create

```bash
mkdir -p openoffice
cd openoffice
git init
```

### Root `package.json`

```json
{
  "name": "openoffice",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.3.14",
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "bun build src/index.ts --compile --outfile bin/openoffice",
    "typecheck": "tsgo --noEmit",
    "lint": "oxlint src/",
    "test": "bun test"
  }
}
```

### Root `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "lib": ["ESNext", "DOM"]
  },
  "include": ["src/**/*"]
}
```

### Tooling

- **Runtime**: Bun (fast, native TypeScript)
- **Type checker**: tsgo (native TypeScript preview)
- **Linter**: oxlint (fast Rust-based linter)
- **Formatter**: prettier
- **Test runner**: bun test

### What NOT to create yet

- No monorepo structure (single package until it hurts)
- No Electron (CLI first, desktop later)
- No database (file-based config until complexity demands DB)
- No CI/CD (local dev until there's something to ship)

### Reference

- opencode root: `/Users/xirothedev/workspace/opencode/package.json`
- opencode uses Bun + Turborepo + tsgo + oxlint
