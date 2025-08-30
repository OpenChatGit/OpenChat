// Reasoning streaming module
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
      if (gap > 8000) {
        console.warn(`[reasoning] inter-token watchdog fired after ${gap}ms; finalizing with accumulated text`);
        clearWatchdog();
        onDone({ payload: fullText });
      }
    }, 1000);
    if (firstTokenTimer) clearTimeout(firstTokenTimer);
    firstTokenTimer = setTimeout(() => {
      if (closed) return;
      if (__tokenCount === 0) {
        console.warn('[reasoning] first-token watchdog fired; aborting');
        onError({ payload: 'Timeout waiting for first token' });
      }
    }, 7000);
  };
  const clearWatchdog = () => { if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; } };

  let rafScheduled = false;
  let lastFlushedLength = 0;
  let lastFlushAt = 0;
  const STREAM_RENDER_INTERVAL_MS = 50;
  const STREAM_MIN_DELTA_CHARS = 12;

  const HAS_MARKERS_RE = /[\[<【】]|Output\s+Format|WEBSEARCH:/i;
  const stripMarkers = (text) => {
    if (!text) return text;
    if (!HAS_MARKERS_RE.test(text)) return text;
    return text
      .replace(/<\/?\s*think\s*>/gi, '')
      .replace(/<\/?\s*final\s*>/gi, '')
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
        const enriched = originalUserMessage + (typeof tools.formatWebResultsForPrompt === 'function' ? tools.formatWebResultsForPrompt(webResults) : '') + extra;
        buffer = '';
        fullText = '';
        reasoningStarted = false;
        await setupTauriListeners();
        await startStream(enriched);
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

    const aiMessage = { role: 'assistant', content: finalOnly, reasoning: null, timestamp: new Date() };
    conversation.messages.push(aiMessage);
    try {
      // Reasoning models: render instantly (no typewriter)
      if (ui.displayNow) ui.displayNow(aiMessage); else console.warn('[reasoning] ui.displayNow missing');
    } finally {
      conversation.updated_at = new Date();
      try { ui.updateConversationList?.(); } catch {}
      if (window.__cancelActiveStream === cancelThisStream) window.__cancelActiveStream = null;
    }
  };

  const onError = async (event) => {
    if (closed) return;
    closed = true;
    clearWatchdog();
    if (firstTokenTimer) { clearTimeout(firstTokenTimer); firstTokenTimer = null; }
    await cleanup();
    try { ui.hideThinking?.(); } catch {}
    const errorMessage = { role: 'assistant', content: 'Fehler beim Streamen der Antwort.', timestamp: new Date() };
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
    await invoke('generate_ai_response_stream', { message: prompt, model: selectedModel || undefined });
  };

  await setupTauriListeners();
  startWatchdog();
  await startStream(finalPrompt);
}
