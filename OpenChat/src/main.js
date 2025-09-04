import { streamSimpleResponse, streamSseResponse } from './ai/base/index.js';
import { streamReasoningResponse } from './ai/reasoning/index.js';
import { performWebSearchFastAPI, formatWebResultsForPrompt } from './ai/tool/websearch.js';
import { buildPromptWithContext, answerFromHistoryIfApplicable } from './ai/global/index.js';

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

// Apply the chat font to the CSS variable so all chat text uses the exact same font
function applyChatFontVariable() {
    try {
        const ff = getChatFontFamily();
        if (ff && typeof ff === 'string' && ff.trim()) {
            document.documentElement.style.setProperty('--chat-font', ff);
        }
    } catch {}
}
    } catch (error) {
        console.error('Tauri invoke error:', error);
        throw error;
    }
};

// Get the exact font-family used by the user's chat input
function getChatFontFamily() {
    try {
        const src = document.getElementById('messageInput') || document.body;
        const cs = window.getComputedStyle(src);
        return cs && cs.fontFamily ? cs.fontFamily : '';
    } catch {
        return '';
    }
}

// Web search is handled by the backend via LangChain tools; no frontend binding needed

// Manage Ollama polling interval with adaptive backoff and visibility pause
function restartOllamaPolling() {
    try {
        if (window.__ollamaStatusIntervalId) {
            clearInterval(window.__ollamaStatusIntervalId);
            window.__ollamaStatusIntervalId = null;
        }
        if (document.hidden) return; // don't poll while hidden
        const period = window.__ollamaPollingMs || 5000;
        window.__ollamaStatusIntervalId = setInterval(updateOllamaCount, period);
    } catch {}
}

// Build a short prompt to ask the model for a concise conversation title
function buildTitlePrompt(conversation) {
    const msgs = (conversation?.messages || []);
    // Use the last 8 messages for context, trim each for brevity
    const recent = msgs.slice(-8).map(m => {
        const role = m.role === 'assistant' ? 'Assistant' : 'User';
        let content = (m.content || '').replace(/\s+/g, ' ').trim();
        if (content.length > 240) content = content.slice(0, 240) + '…';
        return `${role}: ${content}`;
    }).join('\n');

    // Instruction: return only a short, descriptive title
    const instruction = (
        'You will receive a short excerpt of a chat. '
        + 'Generate a concise, descriptive chat title that best reflects the overall topic.\n'
        + '- Keep it under 6 words.\n'
        + '- No surrounding quotes.\n'
        + '- No trailing punctuation.\n'
        + '- Output ONLY the title text.'
    );

    return `${instruction}\n\n[Conversation]\n${recent}`;
}

// Cheap local fallback if the model is slow/unavailable
function buildFallbackTitle(conversation) {
    if (!conversation || !Array.isArray(conversation.messages)) return 'New Chat';
    // Prefer last user message; otherwise last assistant
    const msgs = [...conversation.messages].reverse();
    const userMsg = msgs.find(m => m.role === 'user' && m.content && m.content.trim());
    const lastMsg = userMsg || msgs.find(m => m.content && m.content.trim());
    let text = (lastMsg?.content || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'New Chat';
    // Strip markdown fences/headers for cleanliness
    text = text.replace(/^```[\s\S]*?```/g, '').replace(/^#+\s*/gm, '');
    // Keep it short
    if (text.length > 64) text = text.slice(0, 64).trim();
    // Remove trailing punctuation/quotes
    text = text.replace(/["'`\-:;,.!?\s]+$/g, '').trim();
    return text || 'New Chat';
}

// Request a model-generated title and update the sidebar if it differs (safe, debounced, with timeout)
async function requestAIGeneratedTitle(conversation) {
    try {
        // Basic guards
        if (!conversation || !Array.isArray(conversation.messages)) return;

        // Prevent overlapping calls per conversation
        if (conversation.__titleBusy) return;

        // Debounce: skip if we recently tried (within 2s)
        const now = Date.now();
        if (conversation.__lastTitleAt && (now - conversation.__lastTitleAt) < 2000) return;

        // Previously: only on initial title or every 10 messages. That proved too restrictive.
        // New policy: allow on each assistant completion, but debounce ensures it won't spam.

        conversation.__titleBusy = true;
        conversation.__lastTitleAt = now;

        const prompt = buildTitlePrompt(conversation);
        // Resolve a reliable model for titles using a candidate cascade
        const resolveTitleModels = () => {
            const list = [];
            try {
                // Highest priority: explicit override list (CSV)
                const csv = localStorage.getItem('titleModelCandidates');
                if (csv && csv.trim()) {
                    csv.split(',').map(s=>s.trim()).filter(Boolean).forEach(m=>list.push(m));
                }
                // Next: single override
                const override = localStorage.getItem('titleModel');
                if (override && override.trim()) list.push(override.trim());
            } catch {}
            // If selected model is non-reasoning, try it too
            try {
                if (selectedOllamaModel && (!isReasoningModelName || !isReasoningModelName(selectedOllamaModel))) {
                    list.push(selectedOllamaModel);
                }
            } catch {}
            // Add common light models as last resort (best-effort; they may or may not exist)
            ['llama3.1:8b','llama3:8b','qwen2.5:7b','phi3:3.8b','mistral:7b'].forEach(m=>list.push(m));
            // Finally, undefined to let backend pick a default
            list.push(undefined);
            // De-duplicate while preserving order
            return Array.from(new Set(list));
        };

        const withTimeout = (p, ms) => new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error(`title-timeout-${ms}ms`)), ms);
            p.then(v => { clearTimeout(t); resolve(v); }).catch(err => { clearTimeout(t); reject(err); });
        });

        const tryGenerate = async (mdl) => {
            try {
                console.debug('[title] trying model:', mdl || '(default)');
                return await withTimeout(invoke('generate_ai_response', { message: prompt, model: mdl }), 6000);
            } catch (e) {
                console.debug('[title] model failed:', mdl || '(default)', e?.message || e);
                throw e;
            }
        };

        const candidates = resolveTitleModels();
        let result = '';
        for (const mdl of candidates) {
            try {
                result = await tryGenerate(mdl);
                if (result && String(result).trim()) { break; }
            } catch { /* try next */ }
        }

        if (!result || !String(result).trim()) throw new Error('empty-title-result');
        let title = String(result || '').trim();
        // Post-process: keep it to a single line and short
        title = title.split(/\r?\n/)[0].trim();
        if (title.length > 64) title = title.slice(0, 64).trim();
        // Avoid empty or fallback/error-like responses
        const lower = title.toLowerCase();
        const looksHttpCode = /\b(4\d\d|5\d\d)\b/.test(lower);
        const looksError = (
            lower.includes('error') || lower.includes('fehler') || lower.includes('timeout') ||
            lower.includes('backend not available') || lower.includes('not found') ||
            lower.includes('ollama') || lower.includes('tauri') || looksHttpCode ||
            lower.includes('leere antwort')
        );
        if (title && !looksError) {
            if (conversation.title !== title) {
                conversation.title = title;
                updateConversationList();
                console.debug('[title] updated:', title);
            }
        } else if (looksError) {
            // Replace error-like titles with a safe local fallback so the sidebar doesn't show errors
            const fallback = buildFallbackTitle(conversation);
            const currentLower = String(conversation.title || '').toLowerCase();
            const currentLooksHttp = /\b(4\d\d|5\d\d)\b/.test(currentLower);
            const currentLooksError = (
                currentLower.includes('error') || currentLower.includes('fehler') || currentLower.includes('timeout') ||
                currentLower.includes('backend not available') || currentLower.includes('not found') ||
                currentLower.includes('ollama') || currentLower.includes('tauri') || currentLooksHttp ||
                currentLower.includes('leere antwort')
            );
            if (!conversation.title || currentLooksError) {
                conversation.title = fallback;
                updateConversationList();
                console.debug('[title] replaced error with fallback:', fallback);
            }
        }
    } catch (e) {
        // Silent fail: never disrupt UI/streaming
        console.debug('Title generation skipped/failed:', e?.message || e);
    } finally {
        // If not updated, apply a quick local fallback so it's never blank
        try {
            if (!conversation.title || !conversation.title.trim()) {
                const fallback = buildFallbackTitle(conversation);
                if (fallback && fallback !== conversation.title) {
                    conversation.title = fallback;
                    updateConversationList();
                    console.debug('[title] fallback set:', fallback);
                }
            }
        } catch {}
        try { conversation.__titleBusy = false; } catch {}
    }
}

// Expose for streaming modules to call after assistant finishes
try { window.requestAIGeneratedTitle = requestAIGeneratedTitle; } catch {}

// Simple navigation helpers for Back/Forward buttons
function goBack() {
    try { history.back(); } catch {}
}
function goForward() {
    try { history.forward(); } catch {}
}
try { window.goBack = goBack; window.goForward = goForward; } catch {}

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
const USE_FASTAPI_STREAM = false; // legacy flag (kept)
const FASTAPI_URL = 'http://127.0.0.1:8000';

// Persisted UI toggle: Backend SSE Streaming - Default enabled
let USE_BACKEND_SSE = true;
try {
    const stored = localStorage.getItem('useBackendSSE');
    USE_BACKEND_SSE = stored !== null ? stored === 'true' : true;
} catch {}

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

// Reasoning streaming moved to dedicated module; web search tool is provided via ai/tool

// Reasoning model detection helpers and overrides
// You can force a model to be treated as reasoning or non-reasoning via localStorage keys:
//   forceReasoning:<modelName> = "true"   OR   forceNonReasoning:<modelName> = "true"
const REASONING_MODEL_HINTS = [
    'reason', 'r1', 'o4', 'think', 'qwen2.5-r', 'r-', 'deepseek-r', 'glm-r'
];
const REASONING_MODEL_EXACT = new Set([
    // Add exact names here if needed, e.g. 'deepseek-r1:8b'
]);

