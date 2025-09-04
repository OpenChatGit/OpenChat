# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog and uses calendar dates. The project does not yet adhere to Semantic Versioning.

## [0.2.3] - 2025-09-04
### Added
- Backend: LangChain/LCEL integration in `fastapi_server.py`
  - `POST /lcel/chat/stream` — plaintext streaming via LCEL chain.
  - `POST /lcel/chat/sse` — SSE streaming (`text/event-stream`).
  - Optional tracing via LangChain/LangSmith.
- Backend tools: LangSearch integration
  - `POST /tools/langsearch` proxy endpoint with API key handling.
  - `POST /chat/tools/lcel` tool-enabled chat. Uses OpenAI `bind_tools` when OpenAI is available; falls back to a ReAct agent on Ollama.
- Dev UX: Automatic FastAPI backend start in Tauri dev
  - `OpenChat/src-tauri/tauri.conf.json` → `beforeDevCommand` launches `start_backend.ps1` (or `start_backend.py`).
  - Health endpoint `GET /health` used by the frontend warm-up.
- Frontend: Prompt Regeneration Mode
  - `OpenChat/src/main.js` → new regeneration pipeline (`regenerateAssistantMessage(...)`).
  - Prompt-only context for regenerations via `contextOverrideMessages` (only the preceding user message).
  - Additional instruction via `additionalInstruction` to diversify outputs (avoids repeating the previous answer).
  - Inline rendering at the exact same position thanks to stable insert anchors.

### Changed
- Frontend regeneration flow in `OpenChat/src/main.js`
  - `regenerateAssistantMessage(...)` now:
    - Prepares DOM anchors so the new answer renders inline at the same position.
    - Removes the old assistant turn from the real conversation but uses a prompt-only context of just the preceding user message (`contextOverrideMessages`).
    - Passes a regeneration hint to enforce varied phrasing and details (no copy of the previous answer).
    - Allows unlimited regenerations of the same user turn.
  - `generateAssistantFromContent(...)` now accepts `{ additionalInstruction, contextOverrideMessages }` and appends instructions to the prompt.
  - `displayMessageWithTypewriter(...)` keeps `__assistantInsertBeforeEl` alive until the animation ends (prevents bottom-append).
- Prompt builder in `OpenChat/src/ai/global/context_manager.js`
  - Strengthened instructions to avoid repetition and boilerplate.
  - Keeps a small history window while honoring explicit overrides from regeneration.
- Documentation
  - `README.md` updated with version, auto-backend start note, and a Notice about mixed LangChain/custom modules during transition.

### Fixed
- Inline regeneration glitches
  - Thinking placeholder respects `__thinkingInsertBeforeEl` and stays inline.
  - Final assistant message no longer jumps to the bottom; anchor is cleared only after render completes.
- Self-references like "I already answered that…"
  - Reduced by limiting regen prompt context to the target user turn and by adding a regeneration-specific instruction block.

### Known issues / Notes
- Web Search (LangSearch) is integrated but still shows occasional issues. Stabilization (timeouts, retries, UX) will follow shortly.
- OpenAI API keys are not fully supported yet; broader OpenAI support and setup guidance will arrive in the next releases.

# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog and uses calendar dates. The project does not yet adhere to Semantic Versioning.

## [0.1.5] - 2025-08-31
### Added
- Hidden title directive + ID for reasoning models: during thinking, emit exactly one line `TITLE: …`. It is parsed from the reasoning buffer and applied to `conversation.title` (never shown in the visible chat).
- Streaming sanitization in `OpenChat/src/ai/stream_reasoning.js`: strips `TITLE:` and `ID: GEN_TITLE_…` lines in real time and from the final visible answer.
- Title model cascade in `OpenChat/src/main.js`: candidate order `localStorage.titleModelCandidates` (CSV) → `titleModel` → currently selected non-reasoning model → lightweight defaults → backend default; with per-attempt timeout.

### Changed
- Title generation is triggered after each assistant completion (simple + reasoning), protected by 2s debounce, concurrency lock, and 8s timeout.
- Prefer lightweight/non-reasoning models for titles; override via `localStorage.titleModel`/`titleModelCandidates`.
- Response language selection for reasoning: based only on the latest user message; optional override `preferredLanguage` and toggle `disableLanguageDirective`.

### Fixed
- Error-like strings (e.g., Ollama 404/5xx, backend errors, timeouts) are no longer used as titles; a local fallback title is used instead.
- Removed any leaked `TITLE:`/`ID:` from the final chat text and the reasoning dropdown.
- Reduced false-positive language detection by raising the threshold in `OpenChat/src/ai/language_detection.js` from 0.5 to 0.65.

