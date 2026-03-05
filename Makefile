.PHONY: dev build dmg clean size

# Run dev server
dev:
	cd apps/desktop && cargo tauri dev

# Build release binary + bundles (DMG, .app)
build:
	cd apps/desktop && cargo tauri build --bundles dmg,app

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
