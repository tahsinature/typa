use std::sync::{Arc, LazyLock, Mutex};
use std::time::SystemTime;
use tauri_plugin_updater::Update;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Failure {
    Check,
    Download,
    Install,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum Phase {
    #[default]
    Idle,
    Checking,
    UpToDate,
    Available,
    Downloading,
    Verifying,
    Ready,
    Installing,
    Restarting,
    Unconfigured,
    Failed(Failure),
}

impl Phase {
    pub fn is_busy(self) -> bool {
        matches!(
            self,
            Self::Checking
                | Self::Downloading
                | Self::Verifying
                | Self::Installing
                | Self::Restarting
        )
    }

    pub fn is_installing(self) -> bool {
        matches!(self, Self::Installing | Self::Restarting)
    }
}

#[derive(Clone, Debug, Default)]
pub struct Snapshot {
    pub phase: Phase,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub last_checked: Option<SystemTime>,
    pub downloaded: u64,
    pub total: Option<u64>,
    pub error: Option<String>,
}

#[derive(Default)]
pub struct UpdateState {
    pub snapshot: Snapshot,
    pub update: Option<Update>,
    pub bytes: Option<Arc<Vec<u8>>>,
}

pub static STATE: LazyLock<Mutex<UpdateState>> =
    LazyLock::new(|| Mutex::new(UpdateState::default()));

pub fn snapshot() -> Snapshot {
    STATE.lock().unwrap().snapshot.clone()
}

pub fn fail(failure: Failure, error: String) {
    let mut state = STATE.lock().unwrap();
    state.snapshot.phase = Phase::Failed(failure);
    state.snapshot.error = Some(error);
}