// Tool-capable model detection helpers and overrides
// You can force a model to be treated as tool-capable or not via localStorage keys:
//   forceTools:<modelName> = "true"   OR   forceNoTools:<modelName> = "true"
const TOOL_MODEL_HINTS = [
    // Broad hints — keep conservative to avoid false positives
    'qwen2.5', // Qwen 2.5 family generally supports tools/agents
    'qwen2',
    'qwen',
    'tool', // models explicitly named with "tool" often include tool-use
    'function-call', 'function_call'
];
const TOOL_MODEL_EXACT = new Set([
    // Add exact names here if needed for your local models, e.g. 'qwen2.5:7b'
]);

function isToolCapableModelName(name) {
    if (!name) return false;
    const n = String(name).toLowerCase();
    // Overrides
    try {
        if (localStorage.getItem(`forceTools:${name}`) === 'true') return true;
        if (localStorage.getItem(`forceNoTools:${name}`) === 'true') return false;
    } catch {}
    if (TOOL_MODEL_EXACT.has(n)) return true;
    return TOOL_MODEL_HINTS.some(h => n.includes(h));
}

function isReasoningModelName(name) {
    if (!name) return false;
    const n = String(name).toLowerCase();
    // Overrides
    try {
        if (localStorage.getItem(`forceReasoning:${name}`) === 'true') return true;
        if (localStorage.getItem(`forceNonReasoning:${name}`) === 'true') return false;
    } catch {}
    if (REASONING_MODEL_EXACT.has(n)) return true;
    return REASONING_MODEL_HINTS.some(h => n.includes(h));
}

// Detect if a selected model is likely a reasoning model (heuristic; adjustable)
function isReasoningModelActive() {
    if (!selectedOllamaModel) return false;
    return isReasoningModelName(selectedOllamaModel);
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

// formatWebResultsForPrompt is imported from ./ai/tool

function buildToolAwareInstruction() {
    // Backend (LangChain) handles tool selection/execution transparently.
    // Keep guidance minimal to avoid special client-side protocols.
    return (
        `\n\n[Tools Available]\n` +
        `- Web search and other tools are available via the backend.\n` +
        `When beneficial, incorporate up-to-date information and cite sources briefly.\n`
    );
}

// Global state
let conversations = {};
let currentConversationId = null;
let userId = generateUUID();
// Persisted selected Ollama model
let selectedOllamaModel = localStorage.getItem('selectedOllamaModel') || null;

// Rendering helpers: Plain text by default, Markdown only if code is present
let __md = null;

// History navigation management
let __suppressHistoryPush = false;
let __inRegeneration = false;
let __regenPrePushDone = false;

// Lightweight in-app history debug logger (survives without devtools)
function historyLog(event, payload = {}) {
    try {
        const entry = { t: new Date().toISOString(), event, ...payload };
        if (!window.__historyLogs) window.__historyLogs = [];
        window.__historyLogs.push(entry);
        if (window.__historyLogs.length > 200) {
            window.__historyLogs.splice(0, window.__historyLogs.length - 200);
        }
        try {
            localStorage.setItem('historyLogs', JSON.stringify(window.__historyLogs));
        } catch {}
    } catch {}
}

async function copyHistoryLogsToClipboard() {
    try {
        const logs = window.__historyLogs || [];
        const text = JSON.stringify(logs, null, 2);
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            alert('History logs copied to clipboard (Ctrl+V to paste).');
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            alert('History logs copied to clipboard (fallback).');
        }
    } catch (e) {
        alert('Failed to copy history logs: ' + (e?.message || e));
    }
}

// Create a lightweight deep snapshot of the current conversation's messages
function getCurrentConversationSnapshot() {
    try {
        if (!currentConversationId) return null;
        const convo = conversations[userId]?.[currentConversationId];
        if (!convo || !Array.isArray(convo.messages)) return null;
        // Shallow-clone objects per message and keep UI-necessary fields
        return convo.messages.map(m => {
            const base = {
                role: m.role,
                content: m.content,
            };
            // Preserve variant UI state for assistant messages
            if (m.role === 'assistant') {
                if (Array.isArray(m.__variants)) base.__variants = m.__variants.slice();
                if (typeof m.__variantIndex === 'number') base.__variantIndex = m.__variantIndex;
            }
            return base;
        });
    } catch {
        return null;
    }
}
function getMessagesScrollTop() {
    try {
        const el = document.getElementById('messagesArea');
        return el ? el.scrollTop : 0;
    } catch { return 0; }
}
function pushChatHistoryState(extra = {}) {
    if (__suppressHistoryPush) return;
    const st = { conversationId: currentConversationId, scrollTop: getMessagesScrollTop(), messagesSnapshot: getCurrentConversationSnapshot(), ...extra };
    try { history.pushState(st, '', '#'+(currentConversationId || '')); } catch {}
    try {
        const len = Array.isArray(st.messagesSnapshot) ? st.messagesSnapshot.length : 0;
        console.debug('[history] push', { convo: currentConversationId, tag: extra?.__tag, msgs: len, scrollTop: st.scrollTop });
        historyLog('history-push', { convo: currentConversationId, tag: extra?.__tag, msgs: len, scrollTop: st.scrollTop });
    } catch {}
}
function replaceChatHistoryState(extra = {}) {
    const st = { conversationId: currentConversationId, scrollTop: getMessagesScrollTop(), messagesSnapshot: getCurrentConversationSnapshot(), ...extra };
    try { history.replaceState(st, '', '#'+(currentConversationId || '')); } catch {}
    try {
        const len = Array.isArray(st.messagesSnapshot) ? st.messagesSnapshot.length : 0;
        console.debug('[history] replace', { convo: currentConversationId, tag: extra?.__tag, msgs: len, scrollTop: st.scrollTop });
        historyLog('history-replace', { convo: currentConversationId, tag: extra?.__tag, msgs: len, scrollTop: st.scrollTop });
    } catch {}
}
window.addEventListener('popstate', (e) => {
    const st = e.state || {};
    __suppressHistoryPush = true;
    try {
        const convoId = st.conversationId || null;
        if (convoId && conversations[userId] && conversations[userId][convoId]) {
            // Clear any inline insertion anchors before restoring from snapshot
            try { __assistantInsertBeforeEl = null; } catch {}
            try { __thinkingInsertBeforeEl = null; } catch {}
            // If we have a messages snapshot from history, render that exact state
            const override = Array.isArray(st.messagesSnapshot) ? st.messagesSnapshot : null;
            try {
                console.debug('[history] popstate -> restore', { convo: convoId, msgs: override ? override.length : 0, scrollTop: st.scrollTop });
                historyLog('history-popstate-restore', { convo: convoId, msgs: override ? override.length : 0, scrollTop: st.scrollTop });
            } catch {}
            // Also sync the in-memory conversation to this snapshot so any logic that
            // relies on conversation.messages (e.g., variant toolbars, subsequent updates)
            // sees the full restored tail. Clone to avoid sharing references with render.
            if (override) {
                try {
                    const convo = conversations[userId][convoId];
                    convo.messages = override.map(m => ({ ...m }));
                } catch {}
            }
            loadConversation(convoId, { fromPop: true, messagesOverride: override });
            // Defensive: if messages did not render (race or suppression), force-render from snapshot
            try {
                const area = document.getElementById('messagesArea');
                const rendered = area ? area.querySelectorAll('.message').length : 0;
                if (rendered === 0 && Array.isArray(override) && override.length > 0) {
                    console.debug('[history] popstate -> force-render snapshot because DOM is empty');
                    historyLog('history-popstate-force-render', { convo: convoId, msgs: override.length });
                    override.forEach(msg => displayMessage(msg, { fromPop: true }));
                }
            } catch {}
        } else {
            currentConversationId = null;
            clearMessages();
            const inputArea = document.querySelector('.input-area');
            const messagesArea = document.getElementById('messagesArea');
            const chatContainer = document.querySelector('.chat-container');
            if (inputArea && messagesArea && chatContainer) {
                inputArea.classList.add('centered');
                messagesArea.classList.add('with-centered-input');
                chatContainer.classList.add('input-centered');
            }
            updateConversationList();
        }
        // Restore scroll
        if (typeof st.scrollTop === 'number') {
            const el = document.getElementById('messagesArea');
            if (el) el.scrollTop = st.scrollTop;
        }
    } finally {
        __suppressHistoryPush = false;
    }
});
// Suppress auto-scroll when regenerating earlier messages
let __suppressAutoScroll = false;
const shouldAutoScroll = () => !__suppressAutoScroll;
// Optional anchors to insert placeholder and next assistant message at a specific spot
let __thinkingInsertBeforeEl = null; // DOM node to insert thinking before
let __assistantInsertBeforeEl = null; // DOM node to insert next assistant message before
const ensureMarkdown = () => {
    if (!__md && window.markdownit) {
        __md = window.markdownit({ html: false, linkify: true, breaks: true });
    }
    return __md;
};

