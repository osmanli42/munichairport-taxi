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
// Gerçek 2025 Maut tarifeleri. tunnelOneWay: taksi boş dönüş için daima ×2 uygulanır.
// AT: bölge bazlı, yukarıdaki getAustrianToll() ile hesaplanır.
export const TOLL_BY_COUNTRY: Record<string, { vignette: number; tunnelOneWay: number }> = {
  CH: { vignette: 41,   tunnelOneWay: 0 },
  // CHF 40 e-Vignette 2025 ≈ €41. İsviçre'de özel tünel ücreti yok (kapsüllü).

  IT: { vignette: 9.9,  tunnelOneWay: 16 },
  // AT vignette(9,90) + Brenner A13 Sondermaut(11€/yön)×2 + İtalya A22 ort.(5€/yön)×2
  // Toplam: 9,90 + 22 + 10 = ~41,90€ (Südtirol/Bozen odaklı)

  FR: { vignette: 0,    tunnelOneWay: 15 },
  // Fransa'da vignette yok. Autoroute ort. ~30€ RT (Strasbourg~10, Lyon~40, Paris~55)

  CZ: { vignette: 12.5, tunnelOneWay: 0 },
  // 10-Tage e-Vignette 2025: CZK 310 ≈ €12,50. Tünel yok.

  PL: { vignette: 0,    tunnelOneWay: 6 },
  // A1/A2/A4 otoyol ücretleri ort. ~12€ RT

  DK: { vignette: 0,    tunnelOneWay: 17.5 },
  // Storebælt Köprüsü 2025: DKK 265 ≈ €35 RT (Zealand/Kopenhag'a giden rotalar)

  BE: { vignette: 0,    tunnelOneWay: 0 },  // Araç için otoyol ücreti yok
  NL: { vignette: 0,    tunnelOneWay: 0 },  // Araç için otoyol ücreti yok
  LU: { vignette: 0,    tunnelOneWay: 0 },  // Araç için otoyol ücreti yok
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

// Display-only icon prefix for addresses (airport ✈️ / hotel 🏨) — never part of the stored value
export function addressIcon(addr: string): string {
  if (/flughafen|airport|terminal/i.test(addr)) return '✈️ ';
  if (/\b(hotel|hostel|pension|gasthof|gasthaus|motel|resort|novotel|mercure|ibis|marriott|hilton|hyatt)\b/i.test(addr)) return '🏨 ';
  return '';
}
