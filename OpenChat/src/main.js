// Tauri API wrapper
const invoke = async (command, args) => {
    try {
        if (window.__TAURI__?.core?.invoke) {
            return await window.__TAURI__.core.invoke(command, args);
        } else if (window.__TAURI__?.invoke) {
            return await window.__TAURI__.invoke(command, args);
        } else {
            console.error('Tauri API not available. Please run the app via Tauri to use the backend.');
            throw new Error('Backend not available: start the app with Tauri (no browser mocks).');
        }
    } catch (error) {
        console.error('Tauri invoke error:', error);
        return 'Error generating response';
    }
};

// Warm the currently selected model to reduce first-token latency
async function warmModel(modelName) {
    const model = modelName || selectedOllamaModel || null;
    // Fire both paths best-effort in parallel; whichever succeeds keeps the model hot
    const tasks = [];
    // Tauri backend warm
    tasks.push((async () => {
        try { await invoke('warm_model', { model }); } catch {}
    })());
    // FastAPI warm (if enabled)
    if (typeof USE_FASTAPI_STREAM !== 'undefined' && USE_FASTAPI_STREAM) {
        tasks.push((async () => {
            try {
                await fetch(`${FASTAPI_URL}/warm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model })
                });
            } catch {}
        })());
    }
    try { await Promise.race(tasks); } catch {}
}

// Live streaming for reasoning models
const ENABLE_INTERNAL_REASONING_PROMPT = false; // disable extra [REASONING]/[FINAL] instruction block by default
const SIMPLE_FINAL = true; // if true, final = last non-empty paragraph of streamed text
const SHOW_TAGS_IN_REASONING = false; // default: hide raw tags like <think> in reasoning dropdown
const MAX_REASONING_CHARS = 8000; // tighter soft cap to keep UI consistently fast
// Faster streaming: render more frequently with smaller deltas
const STREAM_RENDER_INTERVAL_MS = 50; // was 120ms
const STREAM_MIN_DELTA_CHARS = 12; // was 48 chars
// Prefer FastAPI gateway streaming when available
const USE_FASTAPI_STREAM = false;
const FASTAPI_URL = 'http://127.0.0.1:8000';

// Quick probe to see if FastAPI is up (short timeout)
async function isFastAPIUp() {
    try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 400);
        const res = await fetch(`${FASTAPI_URL}/health`, { signal: controller.signal });
        clearTimeout(t);
        return !!(res && res.ok);
    } catch {
        return false;
    }
}

async function streamAssistantResponse(finalPrompt, originalUserMessage, conversation) {
    // Ensure only one concurrent stream: cancel any previous active stream
    try {
        if (window.__cancelActiveStream) {
            await window.__cancelActiveStream();
        }
    } catch {}

    const tauri = window.__TAURI__;
    const messagesArea = document.getElementById('messagesArea');
    const thinking = document.getElementById('thinking-message');
    // Ensure a dropdown container exists under the thinking bubble
    let dropdown = thinking?.querySelector('.reasoning-dropdown');
    if (thinking && !dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'reasoning-dropdown';
        thinking.appendChild(dropdown);
    }
    if (!tauri || !tauri.event || !dropdown) {
        // If UI not ready, bail gracefully
        return;
    }

    // Prepare live reasoning element (plain text, no extra box)
    dropdown.classList.add('open');
    dropdown.innerHTML = '';
    const liveTextNode = document.createTextNode('');
    dropdown.appendChild(liveTextNode);

    let buffer = '';
    let fullText = '';
    let finalMode = false; // once [FINAL] encountered
    let reasoningStarted = false; // saw [REASONING]
    let reasoningBuffer = '';
    let finalBuffer = '';
    let websearchTriggered = false;
    // Closed flag: ignore late tokens/done/errors after completion or cancel
    let closed = false;
    // Watchdog to guard against missing ai_done
    let lastTokenAt = Date.now();
    let watchdogTimer = null;
    let firstTokenTimer = null;

    const startWatchdog = () => {
        if (watchdogTimer) clearInterval(watchdogTimer);
        // Check every 1s; allow up to 8s of silence between tokens before finalizing
        watchdogTimer = setInterval(() => {
            if (closed) return;
            // Do not finalize before any tokens arrived
            if (__tokenCount === 0) return;
            const gap = Date.now() - lastTokenAt;
            if (gap > 8000) {
                console.warn(`[stream] inter-token watchdog fired after ${gap}ms; finalizing with accumulated text`);
                clearWatchdog();
                // Synthesize a done event carrying whatever we have
                onDone({ payload: fullText });
            }
        }, 1000);
        // First-token timeout to avoid hanging forever before any data arrives
        if (firstTokenTimer) clearTimeout(firstTokenTimer);
        firstTokenTimer = setTimeout(() => {
            if (closed) return;
            if (__tokenCount === 0) {
                console.warn('[stream] first-token watchdog fired; aborting');
                onError({ payload: 'Timeout waiting for first token' });
            }
        }, 7000);
    };
    const clearWatchdog = () => { if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; } };
    // Micro-batching for DOM updates (throttled)
    let rafScheduled = false;
    let lastFlushedLength = 0;
    let lastFlushAt = 0;
    let isFinalFlush = false;
    const flushRender = () => {
        // Always hide raw <think> tags from display for clarity, even if SHOW_TAGS_IN_REASONING is true
        const baseRaw = SHOW_TAGS_IN_REASONING ? reasoningBuffer : stripMarkers(reasoningBuffer);
        const base = baseRaw.replace(/<\/?\s*think\s*>/gi, '');
        let display = base;
        if (isFinalFlush) {
            // Heavy cleanup only once at the end
            let raw = sanitizeReasoningForDisplay(base);
            if (!raw || !raw.trim()) raw = base;
            raw = raw
                .replace(/\s+\[\s*$/gm, '')
                .replace(/:\s*and\s*\[\s*$/g, ':');
            // Final dedupe (line/paragraph)
            const lines = raw.split(/\r?\n/);
            const out = [];
            let lastNorm = null;
            for (const line of lines) {
                const norm = line.replace(/\s+/g, ' ').trim();
                if (lastNorm !== null && norm === lastNorm) continue;
                out.push(line);
                lastNorm = norm;
            }
            let deduped = out.join('\n').replace(/\n{3,}/g, '\n\n');
            const paras = deduped.split(/\n\s*\n/);
            if (paras.length >= 2) {
                const last = paras[paras.length - 1].trim();
                const prev = paras[paras.length - 2].trim();
                if (last && prev && last === prev) {
                    paras.pop();
                    deduped = paras.join('\n\n');
                }
            }
            display = deduped;
        } else {
            // Light in-flight cleanup only (fast)
            display = base
                .replace(/\s+\[\s*$/gm, '')
                .replace(/:\s*and\s*\[\s*$/g, ':');
        }

        // Only autoscroll if the user is near the bottom to avoid layout thrash
        const nearBottom = (messagesArea.scrollHeight - messagesArea.scrollTop - messagesArea.clientHeight) < 64;
        liveTextNode.nodeValue = display;
        if (nearBottom) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
        lastFlushedLength = reasoningBuffer.length;
        lastFlushAt = Date.now();
    };
    const scheduleRender = () => {
        // Throttle based on interval and delta size
        const now = Date.now();
        const delta = reasoningBuffer.length - lastFlushedLength;
        // On first content, bypass throttling to show reasoning immediately
        if (lastFlushedLength === 0 && reasoningBuffer.length > 0 && !rafScheduled) {
            rafScheduled = true;
            return requestAnimationFrame(() => {
                rafScheduled = false;
                flushRender();
            });
        }
        if (now - lastFlushAt < STREAM_RENDER_INTERVAL_MS && delta < STREAM_MIN_DELTA_CHARS) return;
        if (rafScheduled) return;
        rafScheduled = true;
        requestAnimationFrame(() => {
            rafScheduled = false;
            flushRender();
        });
    };

    // Helper for simple mode: choose last non-empty paragraph
    const getLastNonEmptyParagraph = (text) => {
        if (!text) return '';
        const parts = String(text).split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
        if (parts.length === 0) return String(text).trim();
        return parts[parts.length - 1];
    };

    // Quick marker presence regex to skip heavy replaces for common tokens without markers
    const HAS_MARKERS_RE = /[\[<【】]|Output\s+Format|WEBSEARCH:/i;

    // Remove visible control markers so they don't show in UI
    const stripMarkers = (text) => {
        if (!text) return text;
        // Fast path: most tokens won't contain markers; avoid many regexes
        if (!HAS_MARKERS_RE.test(text)) return text;
        return text
            // XML-like tags
            .replace(/<\/?\s*think\s*>/gi, '')
            .replace(/<\/?\s*final\s*>/gi, '')
            // Bracket markers with optional spaces/case
            .replace(/\[\s*REASONING[^\]]*\]/gi, '')
            .replace(/\[\s*FINAL[^\]]*\]/gi, '')
            .replace(/\[\s*THINK[^\]]*\]/gi, '')
            // Incomplete trailing marker fragments (during live stream)
            .replace(/\[\s*(?:REASONING|FINAL|THINK)[^\]]*$/gim, '')
            // Common synonyms/labels at line starts
            .replace(/^\s*(Reasoning|Gedanken|Denken)\s*:?/gim, '')
            .replace(/^\s*(Final(?: Answer)?|Antwort|Answer)\s*:?/gim, '')
            .replace(/^\s*Answer\s*:?/gim, '')
            // Internal guidance headers/blocks
            .replace(/\[\s*Output\s+Format\s*\]/gi, '')
            .replace(/If you need web data, you may first reply with WEBSEARCH:\s*<query>.*?(?:\r?\n|$)/gi, '')
            .replace(/```[\s\S]*?\[\s*Output\s+Format\s*\][\s\S]*?```/gi, '')
            // Decorative fullwidth brackets often used by some models
            .replace(/[【】]/g, '')
            ;
    };

    // Remove internal instruction text from display (keep buffers intact elsewhere)
    const sanitizeReasoningForDisplay = (text) => {
        if (!text) return text;
        try {
            return text
                // Output Format header
                .replace(/\[\s*Output\s+Format\s*\]/gi, '')
                // Guidance lines from buildReasoningInstruction()
                .replace(/\[\s*REASONING\s*\]\s*Provide a short, high-level outline.*?(?:\r?\n|$)/gi, '[REASONING]\n')
                .replace(/\[\s*FINAL\s*\]\s*Provide the final answer for the user\..*?(?:\r?\n|$)/gi, '[FINAL]\n')
                .replace(/If you need web data, you may first reply with WEBSEARCH:\s*<query>.*?(?:\r?\n|$)/gi, '')
                // Hide any stray <think> tags from display
                .replace(/<\/?\s*think\s*>/gi, '')
                // Fenced blocks that include Output Format
                .replace(/```[\s\S]*?\[\s*Output\s+Format\s*\][\s\S]*?```/gi, '')
                ;
        } catch { return text; }
    };

    // Remove internal instruction text from final answer
    const sanitizeFinalForDisplay = (text) => {
        if (!text) return text;
        try {
            return text
                .replace(/\[\s*Output\s+Format\s*\]/gi, '')
                .replace(/\[\s*REASONING\s*\]\s*Provide a short, high-level outline.*?(?:\r?\n|$)/gi, '')
                .replace(/\[\s*FINAL\s*\]\s*Provide the final answer for the user\..*?(?:\r?\n|$)/gi, '')
                .replace(/If you need web data, you may first reply with WEBSEARCH:\s*<query>.*?(?:\r?\n|$)/gi, '')
                .replace(/```[\s\S]*?\[\s*Output\s+Format\s*\][\s\S]*?```/gi, '')
                .replace(/<\/?\s*think\s*>/gi, '')
                ;
        } catch { return text; }
    };

    // Remove duplicated trailing block like XYZXYZ at the end (simple symmetric check)
    const dedupeTrailingRepeat = (text) => {
        if (!text || text.length < 8) return text;
        const maxCheck = Math.min(4000, text.length);
        const tail = text.slice(-maxCheck);
        const mid = Math.floor(tail.length / 2);
        const a = tail.slice(0, mid);
        const b = tail.slice(mid);
        if (a && a === b) {
            return text.slice(0, text.length - (tail.length - mid));
        }
        return text;
    };

    const unlisteners = [];

    const cleanup = async () => {
        if (fastapiAbort) {
            try { fastapiAbort(); } catch {}
            fastapiAbort = null;
        }
        for (const un of unlisteners) {
            try { if (typeof un === 'function') await un(); } catch {}
        }
        unlisteners.length = 0;
        // Close reasoning dropdown if present
        try { if (dropdown && dropdown.classList) dropdown.classList.remove('open'); } catch {}
    };

    // Register a cancel function globally for this stream instance
    const cancelThisStream = async () => {
        try { closed = true; } catch {}
        try { clearWatchdog(); } catch {}
        try { await cleanup(); } catch {}
        // Clear global cancel hook on manual cancel
        if (window.__cancelActiveStream === cancelThisStream) {
            window.__cancelActiveStream = null;
        }
    };
    window.__cancelActiveStream = cancelThisStream;

    let fastapiAbort = null;

    async function streamViaFastAPI(prompt) {
        const controller = new AbortController();
        fastapiAbort = () => controller.abort();
        try {
            const res = await fetch(`${FASTAPI_URL}/generate/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedOllamaModel || 'llama3.1',
                    prompt,
                    keep_alive: '10m'
                }),
                signal: controller.signal,
            });
            if (!res.ok || !res.body) {
                throw new Error(`FastAPI stream failed: ${res.status}`);
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                if (chunk) await onToken({ payload: chunk });
            }
            await onDone({ payload: null });
        } catch (err) {
            if (controller.signal.aborted) return; // silent on abort
            // Fallback: attach Tauri listeners and restart via Tauri immediately
            try {
                await setupTauriListeners();
                await invoke('generate_ai_response_stream', { message: prompt, model: selectedOllamaModel || undefined });
                return;
            } catch {}
            await onError({ payload: String(err || 'error') });
        } finally {
            fastapiAbort = null;
        }
    }

    const startStream = async (prompt, useFastAPI) => {
        if (useFastAPI) return streamViaFastAPI(prompt);
        await invoke('generate_ai_response_stream', { message: prompt, model: selectedOllamaModel || undefined });
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

        // Detect WEBSEARCH early
        // Only allow tool switch in the very beginning to avoid interrupting reasoning
        if (!reasoningStarted && buffer.length <= 200 && /^\s*WEBSEARCH:/i.test(buffer)) {
            // Stop current stream -> cleanup and trigger search
            if (!websearchTriggered && activeTools && activeTools.has && activeTools.has('websearch')) {
                websearchTriggered = true;
                await cleanup();
                const m = buffer.match(/^\s*WEBSEARCH:\s*(.+)/i);
                const query = m && m[1] ? m[1].trim() : originalUserMessage;
                const webResults = await performWebSearch(query || originalUserMessage, 5);
                const enriched = originalUserMessage + formatWebResultsForPrompt(webResults) + (ENABLE_INTERNAL_REASONING_PROMPT ? buildReasoningInstruction() : '');
                buffer = '';
                fullText = '';
                reasoningStarted = false;
                await setupListeners();
                await startStream(enriched);
                return;
            }
        }

        // Live append logic: if not in final mode, write to dropdown; switch to final on [FINAL]
        // Mark reasoning started either by explicit tag or by first token
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
            // Detect [FINAL] or variants (case-insensitive, spaces allowed) or <final> or closing </think>
            const finalRegex = /\[\s*final\s*\]|<\s*final\s*>/i;
            const finalIdx = buffer.search(finalRegex);
            // Also watch for closing </think>
            const thinkCloseRegex = /<\s*\/\s*think\s*>/i;
            const thinkCloseIdx = buffer.search(thinkCloseRegex);
            // Also consider headings like "Final:", "Final Answer:", "Antwort:", or "Answer:" at a line start
            const headingRegex = /(?:^|\n)\s*(?:#{0,3}\s*)?(?:Final(?: Answer)?|Antwort|Answer)\s*:/i;
            const headingIdx = buffer.search(headingRegex);
            // Choose the earliest positive index among candidates
            const candidates = [finalIdx, thinkCloseIdx, headingIdx].filter(i => i !== -1);
            const switchIdx = candidates.length ? Math.min(...candidates) : -1;
            if (switchIdx !== -1) {
                // write reasoning up to [FINAL]
                const chunk = buffer.slice(0, switchIdx);
                if (chunk) {
                    reasoningBuffer += SHOW_TAGS_IN_REASONING ? chunk : stripMarkers(chunk);
                    // re-sanitize full buffer in case a tag completed across chunks
                    scheduleRender();
                }
                // switch to final mode
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
                // do NOT collapse here; keep showing full reasoning until stream finishes
                if (buffer) {
                    finalBuffer += stripMarkers(buffer);
                    buffer = '';
                }
            } else {
                // no [FINAL] yet, keep appending to reasoning
                reasoningBuffer += SHOW_TAGS_IN_REASONING ? token : stripMarkers(token);
                // Apply soft cap to keep UI snappy
                if (reasoningBuffer.length > MAX_REASONING_CHARS) {
                    reasoningBuffer = reasoningBuffer.slice(-MAX_REASONING_CHARS);
                }
                // re-sanitize full buffer to remove any completed markers
                scheduleRender();
            }
            // scroll handled in scheduleRender
        } else {
            // Already in final phase, accumulate for final answer
            finalBuffer += stripMarkers(token);
        }
    };

    const onDone = async (event) => {
        if (closed) return;
        closed = true;
        clearWatchdog();
        if (firstTokenTimer) { clearTimeout(firstTokenTimer); firstTokenTimer = null; }
        console.log(`[stream] ai_done after ${__tokenCount} tokens`);
        // Backend may or may not include final payload; prefer accumulated buffers
        const payload = typeof event?.payload === 'string' ? event.payload : '';
        // Final flush before closing
        await new Promise((r) => requestAnimationFrame(() => r()));
        // Clean trailing duplicates in reasoning before last flush
        reasoningBuffer = dedupeTrailingRepeat(reasoningBuffer);
        isFinalFlush = true;
        flushRender();
        isFinalFlush = false;
        await cleanup();
        // Close dropdown only after final reasoning fully shown (small grace delay)
        setTimeout(() => { try { if (dropdown && dropdown.classList) dropdown.classList.remove('open'); } catch {} }, 120);
        // Simple final extraction (optional ultra-simple mode)
        const source = (typeof payload === 'string' && payload.trim().length) ? payload : fullText;
        let finalOnly = '';
        if (SIMPLE_FINAL) {
            const cleaned = (source || '')
                .replace(/<\/?\s*think\s*>/gi, '')
                .replace(/<\/?\s*final\s*>/gi, '');
            finalOnly = getLastNonEmptyParagraph(cleaned).trim();
            if (!finalOnly) finalOnly = (finalBuffer || '').trim();
            if (!finalOnly) finalOnly = (source || '').trim();
            // Ensure no visible markers leak into final answer
            finalOnly = stripMarkers(finalOnly || '').trim();
        } else {
            // Previous simplified heuristic
            // 1) Prefer what we accumulated in final mode
            if (finalBuffer && finalBuffer.trim().length) {
                finalOnly = finalBuffer;
            } else if (source && source.length) {
                const lc = source.toLowerCase();
                const thinkClose = '</think>';
                const thinkIdx = lc.lastIndexOf(thinkClose);
                if (thinkIdx !== -1) {
                    finalOnly = source.slice(thinkIdx + thinkClose.length);
                }
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
                if (!finalOnly || !finalOnly.trim().length) finalOnly = reasoningBuffer;
            }
            if (!finalOnly || !finalOnly.trim()) {
                // Hard fallback to the complete streamed text
                finalOnly = (source || fullText || '').trim() || '…';
                finalOnly = stripMarkers(finalOnly || '').trim();
            }
            // Final cleanup: ensure no instruction text leaks into the answer
            finalOnly = sanitizeFinalForDisplay(finalOnly).trim();
        }
        hideThinkingAnimation();
        const aiMessage = { role: 'assistant', content: finalOnly, reasoning: null, timestamp: new Date() };
        conversation.messages.push(aiMessage);
        // Render immediately to avoid any animation-related failure paths
        displayMessage(aiMessage);
        conversation.updated_at = new Date();
        updateConversationList();
        // Clear global cancel hook when this stream completes
        if (window.__cancelActiveStream === cancelThisStream) {
            window.__cancelActiveStream = null;
        }
    };

    const onError = async (event) => {
        if (closed) return;
        closed = true;
        clearWatchdog();
        if (firstTokenTimer) { clearTimeout(firstTokenTimer); firstTokenTimer = null; }
        await cleanup();
        const aiMessage = { role: 'assistant', content: 'Fehler beim Streamen der Antwort.', timestamp: new Date() };
        await displayMessageWithTypewriter(aiMessage);
        await new Promise(resolve => setTimeout(resolve, 500));
        hideThinkingAnimation();
        // Clear global cancel hook on error
        if (window.__cancelActiveStream === cancelThisStream) {
            window.__cancelActiveStream = null;
        }
    };

    // Tauri listener attach helper
    const setupTauriListeners = async () => {
        const un1 = await tauri.event.listen('ai_token', onToken);
        const un2 = await tauri.event.listen('ai_done', onDone);
        const un3 = await tauri.event.listen('ai_error', onError);
        unlisteners.push(un1, un2, un3);
    };

    async function setupListeners(useFastAPI) {
        if (useFastAPI) {
            // FastAPI path uses fetch streaming; no Tauri event listeners
            return;
        }
        await setupTauriListeners();
    }

    const fastapiAvailable = USE_FASTAPI_STREAM && await isFastAPIUp();
    await setupListeners(fastapiAvailable);
    console.log('[stream] listeners attached, starting stream');
    startWatchdog();
    await startStream(finalPrompt, fastapiAvailable);
}

