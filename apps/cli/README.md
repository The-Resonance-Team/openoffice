# OpenOffice

An LLM agent CLI that automates office document work — creating, reading, and
editing Word (.docx), Excel (.xlsx), and PowerPoint (.pptx) files through a
conversational agent with real document tooling.

- **Draft-first editing**: the agent edits a working draft; your real file is
  never touched until you accept the changes. Undo discards the draft, revert
  restores a previously accepted state through a new draft.
- **Daemon architecture**: `openoffice` auto-spawns a background daemon; the
  CLI attaches to it as a client. Sessions, drafts, and version history are
  local (SQLite + files under `~/.local/share/openoffice`).
- **Self-updating**: the daemon checks GitHub Releases (cached), and
  `openoffice update` replaces the installed binary after verifying its
  checksum.

## Installation

From npm (downloads the matching platform binary on install):

```sh
npm install -g openoffice
```

Or from a GitHub Release: download `openoffice-{os}-{arch}` for your platform
(macOS: `darwin-arm64`/`darwin-x64`, Linux: `linux-arm64`/`linux-x64`,
Windows: `win32-x64.exe`).

Requires the [officecli](https://d.officecli.ai/install.sh) document toolkit:

```sh
curl -fsSL https://d.officecli.ai/install.sh | bash
```

## Quick start

```sh
openoffice                # start an interactive chat session
```

Tell the agent what to do:

> Create report.docx with a paragraph that says "Q3 results are strong".

The agent edits a draft; you then accept or undo:

```text
openoffice (session: ...)
> Created draft of report.docx.
> accept /path/to/report.docx   (agent tells you the exact command)
```

## Commands

| Command                | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `openoffice`           | Interactive chat; auto-spawns the daemon |
| `openoffice serve`     | Run the daemon in the foreground         |
| `openoffice update`    | Check for and install a newer release    |
| `openoffice --version` | Print the version                        |
| `openoffice --help`    | Show usage                               |

See [docs/cli.md](docs/cli.md) for details.

## Configuration

`openoffice.json` in your project (or the global config) configures models,
providers, agents, MCP servers, and update behavior. See
[docs/config.md](docs/config.md).

## Updating

`openoffice update` checks GitHub Releases (stable and pre-release tags,
newest by semver wins), verifies the downloaded binary against the release's
SHA256SUMS, and swaps it in atomically, keeping the previous binary until the
next successful run. Disable checks with `"update": { "check": false }`.

## Troubleshooting

See [docs/troubleshooting.md](docs/troubleshooting.md).

## License

MIT — see [LICENSE](LICENSE).
