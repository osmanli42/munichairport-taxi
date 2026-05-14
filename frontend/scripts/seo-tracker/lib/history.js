const path = require('path');
const { readJson, writeJson } = require('./util');

function snapshotPath(root) { return path.join(root, 'data', 'history.json'); }

function load(root) {
  return readJson(snapshotPath(root), { entries: [] });
}

function save(root, entry) {
  const data = load(root);
  data.entries.push(entry);
  // keep last 365
  if (data.entries.length > 365) data.entries = data.entries.slice(-365);
  writeJson(snapshotPath(root), data);
  return entry;
}

function lastEntry(root) {
  const d = load(root);
  return d.entries.length ? d.entries[d.entries.length - 1] : null;
}

function diff(prev, curr, thresholds = {}) {
  const events = [];
  if (!prev) return events;
  const scoreDrop = thresholds.scoreDrop || 5;
  const rankDrop = thresholds.rankDrop || 3;

  if (prev.siteScore != null && curr.siteScore != null && prev.siteScore - curr.siteScore >= scoreDrop) {
    events.push({ type: 'score_drop', from: prev.siteScore, to: curr.siteScore, delta: curr.siteScore - prev.siteScore });
  }
  const prevK = prev.ranks || {};
  const currK = curr.ranks || {};
  for (const kw of Object.keys(currK)) {
    const a = prevK[kw]?.position;
    const b = currK[kw]?.position;
    if (a && b && b - a >= rankDrop) events.push({ type: 'rank_drop', keyword: kw, from: a, to: b });
    if (a && a <= 10 && (!b || b > 10)) events.push({ type: 'fell_out_top10', keyword: kw, from: a, to: b || null });
    if (a && b && a - b >= rankDrop) events.push({ type: 'rank_gain', keyword: kw, from: a, to: b });
    if (b === 1 && a !== 1) events.push({ type: 'reached_number_one', keyword: kw, from: a, to: b });
  }
  // page status regression
  const prevPages = Object.fromEntries((prev.pages || []).map(p => [p.url, p]));
  for (const p of (curr.pages || [])) {
    const old = prevPages[p.url];
    if (old && old.status === 200 && p.status && p.status !== 200) {
      events.push({ type: 'page_status_regression', url: p.url, from: old.status, to: p.status });
    }
  }
  return events;
}

module.exports = { load, save, lastEntry, diff };
