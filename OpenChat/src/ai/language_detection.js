// Lightweight language detection for user inputs
// No external dependencies; heuristic based on scripts and small stopword sets.
// Exports:
//   - detectLanguage(text): { code, name, script, confidence }
//   - chooseResponseLanguage(userText, fallback): ISO-639-1 code
//   - languageNameFromCode(code)

const SCRIPTS = [
  { name: 'Han', re: /[\u4E00-\u9FFF\u3400-\u4DBF]/ }, // CJK Unified + Ext A
  { name: 'Hiragana', re: /[\u3040-\u309F]/ },
  { name: 'Katakana', re: /[\u30A0-\u30FF]/ },
  { name: 'Hangul', re: /[\uAC00-\uD7AF\u1100-\u11FF]/ },
  { name: 'Arabic', re: /[\u0600-\u06FF]/ },
  { name: 'Cyrillic', re: /[\u0400-\u04FF]/ },
  { name: 'Greek', re: /[\u0370-\u03FF]/ },
  { name: 'Devanagari', re: /[\u0900-\u097F]/ },
  { name: 'Hebrew', re: /[\u0590-\u05FF]/ },
  { name: 'Thai', re: /[\u0E00-\u0E7F]/ },
  { name: 'Latin', re: /[A-Za-zÀ-ÖØ-öø-ÿĀ-ſ]/ },
];

const CODE_TO_NAME = {
  en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano', pt: 'Português',
  nl: 'Nederlands', sv: 'Svenska', da: 'Dansk', no: 'Norsk', fi: 'Suomi',
  ru: 'Русский', uk: 'Українська', pl: 'Polski', cs: 'Čeština', sk: 'Slovenčina', ro: 'Română', hu: 'Magyar',
  tr: 'Türkçe', el: 'Ελληνικά', he: 'עברית', ar: 'العربية', hi: 'हिन्दी', th: 'ไทย',
  zh: '中文', ja: '日本語', ko: '한국어'
};

// Minimal stopword sets for Latin alphabet languages (very small but effective)
const STOPWORDS = {
  en: ['the','and','you','for','with','that','this','are','not','have','from','your','can','will','use','how','what','when','where','who','why'],
  de: ['und','die','der','ist','nicht','ein','ich','mit','für','auf','sie','wir','du','das','oder','auch','wie','was','warum','wo'],
  fr: ['et','les','des','une','est','pas','que','qui','pour','avec','sur','vous','nous','elle','il','dans','au','aux','comme','quoi'],
  es: ['que','los','las','una','una','con','por','para','como','donde','cuando','quien','porqué','qué','no','sí','esta','este'],
  it: ['che','non','per','con','una','uno','come','dove','quando','perché','noi','voi','lui','lei','nel','nella','degli','delle'],
  pt: ['que','não','com','para','uma','como','onde','quando','quem','porquê','você','nós','eles','elas','dos','das','no','na'],
  nl: ['en','de','het','een','niet','met','voor','als','waar','wanneer','wie','waarom','hoe','wij','jij','zij'],
  sv: ['och','det','att','som','en','är','inte','med','för','på','var','när','vem','varför','hur'],
  da: ['og','det','at','som','en','er','ikke','med','for','på','hvor','hvornår','hvem','hvorfor','hvordan'],
  no: ['og','det','at','som','en','er','ikke','med','for','på','hvor','når','hvem','hvorfor','hvordan'],
  fi: ['ja','se','että','on','ei','ole','kanssa','miten','missä','milloin','kuka','miksi'],
  pl: ['i','że','nie','jest','dla','z','jak','kiedy','gdzie','kto','dlaczego','oraz','tak','nie'],
  cs: ['a','že','není','pro','s','jak','kdy','kde','kdo','proč','ano','ne'],
  ro: ['și','că','nu','este','pentru','cu','cum','unde','când','cine','de ce','da','nu'],
  hu: ['és','hogy','nem','van','számára','vel','hogyan','hol','mikor','ki','miért'],
  tr: ['ve','bir','bu','için','ile','değil','ne','nasıl','nerede','ne zaman','kim','neden']
};

function countScriptChars(text) {
  const counts = {};
  for (const { name, re } of SCRIPTS) {
    const m = text.match(re);
    counts[name] = m ? m.length : 0;
  }
  return counts;
}