// Web Search tool wrapper
async function performWebSearch(query, max = 5) {
    try {
        const res = await invoke('web_search', { query, max_results: max });
        if (!Array.isArray(res)) return [];
        return res;
    } catch (e) {
        console.warn('Web search failed:', e);
        return [];
    }
}

// Detect if a selected model is likely a reasoning model (heuristic; adjustable)
function isReasoningModelActive() {
    if (!selectedOllamaModel) return false;
    const name = selectedOllamaModel.toLowerCase();
    const hints = ['reason', 'r1', 'o4', 'deepseek', 'think', 'qwen2.5-r', 'r-'];
    return hints.some(h => name.includes(h));
}

// Ask LLM to return structured sections when reasoning is active
function buildReasoningInstruction() {
    return (
        `\n\n[Output Format]\n` +
        `[REASONING]\nProvide a short, high-level outline (3-7 lines).\n` +
        `[FINAL]\nProvide the final answer for the user.\n` +
        `If you need web data, you may first reply with WEBSEARCH: <query> (no other text).\n`
    );
}

function parseReasoningAndFinal(text) {
    if (typeof text !== 'string') return null;
    // 1) [REASONING] ... [FINAL] ...
    let m = text.match(/\[REASONING\]([\s\S]*?)\[\s*FINAL\s*\]([\s\S]*)/i);
    if (m) return { reasoning: m[1].trim(), final: m[2].trim() };
    // 2) <final> ... (no explicit reasoning)
    m = text.match(/<\s*final\s*>\s*([\s\S]*)/i);
    if (m) return { reasoning: '', final: m[1].trim() };
    // 3) [FINAL] ... (no explicit reasoning)
    m = text.match(/\[\s*final[^\]]*\]([\s\S]*)/i);
    if (m) return { reasoning: '', final: m[1].trim() };
    // 3a) <think> ... </think> final... (common in reasoning models)
    //     Extract the last think block as reasoning and anything after the closing tag as final
    //     Works even if multiple <think> blocks are present.
    {
        const thinkOpen = /<\s*think\s*>/ig;
        const thinkClose = /<\s*\/\s*think\s*>/ig;
        let lastCloseIdx = -1;
        let closeMatch;
        while ((closeMatch = thinkClose.exec(text)) !== null) {
            lastCloseIdx = closeMatch.index + closeMatch[0].length;
        }
        if (lastCloseIdx !== -1) {
            // Find the first <think> before the last </think> to extract reasoning roughly
            let firstOpenIdx = -1;
            let openMatch;
            while ((openMatch = thinkOpen.exec(text)) !== null) {
                if (openMatch.index < lastCloseIdx) {
                    if (firstOpenIdx === -1) firstOpenIdx = openMatch.index + openMatch[0].length;
                } else {
                    break;
                }
            }
            const reasoningPart = (firstOpenIdx !== -1)
                ? text.substring(firstOpenIdx, lastCloseIdx - '</think>'.length).trim()
                : '';
            const finalPart = text.substring(lastCloseIdx).trim();
            if (finalPart) {
                return { reasoning: reasoningPart, final: finalPart };
            }
        }
    }
    // 4) Final headings
    m = text.match(/^\s*(?:###\s*)?(?:Final(?: Answer)?|Antwort|Answer)\s*:?[\t ]*\n?([\s\S]*)/im);
    if (m) return { reasoning: '', final: m[1].trim() };
    // 5) Heuristic: if no markers, take text after the last blank line as final
    const parts = String(text).split(/\n\s*\n/);
    if (parts.length > 1) {
        const finalGuess = parts[parts.length - 1].trim();
        const reasoningGuess = parts.slice(0, -1).join('\n\n').trim();
        if (finalGuess) return { reasoning: reasoningGuess, final: finalGuess };
    }
    return null;
}

function formatWebResultsForPrompt(results) {
    if (!results || !results.length) return '';
    const lines = results.slice(0, 5).map((r, i) => `${i + 1}. ${r.title} — ${r.url}\n${r.snippet}`);
    return `\n\n[Web search results]\n${lines.join('\n\n')}\n\nUsing the above web results, answer the user's query with concise citations as [n] when relevant.`;
}

function buildToolAwareInstruction() {
    // Minimal schema to let LLM request the web search tool explicitly
    return (
        `\n\n[Tools Available]\n` +
        `- websearch: Search the web for up-to-date information.\n` +
        `\nHow to use a tool:\n` +
        `If you need web data, respond ONLY with a single line starting with:\n` +
        `WEBSEARCH: <your query>\n` +
        `No other text. After results are provided, produce the final answer with brief [n] citations.\n`
    );
}

// Global state
let conversations = {};
let currentConversationId = null;
let userId = generateUUID();
// Persisted selected Ollama model
let selectedOllamaModel = localStorage.getItem('selectedOllamaModel') || null;

// Markdown renderer (initialized when DOM is ready and libraries are present)
let __md = null;
const renderMarkdown = (text) => {
    try {
        if (!__md && window.markdownit) {
            __md = window.markdownit({ html: false, linkify: true, breaks: true });
        }
        const rawHtml = __md ? __md.render(text || '') : (text || '');
        if (window.DOMPurify) {
            return window.DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
        }
        return rawHtml;
    } catch (e) {
        console.warn('Markdown render failed, falling back to plain text:', e);
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
};

// Generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Theme management - Always dark mode
class ThemeManager {
    constructor() {
        this.init();
    }

    init() {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

// Sidebar management
class SidebarManager {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.sidebarDockToggle = document.getElementById('sidebarDockToggle');
        this.mainContent = document.getElementById('mainContent');
        this.init();
    }

    init() {
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
            this.collapseSidebar();
        }

        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }
        if (this.sidebarDockToggle) {
            this.sidebarDockToggle.addEventListener('click', () => this.toggleSidebar());
        }

        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
    }

    toggleSidebar() {
        if (this.sidebar.classList.contains('collapsed')) {
            this.expandSidebar();
        } else {
            this.collapseSidebar();
        }
    }

    collapseSidebar() {
        this.sidebar.classList.add('collapsed');
        this.mainContent.classList.add('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', 'true');
        
        const icon = this.sidebarToggle?.querySelector('i');
        if (icon) icon.className = 'fas fa-angle-right';
    }

    expandSidebar() {
        this.sidebar.classList.remove('collapsed');
        this.mainContent.classList.remove('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', 'false');
        
        const icon = this.sidebarToggle?.querySelector('i');
        if (icon) icon.className = 'fas fa-angle-left';
    }

    handleResize() {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            if (!this.sidebar.classList.contains('collapsed')) {
                this.sidebar.classList.add('collapsed');
                this.mainContent.classList.add('sidebar-collapsed');
            }
        }
    }

    handleOutsideClick(e) {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) return;

        const isClickInsideSidebar = this.sidebar.contains(e.target);
        const isClickOnToggle = this.sidebarToggle.contains(e.target);
        const isSidebarOpen = !this.sidebar.classList.contains('collapsed');

        if (isSidebarOpen && !isClickInsideSidebar && !isClickOnToggle) {
            this.collapseSidebar();
        }
    }
}

