//! Shared settings for the native preferences window and editor webviews.
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub theme: String,
    pub layout: String,
    pub sidebar_open: bool,
    pub font_size: u8,
    pub palette_style: String,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            layout: "horizontal".into(),
            sidebar_open: true,
            font_size: 13,
            palette_style: "raycast".into(),
        }
    }
}

impl Preferences {
    fn validate(&self) -> Result<(), String> {
        if !matches!(self.theme.as_str(), "system" | "light" | "dark")
            || !matches!(self.layout.as_str(), "horizontal" | "vertical")
            || !matches!(self.palette_style.as_str(), "raycast" | "linear" | "arc")
            || !(8..=32).contains(&self.font_size)
        {
            return Err("Invalid preferences".into());
        }
        Ok(())
    }
}

pub fn read(app: &AppHandle) -> Result<Option<Preferences>, String> {
    let store = app.store("preferences.json").map_err(|e| e.to_string())?;
    store
        .get("settings")
        .map(|value| {
            let settings: Preferences = serde_json::from_value(value).map_err(|e| e.to_string())?;
            settings.validate()?;
            Ok(settings)
        })
        .transpose()
}

// Import localStorage once. Subsequent launches use the native store.
#[tauri::command]
pub fn load_preferences(app: AppHandle, fallback: Preferences) -> Result<Preferences, String> {
    if let Some(settings) = read(&app)? {
        return Ok(settings);
    }
    save_preferences(app, fallback.clone())?;
    Ok(fallback)
}

#[tauri::command]
pub fn save_preferences(app: AppHandle, settings: Preferences) -> Result<(), String> {
    if update(&app, &settings)? {
        crate::preferences::refresh(&app);
    }
    Ok(())
}

pub fn update(app: &AppHandle, settings: &Preferences) -> Result<bool, String> {
    settings.validate()?;
    if read(app)?.as_ref() == Some(settings) {
        return Ok(false);
    }
    let store = app.store("preferences.json").map_err(|e| e.to_string())?;
    let previous = store.get("settings");
    store.set(
        "settings",
        serde_json::to_value(settings).map_err(|e| e.to_string())?,
    );
    if let Err(error) = store.save() {
        if let Some(previous) = previous {
            store.set("settings", previous);
        } else {
            store.delete("settings");
        }
        return Err(error.to_string());
    }
    app.emit("preferences-changed", settings)
        .map_err(|e| e.to_string())?;
    Ok(true)
}