const escapeHtml = (s) => (s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const hasCode = (s) => {
    if (!s) return false;
    // fenced blocks, tildes, or inline backticks, or 4-spaces-indented lines
    return /```|~~~|`[^`]+`|(^|\n) {4,}\S/.test(s);
};

// Normalize plain text spacing: remove stray spaces before punctuation and contractions
function normalizePlainText(s) {
    if (!s) return s;
    let t = s;
    // Collapse multiple spaces
    t = t.replace(/[\t\f\v]+/g, ' ');
    // Remove spaces before common punctuation: , . ! ? ; : ) ] } %
    t = t.replace(/\s+([,\.\!\?;:\)\]\}%])/g, '$1');
    // Remove spaces after opening punctuation: ( [ { 
    t = t.replace(/([\(\[\{])\s+/g, '$1');
    // Fix common English contractions split by spaces: I 'm -> I'm, don 't -> don't
    t = t.replace(/\b(\w)\s+'\s*(\w)\b/g, "$1'$2");
    return t;
}

const renderMessageHTML = (text) => {
    try {
        if (!hasCode(text)) {
            // Plain text: normalize spacing, escape and keep line breaks
            const normalized = normalizePlainText(text || '');
            return `<p>${escapeHtml(normalized).replace(/\n/g, '<br>')}</p>`;
        }
        const md = ensureMarkdown();
        if (md) return md.render(text || '');
        return `<pre>${escapeHtml(text || '')}</pre>`;
    } catch {
        const normalized = normalizePlainText(text || '');
        return `<p>${escapeHtml(normalized).replace(/\n/g, '<br>')}</p>`;
    }
};

// Create a small toolbar with variant navigation, a copy button, and a regenerate button for assistant messages
function createAssistantCopyToolbar(textToCopy, messageRef) {
    try {
        const toolbar = document.createElement('div');
        toolbar.className = 'assistant-toolbar';

        // Helper: render the given text into the sibling content container (above the toolbar)
        const renderVariantIntoDOM = (rootToolbarEl, text) => {
            try {
                const contentDiv = rootToolbarEl.closest('.message-content');
                if (!contentDiv) return;
                // First child is either the typewriter container (assistant typed) or the content wrapper
                const firstChild = contentDiv.firstElementChild;
                if (!firstChild) return;
                const html = renderMessageHTML(text || '');
                // If typewriter container exists, update its innerHTML, else update contentDiv directly
                if (firstChild.classList.contains('typewriter-container')) {
                    firstChild.innerHTML = html;
                } else {
                    // Replace entire content (but keep toolbar intact)
                    // Remove all nodes before toolbar
                    const children = Array.from(contentDiv.childNodes);
                    for (const node of children) {
                        if (node === rootToolbarEl) break;
                        contentDiv.removeChild(node);
                    }
                    // Insert new container before toolbar
                    const newContainer = document.createElement('div');
                    newContainer.className = 'typewriter-container';
                    newContainer.innerHTML = html;
                    contentDiv.insertBefore(newContainer, rootToolbarEl);
                }
            } catch {}
        };

        // If this assistant message has variants, add prev/next controls like ChatGPT
        const variants = (messageRef && Array.isArray(messageRef.__variants)) ? messageRef.__variants : null;
        if (variants && variants.length > 1) {
            if (typeof messageRef.__variantIndex !== 'number') {
                messageRef.__variantIndex = variants.length - 1; // default to latest
            }

            const nav = document.createElement('div');
            nav.className = 'variant-nav';

            const prevBtn = document.createElement('button');
            prevBtn.type = 'button';
            prevBtn.className = 'variant-prev custom-tooltip';
            prevBtn.setAttribute('aria-label', 'Zurück');
            prevBtn.setAttribute('data-tooltip', 'Zurück');
            prevBtn.setAttribute('tabindex', '-1');
            prevBtn.innerHTML = '<img src="assets/chevron_backward.svg" alt="Zurück" width="16" height="16">';

            const counter = document.createElement('span');
            counter.className = 'variant-counter';
            counter.textContent = `${messageRef.__variantIndex + 1}/${variants.length}`;

            const nextBtn = document.createElement('button');
            nextBtn.type = 'button';
            nextBtn.className = 'variant-next custom-tooltip';
            nextBtn.setAttribute('aria-label', 'Weiter');
            nextBtn.setAttribute('data-tooltip', 'Weiter');
            nextBtn.setAttribute('tabindex', '-1');
            nextBtn.innerHTML = '<img src="assets/chevron_forward.svg" alt="Weiter" width="16" height="16">';

            const applyIndex = (idx) => {
                if (!variants) return;
                // Cyclic navigation: wrap around both directions
                const len = variants.length;
                const wrapped = ((idx % len) + len) % len;
                messageRef.__variantIndex = wrapped;
                counter.textContent = `${wrapped + 1}/${len}`;
                // Re-render the selected variant into the DOM without mutating conversation state
                renderVariantIntoDOM(toolbar, variants[wrapped]);
            };

            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                try { prevBtn.blur(); } catch {}
                applyIndex((typeof messageRef.__variantIndex === 'number' ? messageRef.__variantIndex : (variants.length - 1)) - 1);
            });

            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                try { nextBtn.blur(); } catch {}
                applyIndex((typeof messageRef.__variantIndex === 'number' ? messageRef.__variantIndex : (variants.length - 1)) + 1);
            });

            nav.appendChild(prevBtn);
            nav.appendChild(counter);
            nav.appendChild(nextBtn);
            toolbar.appendChild(nav);
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'copy-btn custom-tooltip';
        btn.setAttribute('aria-label', 'Copy message');
        btn.setAttribute('data-tooltip', 'Copy');
        // Remove from tab order to prevent focus outline (requested style)
        btn.setAttribute('tabindex', '-1');
        // Prevent focus outline on mouse/touch interactions
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
        btn.addEventListener('touchstart', (e) => {
            // Avoid stealing focus on touch devices
            // passive to keep scrolling smooth
        }, { passive: true });

        // Use SVG-based masked icon for modern, themeable color with currentColor
        const icon = document.createElement('span');
        icon.className = 'icon icon-copy';
        btn.appendChild(icon);

        const doCopy = async () => {
            // If variants exist, copy the currently visible variant; otherwise copy the provided text
            const current = (messageRef && Array.isArray(messageRef.__variants))
                ? messageRef.__variants[
                    (typeof messageRef.__variantIndex === 'number') ? messageRef.__variantIndex : (messageRef.__variants.length - 1)
                  ]
                : textToCopy;
            const plain = String(current || '');
            let ok = false;
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(plain);
                    ok = true;
                }
            } catch {}
            if (!ok) {
                try {
                    // Fallback textarea method
                    const ta = document.createElement('textarea');
                    ta.value = plain;
                    ta.style.position = 'fixed';
                    ta.style.left = '-9999px';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    ok = document.execCommand('copy');
                    document.body.removeChild(ta);
                } catch {}
            }
            // Feedback via tooltip text only
            const oldTip = btn.getAttribute('data-tooltip');
            btn.setAttribute('data-tooltip', ok ? 'Copied!' : 'Copy failed');
            setTimeout(() => {
                btn.setAttribute('data-tooltip', oldTip || 'Copy');
            }, 1200);
        };

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            doCopy();
            // Remove focus immediately after click
            try { btn.blur(); } catch {}
        });

        toolbar.appendChild(btn);

        // Regenerate button
        const regenBtn = document.createElement('button');
        regenBtn.type = 'button';
        regenBtn.className = 'regen-btn custom-tooltip';
        regenBtn.setAttribute('aria-label', 'Regenerate answer');
        regenBtn.setAttribute('data-tooltip', 'Regenerate');
        regenBtn.setAttribute('tabindex', '-1');
        regenBtn.addEventListener('mousedown', (e) => { e.preventDefault(); });
        regenBtn.addEventListener('touchstart', (e) => {}, { passive: true });

        const regenIcon = document.createElement('span');
        regenIcon.className = 'icon icon-regen';
        regenBtn.appendChild(regenIcon);

        regenBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try { regenBtn.blur(); } catch {}
            try {
                // Pre-push a snapshot right at user click to guarantee full pre-regen state
                try {
                    const snap = getCurrentConversationSnapshot();
                    __regenPrePushDone = true;
                    pushChatHistoryState({ messagesSnapshot: snap, __tag: 'preclick-regenerate' });
                    historyLog('preclick-regenerate-push', { convo: currentConversationId, msgs: Array.isArray(snap) ? snap.length : 0 });
                } catch {}
                await regenerateAssistantMessage(messageRef, regenBtn);
            } catch (err) {
                // Tooltip feedback on error
                const old = regenBtn.getAttribute('data-tooltip');
                regenBtn.setAttribute('data-tooltip', 'Failed');
                setTimeout(() => regenBtn.setAttribute('data-tooltip', old || 'Regenerate'), 1200);
            }
        });

        toolbar.appendChild(regenBtn);
        return toolbar;
    } catch {
        return null;
    }
}

