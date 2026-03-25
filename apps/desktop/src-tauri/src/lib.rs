use arboard::{Clipboard, ImageData};
use serde::Serialize;
use std::collections::HashMap;
use std::process::Command as StdCommand;
use sysinfo::System;
use tauri_plugin_dialog::DialogExt;

/* ── Existing commands ── */

#[tauri::command]
fn copy_image_to_clipboard(rgba: Vec<u8>, width: u32, height: u32) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    let img = ImageData {
        width: width as usize,
        height: height as usize,
        bytes: rgba.into(),
    };
    clipboard.set_image(img).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_png_file(app: tauri::AppHandle, png_data: Vec<u8>) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel();

    app.dialog()
        .file()
        .add_filter("PNG Image", &["png"])
        .set_file_name("code.png")
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    let path = rx.recv().map_err(|e| e.to_string())?;

    match path {
        Some(path) => {
            std::fs::write(path.as_path().unwrap(), &png_data).map_err(|e| e.to_string())
        }
        None => Ok(()),
    }
}

/* ── Port Manager ── */

#[derive(Serialize, Clone, Debug)]
pub struct PortInfo {
    pub pid: u32,
    pub name: String,
    pub port: u16,
    pub protocol: String,
    pub state: String,
    pub local_address: String,
    pub remote_address: String,
    pub command: String,
    pub memory_bytes: u64,
}

/// Raw entry parsed from platform-specific commands (before sysinfo enrichment)
#[derive(Debug)]
struct RawPortEntry {
    pid: u32,
    port: u16,
    protocol: String,
    state: String,
    local_address: String,
    remote_address: String,
}

#[cfg(target_os = "macos")]
fn parse_port_entries() -> Vec<RawPortEntry> {
    let output = StdCommand::new("lsof")
        .args(["-iTCP", "-iUDP", "-P", "-n"])
        .output();

    let output = match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return Vec::new(),
    };

    let mut entries = Vec::new();
    for line in output.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 9 {
            continue;
        }

        let pid: u32 = match parts[1].parse() {
            Ok(p) => p,
            Err(_) => continue,
        };

        let protocol = parts[7].to_string(); // TCP or UDP
        let name_field = parts[8..].join(" ");

        // Parse NAME field: "addr:port (STATE)" or "addr:port->remote:port (STATE)"
        let (local_address, remote_address, state) = parse_lsof_name(&name_field);

        let port = extract_port_from_address(&local_address);

        if let Some(port) = port {
            entries.push(RawPortEntry {
                pid,
                port,
                protocol,
                state,
                local_address,
                remote_address,
            });
        }
    }
    entries
}

#[cfg(target_os = "macos")]
fn parse_lsof_name(name: &str) -> (String, String, String) {
    // Extract state from parentheses at the end
    let (addr_part, state) = if let Some(paren_start) = name.rfind('(') {
        let state = name[paren_start + 1..].trim_end_matches(')').to_string();
        (name[..paren_start].trim(), state)
    } else {
        (name.trim(), String::new())
    };

    // Check for -> (connection)
    if let Some(arrow_pos) = addr_part.find("->") {
        let local = addr_part[..arrow_pos].to_string();
        let remote = addr_part[arrow_pos + 2..].to_string();
        (local, remote, state)
    } else {
        (addr_part.to_string(), String::new(), state)
    }
}

#[cfg(target_os = "linux")]
fn parse_port_entries() -> Vec<RawPortEntry> {
    let output = StdCommand::new("ss")
        .args(["-tulnp"])
        .output();

    let output = match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return Vec::new(),
    };

    let mut entries = Vec::new();
    for line in output.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 6 {
            continue;
        }

        let protocol = match parts[0] {
            "tcp" => "TCP",
            "udp" => "UDP",
            _ => continue,
        }
        .to_string();

        let state = parts[1].to_string();
        let local_address = parts[4].to_string();
        let remote_address = parts[5].to_string();
        let port = extract_port_from_address(&local_address);

        // Extract PID from process field: users:(("name",pid=1234,fd=3))
        let pid = if parts.len() > 6 {
            extract_pid_from_ss_process(&parts[6..].join(" "))
        } else {
            None
        };

        if let (Some(port), Some(pid)) = (port, pid) {
            entries.push(RawPortEntry {
                pid,
                port,
                protocol,
                state,
                local_address,
                remote_address,
            });
        }
    }
    entries
}

