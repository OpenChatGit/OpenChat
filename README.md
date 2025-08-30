# OpenChat

Local-first desktop chat app built with Tauri and vanilla HTML/CSS/JS. Fast UX, clean design, and native streaming via Ollama.

— [Changelog](CHANGELOG.md) • [License](LICENSE.md)


## Features
- **Reasoning streaming (new)**: Live reasoning updates in a dropdown, final answer renders instantly. Implemented in `OpenChat/src/ai/stream_reasoning.js`.
- **Non-reasoning streaming**: Smooth typewriter effect at 10 ms/char (fast) via `OpenChat/src/ai/stream_simple.js`.
- **Responsive first message UX**: Instant render of user message and “Thinking…” indicator.
- **Clean UI**: Minimal thinking indicator with shimmer, centered welcome layout, custom overlay scrollbar.
- **Conversations sidebar**: Titles/timestamps update live; rename/delete with confirm.
- **Local Ollama via Tauri**: Native streaming with `generate_ai_response_stream` and events (`ai_token`, `ai_done`, `ai_error`).
- **Theming tokens**: Dark-first; light theme variables ready.


## Project Structure
- `OpenChat/src/` — Frontend (HTML, CSS, JS)
  - `index.html` — Main UI markup
  - `styles.css` — Global styles (overlay scrollbar, layout, animations)
  - `main.js` — App logic and routing for simple vs. reasoning streaming
  - `ai/stream_simple.js` — Non-reasoning streaming (typewriter)
  - `ai/stream_reasoning.js` — Reasoning streaming (live dropdown + instant final)
- `OpenChat/src-tauri/` — Tauri backend (Ollama streaming, websearch cmd, warmup)
- `templates/`, `static/`, `app.py`, `main.py` — Additional files (not required for Tauri app)


## Requirements
- Windows (tested). macOS/Linux should also work per Tauri prerequisites.
- Rust toolchain (stable) and Tauri CLI
- Node.js optional (tooling only)
- Optional: **Ollama** running locally for model-backed responses


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

### Reasoning vs. Non-Reasoning
- If a reasoning model is selected, streaming runs via `stream_reasoning.js`:
  - Live reasoning appears in a dropdown while generating.
  - Final answer renders instantly (no typewriter) once `[FINAL]`/`</think>`/heading is detected.
- For standard models, streaming uses `stream_simple.js` with fast typewriter (10 ms/char).


## Configuration
- Selected Ollama model is saved in `localStorage` and restored between sessions.
- Dark mode by default; light theme variables live in `styles.css`.

## Websearch status
- Websearch is temporarily disabled to reduce hallucination risk. Features relying on it (web citations, enrichment) are inactive for now.


## Changelog
See the full history in [CHANGELOG.md](CHANGELOG.md).


## Roadmap
- Message persistence (store conversations on disk)
- Export/import conversations
- Settings panel (themes, typewriter speed, scrollbar preferences)
- Enhanced streaming controls (pause/cancel, retries)
- Multi-model selection UI and status


## Troubleshooting
- "Backend not available" in console: Run via Tauri (not a plain browser) so `invoke` calls work.
- No Ollama models detected: Ensure `http://127.0.0.1:11434/api/tags` is reachable and Ollama is running.
- Reasoning stream shows but flashes on fullscreen: known issue; being investigated in CSS (`styles.css`) and FLIP logic in `main.js`.
- Build issues on Windows: Re-check Tauri prerequisites (MSVC, WebView2) per official docs.


## License
This project is licensed under the PolyForm Noncommercial License 1.0.0. See `LICENSE.md` for details.

Commercial use is not permitted under this license. To use OpenChat commercially, please contact the project owner to obtain a separate commercial license.
