//! Network Throttle: slows the whole Mac down (bandwidth, latency, packet loss) with dummynet, like Network
//! Link Conditioner, to test apps on a bad connection.
//!
//! How it stays safe:
//! - Rules live only in our own anchor `com.apple/devkit` (the stock /etc/pf.conf already has
//!   `dummynet-anchor "com.apple/*"`); loopback is never touched, so localhost stays fast.
//! - pf is enabled with a reference token (`pfctl -E`) and released with it (`pfctl -X`), so a firewall
//!   that was already on stays on.
//! - Turning it on starts a root watcher that removes everything as soon as: the user turns it off (DevKit
//!   drops an `off` file in its own temp dir — no password needed), DevKit quits or crashes (its PID is gone),
//!   or the time limit passes. A forgotten throttle can't outlive DevKit.

use super::{privileged, run, sh_quote};
use serde::Serialize;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const ANCHOR: &str = "com.apple/devkit";
const PIPE_IN: u32 = 7101;
const PIPE_OUT: u32 = 7102;

#[derive(Debug, PartialEq)]
pub struct Profile {
    pub preset: String,
    pub down_kbps: u32,
    pub up_kbps: u32,
    pub delay_ms: u32,
    pub loss_pct: f64,
    pub minutes: u32,
}

impl Profile {
    pub fn validate(&self) -> Result<(), String> {
        let ok_preset = !self.preset.is_empty()
            && self.preset.len() <= 24
            && self.preset.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
        if !ok_preset {
            return Err("Unknown preset.".into());
        }
        if !(32..=1_000_000).contains(&self.down_kbps) || !(32..=1_000_000).contains(&self.up_kbps) {
            return Err("Bandwidth must be between 32 Kbit/s and 1 Gbit/s.".into());
        }
        if self.delay_ms > 5000 {
            return Err("Latency must be at most 5000 ms.".into());
        }
        if !(0.0..=50.0).contains(&self.loss_pct) || self.loss_pct.is_nan() {
            return Err("Packet loss must be between 0 and 50 %.".into());
        }
        if !(1..=480).contains(&self.minutes) {
            return Err("The time limit must be between 1 minute and 8 hours.".into());
        }
        Ok(())
    }
}

/// Per-user folder for the state files (`$TMPDIR/devkit-throttle`). Only plain path characters allowed,
/// because it is interpolated (quoted) into the root script.
fn state_dir() -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join("devkit-throttle");
    let s = dir.to_string_lossy();
    if !s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '.' | '_' | '-')) {
        return Err("Unusual temp folder path; can't set up throttling safely.".into());
    }
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// `dnctl` lines for the two pipes; latency is split between the directions so the round trip adds `delay_ms`.
fn pipe_config(p: &Profile) -> String {
    let plr = format!("{:.3}", p.loss_pct / 100.0);
    let d_in = p.delay_ms / 2;
    let d_out = p.delay_ms - d_in;
    format!(
        "/usr/sbin/dnctl -q pipe {PIPE_IN} config bw {}Kbit/s delay {d_in} plr {plr}; \
         /usr/sbin/dnctl -q pipe {PIPE_OUT} config bw {}Kbit/s delay {d_out} plr {plr}",
        p.down_kbps, p.up_kbps
    )
}

pub const RULES: [&str; 2] = [
    "dummynet in quick on ! lo0 all pipe 7101",
    "dummynet out quick on ! lo0 all pipe 7102",
];

