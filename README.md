# OpenChat

Local-first desktop chat app built with Tauri and vanilla HTML/CSS/JS. Fast UX, clean design, and native streaming via Ollama.

— [Changelog](CHANGELOG.md) • [License](LICENSE.md)


## Features
- Reasoning streaming: live reasoning in a dropdown; final answer renders instantly (`OpenChat/src/ai/stream_reasoning.js`).
- Non-reasoning streaming: smooth typewriter at ~10 ms/char (`OpenChat/src/ai/stream_simple.js`).
- Fast first-message UX: user message and “Thinking…” indicator render instantly.
- Clean UI: minimal thinking indicator, centered welcome, custom overlay scrollbar.
- Sidebar: live titles/timestamps; rename/delete with confirmation.
- Local Ollama via Tauri: native streaming via `generate_ai_response_stream` and events (`ai_token`, `ai_done`, `ai_error`).
- Title generation: lightweight model cascade and hidden directive for reasoning models (see Configuration below).
- Theming tokens: dark-first; light theme variables ready.


## Project Structure
- `OpenChat/src/` — Frontend (HTML, CSS, JS)
  - `index.html` — main UI markup
  - `styles.css` — global styles (overlay scrollbar, layout, animations)
  - `main.js` — app logic and routing for simple vs. reasoning streaming
  - `ai/stream_simple.js` — non-reasoning streaming (typewriter)
  - `ai/stream_reasoning.js` — reasoning streaming (live dropdown + instant final)
- `OpenChat/src-tauri/` — Tauri backend (Ollama streaming, websearch cmd, warmup)
- `templates/`, `static/`, `app.py`, `main.py` — additional files (not required for the Tauri app)


## Requirements
- Windows (tested). macOS/Linux should also work per Tauri prerequisites.
- Rust toolchain (stable) and Tauri CLI
- Node.js optional (tooling only)
- Optional: Ollama running locally for model-backed responses


## Quick Start (Windows)
1. Install Rust and Tauri prerequisites
   - Rust: https://www.rust-lang.org/tools/install
   - Tauri: https://tauri.app/start/prerequisites/
   - Tauri CLI:
     ```powershell
     cargo install tauri-cli
     ```
2. (Optional) Install Node.js LTS: https://nodejs.org/
3. (Optional) Install and run Ollama: https://ollama.com/
4. Run the app (dev):
   ```powershell
   cargo tauri dev --manifest-path .\OpenChat\src-tauri\Cargo.toml
   ```

## Setup (Windows)
If you prefer running from the `OpenChat` folder directly, set your working directory there and use:

```powershell
cargo tauri dev
```


## Run the App
From the repository root:

```powershell
# Start the Tauri app (dev)
cargo tauri dev --manifest-path .\OpenChat\src-tauri\Cargo.toml
```

Build a release bundle:

```powershell
cargo tauri build --manifest-path .\OpenChat\src-tauri\Cargo.toml
```


## Usage
- **Start a new chat**: Click New chat in the sidebar or start typing in the centered input.
- **Send a message**: Press Enter to send (Shift+Enter for newline). Your message appears instantly.
- **Thinking**: A shimmering “Thinking…” text is shown while the assistant generates a reply.
- **View/rename/delete chats**: Hover a conversation in the sidebar for actions. Deletion asks for confirmation.
- **Model selection**: Use the top dropdown, choose Ollama, and pick an available local model.

### Reasoning vs. Non-Reasoning
- Reasoning models (`OpenChat/src/ai/stream_reasoning.js`):
  - Live reasoning appears in a dropdown while generating.
  - Final answer renders instantly (no typewriter) once finalization is detected.
- Standard models (`OpenChat/src/ai/stream_simple.js`): fast typewriter (~10 ms/char).


## Configuration
- Selected Ollama model is saved in `localStorage` and restored between sessions.
- Dark mode by default; light theme variables are defined in `styles.css`.
- Title generation
  - For reasoning models, a hidden directive asks the model to emit `TITLE: …` during thinking; this is parsed and applied to the conversation (not shown in chat).
  - A lightweight model cascade is used for titles when available.
  - Override via localStorage (optional):
    - `titleModel` — exact model name to use for titles
    - `titleModelCandidates` — CSV of candidates to try in order
- Language selection (reasoning)
  - Based on the latest user message; optional overrides:
    - `preferredLanguage` — force a language
    - `disableLanguageDirective` — disable automatic language instruction

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
- No Ollama models detected: Ensure `http://127.0.0.1:11434/api/tags` is reachable and Ollama is running locally.
- Reasoning stream flashes on fullscreen: known issue under investigation (`styles.css`, FLIP logic in `main.js`).
- Build issues on Windows: Re-check Tauri prerequisites (MSVC, WebView2) per official docs.
- Titles not updating: set a lightweight model explicitly, e.g. in DevTools:
  ```js
  localStorage.setItem('titleModel', 'llama3.1:8b')
  // or multiple candidates
  localStorage.setItem('titleModelCandidates', 'llama3.1:8b,phi3:mini,qwen2:1.5b')
  ```


## License
This project is licensed under the PolyForm Noncommercial License 1.0.0. See `LICENSE.md` for details.

Commercial use is not permitted under this license. To use OpenChat commercially, please contact the project owner to obtain a separate commercial license.

