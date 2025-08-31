import { streamSimpleResponse } from './ai/stream_simple.js';
import { streamReasoningResponse } from './ai/stream_reasoning.js';
import { buildPromptWithContext } from './ai/context_manager.js';
import { answerFromHistoryIfApplicable } from './ai/history_answer.js';
 
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

// Reasoning streaming moved to ./ai/stream_reasoning.js

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

// Reasoning model detection helpers and overrides
// You can force a model to be treated as reasoning or non-reasoning via localStorage keys:
//   forceReasoning:<modelName> = "true"   OR   forceNonReasoning:<modelName> = "true"
const REASONING_MODEL_HINTS = [
    'reason', 'r1', 'o4', 'think', 'qwen2.5-r', 'r-', 'deepseek-r', 'glm-r'
];
const REASONING_MODEL_EXACT = new Set([
    // Add exact names here if needed, e.g. 'deepseek-r1:8b'
]);

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
        // If Web Search tool is active, add tool-aware instruction so models know they can use it
        const toolAware = (activeTools && activeTools.has && activeTools.has('websearch')) ? buildToolAwareInstruction() : '';
        const reasoningAware = (ENABLE_INTERNAL_REASONING_PROMPT && isReasoningModelActive()) ? buildReasoningInstruction() : '';
        // Build context-aware prompt including prior relevant turns
        let finalPrompt = buildPromptWithContext(conversation, messageContent, {
            maxChars: 8000,
            systemPreamble: undefined, // use default preamble in context manager
            toolAware,
            reasoningAware
        });
        // Debug preview to verify context inclusion (trimmed to avoid flooding console)
        try {
            const head = finalPrompt.slice(0, 800);
            const tail = finalPrompt.length > 300 ? finalPrompt.slice(-300) : '';
            console.debug('[prompt head]\n' + head);
            if (tail) console.debug('[prompt tail]\n' + tail);
        } catch {}

        // Show thinking animation (reasoning UI only if a reasoning model is active)
        showThinkingAnimation();
        // Route by model type to avoid collisions between reasoning and non-reasoning logic
        if (!isReasoningModelActive()) {
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
                tools: {
                    activeTools,
                    performWebSearch,
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
                if (nearBottom && (now - lastScrollAt) > 80) {
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
        // Append to DOM before typing so it becomes visible
        messagesArea.appendChild(messageDiv);
        // Ensure we start at bottom
        messagesArea.scrollTop = messagesArea.scrollHeight;
        // Faster typewriter for non-reasoning models to avoid long waits
        const typeSpeed = 10; // ms per character (was default 30)
        await typeWriterEffect(textContainer, (message.content || ''), typeSpeed);
        textContainer.replaceWith((() => { const div = document.createElement('div'); div.innerHTML = finalText; return div; })());
        // Final scroll to bottom after rendering
        messagesArea.scrollTop = messagesArea.scrollHeight;
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
        // Call the Tauri command directly so that connection errors throw
        const tauri = window.__TAURI__;
        const inv = tauri?.core?.invoke || tauri?.invoke || invoke;
        await inv('get_ollama_models');
        // If we reached here without throwing, Ollama responded => reachable
        return true;
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

    if (statusDot && lastReachable !== reachable) {
        statusDot.classList.toggle('online', reachable);
        statusDot.classList.toggle('offline', !reachable);
        statusDot.setAttribute('title', reachable ? 'Ollama connected' : 'Ollama not connected');
        window.__ollamaLastReachable = reachable;
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

    // If a submenu already exists anywhere in the menu, just toggle it
    const existing = menu.querySelector('.main-title-submenu');
    if (existing) {
        existing.classList.toggle('show');
        return;
    }

    const models = await updateOllamaCount();

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