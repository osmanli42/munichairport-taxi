// Nachtfenster-Rechnung für die Nacht-Stornierung (routes/bookings.ts). Rein, ohne DB/Zeitzone:
// alle Zeitpunkte als „Wanduhr“-Millisekunden (Münchner Ortszeit, als wäre sie UTC).

export function berlinWallNow(now = new Date()): { wall: number; hour: number; dayStart: number } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
  return {
    wall: Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute),
    hour: +parts.hour,
    dayStart: Date.UTC(+parts.year, +parts.month - 1, +parts.day),
  };
}

/** true = Fahrt beginnt, bevor das laufende Nachtfenster endet (+ Puffer) → nur telefonisch stornieren. */
export function rideBeforeNightEnds(opts: {
  nowWall: number; nowHour: number; dayStart: number; pickupWall: number; start: number; end: number; bufferH: number;
}): boolean {
  const { nowWall, nowHour, dayStart, pickupWall, start, end, bufferH } = opts;
  if (isNaN(start) || isNaN(end) || start === end) return false;
  const inWindow = start < end ? (nowHour >= start && nowHour < end) : (nowHour >= start || nowHour < end);
  if (!inWindow) return false;
  const endToday = dayStart + end * 3600000;
  const windowEnd = nowWall < endToday ? endToday : endToday + 86400000;
  return pickupWall > nowWall && pickupWall <= windowEnd + bufferH * 3600000;
}
