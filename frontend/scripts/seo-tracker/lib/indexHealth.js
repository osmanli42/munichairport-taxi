const { fetchSerp } = require('./rankCheck');
const { fetchPage } = require('./onPageAudit');

async function siteIndexed(cfg) {
  if (!cfg.serpApiKey) return { error: 'no_serpapi_key' };
  const host = cfg.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const serp = await fetchSerp(`site:${host}`, cfg);
  return { host, organicCount: (serp.organic || []).length, firstResults: (serp.organic || []).slice(0, 10).map(r => r.link) };
}

async function brokenLinks(cfg, audit) {
  const checked = new Set();
  const broken = [];
  for (const p of (audit.pages || [])) {
    for (const link of (p.internalLinkList || [])) {
      if (checked.has(link)) continue;
      checked.add(link);
      try {
        const r = await fetch(link, { method: 'HEAD', redirect: 'follow' });
        if (r.status >= 400) broken.push({ url: link, status: r.status, from: p.url });
      } catch (e) {
        broken.push({ url: link, error: e.message, from: p.url });
      }
    }
  }
  return broken;
}

function sitemapDiff(audit) {
  const sitemapUrls = new Set((audit.sitemap?.urls || []).map(normalize));
  const auditedUrls = new Set((audit.pages || []).map(p => normalize(p.url)));
  const inSitemapNotAudited = [...sitemapUrls].filter(u => !auditedUrls.has(u));
  const auditedNotInSitemap = [...auditedUrls].filter(u => !sitemapUrls.has(u));
  return { sitemapCount: sitemapUrls.size, auditedNotInSitemap, inSitemapNotAudited: inSitemapNotAudited.slice(0, 20) };
}

function normalize(u) {
  try { const x = new URL(u); return x.origin + x.pathname.replace(/\/$/, ''); }
  catch { return u; }
}

module.exports = { siteIndexed, brokenLinks, sitemapDiff };
