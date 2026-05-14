const cheerio = require('cheerio');

async function fetchPage(url) {
  const start = Date.now();
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'SEOTrackerBot/1.0' } });
  const text = await res.text();
  return { status: res.status, ms: Date.now() - start, html: text, finalUrl: res.url, headers: Object.fromEntries(res.headers) };
}

function auditHtml(html, url, keywords = []) {
  const $ = cheerio.load(html);
  const title = $('head title').first().text().trim();
  const metaDesc = $('head meta[name="description"]').attr('content') || '';
  const canonical = $('head link[rel="canonical"]').attr('href') || '';
  const robots = $('head meta[name="robots"]').attr('content') || '';
  const ogTags = {};
  $('head meta[property^="og:"]').each((_, el) => { ogTags[$(el).attr('property')] = $(el).attr('content'); });
  const twTags = {};
  $('head meta[name^="twitter:"]').each((_, el) => { twTags[$(el).attr('name')] = $(el).attr('content'); });
  const h1s = $('h1').map((_, el) => $(el).text().trim()).get();
  const h2s = $('h2').map((_, el) => $(el).text().trim()).get();
  const h3s = $('h3').map((_, el) => $(el).text().trim()).get();
  const imgs = $('img').map((_, el) => ({ src: $(el).attr('src') || '', alt: $(el).attr('alt') })).get();
  const imgsWithAlt = imgs.filter(i => i.alt && i.alt.trim()).length;
  const hreflangs = $('head link[rel="alternate"][hreflang]').map((_, el) => ({ hreflang: $(el).attr('hreflang'), href: $(el).attr('href') })).get();
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { jsonLd.push(JSON.parse($(el).html())); } catch (e) { jsonLd.push({ __parseError: e.message }); }
  });
  const internalLinks = [];
  const externalLinks = [];
  const host = new URL(url).host;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      const u = new URL(href, url);
      if (u.host === host) internalLinks.push(u.href);
      else externalLinks.push(u.href);
    } catch {}
  });
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(' ').filter(Boolean).length;

  const titleKwHit = keywords.some(k => title.toLowerCase().includes(k.toLowerCase()));
  const h1KwHit = h1s.some(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));
  const metaKwHit = keywords.some(k => metaDesc.toLowerCase().includes(k.toLowerCase()));

  return {
    url,
    title, titleLen: title.length, titleKwHit,
    metaDesc, metaLen: metaDesc.length, metaKwHit,
    canonical, robots,
    ogTags, ogComplete: !!(ogTags['og:title'] && ogTags['og:description'] && ogTags['og:image']),
    twTags, twComplete: !!(twTags['twitter:card'] && twTags['twitter:title']),
    h1s, h1Count: h1s.length, h1KwHit,
    h2s, h2Count: h2s.length,
    h3s, h3Count: h3s.length,
    imgs: imgs.length, imgsWithAlt, altRatio: imgs.length ? imgsWithAlt / imgs.length : 1,
    hreflangs, hreflangCount: hreflangs.length,
    jsonLd, schemaTypes: jsonLd.map(j => j['@type']).filter(Boolean),
    internalLinks: internalLinks.length, externalLinks: externalLinks.length,
    wordCount,
    internalLinkList: internalLinks,
  };
}

async function auditUrl(url, keywords) {
  try {
    const r = await fetchPage(url);
    if (r.status >= 400) return { url, status: r.status, ms: r.ms, error: `HTTP ${r.status}` };
    const a = auditHtml(r.html, r.finalUrl || url, keywords);
    return { ...a, status: r.status, ms: r.ms };
  } catch (e) {
    return { url, error: e.message };
  }
}

async function auditAll(cfg) {
  const out = { ts: new Date().toISOString(), pages: [] };
  for (const path of cfg.urls) {
    const url = cfg.domain.replace(/\/$/, '') + path;
    out.pages.push(await auditUrl(url, cfg.keywords || []));
  }
  // robots + sitemap
  try {
    const robots = await fetchPage(cfg.domain.replace(/\/$/, '') + '/robots.txt');
    out.robots = { status: robots.status, hasSitemap: /sitemap:/i.test(robots.html) };
  } catch (e) { out.robots = { error: e.message }; }
  try {
    const sm = await fetchPage(cfg.domain.replace(/\/$/, '') + '/sitemap.xml');
    const urls = (sm.html.match(/<loc>([^<]+)<\/loc>/g) || []).map(s => s.replace(/<\/?loc>/g, ''));
    out.sitemap = { status: sm.status, urlCount: urls.length, urls };
  } catch (e) { out.sitemap = { error: e.message }; }
  return out;
}

module.exports = { fetchPage, auditHtml, auditUrl, auditAll };
