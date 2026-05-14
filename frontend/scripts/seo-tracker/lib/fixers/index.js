// Each fixer: { name, detect(audit, cfg) -> issues[], propose(issue, cfg) -> {file, before, after, reason} }
const missingMeta = require('./fix-missing-meta');
const titleLength = require('./fix-title-length');
const missingAlt = require('./fix-missing-alt');
const sitemap = require('./fix-sitemap');
const brokenLink = require('./fix-broken-internal-link');

module.exports = { all: [missingMeta, titleLength, missingAlt, sitemap, brokenLink] };
