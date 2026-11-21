mod menu;
mod sys;
mod whois;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            let menu = menu::build(app.handle())?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| menu::forward(app, event.id().as_ref()));
            Ok(())
        })
        .manage(sys::probe::Probes::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                use tauri::Manager;
                sys::probe::stop_all(&window.state::<sys::probe::Probes>());
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            whois::whois_lookup,
            sys::netinfo::net_info,
            sys::ports::list_ports,
            sys::ports::kill_process,
            sys::probe::start_probe,
            sys::probe::stop_probe,
            sys::dns::dns_status,
            sys::dns::dns_set,
            sys::dns::dns_flush,
            sys::dns::dns_benchmark,
            sys::throttle::throttle_status,
            sys::throttle::throttle_start,
            sys::throttle::throttle_stop,
            sys::hosts::hosts_read,
            sys::hosts::hosts_write,
            sys::hosts::hosts_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
