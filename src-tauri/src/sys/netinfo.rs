//! Network Info: raw output of fixed, read-only commands. The frontend parses it (pure, tested in TS).

use super::{run, run_lenient};
use serde::Serialize;

#[derive(Serialize)]
pub struct NetInfoRaw {
    pub ifconfig: String,
    pub route: String,
    pub scutil_dns: String,
    pub hardware_ports: String,
    /// `ipconfig getsummary <wifi device>`; may hide the SSID without Location permission.
    pub wifi_summary: String,
    pub hostname: String,
}

/// Device of the "Wi-Fi" hardware port (en0 on most Macs).
fn wifi_device(hardware_ports: &str) -> Option<String> {
    let mut lines = hardware_ports.lines();
    while let Some(l) = lines.next() {
        if l.trim() == "Hardware Port: Wi-Fi" {
            let dev = lines.next()?.trim().strip_prefix("Device: ")?.trim().to_string();
            if dev.chars().all(|c| c.is_ascii_alphanumeric()) {
                return Some(dev);
            }
        }
    }
    None
}

#[tauri::command]
pub fn net_info() -> Result<NetInfoRaw, String> {
    let hardware_ports = run("/usr/sbin/networksetup", &["-listallhardwareports"]).unwrap_or_default();
    let wifi_summary = wifi_device(&hardware_ports)
        .map(|d| run_lenient("/usr/sbin/ipconfig", &["getsummary", &d]).unwrap_or_default())
        .unwrap_or_default();
    Ok(NetInfoRaw {
        ifconfig: run("/sbin/ifconfig", &["-a"])?,
        route: run_lenient("/sbin/route", &["-n", "get", "default"]).unwrap_or_default(),
        scutil_dns: run("/usr/sbin/scutil", &["--dns"]).unwrap_or_default(),
        hardware_ports,
        wifi_summary,
        hostname: run("/bin/hostname", &[]).unwrap_or_default().trim().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::wifi_device;

    #[test]
    fn finds_the_wifi_device() {
        let out = "\nHardware Port: Ethernet\nDevice: en7\nEthernet Address: x\n\nHardware Port: Wi-Fi\nDevice: en0\nEthernet Address: y\n";
        assert_eq!(wifi_device(out).as_deref(), Some("en0"));
        assert_eq!(wifi_device("Hardware Port: Wi-Fi\nDevice: en0;rm\n"), None);
    }
}
