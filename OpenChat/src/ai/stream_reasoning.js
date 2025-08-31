// Reasoning streaming module
import { chooseResponseLanguage, languageNameFromCode } from './language_detection.js';
import { buildPromptWithContext } from './context_manager.js';
import { answerFromHistoryIfApplicable } from './history_answer.js';
// Handles reasoning models: live reasoning dropdown + final instant render
// Usage:
//   streamReasoningResponse({
//     finalPrompt, originalUserMessage, conversation, selectedModel,
//     ui: { hideThinking, displayNow, displayTypewriter, updateConversationList },
//     tools: { activeTools, performWebSearch, formatWebResultsForPrompt, buildReasoningInstruction }
//   })

export async function streamReasoningResponse({ finalPrompt, originalUserMessage, conversation, selectedModel, ui = {}, tools = {} }) {
  const tauri = window.__TAURI__;
  if (!tauri) throw new Error('Tauri API not available');

  // Guard: only for reasoning models; caller should ensure this, but be safe
  try {
    if (window.__cancelActiveStream) {
      await window.__cancelActiveStream();
    }
  } catch {}

  // Thinking dropdown area
  const messagesArea = document.getElementById('messagesArea');
  const thinking = document.getElementById('thinking-message');
  let dropdown = thinking?.querySelector('.reasoning-dropdown');
  if (thinking && !dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'reasoning-dropdown';
    thinking.appendChild(dropdown);
  }

  // Live reasoning node
  let liveTextNode = null;
  if (dropdown) {
    dropdown.classList.add('open');
    dropdown.innerHTML = '';
    liveTextNode = document.createTextNode('');
    dropdown.appendChild(liveTextNode);
  }

  let buffer = '';
  let fullText = '';
  let titleCandidate = null;
  let finalMode = false;
  let reasoningStarted = false;
  let reasoningBuffer = '';
  let finalBuffer = '';
  let websearchTriggered = false;
  let closed = false;
  let lastTokenAt = Date.now();
  let watchdogTimer = null;
  let firstTokenTimer = null;
  const unlisteners = [];

  // Remove any leaked internal TITLE or ID directive lines from the final visible answer
  const sanitizeFinal = (text) => {
    try {
      let t = String(text || '');
      // Drop lines that start with TITLE: or ID: GEN_TITLE_ ...
      t = t.split(/\r?\n/).filter(line => !/^\s*TITLE\s*:/i.test(line) && !/^\s*ID\s*:\s*GEN_TITLE_/i.test(line)).join('\n');
      return t.trim();
    } catch {
      return text;
    }
  };

  const cleanup = async () => {
    for (const un of unlisteners) {
      try { if (typeof un === 'function') await un(); } catch {}
    }
    unlisteners.length = 0;
    try { if (dropdown && dropdown.classList) dropdown.classList.remove('open'); } catch {}
  };

  const cancelThisStream = async () => {
    try { closed = true; } catch {}
    try { clearWatchdog(); } catch {}
    try { await cleanup(); } catch {}
    if (window.__cancelActiveStream === cancelThisStream) window.__cancelActiveStream = null;
  };
  window.__cancelActiveStream = cancelThisStream;

  const startWatchdog = () => {
    if (watchdogTimer) clearInterval(watchdogTimer);
    watchdogTimer = setInterval(() => {
      if (closed) return;
      if (__tokenCount === 0) return;
      const gap = Date.now() - lastTokenAt;
      if (gap > 30000) {
        console.warn(`[reasoning] inter-token watchdog fired after ${gap}ms; finalizing with accumulated text`);
        clearWatchdog();
        onDone({ payload: fullText });
      }
    }, 1000);
    if (firstTokenTimer) clearTimeout(firstTokenTimer);
    firstTokenTimer = setTimeout(() => {
      if (closed) return;
      if (__tokenCount === 0) {
        console.warn('[reasoning] first-token watchdog fired (60s); aborting');
        onError({ payload: 'Timeout waiting for first token' });
      }
    }, 60000);
  };
  const clearWatchdog = () => { if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; } };

  let rafScheduled = false;
  let lastFlushedLength = 0;
  let lastFlushAt = 0;
  const STREAM_RENDER_INTERVAL_MS = 50;
  const STREAM_MIN_DELTA_CHARS = 12;

  const HAS_MARKERS_RE = /[\[<【】]|Output\s+Format|WEBSEARCH:|^\s*TITLE\s*:|^\s*ID\s*:\s*GEN_TITLE_/im;
  const stripMarkers = (text) => {
    if (!text) return text;
    if (!HAS_MARKERS_RE.test(text)) return text;
    return text
      .replace(/<\/?>\s*think\s*>/gi, '')
      .replace(/<\/?>\s*final\s*>/gi, '')
      .replace(/\[\s*REASONING[^\]]*\]/gi, '')
      .replace(/\[\s*FINAL[^\]]*\]/gi, '')
      .replace(/\[\s*THINK[^\]]*\]/gi, '')
      .replace(/\[\s*(?:REASONING|FINAL|THINK)[^\]]*$/gim, '')
      .replace(/^\s*(Reasoning|Gedanken|Denken)\s*:?/gim, '')
      .replace(/^\s*(Final(?: Answer)?|Antwort|Answer)\s*:?/gim, '')
      .replace(/^\s*Answer\s*:?/gim, '')
      .replace(/\[\s*Output\s+Format\s*\]/gi, '')
      .replace(/If you need web data, you may first reply with WEBSEARCH:\s*<query>.*?(?:\r?\n|$)/gi, '')
      .replace(/```[\s\S]*?\[\s*Output\s+Format\s*\][\s\S]*?```/gi, '')
      // Remove leaked internal title/id lines from any partial chunk
      .replace(/^\s*TITLE\s*:.*(?:\r?\n|$)/gim, '')
      .replace(/^\s*ID\s*:\s*GEN_TITLE_.*(?:\r?\n|$)/gim, '')
      .replace(/[【】]/g, '');
  };

  const flushRender = () => {
    const base = stripMarkers(reasoningBuffer).replace(/<\/?\s*think\s*>/gi, '');
    if (liveTextNode) liveTextNode.nodeValue = base;
    const nearBottom = (messagesArea.scrollHeight - messagesArea.scrollTop - messagesArea.clientHeight) < 64;
    if (nearBottom) messagesArea.scrollTop = messagesArea.scrollHeight;
    lastFlushedLength = reasoningBuffer.length;
    lastFlushAt = Date.now();
  };
  const scheduleRender = () => {
    const now = Date.now();
    const delta = reasoningBuffer.length - lastFlushedLength;
    if (lastFlushedLength === 0 && reasoningBuffer.length > 0 && !rafScheduled) {
      rafScheduled = true;
      return requestAnimationFrame(() => { rafScheduled = false; flushRender(); });
    }
    if (now - lastFlushAt < STREAM_RENDER_INTERVAL_MS && delta < STREAM_MIN_DELTA_CHARS) return;
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => { rafScheduled = false; flushRender(); });
  };

  let __tokenCount = 0;
  const onToken = async (event) => {
    if (closed) return;
    if (firstTokenTimer) { clearTimeout(firstTokenTimer); firstTokenTimer = null; }
    lastTokenAt = Date.now();
    const token = typeof event?.payload === 'string' ? event.payload : '';
    if (!token) return;
    __tokenCount++;
    buffer += token;
    fullText += token;

    // Tool trigger WEBSEARCH in early stage
    if (!reasoningStarted && buffer.length <= 200 && /^\s*WEBSEARCH:/i.test(buffer)) {
      if (!websearchTriggered && tools.activeTools && tools.activeTools.has && tools.activeTools.has('websearch') && typeof tools.performWebSearch === 'function') {
        websearchTriggered = true;
        await cleanup();
        const m = buffer.match(/^\s*WEBSEARCH:\s*(.+)/i);
        const query = m && m[1] ? m[1].trim() : originalUserMessage;
        const webResults = await tools.performWebSearch(query || originalUserMessage, 5);
        const extra = typeof tools.buildReasoningInstruction === 'function' ? tools.buildReasoningInstruction() : '';
        const enrichedUser = (originalUserMessage || '') + (typeof tools.formatWebResultsForPrompt === 'function' ? tools.formatWebResultsForPrompt(webResults) : '') + extra;
        buffer = '';
        fullText = '';
        reasoningStarted = false;
        await setupTauriListeners();
        // Rebuild a full context-aware prompt
        let rebuilt = buildPromptWithContext(conversation, enrichedUser, { maxChars: 8000 });
        // Language directive: derive strictly from the latest user message; allow disable/override
        try {
          const disable = localStorage.getItem('disableLanguageDirective') === 'true';
          let override = localStorage.getItem('preferredLanguage');
          override = override && override.trim() ? override.trim() : null;
          if (!disable) {
            const lastUser = [...conversation.messages].reverse().find(m => m.role === 'user' && m.content);
            const basis = lastUser?.content || originalUserMessage || '';
            const code = override || chooseResponseLanguage(basis, 'en');
            const name = languageNameFromCode(code);
            const directive = `Please respond exclusively in ${name} (${code}).\n`;
            rebuilt = `${directive}${rebuilt}`;
          }
        } catch {}

        // Hidden title directive for reasoning models (emit only in reasoning, not in final)
        try {
          const genId = `GEN_TITLE_${Date.now()}`;
          const titleInstr = 'While thinking, craft a concise chat title (<=6 words, no quotes, no ending punctuation). Output exactly one line starting with "TITLE: " followed by the title in your hidden reasoning ONLY; do not include the title in the final user-visible answer.';
          rebuilt = `${titleInstr}\nID:${genId}\n${rebuilt}`;
        } catch {}
        await startStream(rebuilt);
        return;
      }
    }

    // Mark reasoning started
    if (!reasoningStarted) {
      const idx = buffer.indexOf('[REASONING]');
      if (idx !== -1) {
        reasoningStarted = true;
        buffer = buffer.slice(idx + '[REASONING]'.length);
      } else if (buffer.length > 0) {
        reasoningStarted = true;
      }
    }

    if (!finalMode) {
      const finalRegex = /\[\s*final\s*\]|<\s*final\s*>/i;
      const finalIdx = buffer.search(finalRegex);
      const thinkCloseRegex = /<\s*\/\s*think\s*>/i;
      const thinkCloseIdx = buffer.search(thinkCloseRegex);
      const headingRegex = /(?:^|\n)\s*(?:#{0,3}\s*)?(?:Final(?: Answer)?|Antwort|Answer)\s*:/i;
      const headingIdx = buffer.search(headingRegex);
      const candidates = [finalIdx, thinkCloseIdx, headingIdx].filter(i => i !== -1);
      const switchIdx = candidates.length ? Math.min(...candidates) : -1;
      if (switchIdx !== -1) {
        const chunk = buffer.slice(0, switchIdx);
        if (chunk) {
          reasoningBuffer += stripMarkers(chunk);
          scheduleRender();
        }
        let markerLen = 0;
        if (switchIdx === finalIdx) {
          const match = buffer.match(finalRegex);
          markerLen = match && match[0] ? match[0].length : '[FINAL]'.length;
        } else if (switchIdx === thinkCloseIdx) {
          const match = buffer.match(thinkCloseRegex);
          markerLen = match && match[0] ? match[0].length : '</think>'.length;
        } else {
          const match = buffer.match(headingRegex);
          markerLen = match && match[0] ? match[0].length : 0;
        }
        buffer = buffer.slice(switchIdx + markerLen);
        finalMode = true;
        if (buffer) { finalBuffer += stripMarkers(buffer); buffer = ''; }
      } else {
        reasoningBuffer += stripMarkers(token);
        if (reasoningBuffer.length > 8000) reasoningBuffer = reasoningBuffer.slice(-8000);
        scheduleRender();
      }
    } else {
      finalBuffer += stripMarkers(token);
    }
  };

  const onDone = async (event) => {
    if (closed) return;
    closed = true;
    clearWatchdog();
    if (firstTokenTimer) { clearTimeout(firstTokenTimer); firstTokenTimer = null; }
    await cleanup();

    const payload = typeof event?.payload === 'string' ? event.payload : '';
    const source = (typeof payload === 'string' && payload.trim().length) ? payload : fullText;
    let finalOnly = '';
    if (finalBuffer && finalBuffer.trim().length) {
      finalOnly = finalBuffer;
    } else if (source && source.length) {
      const lc = source.toLowerCase();
      const thinkClose = '</think>';
      const thinkIdx = lc.lastIndexOf(thinkClose);
      if (thinkIdx !== -1) finalOnly = source.slice(thinkIdx + thinkClose.length);
      if (!finalOnly || !finalOnly.trim().length) {
        const m1 = /[\s\S]*?\[\s*final\s*\]([\s\S]*)/i.exec(source);
        if (m1) finalOnly = m1[1];
      }
      if (!finalOnly || !finalOnly.trim().length) {
        const m2 = /[\s\S]*?<\s*final\s*>\s*([\s\S]*)/i.exec(source);
        if (m2) finalOnly = m2[1];
      }
      if (!finalOnly || !finalOnly.trim().length) {
        const m3 = /(?:^|\n)\s*(?:#{0,3}\s*)?(?:Final(?: Answer)?|Antwort|Answer)\s*:?\s*\n?([\s\S]*)/i.exec(source);
        if (m3) finalOnly = m3[1];
      }
    }
    if (!finalOnly || !finalOnly.trim()) {
      finalOnly = (source || '').trim() || '…';
      finalOnly = stripMarkers(finalOnly || '').trim();
    }

    try { ui.hideThinking?.(); } catch {}

    // Strict recall override: if the last user message is a recall question, bypass model output
    try {
      const lastUser = [...(conversation?.messages || [])].reverse().find(m => m.role === 'user');
      const recall = answerFromHistoryIfApplicable(conversation, lastUser?.content || '');
      if (recall) {
        finalOnly = recall;
      }
    } catch {}

    // Anti-repetition safeguard: avoid echoing the previous assistant reply
    try {
      const lastAssistant = [...(conversation?.messages || [])].reverse().find(m => m.role === 'assistant');
      const lastUser = [...(conversation?.messages || [])].reverse().find(m => m.role === 'user');
      const sameAsPrev = lastAssistant && typeof lastAssistant.content === 'string' && lastAssistant.content.trim() === (finalOnly||'').trim();
      if (sameAsPrev) {
        const u = (lastUser?.content || '').toLowerCase();
        if (/how\s+do\s+you\s+know|woher\s+weißt\s+du/.test(u)) {
          const idx = (conversation.messages || []).findIndex(m => m === lastAssistant);
          const turnNum = idx >= 0 ? (idx + 1) : null;
          const expl = turnNum ? `I used the conversation history. It matches my earlier reply at turn ${turnNum}.` : 'I used the conversation history to answer.';
          finalOnly = `${expl}\n\nHere is the exact quote from the conversation:\n\n"""\n${lastAssistant.content}\n"""`;
        } else {
          finalOnly = `Repeating prior answer once for clarity:\n\n"""\n${lastAssistant.content}\n"""`;
        }
      }
    } catch {}

  const cleanFinal = sanitizeFinal(finalOnly);
  const aiMessage = { role: 'assistant', content: cleanFinal, reasoning: null, timestamp: new Date() };
    conversation.messages.push(aiMessage);
    try {
      // Reasoning models: render instantly (no typewriter)
      if (ui.displayNow) ui.displayNow(aiMessage); else console.warn('[reasoning] ui.displayNow missing');
    } finally {
      conversation.updated_at = new Date();
      try { ui.updateConversationList?.(); } catch {}
      if (window.__cancelActiveStream === cancelThisStream) window.__cancelActiveStream = null;
      // Try to extract a TITLE: ... line from the full reasoning buffer
      try {
        const text = String(fullText || '');
        const m = text.match(/(?:^|\n)\s*TITLE:\s*(.+)/i);
        if (m && m[1]) {
          titleCandidate = m[1].trim();
        }
        if (titleCandidate) {
          let t = titleCandidate.split(/\r?\n/)[0].trim();
          if (t.length > 64) t = t.slice(0, 64).trim();
          const lower = t.toLowerCase();
          const looksHttp = /\b(4\d\d|5\d\d)\b/.test(lower);
          const looksError = lower.includes('error') || lower.includes('fehler') || lower.includes('timeout') || lower.includes('ollama') || lower.includes('tauri') || looksHttp;
          if (t && !looksError) {
            if (!conversation.title || conversation.title !== t) {
              conversation.title = t;
              ui.updateConversationList?.();
            }
          }
        }
      } catch {}
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
        const shouldEvery10 = (conversation.messages?.length || 0) % 10 === 0;
        if (typeof window.requestAIGeneratedTitle === 'function' && (shouldEvery10 || true)) {
          Promise.resolve(window.requestAIGeneratedTitle(conversation)).catch(()=>{});
        }
      } catch {}
    }
  };

  const onError = async (event) => {
    if (closed) return;
    closed = true;
    clearWatchdog();
    if (firstTokenTimer) { clearTimeout(firstTokenTimer); firstTokenTimer = null; }
    await cleanup();
    try { ui.hideThinking?.(); } catch {}
    const detail = typeof event?.payload === 'string' && event.payload.trim().length ? `\n\nDetails: ${event.payload}` : '';
    const errorMessage = { role: 'assistant', content: 'Fehler beim Streamen der Antwort.' + detail, timestamp: new Date() };
    if (ui.displayNow) ui.displayNow(errorMessage);
    conversation.updated_at = new Date();
    try { ui.updateConversationList?.(); } catch {}
    if (window.__cancelActiveStream === cancelThisStream) window.__cancelActiveStream = null;
  };

  const setupTauriListeners = async () => {
    const un1 = await tauri.event.listen('ai_token', onToken);
    const un2 = await tauri.event.listen('ai_done', onDone);
    const un3 = await tauri.event.listen('ai_error', onError);
    unlisteners.push(un1, un2, un3);
  };

  const startStream = async (prompt) => {
    const invoke = tauri?.core?.invoke || tauri?.invoke;
    if (!invoke) throw new Error('Tauri invoke not available');
    try {
      // Best-effort warm to reduce first-token latency and avoid timeouts
      try { await invoke('warm_model', { model: selectedModel || undefined }); } catch (e) { console.debug('[reasoning] warm_model failed or unavailable:', e?.message || e); }
      await invoke('generate_ai_response_stream', { message: prompt, model: selectedModel || undefined });
    } catch (e) {
      console.error('[reasoning] invoke generate_ai_response_stream failed:', e);
      onError({ payload: e?.message || String(e) });
    }
  };

  // Detect user language and prepend directive to enforce response language (latest user only; allow disable/override)
  try {
    const disable = localStorage.getItem('disableLanguageDirective') === 'true';
    let override = localStorage.getItem('preferredLanguage');
    override = override && override.trim() ? override.trim() : null;
    if (!disable) {
      const lastUser = [...conversation.messages].reverse().find(m => m.role === 'user' && m.content);
      const basis = lastUser?.content || originalUserMessage || '';
      const code = override || chooseResponseLanguage(basis, 'en');
      const name = languageNameFromCode(code);
      const directive = `Please respond exclusively in ${name} (${code}).\n`;
      finalPrompt = `${directive}${finalPrompt}`;
    }
  } catch {}

  // Hidden title directive for reasoning models on initial prompt as well
  try {
    const genId = `GEN_TITLE_${Date.now()}`;
    const titleInstr = 'While thinking, craft a concise chat title (<=6 words, no quotes, no ending punctuation). Output exactly one line starting with "TITLE: " followed by the title in your hidden reasoning ONLY; do not include the title in the final user-visible answer.';
    finalPrompt = `${titleInstr}\nID:${genId}\n${finalPrompt}`;
  } catch {}

  await setupTauriListeners();
  startWatchdog();
  await startStream(finalPrompt);
}
