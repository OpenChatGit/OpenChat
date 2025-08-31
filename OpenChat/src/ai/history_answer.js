// Deterministic history-based answers for recall-style user queries.
// Guarantees correctness for questions about prior messages, independent of model quality.

/**
 * Try to answer from conversation history when the user asks about previous turns.
 * Supports simple English and German patterns.
 *
 * @param {Object} conversation - Conversation object with messages [{role, content}]
 * @param {string} userMessage - The latest user message text
 * @returns {string|null} Answer text if handled locally; otherwise null
 */
export function answerFromHistoryIfApplicable(conversation, userMessage) {
  const text = String(userMessage || '').trim();
  if (!text) return null;
  const msgs = Array.isArray(conversation?.messages) ? conversation.messages : [];
  if (!msgs.length) return null;

  const lc = text.toLowerCase();

  // Helpers
  const lastOf = (role) => [...msgs].reverse().find(m => m.role === role)?.content || null;
  const nthAssistant = (n) => msgs.filter(m => m.role === 'assistant')[n]?.content || null;
  const nthUser = (n) => msgs.filter(m => m.role === 'user')[n]?.content || null;

  // Common patterns (EN)
  const patternsEN = [
    { re: /what did you say (right )?before (this|my) message\??$/, fn: () => lastOf('assistant') },
    { re: /what did you say after the first message\??$/, fn: () => nthAssistant(0) },
    { re: /what did you answer on (?:my|the) first (?:message|question)\??$/, fn: () => nthAssistant(0) },
    { re: /what was your answer to (?:my|the) first (?:message|question)\??$/, fn: () => nthAssistant(0) },
    { re: /what was your last (message|reply)\??$/, fn: () => lastOf('assistant') },
    { re: /what did i say (last|previously)\??$/, fn: () => lastOf('user') },
    { re: /what did i ask (first|initially)\??$/, fn: () => nthUser(0) },
    // Follow-up asking for justification after a recall answer
    { re: /how do you know that\??$/, fn: () => explainHowWeKnow(msgs) },
  ];

  // Common patterns (DE)
  const patternsDE = [
    { re: /was hast du (direkt )?vor dieser nachricht gesagt\??$/, fn: () => lastOf('assistant') },
    { re: /was hast du nach der ersten nachricht gesagt\??$/, fn: () => nthAssistant(0) },
    { re: /was hast du auf (?:meine|die) erste (?:nachricht|frage) geantwortet\??$/, fn: () => nthAssistant(0) },
    { re: /was war deine antwort auf (?:meine|die) erste (?:nachricht|frage)\??$/, fn: () => nthAssistant(0) },
    { re: /was war deine letzte (nachricht|antwort)\??$/, fn: () => lastOf('assistant') },
    { re: /was habe ich (zuletzt|vorher) gesagt\??$/, fn: () => lastOf('user') },
    { re: /was habe ich (zuerst|am anfang) gefragt\??$/, fn: () => nthUser(0) },
    // Follow-up justification
    { re: /woher weißt du das\??$/, fn: () => explainHowWeKnow(msgs, 'de') },
  ];

  for (const p of [...patternsEN, ...patternsDE]) {
    if (p.re.test(lc)) {
      const ans = p.fn();
      if (ans) {
        return `Here is the exact quote from the conversation:\n\n"""\n${ans}\n"""`;
      } else {
        return 'I could not find a matching prior message in the conversation history.';
      }
    }
  }

  // Not a recognized recall question
  return null;
}

// Build an explanation about how we got the recall answer
function explainHowWeKnow(msgs, lang = 'en') {
  // Detect if the previous assistant message was our deterministic recall quote
  const lastAssistantIndex = [...msgs].reverse().findIndex(m => m.role === 'assistant');
  if (lastAssistantIndex === -1) return null;
  const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant');
  const isRecall = typeof lastAssistant?.content === 'string' && /Here is the exact quote from the conversation/.test(lastAssistant.content);
  // Find the quoted original assistant reply content if present
  let quoted = null;
  if (isRecall) {
    const m = lastAssistant.content.match(/"""\n([\s\S]*?)\n"""/);
    if (m) quoted = m[1].trim();
  }
  // Compute the turn number of that quoted reply in the full stream
  let turnNumber = null;
  if (quoted) {
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.role === 'assistant' && typeof m.content === 'string' && m.content.trim() === quoted) {
        // Turn numbers are 1-based
        turnNumber = i + 1;
        break;
      }
    }
  }
  if (lang === 'de') {
    const base = 'Ich habe die Unterhaltungshistorie oben verwendet.';
    const withTurn = turnNumber ? ` Es ist die Assistenz-Antwort aus Turn ${turnNumber}.` : '';
    return base + withTurn + ' Ich zitiere bei solchen Fragen exakt aus dem Verlauf, anstatt zu raten.';
  }
  const base = 'I used the conversation history above.';
  const withTurn = turnNumber ? ` It is the assistant reply from turn ${turnNumber}.` : '';
  return base + withTurn + ' For such questions I quote exactly from the transcript rather than guessing.';
}
