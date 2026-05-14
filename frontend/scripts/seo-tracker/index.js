#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { loadConfig, log, color, ensureDir, todayISO } = require('./lib/util');
const onPage = require('./lib/onPageAudit');
const ranks = require('./lib/rankCheck');
const scorer = require('./lib/scorer');
const history = require('./lib/history');
const competitors = require('./lib/competitors');
const strategy = require('./lib/rankOneStrategy');
const keywordExp = require('./lib/keywordExpander');
const indexHealth = require('./lib/indexHealth');
const vitals = require('./lib/vitals');
const contentQ = require('./lib/contentQuality');
const trend = require('./lib/trendReport');
const deepseek = require('./lib/deepseek');
const autopilot = require('./lib/autopilot');
const alert = require('./lib/alert');

const ROOT = __dirname;

function header(msg) { console.log('\n' + color('bold', color('blue', `═══ ${msg} ═══`))); }

function buildSnapshot(audit, rankSummary, score) {
  return {
    ts: new Date().toISOString(),
    siteScore: score.siteScore,
    avgPage: score.avgPage,
    rankBonus: score.rankBonus,
    ranks: rankSummary?.keywords || {},
    pages: (audit.pages || []).map(p => ({ url: p.url, status: p.status, ms: p.ms, titleLen: p.titleLen, metaLen: p.metaLen })),
  };
}

function writeReport(snapshot, audit, rankSummary, score, extras = {}) {
  ensureDir(path.join(ROOT, 'data'));
  const file = path.join(ROOT, 'data', 'last-report.md');
  let md = `# SEO Report — ${todayISO()}\n\n`;
  md += `**Site score:** ${score.siteScore}/100  (page avg ${score.avgPage}, rank bonus ${score.rankBonus})\n\n`;
  md += `## Page scores\n\n| URL | Score | Status | ms | Title | Meta |\n|---|---|---|---|---|---|\n`;
  for (const p of score.pages) {
    const a = (audit.pages || []).find(x => x.url === p.url) || {};
    md += `| ${p.url} | ${p.score} | ${a.status || '-'} | ${a.ms || '-'} | ${a.titleLen || 0} | ${a.metaLen || 0} |\n`;
  }
  if (rankSummary) {
    md += `\n## Rank positions\n\n| Keyword | Position | URL |\n|---|---|---|\n`;
    for (const [kw, v] of Object.entries(rankSummary.keywords || {})) {
      md += `| ${kw} | ${v.position ?? (v.error ? 'ERR' : '>100')} | ${v.url || ''} |\n`;
    }
  }
  if (extras.trend) md += `\n## Trend\n\`\`\`\n${extras.trend}\n\`\`\`\n`;
  if (extras.regressions) md += `\n## Regressions vs last run\n\n${alert.formatEvents(extras.regressions)}\n`;
  fs.writeFileSync(file, md);
  return file;
}

function printSummary(score, rankSummary, regressions) {
  header('SEO SUMMARY');
  console.log(`Score: ${color('bold', score.siteScore)}/100  (pages ${score.avgPage}, rank+${score.rankBonus})`);
  for (const p of score.pages) {
    const c = p.score >= 80 ? 'green' : p.score >= 60 ? 'yellow' : 'red';
    console.log(`  ${color(c, String(p.score).padStart(3))}  ${p.url}`);
  }
  if (rankSummary) {
    console.log(color('cyan', '\nRanks:'));
    for (const [kw, v] of Object.entries(rankSummary.keywords || {})) {
      const pos = v.position;
      const cc = pos === 1 ? 'green' : pos && pos <= 10 ? 'yellow' : 'red';
      console.log(`  ${color(cc, (pos ? '#' + pos : (v.error ? 'ERR' : '>100')).padStart(5))}  ${kw}`);
    }
  }
  if (regressions && regressions.length) {
    console.log(color('red', '\nRegressions:'));
    for (const e of regressions) console.log('  - ' + JSON.stringify(e));
  }
}

async function cmdAudit(cfg) {
  header('ON-PAGE AUDIT');
  const audit = await onPage.auditAll(cfg);
  const score = scorer.scoreSite(audit, null);
  const file = writeReport(buildSnapshot(audit, null, score), audit, null, score);
  printSummary(score, null, []);
  log('ok', `Report: ${path.relative(ROOT, file)}`);
  return { audit, score };
}

async function cmdRank(cfg) {
  header('RANK CHECK');
  const r = await ranks.checkAll(cfg);
  for (const [kw, v] of Object.entries(r.keywords)) {
    console.log(`  ${(v.position ? '#' + v.position : v.error || '>100').padStart(8)}  ${kw}`);
  }
  return r;
}

