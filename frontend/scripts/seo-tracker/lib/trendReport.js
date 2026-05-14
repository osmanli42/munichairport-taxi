const { sparkline } = require('./util');
const history = require('./history');

function build(root) {
  const data = history.load(root);
  const entries = data.entries.slice(-30);
  if (!entries.length) return { empty: true, text: 'No history yet.' };

  const scores = entries.map(e => e.siteScore || 0);
  const lines = [];
  lines.push(`Site score (last ${entries.length}): ${sparkline(scores)}  ${scores[0]} → ${scores.at(-1)}`);
  // per-keyword
  const allKw = new Set();
  for (const e of entries) for (const k of Object.keys(e.ranks || {})) allKw.add(k);
  for (const kw of allKw) {
    const series = entries.map(e => e.ranks?.[kw]?.position).filter(v => typeof v === 'number');
    if (series.length < 2) continue;
    // invert so that better rank = higher bar
    const inv = series.map(v => 101 - v);
    lines.push(`${kw.padEnd(36)} ${sparkline(inv)}  ${series[0]} → ${series.at(-1)}`);
  }
  return { empty: false, text: lines.join('\n'), entries: entries.length };
}

module.exports = { build };
