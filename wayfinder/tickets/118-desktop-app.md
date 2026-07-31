# Desktop App (Electron)

**Type**: task
**Map**: [OpenOffice Fork Map](../map.md)
**Blocks**: [Branding & Release](120-branding-release.md)
**Blocked by**: [TUI](117-tui.md)
**Assignee**: _(unclaimed)_

## Question

Wrap the app in Electron for a desktop experience — native window, file associations, auto-update.

### Architecture

```
Electron Main Process
  └── Spawns openoffice server (HTTP)
  └── Opens BrowserWindow pointing to server
  └── Handles OS integration (file associations, menus, tray)

Renderer Process
  └── Web UI (same as TUI but in a browser)
  └── Connects to server via HTTP/WebSocket
```

### What to build

**Main process** (`src/main/index.ts`):
```ts
import { app, BrowserWindow, ipcMain, dialog } from "electron"
import { spawn } from "child_process"

let mainWindow: BrowserWindow

app.whenReady().then(() => {
  // Start openoffice server
  const server = spawn("node", ["dist/server.js"], { stdio: "pipe" })
  
  // Create window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { preload: path.join(__dirname, "preload.js") }
  })
  
  mainWindow.loadURL("http://localhost:3000")
})
```

**File associations**:
```ts
// Register .docx/.xlsx/.pptx associations
app.setAsDefaultProtocolClient("openoffice")

// Handle file open
app.on("open-file", (event, path) => {
  event.preventDefault()
  mainWindow?.webContents.send("open-file", path)
})
```

**IPC handlers**:
```ts
ipcMain.handle("open-file-picker", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    filters: [
      { name: "Office Documents", extensions: ["docx", "xlsx", "pptx"] }
    ]
  })
  return result.filePaths[0] ?? null
})
```

### Dependencies

```bash
bun add -D electron electron-builder electron-vite
```

### What NOT to build yet

- No code signing (add for release)
- No auto-update (add for release)
- No tray icon (add later)
- No deep linking (add later)

### Reference

- opencode desktop: `packages/desktop/` (38 main process files — massive)
- opencode electron-builder: `packages/desktop/electron-builder.config.ts`
- Electron: `https://www.electronjs.org/`
