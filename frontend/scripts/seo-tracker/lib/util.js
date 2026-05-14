const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

function color(name, str) {
  if (!process.stdout.isTTY) return str;
  return (COLORS[name] || '') + str + COLORS.reset;
}

function log(level, msg) {
  const tag = {
    info: color('cyan', 'INFO '),
    ok:   color('green', 'OK   '),
    warn: color('yellow', 'WARN '),
    err:  color('red', 'ERR  '),
    step: color('magenta', 'STEP '),
  }[level] || 'LOG  ';
  console.log(`${tag} ${msg}`);
}

function loadConfig(root) {
  const p = path.join(root, 'config.json');
  if (!fs.existsSync(p)) {
    throw new Error(`config.json not found at ${p}. Run: cp config.example.json config.json and edit it.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function writeJson(p, data) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function sparkline(values) {
  if (!values || !values.length) return '';
  const ticks = '▁▂▃▄▅▆▇█';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map(v => ticks[Math.min(7, Math.floor(((v - min) / range) * 7))]).join('');
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function todayISO() { return new Date().toISOString().slice(0, 10); }

function nowISO() { return new Date().toISOString(); }

async function withRetry(fn, { tries = 3, delayMs = 800 } = {}) {
  let err;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { err = e; await new Promise(r => setTimeout(r, delayMs * (i + 1))); }
  }
  throw err;
}

module.exports = { color, log, loadConfig, ensureDir, readJson, writeJson, sparkline, clamp, todayISO, nowISO, withRetry };