### Known issues / Risks
- Some reasoning models may ignore the hidden title directive or still surface internal markers. The sanitizer hides them, but rare edge cases may occur.
- Title generation can fail if all candidate models/backends are unavailable; the UI will keep the local fallback title.
- If no titles appear, explicitly set an available lightweight model, e.g., `localStorage.setItem('titleModel', 'llama3.1:8b')` or a CSV via `titleModelCandidates`.

## [0.1.2] - 2025-08-30
### Notice
- Websearch is temporarily disabled to reduce the risk of hallucinations/misinformation. It will be re-enabled after further stability checks.
### Changed
- Frontend: extracted reasoning streaming into `OpenChat/src/ai/stream_reasoning.js`.
  - Handles reasoning live dropdown updates, final instant render, watchdogs, and websearch trigger.
- Frontend: `OpenChat/src/main.js` now routes reasoning models to `streamReasoningResponse()` and keeps non-reasoning on `stream_simple.js`.
- Performance: increased typewriter speed for non-reasoning models to 10 ms/char in `displayMessageWithTypewriter()`.

### Added
- New module `OpenChat/src/ai/stream_reasoning.js` with Tauri event listeners (`ai_token`, `ai_done`, `ai_error`) and invocation of `generate_ai_response_stream`.

### Fixed
- Reduced UI jank by micro-batching reasoning-render updates and ensuring proper cleanup of listeners and dropdown state.
- Ensured single active stream via `window.__cancelActiveStream` across both simple and reasoning paths.

### Known issues / Risks
- Websearch trigger relies on early `WEBSEARCH: <query>` emission; late triggers during final phase are ignored by design.
- If Tauri is not available (non-Tauri context), reasoning streaming will not function; simple path can still work if backend HTTP is available.
- Model unavailability (Ollama not running or model missing) surfaces as `ai_error`; user must ensure Ollama is running on 127.0.0.1:11434.
- Helper naming differences could break enrichment if customized (expects `performWebSearch`, `formatWebResultsForPrompt`, `buildReasoningInstruction`).
 - Entering fullscreen can cause a one-time flash in the UI. Likely related to transitions or reflow during layout changes; to be investigated in `OpenChat/src/styles.css` and `OpenChat/src/main.js` scroll/FLIP logic.
 - There may be additional issues not yet discovered; please report anomalies to help stabilize this release.
 - Due to the temporary deactivation of websearch, web-backed answers and citation hints are not available.

## [0.1.1] - 2025-08-28
### Notice
- Reasoning stream can still take long to produce tokens in some cases. We added stronger client-side safeguards, but are investigating backend-side cancellation and possibly embedding HTTP streaming in Tauri (Axum) to further improve responsiveness.
 - Known Issue: Follow-up messages can still break the chat in some sequences. A full fix is in progress and will ship soon.

### Changed
- Frontend (`OpenChat/src/main.js`): hardened `streamAssistantResponse()` lifecycle.
  - Added a closed flag to ignore late events from previous streams and prevent cross-stream contamination.
  - Extended inter-token watchdog to 8s with clear logging and graceful finalize.
  - Improved first-token watchdog with logging; avoids indefinite hangs before first token.
  - Cleanup now reliably closes the reasoning dropdown and detaches listeners.
  - Global cancel hook is cleared on cancel/done/error to avoid dangling state.
  - Handlers (`onToken`, `onDone`, `onError`) guard against double fire after completion.

### Added
- Optional FastAPI streaming gateway integration with health probe and warm endpoint.
- Parallel warm routine: warms Tauri and FastAPI backends best-effort to reduce first-token latency.
- Automatic fallback to Tauri streaming when FastAPI is unavailable.
- Single-stream enforcement via a global cancel function to prevent overlapping streams.

### Fixed
- Reduced stalls and broken answers via first-token and inter-token watchdogs and stricter cleanup.

## [0.1.0] - 2025-08-27
### Added
- Master README with features, setup, usage, troubleshooting.
- Noncommercial license (PolyForm Noncommercial 1.0.0).
- Dedicated CHANGELOG file (this file).

### Changed
- Thinking indicator: switched to English plain text with subtle left-to-right shimmer.
- First message responsiveness: user message and thinking indicator render instantly, even after deleting a chat and starting a new one.
- Sidebar: timestamps and titles update immediately after adding the user message.

### Fixed
- FLIP transition: reliable transition from centered input to chat mode without hiding content.
- `loadConversation()`: defined `messagesArea` to avoid a reference error.