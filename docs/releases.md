# Releasing Typa

Releases are automatic. Every push to `master` builds Typa, publishes a GitHub release, ships an in-app update and updates the Homebrew cask. There is nothing to run by hand.

## Quick version

1. Write commit messages with a type prefix (see below).
2. Push to `master`.
3. Watch the **Release** workflow in the Actions tab. When it is green, installed copies of Typa offer the update and Homebrew users can upgrade.

## How the version is chosen

`scripts/next-version.sh` reads the commit messages since the last `v*` tag and picks the bump:

| Commit message | Bump | Example |
| --- | --- | --- |
| `feat!: ...` (any type with `!`) or a body line starting with `BREAKING CHANGE:` | major | 1.4.2 → 2.0.0 |
| `feat: ...` or `feat(scope): ...` | minor | 1.4.2 → 1.5.0 |
| anything else (`fix:`, `chore:`, no prefix, ...) | patch | 1.4.2 → 1.4.3 |

The biggest bump wins. One `feat:` among ten `fix:` commits makes a minor release.

Preview the next version locally:

```sh
scripts/next-version.sh          # what a push would release
scripts/next-version.sh minor    # force a bump type
```

It prints nothing when there are no commits since the last tag.

## What the workflow does

`.github/workflows/release.yml` runs these jobs in order:

1. **version** picks the next version. With no new commits, every later job is skipped.
2. **test** runs the engine tests and the release script tests. A failure stops the release.
3. **draft** creates a draft GitHub release `vX.Y.Z` whose notes list the commit subjects since the previous release.
4. **build** stamps the version into `package.json`, `Cargo.toml` and `tauri.conf.json` (not committed), builds a universal (Apple Silicon and Intel) app and DMG, signs the updater archive, uploads everything with `latest.json`, and checks the macOS signatures.
5. **publish** publishes the draft. This creates the tag, and installed copies of Typa now see the update.
6. **homebrew** copies `packaging/typa.rb` into the tap with the new `version` and `sha256`.

Releases run one at a time in push order, so two quick pushes never claim the same version. If any job fails, the release stays a draft and nothing reaches users.

### Adding Windows or Linux

The **build** job is a matrix with one `macos` row. To ship another platform, add a row with its runner and Tauri `args` (for example `--bundles nsis` on `windows-latest`, or `--bundles appimage,deb` on `ubuntu-22.04` plus the Tauri Linux packages). Builds run one at a time, so each merges its platforms into the same `latest.json`. Steps that only apply to macOS check `matrix.platform == 'macos'`.

## Releasing on demand

To release without a new commit, or to force a bump type, open **Actions → Release → Run workflow** and choose `auto`, `patch`, `minor` or `major`. With `auto` and no new commits, the run does nothing.

## Homebrew

Users install with:

```sh
brew tap tahsinature/tap
brew trust tahsinature/tap    # Homebrew 7+ refuses casks from taps you have not trusted
brew install --cask typa
```

The cask lives in [tahsinature/homebrew-tap](https://github.com/tahsinature/homebrew-tap) at `Casks/typa.rb`. Its source of truth is `packaging/typa.rb` in this repository. Edit that file, not the tap, because the workflow overwrites the tap copy on every release.

The workflow pushes to the tap with the `HOMEBREW_TAP_TOKEN` repository secret: a fine-grained personal access token limited to the `homebrew-tap` repository with **Contents: Read and write**. If the secret is missing, the release still happens and the workflow logs a warning instead of updating the cask.

```sh
gh secret set HOMEBREW_TAP_TOKEN -R tahsinature/typa    # paste the token
```

## One-time setup

### Updater signing key

In-app updates are signed with a Tauri updater key. Generate it outside the repository:

```sh
mkdir -p "$HOME/.config/typa"
cd apps/desktop
bunx tauri signer generate -w "$HOME/.config/typa/updater.key"
```

Keep the private key and its password backed up. Installed copies trust this key, so losing it means they can no longer receive updates.

In GitHub Settings → Secrets and variables → Actions:

| Type | Name | Value |
| --- | --- | --- |
| Variable | `TAURI_UPDATER_PUBLIC_KEY` | Contents of `updater.key.pub` |
| Secret | `TAURI_SIGNING_PRIVATE_KEY` | Contents of `updater.key` |
| Secret | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password; omit if empty |

### Apple signing (optional)

For Developer ID signing and notarization, add `APPLE_CERTIFICATE` (base64 `.p12`), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific password) and `APPLE_TEAM_ID`. See [Tauri's signing guide](https://v2.tauri.app/distribute/sign/macos/). Without them the app is signed ad hoc.

## Things to know

- **The app is not notarized** unless the Apple secrets are set. The cask removes the quarantine flag after install so the app opens. People who download the DMG directly have to right-click → Open the first time.
- **Version files in the repository are not updated.** Only release builds get the real version. You do not need to edit them when releasing.
- **Do not create `v*` tags by hand.** The workflow treats the latest tag as the last release, so a manual tag changes the next version number.
- **Do not replace assets of a published release.** Push a fix instead, which ships as a new version.
- **A broken release** can be removed with `gh release delete vX.Y.Z --cleanup-tag`. Installed copies that already updated keep that version until the next release.
