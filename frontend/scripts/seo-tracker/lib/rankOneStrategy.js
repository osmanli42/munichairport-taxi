const fs = require('fs');
const path = require('path');
const { ensureDir, todayISO } = require('./util');

function gapTable(ours, theirs) {
  const rows = [];
  const add = (k, them, us, action) => rows.push({ criterion: k, competitor: them, us, action });
  if (!ours || !theirs) return rows;
  add('Word count', theirs.wordCount, ours.wordCount,
    theirs.wordCount > ours.wordCount + 200 ? `Expand content by ~${theirs.wordCount - ours.wordCount} words` : 'OK');
  add('H2 count', theirs.h2s?.length || 0, ours.h2Count,
    (theirs.h2s?.length || 0) > ours.h2Count ? `Add ${(theirs.h2s.length - ours.h2Count)} H2 sections` : 'OK');
  add('Schema types', (theirs.schemaTypes || []).join(','), (ours.schemaTypes || []).join(','),
    diffArr(theirs.schemaTypes, ours.schemaTypes).length ? `Add schemas: ${diffArr(theirs.schemaTypes, ours.schemaTypes).join(', ')}` : 'OK');
  add('Title length', theirs.titleLen, ours.titleLen,
    Math.abs(theirs.titleLen - 55) < Math.abs(ours.titleLen - 55) ? 'Tune title length toward 55 chars' : 'OK');
  add('Meta length', theirs.metaLen, ours.metaLen,
    Math.abs(theirs.metaLen - 155) < Math.abs(ours.metaLen - 155) ? 'Tune meta length toward 155 chars' : 'OK');
  add('Page speed (ms)', theirs.ms, ours.ms,
    (ours.ms || 0) > (theirs.ms || 0) + 300 ? 'Optimize images / reduce JS bundle' : 'OK');
  return rows;
}

function diffArr(a, b) {
  const sb = new Set(b || []);
  return (a || []).filter(x => !sb.has(x));
}

function chooseBestOurPage(cfg, audit, keyword) {
  // pick page whose title/h1 best matches keyword
  const kw = keyword.toLowerCase();
  let best = null, bestScore = -1;
  for (const p of (audit.pages || [])) {
    if (p.error) continue;
    let s = 0;
    if ((p.title || '').toLowerCase().includes(kw)) s += 3;
    if ((p.h1s || []).some(h => h.toLowerCase().includes(kw))) s += 2;
    if ((p.metaDesc || '').toLowerCase().includes(kw)) s += 1;
    if (s > bestScore) { bestScore = s; best = p; }
  }
  return best || (audit.pages || [])[0];
}

function buildPlan(cfg, audit, competitorMap) {
  const plans = [];
  for (const kw of cfg.primaryKeywords || []) {
    const cinfo = competitorMap.keywords[kw];
    if (!cinfo || cinfo.error || !cinfo.rankOne) {
      plans.push({ keyword: kw, error: cinfo?.error || 'no rank-one data' });
      continue;
    }
    const ours = chooseBestOurPage(cfg, audit, kw);
    const gaps = gapTable(ours, cinfo.rankOne);
    const suggestedH2s = (cinfo.rankOne.h2s || []).filter(h => h.length > 5).slice(0, 12);
    const peopleAlsoAsk = (cinfo.relatedQuestions || []).map(q => q.question).filter(Boolean);

    plans.push({
      keyword: kw,
      ourUrl: ours?.url,
      ourRank: null,
      competitorUrl: cinfo.rankOne.url,
      gaps,
      suggestedH2s,
      peopleAlsoAsk,
      backlinkTargets: [
        'Munich tourism portals (muenchen.de partner pages)',
        'Hotel concierge / partner listings near MUC',
        'Local event organizer sites (Oktoberfest, ISPO, IAA partners)',
        'Travel directories: Tripadvisor, Trustpilot category pages',
        'German taxi directories: taxi.de, taxi-deutschland.net',
      ],
      estimatedImpact: gaps.filter(g => g.action !== 'OK').length >= 3 ? 'High (3+ gaps closable)' : 'Medium',
    });
  }
  return plans;
}

function writePlanFiles(root, plans) {
  const dir = path.join(root, 'data');
  ensureDir(dir);
  const written = [];
  for (const p of plans) {
    if (p.error) continue;
    const slug = p.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const file = path.join(dir, `rank-one-plan-${slug}.md`);
    fs.writeFileSync(file, renderPlanMd(p));
    written.push(file);
  }
  const summary = path.join(dir, `rank-one-summary-${todayISO()}.md`);
  fs.writeFileSync(summary, renderSummary(plans));
  written.push(summary);
  return written;
}

function renderPlanMd(p) {
  let md = `# Rank-One Strategy: "${p.keyword}"\n\n`;
  md += `**Our page:** ${p.ourUrl || 'n/a'}\n`;
  md += `**Current #1 competitor:** ${p.competitorUrl}\n\n`;
  md += `## Gap Analysis\n\n| Criterion | Competitor #1 | Us | Action |\n|---|---|---|---|\n`;
  for (const g of p.gaps) md += `| ${g.criterion} | ${g.competitor} | ${g.us} | ${g.action} |\n`;
  md += `\n## Suggested H2 Sections (from #1 competitor — rewrite, don't copy)\n\n`;
  for (const h of p.suggestedH2s) md += `- ${h}\n`;
  md += `\n## People Also Ask (cover these as FAQ)\n\n`;
  for (const q of p.peopleAlsoAsk) md += `- ${q}\n`;
  md += `\n## Backlink Opportunity Targets\n\n`;
  for (const b of p.backlinkTargets) md += `- ${b}\n`;
  md += `\n**Estimated impact:** ${p.estimatedImpact}\n`;
  return md;
}

function renderSummary(plans) {
  let md = `# Rank-One Summary (${new Date().toISOString().slice(0,10)})\n\n`;
  for (const p of plans) {
    if (p.error) { md += `## ${p.keyword}\n- error: ${p.error}\n\n`; continue; }
    md += `## ${p.keyword}\n`;
    md += `- competitor #1: ${p.competitorUrl}\n`;
    md += `- gaps: ${p.gaps.filter(g => g.action !== 'OK').length}\n`;
    md += `- impact: ${p.estimatedImpact}\n\n`;
  }
  return md;
}

module.exports = { buildPlan, writePlanFiles };
