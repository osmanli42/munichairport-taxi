type FAQItem = {
  question: string;
  answer: string;
};

type FAQData = {
  title: string;
  subtitle: string;
  categories: {
    label: string;
    items: FAQItem[];
  }[];
  cta_title: string;
  cta_text: string;
  cta_call: string;
  cta_whatsapp: string;
};

export const faqData: Record<string, FAQData> = {
  de: {
    title: 'Häufig gestellte Fragen',
    subtitle: 'Alles, was Sie über unseren Flughafentransfer wissen müssen',
    categories: [
      {
        label: '🚗 Buchung & Preise',
        items: [
          { question: 'Wie buche ich einen Transfer?', answer: 'Die Buchung ist ganz einfach: Geben Sie auf unserer Website Start- und Zieladresse ein, wählen Sie Ihr Fahrzeug und füllen Sie Ihre Kontaktdaten aus. Nach der Buchung erhalten Sie sofort eine Bestätigungsmail mit Ihrer Buchungsnummer.' },
          { question: 'Wie weit im Voraus muss ich buchen?', answer: 'Wir empfehlen, mindestens 24 Stunden im Voraus zu buchen. Für kurzfristige Buchungen rufen Sie uns bitte direkt an oder schreiben Sie uns über WhatsApp – wir versuchen, auch kurzfristige Anfragen zu erfüllen.' },
          { question: 'Was sind Festpreise und warum sind sie vorteilhaft?', answer: 'Festpreise bedeuten, dass der Preis bei der Buchung festgelegt wird und sich nicht ändert – unabhängig von Verkehr oder Umwegen. So haben Sie volle Kostenkontrolle und keine unangenehmen Überraschungen.' },
          { question: 'Welche Zahlungsmethoden werden akzeptiert?', answer: 'Sie können bar (in Euro) direkt beim Fahrer oder per Kreditkarte bezahlen. Die Zahlungsmethode wählen Sie bereits bei der Buchung aus.' },
          { question: 'Kann ich meine Buchung kostenlos stornieren?', answer: 'Stornierungen bis zu 3 Stunden vor der Fahrt sind vollständig kostenlos – keine Fragen, keine Gebühren. Bei späteren Stornierungen oder Nichterscheinen können Stornogebühren anfallen. Bitte kontaktieren Sie uns in diesem Fall so früh wie möglich.' },
          { question: 'Gibt es Rabatte für Hin- und Rückfahrten?', answer: 'Ja! Bei Buchung einer Hin- und Rückfahrt erhalten Sie einen attraktiven Rabatt. Dieser wird automatisch beim Buchungsvorgang berechnet und angezeigt.' },
          { question: 'Was kostet ein Kindersitz?', answer: 'Kindersitze sind bei uns komplett kostenlos! Wir bieten Babyschalen (0–12 Monate), Kindersitze (1–4 Jahre, bis 18 kg) und Sitzerhöhungen (4–12 Jahre, bis 36 kg). Bitte wählen Sie bei der Buchung den gewünschten Typ aus.' },
          { question: 'Kann ich ein Fahrrad mitnehmen?', answer: 'Ja, bei bestimmten Fahrzeugen ist die Mitnahme von Fahrrädern möglich. Die Verfügbarkeit und der Aufpreis werden während des Buchungsvorgangs angezeigt. Bitte wählen Sie die gewünschte Anzahl Fahrräder aus.' },
        ],
      },
      {
        label: '✈️ Flughafen & Abholung',
        items: [
          { question: 'Verfolgen Sie meinen Flug?', answer: 'Ja! Wir überwachen Ihren Flug in Echtzeit. Bei Verspätungen warten wir kostenlos auf Sie. Bitte geben Sie bei der Buchung Ihre Flugnummer an, damit wir Ihren Flug verfolgen können.' },
          { question: 'Wo werde ich am Flughafen München abgeholt?', answer: 'Unser Fahrer wartet auf Sie im Ankunftsbereich des jeweiligen Terminals mit einem Schild mit Ihrem Namen. Wir senden Ihnen vor der Ankunft die genaue Warteposition des Fahrers.' },
          { question: 'Wie lange muss ich auf den Fahrer warten?', answer: 'Bei Flughafenabholungen warten wir 60 Minuten nach der tatsächlichen Landezeit kostenlos auf Sie. Außerhalb des Flughafens warten wir 15 Minuten kostenlos.' },
          { question: 'Wie früh vor dem Abflug soll ich buchen?', answer: 'Wir empfehlen, 2,5 bis 3 Stunden vor dem Abflug am Flughafen zu sein. Berücksichtigen Sie bei der Buchung die voraussichtliche Fahrtzeit sowie Check-in-Zeiten.' },
          { question: 'Was passiert, wenn mein Flug annulliert wird?', answer: 'Bitte informieren Sie uns so schnell wie möglich per Telefon oder WhatsApp. Bei Flugannullierungen versuchen wir, gemeinsam eine Lösung zu finden. Eine kostenlose Stornierung ist in solchen Fällen möglich.' },
        ],
      },
      {
        label: '🚐 Fahrzeuge & Komfort',
        items: [
          { question: 'Welche Fahrzeuge stehen zur Verfügung?', answer: 'Wir bieten drei Fahrzeugkategorien an: Kombi (1–3 Personen), Van/Minibus (4–7 Personen) und Großraumtaxi (8+ Personen). Alle Fahrzeuge sind modern und klimatisiert.' },
          { question: 'Wie viel Gepäck kann ich mitnehmen?', answer: 'Das hängt vom gewählten Fahrzeug ab. Kombi: bis zu 3 Koffer, Van/Minibus: bis zu 7 Koffer, Großraumtaxi: bis zu 12 Koffer. Wenn Sie viel Gepäck haben, wählen Sie bitte die entsprechende Fahrzeugkategorie.' },
          { question: 'Sind die Fahrer mehrsprachig?', answer: 'Ja! Unsere Fahrer sprechen Deutsch, Englisch und Türkisch, damit wir Ihnen in Ihrer bevorzugten Sprache helfen können.' },
          { question: 'Sind die Fahrzeuge versichert?', answer: 'Selbstverständlich! Alle unsere Fahrzeuge verfügen über eine vollständige Haftpflicht- und Kaskoversicherung. Ihre Sicherheit hat für uns höchste Priorität.' },
        ],
      },
      {
        label: '📍 Fahrgebiete & Besonderes',
        items: [
          { question: 'Wohin fahren Sie?', answer: 'Wir fahren vom und zum Flughafen München in ganz Bayern, nach Österreich sowie in alle angrenzenden Länder und Regionen – selbstverständlich sowohl als Hinfahrt als auch als Hin- und Rückfahrt. Beliebte Ziele sind München, Salzburg, Innsbruck, Augsburg, Ingolstadt, Rosenheim, Regensburg und viele weitere Städte. Für individuelle Strecken kontaktieren Sie uns gerne direkt.' },
          { question: 'Fahren Sie auch nach Österreich oder in andere Länder?', answer: 'Ja! Wir fahren regelmäßig nach Österreich – zum Beispiel nach Salzburg, Innsbruck, Linz oder Wien – sowie in alle angrenzenden europäischen Regionen. Hin- und Rückfahrten sind selbstverständlich möglich. Für ein individuelles Angebot kontaktieren Sie uns einfach per Telefon oder WhatsApp.' },
          { question: 'Können Firmen Transfers buchen?', answer: 'Ja! Wir bieten auch Firmentransfers und Gruppenfahrten an. Für regelmäßige Buchungen und Großgruppen erstellen wir gerne individuelle Angebote. Kontaktieren Sie uns einfach.' },
          { question: 'Bieten Sie Nachtfahrten an?', answer: 'Ja, wir sind 24 Stunden am Tag, 7 Tage die Woche verfügbar – auch für frühmorgendliche oder spätabendliche Transfers. Nachtfahrten werden zum gleichen Festpreis angeboten.' },
          { question: 'Was soll ich tun, wenn ich Hilfe benötige?', answer: 'Sie können uns jederzeit telefonisch oder per WhatsApp erreichen. Unsere Nummer: +49 151 41620000. Wir sind rund um die Uhr für Sie da.' },
        ],
      },
    ],
    cta_title: 'Noch Fragen?',
    cta_text: 'Wir helfen Ihnen gerne weiter – per Telefon oder WhatsApp, rund um die Uhr.',
    cta_call: 'Jetzt anrufen',
    cta_whatsapp: 'WhatsApp schreiben',
  },
  en: {
    title: 'Frequently Asked Questions',
    subtitle: 'Everything you need to know about our airport transfer service',
    categories: [
      {
        label: '🚗 Booking & Prices',
        items: [
          { question: 'How do I book a transfer?', answer: 'Booking is simple: enter your pickup and drop-off address on our website, select your vehicle, and fill in your contact details. After booking, you will instantly receive a confirmation email with your booking number.' },
          { question: 'How far in advance do I need to book?', answer: 'We recommend booking at least 24 hours in advance. For last-minute bookings, please call us directly or contact us via WhatsApp – we will do our best to accommodate short-notice requests.' },
          { question: 'What are fixed prices and why are they beneficial?', answer: 'Fixed prices mean the price is set at the time of booking and does not change – regardless of traffic or detours. This gives you full cost control with no unpleasant surprises.' },
          { question: 'What payment methods are accepted?', answer: 'You can pay in cash (Euro) directly to the driver or by credit card. You select the payment method when booking.' },
          { question: 'Can I cancel my booking for free?', answer: 'Cancellations up to 3 hours before the trip are completely free of charge – no questions, no fees. Late cancellations or no-shows may incur cancellation fees. Please contact us as early as possible in such cases.' },
          { question: 'Are there discounts for round trips?', answer: 'Yes! When booking a round trip, you receive an attractive discount. This is automatically calculated and displayed during the booking process.' },
          { question: 'What does a child seat cost?', answer: 'Child seats are completely free! We offer infant carriers (0–12 months), child seats (1–4 years, up to 18 kg), and booster seats (4–12 years, up to 36 kg). Please select the desired type when booking.' },
          { question: 'Can I bring a bicycle?', answer: 'Yes, certain vehicles allow bicycles. Availability and the surcharge are displayed during the booking process. Please select the desired number of bicycles.' },
        ],
      },
      {
        label: '✈️ Airport & Pickup',
        items: [
          { question: 'Do you track my flight?', answer: 'Yes! We monitor your flight in real time. In case of delays, we wait for you at no extra charge. Please provide your flight number when booking so we can track your flight.' },
          { question: 'Where will I be picked up at Munich Airport?', answer: 'Our driver will wait for you in the arrivals area of the respective terminal holding a sign with your name. We will send you the exact waiting position of the driver before your arrival.' },
          { question: 'How long will the driver wait for me?', answer: 'For airport pickups, we wait 60 minutes after the actual landing time free of charge. Outside the airport, we wait 15 minutes for free.' },
          { question: 'How early before departure should I book a pickup?', answer: 'We recommend being at the airport 2.5 to 3 hours before your flight. When booking, please account for the estimated travel time and check-in times.' },
          { question: 'What happens if my flight is cancelled?', answer: 'Please inform us as quickly as possible by phone or WhatsApp. In case of flight cancellations, we will work with you to find a solution. Free cancellation is possible in such cases.' },
        ],
      },
      {
        label: '🚐 Vehicles & Comfort',
        items: [
          { question: 'What vehicles are available?', answer: 'We offer three vehicle categories: Sedan/Kombi (1–3 passengers), Van/Minibus (4–7 passengers), and Large Taxi (8+ passengers). All vehicles are modern and air-conditioned.' },
          { question: 'How much luggage can I bring?', answer: 'It depends on the vehicle: Sedan: up to 3 suitcases, Van/Minibus: up to 7 suitcases, Large Taxi: up to 12 suitcases. If you have a lot of luggage, please choose the appropriate vehicle category.' },
          { question: 'Are the drivers multilingual?', answer: 'Yes! Our drivers speak German, English, and Turkish so we can assist you in your preferred language.' },
          { question: 'Are the vehicles insured?', answer: 'Of course! All our vehicles have full liability and comprehensive insurance. Your safety is our top priority.' },
        ],
      },
      {
        label: '📍 Service Area & Special',
        items: [
          { question: 'Where do you drive?', answer: 'We travel to and from Munich Airport throughout Bavaria, Austria, and all neighboring countries and regions – both one-way and as a round trip. Popular destinations include Munich, Salzburg, Innsbruck, Augsburg, Ingolstadt, Rosenheim, Regensburg, and many more cities. For custom routes, feel free to contact us directly.' },
          { question: 'Do you also drive to Austria or other countries?', answer: 'Yes! We regularly travel to Austria – for example to Salzburg, Innsbruck, Linz or Vienna – as well as to all neighboring European regions. Return trips are of course available. For a custom quote, simply contact us by phone or WhatsApp.' },
          { question: 'Can companies book transfers?', answer: 'Yes! We also offer corporate transfers and group trips. For regular bookings and large groups, we are happy to create individual offers. Just contact us.' },
          { question: 'Do you offer night-time transfers?', answer: 'Yes, we are available 24 hours a day, 7 days a week – including early morning or late evening transfers. Night trips are offered at the same fixed price.' },
          { question: 'What should I do if I need help?', answer: 'You can reach us at any time by phone or WhatsApp. Our number: +49 151 41620000. We are available around the clock for you.' },
        ],
      },
    ],
    cta_title: 'Still have questions?',
    cta_text: 'We are happy to help you – by phone or WhatsApp, around the clock.',
    cta_call: 'Call now',
    cta_whatsapp: 'Write on WhatsApp',
  },
  tr: {
    title: 'Sıkça Sorulan Sorular',
    subtitle: 'Havalimanı transfer hizmetimiz hakkında bilmeniz gereken her şey',
    categories: [
      {
        label: '🚗 Rezervasyon & Fiyatlar',
        items: [
          { question: 'Transfer nasıl rezerve edilir?', answer: 'Rezervasyon çok basit: Web sitemizde başlangıç ve varış adresini girin, aracınızı seçin ve iletişim bilgilerinizi doldurun. Rezervasyonun ardından anında rezervasyon numaranızı içeren bir onay e-postası alacaksınız.' },
          { question: 'Ne kadar önceden rezervasyon yapmalıyım?', answer: 'En az 24 saat önceden rezervasyon yapmanızı öneririz. Son dakika rezervasyonları için lütfen bizi doğrudan arayın veya WhatsApp üzerinden yazın – son dakika taleplerini de karşılamaya çalışıyoruz.' },
          { question: 'Sabit fiyatlar nedir ve neden avantajlıdır?', answer: 'Sabit fiyatlar, fiyatın rezervasyon sırasında belirleneceği ve trafik veya sapmalara bakılmaksızın değişmeyeceği anlamına gelir. Bu sayede tam maliyet kontrolüne sahip olur ve sürprizlerle karşılaşmazsınız.' },
          { question: 'Hangi ödeme yöntemleri kabul edilmektedir?', answer: 'Nakit (Euro) olarak doğrudan sürücüye veya kredi kartıyla ödeme yapabilirsiniz. Ödeme yöntemini rezervasyon sırasında seçersiniz.' },
          { question: 'Rezervasyonumu ücretsiz iptal edebilir miyim?', answer: 'Yolculuktan 3 saat öncesine kadar yapılan iptaller tamamen ücretsizdir – soru yok, ücret yok. Geç iptallerde veya gelmeme durumunda iptal ücreti alınabilir. Bu durumda lütfen bize mümkün olan en kısa sürede bildirin.' },
          { question: 'Gidiş-dönüş için indirim var mı?', answer: 'Evet! Gidiş-dönüş rezervasyonunda cazip bir indirim alırsınız. Bu, rezervasyon sürecinde otomatik olarak hesaplanır ve gösterilir.' },
          { question: 'Çocuk koltuğu ne kadara mal olur?', answer: "Çocuk koltukları tamamen ücretsizdir! Bebek taşıyıcı (0–12 ay), çocuk koltuğu (1–4 yaş, 18 kg'a kadar) ve yükseltici koltuk (4–12 yaş, 36 kg'a kadar) sunuyoruz. Rezervasyon sırasında istediğiniz türü seçin." },
          { question: 'Bisiklet getirebilir miyim?', answer: 'Evet, belirli araçlarda bisiklet taşıma imkânı vardır. Uygunluk ve ek ücret, rezervasyon sürecinde gösterilir. İstediğiniz bisiklet sayısını seçin.' },
        ],
      },
      {
        label: '✈️ Havalimanı & Karşılama',
        items: [
          { question: 'Uçuşumu takip ediyor musunuz?', answer: 'Evet! Uçuşunuzu gerçek zamanlı olarak takip ediyoruz. Gecikmeler durumunda sizi ücretsiz bekliyoruz. Uçuşunuzu takip edebilmemiz için rezervasyon sırasında uçuş numaranızı belirtin.' },
          { question: "Münih Havalimanı'nda nerede karşılanacağım?", answer: 'Sürücümüz, adınızın yazılı olduğu bir levhayla ilgili terminalin varış alanında sizi bekleyecek. Varışınızdan önce sürücünün tam bekleme konumunu size ileteceğiz.' },
          { question: 'Sürücü beni ne kadar bekler?', answer: 'Havalimanı karşılamalarında, fiili iniş saatinden itibaren 60 dakika ücretsiz bekliyoruz. Havalimanı dışında 15 dakika ücretsiz bekliyoruz.' },
          { question: 'Kalkıştan ne kadar önce rezervasyon yapmalıyım?', answer: 'Uçuşunuzdan 2,5 ila 3 saat önce havalimanında olmanızı öneririz. Rezervasyon yaparken tahmini seyahat süresini ve check-in sürelerini hesaba katın.' },
          { question: 'Uçuşum iptal edilirse ne olur?', answer: 'Lütfen bizi mümkün olan en kısa sürede telefon veya WhatsApp ile bilgilendirin. Uçuş iptalleri durumunda birlikte bir çözüm bulmaya çalışırız. Bu gibi durumlarda ücretsiz iptal mümkündür.' },
        ],
      },
      {
        label: '🚐 Araçlar & Konfor',
        items: [
          { question: 'Hangi araçlar mevcut?', answer: 'Üç araç kategorisi sunuyoruz: Kombi (1–3 kişi), Van/Minibüs (4–7 kişi) ve Büyük Taksi (8+ kişi). Tüm araçlar modern ve klimalidir.' },
          { question: 'Ne kadar bagaj getirebilirim?', answer: 'Bu seçilen araca bağlıdır: Kombi: 3 valiz, Van/Minibüs: 7 valiz, Büyük Taksi: 12 valiz. Çok fazla bagajınız varsa lütfen uygun araç kategorisini seçin.' },
          { question: 'Sürücüler çok dilli mi?', answer: 'Evet! Sürücülerimiz Almanca, İngilizce ve Türkçe konuşur; böylece tercih ettiğiniz dilde yardımcı olabiliriz.' },
          { question: 'Araçlar sigortalı mı?', answer: 'Elbette! Tüm araçlarımız tam sorumluluk ve kapsamlı sigortaya sahiptir. Güvenliğiniz bizim için en yüksek önceliktir.' },
        ],
      },
      {
        label: '📍 Hizmet Bölgesi & Özel',
        items: [
          { question: 'Nereye gidiyorsunuz?', answer: "Münih Havalimanı'ndan tüm Bavyera'ya, Avusturya'ya ve tüm komşu ülke ve bölgelere gidiş-dönüş seferler düzenliyoruz. Popüler destinasyonlar arasında Münih, Salzburg, Innsbruck, Augsburg, Ingolstadt, Rosenheim, Regensburg ve daha birçok şehir bulunmaktadır. Özel güzergahlar için bize doğrudan ulaşabilirsiniz." },
          { question: "Avusturya'ya veya başka ülkelere de gidiyor musunuz?", answer: "Evet! Avusturya'ya düzenli seferler yapıyoruz – örneğin Salzburg, Innsbruck, Linz veya Viyana'ya – ayrıca tüm komşu Avrupa ülkelerine ve bölgelerine de gidiyoruz. Dönüş seferleri de mevcut. Özel teklif için telefon veya WhatsApp üzerinden bizimle iletişime geçebilirsiniz." },
          { question: 'Şirketler transfer rezervasyonu yapabilir mi?', answer: 'Evet! Kurumsal transferler ve grup seyahatleri de sunuyoruz. Düzenli rezervasyonlar ve büyük gruplar için bireysel teklifler oluşturmaktan memnuniyet duyarız. Sadece bizimle iletişime geçin.' },
          { question: 'Gece transferi yapıyor musunuz?', answer: 'Evet, sabah erken veya gece geç saatlerdeki transferler dahil günde 24 saat, haftada 7 gün hizmet veriyoruz. Gece yolculukları aynı sabit fiyatla sunulmaktadır.' },
          { question: 'Yardıma ihtiyacım olursa ne yapmalıyım?', answer: 'Bize her zaman telefon veya WhatsApp üzerinden ulaşabilirsiniz. Numaramız: +49 151 41620000. Gece gündüz hizmetinizdeyiz.' },
        ],
      },
    ],
    cta_title: 'Hâlâ sorunuz mu var?',
    cta_text: 'Size yardımcı olmaktan mutluluk duyarız – telefon veya WhatsApp ile, gece gündüz.',
    cta_call: 'Şimdi ara',
    cta_whatsapp: "WhatsApp'tan yaz",
  },
};
