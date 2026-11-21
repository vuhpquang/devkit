//! DNS Switcher: read and change the Mac's DNS servers per network service (networksetup), flush the cache,
//! and time how fast a DNS server answers (one UDP query, no shell).

use super::{privileged, run, sh_quote};
use serde::Serialize;
use std::net::{IpAddr, SocketAddr, UdpSocket};
use std::time::{Duration, Instant};

#[derive(Serialize)]
pub struct Service {
    pub name: String,
    pub enabled: bool,
    /// Manually set servers; empty = Automatic (from DHCP).
    pub servers: Vec<String>,
}

#[derive(Serialize)]
pub struct DnsStatus {
    pub services: Vec<Service>,
    /// `scutil --dns` — what the system actually uses (parsed in TS).
    pub resolvers: String,
}

/// Network service names from `networksetup -listallnetworkservices` (first line is a note; `*` = disabled).
fn parse_services(out: &str) -> Vec<(String, bool)> {
    out.lines()
        .skip(1)
        .filter(|l| !l.trim().is_empty())
        .map(|l| match l.strip_prefix('*') {
            Some(rest) => (rest.to_string(), false),
            None => (l.to_string(), true),
        })
        .collect()
}

fn list_services() -> Result<Vec<(String, bool)>, String> {
    Ok(parse_services(&run("/usr/sbin/networksetup", &["-listallnetworkservices"])?))
}

fn servers_of(service: &str) -> Vec<String> {
    run("/usr/sbin/networksetup", &["-getdnsservers", service])
        .unwrap_or_default()
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| l.parse::<IpAddr>().is_ok())
        .collect()
}

#[tauri::command]
pub fn dns_status() -> Result<DnsStatus, String> {
    let services = list_services()?
        .into_iter()
        .map(|(name, enabled)| Service { servers: servers_of(&name), name, enabled })
        .collect();
    Ok(DnsStatus { services, resolvers: run("/usr/sbin/scutil", &["--dns"]).unwrap_or_default() })
}

const FLUSH: &str = "/usr/bin/dscacheutil -flushcache; /usr/bin/killall -HUP mDNSResponder";

/// Builds the root script that sets `servers` (empty = Automatic) on each service. Every value is either a
/// parsed IP address or a service name that `networksetup` itself listed, and both are single-quoted.
fn set_script(services: &[String], servers: &[IpAddr]) -> String {
    let list = if servers.is_empty() {
        "Empty".to_string()
    } else {
        servers.iter().map(|ip| sh_quote(&ip.to_string())).collect::<Vec<_>>().join(" ")
    };
    let mut s: Vec<String> = services
        .iter()
        .map(|svc| format!("/usr/sbin/networksetup -setdnsservers {} {list}", sh_quote(svc)))
        .collect();
    s.push(FLUSH.to_string());
    s.join("; ")
}

/// Sets DNS servers on `service`, or on every enabled service when it's None. `servers` empty = Automatic.
#[tauri::command]
pub fn dns_set(service: Option<String>, servers: Vec<String>) -> Result<(), String> {
    if servers.len() > 6 {
        return Err("Use at most 6 DNS servers.".into());
    }
    let ips = servers
        .iter()
        .map(|s| s.trim().parse::<IpAddr>().map_err(|_| format!("“{s}” isn't an IP address.")))
        .collect::<Result<Vec<_>, _>>()?;
    let known = list_services()?;
    let targets: Vec<String> = match service {
        Some(name) => {
            if !known.iter().any(|(n, _)| *n == name) {
                return Err(format!("No network service called “{name}”."));
            }
            vec![name]
        }
        None => known.into_iter().filter(|(_, on)| *on).map(|(n, _)| n).collect(),
    };
    privileged(&set_script(&targets, &ips), "DevKit wants to change your DNS servers.").map(|_| ())
}

#[tauri::command]
pub fn dns_flush() -> Result<(), String> {
    privileged(FLUSH, "DevKit wants to clear the DNS cache.").map(|_| ())
}

/// A minimal DNS query: A record for `name`, recursion desired.
fn query_packet(id: u16, name: &str) -> Vec<u8> {
    let mut p = vec![(id >> 8) as u8, id as u8, 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0];
    for label in name.split('.') {
        p.push(label.len() as u8);
        p.extend_from_slice(label.as_bytes());
    }
    p.extend_from_slice(&[0, 0, 1, 0, 1]);
    p
}

/// Milliseconds for one server to answer a query (best of 3), or an error when it never does.
#[tauri::command]
pub fn dns_benchmark(server: String) -> Result<f64, String> {
    let ip: IpAddr = server.trim().parse().map_err(|_| format!("“{server}” isn't an IP address."))?;
    let bind = if ip.is_ipv4() { "0.0.0.0:0" } else { "[::]:0" };
    let sock = UdpSocket::bind(bind).map_err(|e| e.to_string())?;
    sock.set_read_timeout(Some(Duration::from_millis(1500))).map_err(|e| e.to_string())?;
    sock.connect(SocketAddr::new(ip, 53)).map_err(|e| e.to_string())?;
    let mut best: Option<f64> = None;
    let mut buf = [0u8; 512];
    for i in 0..3u16 {
        let id = 0x4b00 + i;
        // A popular name: every resolver has it cached, so this times the round trip, not recursion.
        let packet = query_packet(id, "example.com");
        let start = Instant::now();
        if sock.send(&packet).is_err() {
            continue;
        }
        if let Ok(n) = sock.recv(&mut buf) {
            if n >= 2 && u16::from_be_bytes([buf[0], buf[1]]) == id {
                let ms = start.elapsed().as_secs_f64() * 1000.0;
                best = Some(best.map_or(ms, |b: f64| b.min(ms)));
            }
        }
    }
    best.ok_or_else(|| "No answer".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_service_list() {
        let out = "An asterisk (*) denotes that a network service is disabled.\nWi-Fi\n*Thunderbolt Bridge\nUSB 10/100/1000 LAN\n";
        assert_eq!(
            parse_services(out),
            vec![("Wi-Fi".into(), true), ("Thunderbolt Bridge".into(), false), ("USB 10/100/1000 LAN".into(), true)]
        );
    }

    #[test]
    fn script_quotes_everything() {
        let s = set_script(&["Wi-Fi".into(), "Bob's LAN".into()], &["1.1.1.1".parse().unwrap(), "2606:4700:4700::1111".parse().unwrap()]);
        assert_eq!(
            s,
            "/usr/sbin/networksetup -setdnsservers 'Wi-Fi' '1.1.1.1' '2606:4700:4700::1111'; \
             /usr/sbin/networksetup -setdnsservers 'Bob'\\''s LAN' '1.1.1.1' '2606:4700:4700::1111'; \
             /usr/bin/dscacheutil -flushcache; /usr/bin/killall -HUP mDNSResponder"
        );
        assert!(set_script(&["Wi-Fi".into()], &[]).contains("-setdnsservers 'Wi-Fi' Empty"));
    }

    #[test]
    fn rejects_non_ip_servers() {
        assert!(dns_set(Some("Wi-Fi".into()), vec!["8.8.8.8; rm -rf /".into()]).is_err());
        assert!(dns_benchmark("dns.google".into()).is_err());
    }

    #[test]
    fn builds_a_query() {
        let p = query_packet(0x1234, "example.com");
        assert_eq!(&p[..4], &[0x12, 0x34, 0x01, 0x00]);
        assert_eq!(&p[12..20], &[7, b'e', b'x', b'a', b'm', b'p', b'l', b'e']);
        assert_eq!(&p[p.len() - 5..], &[0, 0, 1, 0, 1]);
    }
}
