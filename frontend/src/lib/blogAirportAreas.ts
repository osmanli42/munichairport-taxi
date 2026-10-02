// GENERATED 2 Oct 2026: pick-up areas for the pillar page /blog/taxi-flughafen-muenchen.
//  - stadt: Hauptbahnhof + the 25 Stadtbezirke of Munich (centre point of each district)
//  - landkreis: the 29 Gemeinden of Landkreis München
//  - umland: Freising, Augsburg, Salzburg
// Coordinates from the Google Geocoding API, km/min from the Google Distance Matrix (fastest route to the
// airport), via the site's own /api/maps endpoints. Towns that have a city page use that page's numbers
// (citiesGeo.ts), so both pages show the same price. `fallback` is the price-engine output of 2 Oct 2026,
// only used when the live quote is unreachable. Re-generate if prices/tariffs change a lot.

export interface AreaQuote { kombi: number; van: number; grossraumtaxi: number | null }

export interface AreaData {
  key: string;
  name: string;
  group: 'stadt' | 'landkreis' | 'umland';
  /** Link to the matching city page (only where one exists). */
  href?: string;
  lat: number;
  lng: number;
  km: number;
  min: number;
  address: string;
  fallback: AreaQuote;
}

export const AREA_DATA: AreaData[] = [
  { key: "hbf", name: "Hauptbahnhof", group: "stadt", lat: 48.1403, lng: 11.56, km: 40, min: 37, address: "Hauptbahnhof, 80335 München, Deutschland", fallback: { kombi: 96, van: 106, grossraumtaxi: 109 } },
  { key: "altstadt-lehel", name: "Altstadt-Lehel", group: "stadt", lat: 48.14305, lng: 11.58859, km: 36.3, min: 28, address: "Altstadt-Lehel, München, Deutschland", fallback: { kombi: 95, van: 102.5, grossraumtaxi: 107 } },
  { key: "ludwigsvorstadt-isarvorstadt", name: "Ludwigsvorstadt-Isarvorstadt", group: "stadt", lat: 48.12625, lng: 11.55829, km: 39.8, min: 39, address: "Ludwigsvorstadt-Isarvorstadt, München, Deutschland", fallback: { kombi: 103.5, van: 111.5, grossraumtaxi: 115.5 } },
  { key: "maxvorstadt", name: "Maxvorstadt", group: "stadt", lat: 48.14766, lng: 11.55878, km: 39.2, min: 34, address: "Maxvorstadt, München, Deutschland", fallback: { kombi: 102, van: 110, grossraumtaxi: 114 } },
  { key: "schwabing-west", name: "Schwabing-West", group: "stadt", lat: 48.16785, lng: 11.5711, km: 35.0, min: 28, address: "Schwabing-West, München, Deutschland", fallback: { kombi: 92, van: 99.5, grossraumtaxi: 103.5 } },
  { key: "au-haidhausen", name: "Au-Haidhausen", group: "stadt", lat: 48.12859, lng: 11.59393, km: 38.0, min: 33, address: "Au-Haidhausen, München, Deutschland", fallback: { kombi: 99.5, van: 107, grossraumtaxi: 111 } },
  { key: "sendling", name: "Sendling", group: "stadt", lat: 48.11263, lng: 11.54508, km: 45.6, min: 40, address: "Sendling, München, Deutschland", fallback: { kombi: 118, van: 125.5, grossraumtaxi: 130 } },
  { key: "sendling-westpark", name: "Sendling-Westpark", group: "stadt", lat: 48.11519, lng: 11.51981, km: 42.8, min: 38, address: "Sendling-Westpark, München, Deutschland", fallback: { kombi: 111, van: 118.5, grossraumtaxi: 123 } },
  { key: "schwanthalerhoehe", name: "Schwanthalerhöhe", group: "stadt", lat: 48.13596, lng: 11.53821, km: 40.2, min: 35, address: "Schwanthalerhöhe, München, Deutschland", fallback: { kombi: 104.5, van: 112, grossraumtaxi: 116.5 } },
  { key: "neuhausen-nymphenburg", name: "Neuhausen-Nymphenburg", group: "stadt", lat: 48.15511, lng: 11.52302, km: 39.3, min: 34, address: "Neuhausen-Nymphenburg, München, Deutschland", fallback: { kombi: 102.5, van: 110, grossraumtaxi: 114.5 } },
  { key: "moosach", name: "Moosach", group: "stadt", lat: 48.18111, lng: 11.51155, km: 37.9, min: 30, address: "Moosach, München, Deutschland", fallback: { kombi: 99, van: 106.5, grossraumtaxi: 111 } },
  { key: "milbertshofen-am-hart", name: "Milbertshofen-Am Hart", group: "stadt", lat: 48.21055, lng: 11.57219, km: 32.7, min: 25, address: "Milbertshofen-Am Hart, München, Deutschland", fallback: { kombi: 86.5, van: 94, grossraumtaxi: 98 } },
  { key: "schwabing-freimann", name: "Schwabing-Freimann", group: "stadt", lat: 48.2012, lng: 11.61457, km: 29.6, min: 22, address: "Schwabing-Freimann, München, Deutschland", fallback: { kombi: 78.5, van: 86.5, grossraumtaxi: 90 } },
  { key: "bogenhausen", name: "Bogenhausen", group: "stadt", lat: 48.15736, lng: 11.64925, km: 35.6, min: 30, address: "Bogenhausen, München, Deutschland", fallback: { kombi: 93.5, van: 101, grossraumtaxi: 105 } },
  { key: "berg-am-laim", name: "Berg am Laim", group: "stadt", lat: 48.12732, lng: 11.63468, km: 38.8, min: 32, address: "Berg am Laim, München, Deutschland", fallback: { kombi: 101, van: 109, grossraumtaxi: 113 } },
  { key: "trudering-riem", name: "Trudering-Riem", group: "stadt", lat: 48.12867, lng: 11.68355, km: 46.1, min: 34, address: "Trudering-Riem, München, Deutschland", fallback: { kombi: 119, van: 126.5, grossraumtaxi: 131.5 } },
  { key: "ramersdorf-perlach", name: "Ramersdorf-Perlach", group: "stadt", lat: 48.10361, lng: 11.63356, km: 41.6, min: 37, address: "Ramersdorf-Perlach, München, Deutschland", fallback: { kombi: 108, van: 115.5, grossraumtaxi: 120 } },
  { key: "obergiesing-fasangarten", name: "Obergiesing-Fasangarten", group: "stadt", lat: 48.10539, lng: 11.59148, km: 41.6, min: 37, address: "Obergiesing-Fasangarten, München, Deutschland", fallback: { kombi: 108, van: 115.5, grossraumtaxi: 120 } },
  { key: "untergiesing-harlaching", name: "Untergiesing-Harlaching", group: "stadt", lat: 48.1004, lng: 11.56638, km: 44.1, min: 43, address: "Untergiesing-Harlaching, München, Deutschland", fallback: { kombi: 114, van: 122, grossraumtaxi: 126.5 } },
  { key: "thalkirchen-obersendling-forstenried-fuerstenried-solln", name: "Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln", group: "stadt", lat: 48.09516, lng: 11.52344, km: 45.1, min: 41, address: "Obersendling, München, Deutschland", fallback: { kombi: 116.5, van: 124, grossraumtaxi: 129 } },
  { key: "hadern", name: "Hadern", group: "stadt", lat: 48.11544, lng: 11.47915, km: 52.4, min: 36, address: "Hadern, München, Deutschland", fallback: { kombi: 126, van: 136, grossraumtaxi: 142.5 } },
  { key: "pasing-obermenzing", name: "Pasing-Obermenzing", group: "stadt", lat: 48.14049, lng: 11.46159, km: 50.8, min: 34, address: "Pasing, München, Deutschland", fallback: { kombi: 122.5, van: 132, grossraumtaxi: 138.5 } },
  { key: "aubing-lochhausen-langwied", name: "Aubing-Lochhausen-Langwied", group: "stadt", lat: 48.16112, lng: 11.41359, km: 41.5, min: 32, address: "Aubing, München, Deutschland", fallback: { kombi: 108, van: 115.5, grossraumtaxi: 120 } },
  { key: "allach-untermenzing", name: "Allach-Untermenzing", group: "stadt", lat: 48.19022, lng: 11.46761, km: 37.8, min: 30, address: "Allach, München, Deutschland", fallback: { kombi: 99, van: 106.5, grossraumtaxi: 110.5 } },
  { key: "feldmoching-hasenbergl", name: "Feldmoching-Hasenbergl", group: "stadt", lat: 48.2115, lng: 11.51318, km: 35.4, min: 27, address: "Feldmoching, München, Deutschland", fallback: { kombi: 93, van: 100.5, grossraumtaxi: 104.5 } },
  { key: "laim", name: "Laim", group: "stadt", lat: 48.13707, lng: 11.50245, km: 54.1, min: 39, address: "Laim, München, Deutschland", fallback: { kombi: 130, van: 140, grossraumtaxi: 146.5 } },
  { key: "aschheim", name: "Aschheim", group: "landkreis", href: "/blog/taxi-aschheim-flughafen-muenchen", lat: 48.17231, lng: 11.71591, km: 25.9, min: 23, address: "85609 Aschheim, Deutschland", fallback: { kombi: 69.5, van: 77, grossraumtaxi: 81 } },
  { key: "aying", name: "Aying", group: "landkreis", lat: 47.96999, lng: 11.77666, km: 64.1, min: 44, address: "Aying, Landkreis München, Bayern, Deutschland", fallback: { kombi: 152.5, van: 163, grossraumtaxi: 171 } },
  { key: "baierbrunn", name: "Baierbrunn", group: "landkreis", lat: 48.02034, lng: 11.48338, km: 71.0, min: 54, address: "Baierbrunn, Landkreis München, Bayern, Deutschland", fallback: { kombi: 168, van: 179.5, grossraumtaxi: 188 } },
  { key: "brunnthal", name: "Brunnthal", group: "landkreis", lat: 48.00663, lng: 11.68414, km: 56.6, min: 38, address: "Brunnthal, Landkreis München, Bayern, Deutschland", fallback: { kombi: 135.5, van: 145.5, grossraumtaxi: 153 } },
  { key: "feldkirchen", name: "Feldkirchen", group: "landkreis", href: "/blog/taxi-feldkirchen-flughafen-muenchen", lat: 48.14909, lng: 11.73135, km: 39.4, min: 28, address: "85622 Feldkirchen, Deutschland", fallback: { kombi: 102.5, van: 110.5, grossraumtaxi: 114.5 } },
  { key: "garching-bei-muenchen", name: "Garching bei München", group: "landkreis", href: "/blog/taxi-garching-flughafen-muenchen", lat: 48.24887, lng: 11.65325, km: 24.5, min: 19, address: "85748 Garching bei München, Deutschland", fallback: { kombi: 66, van: 74, grossraumtaxi: 77.5 } },
  { key: "graefelfing", name: "Gräfelfing", group: "landkreis", lat: 48.12274, lng: 11.43405, km: 50.7, min: 35, address: "Gräfelfing, Landkreis München, Bayern, Deutschland", fallback: { kombi: 122.5, van: 132, grossraumtaxi: 138.5 } },
  { key: "grasbrunn", name: "Grasbrunn", group: "landkreis", lat: 48.07834, lng: 11.74457, km: 46.6, min: 32, address: "Grasbrunn, Landkreis München, Bayern, Deutschland", fallback: { kombi: 120.5, van: 128, grossraumtaxi: 132.5 } },
  { key: "gruenwald", name: "Grünwald", group: "landkreis", lat: 48.04411, lng: 11.53214, km: 65.2, min: 46, address: "Grünwald, Landkreis München, Bayern, Deutschland", fallback: { kombi: 155, van: 166, grossraumtaxi: 173.5 } },
  { key: "haar", name: "Haar", group: "landkreis", href: "/blog/taxi-haar-flughafen-muenchen", lat: 48.11038, lng: 11.73212, km: 45.6, min: 33, address: "85540 Haar, Deutschland", fallback: { kombi: 118, van: 125.5, grossraumtaxi: 130 } },
  { key: "hohenbrunn", name: "Hohenbrunn", group: "landkreis", lat: 48.04811, lng: 11.70206, km: 50.9, min: 33, address: "Hohenbrunn, Landkreis München, Bayern, Deutschland", fallback: { kombi: 123, van: 132.5, grossraumtaxi: 139 } },
  { key: "hoehenkirchen-siegertsbrunn", name: "Höhenkirchen-Siegertsbrunn", group: "landkreis", lat: 48.01949, lng: 11.71909, km: 56.0, min: 38, address: "Höhenkirchen-Siegertsbrunn, Landkreis München, Bayern, Deutschland", fallback: { kombi: 134, van: 144.5, grossraumtaxi: 151.5 } },
  { key: "ismaning", name: "Ismaning", group: "landkreis", href: "/blog/taxi-ismaning-flughafen-muenchen", lat: 48.2259, lng: 11.67427, km: 20.7, min: 21, address: "85737 Ismaning, Deutschland", fallback: { kombi: 57, van: 64.5, grossraumtaxi: 68 } },
  { key: "kirchheim-bei-muenchen", name: "Kirchheim bei München", group: "landkreis", href: "/blog/taxi-kirchheim-bei-muenchen-flughafen-muenchen", lat: 48.17571, lng: 11.75582, km: 36.7, min: 25, address: "Kirchheim bei München, Deutschland", fallback: { kombi: 96, van: 103.5, grossraumtaxi: 108 } },
  { key: "neubiberg", name: "Neubiberg", group: "landkreis", href: "/blog/taxi-neubiberg-flughafen-muenchen", lat: 48.0747, lng: 11.67146, km: 51.4, min: 40, address: "Neubiberg, Deutschland", fallback: { kombi: 124, van: 133.5, grossraumtaxi: 140 } },
  { key: "neuried", name: "Neuried", group: "landkreis", lat: 48.09314, lng: 11.46575, km: 55.0, min: 39, address: "Neuried, Landkreis München, Bayern, Deutschland", fallback: { kombi: 132, van: 142, grossraumtaxi: 149 } },
  { key: "oberhaching", name: "Oberhaching", group: "landkreis", lat: 48.02773, lng: 11.58692, km: 61.4, min: 41, address: "Oberhaching, Landkreis München, Bayern, Deutschland", fallback: { kombi: 146.5, van: 157, grossraumtaxi: 164.5 } },
  { key: "oberschleissheim", name: "Oberschleißheim", group: "landkreis", href: "/blog/taxi-oberschleissheim-flughafen-muenchen", lat: 48.25225, lng: 11.55906, km: 26.2, min: 21, address: "Oberschleißheim, Deutschland", fallback: { kombi: 70.5, van: 78, grossraumtaxi: 81.5 } },
  { key: "ottobrunn", name: "Ottobrunn", group: "landkreis", href: "/blog/taxi-ottobrunn-flughafen-muenchen", lat: 48.06405, lng: 11.66521, km: 55.8, min: 41, address: "85521 Ottobrunn, Deutschland", fallback: { kombi: 134, van: 144, grossraumtaxi: 151 } },
  { key: "planegg", name: "Planegg", group: "landkreis", lat: 48.10588, lng: 11.42372, km: 51.4, min: 34, address: "Planegg, Landkreis München, Bayern, Deutschland", fallback: { kombi: 124, van: 133.5, grossraumtaxi: 140 } },
  { key: "pullach-im-isartal", name: "Pullach im Isartal", group: "landkreis", lat: 48.05745, lng: 11.51914, km: 52.1, min: 53, address: "Pullach im Isartal, Landkreis München, Bayern, Deutschland", fallback: { kombi: 125.5, van: 135, grossraumtaxi: 142 } },
  { key: "putzbrunn", name: "Putzbrunn", group: "landkreis", lat: 48.07537, lng: 11.71582, km: 51.1, min: 33, address: "Putzbrunn, Landkreis München, Bayern, Deutschland", fallback: { kombi: 123, van: 133, grossraumtaxi: 139.5 } },
  { key: "sauerlach", name: "Sauerlach", group: "landkreis", lat: 47.97182, lng: 11.65399, km: 62.9, min: 42, address: "Sauerlach, Landkreis München, Bayern, Deutschland", fallback: { kombi: 150, van: 160.5, grossraumtaxi: 168 } },
  { key: "schaeftlarn", name: "Schäftlarn", group: "landkreis", lat: 47.9903, lng: 11.45734, km: 61.8, min: 50, address: "Schäftlarn, Landkreis München, Bayern, Deutschland", fallback: { kombi: 147.5, van: 158, grossraumtaxi: 165.5 } },
  { key: "strasslach-dingharting", name: "Straßlach-Dingharting", group: "landkreis", lat: 47.98153, lng: 11.52, km: 69, min: 51, address: "Straßlach-Dingharting, Landkreis München, Bayern, Deutschland", fallback: { kombi: 163.5, van: 174.5, grossraumtaxi: 183 } },
  { key: "taufkirchen", name: "Taufkirchen", group: "landkreis", href: "/blog/taxi-taufkirchen-bei-muenchen-flughafen-muenchen", lat: 48.0465, lng: 11.61676, km: 60.5, min: 40, address: "Taufkirchen, Deutschland", fallback: { kombi: 144.5, van: 155, grossraumtaxi: 162.5 } },
  { key: "unterfoehring", name: "Unterföhring", group: "landkreis", href: "/blog/taxi-unterfoehring-flughafen-muenchen", lat: 48.19166, lng: 11.64604, km: 32.6, min: 25, address: "85774 Unterföhring, Deutschland", fallback: { kombi: 86, van: 93.5, grossraumtaxi: 97.5 } },
  { key: "unterhaching", name: "Unterhaching", group: "landkreis", href: "/blog/taxi-unterhaching-flughafen-muenchen", lat: 48.0654, lng: 11.62242, km: 45.7, min: 40, address: "Unterhaching, Deutschland", fallback: { kombi: 118, van: 125.5, grossraumtaxi: 130.5 } },
  { key: "unterschleissheim", name: "Unterschleißheim", group: "landkreis", href: "/blog/taxi-unterschleissheim-flughafen-muenchen", lat: 48.28412, lng: 11.5672, km: 20.5, min: 17, address: "85716 Unterschleißheim, Deutschland", fallback: { kombi: 56.5, van: 64, grossraumtaxi: 67.5 } },
  { key: "freising", name: "Freising", group: "umland", href: "/blog/taxi-freising-flughafen-muenchen", lat: 48.40145, lng: 11.74135, km: 12.5, min: 17, address: "Freising, Deutschland", fallback: { kombi: 37.5, van: 44.5, grossraumtaxi: 47.5 } },
  { key: "augsburg", name: "Augsburg", group: "umland", href: "/blog/taxi-augsburg-flughafen-muenchen", lat: 48.37054, lng: 10.89779, km: 87.5, min: 58, address: "Augsburg, Deutschland", fallback: { kombi: 205, van: 218, grossraumtaxi: 228 } },
  { key: "salzburg", name: "Salzburg", group: "umland", href: "/blog/taxi-salzburg-flughafen-muenchen", lat: 47.80142, lng: 13.04484, km: 182.8, min: 123, address: "Salzburg, Österreich", fallback: { kombi: 419.5, van: 441, grossraumtaxi: 459.5 } },
];
