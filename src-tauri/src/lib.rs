mod img;
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
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let menu = menu::build(app.handle())?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| menu::forward(app, event.id().as_ref()));
            Ok(())
        })
        .manage(sys::probe::Probes::default())
        .on_window_event(|window, event| {
            use tauri::Manager;
            match event {
                // The main window hides instead of closing, so ⌥Space and the launcher keep working; the Dock icon
                // brings it back (RunEvent::Reopen below) and ⌘Q quits. Running pings stop as if it had closed.
                tauri::WindowEvent::CloseRequested { api, .. } if window.label() == "main" => {
                    api.prevent_close();
                    let _ = window.hide();
                    sys::probe::stop_all(&window.state::<sys::probe::Probes>());
                }
                // The launcher goes away as soon as you click elsewhere, like Spotlight.
                tauri::WindowEvent::Focused(false) if window.label() == "launcher" => {
                    let _ = window.hide();
                }
                tauri::WindowEvent::Destroyed => {
                    sys::probe::stop_all(&window.state::<sys::probe::Probes>());
                }
                _ => {}
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
            img::image_convert,
            img::image_info,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Clicking the Dock icon while the main window is hidden shows it again.
            if let tauri::RunEvent::Reopen { .. } = event {
                use tauri::Manager;
                if let Some(main) = app.get_webview_window("main") {
                    let _ = main.show();
                    let _ = main.set_focus();
                }
            }
        });
}