// Regenerate the assistant's response for the given assistant message by
// reusing the preceding user message content. Does not add a duplicate user message.
async function regenerateAssistantMessage(messageRef, triggerEl) {
    const messagesArea = document.getElementById('messagesArea');
    const prevScrollTop = messagesArea ? messagesArea.scrollTop : null;
    __suppressAutoScroll = true;
    __inRegeneration = true;
    try {
        const conversation = conversations[userId]?.[currentConversationId];
        if (!conversation || !Array.isArray(conversation.messages)) {
            return;
        }
        // Capture the current state so Back restores the full pre-regeneration tail
        if (!__regenPrePushDone) {
            try {
                const preSnapshot = getCurrentConversationSnapshot();
                pushChatHistoryState({ messagesSnapshot: preSnapshot, __tag: 'precut-regenerate' });
                historyLog('precut-regenerate-push', { convo: currentConversationId, msgs: Array.isArray(preSnapshot) ? preSnapshot.length : 0 });
            } catch {}
        }
        const idx = conversation.messages.indexOf(messageRef);
        if (idx === -1) return;

        // Walk backwards to find the preceding user message
        let messageContent = null;
        for (let i = idx - 1; i >= 0; i--) {
            const m = conversation.messages[i];
            if (m && m.role === 'user') {
                messageContent = m.content;
                break;
            }
        }
        if (!messageContent) {
            // Optional tooltip feedback if no user message found
            if (triggerEl) {
                const old = triggerEl.getAttribute('data-tooltip');
                triggerEl.setAttribute('data-tooltip', 'No previous user message');
                setTimeout(() => triggerEl.setAttribute('data-tooltip', old || 'Regenerate'), 1200);
            }
            return;
        }

        // Determine the old assistant DOM container
        const oldContainer = triggerEl?.closest?.('.message.assistant');

        // Capture previous assistant content and any existing variants for regeneration UI
        const previousAssistantContent = messageRef?.content || '';
        try {
            const prevList = Array.isArray(messageRef.__variants) && messageRef.__variants.length
                ? messageRef.__variants.slice()
                : [previousAssistantContent];
            // Deduplicate and keep compact strings only
            window.__regenCarryVariants = Array.from(new Set(prevList.filter(v => typeof v === 'string' && v.trim())));
        } catch { window.__regenCarryVariants = [previousAssistantContent]; }

        // 1) Drop all messages at and below the selected assistant from the conversation state
        conversation.messages = conversation.messages.slice(0, idx);
        conversation.updated_at = new Date();
        updateConversationList();

        // 2) Remove the assistant DOM node and everything below it from the UI
        if (oldContainer) {
            let cursor = oldContainer;
            while (cursor) {
                const next = cursor.nextSibling;
                try { cursor.remove(); } catch {}
                cursor = next;
            }
        }

        // 3) Ensure new generation appends to the end (no inline anchors)
        __thinkingInsertBeforeEl = null;
        __assistantInsertBeforeEl = null;

        // Build a full context override up to this point (pre-cut conversation).
        // After the slice above, conversation.messages now contains all messages BEFORE the regenerated assistant.
        // Provide the complete prior history so the backend can faithfully regenerate the tail.
        const contextOverrideMessages = (conversation.messages || []).map(m => ({
            role: m.role,
            content: m.content
        }));

        // Build a regeneration hint to promote diversity and avoid repeating the previous answer
        const prevTrim = (previousAssistantContent || '').slice(0, 800);
        const regenerationHint = `\n[Regeneration]\nProduce a different alternative to your previous answer.\n- Do not repeat the same sentences or phrasing.\n- Vary tone, details, and structure.\n- If the question is the same, give a fresh angle, additional specifics, or examples.\nHere is the previous answer for contrast (truncated):\n"""${prevTrim}"""\n`;

        // Run the same generation flow used after sending a user message, without pushing a new user message
        // Pass the real conversation for mutation, but override prompt context for this call.
        // Mark pending post-regenerate history push BEFORE generation so the renderer can finalize it
        try { window.__pendingPostRegeneratePush = true; } catch {}
        await generateAssistantFromContent(messageContent, conversation, {
            additionalInstruction: regenerationHint,
            contextOverrideMessages
        });
    } catch (err) {
        console.warn('Regenerate failed:', err?.message || err);
        throw err;
    } finally {
        try {
            if (messagesArea != null && prevScrollTop != null) {
                messagesArea.scrollTop = prevScrollTop;
            }
        } catch {}
        __suppressAutoScroll = false;
        __thinkingInsertBeforeEl = null;
        // Do not clear __assistantInsertBeforeEl here; it should be cleared by the rendering
        // function (e.g., displayMessageWithTypewriter) once the async animation completes.
        __inRegeneration = false;
        __regenPrePushDone = false;
        // Flag already set before generation; nothing to do here
    }
}

// Generate assistant response using the given user message content and conversation context
async function generateAssistantFromContent(messageContent, conversation, options = {}) {
    // Generate AI response using Tauri backend (extracted from sendMessage flow)
    try {
        const toolAware = (activeTools && activeTools.has && activeTools.has('websearch')) ? buildToolAwareInstruction() : '';
        const reasoningAware = (ENABLE_INTERNAL_REASONING_PROMPT && isReasoningModelActive()) ? buildReasoningInstruction() : '';
        const additionalInstruction = (options && options.additionalInstruction) ? String(options.additionalInstruction) : '';
        const contextOverrideMessages = (options && options.contextOverrideMessages) ? options.contextOverrideMessages : null;
        const promptConversation = contextOverrideMessages ? { ...conversation, messages: contextOverrideMessages } : conversation;
        let finalPrompt = buildPromptWithContext(promptConversation, messageContent, {
            maxChars: 8000,
            systemPreamble: undefined,
            toolAware,
            reasoningAware: reasoningAware + additionalInstruction
        });
        try {
            const wantWeb = activeTools && activeTools.has && activeTools.has('websearch');
            if (wantWeb && !isReasoningModelActive()) {
                ensureThinkingMessage('Searching Web…');
                const tz = (Intl && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
                const locale = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';
                const now = new Date();
                const nowLocal = now.toLocaleString(locale, { timeZone: tz, hour12: false });
                const isoLocal = new Intl.DateTimeFormat(locale, {
                    timeZone: tz,
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                }).format(now);
                const weekday = new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: 'long' }).format(now);
                const year = now.getFullYear();
                const utcIso = now.toISOString();
                let coords = null;
                try {
                    if (typeof navigator !== 'undefined' && navigator.geolocation) {
                        const geo = new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(
                                (pos) => resolve({
                                    lat: Number(pos.coords.latitude.toFixed(3)),
                                    lon: Number(pos.coords.longitude.toFixed(3))
                                }),
                                () => resolve(null),
                                { enableHighAccuracy: false, timeout: 1200, maximumAge: 300000 }
                            );
                        });
                        coords = await Promise.race([
                            geo,
                            new Promise((r) => setTimeout(() => r(null), 1500))
                        ]);
                    }
                } catch {}
                let __showedDomainList = false;
                let __domainLabel = null;
                const up = await isFastAPIUp();
                if (up) {
                    const locHint = coords ? `, approx_location: ${coords.lat},${coords.lon}` : '';
                    const timeSensitive = /\b(today|heute|now|jetzt|time|uhrzeit|date|datum|weekday|wochentag)\b/i.test(messageContent);
                    const enrichedQuery = `${messageContent} (consider locale ${locale}, timezone ${tz}, weekday ${weekday}, local time ${isoLocal}, year ${year}${coords ? `, near lat ${coords.lat} lon ${coords.lon}` : ''}); language: English only; prioritize English sources`;
                    const results = await performWebSearchFastAPI(FASTAPI_URL, enrichedQuery, 5, timeSensitive ? 'day' : 'noLimit', true);
                    try {
                        const domains = (results || []).map(r => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return null; } }).filter(Boolean);
                        const top = Array.from(new Set(domains)).slice(0, 3);
                        if (top.length) {
                            __domainLabel = `Searching Web… (${top.join(', ')})`;
                            setThinkingText(__domainLabel);
                            try { setThinkingLinks((results || []).slice(0, 4)); } catch {}
                            __showedDomainList = true;
                        } else {
                            const count = Array.isArray(results) ? results.length : 0;
                            if (count > 0) {
                                __domainLabel = `Searching Web… (${count} sources)`;
                                setThinkingText(__domainLabel);
                                try { setThinkingLinks((results || []).slice(0, 4)); } catch {}
                                __showedDomainList = true;
                            } else {
                                __domainLabel = 'Searching Web… (no results)';
                                setThinkingText(__domainLabel);
                                try { setThinkingLinks([]); } catch {}
                                __showedDomainList = true;
                            }
                        }
                    } catch {}
                    const block = formatWebResultsForPrompt(results);
                    if (block && block.trim()) {
                        const userCtx = `\n\n[User Context]\n- locale: ${locale}\n- timezone: ${tz}\n- weekday: ${weekday}\n- year: ${year}\n- local_now: ${nowLocal}\n- local_iso: ${isoLocal}\n- utc_iso: ${utcIso}\n${coords ? `- approx_location: ${coords.lat}, ${coords.lon}\n` : ''}`;
                        finalPrompt = `${finalPrompt}${userCtx}${block}`;
                    }
                } else {
                    try { setThinkingLinks([]); } catch {}
                }
                if (__showedDomainList) {
                    setTimeout(() => { try { setThinkingText('Thinking…'); setThinkingLinks([]); } catch {} }, 1500);
                } else {
                    setThinkingText('Thinking…');
                    try { setThinkingLinks([]); } catch {}
                }
            }
        } catch {
            setThinkingText('Thinking…');
            try { setThinkingLinks([]); } catch {}
        }
        try {
            const head = finalPrompt.slice(0, 800);
            const tail = finalPrompt.length > 300 ? finalPrompt.slice(-300) : '';
            console.debug('[prompt head]\n' + head);
            if (tail) console.debug('[prompt tail]\n' + tail);
        } catch {}

        showThinkingAnimation();
        try {
            if (typeof __domainLabel !== 'undefined' && __domainLabel) {
                setThinkingText(__domainLabel);
                setTimeout(() => setThinkingText('Thinking…'), 1500);
            }
        } catch {}

        if (!isReasoningModelActive()) {
            if (USE_BACKEND_SSE) {
                let usedSSE = false;
                try {
                    const upNow = await isFastAPIUp();
                    if (upNow) {
                        await streamSseResponse({
                            serverBase: FASTAPI_URL,
                            model: selectedOllamaModel || 'llama3.1',
                            message: messageContent,
                            history: (conversation?.messages || []).slice(-10),
                            system: '',
                            ui: {
                                hideThinking: hideThinkingAnimation,
                                displayTypewriter: displayMessageWithTypewriter,
                                displayNow: displayMessage,
                                updateConversationList,
                                onErrorReturnToCaller: true,
                            },
                            conversation
                        });
                        usedSSE = true;
                    }
                } catch (e) {
                    console.warn('[sse] falling back to direct streaming:', e?.message || e);
                }
                if (!usedSSE) {
                    await streamSimpleResponse({
                        finalPrompt,
                        conversation,
                        selectedModel: selectedOllamaModel || undefined,
                        ui: {
                            hideThinking: hideThinkingAnimation,
                            displayTypewriter: displayMessageWithTypewriter,
                            displayNow: displayMessage,
                            updateConversationList
                        }
                    });
                }
            } else {
                await streamSimpleResponse({
                    finalPrompt,
                    conversation,
                    selectedModel: selectedOllamaModel || undefined,
                    ui: {
                        hideThinking: hideThinkingAnimation,
                        displayTypewriter: displayMessageWithTypewriter,
                        displayNow: displayMessage,
                        updateConversationList
                    }
                });
            }
        } else {
            await streamReasoningResponse({
                finalPrompt,
                originalUserMessage: messageContent,
                conversation,
                selectedModel: selectedOllamaModel || undefined,
                ui: {
                    hideThinking: hideThinkingAnimation,
                    displayNow: displayMessage,
                    displayTypewriter: displayMessageWithTypewriter,
                    updateConversationList
                },
                tools: {
                    activeTools,
                    performWebSearch: async (query, max = 5) => {
                        try { ensureThinkingMessage('Searching Web…'); } catch {}
                        const results = await performWebSearchFastAPI(FASTAPI_URL, query, max);
                        try {
                            const domains = (results || []).map(r => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return null; } }).filter(Boolean);
                            const top = Array.from(new Set(domains)).slice(0, 3);
                            if (top.length) {
                                const label = `Searching Web… (${top.join(', ')})`;
                                setThinkingText(label);
                                try { setThinkingLinks((results || []).slice(0, 4)); } catch {}
                                setTimeout(() => { try { setThinkingText('Thinking…'); setThinkingLinks([]); } catch {} }, 1500);
                            } else {
                                const count = Array.isArray(results) ? results.length : 0;
                                if (count > 0) {
                                    const label = `Searching Web… (${count} sources)`;
                                    setThinkingText(label);
                                    try { setThinkingLinks((results || []).slice(0, 4)); } catch {}
                                } else {
                                    const label = 'Searching Web… (no results)';
                                    setThinkingText(label);
                                    try { setThinkingLinks([]); } catch {}
                                }
                                setTimeout(() => { try { setThinkingText('Thinking…'); setThinkingLinks([]); } catch {} }, 1500);
                            }
                        } catch {}
                        return results;
                    },
                    formatWebResultsForPrompt,
                    buildReasoningInstruction
                }
            });
        }
    } catch (error) {
        console.error('Error generating AI response:', error);
        hideThinkingAnimation();
        const errorMessage = {
            role: 'assistant',
            content: 'Entschuldigung, es gab einen Fehler bei der Verarbeitung Ihrer Nachricht.',
            timestamp: new Date()
        };
        await displayMessageWithTypewriter(errorMessage);
    }
}

