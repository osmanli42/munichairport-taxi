module.exports = {
  name: 'fix-missing-alt',
  description: 'Detect pages where alt-ratio is low and report (manual review — Image component changes are risky).',
  detect(audit) {
    return (audit.pages || [])
      .filter(p => !p.error && p.imgs > 0 && p.altRatio < 0.8)
      .map(p => ({ kind: 'low_alt_ratio', url: p.url, ratio: p.altRatio, imgs: p.imgs }));
  },
  propose(issue) {
    return {
      type: 'manual_review',
      url: issue.url,
      reason: `Alt-text oranı düşük: ${Math.round(issue.ratio * 100)}% (${issue.imgs} görsel).`,
      action: `İlgili sayfanın <Image alt=""> özelliklerini doldurun. Önerilen alt formatı: "[konu] - Flughafen München Taxi".`,
    };
  },
};
