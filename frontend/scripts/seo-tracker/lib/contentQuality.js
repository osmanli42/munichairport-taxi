// Flesch-Amstad readability for German text + density + heading hierarchy.

function tokenize(text) {
  return text.toLowerCase().split(/[^a-zäöüß0-9]+/i).filter(w => w.length > 1);
}

function syllables(word) {
  // crude German syllable estimate
  const v = word.toLowerCase().match(/[aeiouäöüy]+/g);
  return Math.max(1, v ? v.length : 1);
}

function fleschAmstad(text) {
  const sentences = (text.match(/[.!?]+/g) || []).length || 1;
  const words = tokenize(text);
  if (!words.length) return null;
  const totalSyll = words.reduce((a, w) => a + syllables(w), 0);
  const ASL = words.length / sentences;
  const ASW = totalSyll / words.length;
  return Math.round(180 - ASL - 58.5 * ASW);
}

function density(text, keyword) {
  const words = tokenize(text);
  if (!words.length) return 0;
  const kw = keyword.toLowerCase();
  const hits = (text.toLowerCase().match(new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length;
  return Math.round((hits / words.length) * 10000) / 100; // %
}

function analyzePage(p, keywords = []) {
  const text = p.bodyText || `${(p.title || '')} ${(p.h1s || []).join(' ')} ${(p.h2s || []).join(' ')} ${(p.metaDesc || '')}`;
  return {
    url: p.url,
    wordCount: p.wordCount,
    readability: fleschAmstad(text),
    densityByKeyword: Object.fromEntries(keywords.map(k => [k, density(text, k)])),
    headingHierarchy: {
      h1: p.h1Count,
      h2: p.h2Count,
      h3: p.h3Count,
      issues: hierarchyIssues(p),
    },
  };
}

function hierarchyIssues(p) {
  const issues = [];
  if (p.h1Count === 0) issues.push('No H1');
  if (p.h1Count > 1) issues.push(`${p.h1Count} H1s (should be 1)`);
  if (p.h2Count === 0 && p.wordCount > 300) issues.push('No H2 in long content');
  if (p.h3Count > 0 && p.h2Count === 0) issues.push('H3 without H2');
  return issues;
}

function analyzeAll(audit, keywords) {
  return (audit.pages || []).filter(p => !p.error).map(p => analyzePage(p, keywords));
}

module.exports = { fleschAmstad, density, analyzePage, analyzeAll };
