module.exports = {
  name: 'fix-broken-internal-link',
  description: 'Read broken-link results and propose removal/replacement.',
  detect(audit, ctx) {
    const broken = ctx?.brokenLinks || [];
    return broken.map(b => ({ kind: 'broken_link', url: b.url, status: b.status || 'fetch_error', from: b.from }));
  },
  propose(issue) {
    return {
      type: 'manual_review',
      url: issue.from,
      reason: `Internal link kırık: ${issue.url} (${issue.status})`,
      action: `Linki kaldırın veya en yakın geçerli URL'ye yönlendirin. Sayfa kaldırıldıysa 301 redirect ekleyin (next.config.js → redirects).`,
    };
  },
};
