// Non-reasoning streaming module
import { chooseResponseLanguage, languageNameFromCode } from './language_detection.js';
import { answerFromHistoryIfApplicable } from './history_answer.js';
// Minimal dependencies: relies on Tauri invoke + event bus and small UI callbacks

// Helpers for anti-repetition: normalize text and compute a simple Jaccard similarity over tokens
const normalizeText = (s) => (s || '')
  .toLowerCase()
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/[“”"'`]/g, ' ')
  .replace(/[^a-z0-9äöüßàáâãèéêìíîòóôõùúûçñ\s]/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const jaccardSimilarity = (a, b) => {
  const ta = new Set(normalizeText(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (ta.size === 0 && tb.size === 0) return 1;
  const inter = new Set([...ta].filter(x => tb.has(x)));
  const union = new Set([...ta, ...tb]);
  return inter.size / union.size;
};

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
  const IDLE_TIMEOUT_MS = 30000; // if no tokens for a while, finalize (increased from 2.5s)
  const HARD_TIMEOUT_MS = 600000; // absolute cap per message: 10 minutes
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

    // Strict recall override: if the last user message is a recall question, bypass model output
    try {
      const lastUser = [...(conversation?.messages || [])].reverse().find(m => m.role === 'user');
      const recall = answerFromHistoryIfApplicable(conversation, lastUser?.content || '');
      if (recall) {
        finalOnly = recall;
      }
    } catch {}

    // Anti-repetition safeguard: if model repeats the last assistant message (even near-duplicate), avoid echoing; offer elaboration instead
    try {
      const lastAssistant = [...(conversation?.messages || [])].reverse().find(m => m.role === 'assistant');
      const lastUser = [...(conversation?.messages || [])].reverse().find(m => m.role === 'user');
      const sameAsPrev = lastAssistant && typeof lastAssistant.content === 'string' && (
        normalizeText(lastAssistant.content) === normalizeText(finalOnly)
        || jaccardSimilarity(lastAssistant.content, finalOnly) > 0.97
        || (normalizeText(finalOnly).includes(normalizeText(lastAssistant.content)) && Math.abs(finalOnly.length - lastAssistant.content.length) < 16)
      );
      if (sameAsPrev) {
        const u = (lastUser?.content || '').toLowerCase();
        const metaPrefixEN = 'i already answered that';
        const metaPrefixDE = 'ich habe das bereits beantwortet';
        const lastIsMeta = normalizeText(lastAssistant.content).startsWith(metaPrefixEN) || normalizeText(lastAssistant.content).startsWith(metaPrefixDE);
        if (/how\s+do\s+you\s+know|woher\s+weißt\s+du/.test(u)) {
          // Deterministic justification referencing history
          const idx = (conversation.messages || []).findIndex(m => m === lastAssistant);
          const turnNum = idx >= 0 ? (idx + 1) : null; // 1-based
          const expl = turnNum
            ? `I used the conversation history. It matches my earlier reply at turn ${turnNum}.`
            : 'I used the conversation history to answer.';
          finalOnly = lastIsMeta
            ? `${expl} Tell me what to expand: steps, examples, or alternatives?`
            : `${expl} If you'd like, I can expand on the reasoning or provide examples.`;
        } else {
          // If it's just echoing, avoid quoting the whole answer to prevent loops
          const idx = (conversation.messages || []).findIndex(m => m === lastAssistant);
          const turnNum = idx >= 0 ? (idx + 1) : null;
          finalOnly = lastIsMeta
            ? `I won't repeat the same answer. What would help most: more detail, an example, or a different angle?`
            : (turnNum
              ? `I already answered that in turn ${turnNum}. Would you like more detail, an example, or a different angle?`
              : `I already answered that above. Would you like more detail, an example, or a different angle?`);
        }
      }
    } catch {}

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
      // Ensure we never leave the title empty
      try {
        if (!conversation.title || !conversation.title.trim()) {
          const lastUser = [...conversation.messages].reverse().find(m => m.role === 'user' && m.content);
          if (lastUser && lastUser.content) {
            const snippet = lastUser.content.slice(0, 50) + (lastUser.content.length > 50 ? '...' : '');
            if (snippet.trim()) {
              conversation.title = snippet.trim();
              ui.updateConversationList?.();
            }
          }
        }
      } catch {}
      // Fire-and-forget: refresh AI-generated title after assistant finished
      try {
        if (typeof window.requestAIGeneratedTitle === 'function') {
          // Internal policy handles debouncing and frequency
          Promise.resolve(window.requestAIGeneratedTitle(conversation)).catch(()=>{});
        }
      } catch {}
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
    // Best-effort warm to reduce first-token latency and avoid timeouts
    try {
      await invoke('warm_model', { model: selectedModel || undefined });
    } catch (e) {
      console.debug('[simple] warm_model failed or unavailable:', e?.message || e);
    }
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
      console.warn('[simple] no first token within 60s, finalizing');
      onDone();
    }
  }, 60000);

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
