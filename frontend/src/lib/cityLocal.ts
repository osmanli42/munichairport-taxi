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
  'taxi-freising-flughafen-muenchen': {
        "route": {
              "de": "Freising ist der nächste größere Ort am Flughafen: Von der Altstadt geht es südlich über die Isar direkt zu den Terminals – meist in unter 20 Minuten, auch im Berufsverkehr. Mit Gepäck ist das Taxi deutlich bequemer als Bus oder S-Bahn mit Umstieg.",
              "en": "Freising is the closest town of any size to the airport: from the old town we cross the Isar southwards straight to the terminals – usually in under 20 minutes, even at rush hour. With luggage a taxi is far more convenient than bus or S-Bahn with a change.",
              "tr": "Freising havalimanına en yakın büyük şehir: Eski şehirden güneye, İsar’ı geçip doğrudan terminallere gidiyoruz – iş trafiğinde bile genellikle 20 dakikadan kısa. Valizle taksi, aktarmalı otobüs veya S-Bahn’dan çok daha rahattır."
        },
        "pickups": {
              "de": [
                    "Bahnhof Freising",
                    "Altstadt & Marienplatz",
                    "Domberg",
                    "Campus Weihenstephan",
                    "Klinikum Freising",
                    "Lerchenfeld, Vötting & Neustift"
              ],
              "en": [
                    "Freising railway station",
                    "Old town & Marienplatz",
                    "Cathedral hill (Domberg)",
                    "Weihenstephan campus",
                    "Freising hospital",
                    "Lerchenfeld, Vötting & Neustift"
              ],
              "tr": [
                    "Freising tren istasyonu",
                    "Eski şehir & Marienplatz",
                    "Domberg (katedral tepesi)",
                    "Weihenstephan kampüsü",
                    "Freising hastanesi",
                    "Lerchenfeld, Vötting & Neustift"
              ]
        },
        "tips": {
              "de": [
                    "Kurze Strecke, fester Preis: Auch für die wenigen Kilometer zum Terminal wissen Sie den Preis vor der Buchung.",
                    "Studierende in Weihenstephan mit viel Gepäck: Abholung direkt am Wohnheim oder Campus.",
                    "Auf den Domberg fahren wir bis vor die Tür, soweit die Zufahrt erlaubt ist – sonst holen wir Sie am Fuß des Dombergs ab."
              ],
              "en": [
                    "Short ride, fixed price: even for the few kilometres to the terminal you know the price before you book.",
                    "Students at Weihenstephan with lots of luggage: pickup right at your residence or campus.",
                    "On the cathedral hill we drive to your door where access is allowed – otherwise we pick you up at the foot of the Domberg."
              ],
              "tr": [
                    "Kısa yol, sabit fiyat: Terminale birkaç kilometre için bile fiyatı rezervasyondan önce bilirsiniz.",
                    "Weihenstephan’daki öğrenciler, çok bagajınız mı var? Yurt veya kampüsten alırız.",
                    "Domberg’de girişe izin verilen yere kadar çıkarız – aksi halde sizi Domberg’in eteğinden alırız."
              ]
        },
        "tr": {
              "description": "Freising, Münih Havalimanı’nın hemen yanında yer alır ve 1.300 yılı aşkın geçmişiyle Bavyera’nın en eski piskoposluk şehirlerinden biridir.",
              "history": "Freising yüzyıllar boyunca Münih’ten bile önce Bavyera’nın dini ve kültürel merkeziydi. Katedral ve Piskoposluk Müzesi’yle Domberg, Güney Almanya’nın en önemli Orta Çağ yapı topluluklarından biridir. 1040’ta kurulan Weihenstephan bira fabrikası dünyanın en eski bira fabrikası olarak kabul edilir. Papa XVI. Benedikt (Joseph Ratzinger) Freising’de rahip olarak takdis edildi.",
              "known_for": "Domberg, dünyanın en eski bira fabrikası, havalimanına yakınlık",
              "sights": [
                    "Freising Katedrali",
                    "Piskoposluk Müzesi",
                    "Weihenstephan – dünyanın en eski bira fabrikası",
                    "Eski şehir ve Marienplatz",
                    "Domberg seyir terası"
              ]
        }
  },
  'taxi-erding-flughafen-muenchen': {
        "route": {
              "de": "Von Erding ist der Flughafen über die Flughafentangente Ost in rund einer Viertelstunde erreicht – ohne Autobahn und ohne Umweg über München. Auch morgens im Berufsverkehr bleibt die Fahrzeit kurz.",
              "en": "From Erding the airport is about a quarter of an hour away via the Flughafentangente Ost – no motorway, no detour via Munich. The ride stays short even in the morning rush hour.",
              "tr": "Erding’den havalimanına Flughafentangente Ost üzerinden yaklaşık çeyrek saatte ulaşılır – otoyol yok, Münih’ten dolaşma yok. Sabah iş trafiğinde bile yolculuk kısa kalır."
        },
        "pickups": {
              "de": [
                    "Bahnhof Erding (S2)",
                    "Altstadt & Schöner Turm",
                    "Therme Erding",
                    "Klinikum Erding",
                    "Altenerding & Klettham",
                    "Hotels in Erding"
              ],
              "en": [
                    "Erding station (S2)",
                    "Old town & Schöner Turm",
                    "Therme Erding spa",
                    "Erding hospital",
                    "Altenerding & Klettham",
                    "Hotels in Erding"
              ],
              "tr": [
                    "Erding istasyonu (S2)",
                    "Eski şehir & Schöner Turm",
                    "Therme Erding",
                    "Erding hastanesi",
                    "Altenerding & Klettham",
                    "Erding’deki oteller"
              ]
        },
        "tips": {
              "de": [
                    "Nach der Landung direkt in die Therme? Wir fahren Sie mit Gepäck vom Terminal zur Therme Erding oder zum Hotel.",
                    "Zum Erdinger Herbstfest viel Verkehr in der Innenstadt – planen Sie ein paar Minuten mehr ein.",
                    "Für Firmen im Erdinger Raum: Fahrten auf Rechnung mit monatlicher Sammelrechnung."
              ],
              "en": [
                    "Straight to the spa after landing? We drive you with your luggage from the terminal to Therme Erding or your hotel.",
                    "During the Erding autumn festival the town centre is busy – allow a few extra minutes.",
                    "For companies around Erding: rides on account with a monthly invoice."
              ],
              "tr": [
                    "İnişten sonra doğrudan termal tesise mi? Sizi valizinizle terminalden Therme Erding’e veya otelinize götürürüz.",
                    "Erding sonbahar festivali sırasında şehir merkezi yoğundur – birkaç dakika fazla hesaplayın.",
                    "Erding bölgesindeki firmalar için: aylık toplu faturalı yolculuk."
              ]
        },
        "tr": {
              "description": "Erding, Münih Havalimanı’nın doğusunda yer alır; termal tesisi, buğday birası ve hızla büyüyen bir ilçe merkezi olarak bilinir.",
              "history": "Erding’in tarihi eski şehri, simgesi Schöner Turm ile Orta Çağ’dan kalmadır. 20. yüzyılda şehir, 1992’den beri işletilen Münih Havalimanı’ndan güçlü şekilde etkilendi. Bugün Erding, Bavyera’nın en hızlı büyüyen şehirlerinden biridir.",
              "known_for": "Therme Erding, Erdinger buğday birası, havalimanına yakınlık",
              "sights": [
                    "Therme Erding",
                    "Eski şehir ve Schöner Turm",
                    "Frauenkirche Erding",
                    "Erdinger Weißbräu bira fabrikası",
                    "Erding Müzesi"
              ]
        }
  },
  'taxi-muenchen-flughafen-muenchen': {
        "route": {
              "de": "Aus der Münchner Innenstadt fahren wir über den Mittleren Ring und die A9 zum Flughafen – je nach Stadtteil 30 bis 45 Minuten. Im Berufsverkehr und bei Messen kann es länger dauern; frühmorgens ist die Strecke meist frei.",
              "en": "From central Munich we take the Middle Ring Road and the A9 to the airport – 30 to 45 minutes depending on the district. Rush hour and trade fairs can add time; early in the morning the road is usually clear.",
              "tr": "Münih şehir merkezinden Mittlerer Ring ve A9 üzerinden havalimanına gidiyoruz – semte göre 30 ila 45 dakika. İş trafiğinde ve fuar dönemlerinde süre uzayabilir; sabah erken saatlerde yol genellikle boştur."
        },
        "pickups": {
              "de": [
                    "Hauptbahnhof",
                    "Altstadt & Marienplatz",
                    "Schwabing & Maxvorstadt",
                    "Messe München (Riem)",
                    "Olympiapark",
                    "Hotels in der Innenstadt"
              ],
              "en": [
                    "Central station (Hauptbahnhof)",
                    "Old town & Marienplatz",
                    "Schwabing & Maxvorstadt",
                    "Messe München (Riem)",
                    "Olympic Park",
                    "City-centre hotels"
              ],
              "tr": [
                    "Merkez istasyon (Hauptbahnhof)",
                    "Eski şehir & Marienplatz",
                    "Schwabing & Maxvorstadt",
                    "Messe München (Riem)",
                    "Olimpiyat Parkı",
                    "Şehir merkezindeki oteller"
              ]
        },
        "tips": {
              "de": [
                    "Für Hauptbahnhof und Messe München gibt es feste Routenpreise – der Preis steht bei der Buchung sofort fest.",
                    "Während der Wiesn und großer Messen früher buchen: Taxis in der Stadt sind dann knapp.",
                    "Geben Sie Ihre genaue Adresse ein – der Preis hängt vom Stadtteil ab und wird sofort angezeigt."
              ],
              "en": [
                    "Central station and Messe München have fixed route prices – you see the price immediately when booking.",
                    "Book early during Oktoberfest and major trade fairs: taxis in the city are scarce then.",
                    "Enter your exact address – the price depends on the district and is shown instantly."
              ],
              "tr": [
                    "Merkez istasyon ve Messe München için sabit güzergâh fiyatları var – fiyatı rezervasyonda hemen görürsünüz.",
                    "Oktoberfest ve büyük fuarlarda erken rezervasyon yapın: Şehirde taksi bulmak zorlaşır.",
                    "Tam adresinizi girin – fiyat semte göre değişir ve hemen görünür."
              ]
        },
        "tr": {
              "description": "Münih, Bavyera’nın başkenti ve Almanya’nın üçüncü büyük şehridir – Oktoberfest’in ve FC Bayern’in evi.",
              "history": "Aslan Heinrich Münih’i 1158’de İsar kıyısında kurdu. 19. yüzyılda Kral I. Ludwig döneminde görkemli bir saray şehrine dönüştü. Hofbräuhaus, Frauenkirche ve Pinakotheken dünyaca ünlüdür. Bugün Münih teknoloji, medya ve sanatın küresel merkezlerinden biridir.",
              "known_for": "Oktoberfest, FC Bayern, Residenz, dünya şehri",
              "sights": [
                    "Marienplatz ve Yeni Belediye Binası",
                    "İngiliz Bahçesi",
                    "Frauenkirche",
                    "Deutsches Museum",
                    "Olimpiyat Parkı"
              ]
        }
  },
  'taxi-landshut-flughafen-muenchen': {
        "route": {
              "de": "Von Landshut geht es über die A92 direkt zum Flughafen – rund 40 km und gut eine halbe Stunde Fahrt, ohne Umweg über München.",
              "en": "From Landshut we take the A92 straight to the airport – about 40 km and just over half an hour, no detour via Munich.",
              "tr": "Landshut’tan A92 ile doğrudan havalimanına gidiyoruz – yaklaşık 40 km ve yarım saatten biraz fazla, Münih’ten dolaşmadan."
        },
        "pickups": {
              "de": [
                    "Hauptbahnhof Landshut",
                    "Altstadt & St. Martin",
                    "Burg Trausnitz",
                    "Klinikum Landshut",
                    "Hochschule Landshut",
                    "Achdorf & Berg"
              ],
              "en": [
                    "Landshut central station",
                    "Old town & St. Martin",
                    "Trausnitz Castle",
                    "Landshut hospital",
                    "Landshut University of Applied Sciences",
                    "Achdorf & Berg"
              ],
              "tr": [
                    "Landshut merkez istasyon",
                    "Eski şehir & St. Martin",
                    "Trausnitz Kalesi",
                    "Landshut hastanesi",
                    "Landshut Uygulamalı Bilimler Üniversitesi",
                    "Achdorf & Berg"
              ]
        },
        "tips": {
              "de": [
                    "Für Landshut gibt es einen festen Routenpreis zum Flughafen – unabhängig von Verkehr und Uhrzeit.",
                    "Zur Landshuter Hochzeit (nächste 2027) ist die Altstadt teilweise gesperrt – wir holen Sie dann am Rand ab.",
                    "Frühflug: Um 4 Uhr morgens sind Sie in gut 30 Minuten am Terminal."
              ],
              "en": [
                    "Landshut has a fixed route price to the airport – regardless of traffic and time of day.",
                    "During the Landshut Wedding festival (next in 2027) parts of the old town are closed – we then pick you up at the edge.",
                    "Early flight: at 4 am you reach the terminal in just over 30 minutes."
              ],
              "tr": [
                    "Landshut için havalimanına sabit güzergâh fiyatı var – trafik ve saatten bağımsız.",
                    "Landshut Düğünü festivalinde (sonraki 2027) eski şehrin bir kısmı kapalıdır – o zaman sizi kenardan alırız.",
                    "Erken uçuş: Sabah 4’te terminale 30 dakikadan biraz fazla sürede varırsınız."
              ]
        },
        "tr": {
              "description": "Landshut, Aşağı Bavyera’nın başkentidir; dünyanın en yüksek tuğla kilisesi St. Martin, Trausnitz Kalesi ve tarihi Landshut Düğünü ile tanınır.",
              "history": "Landshut 1204’te Dük I. Ludwig tarafından kuruldu ve Orta Çağ’da Aşağı Bavyera Wittelsbach’larının saray şehriydi. 1475’teki Landshut Düğünü Orta Çağ’ın en görkemli düğün şenliğiydi ve 1903’ten beri dört yılda bir canlandırılıyor. 130,6 metrelik kulesiyle St. Martin kilisesinin bulunduğu eski şehir önemli bir anıttır.",
              "known_for": "Landshut Düğünü, St. Martin, Aşağı Bavyera’nın başkenti",
              "sights": [
                    "St. Martin kilisesi (dünyanın en yüksek tuğla kulesi)",
                    "Trausnitz Kalesi",
                    "Eski şehir",
                    "Şehir Sarayı (İtalyan Rönesansı)",
                    "İsar kıyısı"
              ]
        }
  },
  'taxi-unterschleissheim-flughafen-muenchen': {
        "route": {
              "de": "Von Unterschleißheim fahren wir über die A92 zum Flughafen – rund 20 km und meist unter 20 Minuten. Die Strecke führt nicht durch München und ist auch morgens selten verstopft.",
              "en": "From Unterschleißheim we take the A92 to the airport – about 20 km and usually under 20 minutes. The route avoids Munich and is rarely congested, even in the morning.",
              "tr": "Unterschleißheim’dan A92 üzerinden havalimanına gidiyoruz – yaklaşık 20 km ve genellikle 20 dakikadan kısa. Güzergâh Münih’ten geçmez, sabahları bile nadiren tıkanır."
        },
        "pickups": {
              "de": [
                    "S-Bahnhof Unterschleißheim (S1)",
                    "Business Campus & Gewerbegebiete",
                    "BMW-Campus",
                    "Unterschleißheimer See",
                    "Lohhof",
                    "Hotels in Unterschleißheim"
              ],
              "en": [
                    "Unterschleißheim station (S1)",
                    "Business campus & business parks",
                    "BMW campus",
                    "Lake Unterschleißheim",
                    "Lohhof",
                    "Hotels in Unterschleißheim"
              ],
              "tr": [
                    "Unterschleißheim istasyonu (S1)",
                    "İş kampüsü ve iş parkları",
                    "BMW kampüsü",
                    "Unterschleißheim Gölü",
                    "Lohhof",
                    "Unterschleißheim’daki oteller"
              ]
        },
        "tips": {
              "de": [
                    "Geschäftsreise? Abholung direkt am Firmeneingang, Rechnung auf Ihr Unternehmen.",
                    "Für Kollegen und Besucher: Fahrten im Voraus buchen und mit Namensschild am Terminal abholen lassen.",
                    "Frühflug: Die A92 ist vor 6 Uhr frei – rund 16 Minuten bis zum Terminal."
              ],
              "en": [
                    "Business trip? Pickup right at the company entrance, invoice to your company.",
                    "For colleagues and visitors: book rides in advance and have them met with a name sign at the terminal.",
                    "Early flight: the A92 is clear before 6 am – about 16 minutes to the terminal."
              ],
              "tr": [
                    "İş seyahati mi? Şirket girişinden alış, faturası şirketinize.",
                    "Meslektaşlar ve ziyaretçiler için: Önceden rezervasyon yapın, terminalde isim tabelasıyla karşılansınlar.",
                    "Erken uçuş: A92 saat 6’dan önce boştur – terminale yaklaşık 16 dakika."
              ]
        },
        "tr": {
              "description": "Unterschleißheim, Münih’in kuzeyinde A9’un hemen yanında yer alır; BMW’nin otonom sürüş kampüsüne ev sahipliği yapan bir iş merkezi ve hızla büyüyen bir şehirdir.",
              "history": "Unterschleißheim 1960’lara kadar küçük bir köydü. Sanayi ve yeni konut alanlarıyla hızla büyüdü. Bugün Münih’in kuzeyinde mükemmel altyapıya sahip önemli bir ekonomi merkezidir.",
              "known_for": "BMW kampüsü, Münih’in kuzeyi, göl",
              "sights": [
                    "Unterschleißheim Gölü (yüzme)",
                    "BMW otonom sürüş kampüsü",
                    "Schleißheim sarayları (komşu Oberschleißheim’da)",
                    "Unterschleißheim kültür merkezi"
              ]
        }
  },
  'taxi-ismaning-flughafen-muenchen': {
        "route": {
              "de": "Ismaning liegt nur gut 20 km vom Flughafen entfernt; wir fahren nördlich am Speichersee vorbei zu den Terminals – meist in rund 20 Minuten.",
              "en": "Ismaning is just over 20 km from the airport; we drive north past the reservoir to the terminals – usually in about 20 minutes.",
              "tr": "Ismaning havalimanına sadece 20 km kadar uzaklıkta; kuzeye, baraj gölünün yanından terminallere gidiyoruz – genellikle yaklaşık 20 dakika."
        },
        "pickups": {
              "de": [
                    "S-Bahnhof Ismaning (S8)",
                    "Schloss & Rathaus",
                    "Gewerbegebiet Ismaning",
                    "Hotels in Ismaning",
                    "Fischerhäuser & Speichersee"
              ],
              "en": [
                    "Ismaning station (S8)",
                    "Palace & town hall",
                    "Ismaning business park",
                    "Hotels in Ismaning",
                    "Fischerhäuser & reservoir"
              ],
              "tr": [
                    "Ismaning istasyonu (S8)",
                    "Saray & belediye",
                    "Ismaning iş parkı",
                    "Ismaning’deki oteller",
                    "Fischerhäuser & baraj gölü"
              ]
        },
        "tips": {
              "de": [
                    "Kurze Fahrt zum Festpreis – ideal für Geschäftsreisende aus den Ismaninger Firmen.",
                    "Messe- und Firmenbesucher holen wir mit Namensschild am Terminal ab und bringen sie direkt ins Büro oder Hotel.",
                    "Frühflug: Vor 6 Uhr sind Sie in knapp 20 Minuten am Terminal."
              ],
              "en": [
                    "Short ride at a fixed price – ideal for business travellers from Ismaning companies.",
                    "We meet trade-fair and company visitors with a name sign at the terminal and take them straight to the office or hotel.",
                    "Early flight: before 6 am you are at the terminal in just under 20 minutes."
              ],
              "tr": [
                    "Sabit fiyatlı kısa yolculuk – Ismaning’deki firmaların iş seyahatleri için ideal.",
                    "Fuar ve firma ziyaretçilerini terminalde isim tabelasıyla karşılar, doğrudan ofise veya otele götürürüz.",
                    "Erken uçuş: Saat 6’dan önce terminale 20 dakikadan kısa sürede varırsınız."
              ]
        },
        "tr": {
              "description": "Ismaning, Münih’in kuzeydoğusunda yer alır; bir medya merkezi ve Ismaning Sarayı ile tanınır.",
              "history": "Ismaning’in 1.000 yılı aşkın bir tarihi vardır. Ismaning Sarayı, Freising prens-piskoposlarının yazlık konutuydu. 20. yüzyılda pek çok medya şirketi buraya yerleşti. Ismaning baraj gölü ve balık havuzları önemli bir kuş koruma alanıdır.",
              "known_for": "Medya merkezi, Ismaning Sarayı, kuş koruma alanı",
              "sights": [
                    "Ismaning Sarayı (müze)",
                    "Ismaning baraj gölü (kuş koruma alanı)",
                    "Saray bahçesi",
                    "İsar vadisi"
              ]
        }
  },
  'taxi-garching-flughafen-muenchen': {
        "route": {
              "de": "Von Garching und dem Forschungszentrum geht es über A9 und A92 zum Flughafen – rund 25 km und knapp 20 Minuten.",
              "en": "From Garching and the research campus we take the A9 and A92 to the airport – about 25 km and just under 20 minutes.",
              "tr": "Garching ve araştırma kampüsünden A9 ve A92 üzerinden havalimanına gidiyoruz – yaklaşık 25 km ve 20 dakikadan biraz az."
        },
        "pickups": {
              "de": [
                    "Campus Garching (TUM)",
                    "U-Bahnhof Garching-Forschungszentrum",
                    "Max-Planck-Institute & ESO",
                    "Garching Ortszentrum",
                    "Hochbrück (Gewerbegebiet)",
                    "Hotels in Garching"
              ],
              "en": [
                    "Garching campus (TUM)",
                    "Garching-Forschungszentrum U-Bahn station",
                    "Max Planck Institutes & ESO",
                    "Garching town centre",
                    "Hochbrück business area",
                    "Hotels in Garching"
              ],
              "tr": [
                    "Garching kampüsü (TUM)",
                    "Garching-Forschungszentrum metro istasyonu",
                    "Max Planck Enstitüleri & ESO",
                    "Garching merkez",
                    "Hochbrück iş bölgesi",
                    "Garching’deki oteller"
              ]
        },
        "tips": {
              "de": [
                    "Konferenz- und Gastwissenschaftler: Wir holen Sie mit Namensschild am Terminal ab und fahren direkt zum Institut.",
                    "Für Institute und Lehrstühle: Fahrten auf Rechnung mit Sammelrechnung.",
                    "Viel Gepäck oder Messgeräte? Wählen Sie den Van – bis 8 Koffer."
              ],
              "en": [
                    "Conference guests and visiting researchers: we meet you with a name sign at the terminal and drive straight to the institute.",
                    "For institutes and chairs: rides on account with a collective invoice.",
                    "Lots of luggage or equipment? Choose the van – up to 8 suitcases."
              ],
              "tr": [
                    "Konferans konukları ve misafir araştırmacılar: Sizi terminalde isim tabelasıyla karşılar, doğrudan enstitüye götürürüz.",
                    "Enstitüler ve kürsüler için: Toplu faturalı yolculuk.",
                    "Çok bagaj veya ekipman mı? Van’ı seçin – 8 valize kadar."
              ]
        },
        "tr": {
              "description": "Garching bei München, Münih’in kuzeydoğusunda; TU München kampüsü, araştırma reaktörü ve çok sayıda Max Planck Enstitüsüyle bir bilim merkezidir.",
              "history": "Garching 1950’lere kadar bir çiftçi köyüydü. 1957’de TU München’in araştırma reaktörünün ve çok sayıda araştırma kurumunun yerleşmesiyle dünyaca bilinen bir bilim merkezine dönüştü. Bugün burada binlerce kişi araştırma yapıyor ve okuyor.",
              "known_for": "TU München, araştırma merkezi, bilim şehri",
              "sights": [
                    "FRM II araştırma nötron kaynağı",
                    "TU München Garching kampüsü",
                    "U6 son durağı Garching-Forschungszentrum",
                    "İsar vadisi"
              ]
        }
  },
  'taxi-hallbergmoos-flughafen-muenchen': {
        "route": {
              "de": "Hallbergmoos grenzt direkt an den Flughafen: Bis zu den Terminals sind es nur rund 8 km und etwa 10 Minuten – die kürzeste Fahrt auf unserer Liste.",
              "en": "Hallbergmoos borders the airport directly: the terminals are only about 8 km and roughly 10 minutes away – the shortest ride on our list.",
              "tr": "Hallbergmoos doğrudan havalimanına komşudur: Terminallere sadece yaklaşık 8 km ve 10 dakika – listemizdeki en kısa yolculuk."
        },
        "pickups": {
              "de": [
                    "Hotels in Hallbergmoos",
                    "Gewerbegebiet & Bürostandorte",
                    "Ortszentrum",
                    "Goldach",
                    "Birkeneck"
              ],
              "en": [
                    "Hotels in Hallbergmoos",
                    "Business park & offices",
                    "Village centre",
                    "Goldach",
                    "Birkeneck"
              ],
              "tr": [
                    "Hallbergmoos’taki oteller",
                    "İş parkı & ofisler",
                    "Köy merkezi",
                    "Goldach",
                    "Birkeneck"
              ]
        },
        "tips": {
              "de": [
                    "Übernachtung vor dem Frühflug? Wir holen Sie zur gewünschten Zeit am Hotel ab – auch um 4 Uhr morgens.",
                    "Mehrere Kollegen im selben Hotel? Mit dem Van oder Großraumtaxi fahren alle zusammen zum Festpreis.",
                    "Ankunft spät abends: Wir warten mit Namensschild und bringen Sie in 10 Minuten ins Hotel."
              ],
              "en": [
                    "Staying overnight before an early flight? We pick you up at your hotel at the time you choose – even at 4 am.",
                    "Several colleagues in the same hotel? Everyone rides together in a van or large taxi at a fixed price.",
                    "Arriving late at night: we wait with a name sign and get you to your hotel in 10 minutes."
              ],
              "tr": [
                    "Erken uçuştan önce otelde mi kalıyorsunuz? Sizi istediğiniz saatte otelden alırız – sabah 4’te bile.",
                    "Aynı otelde birkaç meslektaş mı? Hepiniz Van veya büyük taksiyle sabit fiyata birlikte gidersiniz.",
                    "Gece geç varış: İsim tabelasıyla bekler, 10 dakikada otelinize götürürüz."
              ]
        },
        "tr": {
              "description": "Hallbergmoos, Freising ilçesinde, Münih’in yaklaşık 25 km kuzeyinde bir belediyedir – arazisinin bir kısmı belediye sınırlarında olan Münih Havalimanı’nın hemen yanında.",
              "history": "1803’e kadar bölge Freising Prens-Piskoposluğu’na aitti; Birkeneck ve Erching sarayları bu döneme dayanır. 1825’te Baron Theodor von Hallberg-Broich Birkeneck’i satın aldı, bataklığı kuruttu ve 1831’de bağımsız olan köyü kurdu. 1992’de havalimanının açılmasından beri Hallbergmoos pek çok otelle aranan bir yaşam ve iş yeridir.",
              "known_for": "Havalimanına yakınlık, oteller, iş parkları",
              "sights": [
                    "Birkeneck Sarayı",
                    "Erching Sarayı",
                    "Havalimanı yakınındaki oteller ve firmalar"
              ]
        }
  },
  'taxi-neufahrn-flughafen-muenchen': {
        "route": {
              "de": "Von Neufahrn sind es nur knapp 13 km bis zum Flughafen – über Landstraßen am Ort vorbei, meist in 15 Minuten. Das Autobahnkreuz Neufahrn liegt direkt vor der Tür.",
              "en": "Neufahrn is only about 13 km from the airport – via country roads around the village, usually in 15 minutes. The Neufahrn motorway interchange is right on the doorstep.",
              "tr": "Neufahrn havalimanına sadece 13 km kadar uzaklıkta – köyün çevresinden geçen yollarla genellikle 15 dakika. Neufahrn otoyol kavşağı hemen yanı başında."
        },
        "pickups": {
              "de": [
                    "S-Bahnhof Neufahrn (S1)",
                    "Ortszentrum Bahnhofstraße",
                    "Gewerbegebiet Neufahrn/Eching",
                    "Mintraching & Grüneck",
                    "Hotels in Neufahrn"
              ],
              "en": [
                    "Neufahrn station (S1)",
                    "Bahnhofstraße centre",
                    "Neufahrn/Eching business park",
                    "Mintraching & Grüneck",
                    "Hotels in Neufahrn"
              ],
              "tr": [
                    "Neufahrn istasyonu (S1)",
                    "Bahnhofstraße merkez",
                    "Neufahrn/Eching iş parkı",
                    "Mintraching & Grüneck",
                    "Neufahrn’daki oteller"
              ]
        },
        "tips": {
              "de": [
                    "Kurze Strecke, fester Preis – der Preis steht vor der Buchung fest.",
                    "Firmen im Gewerbegebiet: Fahrten für Mitarbeiter und Besucher auf Rechnung.",
                    "Frühflug: Vor 6 Uhr sind Sie in rund 13 Minuten am Terminal."
              ],
              "en": [
                    "Short ride, fixed price – you know the price before you book.",
                    "Companies in the business park: rides for staff and visitors on account.",
                    "Early flight: before 6 am you are at the terminal in about 13 minutes."
              ],
              "tr": [
                    "Kısa yol, sabit fiyat – fiyatı rezervasyondan önce bilirsiniz.",
                    "İş parkındaki firmalar: Çalışanlar ve ziyaretçiler için faturalı yolculuk.",
                    "Erken uçuş: Saat 6’dan önce terminale yaklaşık 13 dakikada varırsınız."
              ]
        },
        "tr": {
              "description": "Neufahrn bei Freising, Freising ilçesinde Münih ile Freising arasında, A9 ve A92’nin kesiştiği Neufahrn kavşağının hemen yanında bir belediyedir.",
              "history": "Neufahrn 804’te “Niwiwara” adıyla ilk kez kayda geçti. St. Wilgefortis hac kilisesi 1499’da takdis edildi ve 1715 civarında barok tarzda yenilendi. Bugün 20.000’i aşan nüfusuyla ilçenin en büyük belediyelerinden biridir.",
              "known_for": "A9/A92 kavşağı, S-Bahn, havalimanına yakın yaşam",
              "sights": [
                    "St. Wilgefortis hac kilisesi",
                    "Bahnhofstraße çevresindeki merkez",
                    "Mintraching/Grüneck",
                    "İsar kıyısı"
              ]
        }
  },
  'taxi-moosburg-flughafen-muenchen': {
        "route": {
              "de": "Von Moosburg fahren wir über die Flughafentangente zum Flughafen – rund 23 km und etwa 20–25 Minuten, ohne Autobahn.",
              "en": "From Moosburg we take the Flughafentangente to the airport – about 23 km and roughly 20–25 minutes, no motorway.",
              "tr": "Moosburg’dan Flughafentangente üzerinden havalimanına gidiyoruz – yaklaşık 23 km ve 20–25 dakika, otoyolsuz."
        },
        "pickups": {
              "de": [
                    "Bahnhof Moosburg",
                    "Altstadt & Kastulusmünster",
                    "Neustadt",
                    "Gewerbegebiete",
                    "Umland: Wang, Langenbach, Haag"
              ],
              "en": [
                    "Moosburg station",
                    "Old town & Kastulus Minster",
                    "Neustadt",
                    "Business parks",
                    "Surroundings: Wang, Langenbach, Haag"
              ],
              "tr": [
                    "Moosburg istasyonu",
                    "Eski şehir & Kastulus Katedrali",
                    "Neustadt",
                    "İş parkları",
                    "Çevre: Wang, Langenbach, Haag"
              ]
        },
        "tips": {
              "de": [
                    "Familien mit viel Urlaubsgepäck: Der Van nimmt bis zu 8 Koffer mit – zum Festpreis.",
                    "Frühflug: Vor 6 Uhr dauert die Fahrt nur rund 20 Minuten.",
                    "Rückfahrt gleich mitbuchen – wir verfolgen Ihren Flug und warten 60 Minuten kostenlos."
              ],
              "en": [
                    "Families with lots of holiday luggage: the van takes up to 8 suitcases – at a fixed price.",
                    "Early flight: before 6 am the ride takes only about 20 minutes.",
                    "Book the return at the same time – we track your flight and wait 60 minutes free of charge."
              ],
              "tr": [
                    "Çok tatil bagajı olan aileler: Van 8 valize kadar alır – sabit fiyata.",
                    "Erken uçuş: Saat 6’dan önce yolculuk sadece yaklaşık 20 dakika sürer.",
                    "Dönüşü de hemen ayırtın – uçuşunuzu takip eder, 60 dakika ücretsiz bekleriz."
              ]
        },
        "tr": {
              "description": "Moosburg an der Isar, Freising ilçesinin en eski şehridir ve Freising ile Landshut arasında yarı yolda yer alır.",
              "history": "Tarihi eski şehir, şehrin hemen ötesinde birleşen Amper ve İsar nehirleri arasındaki bir dil üzerinde yer alır; iki nehir binlerce yıl önemli ticaret yolları oldu. Kastulus Katedrali ile St. Johannes kilisesinin neredeyse aynı yükseklikteki iki kulesi bugün de şehrin silüetini belirler.",
              "known_for": "İlçenin en eski şehri, Kastulus Katedrali",
              "sights": [
                    "Kastulus Katedrali",
                    "St. Johannes kilisesi",
                    "Amper ile İsar arasındaki eski şehir",
                    "İsar kıyısı"
              ]
        }
  },
  'taxi-vaterstetten-flughafen-muenchen': {
        "route": {
              "de": "Von Vaterstetten und Baldham geht es über den Autobahnring A99 zum Flughafen – gut 45 km und meist eine gute halbe Stunde, ohne durch München zu fahren.",
              "en": "From Vaterstetten and Baldham we take the A99 ring motorway to the airport – a little over 45 km and usually just over half an hour, without driving through Munich.",
              "tr": "Vaterstetten ve Baldham’dan A99 çevre otoyoluyla havalimanına gidiyoruz – 45 km’den biraz fazla ve genellikle yarım saatten biraz uzun, Münih’e girmeden."
        },
        "pickups": {
              "de": [
                    "S-Bahnhof Vaterstetten",
                    "S-Bahnhof Baldham",
                    "Ortszentrum Vaterstetten",
                    "Neubaldham & Parsdorf",
                    "Gewerbegebiet Parsdorf"
              ],
              "en": [
                    "Vaterstetten station",
                    "Baldham station",
                    "Vaterstetten centre",
                    "Neubaldham & Parsdorf",
                    "Parsdorf business park"
              ],
              "tr": [
                    "Vaterstetten istasyonu",
                    "Baldham istasyonu",
                    "Vaterstetten merkez",
                    "Neubaldham & Parsdorf",
                    "Parsdorf iş parkı"
              ]
        },
        "tips": {
              "de": [
                    "Mit dem Taxi über die A99 ersparen Sie sich den Umstieg in München – mit Gepäck ein großer Unterschied.",
                    "Berufsverkehr auf der A99: Unser Abholzeit-Rechner plant die längere Fahrzeit ein.",
                    "Familien bis 8 Personen fahren im Van oder Großraumtaxi zum Festpreis."
              ],
              "en": [
                    "A taxi via the A99 saves you changing trains in Munich – a big difference with luggage.",
                    "Rush hour on the A99: our pickup calculator allows for the longer drive.",
                    "Families of up to 8 travel in a van or large taxi at a fixed price."
              ],
              "tr": [
                    "A99 üzerinden taksi, Münih’te aktarma yapmanızı önler – valizle büyük fark.",
                    "A99’da iş trafiği: Alış saati hesaplayıcımız uzayan süreyi hesaba katar.",
                    "8 kişiye kadar aileler Van veya büyük taksiyle sabit fiyata gider."
              ]
        },
        "tr": {
              "description": "Vaterstetten, Münih’in doğusunda Ebersberg ilçesinin en büyük belediyelerinden biridir; tipik bir S-Bahn banliyösüdür.",
              "history": "Vaterstetten 20. yüzyılda birkaç köyün birleşmesiyle oluştu ve İkinci Dünya Savaşı’ndan sonra hızla büyüdü. Bugün Münih’e doğrudan S-Bahn bağlantısı olan modern bir yerleşim yeridir.",
              "known_for": "Münih’in doğusu, S-Bahn, Ebersberg Ormanı",
              "sights": [
                    "Ebersberg Ormanı (yakında)",
                    "Baldham semti",
                    "Ebersberg (10 km)"
              ]
        }
  },
  'taxi-starnberg-flughafen-muenchen': {
        "route": {
              "de": "Vom Starnberger See fahren wir über die A99 und die A92 im Bogen um München herum zum Flughafen – rund 65 km, normal knapp 50 Minuten, im Berufsverkehr eher eine Stunde.",
              "en": "From Lake Starnberg we drive around Munich via the A99 ring and the A92 to the airport – about 65 km, normally just under 50 minutes, closer to an hour at rush hour.",
              "tr": "Starnberg Gölü’nden Münih’in etrafından A99 çevre yolu ve A92 ile havalimanına gidiyoruz – yaklaşık 65 km, normalde 50 dakikadan az, iş trafiğinde bir saate yakın."
        },
        "pickups": {
              "de": [
                    "Bahnhof Starnberg See",
                    "Seepromenade & Altstadt",
                    "Söcking & Percha",
                    "Hotels am See",
                    "Pöcking, Berg & Feldafing"
              ],
              "en": [
                    "Starnberg See station",
                    "Lakeside promenade & old town",
                    "Söcking & Percha",
                    "Lakeside hotels",
                    "Pöcking, Berg & Feldafing"
              ],
              "tr": [
                    "Starnberg See istasyonu",
                    "Göl kıyısı & eski şehir",
                    "Söcking & Percha",
                    "Göl kenarındaki oteller",
                    "Pöcking, Berg & Feldafing"
              ]
        },
        "tips": {
              "de": [
                    "Morgens zwischen 7 und 9 Uhr ist der Ring um München voll – planen Sie rund eine Stunde ein.",
                    "Golfgepäck oder Segelausrüstung? Im Van ist Platz für sperrige Gepäckstücke.",
                    "Für Gäste der Hotels am See: Abholung an der Rezeption mit Namensschild."
              ],
              "en": [
                    "Between 7 and 9 am the ring around Munich is busy – allow about an hour.",
                    "Golf bags or sailing gear? The van has room for bulky luggage.",
                    "For guests of lakeside hotels: pickup at reception with a name sign."
              ],
              "tr": [
                    "Sabah 7–9 arası Münih çevre yolu yoğundur – yaklaşık bir saat hesaplayın.",
                    "Golf çantası veya yelken ekipmanı mı? Van’da hacimli bagaja yer var.",
                    "Göl kenarındaki otellerin misafirleri için: Resepsiyonda isim tabelasıyla alış."
              ]
        },
        "tr": {
              "description": "Starnberg, Bavyera’nın en ünlü göllerinden biri olan Starnberg Gölü’nün kuzey kıyısında yer alır ve Münih çevresinde seçkin bir yaşam yeri olarak bilinir.",
              "history": "Starnberg 19. yüzyılda Münihliler ve Bavyera soyluları için sevilen bir yazlık oldu. Kral II. Ludwig 1886’da Starnberg Gölü’nde açıklanamayan koşullarda boğuldu – Bavyera tarihinin hâlâ çözülemeyen bir sırrı.",
              "known_for": "Starnberg Gölü, Kral II. Ludwig, Alp manzarası",
              "sights": [
                    "Starnberg Gölü – tekne turları ve sahil yolu",
                    "Kral II. Ludwig anıt şapeli",
                    "Berg Sarayı (dışarıdan)",
                    "Starnberg Gölü Müzesi"
              ]
        }
  },
  'taxi-fuerstenfeldbruck-flughafen-muenchen': {
        "route": {
              "de": "Von Fürstenfeldbruck geht es nördlich um München herum, zuletzt über die A92, zum Flughafen – gut 55 km, meist rund 40 Minuten.",
              "en": "From Fürstenfeldbruck we drive north around Munich, finally on the A92, to the airport – just over 55 km, usually about 40 minutes.",
              "tr": "Fürstenfeldbruck’tan Münih’in kuzeyinden dolaşıp son olarak A92 ile havalimanına gidiyoruz – 55 km’den biraz fazla, genellikle yaklaşık 40 dakika."
        },
        "pickups": {
              "de": [
                    "S-Bahnhof Fürstenfeldbruck (S4)",
                    "Altstadt & Amperufer",
                    "Kloster Fürstenfeld",
                    "Buchenau",
                    "Fliegerhorst-Gelände"
              ],
              "en": [
                    "Fürstenfeldbruck station (S4)",
                    "Old town & Amper riverside",
                    "Fürstenfeld Abbey",
                    "Buchenau",
                    "Former air base area"
              ],
              "tr": [
                    "Fürstenfeldbruck istasyonu (S4)",
                    "Eski şehir & Amper kıyısı",
                    "Fürstenfeld Manastırı",
                    "Buchenau",
                    "Eski hava üssü bölgesi"
              ]
        },
        "tips": {
              "de": [
                    "Mit der S-Bahn müssten Sie in München umsteigen – das Taxi fährt direkt außen herum.",
                    "Berufsverkehr: Im Morgenverkehr rechnen Sie mit gut 45 Minuten.",
                    "Hochzeiten und Feiern im Kloster Fürstenfeld: Gästetransfers zum Flughafen mit mehreren Fahrzeugen zum Festpreis."
              ],
              "en": [
                    "By S-Bahn you would have to change in Munich – the taxi goes straight around the city.",
                    "Rush hour: in morning traffic allow just over 45 minutes.",
                    "Weddings and events at Fürstenfeld Abbey: guest transfers to the airport with several vehicles at a fixed price."
              ],
              "tr": [
                    "S-Bahn ile Münih’te aktarma yapmanız gerekir – taksi şehrin etrafından doğrudan gider.",
                    "İş trafiği: Sabah trafiğinde 45 dakikadan biraz fazla hesaplayın.",
                    "Fürstenfeld Manastırı’ndaki düğün ve etkinlikler: Birden fazla araçla sabit fiyatlı misafir transferleri."
              ]
        },
        "tr": {
              "description": "Fürstenfeldbruck, Münih’in batısında, eski Sistersiyen manastırı Fürstenfeld ile tanınan bir şehirdir.",
              "history": "Fürstenfeld Manastırı 1263’te Dük II. Ludwig tarafından eşi Brabantlı Maria’nın öldürülmesinin kefareti olarak kuruldu. Manastır kilisesi Güney Alman barokunun başyapıtlarından biridir. Şehir, 1972 Olimpiyatları sırasında İsrail kafilesine yapılan saldırının eski hava üssünde trajik şekilde sona ermesiyle dünyaca bilinir hale geldi.",
              "known_for": "Fürstenfeld Manastırı, 1972 Olimpiyatları, Amper vadisi",
              "sights": [
                    "Fürstenfeld Manastırı (barok kilise)",
                    "Amper kıyısı yürüyüş yolları",
                    "Fürstenfeldbruck Şehir Müzesi",
                    "Amper kıyısındaki eski şehir"
              ]
        }
  },
  'taxi-germering-flughafen-muenchen': {
        "route": {
              "de": "Von Germering fahren wir über die A99 und die A92 um München herum zum Flughafen – gut 45 km, normal rund eine halbe Stunde, im Berufsverkehr eher 40 Minuten.",
              "en": "From Germering we drive around Munich via the A99 and A92 to the airport – just over 45 km, normally about half an hour, closer to 40 minutes at rush hour.",
              "tr": "Germering’den A99 ve A92 ile Münih’in etrafından havalimanına gidiyoruz – 45 km’den biraz fazla, normalde yaklaşık yarım saat, iş trafiğinde 40 dakikaya yakın."
        },
        "pickups": {
              "de": [
                    "S-Bahnhof Germering-Unterpfaffenhofen",
                    "S-Bahnhof Harthaus",
                    "Stadthalle Germering",
                    "Unterpfaffenhofen & Nebel",
                    "Gewerbegebiete"
              ],
              "en": [
                    "Germering-Unterpfaffenhofen station",
                    "Harthaus station",
                    "Germering Stadthalle",
                    "Unterpfaffenhofen & Nebel",
                    "Business parks"
              ],
              "tr": [
                    "Germering-Unterpfaffenhofen istasyonu",
                    "Harthaus istasyonu",
                    "Germering Stadthalle",
                    "Unterpfaffenhofen & Nebel",
                    "İş parkları"
              ]
        },
        "tips": {
              "de": [
                    "Morgens auf der A99 ist viel los – mit unserem Abholzeit-Rechner planen Sie den Puffer richtig.",
                    "Statt S-Bahn mit Umstieg: Das Taxi bringt Sie mit Gepäck direkt zum Terminal.",
                    "Familien und Gruppen bis 8 Personen fahren im Van oder Großraumtaxi."
              ],
              "en": [
                    "The A99 is busy in the morning – our pickup calculator helps you plan the right buffer.",
                    "Instead of the S-Bahn with a change: the taxi takes you and your luggage straight to the terminal.",
                    "Families and groups of up to 8 travel in a van or large taxi."
              ],
              "tr": [
                    "Sabahları A99 yoğundur – alış saati hesaplayıcımız doğru tamponu planlamanıza yardımcı olur.",
                    "Aktarmalı S-Bahn yerine: Taksi sizi valizinizle doğrudan terminale götürür.",
                    "8 kişiye kadar aile ve gruplar Van veya büyük taksiyle gider."
              ]
        },
        "tr": {
              "description": "Germering, Münih’in batısında Fürstenfeldbruck ilçesinin en büyük şehridir.",
              "history": "Germering 20. yüzyılda birkaç yerleşimin birleşmesiyle oluştu ve İkinci Dünya Savaşı’ndan sonra Münih’e çalışmaya gidenlerin gelişiyle hızla büyüdü. Bugün iyi altyapısı ve Münih’e S-Bahn bağlantısı olan modern bir şehirdir.",
              "known_for": "Münih banliyösü, büyüyen şehir, S-Bahn",
              "sights": [
                    "Germering Gölü (dinlenme alanı)",
                    "Germering Stadthalle",
                    "St. Jakobus kilisesi",
                    "Ammersee (20 km)"
              ]
        }
  },
  'taxi-ingolstadt-flughafen-muenchen': {
        "route": {
              "de": "Von Ingolstadt geht es über die A9 nach Süden und am Kreuz Neufahrn auf die A92 zum Flughafen – gut 70 km, meist rund 50 Minuten.",
              "en": "From Ingolstadt we head south on the A9 and switch to the A92 at the Neufahrn interchange – just over 70 km, usually about 50 minutes.",
              "tr": "Ingolstadt’tan A9 ile güneye iniyor, Neufahrn kavşağında A92’ye geçiyoruz – 70 km’den biraz fazla, genellikle yaklaşık 50 dakika."
        },
        "pickups": {
              "de": [
                    "Hauptbahnhof Ingolstadt",
                    "Altstadt",
                    "Audi Forum & Werk",
                    "Ingolstadt Village",
                    "Technische Hochschule",
                    "Hotels in Ingolstadt"
              ],
              "en": [
                    "Ingolstadt central station",
                    "Old town",
                    "Audi Forum & plant",
                    "Ingolstadt Village",
                    "Technical University of Applied Sciences",
                    "Hotels in Ingolstadt"
              ],
              "tr": [
                    "Ingolstadt merkez istasyon",
                    "Eski şehir",
                    "Audi Forum & fabrika",
                    "Ingolstadt Village",
                    "Teknik Uygulamalı Bilimler Üniversitesi",
                    "Ingolstadt’taki oteller"
              ]
        },
        "tips": {
              "de": [
                    "Geschäftsreisende zum Audi-Werk: Abholung am Terminal mit Namensschild und direkte Fahrt zum Werkstor oder Hotel.",
                    "Für Firmen: Fahrten auf Rechnung, auch für Gäste und Lieferanten.",
                    "Frühflug: Um 4 Uhr ist die A9 frei – rund 45 Minuten bis zum Terminal."
              ],
              "en": [
                    "Business travellers to the Audi plant: meet & greet at the terminal and straight to the gate or hotel.",
                    "For companies: rides on account, also for guests and suppliers.",
                    "Early flight: at 4 am the A9 is clear – about 45 minutes to the terminal."
              ],
              "tr": [
                    "Audi fabrikasına iş seyahati: Terminalde isim tabelasıyla karşılama, doğrudan fabrika kapısına veya otele.",
                    "Firmalar için: Misafirler ve tedarikçiler için de faturalı yolculuk.",
                    "Erken uçuş: Sabah 4’te A9 boştur – terminale yaklaşık 45 dakika."
              ]
        },
        "tr": {
              "description": "Ingolstadt, Bavyera’nın dördüncü büyük şehridir; Audi’nin merkezi ve Tuna kıyısındaki tarihi kale şehri olarak bilinir.",
              "history": "Ingolstadt, Wittelsbach düklerinin saray şehriydi ve 1472’den itibaren Bavyera’nın ilk üniversitesine ev sahipliği yaptı. 19. yüzyıldan kalan büyük tahkimatlar kısmen korunmuştur. Mary Shelley’nin “Frankenstein” romanında (1818) Victor Frankenstein Ingolstadt Üniversitesi’nde okur. Bugün Audi şehrin en büyük işvereni.",
              "known_for": "Audi merkezi, üniversite şehri, Tuna kalesi",
              "sights": [
                    "Audi museum mobile",
                    "Yeni Saray’daki Bavyera Ordu Müzesi",
                    "Liebfrauenmünster",
                    "Reduit Tilly kalesi",
                    "Tuna kıyısındaki Klenzepark"
              ]
        }
  },
  'taxi-augsburg-flughafen-muenchen': {
        "route": {
              "de": "Von Augsburg fahren wir über die A8 Richtung München und dann über den Autobahnring zum Flughafen – knapp 90 km, normal rund eine Stunde.",
              "en": "From Augsburg we take the A8 towards Munich and then the ring motorway to the airport – almost 90 km, normally about an hour.",
              "tr": "Augsburg’dan A8 ile Münih yönüne, ardından çevre otoyoluyla havalimanına gidiyoruz – yaklaşık 90 km, normalde bir saat kadar."
        },
        "pickups": {
              "de": [
                    "Hauptbahnhof Augsburg",
                    "Altstadt & Rathausplatz",
                    "Messe Augsburg",
                    "Universität Augsburg",
                    "Hotels in Augsburg",
                    "Göggingen & Haunstetten"
              ],
              "en": [
                    "Augsburg central station",
                    "Old town & Rathausplatz",
                    "Augsburg trade fair",
                    "University of Augsburg",
                    "Hotels in Augsburg",
                    "Göggingen & Haunstetten"
              ],
              "tr": [
                    "Augsburg merkez istasyon",
                    "Eski şehir & Rathausplatz",
                    "Augsburg fuar alanı",
                    "Augsburg Üniversitesi",
                    "Augsburg’daki oteller",
                    "Göggingen & Haunstetten"
              ]
        },
        "tips": {
              "de": [
                    "Im Berufsverkehr auf A8 und Ring wird es voller – rechnen Sie dann mit gut einer Stunde.",
                    "Mit der Bahn müssten Sie in München umsteigen; das Taxi fährt Sie mit Gepäck ohne Umstieg ans Terminal.",
                    "Messe- und Firmengäste holen wir mit Namensschild am Flughafen ab."
              ],
              "en": [
                    "At rush hour the A8 and the ring are busier – then allow just over an hour.",
                    "By train you would have to change in Munich; the taxi takes you and your luggage to the terminal without changing.",
                    "We meet trade-fair and company guests at the airport with a name sign."
              ],
              "tr": [
                    "İş trafiğinde A8 ve çevre yolu yoğunlaşır – o zaman bir saatten biraz fazla hesaplayın.",
                    "Trenle Münih’te aktarma yapmanız gerekir; taksi sizi valizinizle aktarmasız terminale götürür.",
                    "Fuar ve firma misafirlerini havalimanında isim tabelasıyla karşılıyoruz."
              ]
        },
        "tr": {
              "description": "Augsburg, Bavyera’nın üçüncü büyük şehri ve Romalıların Augusta Vindelicum olarak kurduğu, Almanya’nın en eski şehirlerinden biridir.",
              "history": "Roma eyalet başkenti ve Orta Çağ’ın önemli ticaret merkezi olan Augsburg, dünya ticaretini şekillendiren Fugger ve Welser banker ailelerinin yurduydu. 1555 Augsburg Din Barışı Avrupa’daki ilk din savaşını sona erdirdi. Bugün Augsburg önemli sanayi şirketlerine ve büyük bir üniversiteye ev sahipliği yapıyor.",
              "known_for": "Fugger, Roma tarihi, UNESCO su yönetimi sistemi",
              "sights": [
                    "Augsburg Katedrali",
                    "Fuggerei – dünyanın en eski sosyal konut yerleşimi",
                    "Belediye binasındaki Altın Salon",
                    "Schaezlerpalais",
                    "Kırmızı Kapı ve tarihi surlar"
              ]
        }
  },
  'taxi-rosenheim-flughafen-muenchen': {
        "route": {
              "de": "Von Rosenheim geht es über die A8 Richtung München und dann über den Autobahnring A99 zum Flughafen – gut 100 km, normal rund 75 Minuten.",
              "en": "From Rosenheim we take the A8 towards Munich and then the A99 ring motorway to the airport – just over 100 km, normally about 75 minutes.",
              "tr": "Rosenheim’dan A8 ile Münih yönüne, ardından A99 çevre otoyoluyla havalimanına gidiyoruz – 100 km’den biraz fazla, normalde yaklaşık 75 dakika."
        },
        "pickups": {
              "de": [
                    "Bahnhof Rosenheim",
                    "Max-Josefs-Platz & Altstadt",
                    "Technische Hochschule Rosenheim",
                    "Lokschuppen",
                    "Hotels in Rosenheim",
                    "Kolbermoor & Stephanskirchen"
              ],
              "en": [
                    "Rosenheim station",
                    "Max-Josefs-Platz & old town",
                    "Rosenheim Technical University of Applied Sciences",
                    "Lokschuppen exhibition centre",
                    "Hotels in Rosenheim",
                    "Kolbermoor & Stephanskirchen"
              ],
              "tr": [
                    "Rosenheim istasyonu",
                    "Max-Josefs-Platz & eski şehir",
                    "Rosenheim Teknik Uygulamalı Bilimler Üniversitesi",
                    "Lokschuppen sergi merkezi",
                    "Rosenheim’daki oteller",
                    "Kolbermoor & Stephanskirchen"
              ]
        },
        "tips": {
              "de": [
                    "Die A8 ist an Ferienwochenenden oft voll – buchen Sie lieber mit Puffer, unser Rechner hilft dabei.",
                    "Mit der Bahn ginge es nur mit Umstieg in München – das Taxi fährt direkt zum Terminal.",
                    "Auch Abholung in den Orten rund um Rosenheim und am Chiemsee."
              ],
              "en": [
                    "The A8 is often busy on holiday weekends – better book with a buffer; our calculator helps.",
                    "By train you would have to change in Munich – the taxi goes straight to the terminal.",
                    "We also pick up in the villages around Rosenheim and at Lake Chiemsee."
              ],
              "tr": [
                    "A8 tatil hafta sonlarında sık sık yoğundur – tamponla rezervasyon yapın, hesaplayıcımız yardımcı olur.",
                    "Trenle Münih’te aktarma gerekir – taksi doğrudan terminale gider.",
                    "Rosenheim çevresindeki köylerden ve Chiemsee’den de alıyoruz."
              ]
        },
        "tr": {
              "description": "Rosenheim, İnn nehri kıyısında, Münih ile Alpler arasında yer alan bağımsız bir şehirdir ve bölgenin önemli alışveriş ve sanayi merkezidir.",
              "history": "Rosenheim Orta Çağ’da İnn kıyısında bir tuz aktarma noktası olarak gelişti, 1328’de pazar hakkı aldı ve 1864’te şehir oldu. Tuz ve kereste ticareti şehri zenginleştirdi. 19. yüzyılda demiryolu Rosenheim’ı Münih ve Brenner’e bağladı. Bugün Rosenheim ahşap işleme ve Bavyera Alplerine açılan kapı olarak bilinir.",
              "known_for": "İnn vadisi, Alplere açılan kapı, ahşap",
              "sights": [
                    "Lokschuppen sergi merkezi",
                    "Max-Josefs-Platz ve tarihi kemerli yollar",
                    "Mangfall parkı ve İnn kıyısı",
                    "Rosenheim Şehir Müzesi",
                    "Wendelstein (gezi noktası)"
              ]
        }
  },
  'taxi-regensburg-flughafen-muenchen': {
        "route": {
              "de": "Von Regensburg fahren wir über die B15n und die A92 zum Flughafen – gut 100 km, normal rund 70 Minuten, ohne durch München zu müssen.",
              "en": "From Regensburg we take the B15n and the A92 to the airport – just over 100 km, normally about 70 minutes, without going through Munich.",
              "tr": "Regensburg’dan B15n ve A92 ile havalimanına gidiyoruz – 100 km’den biraz fazla, normalde yaklaşık 70 dakika, Münih’e girmeden."
        },
        "pickups": {
              "de": [
                    "Hauptbahnhof Regensburg",
                    "Altstadt",
                    "Universität & OTH Regensburg",
                    "BMW Werk Regensburg",
                    "Hotels in Regensburg",
                    "Kumpfmühl & Königswiesen"
              ],
              "en": [
                    "Regensburg central station",
                    "Old town",
                    "University & OTH Regensburg",
                    "BMW Regensburg plant",
                    "Hotels in Regensburg",
                    "Kumpfmühl & Königswiesen"
              ],
              "tr": [
                    "Regensburg merkez istasyon",
                    "Eski şehir",
                    "Üniversite & OTH Regensburg",
                    "BMW Regensburg fabrikası",
                    "Regensburg’daki oteller",
                    "Kumpfmühl & Königswiesen"
              ]
        },
        "tips": {
              "de": [
                    "Mit dem Zug ginge es nur mit Umstieg – das Taxi fährt Sie mit Gepäck direkt ans Terminal.",
                    "Gruppen und Firmen: Mehrere Fahrzeuge oder Großraumtaxi zum Festpreis.",
                    "Frühflug: Nachts sind Sie in gut einer Stunde am Terminal."
              ],
              "en": [
                    "By train you would have to change – the taxi takes you and your luggage straight to the terminal.",
                    "Groups and companies: several vehicles or a large taxi at a fixed price.",
                    "Early flight: at night you reach the terminal in just over an hour."
              ],
              "tr": [
                    "Trenle aktarma gerekir – taksi sizi valizinizle doğrudan terminale götürür.",
                    "Gruplar ve firmalar: Birden fazla araç veya büyük taksi sabit fiyata.",
                    "Erken uçuş: Gece terminale bir saatten biraz fazla sürede varırsınız."
              ]
        },
        "tr": {
              "description": "Regensburg, UNESCO Dünya Mirası eski şehriyle Yukarı Pfalz’ın başkentidir ve Avrupa’nın en iyi korunmuş Orta Çağ şehirlerinden biridir.",
              "history": "Roma kalesi Castra Regina (MS 179) Tuna lejyonunun ana üssüydü. Orta Çağ’da Regensburg İmparatorluğun en önemli şehirlerinden biriydi ve 1663–1806 arasında Daimi İmparatorluk Meclisi’ne ev sahipliği yaptı. St. Peter Katedrali, Taş Köprü ve Orta Çağ dokusu şehri UNESCO Dünya Mirası yapıyor.",
              "known_for": "UNESCO eski şehri, Taş Köprü, Orta Çağ mirası",
              "sights": [
                    "Taş Köprü (1146)",
                    "St. Peter Katedrali (gotik)",
                    "UNESCO Dünya Mirası eski şehir",
                    "Walhalla (15 km)"
              ]
        }
  },
  'taxi-salzburg-flughafen-muenchen': {
        "route": {
              "de": "Von Salzburg geht es über die A8 nach München und weiter über den Ring zum Flughafen – gut 180 km, normal rund zwei Stunden. Am Grenzübergang Walserberg kann es durch Kontrollen zu Wartezeiten kommen.",
              "en": "From Salzburg we take the A8 towards Munich and then the ring to the airport – just over 180 km, normally about two hours. Border checks at Walserberg can cause delays.",
              "tr": "Salzburg’dan A8 ile Münih yönüne, ardından çevre yoluyla havalimanına gidiyoruz – 180 km’den biraz fazla, normalde yaklaşık iki saat. Walserberg sınır kapısında kontroller nedeniyle bekleme olabilir."
        },
        "pickups": {
              "de": [
                    "Salzburg Hauptbahnhof",
                    "Altstadt",
                    "Hotels in Salzburg",
                    "Salzburger Land & Wintersportorte",
                    "Flachgau"
              ],
              "en": [
                    "Salzburg central station",
                    "Old town",
                    "Hotels in Salzburg",
                    "Salzburg region & ski resorts",
                    "Flachgau"
              ],
              "tr": [
                    "Salzburg merkez istasyon",
                    "Eski şehir",
                    "Salzburg’daki oteller",
                    "Salzburg bölgesi & kayak merkezleri",
                    "Flachgau"
              ]
        },
        "tips": {
              "de": [
                    "Ausweis oder Reisepass griffbereit halten – an der deutsch-österreichischen Grenze wird kontrolliert.",
                    "Planen Sie wegen Grenze und A8 lieber 30 Minuten Puffer ein; unser Rechner hilft beim Zeitpunkt.",
                    "Ski- und Sportgepäck? Im Van ist genug Platz für Skisäcke und Koffer."
              ],
              "en": [
                    "Keep your ID or passport handy – there are checks at the German-Austrian border.",
                    "Because of the border and the A8, allow an extra 30 minutes; our calculator helps with timing.",
                    "Ski and sports equipment? The van has room for ski bags and suitcases."
              ],
              "tr": [
                    "Kimlik veya pasaportunuzu hazır tutun – Almanya-Avusturya sınırında kontrol yapılıyor.",
                    "Sınır ve A8 nedeniyle 30 dakika fazla tampon bırakın; hesaplayıcımız zamanlamada yardımcı olur.",
                    "Kayak ve spor ekipmanı mı? Van’da kayak çantaları ve valizler için yeterli yer var."
              ]
        },
        "tr": {
              "description": "Salzburg, Mozart’ın doğduğu şehirdir – Salzach kıyısında barok eski şehri ve Hohensalzburg Kalesi ile UNESCO Dünya Mirası bir şehir.",
              "history": "Salzburg yüzyıllar boyunca tuz ticaretiyle zenginleşen bağımsız bir prens-başpiskoposluktu. Wolfgang Amadeus Mozart 1756’da burada doğdu. 1920’den beri düzenlenen festival Salzburg’u uluslararası bir kültür merkezi yapıyor. Barok eski şehir 1996’dan beri UNESCO Dünya Mirası listesinde.",
              "known_for": "Mozart, festival, UNESCO eski şehri, Salzach",
              "sights": [
                    "Hohensalzburg Kalesi",
                    "Mozart’ın doğduğu ev",
                    "Salzburg Katedrali",
                    "Mirabell Bahçeleri",
                    "Salzburg Festivali (yaz)"
              ]
        }
  },
  'taxi-innsbruck-flughafen-muenchen': {
        "route": {
              "de": "Von Innsbruck fahren wir über die Inntalautobahn nach Kufstein und weiter über A93, A8 und den Autobahnring zum Flughafen – gut 200 km, normal rund zweieinhalb Stunden.",
              "en": "From Innsbruck we take the Inn Valley motorway to Kufstein and then the A93, A8 and the ring motorway to the airport – just over 200 km, normally about two and a half hours.",
              "tr": "Innsbruck’tan İnn Vadisi otoyoluyla Kufstein’a, ardından A93, A8 ve çevre otoyoluyla havalimanına gidiyoruz – 200 km’den biraz fazla, normalde yaklaşık iki buçuk saat."
        },
        "pickups": {
              "de": [
                    "Innsbruck Hauptbahnhof",
                    "Altstadt",
                    "Hotels in Innsbruck",
                    "Universität Innsbruck",
                    "Skigebiete rund um Innsbruck"
              ],
              "en": [
                    "Innsbruck central station",
                    "Old town",
                    "Hotels in Innsbruck",
                    "University of Innsbruck",
                    "Ski areas around Innsbruck"
              ],
              "tr": [
                    "Innsbruck merkez istasyon",
                    "Eski şehir",
                    "Innsbruck’taki oteller",
                    "Innsbruck Üniversitesi",
                    "Innsbruck çevresindeki kayak alanları"
              ]
        },
        "tips": {
              "de": [
                    "Ausweis oder Reisepass bereithalten – an der Grenze bei Kiefersfelden wird kontrolliert.",
                    "Im Winter mit Schnee auf der Inntalautobahn mehr Zeit einplanen.",
                    "Skigruppen: Großraumtaxi bis 8 Personen mit Platz für Skigepäck."
              ],
              "en": [
                    "Keep your ID or passport ready – there are checks at the border near Kiefersfelden.",
                    "In winter, allow more time for snow on the Inn Valley motorway.",
                    "Ski groups: large taxi for up to 8 people with room for ski luggage."
              ],
              "tr": [
                    "Kimlik veya pasaportunuzu hazır tutun – Kiefersfelden yakınındaki sınırda kontrol yapılıyor.",
                    "Kışın İnn Vadisi otoyolunda kar için daha fazla zaman ayırın.",
                    "Kayak grupları: Kayak bagajına yer olan 8 kişilik büyük taksi."
              ]
        },
        "tr": {
              "description": "Innsbruck, Tirol’ün başkentidir; iki kez Olimpiyat ev sahibi (1964, 1976) olup Alplerin kalbinde İnn ve Sill nehirlerinin birleştiği yerde bulunur.",
              "history": "Innsbruck, Habsburg saray şehri olarak Kutsal Roma İmparatorluğu’nun en önemli şehirlerinden biriydi. İmparator I. Maximilian (1459–1519) şehri imparatorluk konutu yaptı. 1964 ve 1976 Kış Olimpiyatları modern şehir gelişimini şekillendirdi. En ünlü simgesi Altın Çatı’dır (Goldenes Dachl).",
              "known_for": "Altın Çatı, Olimpiyatlar, Tirol Alpleri, Habsburglar",
              "sights": [
                    "Altın Çatı (Goldenes Dachl)",
                    "Innsbruck Hofburg",
                    "Bergisel kayak atlama kulesi",
                    "Nordkette teleferiği",
                    "Zafer Kapısı"
              ]
        }
  },
  'taxi-gauting-flughafen-muenchen': {
    route: {
      de: 'Von Gauting im Würmtal fahren wir über die A99 und die A92 im Bogen um München herum zum Flughafen, ohne Stadtverkehr. Für die rund 55 km brauchen Sie meist knapp 40 Minuten, im Berufsverkehr etwa 47. Mit der S6 und Umstieg in München dauert es mit Koffern deutlich länger.',
      en: 'From Gauting in the Würm valley we drive round Munich on the A99 and A92 to the airport, avoiding city traffic. The roughly 55 km usually take just under 40 minutes, around 47 in rush hour. By S6 with a change in Munich it takes much longer with luggage.',
      tr: 'Würm vadisindeki Gauting’den A99 ve A92 otoyollarıyla Münih’in etrafından dolaşarak, şehir trafiğine girmeden havalimanına gidiyoruz. Yaklaşık 55 km genellikle 40 dakikadan kısa sürer, iş trafiğinde 47 dakika civarı. S6 ile Münih’te aktarma yaparak valizle çok daha uzun sürer.',
    },
    pickups: {
      de: ['Bahnhof Gauting', 'Ortszentrum & Rathaus', 'Stockdorf (S-Bahnhof)', 'Buchendorf', 'Unterbrunn & Hausen', 'Königswiesen'],
      en: ['Gauting railway station', 'Town centre & town hall', 'Stockdorf (S-Bahn station)', 'Buchendorf', 'Unterbrunn & Hausen', 'Königswiesen'],
      tr: ['Gauting tren istasyonu', 'Merkez & belediye binası', 'Stockdorf (S-Bahn istasyonu)', 'Buchendorf', 'Unterbrunn & Hausen', 'Königswiesen'],
    },
    tips: {
      de: [
        'Frühflug? Vor 6 Uhr ist der Autobahnring frei, rechnen Sie mit gut 38 Minuten.',
        'Abflug zwischen 7 und 9 Uhr: Planen Sie wegen des Berufsverkehrs auf der A99 rund 10 Minuten Puffer ein.',
        'Familien mit viel Gepäck fahren im Van bis 7 Personen zum Festpreis, kein zweites Taxi nötig.',
      ],
      en: [
        'Early flight? Before 6 am the motorway ring is clear, allow a good 38 minutes.',
        'Departing between 7 and 9 am: allow about 10 extra minutes for rush hour on the A99.',
        'Families with lots of luggage travel in a van for up to 7 people at a fixed price, no second taxi needed.',
      ],
      tr: [
        'Erken uçuş mu? Saat 6’dan önce otoyol çevresi boştur, yaklaşık 38 dakika hesaplayın.',
        'Saat 7 ile 9 arası kalkış: A99’daki iş trafiği için 10 dakika kadar pay bırakın.',
        'Bol valizli aileler 7 kişilik Van ile sabit fiyata gider, ikinci taksiye gerek yok.',
      ],
    },
    tr: {
      description: 'Gauting, Münih’in güneybatısında, Würm nehri vadisinde yer alan ve Starnberg ilçesine bağlı bir belediyedir. Stockdorf, Buchendorf ve Unterbrunn gibi mahalleleri vardır; S6 hattıyla Münih’e bağlıdır.',
      history: 'Würm vadisi çok eski bir yerleşim alanıdır. Bir efsaneye göre Büyük Karl, Gauting yakınlarındaki Reismühle’de doğmuştur. Bugün Gauting, yeşil çevresi ve Münih’e yakınlığıyla sevilen sakin bir yerleşim yeridir.',
      known_for: 'Würm vadisi, Reismühle efsanesi, Münih’e yakın sakin yaşam',
      sights: ['Würm nehri kıyısındaki yürüyüş yolları', 'Reismühle', 'Gauting merkezi ve belediye binası', 'Kreuzlinger Forst ormanı'],
    },
  },
  'taxi-poing-flughafen-muenchen': {
    route: {
      de: 'Von Poing fahren wir nach Norden auf die Flughafentangente Ost und von dort ohne Autobahn direkt zu den Terminals. Für die rund 33 km brauchen Sie meist eine halbe Stunde, auch im Berufsverkehr kaum länger, weil die Strecke den Münchner Stau umgeht. Öffentlich geht es nur mit Umsteigen.',
      en: 'From Poing we head north onto the Flughafentangente Ost and from there straight to the terminals without using the motorway. The roughly 33 km usually take half an hour, hardly longer in rush hour because the route avoids Munich traffic. By public transport you always have to change.',
      tr: 'Poing’den kuzeye, Flughafentangente Ost yoluna çıkıp otoyola girmeden doğrudan terminallere gidiyoruz. Yaklaşık 33 km genellikle yarım saat sürer; güzergâh Münih trafiğine girmediği için iş saatlerinde de pek uzamaz. Toplu taşımayla her zaman aktarma gerekir.',
    },
    pickups: {
      de: ['S-Bahnhof Poing', 'S-Bahnhof Grub', 'Bergfeld', 'Ortszentrum & Rathaus', 'Wildpark Poing', 'Angelbrechting'],
      en: ['Poing S-Bahn station', 'Grub S-Bahn station', 'Bergfeld', 'Town centre & town hall', 'Wildpark Poing', 'Angelbrechting'],
      tr: ['Poing S-Bahn istasyonu', 'Grub S-Bahn istasyonu', 'Bergfeld', 'Merkez & belediye binası', 'Wildpark Poing', 'Angelbrechting'],
    },
    tips: {
      de: [
        'Die Fahrt über die Flughafentangente ist auch morgens zwischen 7 und 9 Uhr verlässlich: rund 30 Minuten.',
        'Für Frühflüge holen wir Sie rund um die Uhr ab, auch um 4 Uhr morgens.',
        'Bei der Ankunft wartet Ihr Fahrer mit Namensschild, bei Verspätung bis zu 60 Minuten kostenlos.',
      ],
      en: [
        'The Flughafentangente route is reliable even between 7 and 9 am: about 30 minutes.',
        'For early flights we pick you up around the clock, even at 4 am.',
        'On arrival your driver waits with a name sign, up to 60 minutes free of charge if your flight is late.',
      ],
      tr: [
        'Flughafentangente güzergâhı sabah 7 ile 9 arasında da güvenilirdir: yaklaşık 30 dakika.',
        'Erken uçuşlar için günün her saati, sabah 4’te bile sizi alırız.',
        'Varışta şoförünüz isim tabelasıyla bekler; uçuş gecikirse 60 dakikaya kadar ücretsiz.',
      ],
    },
    tr: {
      description: 'Poing, Münih’in doğusunda, Ebersberg ilçesinde yer alan ve son yıllarda hızla büyüyen bir belediyedir. S2 hattının Poing ve Grub istasyonlarıyla Münih’e bağlıdır.',
      history: 'Poing uzun süre küçük bir tarım köyüydü. 1990’lardan itibaren, özellikle Bergfeld gibi yeni mahallelerle birlikte genç ailelerin tercih ettiği bir yerleşim yerine dönüştü.',
      known_for: 'Wildpark Poing, genç aileler, hızlı büyüyen yerleşim',
      sights: ['Wildpark Poing (yaban hayatı parkı)', 'Bergfeld mahallesi ve parkları', 'Poing merkezi'],
    },
  },
  'taxi-eching-flughafen-muenchen': {
    route: {
      de: 'Von Eching geht es über die A92 Richtung Osten direkt zum Flughafen. Mit rund 17 km und etwa 13 Minuten gehört Eching zu den kürzesten Strecken, auch im Berufsverkehr. Mit der S-Bahn müssen Sie in Neufahrn umsteigen.',
      en: 'From Eching we take the A92 east straight to the airport. At about 17 km and roughly 13 minutes it is one of the shortest routes, even in rush hour. By S-Bahn you have to change in Neufahrn.',
      tr: 'Eching’den A92 otoyolu ile doğuya, doğrudan havalimanına gidiyoruz. Yaklaşık 17 km ve 13 dakika ile, iş trafiğinde bile en kısa güzergâhlardan biridir. S-Bahn ile Neufahrn’da aktarma yapmanız gerekir.',
    },
    pickups: {
      de: ['S-Bahnhof Eching', 'Ortszentrum & Bürgerhaus', 'Dietersheim', 'Günzenhausen', 'Gewerbegebiet Eching-Ost', 'Hotels in Eching'],
      en: ['Eching S-Bahn station', 'Town centre & Bürgerhaus', 'Dietersheim', 'Günzenhausen', 'Eching-Ost business park', 'Hotels in Eching'],
      tr: ['Eching S-Bahn istasyonu', 'Merkez & Bürgerhaus', 'Dietersheim', 'Günzenhausen', 'Eching-Ost sanayi bölgesi', 'Eching’deki oteller'],
    },
    tips: {
      de: [
        'Kurze Strecke, fester Preis: Den genauen Preis für Ihre Adresse sehen Sie sofort im Buchungsformular.',
        'Hotelgäste in Eching: Wir holen Sie direkt am Hoteleingang ab, auch vor dem ersten Frühstück.',
        'Geschäftsreisende aus dem Gewerbegebiet können per Rechnung zahlen.',
      ],
      en: [
        'Short route, fixed price: the booking form shows the exact price for your address straight away.',
        'Hotel guests in Eching: we pick you up at the hotel entrance, even before breakfast is served.',
        'Business travellers from the business park can pay by invoice.',
      ],
      tr: [
        'Kısa güzergâh, sabit fiyat: Adresinizin kesin fiyatını rezervasyon formunda hemen görürsünüz.',
        'Eching’de otelde kalanlar: Sizi otel girişinden alırız, kahvaltı başlamadan önce bile.',
        'Sanayi bölgesinden iş seyahati yapanlar faturayla ödeyebilir.',
      ],
    },
    tr: {
      description: 'Eching, Münih ile Freising arasında, Freising ilçesine bağlı bir belediyedir. S1 hattı ve A92 ile A9 otoyollarına yakınlığıyla bölgenin önemli iş ve alışveriş noktalarından biridir.',
      history: 'Eching kökleri eskiye dayanan bir Bavyera köyüdür. Otoyol bağlantıları ve havalimanına yakınlığı sayesinde son on yıllarda büyüyerek sanayi ve alışveriş bölgeleri olan canlı bir belediyeye dönüştü.',
      known_for: 'Echinger See gölü, alışveriş merkezleri, havalimanına yakınlık',
      sights: ['Echinger See (yüzme gölü)', 'Bürgerhaus Eching', 'Dietersheim ve Günzenhausen köyleri'],
    },
  },
  'taxi-feldkirchen-flughafen-muenchen': {
    route: {
      de: 'Feldkirchen liegt im Osten Münchens, direkt neben der Messe Riem. Zum Flughafen sind es rund 39 km, meist knapp eine halbe Stunde, auch im Berufsverkehr kaum länger. Mit der S2 und Umstieg dauert es mit Gepäck deutlich länger.',
      en: 'Feldkirchen lies in the east of Munich, right next to the Messe Riem trade fair grounds. The airport is about 39 km away, usually just under half an hour, hardly longer in rush hour. By S2 with a change it takes much longer with luggage.',
      tr: 'Feldkirchen, Münih’in doğusunda, Messe Riem fuar alanının hemen yanındadır. Havalimanına yaklaşık 39 km, genellikle yarım saatten kısa sürer, iş trafiğinde de pek uzamaz. S2 ile aktarmalı yolculuk valizle çok daha uzun sürer.',
    },
    pickups: {
      de: ['S-Bahnhof Feldkirchen', 'Ortszentrum & Rathaus', 'Gewerbegebiet Feldkirchen', 'Hotels an der Messe', 'Messe München (Eingang Ost)', 'Heimstetten (Nachbarort)'],
      en: ['Feldkirchen S-Bahn station', 'Town centre & town hall', 'Feldkirchen business park', 'Hotels near the trade fair', 'Messe München (East entrance)', 'Heimstetten (neighbouring village)'],
      tr: ['Feldkirchen S-Bahn istasyonu', 'Merkez & belediye binası', 'Feldkirchen sanayi bölgesi', 'Fuar yakınındaki oteller', 'Messe München (Doğu girişi)', 'Heimstetten (komşu köy)'],
    },
    tips: {
      de: [
        'Zu Messezeiten sind Hotels und Straßen um die Messe voll: Buchen Sie Ihre Fahrt am Vortag.',
        'Für Aussteller mit Material: Im Großraumtaxi ist Platz für bis zu 8 Personen und viel Gepäck.',
        'Firmen können Fahrten per Rechnung zahlen, auf Wunsch als Sammelrechnung.',
      ],
      en: [
        'During trade fairs, hotels and roads around the Messe are busy: book your ride the day before.',
        'Exhibitors with equipment: the large taxi takes up to 8 people and plenty of luggage.',
        'Companies can pay by invoice, also as a monthly collective invoice.',
      ],
      tr: [
        'Fuar dönemlerinde fuar çevresindeki oteller ve yollar doludur: Yolculuğunuzu bir gün önceden ayırtın.',
        'Malzemeli fuar katılımcıları: Büyük taksi 8 kişiye ve bol bagaja yer sunar.',
        'Firmalar faturayla, isterse aylık toplu faturayla ödeyebilir.',
      ],
    },
    tr: {
      description: 'Feldkirchen, Münih’in doğu sınırında, Münih ilçesine (Landkreis München) bağlı bir belediyedir. Messe München fuar alanına komşudur ve S2 hattıyla şehre bağlıdır.',
      history: 'Feldkirchen eski bir Bavyera köyüdür. 1998’de yakındaki Riem’de yeni fuar alanının açılmasıyla birlikte otel ve iş bölgeleri gelişti.',
      known_for: 'Messe München’e yakınlık, oteller, iş bölgeleri',
      sights: ['Feldkirchen merkezi ve kilisesi', 'Messe München fuar alanı (komşu)', 'Riemer Park (komşu)'],
    },
  },
  'taxi-lech-am-arlberg-flughafen-muenchen': {
    route: {
      de: 'Von Lech am Arlberg zum Flughafen München sind es rund 307 km, meist gut drei Stunden über die A96. Wir fahren Sie ohne Umsteigen von der Hoteltür bis zum Terminal, mit Skigepäck und Festpreis. Mit Bahn und Bus dauert die Reise mit mehreren Umstiegen deutlich länger.',
      en: 'From Lech am Arlberg to Munich Airport it is about 307 km, usually a good three hours via the A96. We drive you from your hotel door to the terminal without changes, with ski luggage and at a fixed price. By train and bus the journey takes much longer with several changes.',
      tr: 'Lech am Arlberg’den Münih Havalimanı’na yaklaşık 307 km, A96 üzerinden genellikle üç saatten biraz fazla sürer. Sizi kayak bagajınızla, aktarmasız ve sabit fiyatla otel kapısından terminale götürüyoruz. Tren ve otobüsle birkaç aktarmalı yolculuk çok daha uzun sürer.',
    },
    pickups: {
      de: ['Hotels in Lech', 'Oberlech', 'Zürs am Arlberg', 'Zug', 'Ortszentrum Lech', 'Ferienwohnungen & Chalets'],
      en: ['Hotels in Lech', 'Oberlech', 'Zürs am Arlberg', 'Zug', 'Lech village centre', 'Holiday apartments & chalets'],
      tr: ['Lech’teki oteller', 'Oberlech', 'Zürs am Arlberg', 'Zug', 'Lech merkezi', 'Tatil evleri & şaleler'],
    },
    tips: {
      de: [
        'Samstag ist in den Skiorten Bettenwechsel: Planen Sie für den Rückflug mehr Zeit ein.',
        'Nach starkem Schneefall kann der Flexenpass zeitweise gesperrt sein. Wir behalten die Lage im Blick und melden uns, falls sich die Abholzeit ändert.',
        'Ski und Snowboards fahren mit: Bitte geben Sie das Skigepäck bei der Buchung an, für Gruppen gibt es Van und Großraumtaxi.',
      ],
      en: [
        'Saturday is changeover day in the ski resorts: allow extra time for your return flight.',
        'After heavy snowfall the Flexen Pass can be closed for a while. We keep an eye on the situation and let you know if the pickup time changes.',
        'Skis and snowboards travel with you: please mention ski luggage when booking; vans and large taxis are available for groups.',
      ],
      tr: [
        'Cumartesi kayak merkezlerinde konaklama değişim günüdür: Dönüş uçuşu için daha fazla zaman ayırın.',
        'Yoğun kar yağışından sonra Flexenpass geçici olarak kapanabilir. Durumu takip eder, alış saati değişirse size haber veririz.',
        'Kayak ve snowboardlar da yanınızda: Rezervasyonda kayak bagajını belirtin; gruplar için Van ve büyük taksi var.',
      ],
    },
    tr: {
      description: 'Lech am Arlberg, Avusturya’nın Vorarlberg eyaletinde, Arlberg dağlarında yer alan küçük ama dünyaca ünlü bir kayak köyüdür. Zürs, Oberlech ve Zug ile birlikte Ski Arlberg kayak bölgesinin parçasıdır.',
      history: 'Lech, 14. yüzyılda yüksek dağ vadilerine yerleşen Walser’ler tarafından kuruldu. 20. yüzyılda kayak turizmiyle büyüyerek Alplerin en bilinen kış tatil yerlerinden biri oldu.',
      known_for: 'Ski Arlberg, lüks kış tatili, Weißer Ring kayak turu',
      sights: ['Ski Arlberg kayak bölgesi', 'Weißer Ring kayak turu', 'St. Nikolaus kilisesi', 'Skyspace Lech (James Turrell)', 'Oberlech ve Zürs'],
    },
  },
};
