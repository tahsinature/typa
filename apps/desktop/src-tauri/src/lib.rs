use arboard::{Clipboard, ImageData};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
fn copy_image_to_clipboard(rgba: Vec<u8>, width: u32, height: u32) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    let img = ImageData {
        width: width as usize,
        height: height as usize,
        bytes: rgba.into(),
    };
    clipboard.set_image(img).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_png_file(app: tauri::AppHandle, png_data: Vec<u8>) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel();

    app.dialog()
        .file()
        .add_filter("PNG Image", &["png"])
        .set_file_name("code.png")
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    let path = rx.recv().map_err(|e| e.to_string())?;

    match path {
        Some(path) => {
            std::fs::write(path.as_path().unwrap(), &png_data).map_err(|e| e.to_string())
        }
        None => Ok(()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![copy_image_to_clipboard, save_png_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
