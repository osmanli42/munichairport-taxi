// Nachtfenster-Rechnung für die Nacht-Stornierung (routes/bookings.ts). Rein, ohne DB/Zeitzone:
// alle Zeitpunkte als „Wanduhr“-Millisekunden (Münchner Ortszeit, als wäre sie UTC).

export function berlinWallNow(now = new Date()): { wall: number; minuteOfDay: number; dayStart: number } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
  return {
    wall: Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute),
    minuteOfDay: +parts.hour * 60 + +parts.minute,
    dayStart: Date.UTC(+parts.year, +parts.month - 1, +parts.day),
  };
}

/** „20:30“ → 1230, „7“ → 420 (alte Einstellungen waren ganze Stunden); ungültig → NaN */
export function parseClock(v: string | undefined | null): number {
  const m = String(v ?? '').trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return NaN;
  const h = +m[1], min = m[2] ? +m[2] : 0;
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return NaN;
  return (h * 60 + min) % 1440;
}

/** true = jetzt im Nachtfenster und die Fahrt beginnt, bevor es endet → nur telefonisch stornieren. */
export function rideBeforeNightEnds(opts: {
  nowWall: number; nowMinute: number; dayStart: number; pickupWall: number; start: number; end: number;
}): boolean {
  const { nowWall, nowMinute, dayStart, pickupWall, start, end } = opts;
  if (isNaN(start) || isNaN(end) || start === end) return false;
  const inWindow = start < end ? (nowMinute >= start && nowMinute < end) : (nowMinute >= start || nowMinute < end);
  if (!inWindow) return false;
  const endToday = dayStart + end * 60000;
  const windowEnd = nowWall < endToday ? endToday : endToday + 86400000;
  return pickupWall > nowWall && pickupWall <= windowEnd;
}
