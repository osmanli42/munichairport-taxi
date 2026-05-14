module.exports = {
  name: 'fix-title-length',
  description: 'Detect titles longer than 65 chars and propose shorter variant.',
  detect(audit) {
    return (audit.pages || [])
      .filter(p => !p.error && p.titleLen > 65)
      .map(p => ({ kind: 'long_title', url: p.url, current: p.title, len: p.titleLen }));
  },
  propose(issue) {
    let shorter = issue.current.replace(/\s*[|\-–·]\s*/g, ' | ');
    const parts = shorter.split(' | ');
    while (parts.length > 1 && parts.join(' | ').length > 60) parts.pop();
    return {
      type: 'manual_review',
      url: issue.url,
      reason: `Title ${issue.len} char (max 65 önerilir).`,
      action: `metadata.title kısaltın:`,
      patch: `title: "${parts.join(' | ')}"`,
    };
  },
};
