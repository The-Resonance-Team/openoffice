# Configuration reference

`openoffice` loads typed configuration from layered sources, merged in order
(later wins):

1. Defaults
2. Global config: `~/.config/openoffice/openoffice.json` (or `openoffice.json`/`openoffice.jsonc` next to the config dir per XDG)
3. Project config: `openoffice.json` / `openoffice.jsonc` found by walking up from the working directory
4. Environment variable overrides and `env:` references (see below)

The file is JSON or JSONC (comments and trailing commas allowed).

## Example

```jsonc
{
  "model": "anthropic/claude-sonnet-4-20250514",
  "provider": {
    "anthropic": { "apiKey": "env:ANTHROPIC_API_KEY" },
  },
  "agent": {
    "default": {
      "description": "My agent",
      "tools": ["officecli", "read", "write"],
    },
  },
  "mcp": {
    "docs": { "type": "remote", "url": "https://example.com/mcp" },
  },
  "office": {
    "managedDocumentsFolder": "~/Documents/Managed",
  },
  "update": { "check": true },
}
```

## Keys

### `model`

The default model for new sessions, in `provider/model-id` format, e.g.
`anthropic/claude-sonnet-4-20250514`. Resolution order: the agent's model
override, then this default, then the provider's default.

### `provider`

Providers map a name to credentials. Named providers are `openai`,
`anthropic`, and `google`.

| Key       | Type   | Description                                                                                                            |
| --------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| `apiKey`  | string | The API key, or an `env:VAR_NAME` reference resolved at load time                                                      |
| `baseURL` | string | (openai only) Custom endpoint — e.g. a proxy or local OpenAI-compatible server. Uses the chat-completions wire format. |

`env:` references always win over a stored value.

### `agent`

Agents are named configuration bundles. The `default` agent is used unless a
session overrides it.

| Key           | Type     | Description                   |
| ------------- | -------- | ----------------------------- |
| `description` | string   | What this agent is for        |
| `tools`       | string[] | Allowed tool names            |
| `model`       | string   | Model override for this agent |

### `mcp`

MCP servers exposed to the agent as `{serverName}_{toolName}` tools.

| Key           | Type                    | Description                          |
| ------------- | ----------------------- | ------------------------------------ |
| `type`        | `"local"` \| `"remote"` | stdio command vs streamable HTTP URL |
| `command`     | string[]                | argv for a local server              |
| `url`         | string                  | URL for a remote server              |
| `environment` | Record<string,string>   | Environment for a local server       |

A server whose name matches a native tool is skipped — the native integration
wins (dogfooding rule).

### `office`

| Key                      | Type   | Description                          |
| ------------------------ | ------ | ------------------------------------ |
| `managedDocumentsFolder` | string | Default folder for managed documents |

### `update`

| Key     | Type    | Description                                                                                                              |
| ------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `check` | boolean | Default `true`. When `false`, the daemon never checks GitHub Releases and `openoffice update` is the only way to update. |
