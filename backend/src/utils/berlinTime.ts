// Server/DB run in UTC; these helpers convert Berlin-local calendar boundaries
// (DST-aware) into UTC instants comparable against DATETIME columns like
// `created_at`/`first_seen` that MySQL populates via CURRENT_TIMESTAMP/NOW() in UTC.

// Berlin-local midnight, `offsetDays` days from today, as a UTC 'YYYY-MM-DD HH:mm:ss' string.
export function berlinMidnightUtcSql(offsetDays = 0): string {
  const now = new Date();
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now).split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d + offsetDays, 0, 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(guess);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asIfUtc = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  const berlinMidnightUtc = new Date(guess.getTime() - (asIfUtc - guess.getTime()));
  return berlinMidnightUtc.toISOString().slice(0, 19).replace('T', ' ');
}

export function berlinDayOfMonth(): number {
  return +new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', day: '2-digit' }).format(new Date());
}

// Berlin-local wall-clock time as 'YYYY-MM-DD HH:mm:ss'. Needed to compare against
// `pickup_datetime`, which is a plain VARCHAR of Berlin-local wall-clock time (see
// buchen/page.tsx `${date}T${time}:00`), not a real DATETIME — so NOW() can't be used
// directly. Space-separated (not 'T') so MySQL coerces it to DATETIME reliably.
export function berlinNowSql(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date);
}
