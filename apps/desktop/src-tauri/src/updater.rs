//! Updates stay in Preferences. Startup checks never download, install, or open dialogs.
mod state;
pub use state::{snapshot, Failure, Phase, Snapshot};

use state::STATE;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};
use tauri::AppHandle;
use tauri_plugin_updater::{Update, UpdaterExt};

fn refresh(app: &AppHandle) {
    crate::preferences::refresh_updates(app);
}

pub fn check(app: AppHandle) {
    {
        let mut state = STATE.lock().unwrap();
        if state.snapshot.phase.is_busy() || state.bytes.is_some() {
            return;
        }
        state.snapshot.phase = Phase::Checking;
        state.snapshot.error = None;
    }
    refresh(&app);
    tauri::async_runtime::spawn(async move {
        let configured = app
            .config()
            .plugins
            .0
            .get("updater")
            .and_then(|config| config.get("pubkey"))
            .and_then(|key| key.as_str())
            .is_some_and(|key| !key.trim().is_empty());
        if !configured {
            STATE.lock().unwrap().snapshot.phase = Phase::Unconfigured;
            refresh(&app);
            return;
        }
        match find_update(&app).await {
            Ok(update) => {
                let mut state = STATE.lock().unwrap();
                state.snapshot = Snapshot {
                    phase: if update.is_some() {
                        Phase::Available
                    } else {
                        Phase::UpToDate
                    },
                    version: update.as_ref().map(|update| update.version.clone()),
                    notes: update.as_ref().and_then(|update| update.body.clone()),
                    last_checked: Some(SystemTime::now()),
                    ..Snapshot::default()
                };
                state.update = update;
            }
            Err(error) => state::fail(Failure::Check, error),
        }
        refresh(&app);
    });
}

async fn find_update(app: &AppHandle) -> Result<Option<Update>, String> {
    app.updater_builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())
}

/// Each operation claims its state under the lock, so repeated clicks cannot start duplicate work.
pub fn advance(app: AppHandle) {
    match snapshot().phase {
        Phase::Available | Phase::Failed(Failure::Download) => download(app),
        Phase::Ready | Phase::Failed(Failure::Install) => install(app),
        phase if !phase.is_busy() => check(app),
        _ => {}
    }
}

fn download(app: AppHandle) {
    let update = {
        let mut state = STATE.lock().unwrap();
        if !matches!(
            state.snapshot.phase,
            Phase::Available | Phase::Failed(Failure::Download)
        ) {
            return;
        }
        let Some(mut update) = state.update.clone() else {
            return;
        };
        update.timeout = Some(Duration::from_secs(10 * 60));
        state.snapshot.phase = Phase::Downloading;
        state.snapshot.error = None;
        state.snapshot.downloaded = 0;
        state.snapshot.total = None;
        update
    };
    refresh(&app);
    tauri::async_runtime::spawn(async move {
        let mut last_refresh = Instant::now();
        let result = update
            .download(
                |chunk, total| {
                    {
                        let mut state = STATE.lock().unwrap();
                        state.snapshot.downloaded += chunk as u64;
                        state.snapshot.total = total.filter(|total| *total > 0);
                    }
                    // Keep AppKit responsive without queuing a UI refresh for every network chunk.
                    if last_refresh.elapsed() >= Duration::from_millis(100) {
                        refresh(&app);
                        last_refresh = Instant::now();
                    }
                },
                || {
                    STATE.lock().unwrap().snapshot.phase = Phase::Verifying;
                    refresh(&app);
                },
            )
            .await;
        match result {
            Ok(bytes) => {
                let mut state = STATE.lock().unwrap();
                state.bytes = Some(Arc::new(bytes));
                state.snapshot.phase = Phase::Ready;
            }
            Err(error) => state::fail(Failure::Download, error.to_string()),
        }
        refresh(&app);
    });
}

fn install(app: AppHandle) {
    let (update, bytes) = {
        let mut state = STATE.lock().unwrap();
        if !matches!(
            state.snapshot.phase,
            Phase::Ready | Phase::Failed(Failure::Install)
        ) {
            return;
        }
        let (Some(update), Some(bytes)) = (state.update.clone(), state.bytes.clone()) else {
            return;
        };
        state.snapshot.phase = Phase::Installing;
        state.snapshot.error = None;
        (update, bytes)
    };
    refresh(&app);
    tauri::async_runtime::spawn(async move {
        let result = tauri::async_runtime::spawn_blocking(move || update.install(bytes.as_slice()))
            .await
            .map_err(|error| error.to_string())
            .and_then(|result| result.map_err(|error| error.to_string()));
        match result {
            Ok(()) => {
                STATE.lock().unwrap().snapshot.phase = Phase::Restarting;
                refresh(&app);
                app.request_restart();
            }
            Err(error) => {
                state::fail(Failure::Install, error);
                refresh(&app);
            }
        }
    });
}
