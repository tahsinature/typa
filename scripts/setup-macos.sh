#!/usr/bin/env bash
# Setup script for typa on a fresh macOS machine.
# Installs Xcode Command Line Tools, Rust (rustup), bun, then runs `bun install`.
# Idempotent — safe to re-run; existing installs are skipped.

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This setup script is macOS-only. Detected: $(uname -s)"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

step() { printf "\n\033[1;34m==>\033[0m %s\n" "$1"; }
ok()   { printf "\033[1;32m✓\033[0m %s\n" "$1"; }

# 1. Xcode Command Line Tools (provides clang, git, linker)
step "Checking Xcode Command Line Tools"
if xcode-select -p >/dev/null 2>&1; then
  ok "Xcode Command Line Tools already installed ($(xcode-select -p))"
else
  echo "Triggering installer — accept the GUI prompt that appears."
  xcode-select --install || true
  # Wait for the GUI install to finish before continuing.
  until xcode-select -p >/dev/null 2>&1; do
    sleep 5
    echo "  …waiting for Xcode Command Line Tools to finish installing"
  done
  ok "Xcode Command Line Tools installed"
fi

# 2. Rust (via rustup)
step "Checking Rust toolchain"
if command -v cargo >/dev/null 2>&1; then
  ok "Rust already installed ($(cargo --version))"
else
  echo "Installing rustup…"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
  ok "Rust installed ($(cargo --version))"
fi

# 3. bun
step "Checking bun"
if command -v bun >/dev/null 2>&1; then
  ok "bun already installed ($(bun --version))"
else
  echo "Installing bun…"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  ok "bun installed ($(bun --version))"
fi

# 4. Install JS dependencies (workspace install from repo root — covers
#    apps/desktop and packages/engine; @tauri-apps/cli ships with the desktop
#    app's devDependencies, so no separate `cargo install tauri-cli` is needed).
step "Installing JS dependencies (bun install)"
cd "$REPO_ROOT"
bun install
ok "Dependencies installed"

printf "\n\033[1;32mAll set.\033[0m Run \`make dev\` to start the desktop app.\n"
printf "If this is the first time installing Rust or bun, open a new terminal\n"
printf "(or source ~/.cargo/env and ~/.bun/_bun) so the PATH updates take effect.\n"