function guessByScript(counts) {
  const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const [topScript, topCount] = entries[0] || ['Latin', 0];
  const total = entries.reduce((s, [,c]) => s + c, 0) || 1;
  const conf = Math.min(1, topCount / total + 0.1);

  switch (topScript) {
    case 'Hiragana':
    case 'Katakana': return { code: 'ja', script: 'Kana', confidence: conf };
    case 'Hangul': return { code: 'ko', script: 'Hangul', confidence: conf };
    case 'Han': return { code: 'zh', script: 'Han', confidence: conf };
    case 'Arabic': return { code: 'ar', script: 'Arabic', confidence: conf };
    case 'Cyrillic': return { code: 'ru', script: 'Cyrillic', confidence: conf };
    case 'Greek': return { code: 'el', script: 'Greek', confidence: conf };
    case 'Devanagari': return { code: 'hi', script: 'Devanagari', confidence: conf };
    case 'Hebrew': return { code: 'he', script: 'Hebrew', confidence: conf };
    case 'Thai': return { code: 'th', script: 'Thai', confidence: conf };
    default: return { code: 'und', script: topScript, confidence: 0.3 };
  }
}

function scoreLatin(text) {
  const tokens = text.toLowerCase().split(/[^\p{L}]+/u);
  const scores = {};
  for (const [code, words] of Object.entries(STOPWORDS)) {
    let s = 0;
    for (const w of words) if (tokens.includes(w)) s += 1;
    scores[code] = s / Math.max(1, Math.min(tokens.length, 50));
  }
  // diacritics hints
  const t = text;
  if (/ß/.test(t)) scores.de = (scores.de || 0) + 0.2;
  if (/[éèêàçâîôûùëïü]/i.test(t)) scores.fr = (scores.fr || 0) + 0.15;
  if (/[ñáéíóúü]/i.test(t)) scores.es = (scores.es || 0) + 0.15;
  if (/[ąćęłńóśźż]/i.test(t)) scores.pl = (scores.pl || 0) + 0.25;
  if (/[ăâîșşţț]/i.test(t)) scores.ro = (scores.ro || 0) + 0.25;
  if (/[ğışçöü]|(?:I\b)/i.test(t)) scores.tr = (scores.tr || 0) + 0.2;
  if (/[åäö]/i.test(t)) scores.sv = (scores.sv || 0) + 0.2;
  if (/[æøå]/i.test(t)) { scores.da = (scores.da || 0) + 0.2; scores.no = (scores.no || 0) + 0.2; }

  const ranked = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const [bestCode, bestScore] = ranked[0] || ['en', 0];
  const confidence = Math.min(1, bestScore + 0.4);
  return { code: bestCode, confidence };
}

export function detectLanguage(text) {
  const input = (text || '').trim();
  if (!input) {
    const nav = (navigator && navigator.language || 'en').slice(0,2).toLowerCase();
    return { code: nav, name: CODE_TO_NAME[nav] || 'Unknown', script: 'Latin', confidence: 0.2 };
  }

  if (input.length < 16) {
    // very short: rely on script + locale preference
    const counts = countScriptChars(input);
    const scriptGuess = guessByScript(counts);
    if (scriptGuess.code !== 'und') {
      return { ...scriptGuess, name: CODE_TO_NAME[scriptGuess.code] || 'Unknown' };
    }
    const nav = (navigator && navigator.language || 'en').slice(0,2).toLowerCase();
    return { code: nav, name: CODE_TO_NAME[nav] || 'Unknown', script: scriptGuess.script || 'Latin', confidence: 0.3 };
  }

  const counts = countScriptChars(input);
  const scriptGuess = guessByScript(counts);
  if (scriptGuess.code !== 'und' && scriptGuess.script !== 'Latin') {
    return { ...scriptGuess, name: CODE_TO_NAME[scriptGuess.code] || 'Unknown' };
  }

  // Latin languages: score with stopwords/diacritics
  const latin = scoreLatin(input);
  const name = CODE_TO_NAME[latin.code] || 'Unknown';
  return { code: latin.code, name, script: 'Latin', confidence: latin.confidence };
}

export function chooseResponseLanguage(userText, fallback = 'en') {
  const det = detectLanguage(userText);
  if (!det || det.code === 'und') return fallback;
  // fall back to en for very low confidence
  return det.confidence >= 0.4 ? det.code : (fallback || 'en');
}

export function languageNameFromCode(code) {
  return CODE_TO_NAME[(code || '').toLowerCase()] || 'Unknown';
}
