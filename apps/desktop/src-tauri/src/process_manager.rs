use serde::Serialize;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, Signal, System, UpdateKind};

#[derive(Serialize)]
pub struct ProcessInfo {
    pid: u32,
    name: String,
    command: String,
    memory_bytes: u64,
    start_time: u64,
    protected: bool,
}

#[derive(Serialize)]
pub struct ProcessSnapshot {
    processes: Vec<ProcessInfo>,
    can_stop: bool,
}

fn is_protected(pid: u32) -> bool {
    pid <= 1 || pid == std::process::id()
}

fn scan() -> ProcessSnapshot {
    let mut system = System::new();
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::new()
            .with_memory()
            .with_cmd(UpdateKind::Always),
    );
    let processes = system
        .processes()
        .iter()
        .map(|(pid, process)| {
            let pid = pid.as_u32();
            ProcessInfo {
                pid,
                name: process.name().to_string_lossy().into_owned(),
                command: process
                    .cmd()
                    .iter()
                    .map(|part| part.to_string_lossy())
                    .collect::<Vec<_>>()
                    .join(" "),
                memory_bytes: process.memory(),
                start_time: process.start_time(),
                protected: is_protected(pid),
            }
        })
        .collect();
    ProcessSnapshot {
        processes,
        can_stop: sysinfo::SUPPORTED_SIGNALS.contains(&Signal::Term),
    }
}

#[tauri::command]
pub async fn scan_processes() -> Result<ProcessSnapshot, String> {
    tauri::async_runtime::spawn_blocking(scan)
        .await
        .map_err(|error| error.to_string())
}

fn terminate(pid: u32, start_time: u64, force: bool) -> Result<(), String> {
    if is_protected(pid) {
        return Err("This process is protected and cannot be stopped from Typa.".into());
    }
    let mut system = System::new();
    let process_id = Pid::from_u32(pid);
    system.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[process_id]),
        true,
        ProcessRefreshKind::new(),
    );
    let process = system
        .process(process_id)
        .ok_or("This process has already exited. Refresh the list.")?;
    if process.start_time() != start_time {
        return Err("This PID now belongs to a different process. Refresh the list.".into());
    }
    let signal = if force { Signal::Kill } else { Signal::Term };
    match process.kill_with(signal) {
        Some(true) => Ok(()),
        Some(false) => Err(format!(
            "Could not stop PID {pid}. Permission may be denied, or the process may have exited."
        )),
        None => {
            Err("Normal stop is unavailable on this platform. Use Force Kill if needed.".into())
        }
    }
}

#[tauri::command]
pub async fn terminate_process(pid: u32, start_time: u64, force: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || terminate(pid, start_time, force))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::process::Command;

    #[test]
    fn protects_system_and_current_process() {
        for pid in [0, 1, std::process::id()] {
            assert!(terminate(pid, 0, true).unwrap_err().contains("protected"));
        }
    }

    #[test]
    fn checks_identity_before_sending_either_signal() {
        for force in [false, true] {
            let mut child = Command::new("sleep").arg("30").spawn().unwrap();
            let process = scan()
                .processes
                .into_iter()
                .find(|process| process.pid == child.id())
                .unwrap();
            let stale_result = terminate(child.id(), process.start_time + 1, force);
            let still_running = child.try_wait().unwrap().is_none();
            let result = terminate(child.id(), process.start_time, force);
            // Always reap the test's own child, including on failure.
            if result.is_err() {
                let _ = child.kill();
            }
            let status = child.wait().unwrap();
            assert!(stale_result.unwrap_err().contains("different process"));
            assert!(still_running);
            assert!(result.is_ok());
            assert!(!status.success());
        }
    }
}
