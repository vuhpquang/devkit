//! Ping & Traceroute: runs /sbin/ping or /usr/sbin/traceroute (no shell, the host is one validated argument)
//! and streams each output line to the page through a Channel until it ends or is stopped.

use super::valid_host;
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tauri::State;

#[derive(Default)]
pub struct Probes {
    next: AtomicU32,
    children: Arc<Mutex<HashMap<u32, Child>>>,
}

#[derive(Clone, serde::Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ProbeEvent {
    Line { text: String },
    Done { code: Option<i32> },
}

fn command(kind: &str, host: &str, count: u32) -> Result<Command, String> {
    if !valid_host(host) {
        return Err("Enter a host name or an IP address.".into());
    }
    let host = host.trim();
    let mut c = match kind {
        "ping" => {
            let mut c = Command::new("/sbin/ping");
            c.args(["-i", "1", "-W", "2000"]);
            if count > 0 {
                c.args(["-c", &count.min(1000).to_string()]);
            }
            if host.contains(':') {
                // IPv6 literal
                c = Command::new("/sbin/ping6");
                c.args(["-i", "1"]);
                if count > 0 {
                    c.args(["-c", &count.min(1000).to_string()]);
                }
            }
            c
        }
        "traceroute" => {
            let mut c = Command::new(if host.contains(':') { "/usr/sbin/traceroute6" } else { "/usr/sbin/traceroute" });
            c.args(["-n", "-q", "1", "-w", "2", "-m", "30"]);
            c
        }
        _ => return Err("Unknown probe".into()),
    };
    c.arg(host);
    Ok(c)
}

/// Starts a probe; returns its id for `stop_probe`. `count` 0 = ping until stopped.
#[tauri::command]
pub fn start_probe(kind: String, host: String, count: u32, on_event: Channel<ProbeEvent>, probes: State<'_, Probes>) -> Result<u32, String> {
    let mut cmd = command(&kind, &host, count)?;
    // traceroute prints its header on stderr; merge both streams line by line.
    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Couldn't start {kind}: {e}"))?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let id = probes.next.fetch_add(1, Ordering::Relaxed) + 1;
    probes.children.lock().unwrap().insert(id, child);

    if let Some(err) = stderr {
        let ch = on_event.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(err).lines().map_while(Result::ok) {
                let _ = ch.send(ProbeEvent::Line { text: line });
            }
        });
    }
    let children = probes.children.clone();
    std::thread::spawn(move || {
        if let Some(out) = stdout {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                let _ = on_event.send(ProbeEvent::Line { text: line });
            }
        }
        let code = children.lock().unwrap().remove(&id).and_then(|mut c| c.wait().ok()).and_then(|s| s.code());
        let _ = on_event.send(ProbeEvent::Done { code });
    });
    Ok(id)
}

#[tauri::command]
pub fn stop_probe(id: u32, probes: State<'_, Probes>) {
    if let Some(child) = probes.children.lock().unwrap().get_mut(&id) {
        // SIGINT makes ping print its summary before exiting.
        let _ = Command::new("/bin/kill").args(["-INT", &child.id().to_string()]).status();
    }
}

/// Kills every running probe (window closing).
pub fn stop_all(probes: &Probes) {
    for (_, child) in probes.children.lock().unwrap().iter_mut() {
        let _ = child.kill();
    }
}

#[cfg(test)]
mod tests {
    use super::command;

    #[test]
    fn builds_safe_commands() {
        let c = command("ping", "example.com", 4).unwrap();
        assert_eq!(c.get_program(), "/sbin/ping");
        let args: Vec<_> = c.get_args().map(|a| a.to_string_lossy().into_owned()).collect();
        assert_eq!(args, ["-i", "1", "-W", "2000", "-c", "4", "example.com"]);
        assert!(command("ping", "-f example.com", 1).is_err());
        assert!(command("ping", "a;b", 1).is_err());
        assert!(command("nmap", "example.com", 1).is_err());
        assert_eq!(command("traceroute", "2001:db8::1", 0).unwrap().get_program(), "/usr/sbin/traceroute6");
    }
}
