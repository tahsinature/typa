# Typa

A universal developer scratchpad that combines a smart calculator, text transforms, and dev utilities into one fast, native desktop app. Think **Numi** + **Boop** + **DevUtils** — unified.

Type math expressions with natural language, convert units and currencies in real time, diff text and images, render diagrams, generate code screenshots, and run 48+ developer transforms — all from a single window with a Monaco-powered editor.

## Features

### Smart Calculator

Typa's calculator goes beyond basic math. It understands natural language, tracks variables across lines, and handles units, currencies, and percentages out of the box.

- **Natural language operators** — `200 plus 50`, `half of 400`, `triple 15`, `10% of 500`
- **Percentage arithmetic** — `100 + 10%` → 110, `15% off 200` → 170, `50 as % of 200` → 25%
- **Line references** — `prev`, `line1`, `sum`, `avg` to reference and aggregate previous results
- **Variable assignment** — `price = 49.99` and reuse across lines
- **Unit conversion** — length, weight, temperature, time, data sizes, CSS units (`px`, `em`, `pt`), and more
- **Live currency conversion** — 40+ currencies with live exchange rates (`$100 to EUR`, `500 yen in GBP`)
- **Time & date** — `now`, `today`, `tomorrow`, Unix timestamp conversion
- **Number bases** — hex, binary, octal conversions
- **Number scales** — `2.5M`, `100k`, `3 billion`

### 48+ Developer Transforms

Organized by category, accessible instantly via `Cmd+K`:

| Category | Transforms |
|---|---|
| **Encoding** | Base64, URL, HTML entities, Unicode escape/unescape |
| **Hashing** | SHA-1, SHA-256, SHA-384, SHA-512 |
| **Formatting** | Sort/reverse/unique/trim lines, case conversions (camel, pascal, snake, kebab, title) |
| **JSON** | Format, minify, validate |
| **Web** | JWT decode, query string ↔ JSON, UUID generation, Unix timestamp ↔ date |
| **Numbers** | Hex/decimal/binary/octal conversions, hex color ↔ RGB |
| **Diff** | Text diff, visual image comparison (slider, fade, split, highlight) |
| **Visual** | Code-to-image screenshots, Mermaid diagram rendering |

### Rich Viewers

Transforms output to specialized, interactive viewers:

- **JSON tree** — collapsible tree with copy support
- **JSON diagram** — visual node-link graph
- **Table** — sortable, filterable columns with search
- **Diff** — unified diff and side-by-side Monaco diff
- **Image comparison** — slider, fade, split, and highlight modes
- **Code image** — 8 themes, 20+ languages, PNG export
- **Mermaid** — flowcharts, sequence diagrams, Gantt charts, and more

### Editor & UI

- **Monaco Editor** with syntax highlighting and command palette
- **Dual-pane layout** — resizable side-by-side or stacked
- **Transform picker** — fuzzy search with `Cmd+K`
- **Dark/light theme** with system detection
- **Keyboard-first** — `Cmd+S` save, `Cmd+P` open, `Cmd+K` transforms, zoom controls

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop | Tauri 2.x |
| Frontend | React 19, TypeScript, Vite 6 |
| Editor | Monaco Editor |
| Math | math.js |
| State | Zustand |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI |
| Diagrams | Mermaid, React Flow, Dagre |
| Tables | TanStack Table |
| Testing | Vitest |

## Architecture

```
typa/
├── packages/
│   └── engine/          # Standalone math + transform engine (zero DOM deps)
│       ├── preprocessor  # Natural language → math.js expressions
│       ├── postprocessor  # Result formatting, units, dates
│       ├── transforms/    # Self-registering transform modules
│       └── scope          # Variable tracking, line references
├── apps/
│   └── desktop/         # Tauri + React desktop app
│       ├── components/   # UI (TabBar, DualPane, StatusBar)
│       ├── viewers/      # Interactive result renderers
│       └── stores/       # Zustand state (engine, settings)
└── bun.lock
```

The engine is a **standalone package** (`@typa/engine`) with no DOM dependencies — it can be used independently in CLI tools or other environments.

## Getting Started

For macOS installation, Homebrew setup, and automatic updates, see
[Releases and Homebrew](docs/releases.md). Homebrew becomes available after the
first release and cask workflow complete.

```bash
# Install dependencies
bun install

# Run the desktop app
bun run --filter @typa/desktop tauri dev

# Run engine tests
bun run --filter @typa/engine test
```

## License

MIT
