// Backlink building (SEO → Backlinkler → "Backlink kurma"): a fixed list of legitimate places to
// list the business (directories, maps, review sites, social profiles, partners) with the
// registration link and ready-to-paste texts. The admin registers by hand — nothing is posted
// automatically (automated forum / comment links are link spam and risk a Google penalty).
// Status per entry in settings.seo_outreach_status; "link geldi" when the domain shows up in the
// latest Search Console Links CSV.

import { query, run } from '../../db';

const STATUS_KEY = 'seo_outreach_status';
const PER_DAY = 3;

export const BUSINESS = {
  name: 'Flughafen-München.TAXI',
  owner: 'Osman Nar & M.Ali Nar',
  street: 'Eisvogelweg 2',
  zip: '85356',
  city: 'Freising',
  country: 'Deutschland',
  phone: '+49 151 41620000',
  email: 'info@flughafen-muenchen.taxi',
  website: 'https://flughafen-muenchen.taxi',
  hours: 'Mo–So 00:00–24:00 (24/7)',
};

// Same name / address / phone everywhere (NAP) — Google compares the listings.
export const TEXTS: Array<{ key: string; label: string; text: string }> = [
  { key: 'name', label: 'Firmenname', text: BUSINESS.name },
  { key: 'address', label: 'Adresse', text: `${BUSINESS.street}, ${BUSINESS.zip} ${BUSINESS.city}` },
  { key: 'phone', label: 'Telefon', text: BUSINESS.phone },
  { key: 'email', label: 'E-Mail', text: BUSINESS.email },
  { key: 'website', label: 'Website', text: BUSINESS.website },
  { key: 'hours', label: 'Öffnungszeiten', text: BUSINESS.hours },
  { key: 'categories', label: 'Kategorien', text: 'Taxi · Flughafentransfer · Personenbeförderung · Shuttle-Service · Großraumtaxi' },
  {
    key: 'short_de', label: 'Kurzbeschreibung DE (≤ 160 Zeichen)',
    text: 'Taxi & Flughafentransfer zum Flughafen München (MUC) aus Freising, München und ganz Bayern – Festpreis, 24/7, Kombi, Van und Großraumtaxi bis 8 Personen.',
  },
  {
    key: 'long_de', label: 'Beschreibung DE (lang)',
    text: [
      'Flughafen-München.TAXI ist Ihr Taxi- und Transferservice zum und vom Flughafen München (MUC) mit Sitz in Freising.',
      'Wir fahren rund um die Uhr zu Festpreisen – aus Freising, Erding, München und ganz Bayern sowie nach Österreich und in die angrenzenden Regionen.',
      '',
      'Unsere Leistungen:',
      '• Festpreis ohne versteckte Kosten – Preis vor der Fahrt online berechnen',
      '• Kombi (1–3 Personen), Van/Minibus (4–7 Personen) und Großraumtaxi (8+ Personen)',
      '• Flugüberwachung bei Abholung am Flughafen, 60 Minuten kostenlose Wartezeit',
      '• Abholung mit Namensschild im Ankunftsbereich',
      '• Kindersitz auf Anfrage kostenlos',
      '• Zahlung bar oder mit Karte, Rechnung für Firmenkunden',
      '• Kostenlose Stornierung bis 3 Stunden vorher',
      '• Fahrer sprechen Deutsch, Englisch und Türkisch',
      '',
      `Online buchen: ${BUSINESS.website} · Telefon/WhatsApp: ${BUSINESS.phone}`,
    ].join('\n'),
  },
  {
    key: 'short_en', label: 'Short description EN',
    text: 'Taxi & airport transfer to and from Munich Airport (MUC) – fixed prices, 24/7, sedan, van and large taxi for up to 8 passengers. Based in Freising.',
  },
  {
    key: 'long_en', label: 'Description EN (long)',
    text: [
      'Flughafen-München.TAXI is a taxi and transfer service to and from Munich Airport (MUC), based in Freising.',
      'We drive 24/7 at fixed prices – from Freising, Erding, Munich and all of Bavaria, to Austria and neighbouring regions.',
      '',
      '• Fixed price, no hidden costs – get your price online before the ride',
      '• Sedan (1–3), van (4–7) and large taxi (8+ passengers)',
      '• Flight monitoring and 60 minutes free waiting time at pick-up',
      '• Meet & greet with name sign in the arrivals hall',
      '• Free child seat on request',
      '• Pay cash or by card, invoices for business customers',
      '• Free cancellation up to 3 hours before',
      '',
      `Book online: ${BUSINESS.website} · Phone/WhatsApp: ${BUSINESS.phone}`,
    ].join('\n'),
  },
  {
    key: 'services', label: 'Leistungen / Stichwörter',
    text: 'Flughafentransfer München, Taxi Flughafen München, Taxi Freising, Taxi Erding, Flughafentaxi, Großraumtaxi, Festpreis Taxi, Messe-Transfer, Firmenfahrten, Transfer nach Österreich, Kindersitz',
  },
  {
    key: 'hotel_mail', label: 'E-Mail an Hotels / Partner (DE)',
    text: [
      'Betreff: Zuverlässiger Flughafentransfer für Ihre Gäste – Partnerschaft?',
      '',
      'Guten Tag,',
      '',
      `wir sind ${BUSINESS.name} aus Freising und fahren Gäste rund um die Uhr zu Festpreisen zum und vom Flughafen München – mit Flugüberwachung, Namensschild und Fahrzeugen bis 8 Personen.`,
      '',
      'Viele Hotels empfehlen ihren Gästen einen festen Transferpartner. Wir würden uns freuen, wenn Sie uns auf Ihrer Website unter „Anreise“ bzw. „Flughafentransfer“ erwähnen und verlinken. Für Ihre Rezeption richten wir gern ein Firmenkonto mit Monatsrechnung ein, damit Sie Transfers für Ihre Gäste einfach buchen können.',
      '',
      `Link: ${BUSINESS.website}`,
      '',
      'Für Rückfragen bin ich gern erreichbar.',
      '',
      'Mit freundlichen Grüßen',
      `${BUSINESS.owner}`,
      `${BUSINESS.name} · ${BUSINESS.phone} · ${BUSINESS.email}`,
    ].join('\n'),
  },
];

