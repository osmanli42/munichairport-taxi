const fs = require('fs');
const path = require('path');
const { ensureDir, todayISO, log } = require('./util');
const fixers = require('./fixers');
const alert = require('./alert');

function detectAll(audit, ctx = {}) {
  const issues = [];
  for (const f of fixers.all) {
    try {
      const found = f.detect(audit, ctx) || [];
      for (const i of found) issues.push({ fixer: f.name, ...i });
    } catch (e) {
      log('warn', `fixer ${f.name} detect failed: ${e.message}`);
    }
  }
  return issues;
}

function proposeFor(issues) {
  const proposals = [];
  for (const issue of issues) {
    const fixer = fixers.all.find(f => f.name === issue.fixer);
    if (!fixer) continue;
    try { proposals.push({ fixer: fixer.name, issue, proposal: fixer.propose(issue) }); }
    catch (e) { log('warn', `fixer ${fixer.name} propose failed: ${e.message}`); }
  }
  return proposals;
}

function writeProposals(root, proposals) {
  const dir = path.join(root, 'data');
  ensureDir(dir);
  const file = path.join(dir, `autopilot-${todayISO()}.md`);
  let md = `# Autopilot Proposals — ${todayISO()}\n\n`;
  if (!proposals.length) {
    md += '_No issues detected._\n';
  } else {
    md += `Total: ${proposals.length} issues.\n\n`;
    for (const { fixer, issue, proposal } of proposals) {
      md += `## ${fixer} — ${issue.kind}\n`;
      md += `- URL: ${issue.url}\n`;
      md += `- Reason: ${proposal.reason}\n`;
      md += `- Action: ${proposal.action}\n`;
      if (proposal.patch) md += '```\n' + proposal.patch + '\n```\n';
      md += '\n';
    }
  }
  fs.writeFileSync(file, md);
  return file;
}

async function run(root, cfg, audit, ctx, regressionEvents) {
  if (!cfg.autopilot?.enabled) return { skipped: 'autopilot_disabled' };
  if (!regressionEvents.length) {
    log('info', 'No regressions — autopilot idle.');
    return { idle: true };
  }

  // Step 1: immediate alert
  await alert.send(root, cfg, {
    title: '📉 SEO Regression Detected',
    body: alert.formatEvents(regressionEvents) + '\n\n_Running autopilot…_',
  });

  // Step 2: detect + propose
  const issues = detectAll(audit, ctx);
  const proposals = proposeFor(issues);
  const file = writeProposals(root, proposals);

  // Step 3: send proposal summary
  const summary = proposals.length
    ? proposals.slice(0, 10).map(p => `• ${p.fixer}: ${p.issue.url}`).join('\n')
    : '_No auto-fixable issues found._';
  await alert.send(root, cfg, {
    title: `🔧 Autopilot Proposals (${proposals.length})`,
    body: `${summary}\n\nFull file: \`${path.relative(root, file)}\``,
  });

  return { issues: issues.length, proposals: proposals.length, file };
}

module.exports = { detectAll, proposeFor, writeProposals, run };