async function cmdDeepsearch(cfg, audit) {
  header('DEEPSEARCH');
  audit = audit || await onPage.auditAll(cfg);
  log('step', 'competitor SERP map…');
  const cmap = await competitors.mapCompetitors(cfg);
  log('step', 'building rank-one strategy…');
  const plans = strategy.buildPlan(cfg, audit, cmap);
  const files = strategy.writePlanFiles(ROOT, plans);
  log('step', 'keyword expansion (Google Autosuggest)…');
  const expanded = await keywordExp.expand(cfg);
  log('step', 'content quality…');
  const cq = contentQ.analyzeAll(audit, cfg.keywords);
  log('step', 'index health…');
  const ih = await indexHealth.siteIndexed(cfg);
  let psi = null;
  if (cfg.pageSpeedApiKey || cfg.runVitals) {
    log('step', 'Core Web Vitals (PSI)…');
    try { psi = await vitals.checkAll(cfg); } catch (e) { log('warn', `PSI failed: ${e.message}`); }
  }

  const out = { ts: new Date().toISOString(), competitors: cmap, plans, keywordExpansion: expanded, contentQuality: cq, indexHealth: ih, vitals: psi };
  fs.writeFileSync(path.join(ROOT, 'data', `deepsearch-${todayISO()}.json`), JSON.stringify(out, null, 2));
  log('ok', `Generated ${files.length} strategy files in data/`);
  console.log('\nNew keyword candidates (top 15):');
  for (const k of (expanded.newCandidates || []).slice(0, 15)) console.log('  +', k);
  return out;
}

