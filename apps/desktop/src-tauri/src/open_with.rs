//! "Open With" support: lists apps that can open PNG images and opens an image with one of them.

use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageApp {
    name: String,
    path: String,
    /// Small PNG icon bytes.
    icon: Vec<u8>,
    is_default: bool,
}

fn cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("open-with");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Removes images written by earlier "Open With" calls.
pub fn clear_cache(app: &tauri::AppHandle) {
    if let Ok(dir) = cache_dir(app) {
        let _ = std::fs::remove_dir_all(dir);
    }
}

#[tauri::command]
pub async fn list_image_apps(app: tauri::AppHandle) -> Result<Vec<ImageApp>, String> {
    // Launch Services resolves handlers from a file, so an empty `.png` stands in for the image.
    let probe = cache_dir(&app)?.join("probe.png");
    if !probe.exists() {
        std::fs::write(&probe, []).map_err(|e| e.to_string())?;
    }
    Ok(macos::apps_for_file(&probe))
}

/// Receives PNG bytes as the raw request body with `app-path` and `file-name` headers.
#[tauri::command]
pub async fn open_image_with(app: tauri::AppHandle, request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(png_data) = request.body() else {
        return Err("Expected raw PNG bytes".into());
    };
    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| format!("Missing {name}"))
    };
    let app_path = header("app-path")?;
    let file = cache_dir(&app)?.join(Path::new(header("file-name")?).file_name().ok_or("Invalid file name")?);
    std::fs::write(&file, png_data).map_err(|e| e.to_string())?;

    let status = std::process::Command::new("open")
        .arg("-a")
        .arg(app_path)
        .arg(&file)
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() { Ok(()) } else { Err(format!("Could not open the image with {app_path}")) }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::ImageApp;
    use objc2::AllocAnyThread;
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSWorkspace};
    use objc2_foundation::{NSDictionary, NSPoint, NSRect, NSSize, NSString, NSURL};
    use std::collections::HashSet;
    use std::path::Path;

    const ICON_SIZE: f64 = 64.0;

    pub fn apps_for_file(file: &Path) -> Vec<ImageApp> {
        let workspace = NSWorkspace::sharedWorkspace();
        let url = NSURL::fileURLWithPath(&NSString::from_str(&file.to_string_lossy()));
        let default_path = workspace
            .URLForApplicationToOpenURL(&url)
            .and_then(|app| app.path())
            .map(|path| path.to_string());

        let mut seen = HashSet::new();
        let mut apps: Vec<ImageApp> = workspace
            .URLsForApplicationsToOpenURL(&url)
            .iter()
            .filter_map(|app_url| {
                let path = app_url.path()?.to_string();
                let name = Path::new(&path).file_stem()?.to_string_lossy().into_owned();
                // The same app can be registered from several locations; keep the first.
                if !seen.insert(name.clone()) {
                    return None;
                }
                Some(ImageApp {
                    icon: icon_png(&workspace, &path).unwrap_or_default(),
                    is_default: default_path.as_deref() == Some(path.as_str()),
                    name,
                    path,
                })
            })
            .collect();

        apps.sort_by(|a, b| b.is_default.cmp(&a.is_default).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
        apps
    }

    fn icon_png(workspace: &NSWorkspace, app_path: &str) -> Option<Vec<u8>> {
        let image = workspace.iconForFile(&NSString::from_str(app_path));
        let mut rect = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(ICON_SIZE, ICON_SIZE));
        let cg_image = unsafe { image.CGImageForProposedRect_context_hints(&mut rect, None, None) }?;
        let bitmap = NSBitmapImageRep::initWithCGImage(NSBitmapImageRep::alloc(), &cg_image);
        let png = unsafe { bitmap.representationUsingType_properties(NSBitmapImageFileType::PNG, &NSDictionary::new()) }?;
        Some(png.to_vec())
    }
}

#[cfg(not(target_os = "macos"))]
mod macos {
    pub fn apps_for_file(_file: &std::path::Path) -> Vec<super::ImageApp> {
        Vec::new()
    }
}
