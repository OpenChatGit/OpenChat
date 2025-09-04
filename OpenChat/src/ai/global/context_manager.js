// Global conversation context manager
// Builds a prompt that includes relevant prior messages and the new user message.
// This is a lightweight, character-budget-based approach that avoids heavy tokenization.

/**
 * Build a context-aware prompt for the LLM.
 *
 * @param {Object} conversation - Conversation object with messages array [{role:'user'|'assistant', content:string}]
 * @param {string} userMessage - The latest user message to answer.
 * @param {Object} [options]
 * @param {number} [options.maxChars=8000] - Soft cap for total characters in the prompt.
 * @param {string} [options.systemPreamble] - Optional system instruction at the top.
 * @param {string} [options.toolAware] - Optional tool instruction block appended at the end of the user message.
 * @param {string} [options.reasoningAware] - Optional reasoning instruction block appended at the end of the user message.
 * @returns {string} final prompt string
 */
export function buildPromptWithContext(conversation, userMessage, options = {}) {
  const {
    maxChars = 12000,
    systemPreamble,
    toolAware = '',
    reasoningAware = '',
    alwaysIncludeLastTurns = 30 // ensure at least N most recent messages are present
  } = options || {};

  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];

  // Default preamble keeps instructions minimal; streaming modules will add language directive.
  const preamble = (systemPreamble || (
    'You are OpenChat, a helpful, conversational AI assistant. ' +
    'Answer directly and naturally, with a friendly tone and without boilerplate. ' +
    'Avoid stock phrases like "How can I assist you today?" unless explicitly requested. ' +
    'Prefer concrete, specific answers with brief rationale or examples when useful. ' +
    'Follow the conversation context below and answer the final user message.'
  )).trim();

  // Collect prior messages in reverse (most recent first) until budget reached.
  // Enumerate turns to help the model keep order and count.
  const historyLines = [];
  let budget = Math.max(1000, +maxChars || 8000); // never below 1k chars
  const sep = '\n';

  // Start with a small fixed overhead for preamble and headers
  const overhead = (
    '[System]\n'.length + preamble.length +
    '\n\n[Conversation]\n'.length +
    '\n\n[Now answer the final user message below.]\n'.length +
    '\n[User]\n'.length + String(userMessage || '').length +
    (toolAware?.length || 0) + (reasoningAware?.length || 0)
  );

  // Remaining budget for history
  budget -= Math.min(budget - 200, overhead); // keep some slack

  // Walk backward over prior messages only (exclude the new one not yet in array or allow duplicates safely)
  let turnNumber = messages.length; // 1-based visual numbering
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m.content !== 'string') continue;
    // Skip the very last if it equals the new user message we will add explicitly
    if (i === messages.length - 1 && m.role === 'user' && m.content === userMessage) continue;
    const role = m.role === 'assistant' ? 'Assistant' : 'User';
    const line = `[Turn ${turnNumber}] ${role}: ${m.content}`;
    const len = line.length + sep.length;
    // Always include at least the last N turns regardless of budget
    const mustInclude = (messages.length - i) <= alwaysIncludeLastTurns;
    if (mustInclude || len <= budget || historyLines.length === 0) {
      historyLines.push(line);
      budget -= len;
    } else {
      break; // stop when out of budget
    }
    turnNumber--;
  }
  // Reverse to chronological order
  historyLines.reverse();

  // Build final prompt sections
  const parts = [];
  parts.push('[System]');
  parts.push(preamble);
  parts.push('');
  parts.push('[Conversation]');
  if (conversation?.title) {
    parts.push(`Title: ${conversation.title}`);
  }
  if (historyLines.length) {
    parts.push(historyLines.join('\n'));
  } else {
    parts.push('(no prior messages)');
  }
  parts.push('');
  parts.push('[Now answer the final user message below.]');
  parts.push('[User]');
  const userBlock = String(userMessage || '') + (toolAware || '') + (reasoningAware || '');
  parts.push(userBlock);
  parts.push('');
  parts.push('Answer as the assistant. Use the conversation history above for context.');
  parts.push('Respond to the final user message only. If the user asks what you previously said, quote exactly the text of your prior assistant reply from this conversation.');
  parts.push('Avoid generic acknowledgements or repeating the same intent. Use varied, natural phrasing. If your draft resembles your most recent assistant message, revise with new details, examples, or a different angle.');
  parts.push('If the user just greets, reply with a brief, friendly greeting plus one concise follow-up question relevant to the chat context.');

  return parts.join('\n');
}