// Markdown renderer (kept for compatibility in other parts of the app)
const renderMarkdown = (text) => {
    try {
        const md = ensureMarkdown();
        const rawHtml = md ? md.render(text || '') : (text || '');
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
        // Ensure pasting from web/apps inserts plain text, preserves line breaks, and keeps caret
        this.messageInput.addEventListener('paste', (e) => this.handlePaste(e));
        
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

    handlePaste(e) {
        try {
            const dt = e.clipboardData || window.clipboardData;
            if (!dt) return; // default behavior
            const text = dt.getData('text/plain');
            if (!text) return;
            e.preventDefault();
            const el = this.messageInput;
            const start = el.selectionStart ?? el.value.length;
            const end = el.selectionEnd ?? el.value.length;
            // Normalize line endings and limit extremely large pastes
            const MAX_PASTE = 100000; // 100k chars hard cap to protect UI
            let insert = text.replace(/\r\n/g, '\n');
            if (insert.length > MAX_PASTE) insert = insert.slice(0, MAX_PASTE);
            el.value = el.value.slice(0, start) + insert + el.value.slice(end);
            const caret = start + insert.length;
            // Restore caret
            try { el.setSelectionRange(caret, caret); } catch {}
            // Update UI
            this.autoResize();
            this.updateSendButton();
        } catch {}
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
                if (shouldAutoScroll()) {
                    this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
                }
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
    // Commit-on-send: if the most recent assistant message has regeneration variants,
    // commit the currently selected variant to content and prune the others.
    try {
        if (conversation && Array.isArray(conversation.messages) && conversation.messages.length) {
            for (let i = conversation.messages.length - 1; i >= 0; i--) {
                const m = conversation.messages[i];
                if (m && m.role === 'assistant' && Array.isArray(m.__variants) && m.__variants.length) {
                    const len = m.__variants.length;
                    const idx = (typeof m.__variantIndex === 'number')
                        ? ((m.__variantIndex % len) + len) % len
                        : (len - 1);
                    const committed = String(m.__variants[idx] ?? m.content ?? '');
                    m.content = committed;
                    try { delete m.__variants; } catch {}
                    try { delete m.__variantIndex; } catch {}
                    // Update the DOM for the last assistant message so the variant UI disappears immediately
                    try {
                        const area = document.getElementById('messagesArea');
                        if (area) {
                            const assistants = area.querySelectorAll('.message.assistant');
                            const last = assistants && assistants.length ? assistants[assistants.length - 1] : null;
                            if (last) {
                                const contentDiv = last.querySelector('.message-content');
                                if (contentDiv) {
                                    // Remove existing toolbar and rebuild it without variants
                                    const oldTb = contentDiv.querySelector('.assistant-toolbar');
                                    if (oldTb) oldTb.remove();
                                    const newTb = createAssistantCopyToolbar(m.content || '', m);
                                    if (newTb) contentDiv.appendChild(newTb);
                                }
                            }
                        }
                    } catch {}
                    // Also replace the current history state so Back won't show the old variant branch
                    try {
                        const snap = getCurrentConversationSnapshot();
                        replaceChatHistoryState({ messagesSnapshot: snap, __tag: 'commit-variant' });
                        historyLog('commit-variant-replace', { convo: currentConversationId, msgs: Array.isArray(snap) ? snap.length : 0 });
                    } catch {}
                    break; // Only commit the nearest tail assistant with variants
                }
            }
        }
    } catch {}
    
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

    // Deterministic history recall: short-circuit for questions about prior messages
    try {
        const historyAnswer = answerFromHistoryIfApplicable(conversation, messageContent);
        if (historyAnswer) {
            const aiMessage = { role: 'assistant', content: historyAnswer, timestamp: new Date() };
            conversation.messages.push(aiMessage);
            conversation.updated_at = new Date();
            updateConversationList();
            await displayMessageWithTypewriter(aiMessage);
            return; // Do not call the model
        }
    } catch {}

    // Display user message
    displayMessage(userMessage);
    if (conversation.messages.length === 1) {
        conversation.title = messageContent.substring(0, 50) + (messageContent.length > 50 ? '...' : '');
        // Reflect new title right away
        updateConversationList();
    }
    
    // Generate AI response using Tauri backend
    try {
        // If tools are enabled in UI, provide only a minimal hint; backend (LangChain) performs actual tool use
        const toolAware = (activeTools && activeTools.has && activeTools.has('websearch')) ? buildToolAwareInstruction() : '';
        const reasoningAware = (ENABLE_INTERNAL_REASONING_PROMPT && isReasoningModelActive()) ? buildReasoningInstruction() : '';
        // Build context-aware prompt including prior relevant turns
        let finalPrompt = buildPromptWithContext(conversation, messageContent, {
            maxChars: 8000,
            systemPreamble: undefined, // use default preamble in context manager
            toolAware,
            reasoningAware
        });
        // If websearch tool is active and we're on non-reasoning flow, proactively enrich the prompt
        // so non-reasoning models (e.g., qwen2.5:7b) can leverage web data without special triggers
        try {
            const wantWeb = activeTools && activeTools.has && activeTools.has('websearch');
            if (wantWeb && !isReasoningModelActive()) {
                // Indicate search phase to the user
                ensureThinkingMessage('Searching Web…');
                // Gather lightweight local context (no permissions required)
                const tz = (Intl && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
                const locale = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';
                const now = new Date();
                const nowLocal = now.toLocaleString(locale, { timeZone: tz, hour12: false });
                const isoLocal = new Intl.DateTimeFormat(locale, {
                    timeZone: tz,
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                }).format(now);
                const weekday = new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: 'long' }).format(now);
                const year = now.getFullYear();
                const utcIso = now.toISOString();
                // Try to get approximate device location (user permission required). Short timeout and fail-safe.
                let coords = null;
                try {
                    if (typeof navigator !== 'undefined' && navigator.geolocation) {
                        const geo = new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(
                                (pos) => resolve({
                                    lat: Number(pos.coords.latitude.toFixed(3)),
                                    lon: Number(pos.coords.longitude.toFixed(3))
                                }),
                                () => resolve(null),
                                { enableHighAccuracy: false, timeout: 1200, maximumAge: 300000 }
                            );
                        });
                        // 1.5s cap so we don't block UX
                        coords = await Promise.race([
                            geo,
                            new Promise((r) => setTimeout(() => r(null), 1500))
                        ]);
                    }
                } catch {}
                // Prepare labels visible across the block
                let __showedDomainList = false;
                let __domainLabel = null;
                const up = await isFastAPIUp();
                if (up) {
                    // Nudge search toward local relevance for date/time queries
                    const locHint = coords ? `, approx_location: ${coords.lat},${coords.lon}` : '';
                    const timeSensitive = /\b(today|heute|now|jetzt|time|uhrzeit|date|datum|weekday|wochentag)\b/i.test(messageContent);
                    const enrichedQuery = `${messageContent} (consider locale ${locale}, timezone ${tz}, weekday ${weekday}, local time ${isoLocal}, year ${year}${coords ? `, near lat ${coords.lat} lon ${coords.lon}` : ''}); language: English only; prioritize English sources`;
                    const results = await performWebSearchFastAPI(FASTAPI_URL, enrichedQuery, 5, timeSensitive ? 'day' : 'noLimit', true);
                    // Update thinking text to reflect domains that were searched
                    try {
                        const domains = (results || []).map(r => {
                            try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return null; }
                        }).filter(Boolean);
                        const top = Array.from(new Set(domains)).slice(0, 3);
                        if (top.length) {
                            __domainLabel = `Searching Web… (${top.join(', ')})`;
                            setThinkingText(__domainLabel);
                            // Also show clickable top links
                            try { setThinkingLinks((results || []).slice(0, 4)); } catch {}
                            __showedDomainList = true;
                        } else {
                            // Fallbacks when no URLs are present
                            const count = Array.isArray(results) ? results.length : 0;
                            if (count > 0) {
                                __domainLabel = `Searching Web… (${count} sources)`;
                                setThinkingText(__domainLabel);
                                try { setThinkingLinks((results || []).slice(0, 4)); } catch {}
                                __showedDomainList = true;
                            } else {
                                __domainLabel = 'Searching Web… (no results)';
                                setThinkingText(__domainLabel);
                                try { setThinkingLinks([]); } catch {}
                                __showedDomainList = true;
                            }
                        }
                    } catch {}
                    const block = formatWebResultsForPrompt(results);
                    if (block && block.trim()) {
                        const userCtx = `\n\n[User Context]\n- locale: ${locale}\n- timezone: ${tz}\n- weekday: ${weekday}\n- year: ${year}\n- local_now: ${nowLocal}\n- local_iso: ${isoLocal}\n- utc_iso: ${utcIso}\n${coords ? `- approx_location: ${coords.lat}, ${coords.lon}\n` : ''}`;
                        finalPrompt = `${finalPrompt}${userCtx}${block}`;
                        console.debug('[websearch] injected', results?.length || 0, 'results into prompt');
                    }
                } else {
                    console.warn('[websearch] FastAPI not available; skipping web enrichment');
                    try { setThinkingLinks([]); } catch {}
                }
                // Switch back to normal thinking once search phase is done
                if (__showedDomainList) {
                    setTimeout(() => { try { setThinkingText('Thinking…'); setThinkingLinks([]); } catch {} }, 1500);
                } else {
                    setThinkingText('Thinking…');
                    try { setThinkingLinks([]); } catch {}
                }
            }
        } catch (e) {
            console.warn('[websearch] enrichment failed:', e?.message || e);
            // Ensure UI falls back to normal thinking label
            setThinkingText('Thinking…');
            try { setThinkingLinks([]); } catch {}
        }
        // Debug preview to verify context inclusion (trimmed to avoid flooding console)
        try {
            const head = finalPrompt.slice(0, 800);
            const tail = finalPrompt.length > 300 ? finalPrompt.slice(-300) : '';
            console.debug('[prompt head]\n' + head);
            if (tail) console.debug('[prompt tail]\n' + tail);
        } catch {}

        // Show thinking animation (reasoning UI only if a reasoning model is active)
        showThinkingAnimation();
        try {
            // If proactive websearch computed a domain label, re-apply in case animation re-rendered the node
            if (typeof __domainLabel !== 'undefined' && __domainLabel) {
                setThinkingText(__domainLabel);
                setTimeout(() => setThinkingText('Thinking…'), 1500);
            }
        } catch {}
        // Route by model type to avoid collisions between reasoning and non-reasoning logic
        if (!isReasoningModelActive()) {
            if (USE_BACKEND_SSE) {
                let usedSSE = false;
                try {
                    const upNow = await isFastAPIUp();
                    if (upNow) {
                        // Route via FastAPI SSE endpoint `/lcel/chat/sse`
                        await streamSseResponse({
                            serverBase: FASTAPI_URL,
                            model: selectedOllamaModel || 'llama3.1',
                            message: messageContent,
                            history: (conversation?.messages || []).slice(-10),
                            system: '',
                            ui: {
                                hideThinking: hideThinkingAnimation,
                                displayTypewriter: displayMessageWithTypewriter,
                                displayNow: displayMessage,
                                updateConversationList,
                                onErrorReturnToCaller: true,
                            },
                            conversation
                        });
                        usedSSE = true;
                    }
                } catch (e) {
                    console.warn('[sse] falling back to direct streaming:', e?.message || e);
                }
                if (!usedSSE) {
                    await streamSimpleResponse({
                        finalPrompt,
                        conversation,
                        selectedModel: selectedOllamaModel || undefined,
                        ui: {
                            hideThinking: hideThinkingAnimation,
                            displayTypewriter: displayMessageWithTypewriter,
                            displayNow: displayMessage,
                            updateConversationList
                        }
                    });
                }
            } else {
                await streamSimpleResponse({
                    finalPrompt,
                    conversation,
                    selectedModel: selectedOllamaModel || undefined,
                    ui: {
                        hideThinking: hideThinkingAnimation,
                        displayTypewriter: displayMessageWithTypewriter,
                        displayNow: displayMessage,
                        updateConversationList
                    }
                });
            }
        } else {
            // Route reasoning models to dedicated module
            await streamReasoningResponse({
                finalPrompt,
                originalUserMessage: messageContent,
                conversation,
                selectedModel: selectedOllamaModel || undefined,
                ui: {
                    hideThinking: hideThinkingAnimation,
                    displayNow: displayMessage,
                    displayTypewriter: displayMessageWithTypewriter,
                    updateConversationList
                },
                // Provide websearch hooks so WEBSEARCH: triggers can fetch results via FastAPI
                tools: {
                    activeTools,
                    performWebSearch: async (query, max = 5) => {
                        try { ensureThinkingMessage('Searching Web…'); } catch {}
                        const results = await performWebSearchFastAPI(FASTAPI_URL, query, max);
                        // While reasoning tool searched, surface domains to the user
                        try {
                            const domains = (results || []).map(r => {
                                try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return null; }
                            }).filter(Boolean);
                            const top = Array.from(new Set(domains)).slice(0, 3);
                            if (top.length) {
                                const label = `Searching Web… (${top.join(', ')})`;
                                setThinkingText(label);
                                try { setThinkingLinks((results || []).slice(0, 4)); } catch {}
                                console.debug('[websearch] domains shown:', label);
                                setTimeout(() => { try { setThinkingText('Thinking…'); setThinkingLinks([]); } catch {} }, 1500);
                            } else {
                                const count = Array.isArray(results) ? results.length : 0;
                                if (count > 0) {
                                    const label = `Searching Web… (${count} sources)`;
                                    setThinkingText(label);
                                    try { setThinkingLinks((results || []).slice(0, 4)); } catch {}
                                    console.debug('[websearch] count shown:', label);
                                } else {
                                    const label = 'Searching Web… (no results)';
                                    setThinkingText(label);
                                    try { setThinkingLinks([]); } catch {}
                                    console.debug('[websearch] empty shown');
                                }
                                setTimeout(() => { try { setThinkingText('Thinking…'); setThinkingLinks([]); } catch {} }, 1500);
                            }
                        } catch {}
                        return results;
                    },
                    formatWebResultsForPrompt,
                    buildReasoningInstruction
                }
            });
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
    try {
        // Delegate to ensureThinkingMessage so positioning respects the anchor
        ensureThinkingMessage('Thinking…');
        // Ensure reasoning block dropdown is open by default if present
        const existing = document.getElementById('thinking-message');
        if (existing) {
            const header = existing.querySelector('.reasoning-header');
            const dropdown = existing.querySelector('.reasoning-dropdown');
            if (header && dropdown) {
                header.classList.add('open');
                dropdown.classList.add('open');
            }
        }
    } catch (e) {
        console.warn('Failed to show thinking animation', e);
    }
}

