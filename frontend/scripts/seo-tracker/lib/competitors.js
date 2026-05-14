const { fetchSerp } = require('./rankCheck');
const { fetchPage, auditHtml } = require('./onPageAudit');
const { log } = require('./util');

async function analyzeCompetitorPage(url, keywords) {
  try {
    const r = await fetchPage(url);
    if (r.status >= 400) return { url, error: `HTTP ${r.status}` };
    const a = auditHtml(r.html, r.finalUrl || url, keywords);
    return {
      url,
      title: a.title,
      titleLen: a.titleLen,
      metaDesc: a.metaDesc,
      metaLen: a.metaLen,
      h1: a.h1s[0] || null,
      h2s: a.h2s,
      h3s: a.h3s,
      schemaTypes: a.schemaTypes,
      wordCount: a.wordCount,
      internalLinks: a.internalLinks,
      externalLinks: a.externalLinks,
      ms: r.ms,
    };
  } catch (e) {
    return { url, error: e.message };
  }
}

// For each primary keyword: SERP top 10, deep analyze rank-1 URL.
async function mapCompetitors(cfg) {
  const out = { ts: new Date().toISOString(), keywords: {} };
  for (const kw of cfg.primaryKeywords || []) {
    log('step', `competitor SERP: "${kw}"`);
    try {
      const serp = await fetchSerp(kw, cfg);
      if (serp.error) { out.keywords[kw] = { error: serp.error }; continue; }
      const top10 = serp.organic.slice(0, 10).map(r => ({ position: r.position, link: r.link, title: r.title, snippet: r.snippet }));
      const rankOne = top10[0];
      const deep = rankOne ? await analyzeCompetitorPage(rankOne.link, [kw]) : null;
      out.keywords[kw] = { top10, rankOne: deep, relatedQuestions: serp.related_questions, relatedSearches: serp.related_searches };
    } catch (e) {
      out.keywords[kw] = { error: e.message };
    }
  }
  return out;
}

// Compute simple TF over titles+metas of competitors to find common terms.
function commonTerms(top10List) {
  const stop = new Set(['the','a','an','und','der','die','das','to','for','von','in','at','of','on','mit','und','&','-','|','taxi']);
  const counts = {};
  for (const r of top10List) {
    const text = `${r.title || ''} ${r.snippet || ''}`.toLowerCase();
    for (const w of text.split(/[^a-zäöüß0-9]+/i)) {
      if (!w || w.length < 4 || stop.has(w)) continue;
      counts[w] = (counts[w] || 0) + 1;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 25);
}

module.exports = { mapCompetitors, analyzeCompetitorPage, commonTerms };
