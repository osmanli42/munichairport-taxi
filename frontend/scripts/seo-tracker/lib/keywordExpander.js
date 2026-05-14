const { withRetry } = require('./util');

async function autosuggest(query, hl = 'de') {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${hl}&q=${encodeURIComponent(query)}`;
  return withRetry(async () => {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`autosuggest ${res.status}`);
    const data = await res.json();
    return data[1] || [];
  });
}

async function expand(cfg) {
  const out = { ts: new Date().toISOString(), seed: cfg.keywords, suggestions: {} };
  for (const kw of cfg.keywords) {
    try {
      const s = await autosuggest(kw, cfg.language || 'de');
      out.suggestions[kw] = s;
    } catch (e) {
      out.suggestions[kw] = { error: e.message };
    }
  }
  // flat unique list, minus existing
  const have = new Set(cfg.keywords.map(k => k.toLowerCase()));
  const flat = [];
  for (const arr of Object.values(out.suggestions)) {
    if (Array.isArray(arr)) for (const s of arr) if (!have.has(s.toLowerCase())) flat.push(s);
  }
  out.newCandidates = Array.from(new Set(flat)).slice(0, 50);
  return out;
}

module.exports = { autosuggest, expand };
