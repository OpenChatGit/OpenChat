// Web Search tool utilities
// - performWebSearch: wraps Tauri backend invocation for web search
// - performWebSearchFastAPI: calls FastAPI /tools/langsearch and maps results
// - formatWebResultsForPrompt: formats results into a prompt-friendly block

export async function performWebSearch(invoke, query, max = 5) {
  try {
    const res = await invoke('web_search', { query, max_results: max });
    if (!Array.isArray(res)) return [];
    return res;
  } catch (e) {
    console.warn('Web search failed:', e);
    return [];
  }
}

// Factory to create a bound performWebSearch(query, max) using a provided invoke
export function makeWebSearchTool(invoke) {
  return async function(query, max = 5) {
    return performWebSearch(invoke, query, max);
  };
}

// Helper to normalize LangSearch responses (various shapes supported)
function projectLangSearchResults(payload, max = 5) {
  try {
    if (!payload || typeof payload !== 'object') return [];
    // FastAPI proxy returns { ok: true, data: <providerJson> }
    const provider = payload.data || payload;
    const dataBlock = (provider && typeof provider.data === 'object') ? provider.data : null;
    const list = [];

    // Prefer data.webPages.value[*]
    let webPages = null;
    if (dataBlock && typeof dataBlock === 'object') {
      const wp = dataBlock.webPages;
      if (wp && typeof wp === 'object' && Array.isArray(wp.value)) {
        webPages = wp.value;
      }
    }
    if (Array.isArray(webPages) && webPages.length) {
      for (const item of webPages.slice(0, max)) {
        list.push({
          title: item.name || item.title || 'Untitled',
          url: item.url || item.link || '',
          snippet: item.summary || item.snippet || item.content || ''
        });
      }
      if (list.length) return list;
    }

    // Fallbacks: top-level or dataBlock.results
    const results = (Array.isArray(provider.results) ? provider.results : null)
      || (dataBlock && Array.isArray(dataBlock.results) ? dataBlock.results : null)
      || [];
    for (const item of results.slice(0, max)) {
      list.push({
        title: item.title || item.name || 'Untitled',
        url: item.url || item.link || '',
        snippet: item.snippet || item.content || ''
      });
    }
    return list;
  } catch {
    return [];
  }
}

// FastAPI-based search
export async function performWebSearchFastAPI(fastapiUrl, query, max = 5, freshness = 'noLimit', summary = true) {
  try {
    const res = await fetch(`${fastapiUrl}/tools/langsearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, freshness, summary, count: max })
    });
    if (!res.ok) {
      console.warn('FastAPI web search failed with status', res.status);
      return [];
    }
    const json = await res.json();
    const items = projectLangSearchResults(json, max);
    return Array.isArray(items) ? items : [];
  } catch (e) {
    console.warn('Web search (FastAPI) failed:', e);
    return [];
  }
}

// Factory for FastAPI-based performWebSearch
export function makeWebSearchToolFromFastAPI(fastapiUrl) {
  return async function(query, max = 5) {
    return performWebSearchFastAPI(fastapiUrl, query, max);
  };
}

// --- Formatting helpers to guide models to interpret (not dump) web results ---

function domainWeight(u) {
  try {
    const host = new URL(u).hostname.replace(/^www\./, '');
    const weights = {
      'timeanddate.com': 3,
      'time.is': 3,
      'worldtimeapi.org': 2,
      'wikipedia.org': 2,
      'britannica.com': 2,
      'gov': 3,
      'edu': 3
    };
    // exact domain match
    if (weights[host] != null) return weights[host];
    // TLD-based boost
    if (host.endsWith('.gov')) return weights['gov'];
    if (host.endsWith('.edu')) return weights['edu'];
    return 1;
  } catch { return 1; }
}

function normalizeText(s, maxLen = 220) {
  if (!s) return '';
  let t = String(s).replace(/\s+/g, ' ').trim();
  if (t.length > maxLen) t = t.slice(0, maxLen - 1) + '…';
  return t;
}

function dedupeByUrl(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = it.url || '';
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

function rankAndTrimResults(results, maxItems = 3, maxSnippet = 220) {
  if (!Array.isArray(results)) return [];
  const enriched = results.map((r, i) => ({
    idx: i,
    title: normalizeText(r.title || 'Untitled', 120),
    url: r.url || '',
    snippet: normalizeText(r.snippet || '', maxSnippet),
    w: domainWeight(r.url || '')
  }));
  const deduped = dedupeByUrl(enriched);
  deduped.sort((a, b) => b.w - a.w || a.idx - b.idx);
  return deduped.slice(0, maxItems);
}

export function formatWebResultsForPrompt(results) {
  if (!results || !results.length) return '';
  const top = rankAndTrimResults(results, 3, 240);
  if (!top.length) return '';
  const lines = top.map((r, i) => `  [${i + 1}] [${r.title}](${r.url})\n      ${r.snippet}`);
  return `\n\n[Web Search Context]\n- Interpret and synthesize only what is relevant to the user's question.\n- Write strictly in the user's language; do not mix languages because sources are in another language. If quoting, translate briefly and indicate the source with [n].\n- For relative time terms (today, now, date, weekday), resolve using the [User Context] time, and use sources only to confirm definitions or rules.\n- Do NOT paste long quotes or full snippets; be concise.\n- Use bracketed citations [n] immediately after claims they support.\n- Citations must correspond to entries in the Sources section; do not leave dangling [n].\n- Output structure:\n  1) Final answer in 2–4 sentences (no preamble).\n  2) Optional short bullets for key facts.\n  3) Sources section listing the cited links.\n\n[SOURCES]\n${lines.join('\n\n')}\n`;
}