#[cfg(target_os = "linux")]
fn extract_pid_from_ss_process(process: &str) -> Option<u32> {
    // Format: users:(("name",pid=1234,fd=3))
    if let Some(pid_start) = process.find("pid=") {
        let rest = &process[pid_start + 4..];
        let pid_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        pid_str.parse().ok()
    } else {
        None
    }
}

#[cfg(target_os = "windows")]
fn parse_port_entries() -> Vec<RawPortEntry> {
    let output = StdCommand::new("netstat")
        .args(["-ano"])
        .output();

    let output = match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return Vec::new(),
    };

    let mut entries = Vec::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 5 {
            continue;
        }

        let protocol = match parts[0] {
            "TCP" => "TCP",
            "UDP" => "UDP",
            _ => continue,
        }
        .to_string();

        let local_address = parts[1].to_string();
        let remote_address = parts[2].to_string();
        let state = if protocol == "TCP" {
            parts[3].to_string()
        } else {
            String::new()
        };
        let pid_idx = if protocol == "TCP" { 4 } else { 3 };
        let pid: u32 = match parts.get(pid_idx).and_then(|p| p.parse().ok()) {
            Some(p) => p,
            None => continue,
        };

        let port = extract_port_from_address(&local_address);

        if let Some(port) = port {
            entries.push(RawPortEntry {
                pid,
                port,
                protocol,
                state,
                local_address,
                remote_address,
            });
        }
    }
    entries
}

fn extract_port_from_address(addr: &str) -> Option<u16> {
    // Handle formats: "*:port", "0.0.0.0:port", "[::]:port", "127.0.0.1:port"
    if let Some(colon_pos) = addr.rfind(':') {
        addr[colon_pos + 1..].parse().ok()
    } else {
        None
    }
}

fn enrich_with_sysinfo(raw_entries: Vec<RawPortEntry>) -> Vec<PortInfo> {
    let sys = System::new_all();

    // Build a map of PID -> process info
    let mut process_cache: HashMap<u32, (String, String, u64)> = HashMap::new();

    for entry in &raw_entries {
        if process_cache.contains_key(&entry.pid) {
            continue;
        }

        let pid = sysinfo::Pid::from_u32(entry.pid);
        if let Some(process) = sys.process(pid) {
            let name = process.name().to_string_lossy().to_string();
            let cmd = process
                .cmd()
                .iter()
                .map(|s| s.to_string_lossy().to_string())
                .collect::<Vec<_>>()
                .join(" ");
            let memory = process.memory();
            process_cache.insert(entry.pid, (name, cmd, memory));
        } else {
            process_cache.insert(entry.pid, (String::new(), String::new(), 0));
        }
    }

    raw_entries
        .into_iter()
        .map(|entry| {
            let (name, command, memory_bytes) = process_cache
                .get(&entry.pid)
                .cloned()
                .unwrap_or_default();

            PortInfo {
                pid: entry.pid,
                name,
                port: entry.port,
                protocol: entry.protocol,
                state: entry.state,
                local_address: entry.local_address,
                remote_address: entry.remote_address,
                command,
                memory_bytes,
            }
        })
        .collect()
}

#[tauri::command]
fn scan_ports() -> Result<Vec<PortInfo>, String> {
    let raw = parse_port_entries();
    Ok(enrich_with_sysinfo(raw))
}

#[tauri::command]
fn kill_process(pid: u32) -> Result<(), String> {
    #[cfg(unix)]
    {
        let output = StdCommand::new("kill")
            .args(["-15", &pid.to_string()])
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to kill process {}: {}", pid, stderr));
        }
    }
    #[cfg(windows)]
    {
        let output = StdCommand::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to kill process {}: {}", pid, stderr));
        }
    }
    Ok(())
}

/* ── App Entry ── */

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            copy_image_to_clipboard,
            save_png_file,
            scan_ports,
            kill_process
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
