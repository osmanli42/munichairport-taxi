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
          { question: 'Wie weit im Voraus muss ich buchen?', answer: 'Wir empfehlen, mindestens 24 Stunden im Voraus zu buchen. Für kurzfristige Buchungen rufen Sie uns bitte direkt an oder schreiben Sie uns über WhatsApp – wir versuchen, auch kurzfristige Anfragen zu erfüllen. Sie können selbstverständlich auch schon Wochen oder Monate im Voraus buchen.' },
          { question: 'Was sind Festpreise und warum sind sie vorteilhaft?', answer: 'Festpreise bedeuten, dass der Preis bei der Buchung festgelegt wird und sich nicht ändert – unabhängig von Verkehr oder Umwegen. So haben Sie volle Kostenkontrolle und keine unangenehmen Überraschungen.' },
          { question: 'Welche Zahlungsmethoden werden akzeptiert?', answer: 'Sie können bar (in Euro) direkt beim Fahrer oder per Kreditkarte bezahlen. Die Zahlungsmethode wählen Sie bereits bei der Buchung aus.' },
          { question: 'Kann ich meine Buchung kostenlos stornieren?', answer: 'Stornierungen bis zu 3 Stunden vor der Fahrt sind vollständig kostenlos – keine Fragen, keine Gebühren. Bei späteren Stornierungen oder Nichterscheinen können Stornogebühren anfallen. Bitte kontaktieren Sie uns in diesem Fall so früh wie möglich.' },
          { question: 'Gibt es Rabatte für Hin- und Rückfahrten?', answer: 'Ja! Bei Buchung einer Hin- und Rückfahrt erhalten Sie einen attraktiven Rabatt. Dieser wird automatisch beim Buchungsvorgang berechnet und angezeigt.' },
          { question: 'Was kostet ein Kindersitz?', answer: 'Kindersitze sind bei uns komplett kostenlos! Wir bieten Babyschalen (0–12 Monate), Kindersitze (1–4 Jahre, bis 18 kg) und Sitzerhöhungen (4–12 Jahre, bis 36 kg). Bitte wählen Sie bei der Buchung den gewünschten Typ aus.' },
          { question: 'Kann ich ein Fahrrad mitnehmen?', answer: 'Ja, bei bestimmten Fahrzeugen ist die Mitnahme von Fahrrädern möglich. Die Verfügbarkeit und der Aufpreis werden während des Buchungsvorgangs angezeigt. Bitte wählen Sie die gewünschte Anzahl Fahrräder aus.' },
          { question: 'Was kostet ein Taxi vom Flughafen München in die Innenstadt?', answer: 'Den Festpreis für Ihren Transfer vom Flughafen München ins Münchner Stadtzentrum (z. B. Hauptbahnhof oder Marienplatz) berechnet unser System sofort und transparent auf unserer Website – abhängig von Fahrzeug und Zieladresse. Ihren Festpreis sehen Sie vor der Buchung; er steht dann fest und ändert sich nicht: keine Verkehrszuschläge, keine versteckten Kosten, keine Überraschungen.' },
          { question: 'Was ist günstiger: Taxi oder privater Flughafentransfer in München?', answer: 'Der größte Vorteil eines vorgebuchten Transfers ist die Planungssicherheit: Sie kennen Ihren Festpreis schon bei der Buchung – transparent und verbindlich. Der Fahrer empfängt Sie persönlich mit Namensschild im Ankunftsbereich, ohne Warteschlange am Taxistand. Sie zahlen genau den vereinbarten Preis, ohne nachträgliche Aufschläge für Nacht, Gepäck oder Wartezeit im Stau.' },
          { question: 'Wie viel kostet ein Transfer vom Flughafen München nach Salzburg?', answer: 'Ein Festpreis-Transfer vom Flughafen München nach Salzburg kostet ab 399 € für einen Kombi (1–3 Personen) und ab 420 € für einen Van (4–7 Personen). Der genaue Preis wird bei der Buchung auf unserer Website berechnet und bestätigt – ohne Überraschungen bei der Ankunft.' },
        ],
      },
      {
        label: '✈️ Flughafen & Abholung',
        items: [
          { question: 'Verfolgen Sie meinen Flug?', answer: 'Ja! Wir überwachen Ihren Flug in Echtzeit. Bei Verspätungen warten wir kostenlos auf Sie. Bitte geben Sie bei der Buchung Ihre Flugnummer an, damit wir Ihren Flug verfolgen können.' },
          { question: 'Wo werde ich am Flughafen München abgeholt?', answer: 'Unser Fahrer wartet auf Sie im Ankunftsbereich des jeweiligen Terminals mit einem Schild mit Ihrem Namen. Wir senden Ihnen vor der Ankunft die genaue Warteposition des Fahrers.' },
          { question: 'Wie lange wartet der Fahrer auf mich?', answer: 'Bei Flughafenabholungen warten wir 60 Minuten nach der tatsächlichen Landezeit kostenlos auf Sie. Außerhalb des Flughafens warten wir 15 Minuten kostenlos.' },
          { question: 'Wie früh vor dem Abflug soll ich am Flughafen sein?', answer: 'Wir empfehlen, 2,5 bis 3 Stunden vor dem Abflug am Flughafen zu sein. Berücksichtigen Sie bei der Buchung die voraussichtliche Fahrtzeit sowie Check-in-Zeiten.' },
          { question: 'Was passiert, wenn mein Flug annulliert wird?', answer: 'Bitte informieren Sie uns so schnell wie möglich per Telefon oder WhatsApp. Bei Flugannullierungen versuchen wir, gemeinsam eine Lösung zu finden. Eine kostenlose Stornierung ist in solchen Fällen möglich.' },
        ],
      },
      {
        label: '🚐 Fahrzeuge & Komfort',
        items: [
          { question: 'Welche Fahrzeuge stehen zur Verfügung?', answer: 'Wir bieten drei Fahrzeugkategorien an: Kombi (1–3 Personen), Van/Minibus (4–7 Personen) und Großraumtaxi (bis zu 8 Personen). Alle Fahrzeuge sind modern und klimatisiert.' },
          { question: 'Wie viel Gepäck kann ich mitnehmen?', answer: 'Das hängt vom gewählten Fahrzeug ab. Kombi: bis zu 3 Koffer, Van/Minibus: bis zu 7 Koffer, Großraumtaxi: 12–13 Koffer je nach Größe. Wenn Sie viel Gepäck haben, wählen Sie bitte die entsprechende Fahrzeugkategorie.' },
          { question: 'Sind die Fahrer mehrsprachig?', answer: 'Ja! Unsere Fahrer sprechen Deutsch, Englisch und Türkisch, damit wir Ihnen in Ihrer bevorzugten Sprache helfen können.' },
          { question: 'Sind die Fahrzeuge versichert?', answer: 'Selbstverständlich! Alle unsere Fahrzeuge verfügen über eine vollständige Haftpflicht- und Kaskoversicherung. Ihre Sicherheit hat für uns höchste Priorität.' },
          { question: 'Helfen die Fahrer beim Tragen des Gepäcks?', answer: 'Ja, selbstverständlich! Unsere Fahrer helfen Ihnen beim Ein- und Ausladen Ihres Gepäcks – egal wie viele Koffer Sie dabei haben. Das ist bei uns inklusive und kostet keinen Aufpreis.' },
          { question: 'Welcher Taxidienst ist am besten am Flughafen München?', answer: 'Flughafen-muenchen.TAXI ist einer der meistbewerteten privaten Transferdienste am Flughafen München – mit 4,9 von 5 Sternen bei über 100.000 Kunden und 20 Jahren Erfahrung. Wir bieten Festpreise ohne Überraschungen, persönliche Abholung mit Namensschild, kostenlose Flugüberwachung, 60 Minuten Wartezeit inklusive und Fahrzeuge für 1 bis 8 Personen. Alle Fahrer sprechen Deutsch, Englisch und Türkisch.' },
          { question: 'Gibt es Großraumtaxis oder Vans am Flughafen München?', answer: 'Ja! Wir bieten speziell für Gruppen und Familien Vans (Mercedes Viano, 4–7 Personen) und Großraumtaxis (Mercedes Vito, bis zu 8 Personen) an. Am normalen Taxistand sind diese Fahrzeuge häufig nicht sofort verfügbar – bei uns sind sie durch Vorbestellung garantiert verfügbar, zu einem festen Preis ohne Aufpreis.' },
        ],
      },
      {
        label: '🚐 Van & Großraumtaxi',
        items: [
          { question: 'Wie viel kostet ein Van vom Flughafen München ins Stadtzentrum?', answer: 'Den Festpreis für einen Van (Mercedes Viano, 4–7 Personen) vom Flughafen München ins Stadtzentrum berechnet unser System sofort auf der Website. Ein Van bietet Platz für bis zu 7 Personen mit reichlich Gepäck und ist für Gruppen ab 4 Personen die wirtschaftlichste Wahl – alle reisen gemeinsam in einem Fahrzeug.' },
          { question: 'Was ist günstiger: 2 Taxis oder 1 Van vom Flughafen München?', answer: 'Für Gruppen ab 4 Personen ist ein Van fast immer die wirtschaftlichere Wahl: Statt zwei separate Fahrzeuge zu buchen, reisen alle gemeinsam in einem Van für bis zu 7 Personen – mit nur einem Festpreis, einem Fahrer und ohne Koordination. Den genauen Preisvergleich sehen Sie sofort bei der Buchung auf unserer Website.' },
          { question: 'Kann eine Gruppe von 5, 6, 7 oder 8 Personen zusammen ein Taxi vom Flughafen München nehmen?', answer: 'Ja! Für Gruppen von 4 bis 7 Personen bieten wir den Van (Mercedes Viano) an – mit ausreichend Platz für alle Passagiere und Gepäckstücke. Für 8 Personen steht das Großraumtaxi (Mercedes Vito, bis zu 8 Personen) zur Verfügung. Einfach bei der Buchung die passende Fahrzeugkategorie wählen – der Preis wird sofort berechnet.' },
          { question: 'Wann brauche ich einen Van statt einem normalen Taxi vom Flughafen München?', answer: 'Ein Van ist die richtige Wahl, wenn Sie zu viert oder mehr reisen, viel Gepäck mitführen, mit Kindern und Kinderwagen unterwegs sind oder als Gruppe zusammen ankommen möchten. Ab 4 Personen ist der Van zudem fast immer günstiger als zwei separate Taxis – und alle fahren gemeinsam ans Ziel.' },
          { question: 'Wie viel Gepäck passt in einen Van vom Flughafen München?', answer: 'In unserem Van (Mercedes Viano) haben bis zu 7 Passagiere und bis zu 7 große Koffer bequem Platz. Für noch mehr Gepäck empfehlen wir das Großraumtaxi (Mercedes Vito, bis zu 8 Personen) mit 12–13 Koffern je nach Größe. Unsere Fahrer helfen beim Be- und Entladen – inklusive, ohne Aufpreis.' },
          { question: 'Gibt es Großraumtaxis oder Vans für Messebesucher am Flughafen München?', answer: 'Ja! Besonders zu Messezeiten in München (z. B. IAA, Bauma, ISPO, electronica) empfehlen wir eine frühzeitige Vorbestellung. Am Taxistand sind Großraumtaxis und Vans zu Stoßzeiten oft nicht sofort verfügbar. Bei uns ist Ihr Fahrzeug mit einer Vorbestellung garantiert – pünktlich, mit Namensschild, direkt zur Messe oder ins Hotel.' },
          { question: 'Gibt es Van-Transfer vom Flughafen München für Firmengruppen oder Sportteams?', answer: 'Ja! Wir bieten regelmäßig Gruppentransfers für Firmendelegationen, Kongressbesucher und Sportteams an. Vans (4–7 Personen) und Großraumtaxis (bis zu 8 Personen) sind verfügbar. Für größere Gruppen oder Daueraufträge erstellen wir gerne ein individuelles Angebot – einfach anrufen oder per WhatsApp anfragen.' },
        ],
      },
      {
        label: '🏙️ Anreise & Alternativen',
        items: [
          { question: 'Wie komme ich am besten vom Flughafen München ins Stadtzentrum?', answer: 'Es gibt mehrere Möglichkeiten: S-Bahn (ca. 40–45 Min., preisgünstig, aber unpraktisch mit viel Gepäck), Bus/Lufthansa Express, Taxi am Stand oder ein vorgebuchter privater Transfer. Wer komfortabel, pünktlich und ohne Umsteigen ankommen möchte, wählt einen privaten Festpreis-Transfer: Ihr Fahrer wartet am Ausgang, hilft beim Gepäck und bringt Sie direkt vor Ihre Haustür – ohne Stress, ohne Umsteigen, zum festen Preis.' },
          { question: 'Was ist besser: Taxi, S-Bahn oder privater Transfer vom Flughafen München?', answer: 'Die S-Bahn ist preisgünstig, aber nicht ideal bei viel Gepäck, großen Gruppen oder frühmorgendlichen Ankünften. Normale Taxis am Stand sind flexibel, beim Endpreis aber weniger planbar – und Großraumfahrzeuge sind oft nicht verfügbar. Flughafen-muenchen.TAXI bietet das Beste: fixer Preis ohne Überraschungen, persönlicher Empfang mit Namensschild, Gepäckshilfe und direkter Transport bis vor die Tür – 24/7, auch für Familien und Gruppen.' },
          { question: 'Wie lange dauert die Fahrt vom Flughafen München ins Stadtzentrum?', answer: 'Die Fahrt vom Flughafen München (MUC) in die Münchner Innenstadt dauert je nach Verkehrslage 35 bis 50 Minuten. Die Strecke beträgt ca. 38 km über die A9. Zu Stoßzeiten (morgens 7–9 Uhr, nachmittags 16–19 Uhr) kann die Fahrt etwas länger dauern. Wir empfehlen, die Abfahrtszeit entsprechend einzuplanen.' },
          { question: 'Wie weit ist der Flughafen München vom Stadtzentrum entfernt?', answer: 'Der Flughafen München (MUC) liegt ca. 38 km nördlich des Stadtzentrums. Die Fahrt dauert mit dem Taxi oder privatem Transfer je nach Verkehr 35 bis 50 Minuten. Mit der S-Bahn (S1 oder S8) dauert es ca. 40–45 Minuten bis zum Hauptbahnhof.' },
          { question: 'Taxi vom Flughafen München zum Hauptbahnhof – Preis und Dauer?', answer: 'Den Festpreis für Ihren Transfer vom Flughafen München zum Münchner Hauptbahnhof berechnet unser System sofort auf der Website (je nach Fahrzeug). Die Fahrt dauert je nach Verkehr ca. 35–50 Minuten über die A9. Ihr Fahrer wartet im Ankunftsbereich mit einem Namensschild – kein Taxistand, keine Warteschlange.' },
          { question: 'Wie viel kostet ein Taxi vom Flughafen München nach Schwabing oder Maxvorstadt?', answer: 'Den Festpreis für Ihren Transfer vom Flughafen München nach Schwabing oder Maxvorstadt berechnet unser System sofort und transparent auf der Website. Die Fahrt dauert je nach Verkehr ca. 30–45 Minuten.' },
          { question: 'Taxi vom Flughafen München – Terminal 1 oder Terminal 2?', answer: 'Wir holen Sie an beiden Terminals ab – Terminal 1 (T1) und Terminal 2 (T2). Bitte geben Sie bei der Buchung Ihre Flugnummer an, damit wir Ihren genauen Ankunftsbereich kennen und Sie pünktlich am Ausgang empfangen. Der Preis ist unabhängig vom Terminal gleich.' },
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
          { question: 'How far in advance do I need to book?', answer: 'We recommend booking at least 24 hours in advance. For last-minute bookings, please call us directly or contact us via WhatsApp – we will do our best to accommodate short-notice requests. You are of course also welcome to book weeks or months in advance.' },
          { question: 'What are fixed prices and why are they beneficial?', answer: 'Fixed prices mean the price is set at the time of booking and does not change – regardless of traffic or detours. This gives you full cost control with no unpleasant surprises.' },
          { question: 'What payment methods are accepted?', answer: 'You can pay in cash (Euro) directly to the driver or by credit card. You select the payment method when booking.' },
          { question: 'Can I cancel my booking for free?', answer: 'Cancellations up to 3 hours before the trip are completely free of charge – no questions, no fees. Late cancellations or no-shows may incur cancellation fees. Please contact us as early as possible in such cases.' },
          { question: 'Are there discounts for round trips?', answer: 'Yes! When booking a round trip, you receive an attractive discount. This is automatically calculated and displayed during the booking process.' },
          { question: 'What does a child seat cost?', answer: 'Child seats are completely free! We offer infant carriers (0–12 months), child seats (1–4 years, up to 18 kg), and booster seats (4–12 years, up to 36 kg). Please select the desired type when booking.' },
          { question: 'Can I bring a bicycle?', answer: 'Yes, certain vehicles allow bicycles. Availability and the surcharge are displayed during the booking process. Please select the desired number of bicycles.' },
          { question: 'How much does a taxi from Munich Airport to the city center cost?', answer: 'Our system calculates the fixed price for your transfer from Munich Airport to the city center (e.g. Hauptbahnhof or Marienplatz) instantly and transparently on our website – based on vehicle and destination. You see your fixed price before booking; it is then locked in and does not change: no traffic surcharges, no hidden costs, no surprises.' },
          { question: 'What is cheaper: taxi or private airport transfer in Munich?', answer: 'The biggest advantage of a pre-booked transfer is planning certainty: you know your fixed price at the time of booking – transparent and binding. The driver welcomes you personally with a name sign in the arrivals area, with no queue at the taxi rank. You pay exactly the agreed price, with no added charges for night, luggage or waiting time in traffic.' },
          { question: 'How much does a transfer from Munich Airport to Salzburg cost?', answer: 'A fixed-price transfer from Munich Airport to Salzburg starts at €399 for a sedan (1–3 passengers) and €420 for a van (4–7 passengers). The exact price is calculated and confirmed on our website at the time of booking – no surprises on arrival.' },
        ],
      },
      {
        label: '✈️ Airport & Pickup',
        items: [
          { question: 'Do you track my flight?', answer: 'Yes! We monitor your flight in real time. In case of delays, we wait for you at no extra charge. Please provide your flight number when booking so we can track your flight.' },
          { question: 'Where will I be picked up at Munich Airport?', answer: 'Our driver will wait for you in the arrivals area of the respective terminal holding a sign with your name. We will send you the exact waiting position of the driver before your arrival.' },
          { question: 'How long does the driver wait for me?', answer: 'For airport pickups, we wait 60 minutes after the actual landing time free of charge. Outside the airport, we wait 15 minutes for free.' },
          { question: 'How early before my flight should I be at the airport?', answer: 'We recommend being at the airport 2.5 to 3 hours before your flight. When booking, please account for the estimated travel time and check-in times.' },
          { question: 'What happens if my flight is cancelled?', answer: 'Please inform us as quickly as possible by phone or WhatsApp. In case of flight cancellations, we will work with you to find a solution. Free cancellation is possible in such cases.' },
        ],
      },
      {
        label: '🚐 Vehicles & Comfort',
        items: [
          { question: 'What vehicles are available?', answer: 'We offer three vehicle categories: Sedan/Kombi (1–3 passengers), Van/Minibus (4–7 passengers), and Large Taxi (up to 8 passengers). All vehicles are modern and air-conditioned.' },
          { question: 'How much luggage can I bring?', answer: 'It depends on the vehicle: Sedan: up to 3 suitcases, Van/Minibus: up to 7 suitcases, Large Taxi: 12–13 suitcases depending on size. If you have a lot of luggage, please choose the appropriate vehicle category.' },
          { question: 'Are the drivers multilingual?', answer: 'Yes! Our drivers speak German, English, and Turkish so we can assist you in your preferred language.' },
          { question: 'Are the vehicles insured?', answer: 'Of course! All our vehicles have full liability and comprehensive insurance. Your safety is our top priority.' },
          { question: 'Do drivers help with luggage?', answer: 'Yes, of course! Our drivers assist you with loading and unloading your luggage – no matter how many suitcases you have. This is included in our service at no extra charge.' },
          { question: 'Which taxi service is best at Munich Airport?', answer: 'Flughafen-muenchen.TAXI is one of the highest-rated private transfer services at Munich Airport – with a 4.9/5 rating from over 100,000 customers and 20 years of experience. We offer fixed prices with no surprises, personal meet-and-greet with a name sign, free flight monitoring, 60 minutes of waiting time included, and vehicles for 1 to 8 passengers. All drivers speak German, English, and Turkish.' },
          { question: 'Are there large taxis or vans at Munich Airport?', answer: 'Yes! We offer vans (Mercedes Viano, 4–7 passengers) and large taxis (Mercedes Vito, up to 8 passengers) specifically for groups and families. These vehicles are often not immediately available at the regular taxi rank – with us, they are guaranteed through advance booking, at a fixed price with no surcharge.' },
        ],
      },
      {
        label: '🚐 Van & Large Taxi',
        items: [
          { question: 'How much does a van from Munich Airport to the city center cost?', answer: 'A van (Mercedes Viano, 4–7 passengers) from Munich Airport to Munich city center starts at €95. That is only €7 more than a sedan for 1–3 passengers – and the van offers space for up to 7 people with plenty of luggage. The most cost-effective choice for groups of 4 or more.' },
          { question: 'What is cheaper: 2 taxis or 1 van from Munich Airport?', answer: 'For groups of 4 or more, a van is almost always the cheaper option. Example: two sedans to the city center cost €88 each = €176 total. A van for up to 7 passengers costs just €95 – saving you over €80. Plus everyone travels together, one driver, no coordination needed.' },
          { question: 'Can a group of 5, 6, 7 or 8 people share one taxi from Munich Airport?', answer: 'Yes! For groups of 4 to 7 passengers we offer the Van (Mercedes Viano) – with plenty of room for all passengers and luggage. For exactly 8 passengers, our large taxi (Mercedes Vito, up to 8 passengers) is available. Simply select the appropriate vehicle category when booking – the price is calculated instantly.' },
          { question: 'When do I need a van instead of a regular taxi from Munich Airport?', answer: 'A van is the right choice when travelling with four or more people, carrying a lot of luggage, travelling with children and a stroller, or when you want the whole group to arrive together. For 4 or more passengers, a van is also almost always cheaper than two separate taxis.' },
          { question: 'How much luggage fits in a van from Munich Airport?', answer: 'Our van (Mercedes Viano) comfortably fits up to 7 passengers and up to 7 large suitcases. For even more luggage, we recommend the large taxi (Mercedes Vito, up to 8 passengers) with 12–13 suitcases depending on size. Drivers assist with loading and unloading – included at no extra charge.' },
          { question: 'Are there large taxis or vans for trade fair visitors at Munich Airport?', answer: 'Yes! Especially during Munich trade fairs (e.g. IAA, Bauma, ISPO, electronica) we strongly recommend booking in advance. At the taxi rank, large vehicles are often unavailable during peak times. With a pre-booking your vehicle is guaranteed – on time, with a name sign, directly to the trade fair or your hotel.' },
          { question: 'Is there a van transfer from Munich Airport for corporate groups or sports teams?', answer: 'Yes! We regularly provide group transfers for business delegations, conference attendees, and sports teams. Vans (4–7 passengers) and large taxis (up to 8 passengers) are available. For larger groups or regular bookings we are happy to provide an individual quote – just call or send a WhatsApp message.' },
        ],
      },
      {
        label: '🏙️ Getting There & Alternatives',
        items: [
          { question: 'What is the best way to get from Munich Airport to the city center?', answer: 'There are several options: S-Bahn (approx. 40–45 min, affordable but inconvenient with heavy luggage), bus/Lufthansa Express, taxi rank, or a pre-booked private transfer. Those who value comfort, punctuality, and door-to-door service choose a private fixed-price transfer: your driver waits at the exit, helps with luggage, and takes you directly to your destination – no stress, no transfers, at a fixed price.' },
          { question: 'What is better: taxi, S-Bahn, or private transfer from Munich Airport?', answer: 'The S-Bahn is affordable but not ideal with heavy luggage, large groups, or early morning arrivals. Regular taxis at the rank are flexible but more expensive due to metered fares and surcharges – and large vehicles are often unavailable. Flughafen-muenchen.TAXI offers the best of all: a fixed price with no surprises, personal meet-and-greet, luggage assistance, and direct door-to-door transport – 24/7, also for families and groups.' },
          { question: 'How long does the taxi ride from Munich Airport to the city center take?', answer: 'The drive from Munich Airport (MUC) to Munich city center takes approximately 35 to 50 minutes depending on traffic. The distance is about 38 km via the A9 motorway. During rush hours (7–9 am and 4–7 pm), the journey may take a little longer. We recommend planning your departure time accordingly.' },
          { question: 'How far is Munich Airport from the city center?', answer: 'Munich Airport (MUC) is located approximately 38 km north of the city center. By taxi or private transfer, the journey takes 35 to 50 minutes depending on traffic. By S-Bahn (S1 or S8), it takes approximately 40–45 minutes to the main train station (Hauptbahnhof).' },
          { question: 'Taxi from Munich Airport to Hauptbahnhof – price and duration?', answer: 'A fixed-price transfer from Munich Airport to Munich Hauptbahnhof (main train station) starts at €88 (sedan, 1–3 passengers) or €95 (van, 4–7 passengers). The journey takes approximately 35–50 minutes via the A9, depending on traffic. Your driver waits in the arrivals area with a name sign – no taxi rank, no queue.' },
          { question: 'How much does a taxi from Munich Airport to Schwabing or Maxvorstadt cost?', answer: 'A fixed-price transfer from Munich Airport to Schwabing or Maxvorstadt starts at €82 (sedan, 1–3 passengers) or €87 (van, 4–7 passengers). The journey takes approximately 30–45 minutes depending on traffic.' },
          { question: 'Taxi from Munich Airport – Terminal 1 or Terminal 2?', answer: 'We pick up from both terminals – Terminal 1 (T1) and Terminal 2 (T2). Please provide your flight number when booking so we know your exact arrivals area and can meet you at the exit on time. The price is the same regardless of terminal.' },
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
          { question: 'Ne kadar önceden rezervasyon yapmalıyım?', answer: 'En az 24 saat önceden rezervasyon yapmanızı öneririz. Son dakika rezervasyonları için lütfen bizi doğrudan arayın veya WhatsApp üzerinden yazın – son dakika taleplerini de karşılamaya çalışıyoruz. Tabii ki haftalar veya aylar öncesinden de rezervasyon yaptırabilirsiniz.' },
          { question: 'Sabit fiyatlar nedir ve neden avantajlıdır?', answer: 'Sabit fiyatlar, fiyatın rezervasyon sırasında belirleneceği ve trafik veya sapmalara bakılmaksızın değişmeyeceği anlamına gelir. Bu sayede tam maliyet kontrolüne sahip olur ve sürprizlerle karşılaşmazsınız.' },
          { question: 'Hangi ödeme yöntemleri kabul edilmektedir?', answer: 'Nakit (Euro) olarak doğrudan sürücüye veya kredi kartıyla ödeme yapabilirsiniz. Ödeme yöntemini rezervasyon sırasında seçersiniz.' },
          { question: 'Rezervasyonumu ücretsiz iptal edebilir miyim?', answer: 'Yolculuktan 3 saat öncesine kadar yapılan iptaller tamamen ücretsizdir – soru yok, ücret yok. Geç iptallerde veya gelmeme durumunda iptal ücreti alınabilir. Bu durumda lütfen bize mümkün olan en kısa sürede bildirin.' },
          { question: 'Gidiş-dönüş için indirim var mı?', answer: 'Evet! Gidiş-dönüş rezervasyonunda cazip bir indirim alırsınız. Bu, rezervasyon sürecinde otomatik olarak hesaplanır ve gösterilir.' },
          { question: 'Çocuk koltuğu ne kadara mal olur?', answer: "Çocuk koltukları tamamen ücretsizdir! Bebek taşıyıcı (0–12 ay), çocuk koltuğu (1–4 yaş, 18 kg'a kadar) ve yükseltici koltuk (4–12 yaş, 36 kg'a kadar) sunuyoruz. Rezervasyon sırasında istediğiniz türü seçin." },
          { question: 'Bisiklet getirebilir miyim?', answer: 'Evet, belirli araçlarda bisiklet taşıma imkânı vardır. Uygunluk ve ek ücret, rezervasyon sürecinde gösterilir. İstediğiniz bisiklet sayısını seçin.' },
          { question: 'Münih Havalimanı\'ndan şehir merkezine taksi ne kadar tutar?', answer: 'Sabit fiyat hizmetimizle Münih Havalimanı\'ndan şehir merkezine (ör. Hauptbahnhof veya Marienplatz) transfer, Kombi (1–3 kişi) için 88 €\'dan, Van (4–7 kişi) için 95 €\'dan başlar. Fiyat rezervasyon öncesinde belirlenir ve değişmez – taksimetre yok, trafik zammı yok, sürpriz yok.' },
          { question: 'Münih\'te taksi mi yoksa özel havalimanı transferi mi daha ucuz?', answer: 'Bizden önceden rezervasyon yapılan bir transfer, genellikle taksi durağındaki normal taksimetre taksilerden daha ucuzdur. Web sitemiz üzerinden önceden rezervasyon yaparak taksi durağına kıyasla %30\'a kadar tasarruf edebilirsiniz. Normal taksiler saate ve kilometreye göre ücret alır – gece, bagaj veya bekleme ücretleri de ayrıca eklenir. Bizimle şehir merkezine 88 €\'dan başlayan sabit bir fiyat ödersiniz, rezervasyon sırasında onaylanır. Sürpriz yok, ek ücret yok.' },
          { question: 'Münih Havalimanı\'ndan Salzburg\'a transfer ne kadar tutar?', answer: 'Münih Havalimanı\'ndan Salzburg\'a sabit fiyatlı transfer, Kombi (1–3 kişi) için 399 €\'dan, Van (4–7 kişi) için 420 €\'dan başlar. Kesin fiyat, web sitemizde rezervasyon sırasında hesaplanır ve onaylanır – varışta sürpriz yoktur.' },
        ],
      },
      {
        label: '✈️ Havalimanı & Karşılama',
        items: [
          { question: 'Uçuşumu takip ediyor musunuz?', answer: 'Evet! Uçuşunuzu gerçek zamanlı olarak takip ediyoruz. Gecikmeler durumunda sizi ücretsiz bekliyoruz. Uçuşunuzu takip edebilmemiz için rezervasyon sırasında uçuş numaranızı belirtin.' },
          { question: "Münih Havalimanı'nda nerede karşılanacağım?", answer: 'Sürücümüz, adınızın yazılı olduğu bir levhayla ilgili terminalin varış alanında sizi bekleyecek. Varışınızdan önce sürücünün tam bekleme konumunu size ileteceğiz.' },
          { question: 'Şoför beni ne kadar bekler?', answer: 'Havalimanı karşılamalarında, fiili iniş saatinden itibaren 60 dakika ücretsiz bekliyoruz. Havalimanı dışında 15 dakika ücretsiz bekliyoruz.' },
          { question: 'Uçuşumdan ne kadar önce havalimanında olmalıyım?', answer: 'Uçuşunuzdan 2,5 ila 3 saat önce havalimanında olmanızı öneririz. Rezervasyon yaparken tahmini seyahat süresini ve check-in sürelerini hesaba katın.' },
          { question: 'Uçuşum iptal edilirse ne olur?', answer: 'Lütfen bizi mümkün olan en kısa sürede telefon veya WhatsApp ile bilgilendirin. Uçuş iptalleri durumunda birlikte bir çözüm bulmaya çalışırız. Bu gibi durumlarda ücretsiz iptal mümkündür.' },
        ],
      },
      {
        label: '🚐 Araçlar & Konfor',
        items: [
          { question: 'Hangi araçlar mevcut?', answer: 'Üç araç kategorisi sunuyoruz: Kombi (1–3 kişi), Van/Minibüs (4–7 kişi) ve Büyük Taksi (en fazla 8 kişi). Tüm araçlar modern ve klimalidir.' },
          { question: 'Ne kadar bagaj getirebilirim?', answer: 'Bu seçilen araca bağlıdır: Kombi: 3 valiz, Van/Minibüs: 7 valiz, Büyük Taksi: 12 valiz. Çok fazla bagajınız varsa lütfen uygun araç kategorisini seçin.' },
          { question: 'Sürücüler çok dilli mi?', answer: 'Evet! Sürücülerimiz Almanca, İngilizce ve Türkçe konuşur; böylece tercih ettiğiniz dilde yardımcı olabiliriz.' },
          { question: 'Araçlar sigortalı mı?', answer: 'Elbette! Tüm araçlarımız tam sorumluluk ve kapsamlı sigortaya sahiptir. Güvenliğiniz bizim için en yüksek önceliktir.' },
          { question: 'Şoförler bagajla yardım eder mi?', answer: 'Evet, tabi ki! Şoförlerimiz kaç valiziniz olursa olsun bagajınızı yüklemenize ve indirmenize yardım eder. Bu hizmet dahildir, ek ücret alınmaz.' },
          { question: 'Münih Havalimanı\'nda en iyi taksi hizmeti hangisi?', answer: 'Flughafen-muenchen.TAXI, Münih Havalimanı\'ndaki en yüksek puanlı özel transfer hizmetlerinden biridir – 100.000\'den fazla müşteriden 4,9/5 yıldız ve 20 yıllık deneyimle. Sabit fiyatlar, isim tabelasıyla kişisel karşılama, ücretsiz uçuş takibi, dahili 60 dakika bekleme süresi ve 1 ila 8 kişilik araçlar sunuyoruz. Tüm şoförler Almanca, İngilizce ve Türkçe konuşur.' },
          { question: 'Münih Havalimanı\'nda büyük taksi veya minibüs var mı?', answer: 'Evet! Gruplar ve aileler için özel olarak Van (Mercedes Viano, 4–7 kişi) ve büyük taksi (Mercedes Vito, en fazla 8 kişi) sunuyoruz. Bu araçlar normal taksi durağında çoğunlukla hemen mevcut olmayabilir – bizde önceden rezervasyonla garanti altındadır, ek ücret olmaksızın sabit fiyatla.' },
        ],
      },
      {
        label: '🚐 Van & Büyük Taksi',
        items: [
          { question: 'Münih Havalimanı\'ndan şehir merkezine Van ne kadar tutar?', answer: 'Münih Havalimanı\'ndan şehir merkezine Van (Mercedes Viano, 4–7 kişi) transferi 95 €\'dan başlar. Bu, 1–3 kişilik Kombi\'den yalnızca 7 € fazla – üstelik Van 7 kişi ve bol bagaj için yer sunar. 4 kişi ve üzeri gruplar için en ekonomik seçim.' },
          { question: 'Daha ucuz olan hangisi: 2 taksi mi yoksa 1 Van mı Münih Havalimanı\'ndan?', answer: '4 kişi ve üzeri gruplar için Van neredeyse her zaman daha ucuzdur. Örnek: Şehir merkezine iki Kombi 88 € x 2 = 176 €. 7 kişiye kadar bir Van ise sadece 95 € – 80 €\'dan fazla tasarruf. Üstelik herkes birlikte seyahat eder, tek şoför, koordinasyon gerekmez.' },
          { question: '5, 6, 7 veya 8 kişilik grup Münih Havalimanı\'ndan tek taksiye binebilir mi?', answer: 'Evet! 4 ila 7 kişilik gruplar için Van (Mercedes Viano) sunuyoruz – tüm yolcular ve bagaj için yeterli alan var. 8 kişi ve üzeri için büyük taksi (Mercedes Vito) mevcuttur. Rezervasyon sırasında uygun araç kategorisini seçin – fiyat anında hesaplanır.' },
          { question: 'Münih Havalimanı\'ndan ne zaman normal taksi yerine Van gerekir?', answer: '4 kişi veya daha fazla seyahat ediyorsanız, çok bagajınız varsa, çocuk arabalı aile seyahatindeyseniz veya grubun birlikte gelmesini istiyorsanız Van doğru seçimdir. 4 kişi ve üzeri için Van, neredeyse her zaman iki ayrı taksiden de daha ucuzdur.' },
          { question: 'Münih Havalimanı\'ndan Van\'a ne kadar bagaj sığar?', answer: 'Mercedes Viano Van\'ımız 7 yolcu ve 7 büyük valizi rahatça taşır. Daha fazla bagaj için en fazla 8 kişilik büyük taksi (Mercedes Vito) öneririz — büyüklüğe göre 12–13 valiz kapasitesi. Şoförlerimiz yükleme ve indirmede yardımcı olur – dahil, ek ücret yok.' },
          { question: 'Münih Havalimanı\'nda fuar ziyaretçileri için büyük taksi veya Van var mı?', answer: 'Evet! Özellikle Münih fuarları (ör. IAA, Bauma, ISPO, electronica) döneminde önceden rezervasyon öneriyoruz. Taksi durağında büyük araçlar yoğun dönemlerde çoğunlukla mevcut olmayabilir. Önceden rezervasyonla aracınız garanti – zamanında, isim tabelasıyla, doğrudan fuara veya otelinize.' },
          { question: 'Münih Havalimanı\'ndan firma grupları veya spor takımları için Van transferi var mı?', answer: 'Evet! Firma heyetleri, kongre katılımcıları ve spor takımları için düzenli grup transferleri yapıyoruz. Van (4–7 kişi) ve büyük taksi (en fazla 8 kişi) mevcuttur. Büyük gruplar veya düzenli rezervasyonlar için özel teklif hazırlarız – telefon veya WhatsApp ile ulaşın.' },
        ],
      },
      {
        label: '🏙️ Ulaşım & Alternatifler',
        items: [
          { question: 'Münih Havalimanı\'ndan şehir merkezine en iyi nasıl gidilir?', answer: 'Birkaç seçenek mevcuttur: S-Bahn (yaklaşık 40–45 dakika, uygun fiyatlı ama çok bagajla pratik değil), otobüs/Lufthansa Express, taksi durağı veya önceden rezerve edilmiş özel transfer. Konfor, dakiklik ve kapıdan kapıya ulaşım isteyenler özel sabit fiyatlı transferi tercih eder: şoförünüz çıkışta sizi bekler, bagajınıza yardım eder ve doğrudan hedefinize götürür – stres yok, aktarma yok, sabit fiyatla.' },
          { question: 'Hangisi daha iyi: Taksi mi, S-Bahn mi, yoksa özel transfer mi?', answer: 'S-Bahn uygun fiyatlıdır, ancak çok bagajla, büyük gruplarla veya sabahın erken saatlerinde idealden uzak kalır. Taksi durağındaki taksiler esnektir ama taksimetre ve ek ücretler nedeniyle daha pahalıdır – büyük araçlar da çoğunlukla mevcut değildir. Flughafen-muenchen.TAXI en iyisini sunar: sürpriz yok sabit fiyat, isim tabelasıyla karşılama, bagaj yardımı ve kapıdan kapıya ulaşım – 7/24, aileler ve gruplar için de.' },
          { question: 'Münih Havalimanı\'ndan şehir merkezine taksi yolculuğu ne kadar sürer?', answer: 'Münih Havalimanı\'ndan (MUC) şehir merkezine sürüş, trafik koşullarına bağlı olarak yaklaşık 35 ile 50 dakika sürer. Mesafe A9 otoyolu üzerinden yaklaşık 38 km\'dir. Rush hour dönemlerinde (sabah 7–9 ve öğleden sonra 16–19) yolculuk biraz daha uzun sürebilir. Kalkış saatinizi buna göre planlamanızı öneririz.' },
          { question: 'Münih Havalimanı şehir merkezine ne kadar uzak?', answer: 'Münih Havalimanı (MUC), şehir merkezinin yaklaşık 38 km kuzeyinde yer alır. Taksi veya özel transferle yolculuk, trafiğe bağlı olarak 35 ila 50 dakika sürer. S-Bahn (S1 veya S8) ile Hauptbahnhof\'a ulaşmak yaklaşık 40–45 dakika sürer.' },
          { question: 'Münih Havalimanı\'ndan Hauptbahnhof\'a taksi – fiyat ve süre?', answer: 'Münih Havalimanı\'ndan Hauptbahnhof\'a (ana tren garı) sabit fiyatlı transfer, Kombi (1–3 kişi) için 88 €\'dan, Van (4–7 kişi) için 95 €\'dan başlar. A9 üzerinden trafike bağlı yaklaşık 35–50 dakika sürer. Şoförünüz varış alanında isim tabelasıyla bekler – taksi kuyruğu yok, bekleme yok.' },
          { question: 'Münih Havalimanı\'ndan Schwabing veya Maxvorstadt\'a taksi ne kadar?', answer: 'Münih Havalimanı\'ndan Schwabing veya Maxvorstadt\'a sabit fiyatlı transfer, Kombi (1–3 kişi) için 82 €\'dan, Van (4–7 kişi) için 87 €\'dan başlar. Trafike bağlı olarak yaklaşık 30–45 dakika sürer.' },
          { question: 'Münih Havalimanı\'nda Terminal 1 mi Terminal 2 mi?', answer: 'Her iki terminalden de alım yapıyoruz – Terminal 1 (T1) ve Terminal 2 (T2). Kesin varış alanınızı bilmemiz ve sizi çıkışta zamanında karşılayabilmemiz için rezervasyon sırasında uçuş numaranızı belirtin. Fiyat terminale bakılmaksızın aynıdır.' },
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