// Message input management
class MessageInputManager {
    constructor() {
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.messagesArea = document.getElementById('messagesArea');
        this.chatForm = document.getElementById('chatForm');
        this.init();
    }

    init() {
        if (!this.messageInput) return;

        this.messageInput.addEventListener('input', () => this.autoResize());
        this.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.messageInput.addEventListener('input', () => this.updateSendButton());
        
        this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
        
        this.messageInput.focus();
        this.scrollToBottom();
    }

    autoResize() {
        this.messageInput.style.height = 'auto';
        const newHeight = Math.min(this.messageInput.scrollHeight, window.innerHeight * 0.65);
        this.messageInput.style.height = newHeight + 'px';
        
        if (this.messageInput.scrollHeight > newHeight) {
            this.messageInput.scrollTop = this.messageInput.scrollHeight;
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (this.messageInput.value.trim()) {
                this.chatForm.dispatchEvent(new Event('submit'));
            }
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Clear input
        this.messageInput.value = '';
        this.autoResize();
        this.updateSendButton();

        // Send message
        // Fire-and-forget to avoid blocking UI on first message
        sendMessage(message);
    }

    updateSendButton() {
        if (!this.sendBtn) return;
        
        const hasContent = this.messageInput.value.trim().length > 0;
        this.sendBtn.disabled = !hasContent;
        
        if (hasContent) {
            this.sendBtn.classList.add('active');
        } else {
            this.sendBtn.classList.remove('active');
        }
    }

    scrollToBottom() {
        if (this.messagesArea) {
            setTimeout(() => {
                this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
            }, 100);
        }
    }
}

// Conversation management
function newConversation() {
    currentConversationId = generateUUID();
    
    if (!conversations[userId]) {
        conversations[userId] = {};
    }
    
    conversations[userId][currentConversationId] = {
        id: currentConversationId,
        title: 'New Conversation',
        messages: [],
        created_at: new Date(),
        updated_at: new Date()
    };
    
    updateConversationList();
    clearMessages();
}

async function sendMessage(messageContent) {
    // If no conversation, create one
    if (!currentConversationId) {
        newConversation();
    }
    
    const conversation = conversations[userId][currentConversationId];
    
    // Add user message
    const userMessage = {
        role: 'user',
        content: messageContent,
        timestamp: new Date()
    };
    conversation.messages.push(userMessage);
    // Update conversation timestamp and list immediately for responsiveness
    conversation.updated_at = new Date();
    updateConversationList();

    // Update conversation title if it's the first message
    if (conversation.messages.length === 1) {
        conversation.title = messageContent.substring(0, 50) + (messageContent.length > 50 ? '...' : '');
        // Reflect new title right away
        updateConversationList();
    }
    
    // Display user message
    displayMessage(userMessage);
    
    // Show thinking animation
    showThinkingAnimation();
    
    // Generate AI response using Tauri backend
    try {
        // If Web Search tool is active, add tool-aware instruction so models know they can use it
        const toolAware = (activeTools && activeTools.has && activeTools.has('websearch')) ? buildToolAwareInstruction() : '';
        const reasoningAware = (ENABLE_INTERNAL_REASONING_PROMPT && isReasoningModelActive()) ? buildReasoningInstruction() : '';
        let finalPrompt = messageContent + toolAware + reasoningAware;

        if (isReasoningModelActive()) {
            // Stream tokens and live-update the reasoning dropdown
            await streamAssistantResponse(finalPrompt, messageContent, conversation);
        } else {
            const aiResponse = await invoke('generate_ai_response', {
                message: finalPrompt,
                model: selectedOllamaModel || undefined
            });
            
            let finalAnswer = aiResponse || '';
            // If the model requested web search explicitly, perform it and re-prompt
            const toolRequested = typeof finalAnswer === 'string' && /^\s*WEBSEARCH:\s*(.+)/i.test(finalAnswer);
            if (toolRequested && activeTools && activeTools.has && activeTools.has('websearch')) {
                const m = finalAnswer.match(/^\s*WEBSEARCH:\s*(.+)/i);
                const query = m && m[1] ? m[1].trim() : messageContent;
                const webResults = await performWebSearch(query || messageContent, 5);
                const enriched = messageContent + formatWebResultsForPrompt(webResults);
                finalAnswer = await invoke('generate_ai_response', {
                    message: enriched,
                    model: selectedOllamaModel || undefined
                });
            }

            // Hide thinking animation now that we have the final answer
            hideThinkingAnimation();

            const aiMessage = {
                role: 'assistant',
                content: finalAnswer,
                timestamp: new Date()
            };
            conversation.messages.push(aiMessage);
            await displayMessageWithTypewriter(aiMessage);

            // Update conversation timestamp
            conversation.updated_at = new Date();
            updateConversationList();
        }
        
    } catch (error) {
        console.error('Error generating AI response:', error);
        
        // Hide thinking animation on error
        hideThinkingAnimation();
        
        const errorMessage = {
            role: 'assistant',
            content: 'Entschuldigung, es gab einen Fehler bei der Verarbeitung Ihrer Nachricht.',
            timestamp: new Date()
        };
        await displayMessageWithTypewriter(errorMessage);
    }
}

function showThinkingAnimation() {
    const messagesArea = document.getElementById('messagesArea');
    
    // Create thinking animation element
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'message assistant';
    thinkingDiv.id = 'thinking-message';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    if (isReasoningModelActive()) {
        contentDiv.innerHTML = `
            <div class="reasoning-thinking">
                <div class="reasoning-header" onclick="this.classList.toggle('open'); this.nextElementSibling.classList.toggle('open')">
                    <span class="thinking-text">Thinking…</span>
                    <i class="fas fa-chevron-right reasoning-caret" aria-hidden="true"></i>
                </div>
                <div class="reasoning-dropdown">
                    <div class="reasoning-placeholder">Reasoning will be shown with the final answer.</div>
                </div>
            </div>
        `;
    } else {
        contentDiv.innerHTML = `
            <span class="thinking-text">Thinking…</span>
        `;
    }
    
    thinkingDiv.appendChild(contentDiv);
    messagesArea.appendChild(thinkingDiv);
    
    // Default: open during reasoning streaming so caret points down
    try {
        const header = thinkingDiv.querySelector('.reasoning-header');
        const dropdown = thinkingDiv.querySelector('.reasoning-dropdown');
        if (header && dropdown) {
            header.classList.add('open');
            dropdown.classList.add('open');
        }
    } catch {}
    
    // Scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function hideThinkingAnimation() {
    const thinkingMessage = document.getElementById('thinking-message');
    if (thinkingMessage) {
        thinkingMessage.remove();
    }
}

function typeWriterEffect(element, text, speed = 30) {
    return new Promise((resolve) => {
        let i = 0;
        element.innerHTML = '';
        
        // Add cursor
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        cursor.textContent = '|';
        element.appendChild(cursor);
        
        const timer = setInterval(() => {
            if (i < text.length) {
                // Insert character before cursor
                const textNode = document.createTextNode(text.charAt(i));
                element.insertBefore(textNode, cursor);
                i++;
                
                // Scroll to bottom while typing
                const messagesArea = document.getElementById('messagesArea');
                if (messagesArea) {
                    messagesArea.scrollTop = messagesArea.scrollHeight;
                }
            } else {
                // Remove cursor when done
                cursor.remove();
                clearInterval(timer);
                resolve();
            }
        }, speed);
    });
}

async function displayMessageWithTypewriter(message) {
    const messagesArea = document.getElementById('messagesArea');
    const inputArea = document.querySelector('.input-area');
    const chatContainer = document.querySelector('.chat-container');
    
    // Smoothly move input area to bottom when first message is displayed (FLIP with fallback, JS-only)
    if (inputArea && inputArea.classList.contains('centered') && !window.__centerTransitioned) {
        window.__centerTransitioned = true;
        const first = inputArea.getBoundingClientRect();
        inputArea.style.transition = 'none';
        inputArea.style.willChange = 'transform';

        requestAnimationFrame(() => {
            inputArea.classList.remove('centered');
            messagesArea.classList.remove('with-centered-input');
            chatContainer.classList.remove('input-centered');

            requestAnimationFrame(() => {
                const last = inputArea.getBoundingClientRect();
                const deltaX = first.left - last.left;
                const deltaY = first.top - last.top;

                if (Math.abs(deltaY) < 8 && Math.abs(deltaX) < 8) {
                    inputArea.style.transform = 'translateY(-40vh)';
                } else {
                    inputArea.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                }

                void inputArea.offsetWidth;
                inputArea.style.transition = 'transform 360ms ease';
                inputArea.style.transform = 'translate(0, 0)';

                setTimeout(() => {
                    inputArea.style.transition = '';
                    inputArea.style.transform = '';
                    inputArea.style.willChange = '';
                }, 400);
            });
        });
    } else {
        // Ensure messages are visible if centered classes were left behind
        messagesArea.classList.remove('with-centered-input');
        chatContainer.classList.remove('input-centered');
        inputArea.classList.remove('centered');
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // For AI messages, use typewriter effect
    if (message.role === 'assistant') {
        // Typewriter for assistant content only (no reasoning block)
        const finalText = renderMarkdown(message.content || '');
        const textContainer = document.createElement('div');
        textContainer.className = 'typewriter-container';
        messageDiv.appendChild(contentDiv);
        contentDiv.appendChild(textContainer);
        await typeWriterEffect(textContainer, (message.content || ''));
        textContainer.replaceWith((() => { const div = document.createElement('div'); div.innerHTML = finalText; return div; })());
    } else {
        // User messages appear instantly
        displayMessage(message);
    }
}

function displayMessage(message) {
    const messagesArea = document.getElementById('messagesArea');
    const inputArea = document.querySelector('.input-area');
    const chatContainer = document.querySelector('.chat-container');
    
    // If this is the first user message and the input is centered, move it down immediately (FLIP)
    if (message.role !== 'assistant' && inputArea && inputArea.classList.contains('centered') && !window.__centerTransitioned) {
        window.__centerTransitioned = true;
        const first = inputArea.getBoundingClientRect();
        inputArea.style.transition = 'none';
        inputArea.style.willChange = 'transform';

        requestAnimationFrame(() => {
            inputArea.classList.remove('centered');
            messagesArea.classList.remove('with-centered-input');
            chatContainer.classList.remove('input-centered');

            requestAnimationFrame(() => {
                const last = inputArea.getBoundingClientRect();
                const deltaX = first.left - last.left;
                const deltaY = first.top - last.top;

                if (Math.abs(deltaY) < 8 && Math.abs(deltaX) < 8) {
                    inputArea.style.transform = 'translateY(-40vh)';
                } else {
                    inputArea.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                }

                void inputArea.offsetWidth;
                inputArea.style.transition = 'transform 360ms ease';
                inputArea.style.transform = 'translate(0, 0)';

                setTimeout(() => {
                    inputArea.style.transition = '';
                    inputArea.style.transform = '';
                    inputArea.style.willChange = '';
                }, 400);
            });
        });
    } else {
        // Ensure messages are visible if centered classes were left behind
        messagesArea.classList.remove('with-centered-input');
        chatContainer.classList.remove('input-centered');
        inputArea.classList.remove('centered');
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (message.role === 'assistant') {
        // Render assistant messages as sanitized Markdown
        contentDiv.innerHTML = renderMarkdown(message.content || '');
    } else {
        contentDiv.innerHTML = `<p>${message.content.replace(/\n/g, '<br>')}</p>`;
    }
    
    messageDiv.appendChild(contentDiv);
    messagesArea.appendChild(messageDiv);

    // Scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// ... (rest of the code remains the same)

function clearMessages() {
    const messagesArea = document.getElementById('messagesArea');
    const inputArea = document.querySelector('.input-area');
    const chatContainer = document.querySelector('.chat-container');

    // Clear messages area
    messagesArea.innerHTML = '';

    // Center the input area when no messages
    if (inputArea && chatContainer) {
        inputArea.classList.add('centered');
        messagesArea.classList.add('with-centered-input');
        chatContainer.classList.add('input-centered');
    }

    // Reset transition flag so next first message can transition again
    window.__centerTransitioned = false;
}

function updateConversationList() {
    const conversationList = document.getElementById('conversationList');

    
    if (!conversations[userId] || Object.keys(conversations[userId]).length === 0) {
        conversationList.innerHTML = '<div class="empty-state"><p>No conversations yet</p></div>';
        return;
    }
    
    const conversationArray = Object.values(conversations[userId]);
    conversationArray.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    
    conversationList.innerHTML = '';
    
    conversationArray.forEach(conversation => {
        const conversationDiv = document.createElement('div');
        conversationDiv.className = `conversation-item ${conversation.id === currentConversationId ? 'active' : ''}`;
        conversationDiv.onclick = () => loadConversation(conversation.id);
        
        conversationDiv.innerHTML = `
            <div class="conversation-title">
                <span class="conversation-title-text" id="title-${conversation.id}">${conversation.title}</span>
                <input type="text" class="conversation-title-input" id="input-${conversation.id}" value="${conversation.title}" style="display: none;">
            </div>
            <div class="conversation-actions">
                <button class="conversation-dropdown" onclick="event.stopPropagation(); toggleDropdown('${conversation.id}')">
                    <i class="fas fa-ellipsis"></i>
                </button>
                <div class="conversation-dropdown-menu" id="dropdown-${conversation.id}">
                    <div class="dropdown-item" onclick="event.stopPropagation(); startRename('${conversation.id}')">
                        <i class="fas fa-edit"></i>
                        Rename
                    </div>
                    <div class="dropdown-item delete" id="delete-${conversation.id}" onclick="event.stopPropagation(); confirmDelete('${conversation.id}')">
                        <i class="fas fa-trash"></i>
                        <span class="delete-text">Delete</span>
                    </div>
                </div>
            </div>
        `;
        
        conversationList.appendChild(conversationDiv);
    });
}

function loadConversation(conversationId) {
    currentConversationId = conversationId;
    const conversation = conversations[userId][conversationId];
    const inputArea = document.querySelector('.input-area');
    const messagesArea = document.getElementById('messagesArea');
    
    // Clear messages area
    clearMessages();
    
    // If conversation has messages, move input to bottom
    if (conversation.messages.length > 0) {
        const chatContainer = document.querySelector('.chat-container');
        if (inputArea && chatContainer) {
            inputArea.classList.remove('centered');
            messagesArea.classList.remove('with-centered-input');
            chatContainer.classList.remove('input-centered');
        }
        
        // Display all messages instantly (no typewriter for loaded conversations)
        conversation.messages.forEach(message => {
            displayMessage(message);
        });
    }
    
    // Update conversation list
    updateConversationList();
}

function toggleDropdown(conversationId) {
    // Close all other dropdowns and reset their delete confirmations
    document.querySelectorAll('.conversation-dropdown-menu').forEach(menu => {
        if (menu.id !== `dropdown-${conversationId}`) {
            menu.classList.remove('show');
            // Reset delete confirmation for this dropdown
            const otherConversationId = menu.id.replace('dropdown-', '');
            resetDeleteConfirmation(otherConversationId);
        }
    });
    
    // Toggle current dropdown
    const dropdown = document.getElementById(`dropdown-${conversationId}`);
    if (dropdown) {
        const isShowing = dropdown.classList.contains('show');
        dropdown.classList.toggle('show');
        
        // Reset delete confirmation when closing
        if (isShowing) {
            resetDeleteConfirmation(conversationId);
        }
    }
}

function resetDeleteConfirmation(conversationId) {
    if (deleteConfirmations.has(conversationId)) {
        deleteConfirmations.delete(conversationId);
        const deleteButton = document.getElementById(`delete-${conversationId}`);
        if (deleteButton) {
            // Add fade-out class for smooth transition
            deleteButton.style.transition = 'all 0.3s ease';
            deleteButton.classList.remove('confirming');
            
            const deleteText = deleteButton.querySelector('.delete-text');
            if (deleteText) {
                // Smooth text transition
                setTimeout(() => {
                    deleteText.textContent = 'Delete';
                }, 150);
            }
        }
    }
}

function startRename(conversationId) {
    const titleText = document.getElementById(`title-${conversationId}`);
    const titleInput = document.getElementById(`input-${conversationId}`);
    
    if (titleText && titleInput) {
        // Hide text, show input
        titleText.style.display = 'none';
        titleInput.style.display = 'block';
        titleInput.focus();
        titleInput.select();
        
        // Add event listeners for save/cancel
        const handleSave = () => {
            const newTitle = titleInput.value.trim();
            if (newTitle && newTitle !== conversations[userId][conversationId].title) {
                conversations[userId][conversationId].title = newTitle;
                updateConversationList();
            } else {
                // Revert to original
                titleText.style.display = 'block';
                titleInput.style.display = 'none';
            }
        };
        
        const handleCancel = () => {
            titleInput.value = conversations[userId][conversationId].title;
            titleText.style.display = 'block';
            titleInput.style.display = 'none';
        };
        
        // Save on Enter, cancel on Escape
        titleInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        };
        
        // Save on blur (click outside)
        titleInput.onblur = handleSave;
    }
    
    // Close dropdown
    const dropdown = document.getElementById(`dropdown-${conversationId}`);
    if (dropdown) {
        dropdown.classList.remove('show');
    }
}

// Keep the old function for compatibility
function renameConversation(conversationId) {
    startRename(conversationId);
}

// Global variable to track confirmation states
let deleteConfirmations = new Set();

function confirmDelete(conversationId) {
    const deleteButton = document.getElementById(`delete-${conversationId}`);
    const deleteText = deleteButton.querySelector('.delete-text');
    
    if (!deleteConfirmations.has(conversationId)) {
        // First click - show confirmation
        deleteConfirmations.add(conversationId);
        deleteButton.classList.add('confirming');
        deleteText.textContent = 'Sure?';
        
        // Reset after 3 seconds if no second click
        setTimeout(() => {
            if (deleteConfirmations.has(conversationId)) {
                deleteConfirmations.delete(conversationId);
                deleteButton.classList.remove('confirming');
                deleteText.textContent = 'Delete';
            }
        }, 3000);
        
    } else {
        // Second click - actually delete
        deleteConfirmations.delete(conversationId);
        
        delete conversations[userId][conversationId];
        
        if (currentConversationId === conversationId) {
            currentConversationId = null;
            clearMessages();
        }
        
        updateConversationList();
        
        // Close dropdown
        const dropdown = document.getElementById(`dropdown-${conversationId}`);
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }
}

// Keep the old function for compatibility but redirect to new one
function deleteConversation(conversationId) {
    confirmDelete(conversationId);
}

// Main title dropdown functionality
function toggleMainTitleDropdown() {
    const dropdown = document.querySelector('.main-title-dropdown');
    const menu = document.getElementById('mainTitleMenu');
    
    dropdown.classList.toggle('open');
    menu.classList.toggle('show');
}

// Model selection functionality
function selectModel(modelType) {
    console.log('Selected model:', modelType);
    
    // Close dropdown
    const dropdown = document.querySelector('.main-title-dropdown');
    const menu = document.getElementById('mainTitleMenu');
    if (dropdown && menu) {
        dropdown.classList.remove('open');
        menu.classList.remove('show');
    }
    
    // Here we can add logic to switch between different AI models
    // For now, we'll just log the selection
    if (modelType === 'ollama') {
        console.log('Switching to Ollama models');
        // Future: Implement Ollama model integration
    }
}

// Fetch list of local Ollama models
async function fetchOllamaModels() {
    try {
        const res = await fetch('http://127.0.0.1:11434/api/tags');
        if (!res.ok) throw new Error('Ollama not reachable');
        const data = await res.json();
        return Array.isArray(data?.models) ? data.models : [];
    } catch (e) {
        console.warn('Failed to fetch Ollama models:', e.message);
        return [];
    }
}

// Probe connectivity to Ollama without relying on model count
async function checkOllamaReachable() {
    try {
        const res = await fetch('http://127.0.0.1:11434/api/tags', { method: 'GET' });
        return res.ok;
    } catch (_) {
        return false;
    }
}

async function updateOllamaCount() {
    const countEl = document.getElementById('ollamaModelCount');
    const statusDot = document.getElementById('ollamaStatusDot');
    if (!countEl) return [];

    const reachable = await checkOllamaReachable();
    let models = [];
    if (reachable) {
        models = await fetchOllamaModels();
    }

    // Update count
    countEl.textContent = String(models.length || 0);

    // Update status dot
    if (statusDot) {
        statusDot.classList.toggle('online', reachable);
        statusDot.classList.toggle('offline', !reachable);
        statusDot.setAttribute('title', reachable ? 'Ollama connected' : 'Ollama not connected');
    }

    return models;
}

// Right-side submenu for Ollama models
async function toggleOllamaMenu(event) {
    event.stopPropagation();
    const item = document.getElementById('ollamaMenuItem');
    if (!item) return;

    const existing = item.querySelector('.main-title-submenu');
    if (existing) {
        existing.classList.toggle('show');
        return;
    }

    const models = await updateOllamaCount();

    const submenu = document.createElement('div');
    submenu.className = 'main-title-submenu';

    if (!models.length) {
        const empty = document.createElement('div');
        empty.className = 'dropdown-item disabled';
        empty.textContent = 'No models found';
        submenu.appendChild(empty);
    } else {
        // If a previously selected model is no longer available, clear it
        if (selectedOllamaModel && !models.some(m => m.name === selectedOllamaModel)) {
            selectedOllamaModel = null;
            localStorage.removeItem('selectedOllamaModel');
        }
        models.forEach(m => {
            const row = document.createElement('div');
            row.className = 'dropdown-item';
            row.onclick = (e) => {
                e.stopPropagation();
                selectModelByName(m.name);
            };
            const left = document.createElement('div');
            left.className = 'dropdown-item-left';
            // Remove robot icon; show plain model name
            left.textContent = m.name;
            row.appendChild(left);

            // Right side checkmark if selected
            const right = document.createElement('div');
            right.className = 'dropdown-item-right';
            if (selectedOllamaModel === m.name) {
                const check = document.createElement('i');
                check.className = 'fas fa-check'; // icons default to white in styles.css
                right.appendChild(check);
            }
            row.appendChild(right);
            submenu.appendChild(row);
        });
    }

    item.appendChild(submenu);
    requestAnimationFrame(() => submenu.classList.add('show'));
}

function selectModelByName(modelName) {
    console.log('Selected Ollama model:', modelName);
    // Persist selection
    selectedOllamaModel = modelName;
    localStorage.setItem('selectedOllamaModel', modelName);

    // Update checkmarks in the open submenu without closing menus
    const item = document.getElementById('ollamaMenuItem');
    const submenu = item?.querySelector('.main-title-submenu');
    if (submenu) {
        submenu.querySelectorAll('.dropdown-item').forEach(row => {
            const name = row.querySelector('.dropdown-item-left')?.textContent?.trim();
            const right = row.querySelector('.dropdown-item-right') || (() => {
                const r = document.createElement('div');
                r.className = 'dropdown-item-right';
                row.appendChild(r);
                return r;
            })();
            right.innerHTML = '';
            if (name === selectedOllamaModel) {
                const check = document.createElement('i');
                check.className = 'fas fa-check';
                right.appendChild(check);
            }
        });
    }

    // Reflect selection in the main title button
    updateMainTitleLabel();

    // Warm newly selected model to reduce first-token latency
    warmModel(selectedOllamaModel);
}

// Update the main title button label to show the selected model (fallback: OpenChat)
function updateMainTitleLabel() {
    const btn = document.getElementById('mainTitleBtn');
    if (!btn) return;
    const label = selectedOllamaModel ? selectedOllamaModel : 'OpenChat';
    // Preserve the chevron icon
    btn.innerHTML = '';
    btn.appendChild(document.createTextNode(label + ' '));
    const icon = document.createElement('i');
    icon.className = 'fas fa-chevron-down';
    btn.appendChild(icon);
}

// Tools dropup functionality
function toggleToolsDropup() {
    const menu = document.getElementById('toolsDropupMenu');
    if (menu) {
        menu.classList.toggle('show');
    }
}

// Global variable to track active tools
let activeTools = new Set();

// Tool selection functionality
function selectTool(toolType) {
    console.log('Selected tool:', toolType);
    
    const toolElement = document.getElementById(`${toolType}-tool`);
    
    // Toggle tool active state
    if (activeTools.has(toolType)) {
        activeTools.delete(toolType);
        toolElement.classList.remove('active');
        console.log(`${toolType} tool deactivated`);
    } else {
        activeTools.add(toolType);
        toolElement.classList.add('active');
        console.log(`${toolType} tool activated`);
    }
    
    // DON'T close dropup - keep it open for multiple selections
    
    // Here we can add logic for different tools
    if (toolType === 'websearch') {
        // Future: Implement web search functionality
    }
}

// Make functions globally available
window.newConversation = newConversation;
window.deleteConversation = deleteConversation;
window.confirmDelete = confirmDelete;
window.toggleDropdown = toggleDropdown;
window.renameConversation = renameConversation;
window.startRename = startRename;
window.toggleMainTitleDropdown = toggleMainTitleDropdown;
window.selectModel = selectModel;
window.toggleOllamaMenu = toggleOllamaMenu;
window.selectModelByName = selectModelByName;
window.toggleToolsDropup = toggleToolsDropup;
window.selectTool = selectTool;

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    // Close conversation dropdowns
    if (!e.target.closest('.conversation-actions')) {
        document.querySelectorAll('.conversation-dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }
    
    // Close main title dropdown
    if (!e.target.closest('.main-title-dropdown')) {
        const dropdown = document.querySelector('.main-title-dropdown');
        const menu = document.getElementById('mainTitleMenu');
        if (dropdown && menu) {
            dropdown.classList.remove('open');
            menu.classList.remove('show');
        }
        const item = document.getElementById('ollamaMenuItem');
        const submenu = item?.querySelector('.main-title-submenu');
        if (submenu) submenu.classList.remove('show');
    }
    
    // Close tools dropup
    if (!e.target.closest('.tools-dropdown')) {
        const menu = document.getElementById('toolsDropupMenu');
        if (menu) {
            menu.classList.remove('show');
        }
    }
});

// Initialize all managers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ThemeManager();
    new SidebarManager();
    new MessageInputManager();
    
    // Initialize conversation list
    updateConversationList();
    
    // Center input area initially (no conversation active)
    const inputArea = document.querySelector('.input-area');
    const messagesArea = document.getElementById('messagesArea');
    const chatContainer = document.querySelector('.chat-container');
    
    console.log('Elements found:', { inputArea, messagesArea, chatContainer });
    
    if (inputArea && messagesArea && chatContainer) {
        inputArea.classList.add('centered');
        messagesArea.classList.add('with-centered-input');
        chatContainer.classList.add('input-centered');
        
        // Force re-apply multiple times to override Tauri
        setTimeout(() => {
            inputArea.classList.add('centered');
            messagesArea.classList.add('with-centered-input');
            chatContainer.classList.add('input-centered');
        }, 10);
        
        setTimeout(() => {
            inputArea.classList.add('centered');
            messagesArea.classList.add('with-centered-input');
            chatContainer.classList.add('input-centered');
        }, 100);
        
        console.log('Classes added:', {
            inputAreaClasses: inputArea.className,
            messagesAreaClasses: messagesArea.className,
            chatContainerClasses: chatContainer.className
        });
    }
    
    console.log('OpenChat Tauri Interface initialized successfully');

    // Initialize custom overlay scrollbar synced to messages area
    initCustomScrollbar();
    
    // Add click handler for main title dropdown
    const mainTitleBtn = document.getElementById('mainTitleBtn');
    if (mainTitleBtn) {
        mainTitleBtn.addEventListener('click', toggleMainTitleDropdown);
    }
    // Initialize main title with selected model (if any)
    updateMainTitleLabel();
    
    // Initialize Ollama model count (non-blocking)
    updateOllamaCount();

    // Warm the currently selected model (if any) to reduce first-token latency
    if (selectedOllamaModel) {
        warmModel(selectedOllamaModel);
    }
    
    // Auto-refresh Ollama status and count every 5 seconds (ensure single interval)
    if (window.__ollamaStatusIntervalId) {
        clearInterval(window.__ollamaStatusIntervalId);
    }
    window.__ollamaStatusIntervalId = setInterval(updateOllamaCount, 5000);
    
    // Disable default browser tooltips completely
    const disableBrowserTooltips = () => {
        document.querySelectorAll('[title]').forEach(element => {
            const originalTitle = element.getAttribute('title');
            
            // Store original title in data attribute
            element.setAttribute('data-tooltip', originalTitle);
            
            // Remove title attribute to prevent browser tooltip
            element.removeAttribute('title');
            
            // Add our custom tooltip class
            element.classList.add('custom-tooltip');
        });
    };
    
    // Run immediately and also observe for new elements
    disableBrowserTooltips();
    
    // Create observer for dynamically added elements
    const observer = new MutationObserver(() => {
        disableBrowserTooltips();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['title']
    });
    
    // Initialize centered layout
    const initializeCenteredLayout = () => {
        const inputArea = document.querySelector('.input-area');
        const messagesArea = document.getElementById('messagesArea');
        const chatContainer = document.querySelector('.chat-container');
        
        if (inputArea && messagesArea && chatContainer && !currentConversationId) {
            inputArea.classList.add('centered');
            messagesArea.classList.add('with-centered-input');
            chatContainer.classList.add('input-centered');
        }
    };
    
    // Initialize layout
    initializeCenteredLayout();
    
    // Ensure layout stays correct
    setInterval(initializeCenteredLayout, 1000);
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            setTimeout(() => messageInput.focus(), 100);
        }
        // Refresh Ollama status immediately when the window becomes active
        updateOllamaCount();
    }
});

