//! The macOS menu bar, laid out like the owner's other apps (hub rule `.claude/rules/app-shell.md`):
//! About / Check for Updates… / Settings… ⌘, / Quit in the app menu. Custom items are sent to the
//! frontend as a `menu` event carrying the item id; the predefined ones (Edit, Window) are handled by
//! macOS, which is what keeps ⌘C / ⌘V / ⌘Z working inside the webview.

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Runtime};

/// Ids the frontend listens for (`src/app/menuEvents.ts`).
pub const ITEMS: &[(&str, &str, Option<&str>)] = &[
    ("about", "About DevKit", None),
    ("check-updates", "Check for Updates…", None),
    ("settings", "Settings…", Some("CmdOrCtrl+,")),
    ("find-tool", "Find a Tool…", Some("CmdOrCtrl+K")),
    ("toggle-sidebar", "Toggle Sidebar", Some("Ctrl+Cmd+S")),
    ("whats-new", "What's New in DevKit", None),
    ("report-issue", "Report an Issue…", None),
    ("shortcuts", "Keyboard Shortcuts", Some("CmdOrCtrl+/")),
];

fn item<R: Runtime>(app: &AppHandle<R>, id: &str) -> tauri::Result<MenuItem<R>> {
    let (id, label, accel) = ITEMS.iter().find(|(i, _, _)| *i == id).expect("known menu id");
    MenuItem::with_id(app, *id, *label, true, *accel)
}

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let sep = || PredefinedMenuItem::separator(app);
    let app_menu = Submenu::with_items(
        app,
        "DevKit",
        true,
        &[
            &item(app, "about")?,
            &item(app, "check-updates")?,
            &sep()?,
            &item(app, "settings")?,
            &sep()?,
            &PredefinedMenuItem::services(app, None)?,
            &sep()?,
            &PredefinedMenuItem::hide(app, Some("Hide DevKit"))?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &sep()?,
            &PredefinedMenuItem::quit(app, Some("Quit DevKit"))?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &sep()?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;
    let view = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &item(app, "toggle-sidebar")?,
            &item(app, "find-tool")?,
            &sep()?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;
    let window = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &sep()?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;
    let help = Submenu::with_items(app, "Help", true, &[&item(app, "shortcuts")?, &sep()?, &item(app, "whats-new")?, &item(app, "report-issue")?])?;
    Menu::with_items(app, &[&app_menu, &edit, &view, &window, &help])
}

/// Forwards clicks on our own items to the webview; predefined items never reach here.
pub fn forward<R: Runtime>(app: &AppHandle<R>, id: &str) {
    if ITEMS.iter().any(|(i, _, _)| *i == id) {
        let _ = app.emit("menu", id);
    }
}

#[cfg(test)]
mod tests {
    use super::ITEMS;

    #[test]
    fn ids_are_unique() {
        let mut ids: Vec<_> = ITEMS.iter().map(|(i, _, _)| *i).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), ITEMS.len());
    }

    #[test]
    fn settings_uses_command_comma() {
        let settings = ITEMS.iter().find(|(i, _, _)| *i == "settings").unwrap();
        assert_eq!(settings.2, Some("CmdOrCtrl+,"));
    }
}
