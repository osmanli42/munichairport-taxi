const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ensureDir, readJson, writeJson, log } = require('./util');

const CACHE_FILE = (root) => path.join(root, 'data', 'deepseek-cache.json');

function hashKey(prompt) {
  return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

function getCache(root) { return readJson(CACHE_FILE(root), {}); }
function setCache(root, key, val) {
  const c = getCache(root);
  c[key] = { ts: Date.now(), val };
  writeJson(CACHE_FILE(root), c);
}

async function chat(root, cfg, system, user) {
  if (!cfg.deepseekApiKey) return { skipped: 'no_deepseek_key' };
  const prompt = `${system}\n\n---\n\n${user}`;
  const key = hashKey(prompt);
  const cache = getCache(root);
  if (cache[key]) return { cached: true, ...cache[key].val };

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.deepseekApiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.5,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return { error: `DeepSeek ${res.status}: ${errBody.slice(0, 200)}` };
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const val = { content, usage: data.usage };
    setCache(root, key, val);
    return val;
  } catch (e) {
    return { error: e.message };
  }
}

async function rewriteTitleMeta(root, cfg, page) {
  return chat(root, cfg,
    'You are an SEO expert specializing in German and English markets for premium taxi/limousine services. Output JSON only.',
    `Rewrite the title and meta description for this page. Constraints: title 50-60 chars, meta 140-160 chars. Provide both DE and EN.

URL: ${page.url}
Current title: ${page.title}
Current meta: ${page.metaDesc}
Current H1: ${(page.h1s || [])[0] || ''}
Target keywords: ${(cfg.primaryKeywords || []).slice(0, 4).join(', ')}

Respond as JSON: {"de":{"title":"","meta":""},"en":{"title":"","meta":""}}`);
}

async function suggestImprovements(root, cfg, gapPlan) {
  return chat(root, cfg,
    'You are an SEO strategist. Be concise, actionable, bullet-pointed.',
    `Given this gap analysis, produce a 10-point action plan to outrank competitor #1.

${JSON.stringify(gapPlan, null, 2)}`);
}

module.exports = { chat, rewriteTitleMeta, suggestImprovements };
