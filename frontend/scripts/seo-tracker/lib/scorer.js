const { clamp } = require('./util');

// Per-page score 0-100.
function scorePage(p) {
  if (p.error) return { score: 0, breakdown: { error: p.error } };
  const b = {};
  // Title 15
  const titleOk = p.titleLen >= 30 && p.titleLen <= 65 ? 1 : 0.5;
  b.title = Math.round((p.title ? (titleOk * (p.titleKwHit ? 1 : 0.7)) : 0) * 15);
  // Meta 15
  const metaOk = p.metaLen >= 120 && p.metaLen <= 170 ? 1 : 0.5;
  b.meta = Math.round((p.metaDesc ? (metaOk * (p.metaKwHit ? 1 : 0.7)) : 0) * 15);
  // H1 10
  const h1Ok = p.h1Count === 1 ? 1 : (p.h1Count > 0 ? 0.5 : 0);
  b.h1 = Math.round(h1Ok * (p.h1KwHit ? 1 : 0.7) * 10);
  // Canonical 5
  b.canonical = p.canonical ? 5 : 0;
  // OG/Twitter 10
  b.social = (p.ogComplete ? 6 : (p.ogTags && Object.keys(p.ogTags).length ? 3 : 0)) + (p.twComplete ? 4 : 0);
  // Schema 10
  b.schema = Math.min(10, (p.schemaTypes?.length || 0) * 4);
  // hreflang 5
  b.hreflang = p.hreflangCount >= 2 ? 5 : (p.hreflangCount === 1 ? 2 : 0);
  // alt 5
  b.altRatio = Math.round((p.altRatio || 0) * 5);
  // perf 10
  b.perf = p.ms ? clamp(Math.round(10 - (p.ms - 800) / 200), 0, 10) : 0;
  // status 5
  b.status = p.status === 200 ? 5 : 0;
  // wordcount up to 10
  b.content = p.wordCount >= 600 ? 10 : (p.wordCount >= 300 ? 6 : (p.wordCount >= 150 ? 3 : 0));

  // Sum (max ~100; redistribute extras)
  const raw = Object.values(b).reduce((a, c) => a + c, 0);
  const score = clamp(Math.round(raw), 0, 100);
  return { score, breakdown: b };
}

function scoreSite(audit, rankSummary) {
  const pageScores = (audit.pages || []).map(p => ({ url: p.url, ...scorePage(p) }));
  const avgPage = pageScores.length ? Math.round(pageScores.reduce((a, c) => a + c.score, 0) / pageScores.length) : 0;
  // Rank bonus: avg position in top 10 of primary keywords
  let rankBonus = 0;
  if (rankSummary && rankSummary.keywords) {
    const positions = Object.values(rankSummary.keywords).map(v => v.position).filter(Boolean);
    if (positions.length) {
      const avg = positions.reduce((a, c) => a + c, 0) / positions.length;
      rankBonus = clamp(Math.round((101 - avg) / 10), 0, 10);
    }
  }
  const siteScore = clamp(Math.round(avgPage * 0.9 + rankBonus), 0, 100);
  return { siteScore, avgPage, rankBonus, pages: pageScores };
}

module.exports = { scorePage, scoreSite };
