.PHONY: setup dev build dmg clean size

# One-time setup on a fresh macOS machine (Xcode CLT, Rust, bun, deps)
setup:
	./scripts/setup-macos.sh

# Run dev server
dev:
	cd apps/desktop && bunx tauri dev

# Build release binary + bundles (DMG, .app)
build:
	cd apps/desktop && bunx tauri build --bundles dmg,app

# Build and show DMG path + size
dmg: build
	@echo ""
	@echo "=== Bundle sizes ==="
	@ls -lh apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null || echo "No DMG found"
	@ls -lh apps/desktop/src-tauri/target/release/bundle/macos/*.app 2>/dev/null || echo "No .app found"
	@ls -lh apps/desktop/src-tauri/target/release/typa 2>/dev/null || echo "No binary found"

# Just check sizes (after a previous build)
size:
	@echo "=== Bundle sizes ==="
	@ls -lh apps/desktop/src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null || echo "No DMG found — run 'make dmg' first"
	@ls -lh apps/desktop/src-tauri/target/release/bundle/macos/*.app 2>/dev/null || echo "No .app found"
	@ls -lh apps/desktop/src-tauri/target/release/typa 2>/dev/null || echo "No binary found"

# Clean Rust build artifacts
clean:
	cd apps/desktop/src-tauri && cargo clean

# Open dev server in browser
open:
	open http://localhost:1420
