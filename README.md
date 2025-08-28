# OpenChat

A lightweight, local-first desktop chat app built with Tauri and vanilla HTML/CSS/JS. Optimized for fast, responsive UX and a clean, centered layout with a custom overlay scrollbar.

— [Changelog](CHANGELOG.md) • [License](LICENSE.md)


## Features
- **Responsive first message UX**: User messages and the “Thinking…” indicator render instantly, even on a fresh start or after deleting a chat.
- **Thinking indicator (English)**: Plain text with a subtle left-to-right shimmer effect for a modern, minimal look.
- **Typewriter effect for AI**: Assistant messages render with a typewriter animation, then swap to fully formatted Markdown.
- **Custom overlay scrollbar**: Pinned flush-right, light-gray thumb, with the native scrollbars hidden in the messages area.
- **Centered welcome layout**: New sessions show a centered input and welcome prompt, then transition smoothly to chat mode.
- **Conversations sidebar**: Auto-updating titles, timestamps, rename, and delete with a confirm flow.
- **Local Ollama integration (optional)**: Detects local Ollama and lets you pick a model. Backend responses are generated via Tauri.
- **Dark and light theme tokens**: App defaults to dark styling with variables ready for light theming.


## Project Structure
- `OpenChat/src/` — Frontend (HTML, CSS, JS)
  - `index.html` — Main UI markup
  - `styles.css` — Global styles (overlay scrollbar, layout, animations)
  - `main.js` — App logic (messages, conversations, thinking indicator, typewriter, sidebar)
- `OpenChat/src-tauri/` — Tauri Rust backend (commands, packaging)
- `templates/`, `static/`, `app.py`, `main.py` — Additional files (not required to run the Tauri app)


## Requirements
- Windows (tested), macOS/Linux should also work with Tauri prerequisites.
- Rust toolchain (stable) and Tauri CLI
- Node.js recommended (for tooling), though this app uses vanilla frontend assets.
- Optional: **Ollama** running locally for model-backed responses.


## Setup (Windows)
1. Install Rust and Tauri dependencies
   - Rust: https://www.rust-lang.org/tools/install
   - Tauri prerequisites: https://tauri.app/start/prerequisites/
   - Install the Tauri CLI:
     ```powershell
     cargo install tauri-cli
     ```
2. (Optional) Install Node.js LTS from https://nodejs.org/
3. (Optional) Install and run Ollama locally: https://ollama.com/


## Run the App
From the project root:

```powershell
# Start the Tauri app (dev)
cargo tauri dev --manifest-path .\OpenChat\src-tauri\Cargo.toml
```

If you prefer running from the `OpenChat` folder directly, ensure your working directory is set there and use:

```powershell
cargo tauri dev
```

Build a release bundle:

```powershell
cargo tauri build --manifest-path .\OpenChat\src-tauri\Cargo.toml
```


## Usage
- **Start a new chat**: Click “New chat” (compose) in the sidebar or begin typing in the centered input.
- **Send a message**: Press Enter to send (Shift+Enter for newline). Your message appears instantly.
- **Thinking**: The app shows a shimmering “Thinking…” text while the assistant generates a reply.
- **View/rename/delete chats**: Hover a conversation in the sidebar for actions. Deletion asks for confirmation.
- **Model selection**: Open the main title dropdown, choose Ollama, and pick an available local model.


## Configuration
- Selected Ollama model is saved in `localStorage` and restored between sessions.
- The app runs in dark mode by default; light theme variables are present in `styles.css`.


## Changelog
See the full history in [CHANGELOG.md](CHANGELOG.md).


## Roadmap
- Message persistence (store conversations on disk)
- Export/import conversations
- Settings panel (themes, typewriter speed, scrollbar preferences)
- Streaming responses
- Multi-model selection UI and status


## Troubleshooting
- "Backend not available" in console: Run via Tauri (not a plain browser) so `invoke` calls work.
- No Ollama models detected: Ensure `http://127.0.0.1:11434/api/tags` is reachable and Ollama is running.
- Build issues on Windows: Re-check Tauri prerequisites (MSVC, WebView2) per official docs.


## License
This project is licensed under the PolyForm Noncommercial License 1.0.0. See `LICENSE.md` for details.

Commercial use is not permitted under this license. To use OpenChat commercially, please contact the project owner to obtain a separate commercial license.