async function cmdWatch(cfg) {
  header('WATCH');
  const audit = await onPage.auditAll(cfg);
  const rankSummary = cfg.serpApiKey ? await ranks.checkAll(cfg) : null;
  const score = scorer.scoreSite(audit, rankSummary);
  const snap = buildSnapshot(audit, rankSummary, score);

  const prev = history.lastEntry(ROOT);
  const events = history.diff(prev, snap, cfg.thresholds);
  history.save(ROOT, snap);

  const trendTxt = trend.build(ROOT).text;
  writeReport(snap, audit, rankSummary, score, { trend: trendTxt, regressions: events });
  printSummary(score, rankSummary, events);

  // broken-link scan as autopilot context
  let brokenLinks = [];
  try { brokenLinks = await indexHealth.brokenLinks(cfg, audit); } catch (e) { log('warn', `broken-link scan failed: ${e.message}`); }

  const ap = await autopilot.run(ROOT, cfg, audit, { brokenLinks }, events);
  log('ok', `Autopilot: ${JSON.stringify(ap)}`);

  // Regression alert
  if (events.length > 0) {
    await alert.send(ROOT, cfg, {
      title: `⚠️ SEO Regression Detected`,
      body: alert.formatEvents(events),
    });
  }

  // Weekly digest on configured day (default: Sunday = 0)
  const today = new Date().getDay();
  if (today === (cfg.alerts?.weeklyDigestDay ?? 0)) {
    const scoreDelta = prev ? score.siteScore - (prev.siteScore || 0) : 0;
    const deltaStr = scoreDelta > 0 ? `+${scoreDelta}` : `${scoreDelta}`;
    const rankRows = rankSummary
      ? Object.entries(rankSummary.keywords).map(([kw, v]) => {
          const pos = v.position ? `#${v.position}` : '>100';
          const prev_pos = prev?.ranks?.[kw]?.position;
          const change = prev_pos && v.position ? prev_pos - v.position : 0;
          const arrow = change > 0 ? `↑${change}` : change < 0 ? `↓${Math.abs(change)}` : '→';
          return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${kw}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:bold">${pos}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;color:${change>0?'#16a34a':change<0?'#dc2626':'#6b7280'}">${arrow}</td></tr>`;
        }).join('')
      : '<tr><td colspan="3" style="padding:12px;color:#9ca3af">SerpAPI key gerekli</td></tr>';

    const pageRows = score.pages.slice(0, 6).map(p => {
      const url = p.url.replace('https://flughafen-muenchen.taxi', '') || '/';
      const c = p.score >= 80 ? '#16a34a' : p.score >= 60 ? '#d97706' : '#dc2626';
      return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:13px">${url}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:bold;color:${c}">${p.score}/100</td></tr>`;
    }).join('');

    const scoreColor = score.siteScore >= 80 ? '#16a34a' : score.siteScore >= 60 ? '#d97706' : '#dc2626';

    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px">
  <div style="background:#1e3a5f;color:white;padding:20px 24px;border-radius:12px 12px 0 0">
    <h2 style="margin:0;font-size:20px">📊 Haftalık SEO Raporu</h2>
    <p style="margin:4px 0 0;opacity:0.8;font-size:13px">flughafen-muenchen.taxi — ${new Date().toLocaleDateString('tr-TR')}</p>
  </div>
  <div style="background:white;padding:24px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="text-align:center;padding:20px 0;border-bottom:1px solid #eee;margin-bottom:20px">
      <div style="font-size:48px;font-weight:bold;color:${scoreColor}">${score.siteScore}</div>
      <div style="color:#6b7280;font-size:14px">Site Skoru / 100</div>
      <div style="font-size:14px;color:${scoreDelta>=0?'#16a34a':'#dc2626'};margin-top:4px">Geçen haftaya göre: ${deltaStr}</div>
    </div>
    <h3 style="color:#1e3a5f;margin:0 0 12px">🔍 Keyword Sıralamalar</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:8px 12px;text-align:left;font-size:13px;color:#6b7280">Keyword</th>
        <th style="padding:8px 12px;text-align:left;font-size:13px;color:#6b7280">Pozisyon</th>
        <th style="padding:8px 12px;text-align:left;font-size:13px;color:#6b7280">Değişim</th>
      </tr></thead>
      <tbody>${rankRows}</tbody>
    </table>
    <h3 style="color:#1e3a5f;margin:0 0 12px">📄 Sayfa Skorları</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:8px 12px;text-align:left;font-size:13px;color:#6b7280">Sayfa</th>
        <th style="padding:8px 12px;text-align:left;font-size:13px;color:#6b7280">Skor</th>
      </tr></thead>
      <tbody>${pageRows}</tbody>
    </table>
    <div style="background:#f3f4f6;padding:12px 16px;border-radius:8px;font-family:monospace;font-size:12px;white-space:pre-wrap">${trendTxt}</div>
    <p style="color:#9ca3af;font-size:12px;margin-top:16px;text-align:center">Flughafen-muenchen.taxi SEO Tracker • Her Pazar otomatik gönderilir</p>
  </div>
</div>`;

    await alert.sendHtml(ROOT, cfg, {
      title: `📊 Haftalık SEO Raporu — ${score.siteScore}/100`,
      body: `Site skoru: ${score.siteScore}/100 (${deltaStr} geçen haftaya göre)`,
      html,
    });
  }
}

async function cmdReport() {
  header('TREND REPORT');
  const t = trend.build(ROOT);
  console.log(t.text);
}

async function cmdDeepseek(cfg, args) {
  const sub = args[0];
  const audit = await onPage.auditAll(cfg);
  if (sub === 'rewrite') {
    const url = args[1];
    const page = (audit.pages || []).find(p => p.url === url) || (audit.pages || [])[0];
    if (!page) { log('err', 'no page'); return; }
    const r = await deepseek.rewriteTitleMeta(ROOT, cfg, page);
    console.log(JSON.stringify(r, null, 2));
  } else if (sub === 'improve') {
    const cmap = await competitors.mapCompetitors(cfg);
    const plans = strategy.buildPlan(cfg, audit, cmap);
    const r = await deepseek.suggestImprovements(ROOT, cfg, plans);
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log('Usage: deepseek rewrite <url> | deepseek improve');
  }
}

async function main() {
  const [, , cmd, ...args] = process.argv;
  let cfg;
  try { cfg = loadConfig(ROOT); }
  catch (e) { log('err', e.message); process.exit(2); }

  try {
    switch (cmd) {
      case 'audit':      await cmdAudit(cfg); break;
      case 'rank':       await cmdRank(cfg); break;
      case 'deepsearch': await cmdDeepsearch(cfg); break;
      case 'watch':      await cmdWatch(cfg); break;
      case 'report':     await cmdReport(); break;
      case 'deepseek':   await cmdDeepseek(cfg, args); break;
      case undefined:
      case '-h':
      case '--help':
      case 'help':
        console.log(`SEO Tracker — usage:
  node index.js audit          # on-page audit + score
  node index.js rank           # rank check (SerpAPI)
  node index.js deepsearch     # competitor + strategy + keyword expansion
  node index.js watch          # full cycle + diff + Telegram alert (cron)
  node index.js report         # trend sparkline
  node index.js deepseek rewrite <url>
  node index.js deepseek improve`);
        break;
      default: log('err', `Unknown command: ${cmd}`); process.exit(1);
    }
  } catch (e) {
    log('err', e.stack || e.message);
    process.exit(1);
  }
}

main();
