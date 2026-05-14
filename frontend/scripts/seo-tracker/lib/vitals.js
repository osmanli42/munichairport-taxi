const { withRetry } = require('./util');

async function pageSpeed(url, strategy, apiKey) {
  const params = new URLSearchParams({ url, strategy });
  if (apiKey) params.set('key', apiKey);
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
  return withRetry(async () => {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`PageSpeed ${res.status}`);
    const data = await res.json();
    const audits = data.lighthouseResult?.audits || {};
    return {
      url,
      strategy,
      performance: data.lighthouseResult?.categories?.performance?.score ?? null,
      lcp: audits['largest-contentful-paint']?.numericValue ?? null,
      cls: audits['cumulative-layout-shift']?.numericValue ?? null,
      inp: audits['interaction-to-next-paint']?.numericValue ?? null,
      tbt: audits['total-blocking-time']?.numericValue ?? null,
      fcp: audits['first-contentful-paint']?.numericValue ?? null,
    };
  });
}

async function checkAll(cfg) {
  const out = { ts: new Date().toISOString(), pages: [] };
  for (const path of cfg.urls.slice(0, 3)) { // PSI quota is limited; only top URLs
    const url = cfg.domain.replace(/\/$/, '') + path;
    try {
      const mobile = await pageSpeed(url, 'mobile', cfg.pageSpeedApiKey);
      const desktop = await pageSpeed(url, 'desktop', cfg.pageSpeedApiKey);
      out.pages.push({ url, mobile, desktop });
    } catch (e) {
      out.pages.push({ url, error: e.message });
    }
  }
  return out;
}

module.exports = { pageSpeed, checkAll };
