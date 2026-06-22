use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

const IANA_WHOIS: &str = "whois.iana.org";
const WHOIS_PORT: u16 = 43;
const TIMEOUT: Duration = Duration::from_secs(10);

fn query_whois_server(server: &str, query: &str) -> Result<String, String> {
    let addr = format!("{}:{}", server, WHOIS_PORT);
    let mut stream = TcpStream::connect(&addr)
        .map_err(|e| format!("Failed to connect to {}: {}", server, e))?;

    stream
        .set_read_timeout(Some(TIMEOUT))
        .map_err(|e| format!("Failed to set read timeout: {}", e))?;
    stream
        .set_write_timeout(Some(TIMEOUT))
        .map_err(|e| format!("Failed to set write timeout: {}", e))?;

    let request = format!("{}\r\n", query);
    stream
        .write_all(request.as_bytes())
        .map_err(|e| format!("Failed to send query to {}: {}", server, e))?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|e| format!("Failed to read response from {}: {}", server, e))?;

    Ok(response)
}

fn parse_refer(response: &str) -> Option<String> {
    for line in response.lines() {
        let lower = line.to_lowercase();
        if lower.starts_with("refer:") {
            let server = line["refer:".len()..].trim().to_string();
            if !server.is_empty() {
                return Some(server);
            }
        }
    }
    None
}

#[tauri::command]
pub async fn whois_lookup(domain: String) -> Result<String, String> {
    let domain_clone = domain.clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Step 1: Query IANA WHOIS
        let iana_response = query_whois_server(IANA_WHOIS, &domain_clone)?;

        // Step 2: Look for a referral to a registrar WHOIS server
        if let Some(refer_server) = parse_refer(&iana_response) {
            let registrar_response = query_whois_server(&refer_server, &domain_clone)?;
            let combined = format!(
                "=== IANA WHOIS (whois.iana.org) ===\n\n{}\n\n=== Registrar WHOIS ({}) ===\n\n{}",
                iana_response.trim(),
                refer_server,
                registrar_response.trim()
            );
            Ok(combined)
        } else {
            Ok(iana_response)
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
