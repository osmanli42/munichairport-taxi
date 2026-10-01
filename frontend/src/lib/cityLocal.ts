// Hand-written local content per city landing page (/blog/[citySlug]): route description,
// typical pickup points and practical tips — the part that makes each page unique. Cities
// without an entry get a generated route paragraph from cityGeo (lib/citiesGeo.ts).

type Lang = 'de' | 'en' | 'tr';

export interface CityLocal {
  route: Record<Lang, string>;
  pickups: Record<Lang, string[]>;
  tips: Record<Lang, string[]>;
  /** Turkish city texts (overview, history, known for, sights) — without them the TR page hides the city section. */
  tr?: { description: string; history: string; known_for: string; sights: string[] };
}

export const cityLocal: Record<string, CityLocal> = {
  'taxi-dachau-flughafen-muenchen': {
    route: {
      de: 'Von Dachau fahren wir über Oberschleißheim auf die A92 und von dort direkt zum Flughafen – ohne Umweg durch die Münchner Innenstadt. Normalerweise sind Sie in knapp einer halben Stunde am Terminal, im morgendlichen Berufsverkehr ein paar Minuten später. Öffentlich geht es nur mit Umstieg in München; mit Koffern dauert das meist deutlich über eine Stunde.',
      en: 'From Dachau we drive via Oberschleißheim onto the A92 and straight to the airport – no detour through Munich city centre. Usually you reach the terminal in just under half an hour, a few minutes later in the morning rush hour. By public transport you have to change trains in Munich, which with luggage usually takes well over an hour.',
      tr: 'Dachau’dan Oberschleißheim üzerinden A92 otoyoluna çıkıp doğrudan havalimanına gidiyoruz – Münih şehir merkezinden dolaşmadan. Normalde yarım saatten kısa sürede terminaldesiniz, sabah trafiğinde birkaç dakika daha uzun. Toplu taşımayla Münih’te aktarma gerekir; valizle genellikle bir saati rahatça geçer.',
    },
    pickups: {
      de: ['Bahnhof Dachau', 'Altstadt & Rathausplatz', 'KZ-Gedenkstätte (Besucherzentrum)', 'Dachau-Ost & Augustenfeld', 'Etzenhausen & Mitterndorf', 'Hotels in Dachau'],
      en: ['Dachau railway station', 'Old town & Rathausplatz', 'Dachau Memorial Site (visitor centre)', 'Dachau-Ost & Augustenfeld', 'Etzenhausen & Mitterndorf', 'Hotels in Dachau'],
      tr: ['Dachau tren istasyonu', 'Eski şehir & Rathausplatz', 'KZ-Anıt Alanı (ziyaretçi merkezi)', 'Dachau-Ost & Augustenfeld', 'Etzenhausen & Mitterndorf', 'Dachau’daki oteller'],
    },
    tips: {
      de: [
        'Frühflug? Vor 6 Uhr ist die A92 frei – rechnen Sie mit gut 25 Minuten Fahrzeit.',
        'Nach dem Besuch der KZ-Gedenkstätte direkt zum Flug: Wir holen Sie am Besucherzentrum ab – einfach als Abholort angeben.',
        'Für Familien und Gruppen bis 8 Personen gibt es Van und Großraumtaxi zum Festpreis – kein zweites Taxi nötig.',
      ],
      en: [
        'Early flight? Before 6 am the A92 is clear – allow a good 25 minutes.',
        'Straight from the Dachau Memorial Site to your flight: we pick you up at the visitor centre – just enter it as your pickup point.',
        'Families and groups up to 8 people travel in a van or large taxi at a fixed price – no second taxi needed.',
      ],
      tr: [
        'Erken uçuş mu? Saat 6’dan önce A92 boştur – yaklaşık 25 dakika hesaplayın.',
        'KZ-Anıt Alanı ziyaretinden doğrudan uçağa: Sizi ziyaretçi merkezinden alırız – alış yeri olarak girmeniz yeterli.',
        '8 kişiye kadar aile ve gruplar için sabit fiyatlı Van ve büyük taksi – ikinci taksiye gerek yok.',
      ],
    },
    tr: {
      description: 'Dachau, Münih’in kuzeybatısında, Münih metropol bölgesinin parçası olan büyük bir ilçe şehridir. Yaklaşık 48.000 nüfusu vardır ve S-Bahn ile Münih’e doğrudan bağlıdır.',
      history: 'Orta Çağ’da pazar yeri olarak kurulan Dachau, 19. yüzyılda pek çok izlenimci ressamı çeken sanatçı kolonisiyle tanındı. 20. yüzyılda adı, 1933’te burada kurulan ilk Nazi toplama kampı nedeniyle dünyaca bilinir hale geldi; bugün KZ-Anıt Alanı her yıl yüz binlerce ziyaretçiyi ağırlıyor. Günümüzde Dachau canlı bir sanat ortamına sahip modern bir yerleşim şehridir.',
      known_for: 'Sanatçı kolonisi, KZ-Anıt Alanı, Münih çevresi',
      sights: ['KZ-Anıt Alanı Dachau', 'Dachau Sarayı ve saray bahçesi', 'Gemäldegalerie Dachau (resim galerisi)', 'Eski şehir ve ressamlar mahallesi', 'Belediye binası ve St. Jakob kilisesi'],
    },
  },
};