/// Root script that turns throttling on (or just updates the pipes and time limit when it's already on).
fn start_script(p: &Profile, dir: &str, devkit_pid: u32, until: u64, already_on: bool) -> String {
    let d = sh_quote(dir);
    let active = sh_quote(&format!(
        r#"{{"preset":"{}","downKbps":{},"upKbps":{},"delayMs":{},"lossPct":{},"until":{}}}"#,
        p.preset, p.down_kbps, p.up_kbps, p.delay_ms, p.loss_pct, until
    ));
    let mut s = format!(
        "set -e; D={d}; /bin/rm -f \"$D/off\"; {}; echo {until} > \"$D/until\"; printf '%s' {active} > \"$D/active\"",
        pipe_config(p)
    );
    if already_on {
        return s;
    }
    let rules = RULES.iter().map(|r| sh_quote(r)).collect::<Vec<_>>().join(" ");
    let cleanup = format!(
        "/sbin/pfctl -q -a {ANCHOR} -F all; /usr/sbin/dnctl -q pipe delete {PIPE_IN}; \
         /usr/sbin/dnctl -q pipe delete {PIPE_OUT}; /sbin/pfctl -q -X \"$T\"; \
         /bin/rm -f \"$D/active\" \"$D/until\" \"$D/off\" \"$D/watcher\""
    );
    let watcher = format!(
        "while [ ! -e \"$D/off\" ] && /bin/kill -0 {devkit_pid} 2>/dev/null && \
         [ \"$(/bin/date +%s)\" -lt \"$(/bin/cat \"$D/until\" 2>/dev/null || echo 0)\" ]; do /bin/sleep 1; done; {cleanup}"
    );
    s.push_str(&format!(
        "; printf '%s\\n' {rules} | /sbin/pfctl -q -a {ANCHOR} -f -; \
         T=$(/sbin/pfctl -E 2>&1 | /usr/bin/sed -n 's/^Token : //p'); \
         export D T; /usr/bin/nohup /bin/sh -c {} >/dev/null 2>&1 & echo $! > \"$D/watcher\"",
        sh_quote(&watcher)
    ));
    s
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThrottleStatus {
    pub active: bool,
    /// The JSON the root script wrote (preset and numbers), when active.
    pub profile: Option<String>,
}

fn watcher_alive(dir: &PathBuf) -> bool {
    let Ok(pid) = std::fs::read_to_string(dir.join("watcher")) else { return false };
    let pid = pid.trim();
    pid.chars().all(|c| c.is_ascii_digit()) && !pid.is_empty() && run("/bin/ps", &["-p", pid]).is_ok()
}

#[tauri::command]
pub fn throttle_status() -> Result<ThrottleStatus, String> {
    let dir = state_dir()?;
    let active = dir.join("active").exists() && watcher_alive(&dir);
    Ok(ThrottleStatus {
        active,
        profile: if active { std::fs::read_to_string(dir.join("active")).ok() } else { None },
    })
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn throttle_start(preset: String, down_kbps: u32, up_kbps: u32, delay_ms: u32, loss_pct: f64, minutes: u32) -> Result<(), String> {
    let p = Profile { preset, down_kbps, up_kbps, delay_ms, loss_pct, minutes };
    p.validate()?;
    let dir = state_dir()?;
    let already_on = throttle_status()?.active;
    let until = now() + u64::from(p.minutes) * 60;
    let script = start_script(&p, &dir.to_string_lossy(), std::process::id(), until, already_on);
    privileged(&script, "DevKit wants to slow down the network to simulate a bad connection.").map(|_| ())
}

/// Turns throttling off without a password: the root watcher sees the `off` file and cleans up.
#[tauri::command]
pub fn throttle_stop() -> Result<(), String> {
    let dir = state_dir()?;
    if !dir.join("active").exists() {
        return Ok(());
    }
    std::fs::write(dir.join("off"), b"off").map_err(|e| e.to_string())?;
    for _ in 0..30 {
        if !dir.join("active").exists() {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    Err("Throttling didn't stop yet. It ends by itself when DevKit quits or the time limit passes.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn slow() -> Profile {
        Profile { preset: "slow".into(), down_kbps: 750, up_kbps: 250, delay_ms: 301, loss_pct: 1.0, minutes: 30 }
    }

    #[test]
    fn validates_ranges() {
        assert!(slow().validate().is_ok());
        assert!(Profile { down_kbps: 1, ..slow() }.validate().is_err());
        assert!(Profile { delay_ms: 9000, ..slow() }.validate().is_err());
        assert!(Profile { loss_pct: f64::NAN, ..slow() }.validate().is_err());
        assert!(Profile { minutes: 0, ..slow() }.validate().is_err());
        assert!(Profile { preset: "slow; rm -rf /".into(), ..slow() }.validate().is_err());
    }

    #[test]
    fn splits_latency_between_directions() {
        let c = pipe_config(&slow());
        assert!(c.contains("pipe 7101 config bw 750Kbit/s delay 150 plr 0.010"), "{c}");
        assert!(c.contains("pipe 7102 config bw 250Kbit/s delay 151 plr 0.010"), "{c}");
    }

    #[test]
    fn start_script_uses_our_anchor_token_and_watcher() {
        let s = start_script(&slow(), "/var/folders/ab/T/devkit-throttle", 4242, 1_900_000_000, false);
        assert!(s.contains("-a com.apple/devkit -f -"));
        assert!(s.contains("pfctl -E"));
        assert!(s.contains("pfctl -q -X"));
        assert!(s.contains("/bin/kill -0 4242"));
        assert!(s.contains("D='/var/folders/ab/T/devkit-throttle'"));
        // Reconfiguring an active throttle only touches the pipes and the time limit.
        let again = start_script(&slow(), "/tmp/x", 1, 2, true);
        assert!(!again.contains("pfctl"));
        assert!(again.contains("dnctl"));
    }

    /// The pf rules parse (pfctl -n needs no root). Skipped where pfctl isn't available.
    #[test]
    fn pf_rules_parse() {
        use std::io::Write;
        use std::process::{Command, Stdio};
        let Ok(mut child) = Command::new("/sbin/pfctl").args(["-n", "-f", "-"]).stdin(Stdio::piped()).stderr(Stdio::piped()).spawn() else {
            return;
        };
        // Same shape as the script: printf '%s\n' ends every rule with a newline (pf needs it).
        child.stdin.take().unwrap().write_all(format!("{}\n", RULES.join("\n")).as_bytes()).unwrap();
        let out = child.wait_with_output().unwrap();
        let err = String::from_utf8_lossy(&out.stderr);
        assert!(!err.contains("syntax error"), "{err}");
    }
}
