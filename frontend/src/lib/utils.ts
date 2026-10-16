import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  const rounded = Math.ceil(price * 2) / 2;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(rounded);
}

export function formatDate(dateStr: string, locale = 'de-DE'): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string, locale = 'de-DE'): string {
  return new Date(dateStr).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function calculatePrice(
  distanceKm: number,
  vehicleType: 'kombi' | 'van' | 'grossraumtaxi',
  prices: Record<string, { base_price: number; price_per_km: number }>
): number {
  const price = prices[vehicleType];
  if (!price) return 0;
  return price.base_price + distanceKm * price.price_per_km;
}

export const VEHICLE_PRICES = {
  kombi: { base_price: 8.0, price_per_km: 2.1, roundtrip_discount: 5 },
  van: { base_price: 10.0, price_per_km: 2.2, roundtrip_discount: 5 },
  grossraumtaxi: { base_price: 15.0, price_per_km: 2.4, roundtrip_discount: 5 },
};

// vignette: 1× per trip. tunnelOneWay: taksi boş dönüş nedeniyle her zaman 2× uygulanır.
// Müşteri Rückfahrt seçerse oneWayWithToll × 2 üzerinden hesap yapıldığı için tünel ×2 zaten dahil.
// Gerçek 2026 Maut tarifeleri (Ekim 2026 doğrulandı: ASFINAG, ASTRA, Sund & Bælt; kur 1 EUR = 0,927 CHF / 7,47 DKK / 24,3 CZK). tunnelOneWay: taksi boş dönüş için daima ×2 uygulanır.
// AT: bölge bazlı, yukarıdaki getAustrianToll() ile hesaplanır.
export const TOLL_BY_COUNTRY: Record<string, { vignette: number; tunnelOneWay: number }> = {
  CH: { vignette: 43.15, tunnelOneWay: 0 },
  // CHF 40 e-Vignette 2026 ≈ €43,15. İsviçre'de özel tünel ücreti yok (kapsüllü).

  IT: { vignette: 12.8, tunnelOneWay: 17.5 },
  // AT vignette(12,80) + Brenner A13 Sondermaut(12,50€/yön)×2 + İtalya A22 ort.(5€/yön, doğrulanmadı)×2
  // Toplam: 12,80 + 25 + 10 = ~47,80€ (Südtirol/Bozen odaklı)

  FR: { vignette: 0,    tunnelOneWay: 15 },
  // Fransa'da vignette yok. Autoroute ort. ~30€ RT (Strasbourg~10, Lyon~40, Paris~55)

  CZ: { vignette: 12.3, tunnelOneWay: 0 },
  // 10-Tage e-Vignette 2026: CZK 300 ≈ €12,30. Tünel yok.

  PL: { vignette: 0,    tunnelOneWay: 6 },
  // A1/A2/A4 otoyol ücretleri ort. ~12€ RT

  DK: { vignette: 0,    tunnelOneWay: 27.45 },
  // Storebælt Köprüsü 2026: DKK 205/yön (otomatik ödeme) ≈ €27,45 (Zealand/Kopenhag'a giden rotalar)

  BE: { vignette: 0,    tunnelOneWay: 0 },  // Araç için otoyol ücreti yok
  NL: { vignette: 0,    tunnelOneWay: 0 },  // Araç için otoyol ücreti yok
  LU: { vignette: 0,    tunnelOneWay: 0 },  // Araç için otoyol ücreti yok
  DE: { vignette: 0,    tunnelOneWay: 0 },
};

// Avusturya posta koduna göre bölge tespiti (2026 gerçek tarifeleri):
// 8xxx = Steiermark → Tauerntunnel A10 (€15,00/yön, 2026)
// 9xxx = Kärnten + Osttirol → Tauerntunnel A10 (€15,00/yön, 2026)
// diğerleri = Tirol/Vorarlberg/Wien/NÖ/OÖ/Salzburg/Bgld → sadece vignette
function getAustrianToll(addr: string): number {
  const vignette = 12.8; // 10-Tage Vignette 2026
  const plz = addr.match(/\b(\d{4})\b/)?.[1];
  if (plz && (plz[0] === '8' || plz[0] === '9')) {
    // Steiermark & Kärnten: her iki bölge de Tauerntunnel (A10) üzerinden ulaşılır
    // Taksi boş dönüş yaptığı için tünel 2× → 12,80 + 15×2 = 42,80€
    return vignette + 15 * 2;
  }
  return vignette; // Tirol(6xxx), Wien(1xxx), NÖ(2-3xxx), OÖ(4xxx), Salzburg(5xxx), Bgld(7xxx), Vbg(6xxx)
}

export function extractCountryFromAddress(addr: string | undefined): string {
  if (!addr) return 'DE';
  if (/(österreich|austria)\s*$/i.test(addr)) return 'AT';
  if (/(schweiz|switzerland|suisse|svizzera)\s*$/i.test(addr)) return 'CH';
  if (/(italien|italy|italia)\s*$/i.test(addr)) return 'IT';
  if (/(frankreich|france)\s*$/i.test(addr)) return 'FR';
  if (/(tschechien|tschechische republik|czech republic|česká republika)\s*$/i.test(addr)) return 'CZ';
  if (/(polen|poland|polska)\s*$/i.test(addr)) return 'PL';
  if (/(dänemark|denmark|danmark)\s*$/i.test(addr)) return 'DK';
  if (/(belgien|belgium|belgique|belgië)\s*$/i.test(addr)) return 'BE';
  if (/(niederlande|netherlands|nederland)\s*$/i.test(addr)) return 'NL';
  if (/(luxemburg|luxembourg)\s*$/i.test(addr)) return 'LU';
  return 'DE';
}

export function calculateToll(country: string | undefined, addr?: string): number {
  if (country === 'AT') return getAustrianToll(addr ?? '');
  const rule = TOLL_BY_COUNTRY[country ?? 'DE'] ?? TOLL_BY_COUNTRY.DE;
  return rule.vignette + rule.tunnelOneWay * 2;
}

export const CONTACT_INFO = {
  phone: '+49 151 41620000',
  phoneHref: 'tel:+4915141620000',
  whatsapp: 'https://wa.me/4915141620000',
  email: 'info@flughafen-muenchen.taxi',
  address: 'Eisvogelweg 2, 85356 Freising, Deutschland',
  owners: 'Osman Nar & M.Ali Nar',
  website: 'www.flughafen-muenchen.taxi',
};

export interface WhatsAppContext {
  pickup?: string | null;
  dropoff?: string | null;
  date?: string | null;      // YYYY-MM-DD
  time?: string | null;      // HH:mm
  passengers?: number | string | null;
  vehicle?: string | null;   // kombi | van | grossraumtaxi
  price?: number | null;
  ref?: string | null;
}

const WA_VEHICLE: Record<string, [string, string, string]> = {
  kombi: ['Kombi', 'Sedan', 'Kombi'],
  van: ['Van / Minibus', 'Van / Minibus', 'Van / Minibüs'],
  grossraumtaxi: ['Großraumtaxi', 'Large Taxi', 'Büyük Taksi'],
};

/** Kurzer Referenzcode aus der Session-ID — derselbe steht im Admin-Live-Tab. */
export function liveRef(sessionId: string | null | undefined): string {
  return (sessionId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
}

/**
 * WhatsApp-Link mit vorausgefüllter Nachricht (Strecke, Termin, Fahrzeug, Preis, Ref).
 * Der Kunde muss nur noch "Senden" tippen, wir sehen sofort, worum es geht.
 */
export function buildWhatsAppLink(ctx: WhatsAppContext, locale: string): string {
  const i = locale === 'en' ? 1 : locale === 'tr' ? 2 : 0;
  const clean = (a?: string | null) => (a || '').replace(/,\s*(Deutschland|Germany|Almanya)\s*$/i, '').trim().slice(0, 90);
  const lines: string[] = [];
  lines.push(['Hallo, ich möchte eine Fahrt buchen:', 'Hello, I would like to book a ride:', 'Merhaba, bir yolculuk rezerve etmek istiyorum:'][i]);
  const pickup = clean(ctx.pickup);
  const dropoff = clean(ctx.dropoff);
  if (pickup || dropoff) lines.push(`${pickup || '?'} → ${dropoff || '?'}`);
  const when: string[] = [];
  if (ctx.date) {
    const [y, m, d] = ctx.date.split('-');
    if (y && m && d) when.push(`${d}.${m}.${y}${ctx.time ? ` ${[' um ', ' at ', ' saat '][i].trim()} ${ctx.time}` : ''}`);
  }
  if (ctx.passengers) when.push(`${ctx.passengers} ${['Pers.', 'pax', 'kişi'][i]}`);
  if (when.length) lines.push(when.join(' · '));
  const what: string[] = [];
  if (ctx.vehicle) what.push(WA_VEHICLE[ctx.vehicle]?.[i] || ctx.vehicle);
  if (ctx.price && ctx.price > 0) what.push(formatPrice(ctx.price));
  if (what.length) lines.push(what.join(' · '));
  if (lines.length === 1) lines[0] = ['Hallo, ich habe eine Frage zu einer Fahrt.', 'Hello, I have a question about a ride.', 'Merhaba, bir yolculuk hakkında sorum var.'][i];
  if (ctx.ref) lines.push(`(Ref: ${ctx.ref})`);
  return `${CONTACT_INFO.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
}

// Display-only icon prefix for addresses (airport ✈️ / hotel 🏨) — never part of the stored value
export function addressIcon(addr: string): string {
  if (/flughafen|airport|terminal/i.test(addr)) return '✈️ ';
  if (/\b(hotel|hostel|pension|gasthof|gasthaus|motel|resort|novotel|mercure|ibis|marriott|hilton|hyatt)\b/i.test(addr)) return '🏨 ';
  return '';
}
