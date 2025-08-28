# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by Keep a Changelog and uses calendar dates. The project does not yet adhere to Semantic Versioning.

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