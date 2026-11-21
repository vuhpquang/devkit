//! Port Inspector: who is listening on which port (lsof), and stopping a process.

use super::{run, run_lenient};

/// `lsof -F` field output for TCP listeners and UDP sockets of this user's processes
/// (lsof can't see other users' processes without root). Parsed in TS.
#[tauri::command]
pub fn list_ports() -> Result<String, String> {
    let tcp = run_lenient("/usr/sbin/lsof", &["-nP", "-iTCP", "-sTCP:LISTEN", "-F", "pcuLPnT"])?;
    let udp = run_lenient("/usr/sbin/lsof", &["-nP", "-iUDP", "-F", "pcuLPn"])?;
    Ok(format!("{tcp}{udp}"))
}

/// Sends SIGTERM (or SIGKILL when `force`) to a process the user owns. Refuses DevKit itself and PIDs ≤ 1.
#[tauri::command]
pub fn kill_process(pid: u32, force: bool) -> Result<(), String> {
    if pid <= 1 || pid == std::process::id() {
        return Err("That process can't be stopped from here.".into());
    }
    let pid = pid.to_string();
    run("/bin/kill", &[if force { "-KILL" } else { "-TERM" }, &pid]).map(|_| ()).map_err(|e| {
        if e.contains("not permitted") {
            "Not allowed: that process belongs to another user (or the system).".into()
        } else if e.contains("No such process") {
            "That process has already exited.".into()
        } else {
            e
        }
    })
}
