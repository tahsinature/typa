<p align="center">
  <img src="apps/desktop/src-tauri/icons/128x128.png" width="128" height="128" alt="Typa">
</p>

<h1 align="center">Typa</h1>

<p align="center">
  A fast desktop scratchpad for math, text and everyday developer tools.
</p>

<p align="center">
  <a href="https://github.com/tahsinature/typa/releases/latest"><img src="https://img.shields.io/github/v/release/tahsinature/typa?style=flat-square&label=release&color=8b5cf6" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-111?style=flat-square&logo=apple" alt="macOS on Apple Silicon and Intel">
  <img src="https://img.shields.io/badge/license-MIT-555?style=flat-square" alt="MIT license">
</p>

---

- **Calculator**: Write math in plain words, like `20% of 350` or `120 km / 1.5 h in mph`. Results appear beside each line.
- **Units and currencies**: Convert length, mass, data, energy and more, plus live exchange rates (`$30 in EUR`).
- **Sheets**: Name values with `rent = 1200`, add headings and comments, and total a block with `sum`. Select lines to see their sum and average.
- **Transforms**: Press `⌘K` for encoding, hashing, JSON, case changes, line tools, JWT, UUIDs, timestamps and more.
- **Viewers**: See results as JSON trees and diagrams, sortable tables, text and image diffs, Mermaid charts or code screenshots.
- **Editor**: Monaco with side-by-side or stacked panes, dark and light themes, and keyboard shortcuts for everything.

## Install

```sh
brew tap tahsinature/tap
brew trust tahsinature/tap
brew install --cask typa
```

Or download the `.dmg` from the [latest release](https://github.com/tahsinature/typa/releases/latest). Typa updates itself from inside the app.

## Development

```sh
bun install
bun run --filter @typa/desktop tauri dev   # run the app
bun run --filter @typa/engine test         # run engine tests
```

The calculator and transforms live in `packages/engine`, a standalone package with no DOM dependencies. The Tauri and React app lives in `apps/desktop`.

## Docs

[Releasing](docs/releases.md)

## License

MIT © 2026 Mohammad Tahsin
