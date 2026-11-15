// Saisonale Hero-Bilder der Startseite: Zeitraum (Berliner Datum, beide Tage inklusive) → Bild.
// Gepflegt im Admin (System → Hero-Kalender), gespeichert in den Einstellungen `hero_seasons`.
export interface HeroSeason {
  id: string;
  name: string;
  start: string; // JJJJ-MM-TT
  end: string;   // JJJJ-MM-TT
  enabled: boolean;
  img: string;   // Dateiname ohne Endung in /images/hero-seasons/
}

export interface HeroText { kicker: string; kickerMobile?: string; title: string; subtitle: string; description: string }

// Vorhandene Bildsätze (je <img>-web.webp, <img>-web-1200.webp, <img>-mobile.webp) mit den Texten des Designs.
// Ohne `text` bleibt die normale Hero-Überschrift stehen.
// kickerLine: Goldlinie vor/um die Dachzeile (Standard), dahinter ('after', linksbündig) oder keine ('none', weit gesperrt)
// badgesBelowPhoto: auf dem Handy stehen die drei Merkmale unter dem Foto statt darüber
export const HERO_IMAGE_SETS: { img: string; label: string; kickerLine?: 'after' | 'none'; badgesBelowPhoto?: boolean; kickerWide?: boolean; snow?: boolean; glow?: boolean; text?: Record<string, HeroText> }[] = [
  {
    img: 'winter', label: 'Winterbeginn', snow: true,
    text: {
      de: { kicker: 'Winterreisen · Entspannt unterwegs', title: 'Draußen wird es kalt.', subtitle: 'Ihre Reise beginnt entspannt.', description: 'Ihr Transfer zum & vom Flughafen München. Komfortabel und zuverlässig – zum Festpreis.' },
      en: { kicker: 'Winter travel · Relaxed on the road', title: 'It’s getting cold outside.', subtitle: 'Your journey starts relaxed.', description: 'Your transfer to & from Munich Airport. Comfortable and reliable – at a fixed price.' },
      tr: { kicker: 'Kış yolculukları · Rahat ulaşım', title: 'Dışarısı soğuyor.', subtitle: 'Yolculuğunuz rahat başlar.', description: 'Münih Havalimanı’na ve havalimanından transferiniz. Konforlu ve güvenilir – sabit fiyatla.' },
    },
  },
  {
    img: 'advent-1', label: '1. Advent', snow: true, kickerLine: 'after',
    text: {
      de: { kicker: '1. Advent · Die Vorfreude beginnt', title: 'Ein Licht geht auf.', subtitle: 'Ihre Reise beginnt entspannt.', description: 'Ihr Flughafentransfer in der Adventszeit. Zuverlässig zum & vom Flughafen München – zum Festpreis.' },
      en: { kicker: '1st Advent · The anticipation begins', title: 'The first candle is lit.', subtitle: 'Your journey starts relaxed.', description: 'Your airport transfer in the Advent season. Reliable to & from Munich Airport – at a fixed price.' },
      tr: { kicker: '1. Advent · Heyecan başlıyor', title: 'İlk mum yanıyor.', subtitle: 'Yolculuğunuz rahat başlar.', description: 'Advent döneminde havalimanı transferiniz. Münih Havalimanı’na ve havalimanından güvenle – sabit fiyatla.' },
    },
  },
  {
    img: 'advent-2', label: '2. Advent', snow: true, kickerLine: 'after',
    text: {
      de: { kicker: '2. Advent · Vorfreude auf die Reise', title: 'Zwei Lichter leuchten.', subtitle: 'Entspannt unterwegs.', description: 'Ihr Flughafentransfer in der Adventszeit. Zuverlässig zum & vom Flughafen München – zum Festpreis.' },
      en: { kicker: '2nd Advent · Looking forward to the trip', title: 'Two candles are lit.', subtitle: 'Travel relaxed.', description: 'Your airport transfer in the Advent season. Reliable to & from Munich Airport – at a fixed price.' },
      tr: { kicker: '2. Advent · Yolculuk heyecanı', title: 'İki mum yanıyor.', subtitle: 'Rahat yolculuk.', description: 'Advent döneminde havalimanı transferiniz. Münih Havalimanı’na ve havalimanından güvenle – sabit fiyatla.' },
    },
  },
  {
    img: 'advent-3', label: '3. Advent', snow: true, kickerLine: 'after',
    text: {
      de: { kicker: '3. Advent · Weihnachten rückt näher', title: 'Die Vorfreude wächst.', subtitle: 'Wir bringen Sie ans Ziel.', description: 'Ihr Flughafentransfer in der Adventszeit. Zuverlässig zum & vom Flughafen München – zum Festpreis.' },
      en: { kicker: '3rd Advent · Christmas is getting closer', title: 'The anticipation grows.', subtitle: 'We take you there.', description: 'Your airport transfer in the Advent season. Reliable to & from Munich Airport – at a fixed price.' },
      tr: { kicker: '3. Advent · Noel yaklaşıyor', title: 'Heyecan büyüyor.', subtitle: 'Sizi hedefinize ulaştırırız.', description: 'Advent döneminde havalimanı transferiniz. Münih Havalimanı’na ve havalimanından güvenle – sabit fiyatla.' },
    },
  },
  {
    img: 'advent-4', label: '4. Advent', snow: true, glow: true, kickerLine: 'after',
    text: {
      de: { kicker: '4. Advent · Weihnachten ist nah', title: 'Vier Lichter leuchten.', subtitle: 'Weihnachten kann kommen.', description: 'Entspannt zu Ihren Liebsten reisen. Ihr Transfer zum & vom Flughafen München – zum Festpreis.' },
      en: { kicker: '4th Advent · Christmas is near', title: 'Four candles are lit.', subtitle: 'Christmas can come.', description: 'Travel relaxed to your loved ones. Your transfer to & from Munich Airport – at a fixed price.' },
      tr: { kicker: '4. Advent · Noel çok yakın', title: 'Dört mum yanıyor.', subtitle: 'Noel gelebilir.', description: 'Sevdiklerinize rahatça ulaşın. Münih Havalimanı’na ve havalimanından transferiniz – sabit fiyatla.' },
    },
  },
  {
    img: 'weihnachten', label: 'Weihnachten', snow: true, kickerLine: 'none', badgesBelowPhoto: true,
    text: {
      de: { kicker: 'Weihnachten beginnt mit einer entspannten Reise', kickerMobile: 'Weihnachten · Entspannt reisen', title: 'Entspannt ankommen.', subtitle: 'Weihnachten genießen.', description: 'Ihr Flughafentransfer zum Festpreis – auch an den Feiertagen. Zuverlässig zum & vom Flughafen München.' },
      en: { kicker: 'Christmas begins with a relaxed journey', kickerMobile: 'Christmas · Travel relaxed', title: 'Arrive relaxed.', subtitle: 'Enjoy Christmas.', description: 'Your airport transfer at a fixed price – also on public holidays. Reliable to & from Munich Airport.' },
      tr: { kicker: 'Noel rahat bir yolculukla başlar', kickerMobile: 'Noel · Rahat yolculuk', title: 'Rahatça varın.', subtitle: 'Noel’in tadını çıkarın.', description: 'Sabit fiyatlı havalimanı transferiniz – bayram günlerinde de. Münih Havalimanı’na ve havalimanından güvenle.' },
    },
  },
  {
    img: 'silvester-2027', label: 'Silvester / Neujahr', kickerLine: 'after', kickerWide: true, badgesBelowPhoto: true,
    text: {
      de: { kicker: 'Willkommen 2027 · Entspannt reisen', kickerMobile: 'Willkommen 2027', title: 'Entspannt ins neue Jahr.', subtitle: 'Ihr Flughafentransfer wartet.', description: 'Zum & vom Flughafen München – auch zum Jahreswechsel. Zuverlässig, komfortabel und zum Festpreis.' },
      en: { kicker: 'Welcome 2027 · Travel relaxed', kickerMobile: 'Welcome 2027', title: 'Relaxed into the new year.', subtitle: 'Your airport transfer is waiting.', description: 'To & from Munich Airport – also over New Year. Reliable, comfortable and at a fixed price.' },
      tr: { kicker: '2027’ye hoş geldiniz · Rahat yolculuk', kickerMobile: '2027’ye hoş geldiniz', title: 'Yeni yıla rahatça girin.', subtitle: 'Havalimanı transferiniz hazır.', description: 'Münih Havalimanı’na ve havalimanından – yılbaşında da. Güvenilir, konforlu ve sabit fiyatla.' },
    },
  },
  { img: 'fasching', label: 'Fasching' },
  { img: 'ostern', label: 'Ostern' },
  { img: 'pfingsten', label: 'Pfingsten' },
  { img: 'sommer', label: 'Sommer' },
  { img: 'oktoberfest', label: 'Oktoberfest' },
  { img: 'herbst', label: 'Herbst' },
];

