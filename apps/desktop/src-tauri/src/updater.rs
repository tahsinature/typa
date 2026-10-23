use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

// Shared across all windows and menu clicks, including download/install.
static CHECKING: AtomicBool = AtomicBool::new(false);

struct CheckGuard;

impl Drop for CheckGuard {
    fn drop(&mut self) {
        CHECKING.store(false, Ordering::Release);
    }
}

pub fn check(app: AppHandle, manual: bool) {
    if CHECKING.swap(true, Ordering::AcqRel) {
        return;
    }

    tauri::async_runtime::spawn(async move {
        let _guard = CheckGuard;
        if let Err(error) = check_and_install(&app, manual).await {
            eprintln!("update check failed: {error}");
            if manual {
                app.dialog()
                    .message("Could not check for updates. Please try again later.")
                    .title("Typa Updates")
                    .kind(MessageDialogKind::Error)
                    .show(|_| {});
            }
        }
    });
}

async fn check_and_install(app: &AppHandle, manual: bool) -> Result<(), String> {
    let configured = app
        .config()
        .plugins
        .0
        .get("updater")
        .and_then(|config| config.get("pubkey"))
        .and_then(|key| key.as_str())
        .is_some_and(|key| !key.trim().is_empty());

    if !configured {
        if manual {
            app.dialog()
                .message("Updates are not configured in this local build. Install an official release to receive updates.")
                .title("Typa Updates")
                .show(|_| {});
        }
        return Ok(());
    }

    let updater = app
        .updater_builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;
    let Some(mut update) = updater.check().await.map_err(|error| error.to_string())? else {
        if manual {
            app.dialog()
                .message("You’re using the latest version of Typa.")
                .title("Typa Updates")
                .show(|_| {});
        }
        return Ok(());
    };

    // Native blocking dialogs run on a worker thread, never the UI thread.
    let dialog = app
        .dialog()
        .message(format!(
            "Typa {} is available. Download it now? You can keep working while it downloads.",
            update.version
        ))
        .title("Update Available")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Download Update".into(),
            "Later".into(),
        ));
    let accepted = tauri::async_runtime::spawn_blocking(move || dialog.blocking_show())
        .await
        .map_err(|error| error.to_string())?;
    if !accepted {
        return Ok(());
    }

    // A quick manifest check must not impose a 30-second limit on a large download.
    update.timeout = Some(Duration::from_secs(10 * 60));
    let bytes = match update.download(|_, _| {}, || {}).await {
        Ok(bytes) => bytes,
        Err(error) => {
            eprintln!("update download failed: {error}");
            show_install_error(
                app,
                "The update could not be downloaded. Please try again later.",
            );
            return Ok(());
        }
    };
    let dialog = app.dialog()
        .message("The update is ready. Installing will restart Typa and close all open tabs. If you have unsaved work in any window, choose Later and save it first.")
        .title("Install Typa Update")
        .buttons(MessageDialogButtons::OkCancelCustom("Install and Restart".into(), "Later".into()));
    let accepted = tauri::async_runtime::spawn_blocking(move || dialog.blocking_show())
        .await
        .map_err(|error| error.to_string())?;
    if accepted {
        if let Err(error) = update.install(bytes) {
            eprintln!("update install failed: {error}");
            show_install_error(app, "The update could not be installed. Move Typa to Applications and try again, or download the latest release manually.");
            return Ok(());
        }
        app.restart();
    }
    Ok(())
}

fn show_install_error(app: &AppHandle, message: &str) {
    app.dialog()
        .message(message)
        .title("Typa Update Failed")
        .kind(MessageDialogKind::Error)
        .show(|_| {});
}
