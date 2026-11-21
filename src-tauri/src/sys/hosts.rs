//! Hosts File Editor: read /etc/hosts, and write it back as root (backup first, then flush the DNS cache).
//! The new text goes through a file in the user's temp folder, never through the script itself.

use super::{privileged, sh_quote};
use std::time::{SystemTime, UNIX_EPOCH};

const HOSTS: &str = "/etc/hosts";
pub const BACKUP: &str = "/etc/hosts.devkit-backup";

#[tauri::command]
pub fn hosts_read() -> Result<String, String> {
    std::fs::read_to_string(HOSTS).map_err(|e| format!("Couldn't read {HOSTS}: {e}"))
}

fn check(content: &str) -> Result<(), String> {
    if content.len() > 1_000_000 {
        return Err("The hosts file is over 1 MB; that's not a hosts file.".into());
    }
    if content.contains('\0') {
        return Err("The text contains a NUL character.".into());
    }
    Ok(())
}

fn write_script(tmp: &str) -> String {
    format!(
        "set -e; /bin/cp -p {HOSTS} {BACKUP}; /bin/cat {} > {HOSTS}; /bin/chmod 644 {HOSTS}; \
         /usr/bin/dscacheutil -flushcache; /usr/bin/killall -HUP mDNSResponder",
        sh_quote(tmp)
    )
}

#[tauri::command]
pub fn hosts_write(content: String) -> Result<(), String> {
    check(&content)?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let tmp = std::env::temp_dir().join(format!("devkit-hosts-{}-{stamp}", std::process::id()));
    let tmp_s = tmp.to_string_lossy().to_string();
    if !tmp_s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '.' | '_' | '-')) {
        return Err("Unusual temp folder path; not writing the hosts file.".into());
    }
    let mut text = content;
    if !text.ends_with('\n') {
        text.push('\n');
    }
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    let result = privileged(&write_script(&tmp_s), "DevKit wants to save /etc/hosts.");
    let _ = std::fs::remove_file(&tmp);
    result.map(|_| ())
}

#[tauri::command]
pub fn hosts_backup() -> Option<String> {
    std::fs::read_to_string(BACKUP).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_odd_content() {
        assert!(check("127.0.0.1 localhost\n").is_ok());
        assert!(check("a\0b").is_err());
        assert!(check(&"x".repeat(1_000_001)).is_err());
    }

    #[test]
    fn script_backs_up_then_copies_the_quoted_temp_file() {
        let s = write_script("/var/folders/ab/T/devkit-hosts-1-2");
        assert!(s.starts_with("set -e; /bin/cp -p /etc/hosts /etc/hosts.devkit-backup; /bin/cat '/var/folders/ab/T/devkit-hosts-1-2' > /etc/hosts"));
        assert!(s.contains("killall -HUP mDNSResponder"));
    }
}
