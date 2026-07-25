// Deterministic A/B bucketing — must stay byte-identical to backend/src/utils/experiments.ts
// so the frontend's synchronous guess matches what the server later persists. Same
// visitorId + experiment key always lands in the same variant.
//
// FNV-1a instead of crypto.subtle.digest: the browser's digest is async, which would
// flash variant A on first render before resolving to B.

export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function bucket(visitorId: string, key: string): number {
  return hash32(`${key}:${visitorId}`) % 100;
}

export type Variant = 'a' | 'b';

// rollout: '0'..'100' (percent of visitors in variant B), or 'off'/undefined/missing.
export function assignVariant(visitorId: string | null | undefined, key: string, rollout: string | undefined): Variant {
  if (!visitorId || !rollout || rollout === 'off' || rollout === '0') return 'a';
  const pct = Math.max(0, Math.min(100, parseInt(rollout, 10) || 0));
  return bucket(visitorId, key) < pct ? 'b' : 'a';
}

export const EXPERIMENT_KEYS = ['checkout_v2'] as const;
export type ExperimentKey = typeof EXPERIMENT_KEYS[number];

// Builds the compact string sent with the pageview beacon, e.g. "checkout_v2:b".
// settings is the flat {key: value} map from GET /api/settings.
export function variantString(visitorId: string | null | undefined, settings: Record<string, string>): string {
  const parts: string[] = [];
  for (const key of EXPERIMENT_KEYS) {
    const rollout = settings[`experiment_${key}`];
    if (!rollout || rollout === 'off' || rollout === '0') continue;
    parts.push(`${key}:${assignVariant(visitorId, key, rollout)}`);
  }
  return parts.join(';');
}
