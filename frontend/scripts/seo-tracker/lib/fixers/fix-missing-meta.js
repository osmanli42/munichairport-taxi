module.exports = {
  name: 'fix-missing-meta',
  description: 'Detect pages with missing/short meta description and propose one from H1 + first paragraph.',
  detect(audit) {
    return (audit.pages || [])
      .filter(p => !p.error && (!p.metaDesc || p.metaLen < 80))
      .map(p => ({ kind: 'missing_meta', url: p.url, current: p.metaDesc || '', h1: (p.h1s || [])[0] || '' }));
  },
  propose(issue) {
    const seed = `${issue.h1 || 'Flughafen München Taxi'}. Schnell, zuverlässig, Festpreis. 24/7 Buchung – professioneller Service zum Flughafen München.`;
    const suggested = seed.slice(0, 158);
    return {
      type: 'manual_review',
      url: issue.url,
      reason: `Meta description fehlik veya çok kısa (${issue.current.length} char).`,
      action: `Sayfanın page.tsx dosyasında metadata.description'a ekleyin:`,
      patch: `description: "${suggested}"`,
    };
  },
};
