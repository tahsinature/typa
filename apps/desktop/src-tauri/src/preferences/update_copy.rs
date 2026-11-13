use crate::updater::{Failure, Phase, Snapshot};

pub struct Content {
    pub title: String,
    pub detail: &'static str,
    pub button: &'static str,
    pub symbol: &'static str,
}

pub fn content(state: &Snapshot) -> Content {
    let version = state.version.as_deref().unwrap_or("the latest version");
    let (title, detail, button, symbol) = match state.phase {
        Phase::Idle => ("Keep Typa up to date".into(), "Get the latest improvements, fixes, and tools. Check for an update whenever you like.", "Check for Updates", "arrow.triangle.2.circlepath.circle"),
        Phase::Checking => ("Checking for updates…".into(), "Looking for the latest version of Typa. This usually takes just a moment.", "Checking…", "arrow.triangle.2.circlepath.circle"),
        Phase::UpToDate => ("You're up to date".into(), "You're running the latest version of Typa. You're all set.", "Check for Updates", "checkmark.circle.fill"),
        Phase::Available => (format!("Typa {version} is available"), "A new version is ready to download. You can keep working and install it when you're ready.", "Download Update", "arrow.down.circle.fill"),
        Phase::Downloading => ("Downloading your update…".into(), "You can keep using Typa. Closing Preferences won't interrupt the download.", "Downloading…", "arrow.down.circle.fill"),
        Phase::Verifying => ("Verifying your update…".into(), "Making sure your download is complete and comes from Typa before it can be installed.", "Verifying…", "checkmark.shield.fill"),
        Phase::Ready => ("Ready when you are".into(), "Save any unsaved work before continuing. Installing will close all Typa windows and restart the app.", "Install and Restart", "checkmark.circle.fill"),
        Phase::Installing => ("Installing your update…".into(), "Please keep Typa open while the update is installed. The app will restart automatically when it's ready.", "Installing…", "gearshape.2.fill"),
        Phase::Restarting => ("Restarting Typa…".into(), "Your update is installed. Typa will open again shortly.", "Restarting…", "checkmark.circle.fill"),
        Phase::Unconfigured => ("Get updates with an official release".into(), "This copy of Typa doesn't support in-app updates. Download an official release to receive future updates here.", "View Releases…", "info.circle.fill"),
        Phase::Failed(Failure::Check) => ("Couldn't check for updates".into(), "Check your internet connection and try again. You can keep using Typa in the meantime.", "Try Again", "exclamationmark.triangle.fill"),
        Phase::Failed(Failure::Download) => {
            let detail = if state.error.as_deref().unwrap_or_default().to_lowercase().contains("signature") {
                "This download couldn't be verified. Try downloading a fresh copy of the update."
            } else {
                "The download couldn't be completed. Check your connection and try again."
            };
            ("Let's try that download again".into(), detail, "Retry Download", "exclamationmark.triangle.fill")
        }
        Phase::Failed(Failure::Install) => ("Couldn't install the update".into(), "Move Typa to Applications if needed, then try again. You can also install the latest release manually.", "Retry Installation", "exclamationmark.triangle.fill"),
    };
    Content {
        title,
        detail,
        button,
        symbol,
    }
}

pub fn readable_notes(notes: &str) -> String {
    notes
        .lines()
        .map(|line| {
            let line = line.trim_start_matches('#').trim();
            line.strip_prefix("- ")
                .map_or_else(|| line.to_string(), |text| format!("• {text}"))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn download_detail(state: &Snapshot) -> String {
    fn size(bytes: u64) -> String {
        if bytes >= 1_000_000 {
            format!("{:.1} MB", bytes as f64 / 1_000_000.0)
        } else {
            format!("{:.0} KB", bytes as f64 / 1_000.0)
        }
    }
    match state.total {
        Some(total) => format!(
            "{} of {}  ·  {:.0}%",
            size(state.downloaded),
            size(total),
            (state.downloaded as f64 / total as f64 * 100.0).min(100.0)
        ),
        None => format!("{} downloaded", size(state.downloaded)),
    }
}
