module.exports = {
  name: 'fix-sitemap',
  description: 'Detect URLs that exist in audit but missing from sitemap.xml.',
  detect(audit) {
    if (!audit.sitemap || audit.sitemap.error) return [];
    const sitemapSet = new Set((audit.sitemap.urls || []).map(u => u.replace(/\/$/, '')));
    const missing = (audit.pages || [])
      .filter(p => !p.error && p.status === 200)
      .map(p => p.url.replace(/\/$/, ''))
      .filter(u => !sitemapSet.has(u));
    return missing.map(url => ({ kind: 'missing_from_sitemap', url }));
  },
  propose(issue) {
    return {
      type: 'manual_review',
      url: issue.url,
      reason: 'URL sitemap.xml içinde yok.',
      action: `next-sitemap config'inde include/exclude listesini kontrol edin veya sayfa dinamik route ise additionalPaths içine ekleyin.`,
    };
  },
};
