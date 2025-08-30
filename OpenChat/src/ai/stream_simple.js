// Non-reasoning streaming module
import { chooseResponseLanguage, languageNameFromCode } from './language_detection.js';
// Minimal dependencies: relies on Tauri invoke + event bus and small UI callbacks

export async function streamSimpleResponse({ finalPrompt, conversation, selectedModel, ui }) {
  // ui: { hideThinking, displayNow(message), displayTypewriter(message), updateConversationList() }
  const tauri = window.__TAURI__;
  if (!tauri) throw new Error('Tauri API not available');

  // Ensure only one concurrent stream
  try {
    if (window.__cancelActiveStream) {
      await window.__cancelActiveStream();
    }
  } catch {}

  let closed = false;
  let fullText = '';
  const unlisteners = [];
  let firstTokenTimer = null;
  let idleTimer = null;
  let lastTokenAt = 0;
  const IDLE_TIMEOUT_MS = 2500; // if no tokens for a while, finalize
  const HARD_TIMEOUT_MS = 20000; // absolute cap per message (reduced from 30s)
  let hardTimeout = null;

  const cleanup = async () => {
    try { unlisteners.forEach(u => { try { u(); } catch {} }); } catch {}
  };

  const clearWatchdog = () => {
    if (firstTokenTimer) {
      clearTimeout(firstTokenTimer);
      firstTokenTimer = null;
    }
  };

  const onToken = (event) => {
    if (closed) return;
    const token = (event?.payload ?? '').toString();
    if (token) {
      fullText += token;
      // Debug: log occasional token arrival without spamming
      if (fullText.length < 1000 || fullText.length % 500 === 0) {
        console.debug('[simple] token received, total chars =', fullText.length);
      }
    }
    const now = Date.now();
    lastTokenAt = now;
    if (firstTokenTimer) { clearTimeout(firstTokenTimer); firstTokenTimer = null; }
  };

  const onDone = async () => {
    if (closed) return;
    closed = true;
    clearWatchdog();
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    if (hardTimeout) { clearTimeout(hardTimeout); hardTimeout = null; }
    await cleanup();

    try { ui.hideThinking?.(); } catch {}

    let finalOnly = (fullText || '').trim();
    if (!finalOnly) finalOnly = 'Keine Antwort vom Modell.';

    const aiMessage = { role: 'assistant', content: finalOnly, reasoning: null, timestamp: new Date() };
    conversation.messages.push(aiMessage);

    try {
      if (ui.displayTypewriter) {
        console.log('[simple] rendering final with typewriter, length =', (finalOnly||'').length);
        await ui.displayTypewriter(aiMessage);
      } else if (ui.displayNow) {
        console.log('[simple] rendering final instantly, length =', (finalOnly||'').length);
        ui.displayNow(aiMessage);
      }
    } finally {
      conversation.updated_at = new Date();
      try { ui.updateConversationList?.(); } catch {}
      if (window.__cancelActiveStream === cancelThisStream) {
        window.__cancelActiveStream = null;
      }
    }
  };

  const onError = async (event) => {
    console.error('ai_error (simple):', event?.payload);
    if (closed) return;
    closed = true;
    clearWatchdog();
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    if (hardTimeout) { clearTimeout(hardTimeout); hardTimeout = null; }
    await cleanup();
    try { ui.hideThinking?.(); } catch {}

    const errorMessage = { role: 'assistant', content: 'Entschuldigung, es gab einen Fehler bei der Verarbeitung Ihrer Nachricht.', timestamp: new Date() };
    if (ui.displayTypewriter) {
      await ui.displayTypewriter(errorMessage);
    } else if (ui.displayNow) {
      ui.displayNow(errorMessage);
    }
    conversation.updated_at = new Date();
    try { ui.updateConversationList?.(); } catch {}
    if (window.__cancelActiveStream === cancelThisStream) {
      window.__cancelActiveStream = null;
    }
  };

  const setupTauriListeners = async () => {
    console.log('[simple] attaching listeners for ai_token/ai_done/ai_error');
    const un1 = await tauri.event.listen('ai_token', onToken);
    const un2 = await tauri.event.listen('ai_done', onDone);
    const un3 = await tauri.event.listen('ai_error', onError);
    unlisteners.push(un1, un2, un3);
  };

  const startStream = async () => {
    const invoke = tauri?.core?.invoke || tauri?.invoke;
    if (!invoke) throw new Error('Tauri invoke not available');
    console.log('[simple] startStream with model =', selectedModel || '(default)');
    await invoke('generate_ai_response_stream', { message: finalPrompt, model: selectedModel || undefined });
  };

  const cancelThisStream = async () => {
    try { closed = true; } catch {}
    try { clearWatchdog(); } catch {}
    try { if (idleTimer) { clearInterval(idleTimer); idleTimer = null; } } catch {}
    try { if (hardTimeout) { clearTimeout(hardTimeout); hardTimeout = null; } } catch {}
    try { await cleanup(); } catch {}
    if (window.__cancelActiveStream === cancelThisStream) {
      window.__cancelActiveStream = null;
    }
  };

  // Expose cancel globally (one at a time)
  window.__cancelActiveStream = cancelThisStream;

  // Watchdog if no first token for too long
  firstTokenTimer = setTimeout(() => {
    if (closed) return;
    if (!fullText) {
      console.warn('[simple] no first token within 10s, finalizing');
      onDone();
    }
  }, 10000);

  // Inactivity watchdog: if tokens started but no done event, finalize after idle
  idleTimer = setInterval(() => {
    if (closed) return;
    if (!lastTokenAt) return; // no tokens yet
    const idleFor = Date.now() - lastTokenAt;
    if (idleFor > IDLE_TIMEOUT_MS) {
      // Force finalize
      onDone();
    }
  }, 500);

  // Hard timeout finalizer to avoid hanging UI forever
  hardTimeout = setTimeout(() => {
    if (!closed) {
      console.warn('[simple] hard timeout reached, finalizing');
      onDone();
    }
  }, HARD_TIMEOUT_MS);

  // Detect language from the last user message in the conversation (if any)
  try {
    const lastUser = [...(conversation?.messages || [])].reverse().find(m => m.role === 'user');
    const sample = lastUser?.content || finalPrompt;
    const code = chooseResponseLanguage(sample, 'en');
    const name = languageNameFromCode(code);
    const directive = `Please respond exclusively in ${name} (${code}).\n`;
    finalPrompt = `${directive}${finalPrompt}`;
  } catch {}

  await setupTauriListeners();
  await startStream();
}
