use tauri::AppHandle;

#[cfg(target_os = "macos")]
mod about;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
mod update_copy;
#[cfg(target_os = "macos")]
mod updates;
#[cfg(target_os = "macos")]
mod views;
#[cfg(target_os = "macos")]
mod window;

#[tauri::command]
pub fn open_preferences(app: AppHandle) -> Result<(), String> {
    open(app, false)
}

pub fn open_about(app: AppHandle) -> Result<(), String> {
    open(app, true)
}

fn open(app: AppHandle, show_about: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let handle = app.clone();
        app.run_on_main_thread(move || macos::open(handle, show_about))
            .map_err(|error| error.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    return Err("Native Preferences are currently available on macOS.".into());
    Ok(())
}

pub fn refresh(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    if let Err(error) = app.run_on_main_thread(macos::refresh) {
        eprintln!("could not refresh preferences: {error}");
    }
}

pub fn refresh_updates(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    if let Err(error) = app.run_on_main_thread(macos::refresh_updates) {
        eprintln!("could not refresh updates: {error}");
    }
}