// Custom overlay scrollbar implementation for messages area
function initCustomScrollbar() {
    const area = document.getElementById('messagesArea');
    const bar = document.getElementById('customScrollbar');
    if (!area || !bar) return;

    const thumb = bar.querySelector('.thumb');
    let dragging = false;
    let dragStartY = 0;
    let startScrollTop = 0;

    const updateThumbPosition = () => {
        const track = bar.clientHeight - thumb.clientHeight;
        const maxScroll = area.scrollHeight > area.clientHeight ? (area.scrollHeight - area.clientHeight) : 0;
        const scrollRatio = maxScroll > 0 ? area.scrollTop / maxScroll : 0;
        const y = Math.round(track * scrollRatio);
        thumb.style.transform = `translateY(${isFinite(y) ? y : 0}px)`;
    };

    const updateGeometry = () => {
        const rect = area.getBoundingClientRect();
        // Pin to window right, align vertically with messages area
        bar.style.position = 'fixed';
        bar.style.top = `${Math.max(rect.top, 0)}px`;
        const usableHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
        bar.style.height = `${Math.max(0, usableHeight)}px`;

        const hasOverflow = area.scrollHeight > area.clientHeight + 1;
        bar.style.display = hasOverflow ? 'block' : 'none';

        // Thumb size based on viewport vs content ratio
        const track = bar.clientHeight;
        const ratio = area.clientHeight / Math.max(area.scrollHeight, 1);
        const thumbH = Math.max(24, Math.floor(track * ratio));
        thumb.style.height = `${isFinite(thumbH) ? thumbH : 0}px`;
        updateThumbPosition();
    };

    // Sync from content scroll -> thumb
    area.addEventListener('scroll', updateThumbPosition, { passive: true });

    // Drag handling
    const onMouseMove = (e) => {
        if (!dragging) return;
        e.preventDefault();
        const track = bar.clientHeight - thumb.clientHeight;
        const dy = e.clientY - dragStartY;
        const thumbStartTop = (startScrollTop / Math.max(area.scrollHeight - area.clientHeight, 1)) * track || 0;
        const newTop = Math.min(Math.max(0, thumbStartTop + dy), track);
        const ratio = track > 0 ? newTop / track : 0;
        area.scrollTop = ratio * (area.scrollHeight - area.clientHeight);
    };

    const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        bar.classList.remove('dragging');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', endDrag);
    };

    thumb.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        bar.classList.add('dragging');
        dragStartY = e.clientY;
        startScrollTop = area.scrollTop;
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', endDrag);
    });

    // Click on track to page up/down
    bar.addEventListener('mousedown', (e) => {
        if (e.target !== bar) return; // Ignore clicks on thumb
        const rect = bar.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const thumbTop = thumb.offsetTop;
        const thumbBottom = thumbTop + thumb.clientHeight;
        const page = area.clientHeight * 0.9;
        if (clickY < thumbTop) {
            area.scrollTop = Math.max(0, area.scrollTop - page);
        } else if (clickY > thumbBottom) {
            area.scrollTop = Math.min(area.scrollHeight, area.scrollTop + page);
        }
    });

    // Wheel over the bar should scroll content as well
    bar.addEventListener('wheel', (e) => {
        e.preventDefault();
        area.scrollTop += e.deltaY;
    }, { passive: false });

    // Keep in sync on resize and content changes
    window.addEventListener('resize', updateGeometry);
    const ro = new ResizeObserver(updateGeometry);
    ro.observe(area);
    const mo = new MutationObserver(updateGeometry);
    mo.observe(area, { childList: true, subtree: true, characterData: true });

    // Initial
    setTimeout(updateGeometry, 0);
}