# OpenOffice Desktop

GUI desktop client for the [openoffice](../..) daemon — an LLM agent for office
document work (Word, Excel, PowerPoint). Built with Tauri v2 + React.

The app bundles the openoffice daemon as a sidecar binary and spawns it on
launch (reusing an already-running daemon, CLI parity). The React UI talks to
the daemon over its local HTTP/SSE API with Basic auth passthrough.

## Prerequisites

- Rust toolchain (rustup, stable)
- The platform daemon binary in `src-tauri/binaries/`:

```sh
# from the repo root — builds for your current platform
bun build --compile src/index.ts --outfile apps/desktop/src-tauri/binaries/openoffice-aarch64-apple-darwin
```

Name the binary `openoffice-<target-triple>` (e.g. `openoffice-x86_64-pc-windows-msvc.exe`,
`openoffice-x86_64-unknown-linux-gnu`). `binaries/` is gitignored.

## Development

```sh
bun install
bun run tauri dev        # hot-reload dev window
bun run typecheck        # tsgo
bun run lint             # oxlint
cargo clippy             # from src-tauri/
```

## Build

```sh
bun run tauri build      # .app/.dmg on macOS, installers per platform
```
