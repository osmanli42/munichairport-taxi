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
export const TOLL_BY_COUNTRY: Record<string, { vignette: number; tunnelOneWay: number }> = {
  // AT: bölge bazlı, aşağıdaki getAustrianToll() ile hesaplanır
  CH: { vignette: 42,   tunnelOneWay: 0 },     // Jahresvignette (sefer başı yansıtılır)
  IT: { vignette: 0,    tunnelOneWay: 25 },    // Autostrada ortalama
  FR: { vignette: 0,    tunnelOneWay: 15 },    // Autoroute ortalama (~30€ RT)
  CZ: { vignette: 10,   tunnelOneWay: 0 },     // 10-Tage Dálniční známka
  PL: { vignette: 0,    tunnelOneWay: 8 },     // A1/A2/A4 otoyol ücretleri (~16€ RT)
  DK: { vignette: 0,    tunnelOneWay: 14 },    // Storebælt Köprüsü (~28€ RT)
  BE: { vignette: 0,    tunnelOneWay: 0 },
  NL: { vignette: 0,    tunnelOneWay: 0 },
  LU: { vignette: 0,    tunnelOneWay: 0 },
  DE: { vignette: 0,    tunnelOneWay: 0 },
};

// Avusturya posta koduna göre bölge tespiti (2025 gerçek tarifeleri):
// 8xxx = Steiermark → Tauerntunnel A10 (€13,50/yön, 2025)
// 9xxx = Kärnten + Osttirol → Tauerntunnel A10 (€13,50/yön, 2025)
// diğerleri = Tirol/Vorarlberg/Wien/NÖ/OÖ/Salzburg/Bgld → sadece vignette
function getAustrianToll(addr: string): number {
  const vignette = 9.9; // 10-Tage Vignette 2025
  const plz = addr.match(/\b(\d{4})\b/)?.[1];
  if (plz && (plz[0] === '8' || plz[0] === '9')) {
    // Steiermark & Kärnten: her iki bölge de Tauerntunnel (A10) üzerinden ulaşılır
    // Taksi boş dönüş yaptığı için tünel 2× → 9,90 + 13,50×2 = 36,90€
    return vignette + 13.5 * 2;
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