type Source = {
  key: string; name: string; group: 'maps' | 'directory' | 'reviews' | 'social' | 'partner';
  url: string; domain: string; minutes: number; how: string;
};

// Order = priority (strongest first). Registration links checked 1 Oct 2026.
export const SOURCES: Source[] = [
  { key: 'google', name: 'Google Unternehmensprofil', group: 'maps', url: 'https://business.google.com/', domain: 'google.com', minutes: 10,
    how: 'Varsa sadece kontrol et: Website = https://flughafen-muenchen.taxi, kategori „Taxiunternehmen“ + „Flughafen-Shuttle-Service“, 24 Std., açıklama (Beschreibung DE), 5–10 araç fotoğrafı. Adresine müşteri gelmiyorsa „Servicegebiet“ seç ve adresi gizle (Google kuralı).' },
  { key: 'bing', name: 'Bing Places', group: 'maps', url: 'https://www.bing.com/forbusiness/', domain: 'bing.com', minutes: 5,
    how: '„Aus Google importieren“ seç — Google profilini tek tıkla kopyalar. Bing haritaları ve Copilot aramalarında görünürsün.' },
  { key: 'apple', name: 'Apple Business (Apple Karten)', group: 'maps', url: 'https://business.apple.com/', domain: 'apple.com', minutes: 10,
    how: 'iPhone kullanıcıları Apple Karten’de seni bulur. Apple ID ile giriş → „Standort hinzufügen“ → metinleri yapıştır.' },
  { key: 'gelbeseiten', name: 'Gelbe Seiten', group: 'directory', url: 'https://www.gelbeseiten.de/starteintrag', domain: 'gelbeseiten.de', minutes: 8,
    how: 'Ücretsiz „Starteintrag“. Önce adınla ara — kayıt varsa yenisini açma, mevcut olanı sahiplen/güncelle. Ücretli paket önerilerini geç.' },
  { key: 'oertliche', name: 'Das Örtliche (DTM)', group: 'directory', url: 'https://www.dtme.de/ihr-eintrag/firma-kostenlos-eintragen', domain: 'dasoertliche.de', minutes: 8,
    how: 'Ücretsiz firma kaydı (Das Örtliche + Das Telefonbuch). Ücretli ekleri seçme.' },
  { key: '11880', name: '11880.com', group: 'directory', url: 'https://firma-eintragen-kostenlos.11880.com', domain: '11880.com', minutes: 8,
    how: 'Ücretsiz kayıt. Telefonla doğrulama isteyebilir; reklam teklifi için arayan olursa ücretsiz kaydı istediğini söyle.' },
  { key: 'wkdb', name: 'WerkenntdenBESTEN', group: 'reviews', url: 'https://firma-eintragen-kostenlos.werkenntdenbesten.de/new/portal_header', domain: 'werkenntdenbesten.de', minutes: 6,
    how: 'Yorum portalı (11880 grubu). Ücretsiz kayıt yeterli.' },
  { key: 'yelp', name: 'Yelp', group: 'reviews', url: 'https://business.yelp.com/', domain: 'yelp.de', minutes: 8,
    how: '„Kostenloses Konto“ — reklam paketlerini geç. Kategori: Taxis / Flughafen-Shuttles.' },
  { key: 'provenexpert', name: 'ProvenExpert', group: 'reviews', url: 'https://www.provenexpert.com/de-de/register/', domain: 'provenexpert.com', minutes: 10,
    how: 'Ücretsiz plan. Profilde website linki ve yorumlar; müşterilerden yorum toplamak için de kullanılabilir.' },
  { key: 'trustpilot', name: 'Trustpilot', group: 'reviews', url: 'https://business.trustpilot.com/', domain: 'trustpilot.com', minutes: 8,
    how: 'Ücretsiz „Free“ plan → alan adını doğrula (info@flughafen-muenchen.taxi). Satış görüşmesi teklifini geç.' },
  { key: 'uvz', name: 'Unternehmensverzeichnis.org', group: 'directory', url: 'https://info.unternehmensverzeichnis.org/firmeneintrag/', domain: 'unternehmensverzeichnis.org', minutes: 6,
    how: 'Ücretsiz firma kaydı / güncelleme.' },
  { key: 'mittelstand', name: 'Marktplatz Mittelstand', group: 'directory', url: 'https://www.marktplatz-mittelstand.de/registrieren', domain: 'marktplatz-mittelstand.de', minutes: 8,
    how: 'Ücretsiz kayıt; B2B (firma müşterisi) aramalarında görünür. Kategori: Personenbeförderung.' },
  // Found at competitors (munich-airport-taxi.de, flughafentaxi-muenchen.eu, taxi-company24.de), 1 Oct 2026.
  { key: 'golocal', name: 'golocal', group: 'reviews', url: 'https://www.golocal.de/unternehmen/', domain: 'golocal.de', minutes: 8,
    how: 'Rakiplerden taxi-company24.de burada, sitesine link var. „Unternehmen eintragen“ → ücretsiz kayıt, kategori „Taxi“, website + açıklama.' },
  { key: 'cylex', name: 'Cylex', group: 'directory', url: 'https://web2.cylex.de/', domain: 'cylex.de', minutes: 8,
    how: 'Üç rakip de burada. Sitede önce firma adınla ara; yoksa „Firma eintragen“ (ücretsiz). Kategori: Taxiunternehmen, Flughafentransfer.' },
  { key: 'tripadvisor', name: 'Tripadvisor (Taxis & Shuttles)', group: 'reviews', url: 'https://www.tripadvisor.de/Owners', domain: 'tripadvisor.de', minutes: 15,
    how: 'İşletme kaydı aç („Unternehmen eintragen“ → Aktivität/Transfer, Kategorie Taxis & Shuttles, München). Forumlara kendin yazma — reklam sayılıp silinir; bunun yerine memnun turistlerden Tripadvisor yorumu iste.' },
  { key: 'muenchen_de', name: 'muenchen.de Branchenbuch', group: 'directory', url: 'mailto:service@stadtbranchenbuch.de?subject=Firmeneintrag%20Flughafen-M%C3%BCnchen.TAXI', domain: 'muenchen.de', minutes: 5,
    how: 'Şehrin resmi portalı; rakip flughafentaxi-muenchen.eu burada. Kayıt e-postayla: ad/adres/telefon/website + kısa açıklama gönder, ücretsiz temel kaydı ve link’li kaydın fiyatını sor. Ücretliyse önce bana sor.' },
  { key: 'taximat', name: 'taximat.de (Taxi-Verzeichnis)', group: 'directory', url: 'mailto:info@taximat.de?subject=Neuer%20Eintrag%3A%20Flughafen-M%C3%BCnchen.TAXI%20(Freising)', domain: 'taximat.de', minutes: 5,
    how: 'Taksi firmalarına özel rehber, kayıt ücretsiz ve e-postayla. Website linki vermiyor ama ad/adres/telefon kaydı (NAP) olarak işe yarar. E-postaya Firmenname, Adresse, Telefon, Website, Kurzbeschreibung yapıştır.' },
  // golocal data partners (golocal.de/partner), 6 Oct 2026. GoYellow and CleverDialer take their data from
  // Gelbe Seiten / Das Telefonbuch, so they need no entry of their own.
  { key: 'telefonbuch', name: 'Das Telefonbuch', group: 'directory', url: 'https://www.dastelefonbuch.de/Firmeneintrag', domain: 'dastelefonbuch.de', minutes: 6,
    how: 'Ücretsiz „Grundeintrag“ (0 €). Das Örtliche kaydını yaptıysan önce adınla ara — zaten çıkıyorsa sadece website’in doğru olduğunu kontrol et. GoYellow ve Clever Dialer verilerini buradan ve Gelbe Seiten’den alır.' },
  { key: 'kennstdueinen', name: 'KennstDuEinen', group: 'reviews', url: 'https://www.kennstdueinen.de/serviceProvider/registerForm', domain: 'kennstdueinen.de', minutes: 6,
    how: 'Yorum portalı, ücretsiz kayıt. Kategori „Taxi“ / „Flughafentransfer“, website + Kurzbeschreibung DE. Ücretli „Premium“ teklifini geç.' },
  { key: 'dialo', name: 'Dialo / Bundes-Telefonbuch', group: 'directory', url: 'https://www.bundes-telefonbuch.de/firma/grund-eintrag', domain: 'dialo.de', minutes: 6,
    how: 'Ücretsiz „Grundeintrag“ (dialo.de’nin kayıt formu buraya yönlendiriyor). Ücretli paketleri seçme.' },
  { key: 'opendi', name: 'Opendi (Stadtbranchenbuch)', group: 'directory', url: 'https://form.opendi.com/', domain: 'opendi.de', minutes: 8,
    how: 'Ücretsiz kayıt, e-postana doğrulama linki gelir. Tek kayıt Opendi + stadtbranchenbuch.com gibi 5 portalda görünür. Website, açıklama, açılış saatleri (24 Std.) gir.' },
  { key: 'facebook', name: 'Facebook Seite', group: 'social', url: 'https://www.facebook.com/pages/create', domain: 'facebook.com', minutes: 10,
    how: 'Varsa güncelle. Kategori „Taxiunternehmen“, website + telefon + açıklama, kapak fotoğrafı araç.' },
  { key: 'linkedin', name: 'LinkedIn Unternehmensseite', group: 'social', url: 'https://www.linkedin.com/company/setup/new/', domain: 'linkedin.com', minutes: 8,
    how: 'Firma müşterileri (Messe, iş seyahati) için güven. Branche: „Transport per Taxi und Limousine“.' },
  { key: 'instagram', name: 'Instagram (Bio-Link)', group: 'social', url: 'https://www.instagram.com/', domain: 'instagram.com', minutes: 5,
    how: 'Profil → Bearbeiten → Website = https://flughafen-muenchen.taxi. İşletme hesabına çevir, kategori „Taxiunternehmen“.' },
  { key: 'b2b', name: 'Firmenkunden → „Transferpartner“-Link', group: 'partner', url: '', domain: '', minutes: 5,
    how: 'B2B Business sekmesindeki firmalara „Hotel/Partner“ e-postasını uyarla: kendi sitelerinde (Anreise, Karriere/Besucher) seni transfer partneri olarak linklesinler.' },
  { key: 'hotels', name: 'Hotels & Pensionen um den Flughafen', group: 'partner', url: 'https://www.google.com/maps/search/Hotel+Freising', domain: '', minutes: 15,
    how: 'Google Maps’te „Hotel Freising“, „Hotel Hallbergmoos“, „Pension Erding“, „Hotel Moosburg“ ara. Küçük oteller/pansiyonlar en iyi aday: „Anreise“ sayfası olanlara „E-Mail an Hotels“ metnini gönder. Haftada 3–5 otel yeter.' },
];