function hideThinkingAnimation() {
    const thinkingMessage = document.getElementById('thinking-message');
    if (thinkingMessage) {
        thinkingMessage.remove();
    }
}

// Ensure a thinking message exists and set its text label
function ensureThinkingMessage(text = 'Thinking…') {
    try {
        let el = document.getElementById('thinking-message');
        const messagesArea = document.getElementById('messagesArea');
        if (!el) {
            el = document.createElement('div');
            el.className = 'message assistant';
            el.id = 'thinking-message';
            const content = document.createElement('div');
            content.className = 'message-content';
            // Match user's chat font
            try {
                const ff = getChatFontFamily();
                if (ff) content.style.fontFamily = ff;
            } catch {}
            // Build structure according to current model type so links can render inline next to the label
            if (isReasoningModelActive()) {
                content.innerHTML = `
                    <div class="reasoning-thinking">
                        <div class="reasoning-header open" onclick="this.classList.toggle('open'); this.nextElementSibling.classList.toggle('open')">
                            <span class="thinking-text"></span>
                            <span class="thinking-links"></span>
                            <i class="fas fa-chevron-right reasoning-caret" aria-hidden="true"></i>
                        </div>
                        <div class="reasoning-dropdown open">
                            <div class="reasoning-placeholder">Reasoning will be shown with the final answer.</div>
                        </div>
                    </div>
                `;
            } else {
                content.innerHTML = `
                    <span class="thinking-text"></span>
                    <span class="thinking-links"></span>
                `;
            }
            el.appendChild(content);
            // Insert at anchored position if provided
            const anchor = __thinkingInsertBeforeEl;
            if (messagesArea && anchor && anchor.parentNode === messagesArea) {
                messagesArea.insertBefore(el, anchor);
            } else if (messagesArea) {
                messagesArea.appendChild(el);
            }
        } else {
            // If we already have one and an anchor is present, move it to the anchor position
            const anchor = __thinkingInsertBeforeEl;
            if (messagesArea && anchor && anchor.parentNode === messagesArea && el.parentNode === messagesArea) {
                if (el.nextSibling !== anchor) {
                    messagesArea.insertBefore(el, anchor);
                }
            }
        }
        setThinkingText(text);
    } catch {}
}

