// SSE-based streaming against FastAPI `/lcel/chat/sse`
// Follows LangChain LCEL streaming best practices: server yields `data: <chunk>\n\n` and final `data: [DONE]\n\n`

// Remove any leaked provider metadata keys if the server accidentally passes them
function sanitizeChunk(text = '') {
  try {
    let t = String(text || '');
    if (!t) return t;
    // Quick rejects to avoid extra work
    if (!/(response_metadata|usage_metadata|additional_kwargs|model_name|done_reason)/.test(t)) return t;
    // Remove common metadata key-value patterns that sometimes leak via stringified chunks
    t = t.replace(/\badditional_kwargs\s*=\s*\{[^}]*\}/gi, '');
    t = t.replace(/\bresponse_metadata\s*=\s*\{[^}]*\}/gi, '');
    t = t.replace(/\busage_metadata\s*=\s*\{[^}]*\}/gi, '');
    t = t.replace(/\bmodel_name\s*=\s*'[^']*'/gi, '');
    t = t.replace(/\bdone_reason\s*=\s*'[^']*'/gi, '');
    t = t.replace(/\bid\s*=\s*'[^']*'/gi, '');
    // Remove residual labels like "content='' " when content is empty
    t = t.replace(/\bcontent\s*=\s*''/gi, '');
    // IMPORTANT: Do not trim or collapse spaces; preserve token spacing exactly
    return t;
  } catch {
    return text;
  }
}

export async function streamSseResponse({
  serverBase = 'http://127.0.0.1:8000',
  model = 'llama3.1',
  message,
  history = [],
  system = '',
  ui,
  conversation,
}) {
  if (!message || !message.trim()) throw new Error('message is required');

  let aborted = false;
  let controller;

  const cleanup = () => {
    try { controller?.abort(); } catch {}
  };

  const cancelThisStream = async () => {
    aborted = true;
    cleanup();
    if (window.__cancelActiveStream === cancelThisStream) {
      window.__cancelActiveStream = null;
    }
  };
  window.__cancelActiveStream = cancelThisStream;

  const payload = { model, message, history, system };
  try {
    if (conversation && conversation.id) {
      // Prefer snake_case key for backend, but also support camelCase on server
      payload.conversation_id = conversation.id;
    }
  } catch {}

  const url = `${serverBase.replace(/\/$/, '')}/lcel/chat/sse`;
  controller = new AbortController();

  let fullText = '';

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!resp.ok || !resp.body) {
      throw new Error(`SSE request failed: ${resp.status} ${resp.statusText}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // Parse SSE lines
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const raw = buf.slice(0, idx); // keep exact spacing
        buf = buf.slice(idx + 2);
        const line = raw; // do not trim; tokens may begin with a leading space

        if (line.startsWith('event: error')) {
          const dataIdx = line.indexOf('data:');
          const err = dataIdx >= 0 ? line.slice(dataIdx + 5).trim() : 'error';
          throw new Error(err);
        }

        if (line.startsWith('data:')) {
          const rawData = line.slice(5);
          // Control line may carry stray spaces or CR; detect using trim
          if (rawData.trim() === '[DONE]') {
            // finalize
            try { ui?.hideThinking?.(); } catch {}
            const content = sanitizeChunk(fullText);
            const aiMessage = { role: 'assistant', content, reasoning: null, timestamp: new Date() };
            if (conversation && Array.isArray(conversation.messages)) {
              try { conversation.messages.push(aiMessage); } catch {}
            }
            try {
              if (ui?.displayTypewriter) await ui.displayTypewriter(aiMessage);
              else if (ui?.displayNow) ui.displayNow(aiMessage);
            } finally {
              if (conversation) {
                try { conversation.updated_at = new Date(); } catch {}
                try { ui?.updateConversationList?.(); } catch {}
                // Ensure we never leave the title empty
                try {
                  if (!conversation.title || !String(conversation.title).trim()) {
                    const lastUser = [...(conversation.messages || [])].reverse().find(m => m.role === 'user' && m.content);
                    if (lastUser && lastUser.content) {
                      const snippet = lastUser.content.slice(0, 50) + (lastUser.content.length > 50 ? '...' : '');
                      if (snippet.trim()) {
                        conversation.title = snippet.trim();
                        ui?.updateConversationList?.();
                      }
                    }
                  }
                } catch {}
                // Fire-and-forget: refresh AI-generated title after assistant finished
                try {
                  if (typeof window.requestAIGeneratedTitle === 'function') {
                    Promise.resolve(window.requestAIGeneratedTitle(conversation)).catch(()=>{});
                  }
                } catch {}
              }
            }
            window.__cancelActiveStream = null;
            return;
          }
          let data = sanitizeChunk(rawData); // keep original spacing for normal tokens
          fullText += data;
        }
      }
    }

    // If stream ended without [DONE], still render what we have
    try { ui?.hideThinking?.(); } catch {}
    const content = sanitizeChunk(fullText) || 'No response.';
    const aiMessage = { role: 'assistant', content, reasoning: null, timestamp: new Date() };
    if (conversation && Array.isArray(conversation.messages)) {
      try { conversation.messages.push(aiMessage); } catch {}
    }
    try {
      if (ui?.displayTypewriter) await ui.displayTypewriter(aiMessage);
      else if (ui?.displayNow) ui.displayNow(aiMessage);
    } finally {
      if (conversation) {
        try { conversation.updated_at = new Date(); } catch {}
        try { ui?.updateConversationList?.(); } catch {}
        // Ensure we never leave the title empty
        try {
          if (!conversation.title || !String(conversation.title).trim()) {
            const lastUser = [...(conversation.messages || [])].reverse().find(m => m.role === 'user' && m.content);
            if (lastUser && lastUser.content) {
              const snippet = lastUser.content.slice(0, 50) + (lastUser.content.length > 50 ? '...' : '');
              if (snippet.trim()) {
                conversation.title = snippet.trim();
                ui?.updateConversationList?.();
              }
            }
          }
        } catch {}
        // Fire-and-forget: refresh AI-generated title after assistant finished
        try {
          if (typeof window.requestAIGeneratedTitle === 'function') {
            Promise.resolve(window.requestAIGeneratedTitle(conversation)).catch(()=>{});
          }
        } catch {}
      }
    }
  } catch (e) {
    if (!aborted) {
      console.error('[sse] streaming error:', e);
      // Allow caller to handle fallback if requested
      if (ui && ui.onErrorReturnToCaller) {
        throw e;
      } else {
        const errMsg = { role: 'assistant', content: 'Sorry, there was an error processing your message.', timestamp: new Date() };
        if (conversation && Array.isArray(conversation.messages)) {
          try { conversation.messages.push(errMsg); } catch {}
        }
        if (ui?.displayTypewriter) await ui.displayTypewriter(errMsg);
        else if (ui?.displayNow) ui.displayNow(errMsg);
        if (conversation) {
          try { conversation.updated_at = new Date(); } catch {}
          try { ui?.updateConversationList?.(); } catch {}
        }
      }
    }
  } finally {
    window.__cancelActiveStream = null;
  }
}
