use std::fs;
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri_plugin_shell::ShellExt;

#[derive(Serialize)]
struct DaemonConfig {
    port: u16,
    username: String,
    password: Option<String>,
}

fn data_dir() -> PathBuf {
    // Mirrors src/data-dir.ts: $XDG_DATA_HOME/openoffice or ~/.local/share/openoffice
    let base = std::env::var("XDG_DATA_HOME").unwrap_or_else(|_| {
        let home = std::env::var("HOME").unwrap_or_default();
        format!("{home}/.local/share")
    });
    PathBuf::from(base).join("openoffice")
}

fn daemon_port() -> Option<u16> {
    let raw = fs::read_to_string(data_dir().join("daemon.json")).ok()?;
    let info: serde_json::Value = serde_json::from_str(&raw).ok()?;
    info.get("port")?.as_u64().map(|p| p as u16)
}

fn port_ready(port: u16) -> bool {
    TcpStream::connect_timeout(
        &SocketAddr::from(([127, 0, 0, 1], port)),
        Duration::from_millis(200),
    )
    .is_ok()
}

/// Bootstrap the openoffice daemon: reuse the running one (CLI parity — the
/// desktop app and the CLI share the same daemon and data) or spawn the
/// bundled sidecar and wait for its port file + TCP readiness.
#[tauri::command]
async fn daemon_start(app: tauri::AppHandle) -> Result<DaemonConfig, String> {
    let username =
        std::env::var("OPENOFFICE_SERVER_USERNAME").unwrap_or_else(|_| "openoffice".into());
    let password = std::env::var("OPENOFFICE_SERVER_PASSWORD")
        .ok()
        .filter(|p| !p.is_empty());

    // Reuse a live daemon (started by the CLI or a previous app run).
    if let Some(port) = daemon_port() {
        if port_ready(port) {
            return Ok(DaemonConfig {
                port,
                username,
                password,
            });
        }
    }

    // No live daemon: spawn the bundled sidecar, then poll for readiness.
    let home = std::env::var("HOME").map_err(|_| "HOME is not set".to_string())?;
    app.shell()
        .sidecar("openoffice")
        .map_err(|e| format!("failed to resolve sidecar: {e}"))?
        .args(["serve"])
        .current_dir(home)
        .spawn()
        .map_err(|e| format!("failed to spawn daemon: {e}"))?;

    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        if let Some(port) = daemon_port() {
            if port_ready(port) {
                return Ok(DaemonConfig {
                    port,
                    username,
                    password,
                });
            }
        }
        if Instant::now() >= deadline {
            return Err("openoffice daemon did not start within 10s".into());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(tauri_plugin_log::log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![daemon_start])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
