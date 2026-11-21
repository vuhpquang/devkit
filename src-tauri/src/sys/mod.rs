//! System tools (macOS): network info, ports, ping/traceroute, DNS, network throttling, /etc/hosts.
//!
//! Safety rules for everything in here (hub rule `.claude/rules/web.md`: commands validate their input,
//! never pass raw user strings to a shell):
//! - Unprivileged commands run with `Command::new(<absolute path>).args(..)` — no shell at all.
//! - Privileged work goes through `privileged()`, which runs a shell script as root via the macOS
//!   administrator prompt. Those scripts are built only from constants and values that were validated
//!   into a narrow type first (IP addresses, integers, a network service name that exists, paths this
//!   module generated), and every interpolated value is single-quoted with `sh_quote`.

pub mod dns;
pub mod hosts;
pub mod netinfo;
pub mod ports;
pub mod probe;
pub mod throttle;

use std::process::Command;

/// Runs a program (absolute path) with arguments, no shell. Returns stdout; stderr becomes the error.
pub fn run(program: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new(program)
        .args(args)
        .output()
        .map_err(|e| format!("Couldn't run {program}: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if err.is_empty() { format!("{program} failed ({})", out.status) } else { err })
    }
}

/// Like `run`, but a non-zero exit still returns stdout (lsof exits 1 when nothing matches).
pub fn run_lenient(program: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new(program)
        .args(args)
        .output()
        .map_err(|e| format!("Couldn't run {program}: {e}"))?;
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// `'…'` for /bin/sh: the value can't break out of the quotes.
pub fn sh_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', r"'\''"))
}

/// Escapes text for an AppleScript string literal.
fn applescript_string(s: &str) -> String {
    s.replace('\\', r"\\").replace('"', "\\\"")
}

/// Runs `script` with /bin/sh as root after the macOS administrator prompt (`reason` is shown in it).
/// Cancelling the prompt returns `Err("cancelled")`.
pub fn privileged(script: &str, reason: &str) -> Result<String, String> {
    let apple = format!(
        "do shell script \"{}\" with prompt \"{}\" with administrator privileges",
        applescript_string(script),
        applescript_string(reason)
    );
    let out = Command::new("/usr/bin/osascript")
        .args(["-e", &apple])
        .output()
        .map_err(|e| format!("Couldn't ask for the administrator password: {e}"))?;
    if out.status.success() {
        return Ok(String::from_utf8_lossy(&out.stdout).into_owned());
    }
    let err = String::from_utf8_lossy(&out.stderr).to_string();
    if err.contains("-128") {
        Err("cancelled".into())
    } else {
        Err(err.trim().trim_start_matches("execution error: ").to_string())
    }
}

/// A host name or IP address that is safe to hand to ping/traceroute as one argument.
pub fn valid_host(host: &str) -> bool {
    let h = host.trim();
    !h.is_empty()
        && h.len() <= 253
        && !h.starts_with('-')
        && h.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':' | '_'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quoting_can_not_be_escaped() {
        assert_eq!(sh_quote("Wi-Fi"), "'Wi-Fi'");
        assert_eq!(sh_quote("a'b; rm -rf /"), r"'a'\''b; rm -rf /'");
        assert_eq!(applescript_string(r#"say "hi" \ bye"#), r#"say \"hi\" \\ bye"#);
    }

    #[test]
    fn hosts_are_single_safe_arguments() {
        for ok in ["example.com", "1.1.1.1", "2001:4860:4860::8888", "my-host_1.local"] {
            assert!(valid_host(ok), "{ok}");
        }
        for bad in ["", "-c 1000", "a b", "x;rm", "$(id)", "a`b`", &"a".repeat(254)] {
            assert!(!valid_host(bad), "{bad}");
        }
    }
}

/// Read-only checks against the real Mac: `cargo test -- --ignored live_`.
#[cfg(test)]
mod live {
    #[test]
    #[ignore]
    fn live_read_only_commands() {
        let info = super::netinfo::net_info().expect("net_info");
        assert!(info.ifconfig.contains("lo0"));
        assert!(super::ports::list_ports().is_ok());
        let dns = super::dns::dns_status().expect("dns_status");
        assert!(!dns.services.is_empty());
        assert!(super::hosts::hosts_read().expect("hosts").contains("localhost"));
        let st = super::throttle::throttle_status().expect("throttle_status");
        assert!(!st.active);
    }

    #[test]
    #[ignore]
    fn live_dns_benchmark() {
        let ms = super::dns::dns_benchmark("1.1.1.1".into()).expect("1.1.1.1 answers");
        assert!(ms > 0.0 && ms < 1500.0, "{ms}");
    }
}