const GROUPS: Record<Source['group'], string> = { maps: 'Haritalar', directory: 'Firma rehberi', reviews: 'Yorum sitesi', social: 'Sosyal profil', partner: 'Partner' };

type Status = { status: 'done' | 'skip'; at: string; listing_url?: string };

async function statuses(): Promise<Record<string, Status>> {
  const [r] = await query<{ setting_value: string }>(`SELECT setting_value FROM settings WHERE setting_key = ?`, [STATUS_KEY]);
  try { return r?.setting_value ? JSON.parse(r.setting_value) : {}; } catch { return {}; }
}

export async function setOutreachStatus(key: string, status: 'done' | 'skip' | 'todo', listingUrl?: string) {
  if (!SOURCES.some((s) => s.key === key)) throw new Error('unknown entry');
  const all = await statuses();
  if (status === 'todo') delete all[key];
  else all[key] = { status, at: new Date().toISOString(), ...(listingUrl ? { listing_url: listingUrl.slice(0, 500) } : {}) };
  const v = JSON.stringify(all);
  await run(`INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()`, [STATUS_KEY, v, v]);
}

export async function outreachOverview() {
  const st = await statuses();
  // Domains that already link to us (latest Search Console Links upload).
  const [imp] = await query<{ id: number }>(`SELECT id FROM seo_backlink_imports WHERE kind <> 'targets' ORDER BY id DESC LIMIT 1`);
  const linking = imp ? new Set((await query<{ domain: string }>(`SELECT DISTINCT domain FROM seo_backlinks WHERE import_id = ?`, [imp.id])).map((r) => r.domain.toLowerCase())) : new Set<string>();
  const hasLink = (d: string) => !!d && Array.from(linking).some((x) => x === d || x.endsWith(`.${d}`));
  const sources = SOURCES.map((s, i) => ({
    ...s, group_label: GROUPS[s.group], order: i,
    status: (st[s.key]?.status || 'todo') as 'done' | 'skip' | 'todo', done_at: st[s.key]?.at || null, listing_url: st[s.key]?.listing_url || null,
    link_live: hasLink(s.domain),
  }));
  const open = sources.filter((s) => s.status === 'todo');
  // "Today": the next PER_DAY open entries; partner outreach repeats, so it stays open.
  return {
    business: BUSINESS,
    texts: TEXTS,
    sources,
    today: open.slice(0, PER_DAY).map((s) => s.key),
    done: sources.filter((s) => s.status === 'done').length,
    total: sources.length,
    has_links_upload: !!imp,
  };
}