export function heroTextFor(img: string | null, locale: string): (HeroText & { kickerLine?: 'after' | 'none'; badgesBelowPhoto?: boolean; kickerWide?: boolean }) | null {
  const set = img ? HERO_IMAGE_SETS.find((s) => s.img === img) : null;
  return set?.text ? { ...(set.text[locale] || set.text.de), kickerLine: set.kickerLine, badgesBelowPhoto: set.badgesBelowPhoto, kickerWide: set.kickerWide } : null;
}

export function parseHeroSeasons(raw: string | undefined | null): HeroSeason[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((s) => s && typeof s.start === 'string' && typeof s.end === 'string' && typeof s.img === 'string') : [];
  } catch {
    return [];
  }
}

// Heutiges Datum in Deutschland — der Wechsel passiert um 00:00 Berliner Zeit
export function berlinToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// Erster aktiver Zeitraum, der das Datum enthält (bei Überschneidung gewinnt der obere Eintrag)
export function activeHeroSeason(seasons: HeroSeason[], date: string): HeroSeason | null {
  return seasons.find((s) => s.enabled && s.start <= date && date <= s.end) || null;
}

// snow = feine Schneeflocken über dem ganzen Hero, glow = zusätzlich warme goldene Lichtpunkte
export function heroEffects(img: string | null): { snow: boolean; glow: boolean } {
  const set = img ? HERO_IMAGE_SETS.find((s) => s.img === img) : null;
  return { snow: !!set?.snow, glow: !!set?.glow };
}

// Bildsatz fertig (Foto + Texte vorhanden)? Sonst bleibt im Zeitraum das Standard-Hero.
export function heroSetReady(img: string): boolean {
  return !!HERO_IMAGE_SETS.find((s) => s.img === img)?.text;
}
