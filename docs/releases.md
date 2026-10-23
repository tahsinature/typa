# macOS releases and Homebrew

Typa checks for updates once when a release build starts. Users can also choose
**Typa → Check for Updates…**. Checks run in the background; automatic check
failures do not interrupt work. Downloads require confirmation, signatures are
verified by Tauri, and installation requires a second confirmation to restart.
Save work in every window before installing: open tabs are not persisted.
Choosing Later discards a downloaded update; the next check can download it again.

Local builds without an updater public key skip startup checks. Normal `make dmg`
builds continue to work without release credentials. The release workflow injects
the public key and enables updater artifacts using a generated configuration file.

## One-time setup

1. Generate the updater signing key outside the repository:

   ```sh
   mkdir -p "$HOME/.config/typa"
   cd apps/desktop
   bunx tauri signer generate -w "$HOME/.config/typa/updater.key"
   ```

   Keep the private key and its password backed up securely. Existing installations
   trust this key; losing it prevents signing updates for those installations.

2. In `tahsinature/typa` GitHub Settings → Secrets and variables → Actions, set:

   | Type | Name | Value |
   | --- | --- | --- |
   | Variable | `TAURI_UPDATER_PUBLIC_KEY` | Contents of `updater.key.pub` |
   | Secret | `TAURI_SIGNING_PRIVATE_KEY` | Contents of `updater.key` |
   | Secret | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password; omit if empty |

3. For Apple Developer ID signing and notarization, add the following secrets:
   `APPLE_CERTIFICATE` (base64-encoded Developer ID Application certificate `.p12`),
   `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`,
   `APPLE_PASSWORD` (app-specific password), and `APPLE_TEAM_ID`.
   See [Tauri’s signing guide](https://v2.tauri.app/distribute/sign/macos/).
   Updater signing is separate from Apple signing. Without Apple credentials,
   distribution may trigger Gatekeeper warnings or blocks.

4. Allow GitHub Actions to write repository contents. The Homebrew workflow commits
   `Casks/typa.rb` to the default branch when a stable release is published. If branch
   protection prevents bot commits, maintain the generated cask through a pull request
   instead; the workflow will report a push failure.

No release is published and no remote secrets are configured by these source changes.

## Publish a version

1. Set the same stable version in `apps/desktop/package.json`,
   `apps/desktop/src-tauri/Cargo.toml`, and `apps/desktop/src-tauri/tauri.conf.json`.
   Run `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` to update the
   lockfile, then commit the changes.
2. Create and push its tag, for example `v0.1.0`. The **Build macOS release** workflow
   builds Apple Silicon and Intel sequentially and creates a **draft** GitHub release.
   A manual workflow run can retry an existing tag; the selected tag's source is built.
3. Wait for both builds to succeed. Check that the draft contains two DMGs, signed
   app archives, signature files, and `latest.json` with both `darwin-aarch64` and
   `darwin-x86_64` entries. Test each architecture before publishing.
4. Publish the draft in GitHub. Installed official builds now discover the update.
   **Update Homebrew cask** downloads both DMGs, hashes their contents, generates
   `Casks/typa.rb`, and commits it to the default branch. It refuses draft, prerelease,
   and older releases. You can retry it manually with the published tag.

Do not replace assets of a published version. Fixes should use a new version and tag.
The first updater-enabled version must be installed manually or through Homebrew;
older local DMG installations have no update checker.

## Install with Homebrew

After the first release is published and the cask workflow succeeds:

```sh
brew tap tahsinature/typa https://github.com/tahsinature/typa.git
brew install --cask tahsinature/typa/typa
```

This is a custom tap hosted in this repository, so the explicit repository URL is
required when first tapping it. Typa's in-app updater works for these installations
too. Homebrew records its own installed version separately from in-app updates.
Because the cask declares `auto_updates true`, opt into Homebrew-managed upgrades with:

```sh
brew update
brew upgrade --cask --greedy typa
```

If a manually installed `/Applications/Typa.app` already exists, Homebrew may refuse
to overwrite it. Quit Typa and move the old app bundle aside before installing.
Keep Typa's application data; removing the app bundle does not require deleting it.

## Verify locally

```sh
bun test scripts/release.test.mjs
bun scripts/validate-release.mjs v0.1.0
cargo check --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
```

For a real update test, install an older signed release in Applications, publish a
higher version with the same updater key, then exercise Later, download, and install
from both the startup prompt and menu. Test offline checks and read-only app locations.
Local compilation cannot validate Apple notarization or the complete published update path.