function setThinkingText(text = 'Thinking…') {
    try {
        const label = document.querySelector('#thinking-message .thinking-text');
        if (label) label.textContent = text;
    } catch {}
}

// Update list of source links shown under the thinking label. Pass [] to clear.
function setThinkingLinks(links = []) {
    try {
        const box = document.querySelector('#thinking-message .thinking-links');
        if (!box) return;
        if (!Array.isArray(links) || links.length === 0) {
            box.innerHTML = '';
            return;
        }
        const safe = links.slice(0, 4).filter(x => x && x.url);
        if (!safe.length) { box.innerHTML = ''; return; }
        const html = safe.map(x => {
            const t = (x.title || x.url || '').toString().replace(/[\n\r]+/g, ' ').slice(0, 80);
            const u = x.url;
            return `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`;
        }).join(' \u00B7 ');
        box.innerHTML = html;
    } catch {}
}

function typeWriterEffect(element, text, speed = 30) {
    return new Promise((resolve) => {
        let i = 0;
        element.innerHTML = '';

        // Single accumulating text node to avoid per-char DOM nodes
        const textNode = document.createTextNode('');
        element.appendChild(textNode);

        // Cursor element
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        cursor.textContent = '|';
        element.appendChild(cursor);

        // rAF-driven loop to batch multiple chars per frame
        let lastTime = performance.now();
        let carry = 0; // accumulated ms to convert into characters
        let lastScrollAt = 0;

        const step = (now) => {
            if (i >= text.length) {
                cursor.remove();
                resolve();
                return;
            }

            const dt = now - lastTime;
            lastTime = now;
            carry += dt;

            // how many chars to add this frame
            const charsThisFrame = Math.max(1, Math.floor(carry / speed));
            if (charsThisFrame > 0) carry -= charsThisFrame * speed;

            const nextI = Math.min(text.length, i + charsThisFrame);
            if (nextI !== i) {
                // Update the single text node once per frame
                textNode.nodeValue = text.slice(0, nextI);
                i = nextI;
            }

            // Throttled scroll-to-bottom only if user is near bottom
            const messagesArea = document.getElementById('messagesArea');
            if (messagesArea) {
                const nearBottom = (messagesArea.scrollHeight - messagesArea.scrollTop - messagesArea.clientHeight) < 72;
                if (shouldAutoScroll() && nearBottom && (now - lastScrollAt) > 80) {
                    messagesArea.scrollTop = messagesArea.scrollHeight;
                    lastScrollAt = now;
                }
            }

            // Keep the cursor at the end (no layout-heavy inserts)
            requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
    });
}

async function displayMessageWithTypewriter(message) {
    const messagesArea = document.getElementById('messagesArea');
    const inputArea = document.querySelector('.input-area');
    const chatContainer = document.querySelector('.chat-container');
    // Guard against duplicate renderings
    if (message && message.role === 'assistant' && message.__rendered) {
        return;
    }
    
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
    // Match user's chat font
    try {
        const ff = getChatFontFamily();
        if (ff) contentDiv.style.fontFamily = ff;
    } catch {}
    
    // For AI messages, use typewriter effect
    if (message.role === 'assistant') {
        // If we are in a regeneration flow and carry variants are present, attach them to this message
        try {
            if (Array.isArray(window.__regenCarryVariants) && window.__regenCarryVariants.length) {
                const uniq = Array.from(new Set(window.__regenCarryVariants.filter(Boolean)));
                // Ensure we don't include the same text as the new content twice
                const base = uniq.filter(v => String(v) !== String(message.content || ''));
                message.__variants = [...base, String(message.content || '')];
                message.__variantIndex = message.__variants.length - 1;
                window.__regenCarryVariants = null;
            }
        } catch {}
        // Typewriter for assistant content only (no reasoning block)
        const finalText = renderMessageHTML(message.content || '');
        const textContainer = document.createElement('div');
        textContainer.className = 'typewriter-container';
        messageDiv.appendChild(contentDiv);
        contentDiv.appendChild(textContainer);
        // Append to DOM before typing so it becomes visible
        const beforeEl = (__assistantInsertBeforeEl && __assistantInsertBeforeEl.parentNode === messagesArea)
            ? __assistantInsertBeforeEl
            : null;
        const usedAnchorAtInsert = !!beforeEl;
        if (beforeEl) {
            messagesArea.insertBefore(messageDiv, beforeEl);
            // Do NOT clear __assistantInsertBeforeEl here; keep it until the entire typewriter flow finishes
        } else {
            messagesArea.appendChild(messageDiv);
        }
        // Ensure we start at bottom only if no anchored insertion is used
        if (!usedAnchorAtInsert && shouldAutoScroll()) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
        // Faster typewriter for non-reasoning models to avoid long waits
        const typeSpeed = 10; // ms per character (was default 30)
        await typeWriterEffect(textContainer, (message.content || ''), typeSpeed);
        // Force font inheritance after typewriter effect completes
        textContainer.innerHTML = finalText;
        // Ensure all elements inherit the correct font
        const allElements = textContainer.querySelectorAll('*');
        allElements.forEach(el => {
            el.style.fontFamily = 'var(--chat-font)';
        });
        textContainer.style.fontFamily = 'var(--chat-font)';
        // Append copy toolbar under assistant content
        const toolbar = createAssistantCopyToolbar(message.content || '', message);
        if (toolbar) contentDiv.appendChild(toolbar);
        // Final scroll to bottom after rendering, unless anchored insert was used
        if (!usedAnchorAtInsert && shouldAutoScroll()) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
        // Now that the entire async flow has finished, clear the anchor so subsequent messages behave normally
        __assistantInsertBeforeEl = null;
        try { message.__rendered = true; } catch {}
    } else {
        // User messages appear instantly
        displayMessage(message);
    }
}

function displayMessage(message, opts = {}) {
    const messagesArea = document.getElementById('messagesArea');
    const inputArea = document.querySelector('.input-area');
    const chatContainer = document.querySelector('.chat-container');
    // Avoid double-rendering assistant messages if already typed
    if (message && message.role === 'assistant' && message.__rendered) {
        return;
    }
    
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
    // Match user's chat font
    try {
        const ff2 = getChatFontFamily();
        if (ff2) contentDiv.style.fontFamily = ff2;
    } catch {}
    
    if (message.role === 'assistant') {
        // Render assistant messages: plain text unless code detected
        contentDiv.innerHTML = renderMessageHTML(message.content || '');
        // Append copy/regenerate toolbar under assistant content
        const toolbar = createAssistantCopyToolbar(message.content || '', message);
        if (toolbar) contentDiv.appendChild(toolbar);
    } else {
        contentDiv.innerHTML = `<p>${message.content.replace(/\n/g, '<br>')}</p>`;
    }
    
    messageDiv.appendChild(contentDiv);
    // Respect anchored insertion (used for regeneration inline placement)
    const beforeEl = (__assistantInsertBeforeEl && __assistantInsertBeforeEl.parentNode === messagesArea)
        ? __assistantInsertBeforeEl
        : null;
    if (beforeEl) {
        messagesArea.insertBefore(messageDiv, beforeEl);
        __assistantInsertBeforeEl = null;
    } else {
        messagesArea.appendChild(messageDiv);
    }

    // Scroll to bottom
    if (messagesArea) {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    if (!opts || !opts.fromPop) {
        // If a regeneration just completed, push a full snapshot with a specific tag
        if (window.__pendingPostRegeneratePush) {
            try {
                const snap = getCurrentConversationSnapshot();
                pushChatHistoryState({ messagesSnapshot: snap, __tag: 'post-regenerate' });
                historyLog('post-regenerate-push', { convo: currentConversationId, msgs: Array.isArray(snap) ? snap.length : 0 });
            } catch {}
            finally { try { window.__pendingPostRegeneratePush = false; } catch {} }
        } else if (!__inRegeneration) {
            pushChatHistoryState();
        }
    }
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

function loadConversation(conversationId, opts = {}) {
    currentConversationId = conversationId;
    const conversation = conversations[userId][conversationId];
    const inputArea = document.querySelector('.input-area');
    const messagesArea = document.getElementById('messagesArea');

    // Clear messages area
    clearMessages();

    // Determine which messages to render (history snapshot override or stored)
    const msgs = Array.isArray(opts.messagesOverride) ? opts.messagesOverride : (conversation.messages || []);

    // If there are messages, move input to bottom
    if (msgs.length > 0) {
        const chatContainer = document.querySelector('.chat-container');
        if (inputArea && chatContainer) {
            inputArea.classList.remove('centered');
            messagesArea.classList.remove('with-centered-input');
            chatContainer.classList.remove('input-centered');
        }

        // Display all messages instantly (no typewriter for loaded conversations)
        // Avoid pushing history for each message render
        msgs.forEach(message => {
            displayMessage(message, { fromPop: true });
        });
    }

    // Update conversation list
    updateConversationList();
    // On typewriter completion, handle history push with pending post-regenerate logic
    try {
        if (window.__pendingPostRegeneratePush) {
            try {
                const snap = getCurrentConversationSnapshot();
                pushChatHistoryState({ messagesSnapshot: snap, __tag: 'post-regenerate' });
                historyLog('post-regenerate-push', { convo: currentConversationId, msgs: Array.isArray(snap) ? snap.length : 0 });
            } catch {}
            finally { try { window.__pendingPostRegeneratePush = false; } catch {} }
        } else if (!__inRegeneration) {
            pushChatHistoryState();
        }
    } catch {}
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
            // Reflect empty state in history so Back restores properly
            replaceChatHistoryState();
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

// Fetch list of local Ollama models via Tauri (avoids CORS/release restrictions)
async function fetchOllamaModels() {
    try {
        const tauri = window.__TAURI__;
        const inv = tauri?.core?.invoke || tauri?.invoke || invoke;
        const names = await inv('get_ollama_models'); // returns Vec<String>
        if (Array.isArray(names)) {
            // Normalize to previous shape { name }
            return names.map((n) => ({ name: n }));
        }
        return [];
    } catch (e) {
        console.warn('Failed to fetch Ollama models (tauri):', e?.message || e);
        return [];
    }
}

// Probe connectivity to Ollama via Tauri
async function checkOllamaReachable() {
    try {
        // Prefer native Tauri invoke; if not present, consider unreachable in browser
        const tauri = window.__TAURI__;
        const inv = tauri?.core?.invoke || tauri?.invoke;
        if (!inv) {
            return false;
        }
        const res = await inv('get_ollama_models');
        // Treat as reachable only if we get a list (Vec<String>)
        const ok = Array.isArray(res);
        console.debug('[Ollama] reachability check:', { ok, resType: Array.isArray(res) ? 'array' : typeof res, length: Array.isArray(res) ? res.length : undefined });
        return ok;
    } catch (_) {
        // Any error means Ollama is not reachable
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

    // Cache last values to avoid unnecessary DOM writes
    const lastReachable = window.__ollamaLastReachable;
    const lastCount = window.__ollamaLastCount;
    const newCount = models.length || 0;

    if (lastCount !== newCount) {
        countEl.textContent = String(newCount);
        window.__ollamaLastCount = newCount;
    }

    if (statusDot) {
        // Always set current state to avoid stale UI, but minimize DOM churn via cache
        if (lastReachable !== reachable) {
            statusDot.classList.toggle('online', reachable);
            statusDot.classList.toggle('offline', !reachable);
            window.__ollamaLastReachable = reachable;
        }
        const desiredTitle = reachable ? 'Ollama connected' : 'Ollama not connected';
        if (statusDot.getAttribute('data-tooltip') !== desiredTitle) {
            // Store desired title in data-tooltip to integrate with custom tooltip system
            statusDot.setAttribute('data-tooltip', desiredTitle);
        }
    }

    // Adaptive polling backoff: poll slower when unreachable
    try {
        const desired = reachable ? 5000 : 15000;
        if (window.__ollamaPollingMs !== desired) {
            window.__ollamaPollingMs = desired;
            if (typeof restartOllamaPolling === 'function') restartOllamaPolling();
        }
    } catch {}

    return models;
}

// Right-side submenu for Ollama models
async function toggleOllamaMenu(event) {
    event.stopPropagation();
    const item = document.getElementById('ollamaMenuItem');
    const menu = document.getElementById('mainTitleMenu');
    if (!item || !menu) return;

    // Remove any existing submenu to avoid stale/empty lists
    const existing = menu.querySelector('.main-title-submenu');
    if (existing) existing.remove();

    const models = await updateOllamaCount();
    console.debug('[Ollama] submenu models:', { count: models.length, names: models.map(m=>m.name), reachable: !!window.__ollamaLastReachable });

    const submenu = document.createElement('div');
    submenu.className = 'main-title-submenu';
    
    if (models.length) {
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
            // Model name element
            const nameEl = document.createElement('span');
            nameEl.className = 'model-name';
            nameEl.textContent = m.name;
            left.appendChild(nameEl);
            // Optional compact reasoning badge
            const reasoning = isReasoningModelName(m.name);
            if (reasoning) {
                const badge = document.createElement('span');
                badge.className = 'reasoning-badge';
                badge.textContent = 'Reasoning';
                left.appendChild(badge);
            }
            // Optional compact tools badge
            const toolsCapable = isToolCapableModelName(m.name);
            if (toolsCapable) {
                const tBadge = document.createElement('span');
                tBadge.className = 'tools-badge';
                tBadge.textContent = 'Tools';
                left.appendChild(tBadge);
            }
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

    // Attach submenu to the overall menu container for precise positioning
    menu.appendChild(submenu);

    // Compute exact position so the submenu's top aligns with the TOP of the main menu
    const itemRect = item.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const cs = window.getComputedStyle(menu);
    const padTop = parseFloat(cs.paddingTop || '0') || 0;
    const borderTop = parseFloat(cs.borderTopWidth || '0') || 0;
    // Place submenu's top at the visual top edge of the menu with a slightly larger downward nudge
    const top = -(padTop + borderTop) + 5;
    const gap = 3; // visual gap between parent and submenu
    const left = (itemRect.right - menuRect.left) + gap;
    // Use !important to ensure no stylesheet (including Tauri-injected) overrides this precise positioning
    submenu.style.setProperty('top', `${top}px`, 'important');
    submenu.style.setProperty('left', `${left}px`, 'important');

    requestAnimationFrame(() => submenu.classList.add('show'));
}

function selectModelByName(modelName) {
    console.log('Selected Ollama model:', modelName);
    // Persist selection
    selectedOllamaModel = modelName;
    localStorage.setItem('selectedOllamaModel', modelName);

    // Update checkmarks in the open submenu without closing menus
    const menu = document.getElementById('mainTitleMenu');
    const submenu = menu?.querySelector('.main-title-submenu');
    if (submenu) {
        submenu.querySelectorAll('.dropdown-item').forEach(row => {
            const name = row.querySelector('.model-name')?.textContent?.trim();
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
// Reflect persisted SSE state in tools set on init
if (USE_BACKEND_SSE) {
    activeTools.add('sse');
}
// Also set localStorage to ensure consistency
try { localStorage.setItem('useBackendSSE', String(USE_BACKEND_SSE)); } catch {}

// Tool selection functionality
function selectTool(toolType) {
    console.log('Selected tool:', toolType);
    
    const toolElement = document.getElementById(`${toolType}-tool`);
    
    // Toggle tool active state
    const activating = !activeTools.has(toolType);
    if (activating) {
        activeTools.add(toolType);
        toolElement.classList.add('active');
        console.log(`${toolType} tool activated`);
    } else {
        activeTools.delete(toolType);
        toolElement.classList.remove('active');
        console.log(`${toolType} tool deactivated`);
    }

    // DON'T close dropup - keep it open for multiple selections
    
    // Side effects for specific tools
    if (toolType === 'sse') {
        USE_BACKEND_SSE = activating;
        try { localStorage.setItem('useBackendSSE', String(USE_BACKEND_SSE)); } catch {}
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
        const menuEl = document.getElementById('mainTitleMenu');
        const submenu = menuEl?.querySelector('.main-title-submenu');
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
    try { window.copyHistoryLogsToClipboard = copyHistoryLogsToClipboard; } catch {}
    // Hotkey: Ctrl+Alt+H to copy in-app history logs
    document.addEventListener('keydown', (e) => {
        try {
            const ctrl = e.ctrlKey || e.metaKey; // allow Cmd on macOS
            if (ctrl && e.altKey && (e.key === 'h' || e.key === 'H')) {
                e.preventDefault();
                copyHistoryLogsToClipboard();
            }
        } catch {}
    });
    new ThemeManager();
    new SidebarManager();
    new MessageInputManager();
    // Initialize history state based on current URL hash
    try {
        const hash = (location.hash || '').replace(/^#/, '').trim();
        if (hash && conversations[userId] && conversations[userId][hash]) {
            // Replace state to avoid an extra back step
            currentConversationId = hash;
            replaceChatHistoryState();
            loadConversation(hash, { fromPop: true });
        } else {
            replaceChatHistoryState();
        }
    } catch {
        // Always ensure we have a baseline state
        replaceChatHistoryState();
    }

    // Apply chat font CSS variable from the input's computed font
    try {
        applyChatFontVariable();
        const input = document.getElementById('messageInput');
        if (input) {
            // Re-apply when input's geometry or attributes change (themes, classes, inline styles)
            const ro = new ResizeObserver(() => applyChatFontVariable());
            try { ro.observe(input); } catch {}
            const mo = new MutationObserver(() => applyChatFontVariable());
            try { mo.observe(input, { attributes: true, attributeFilter: ['style', 'class'] }); } catch {}
        }
        window.addEventListener('resize', applyChatFontVariable);
    } catch {}
    
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
    
    // Auto-refresh Ollama status with adaptive polling
    window.__ollamaPollingMs = window.__ollamaPollingMs || 5000;
    restartOllamaPolling();
    
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

    // Reflect persisted tool states in the Tools dropup UI
    try {
        const web = document.getElementById('websearch-tool');
        const sse = document.getElementById('sse-tool');
        if (web && activeTools.has('websearch')) web.classList.add('active');
        if (sse && activeTools.has('sse')) sse.classList.add('active');
    } catch {}
    
    // Removed periodic layout maintenance to reduce idle CPU usage
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
        // Re-apply chat font on visibility gain (some environments swap fonts late)
        applyChatFontVariable();
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