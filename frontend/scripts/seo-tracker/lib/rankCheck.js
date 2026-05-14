const { log, withRetry } = require('./util');

async function fetchSerp(query, cfg) {
  if (!cfg.serpApiKey) {
    return { error: 'no_serpapi_key', query, results: [] };
  }
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    google_domain: cfg.googleDomain || 'google.de',
    gl: cfg.geo || 'de',
    hl: cfg.language || 'de',
    num: '100',
    api_key: cfg.serpApiKey,
  });
  const url = `https://serpapi.com/search.json?${params}`;
  return withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SerpAPI ${res.status}`);
    const data = await res.json();
    return {
      query,
      organic: data.organic_results || [],
      related_questions: data.related_questions || [],
      related_searches: data.related_searches || [],
    };
  });
}

function findPosition(organic, domain) {
  const host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
  for (const r of organic) {
    const link = (r.link || '').toLowerCase();
    if (link.includes(host)) return { position: r.position, url: r.link, title: r.title, snippet: r.snippet };
  }
  return null;
}

async function checkAll(cfg) {
  const out = { ts: new Date().toISOString(), keywords: {}, top10: {} };
  for (const kw of cfg.keywords) {
    log('step', `rank: "${kw}"`);
    try {
      const serp = await fetchSerp(kw, cfg);
      if (serp.error) {
        out.keywords[kw] = { error: serp.error };
        continue;
      }
      const pos = findPosition(serp.organic, cfg.domain);
      out.keywords[kw] = pos ? { position: pos.position, url: pos.url } : { position: null, notFound: true };
      out.top10[kw] = serp.organic.slice(0, 10).map(r => ({ position: r.position, link: r.link, title: r.title }));
    } catch (e) {
      out.keywords[kw] = { error: e.message };
    }
  }
  return out;
}

module.exports = { fetchSerp, findPosition, checkAll };
