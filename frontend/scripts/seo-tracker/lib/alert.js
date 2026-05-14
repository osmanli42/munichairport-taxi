const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { ensureDir, nowISO, log } = require('./util');

async function telegramSend(token, chatId, text) {
  if (!token || !chatId) return { skipped: true };
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Telegram ${res.status}: ${errBody}`);
  }
  return res.json();
}

function macNotify(title, body) {
  if (process.platform !== 'darwin') return;
  const safe = (s) => String(s).replace(/"/g, '\\"');
  exec(`osascript -e 'display notification "${safe(body)}" with title "${safe(title)}"'`);
}

function logToFile(root, msg) {
  const dir = path.join(root, 'data');
  ensureDir(dir);
  fs.appendFileSync(path.join(dir, 'alerts.log'), `[${nowISO()}] ${msg}\n`);
}

async function emailSend(resendApiKey, to, from, subject, html) {
  if (!resendApiKey || !to) return { skipped: true };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${resendApiKey}` },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend ${res.status}: ${errBody}`);
  }
  return res.json();
}

async function send(root, cfg, { title, body }) {
  const a = cfg.alerts || {};
  const text = `*${title}*\n${body}`;
  if (a.logFile !== false) logToFile(root, `${title} :: ${body.replace(/\n/g, ' | ')}`);
  if (a.macNotify) macNotify(title, body.split('\n')[0]);
  if (a.telegram && a.telegram.enabled) {
    try {
      await telegramSend(a.telegram.botToken, a.telegram.chatId, text);
      log('ok', 'Telegram alert sent');
    } catch (e) {
      log('err', `Telegram send failed: ${e.message}`);
    }
  }
  if (a.email && a.email.enabled) {
    try {
      const html = `<h2>${title}</h2><pre style="font-family:monospace;background:#f4f4f4;padding:12px;border-radius:6px">${body.replace(/</g,'&lt;')}</pre>`;
      await emailSend(a.email.resendApiKey, a.email.to, a.email.from || 'seo@flughafen-muenchen.taxi', title, html);
      log('ok', `Email alert sent to ${a.email.to}`);
    } catch (e) {
      log('err', `Email send failed: ${e.message}`);
    }
  }
}

function formatEvents(events) {
  if (!events.length) return '_No regressions detected._';
  return events.map(e => {
    switch (e.type) {
      case 'score_drop':           return `📉 Site score: ${e.from} → ${e.to} (${e.delta})`;
      case 'rank_drop':            return `📉 \`${e.keyword}\` rank ${e.from} → ${e.to}`;
      case 'fell_out_top10':       return `⚠️ \`${e.keyword}\` fell out of Top 10 (was ${e.from}, now ${e.to || 'unranked'})`;
      case 'rank_gain':            return `📈 \`${e.keyword}\` rank ${e.from} → ${e.to}`;
      case 'reached_number_one':   return `🥇 \`${e.keyword}\` reached #1!`;
      case 'page_status_regression': return `🚨 ${e.url} ${e.from} → ${e.to}`;
      default: return `• ${JSON.stringify(e)}`;
    }
  }).join('\n');
}

async function sendHtml(root, cfg, { title, body, html }) {
  const a = cfg.alerts || {};
  if (a.logFile !== false) logToFile(root, `${title} :: ${body}`);
  if (a.email && a.email.enabled) {
    try {
      await emailSend(a.email.resendApiKey, a.email.to, a.email.from || 'seo@flughafen-muenchen.taxi', title, html);
      log('ok', `Weekly digest email sent to ${a.email.to}`);
    } catch (e) {
      log('err', `Weekly digest email failed: ${e.message}`);
    }
  }
}

module.exports = { send, sendHtml, telegramSend, macNotify, logToFile, formatEvents };
