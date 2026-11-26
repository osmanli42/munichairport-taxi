import { Request } from 'express';

/**
 * Partner sites whose visitors are tracked into the same Live / Replay tables.
 *
 * flughafen-muenchen-taxi.de ("fmt") sends its pageviews, heartbeats, click events and
 * rrweb recordings to this backend so the admin sees them in Live and Replay. Those
 * sessions are stored with:
 *   - visitor_sessions.site = 'fmt'
 *   - visitor_sessions.is_bot = 2 for humans (1 stays "bot")
 *   - paths prefixed with the host ("flughafen-muenchen-taxi.de/anfrage.html")
 * is_bot = 2 keeps them out of every existing statistic that filters `is_bot = 0`
 * (Statistik, Ads attribution, Smart Rabatt, conversion model, daily/weekly summaries),
 * and the host prefix keeps their clicks off munich's heatmap paths. Only Live and
 * Replay opt in to them explicitly (`is_bot IN (0, PARTNER_HUMAN)`).
 */
export type PartnerSite = 'fmt';

/** Allowed browser origins of fmt. A function: NODE_ENV comes from .env, loaded after imports. */
export function fmtOrigins(): string[] {
  return [
    'https://flughafen-muenchen-taxi.de',
    'https://www.flughafen-muenchen-taxi.de',
    // local preview of the fmt static site ("FMT Frontend" in ~/.claude/launch.json, or FMT_DEV_ORIGIN)
    ...(process.env.NODE_ENV === 'production' ? [] : [process.env.FMT_DEV_ORIGIN || 'http://localhost:3002']),
  ];
}

export const FMT_PATH_PREFIX = 'flughafen-muenchen-taxi.de';

/** Which partner site sent this request, from the browser-set Origin header. */
export function partnerSite(req: Request): PartnerSite | null {
  const origin = String(req.headers.origin || '');
  return fmtOrigins().includes(origin) ? 'fmt' : null;
}

/** Path as stored for a partner session: host-prefixed so it never matches munich paths. */
export function partnerPath(site: PartnerSite | null, path: unknown): string {
  const p = String(path ?? '');
  if (site !== 'fmt' || !p) return p;
  return p.startsWith(FMT_PATH_PREFIX) ? p : FMT_PATH_PREFIX + (p.startsWith('/') ? p : '/' + p);
}

/** is_bot value marking a human visitor of a partner site. */
export const PARTNER_HUMAN = 2;
