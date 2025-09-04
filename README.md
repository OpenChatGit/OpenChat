# OpenChat

Local-first desktop chat app built with Tauri and vanilla HTML/CSS/JS. Fast UX, clean design, and native streaming via Ollama. Backend integrates LangChain LCEL for streaming and tool calling.

Current version: **0.2.3**

— [Changelog](CHANGELOG.md) • [License](LICENSE.md)


## Notice
This repository is currently in a transitional phase: parts of the stack use LangChain (LCEL, tools), and other parts use custom-built modules (Tauri streaming, prompt builder, reasoning UI). This mix is intentional for now and will be consolidated once the LangChain integration is fully stabilized. In upcoming releases, LangChain-based components will replace bespoke modules where appropriate to reduce duplication and simplify maintenance.


## Features
- Reasoning streaming: live reasoning in a dropdown; final answer renders instantly (`OpenChat/src/ai/stream_reasoning.js`).
- Non-reasoning streaming: smooth typewriter at ~10 ms/char (`OpenChat/src/ai/base/stream_simple.js`).
- LCEL plaintext stream endpoint: `POST /lcel/chat/stream` (FastAPI)
- LCEL SSE stream endpoint: `POST /lcel/chat/sse` (FastAPI, `text/event-stream`)
- Tool calling (LCEL): `POST /chat/tools/lcel` with LangSearch tool (OpenAI bind_tools if available, fallback to ReAct agent on Ollama)
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
 - `fastapi_server.py` — LangChain LCEL streaming/tool-calling backend (runs on 127.0.0.1:8000)


## Requirements
- Windows (tested). macOS/Linux should also work per Tauri prerequisites.
- Rust toolchain (stable) and Tauri CLI
- Node.js optional (tooling only)
- Optional: Ollama running locally for model-backed responses
- Optional: OpenAI for tool-calling path (`langchain-openai` + `OPENAI_API_KEY`)


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
4. Run the app (dev) — backend starts automatically:
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

### Backend endpoints (FastAPI)
- `GET /health` — readiness check
- `POST /generate/stream` — passthrough stream to Ollama `/api/generate` (plaintext tokens)
- `POST /lcel/chat/stream` — LCEL chain streaming (plaintext)
- `POST /lcel/chat/sse` — LCEL chain streaming (SSE `text/event-stream`, frames as `data: ...\n\n` and final `data: [DONE]\n\n`)
- `POST /tools/langsearch` — LangSearch proxy (requires `LANGSEARCH_API_KEY`)
- `POST /chat/tools/lcel` — Tool-enabled chat. Uses OpenAI `bind_tools` if `OPENAI_API_KEY` is set and model supports tools, else falls back to ReAct agent on Ollama.

### Frontend SSE helper (optional)
If you want to consume SSE directly from the FastAPI backend (instead of Tauri events), use:
`OpenChat/src/ai/base/stream_sse.js` → `streamSseResponse({ serverBase, model, message, history, system, ui })`.

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

### Environment variables
- `LANGSEARCH_API_KEY` — required to enable LangSearch web search (server-side and tool)
- `OLLAMA_URL` — optional override for Ollama URL (default `http://127.0.0.1:11434`)
- `OPENAI_API_KEY` — optional; enables OpenAI `bind_tools` for `/chat/tools/lcel`
- `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT` — optional; enable LangSmith traces per LangChain guides

### Python dependencies
See `pyproject.toml`. Optional OpenAI integration requires `langchain-openai`. Install via `pip install -e .` or compatible workflow.

## Websearch status
- Websearch runs via LangSearch. Server proxy endpoint: `/tools/langsearch`. LCEL tool-calling uses LangSearch as a tool with sources and summaries.
- Note: Web Search still has occasional issues in 0.2.3 and will be hardened in an upcoming patch.


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

