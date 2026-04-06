// SEO Event Pages Data for flughafen-muenchen.taxi
// 20 major Munich events with bilingual German/English content

export interface StatCard {
  valueDE: string;
  valueEN: string;
  labelDE: string;
  labelEN: string;
  icon: string;
}

export interface EventTip {
  tipDE: string;
  tipEN: string;
  icon: string;
}

export interface Event {
  slug: string;
  titleDE: string;
  titleEN: string;
  subtitleDE: string;
  subtitleEN: string;
  datesDE: string;
  datesEN: string;
  locationDE: string;
  locationEN: string;
  descriptionDE: string;
  descriptionEN: string;
  stats: StatCard[];
  tips: EventTip[];
  aboutDE: string;
  aboutEN: string;
  visitorNumbers: string;
  internationality: string;
  startDate: Date;
  endDate: Date;
}

export const eventsData: Event[] = [
  {
    slug: 'bauma-muenchen',
    titleDE: 'bauma München',
    titleEN: 'bauma Munich',
    subtitleDE: 'Weltweit führende Fachmesse für Baumaschinerie',
    subtitleEN: 'World\'s Leading Trade Fair for Construction Machinery',
    datesDE: '7.–13. April 2028',
    datesEN: 'April 7–13, 2028',
    locationDE: 'Messe München',
    locationEN: 'Munich Exhibition Centre',
    descriptionDE: 'Die bauma ist die weltweit wichtigste Fachmesse für Baumaschinerie, Baugeräte und Baustoffaufbereitung. Rund 3.500 Aussteller aus über 60 Ländern präsentieren ihre innovativen Lösungen für Bauwirtschaft, Landwirtschaft und Rohstoffgewinnung. Die bauma zieht international tätige Entscheidungsträger und Fachmänninge an.',
    descriptionEN: 'bauma is the world\'s leading trade fair for construction machinery, building equipment, and mineral processing. Around 3,500 exhibitors from over 60 countries showcase innovative solutions for construction, agriculture, and raw material extraction. bauma attracts international decision-makers and specialists.',
    stats: [
      {
        valueDE: '~620.000',
        valueEN: '~620,000',
        labelDE: 'Besucher weltweit',
        labelEN: 'Visitors worldwide',
        icon: '👥'
      },
      {
        valueDE: '3.500+',
        valueEN: '3,500+',
        labelDE: 'Aussteller',
        labelEN: 'Exhibitors',
        icon: '🏭'
      },
      {
        valueDE: '60+',
        valueEN: '60+',
        labelDE: 'Länder vertreten',
        labelEN: 'Countries represented',
        icon: '🌍'
      },
      {
        valueDE: '~€3,5 Mrd.',
        valueEN: '~€3.5B',
        labelDE: 'Wirtschaftlicher Impact',
        labelEN: 'Economic Impact',
        icon: '💰'
      },
      {
        valueDE: '7',
        valueEN: '7',
        labelDE: 'Tage Dauer',
        labelEN: 'Days Duration',
        icon: '📅'
      }
    ],
    tips: [
      {
        tipDE: 'Buchen Sie Ihren Flughafentransfer im Voraus – Messe-Tage sind hochfrequentiert',
        tipEN: 'Book your airport transfer in advance – trade fair days are heavily booked',
        icon: '🚕'
      },
      {
        tipDE: 'Bequeme Schuhe tragen – das Messegelände ist riesig',
        tipEN: 'Wear comfortable shoes – the exhibition grounds are huge',
        icon: '👞'
      },
      {
        tipDE: 'Frühmorgens anreisen, um Staus zu vermeiden',
        tipEN: 'Arrive early in the morning to avoid traffic',
        icon: '⏰'
      },
      {
        tipDE: 'Aussteller-Programme und Führungen im Voraus buchen',
        tipEN: 'Book exhibitor programs and guided tours in advance',
        icon: '📋'
      }
    ],
    aboutDE: 'Die bauma findet alle drei Jahre statt und ist seit 1954 die international wichtigste Leistungsschau für Baumaschinen und Zubehör. Die Messe zieht Käufer, Mieter und Entscheidungsträger aus Bauunternehmen, Rohstoff- und Recyclingwirtschaft sowie Landwirtschaft an. Mit ihrer globalen Reichweite ist die bauma eine Plattform für technische Innovationen und wirtschaftliche Chancen in der Bauindustrie.\n\nDas Messegelände der Messe München bietet modernste Infrastruktur und ist optimal mit öffentlichen Verkehrsmitteln erreichbar. Für internationale Besucher ist ein Privat-Taxi vom Flughafen München eine komfortable und zuverlässige Transportlösung, die Zeit und Stress spart.',
    aboutEN: 'Held every three years since 1954, bauma is the world\'s most important showcase for construction machinery and equipment. The fair attracts buyers, renters, and decision-makers from construction companies, raw material and recycling industries, as well as agriculture. With its global reach, bauma is a platform for technical innovation and economic opportunities in the construction industry.\n\nThe Munich Exhibition Centre offers state-of-the-art infrastructure and is well-connected by public transport. For international visitors, a private taxi from Munich Airport is a comfortable and reliable transportation solution that saves time and stress.',
    visitorNumbers: '~620,000 visitors (global)',
    internationality: '~70% international visitors',
    startDate: new Date('2028-04-07'),
    endDate: new Date('2028-04-13')
  },
  {
    slug: 'iaa-mobility',
    titleDE: 'IAA Mobility',
    titleEN: 'IAA Mobility',
    subtitleDE: 'Internationale Automobilausstellung und Mobilitätsmesse',
    subtitleEN: 'International Motor Show & Mobility Fair',
    datesDE: '7.–17. September 2027',
    datesEN: 'September 7–17, 2027',
    locationDE: 'Gelände der Messe München',
    locationEN: 'Munich Exhibition Centre',
    descriptionDE: 'Die IAA Mobility ist Europas wichtigste Ausstellung für Mobilität und Fahrzeugtechnologie. Führende Automobilhersteller und innovative Tech-Unternehmen präsentieren die Zukunft der Mobilität: E-Fahrzeuge, autonomes Fahren, Carsharing und nachhaltige Transportlösungen. Die Messe lockt Fachbesucher und Privatbesucher aus aller Welt an.',
    descriptionEN: 'IAA Mobility is Europe\'s premier exhibition for mobility and automotive technology. Leading automakers and innovative tech companies showcase the future of mobility: electric vehicles, autonomous driving, car-sharing, and sustainable transportation solutions. The fair attracts professional and consumer visitors worldwide.',
    stats: [
      {
        valueDE: '~700.000',
        valueEN: '~700,000',
        labelDE: 'Besucher',
        labelEN: 'Visitors',
        icon: '👥'
      },
      {
        valueDE: '1.000+',
        valueEN: '1,000+',
        labelDE: 'Aussteller',
        labelEN: 'Exhibitors',
        icon: '🏢'
      },
      {
        valueDE: '11',
        valueEN: '11',
        labelDE: 'Tage Dauer',
        labelEN: 'Days Duration',
        icon: '📅'
      },
      {
        valueDE: '100+',
        valueEN: '100+',
        labelDE: 'Marken',
        labelEN: 'Brands',
        icon: '🏷️'
      },
      {
        valueDE: '~45%',
        valueEN: '~45%',
        labelDE: 'Internationale Besucher',
        labelEN: 'International Visitors',
        icon: '✈️'
      }
    ],
    tips: [
      {
        tipDE: 'Reservieren Sie Ihren Flughafentransfer früh – September ist Hochsaison',
        tipEN: 'Reserve your airport transfer early – September is peak season',
        icon: '🚕'
      },
      {
        tipDE: 'Bequeme Kleidung und Schuhe tragen – viel Geherei',
        tipEN: 'Wear comfortable clothing and shoes – lots of walking',
        icon: '👟'
      },
      {
        tipDE: 'Digitale Tickets & Parkausweis im Voraus besorgen',
        tipEN: 'Get digital tickets and parking pass in advance',
        icon: '🎟️'
      },
      {
        tipDE: 'Highlight-Fahrzeuge und Präsentationen vorplanen',
        tipEN: 'Plan which highlight vehicles and presentations to see',
        icon: '🚗'
      }
    ],
    aboutDE: 'Die IAA Mobility ist die neueste Iteration der legendären Internationalen Automobil-Ausstellung, die ihre Traditionen neu definiert. Die moderne Messe präsentiert nicht nur Fahrzeuge, sondern ein umfassendes Ökosystem der zukünftigen urbanen Mobilität. Mit ihrer starken internationalen Ausrichtung zieht sie Entscheidungsträger aus der Industrie, Politik und Medien an.\n\nFür Besucher aus dem In- und Ausland bietet ein privates Taxi vom Flughafen München eine stressfreie Anfahrt zur Messe und ist ideal für Terminal-to-Hotel-Transfers mit Gepäck.',
    aboutEN: 'IAA Mobility is the latest iteration of the legendary International Motor Show, redefining its traditions for the modern era. The contemporary fair showcases not just vehicles, but a comprehensive ecosystem of future urban mobility. With its strong international focus, it attracts industry leaders, policymakers, and media worldwide.\n\nFor domestic and international visitors, a private taxi from Munich Airport offers stress-free transportation to the fair and is ideal for terminal-to-hotel transfers with luggage.',
    visitorNumbers: '~700,000 visitors',
    internationality: '~45% international visitors',
    startDate: new Date('2027-09-07'),
    endDate: new Date('2027-09-17')
  },
  {
    slug: 'ifat-muenchen',
    titleDE: 'IFAT München',
    titleEN: 'IFAT Munich',
    subtitleDE: 'Weltleitmesse für Umwelttechnologien',
    subtitleEN: 'World\'s Leading Environmental Technology Fair',
    datesDE: '19.–23. Mai 2026',
    datesEN: 'May 19–23, 2026',
    locationDE: 'Messe München',
    locationEN: 'Munich Exhibition Centre',
    descriptionDE: 'IFAT ist die weltgrößte Messe für Umwelttechnologien, Abfallwirtschaft, Wasser- und Rohstoffmanagement. Die Messe zeigt innovative Lösungen für nachhaltige Ressourcenbewirtschaftung und zieht über 3.500 Aussteller aus mehr als 60 Ländern an. Fachbesucher und Entscheidungsträger aus kommunalen und industriellen Unternehmen prägen das Publikum.',
    descriptionEN: 'IFAT is the world\'s largest fair for environmental technologies, waste management, water, and resource management. The fair showcases innovative solutions for sustainable resource management and attracts over 3,500 exhibitors from more than 60 countries. Professional visitors and decision-makers from municipal and industrial companies dominate the audience.',
    stats: [
      {
        valueDE: '~3.500',
        valueEN: '~3,500',
        labelDE: 'Aussteller',
        labelEN: 'Exhibitors',
        icon: '🏭'
      },
      {
        valueDE: '~280.000',
        valueEN: '~280,000',
        labelDE: 'Fachbesucher',
        labelEN: 'Professional Visitors',
        icon: '👥'
      },
      {
        valueDE: '60+',
        valueEN: '60+',
        labelDE: 'Länder',
        labelEN: 'Countries',
        icon: '🌍'
      },
      {
        valueDE: '5',
        valueEN: '5',
        labelDE: 'Tage Messe',
        labelEN: 'Fair Days',
        icon: '📅'
      }
    ],
    tips: [
      {
        tipDE: 'Buchen Sie den Transfer rechtzeitig – Mai ist Hauptreisezeit',
        tipEN: 'Book transfer in time – May is peak travel season',
        icon: '🚕'
      },
      {
        tipDE: 'Fachbesucher-Ausweise online beantragen',
        tipEN: 'Apply for professional visitor pass online',
        icon: '🎫'
      },
      {
        tipDE: 'Spezielle Branchenführungen nutzen',
        tipEN: 'Take advantage of industry-specific guided tours',
        icon: '🗺️'
      },
      {
        tipDE: 'Bequeme Schuhe sind essentiell für den großen Messegelände',
        tipEN: 'Comfortable shoes are essential for the large fairgrounds',
        icon: '👞'
      }
    ],
    aboutDE: 'IFAT findet alle zwei Jahre statt und ist seit 1966 die maßgebliche internationale Plattform für Umwelttechnologie. Die Messe verbindet Angebot und Nachfrage für Lösungen in Abfallwirtschaft, Wasser- und Rohstoffmanagement. Sie bietet Fachleuten die Möglichkeit, neue Technologien zu entdecken und internationale Kontakte zu knüpfen.\n\nMünchen hat sich als Zentrum der Umwelttechinnovation etabliert, und IFAT zieht führende Experten und Käufer aus aller Welt an. Ein privates Taxi vom Flughafen ist für Business-Besucher die komfortabelste Option.',
    aboutEN: 'IFAT takes place every two years and has been the authoritative international platform for environmental technology since 1966. The fair connects supply and demand for solutions in waste management, water, and resource management. It offers professionals the opportunity to discover new technologies and build international contacts.\n\nMunich has established itself as a center for environmental technology innovation, and IFAT attracts leading experts and buyers worldwide. A private taxi from the airport is the most comfortable option for business visitors.',
    visitorNumbers: '~280,000 professional visitors',
    internationality: '~60% international visitors',
    startDate: new Date('2026-05-19'),
    endDate: new Date('2026-05-23')
  },
  {
    slug: 'electronica-muenchen',
    titleDE: 'electronica München',
    titleEN: 'electronica Munich',
    subtitleDE: 'Weltgrößte Messe für Elektronik und Komponenten',
    subtitleEN: 'World\'s Largest Electronics & Components Fair',
    datesDE: '10.–13. November 2026',
    datesEN: 'November 10–13, 2026',
    locationDE: 'Messe München',
    locationEN: 'Munich Exhibition Centre',
    descriptionDE: 'electronica ist die weltweit bedeutendste Fachmesse für Elektronik, Komponenten und Halbleitertechnik. Mit über 3.100 Ausstellern und etwa 70.000 Fachbesuchern aus über 100 Ländern ist es die Plattform für globale Elektronik-Innovationen. Die Messe zeigt die neuesten Entwicklungen in Chipdesign, IoT, embedded systems und industrieller Elektronik.',
    descriptionEN: 'electronica is the world\'s most important trade fair for electronics, components, and semiconductor technology. With over 3,100 exhibitors and approximately 70,000 professional visitors from over 100 countries, it\'s the platform for global electronics innovation. The fair showcases the latest developments in chip design, IoT, embedded systems, and industrial electronics.',
    stats: [
      {
        valueDE: '3.100+',
        valueEN: '3,100+',
        labelDE: 'Aussteller',
        labelEN: 'Exhibitors',
        icon: '🏢'
      },
      {
        valueDE: '~70.000',
        valueEN: '~70,000',
        labelDE: 'Fachbesucher',
        labelEN: 'Professional Visitors',
        icon: '👥'
      },
      {
        valueDE: '100+',
        valueEN: '100+',
        labelDE: 'Länder vertreten',
        labelEN: 'Countries represented',
        icon: '🌍'
      },
      {
        valueDE: '4',
        valueEN: '4',
        labelDE: 'Tage',
        labelEN: 'Days',
        icon: '📅'
      },
      {
        valueDE: '~€100 Mio.',
        valueEN: '~€100M',
        labelDE: 'Geschäftsvolumen',
        labelEN: 'Business Volume',
        icon: '💰'
      }
    ],
    tips: [
      {
        tipDE: 'Frühes Buchen des Transfers – November ist ein beliebtes Monat',
        tipEN: 'Book your transfer early – November is a popular month',
        icon: '🚕'
      },
      {
        tipDE: 'Fachbesucher-Accreditation Online beantragen',
        tipEN: 'Request professional visitor accreditation online',
        icon: '🎫'
      },
      {
        tipDE: 'Detailliertes Messeplan-Herunterladen vor dem Besuch',
        tipEN: 'Download detailed fair map before your visit',
        icon: '📱'
      },
      {
        tipDE: 'Viele Besprechungen im Voraus vereinbaren',
        tipEN: 'Schedule many meetings in advance',
        icon: '📞'
      }
    ],
    aboutDE: 'electronica findet alle zwei Jahre statt und ist seit 1964 die führende globale Plattform für Elektronik-Profis. Die Messe verbindet Hersteller, Distributoren und Käufer aus der Elektronik-, Halbleiter- und Elektrotechnik-Industrie. Für internationale Tech-Experten bietet Munich ein ideales Umfeld – moderne Infrastruktur und weltklasse Fachmessen.\n\nEin direkter Transfer vom Flughafen mit privatem Taxi spart Zeit für Business-Reisende und ermöglicht entspanntes Ankommen mit Gepäck.',
    aboutEN: 'Held every two years since 1964, electronica is the leading global platform for electronics professionals. The fair connects manufacturers, distributors, and buyers from the electronics, semiconductor, and electrical engineering industries. For international tech experts, Munich offers an ideal environment – modern infrastructure and world-class trade fairs.\n\nA direct transfer from the airport by private taxi saves time for business travelers and enables relaxed arrival with luggage.',
    visitorNumbers: '~70,000 professional visitors',
    internationality: '~65% international visitors',
    startDate: new Date('2026-11-10'),
    endDate: new Date('2026-11-13')
  },
  {
    slug: 'expo-real',
    titleDE: 'EXPO REAL',
    titleEN: 'EXPO REAL',
    subtitleDE: 'Europas führende Immobilien- und Investmentmesse',
    subtitleEN: 'Europe\'s Leading Real Estate & Investment Fair',
    datesDE: '6.–8. Oktober 2026',
    datesEN: 'October 6–8, 2026',
    locationDE: 'Messe München',
    locationEN: 'Munich Exhibition Centre',
    descriptionDE: 'EXPO REAL ist die führende internationale Immobilienmesse für Investitionen, Leasing und Projektentwicklung. Mit über 2.000 Ausstellern aus der ganzen Welt bietet die Messe eine Plattform für Immobiliengeschäfte mit Fokus auf Büro, Einzelhandel, Hotel, Logistik und Wohnen. Entscheidungsträger aus Investmentfirmen, Entwicklern und Immobilien-Unternehmen treffen hier zusammen.',
    descriptionEN: 'EXPO REAL is the leading international real estate fair for investment, leasing, and project development. With over 2,000 exhibitors from around the world, the fair offers a platform for real estate business focusing on office, retail, hotel, logistics, and residential. Decision-makers from investment firms, developers, and real estate companies meet here.',
    stats: [
      {
        valueDE: '2.000+',
        valueEN: '2,000+',
        labelDE: 'Aussteller',
        labelEN: 'Exhibitors',
        icon: '🏢'
      },
      {
        valueDE: '~45.000',
        valueEN: '~45,000',
        labelDE: 'Besucher',
        labelEN: 'Visitors',
        icon: '👥'
      },
      {
        valueDE: '80+',
        valueEN: '80+',
        labelDE: 'Länder',
        labelEN: 'Countries',
        icon: '🌍'
      },
      {
        valueDE: '3',
        valueEN: '3',
        labelDE: 'Tage',
        labelEN: 'Days',
        icon: '📅'
      },
      {
        valueDE: '~€1+ Bio.',
        valueEN: '~€1+ Tri.',
        labelDE: 'Transaktionsvolumen',
        labelEN: 'Transaction Volume',
        icon: '💰'
      }
    ],
    tips: [
      {
        tipDE: 'Akreditierung für Fachbesucher im Voraus sichern',
        tipEN: 'Secure professional visitor accreditation in advance',
        icon: '🎫'
      },
      {
        tipDE: 'Privattaxi für Termine zwischen Hotels und Messe buchen',
        tipEN: 'Book private taxi for meetings between hotels and fair',
        icon: '🚕'
      },
      {
        tipDE: 'Viele Geschäftstreffen in München-Hotels vereinbaren',
        tipEN: 'Arrange many business meetings in Munich hotels',
        icon: '🏨'
      },
      {
        tipDE: 'Formelle Geschäftskleidung empfohlen',
        tipEN: 'Formal business attire recommended',
        icon: '👔'
      }
    ],
    aboutDE: 'EXPO REAL findet jährlich im Oktober statt und ist seit 1990 Europas größte und bedeutendste Immobilienmesse. Die Messe ist die zentrale Plattform für Entscheidungsträger in der internationalen Immobilienwirtschaft. Sie werden hier zu Strategien, Trends und Chancen informiert und können weltweit tätige Partner treffen.\n\nMünchen als Standort für EXPO REAL unterstreicht die Bedeutung Bayerns als Immobilien- und Investitionsregion. Ein Transfer vom Flughafen mit privatem Taxi ist für Geschäftsreisende ideal.',
    aboutEN: 'EXPO REAL takes place annually in October and has been Europe\'s largest and most important real estate fair since 1990. The fair is the central platform for decision-makers in the international real estate industry. Visitors are informed about strategies, trends, and opportunities and can meet internationally active partners here.\n\nMunich as the location for EXPO REAL underscores Bavaria\'s significance as a real estate and investment region. A transfer from the airport by private taxi is ideal for business travelers.',
    visitorNumbers: '~45,000 visitors',
    internationality: '~70% international visitors',
    startDate: new Date('2026-10-06'),
    endDate: new Date('2026-10-08')
  },
  {
    slug: 'intersolar-muenchen',
    titleDE: 'Intersolar München',
    titleEN: 'Intersolar Munich',
    subtitleDE: 'Weltleitmesse für Solarwirtschaft und Energiewende',
    subtitleEN: 'World\'s Leading Solar & Energy Transition Fair',
    datesDE: '9.–11. Juni 2026',
    datesEN: 'June 9–11, 2026',
    locationDE: 'Messe München',
    locationEN: 'Munich Exhibition Centre',
    descriptionDE: 'Intersolar ist die weltweit führende Fachmesse für die Solarindustrie und Energiewende. Die Messe bringt über 2.500 Aussteller zusammen und zeigt die neueste Technologie in Photovoltaik, Solarthermie, Batterie-Speicher und smarten Energiesystemen. Fachbesucher aus über 150 Ländern nutzen Intersolar, um sich über globale Trends zu informieren.',
    descriptionEN: 'Intersolar is the world\'s leading trade fair for the solar industry and energy transition. The fair brings together over 2,500 exhibitors and showcases the latest technology in photovoltaics, solar thermal, battery storage, and smart energy systems. Professional visitors from over 150 countries use Intersolar to learn about global trends.',
    stats: [
      {
        valueDE: '2.500+',
        valueEN: '2,500+',
        labelDE: 'Aussteller',
        labelEN: 'Exhibitors',
        icon: '🏭'
      },
      {
        valueDE: '~45.000',
        valueEN: '~45,000',
        labelDE: 'Fachbesucher',
        labelEN: 'Professional Visitors',
        icon: '👥'
      },
      {
        valueDE: '150+',
        valueEN: '150+',
        labelDE: 'Länder',
        labelEN: 'Countries',
        icon: '🌍'
      },
      {
        valueDE: '3',
        valueEN: '3',
        labelDE: 'Tage',
        labelEN: 'Days',
        icon: '📅'
      },
      {
        valueDE: '~100%',
        valueEN: '~100%',
        labelDE: 'Auslastung',
        labelEN: 'Capacity',
        icon: '⚡'
      }
    ],
    tips: [
      {
        tipDE: 'Early-bird Registrierung für vergünstigte Tickets nutzen',
        tipEN: 'Use early-bird registration for discounted tickets',
        icon: '🎫'
      },
      {
        tipDE: 'Flughafentransfer mit Taxi rechtzeitig buchen',
        tipEN: 'Book airport transfer by taxi early',
        icon: '🚕'
      },
      {
        tipDE: 'Halle-Maps downloaden und Spezial-Seminare vorplanen',
        tipEN: 'Download hall maps and plan special seminars',
        icon: '📱'
      },
      {
        tipDE: 'Juni-Wetter: Leichte Kleidung und Sonnenschutz',
        tipEN: 'June weather: Light clothing and sun protection',
        icon: '☀️'
      }
    ],
    aboutDE: 'Intersolar findet jährlich in München statt und ist seit 2005 die internationale Leitplattform für Solar- und Speichertechnologie. Die Messe verbindet Hersteller, Installateure, Planer und Entscheidungsträger aus der Energie- und Bauwirtschaft. Bayern als Zukunftsregion für regenerative Energien hat in Intersolar eine globale Plattform.\n\nFür internationale Tech-Profis ist ein privates Taxi vom Flughafen München die praktischste Lösung für pünktliche Ankunft.',
    aboutEN: 'Intersolar takes place annually in Munich and has been the international leading platform for solar and storage technology since 2005. The fair connects manufacturers, installers, planners, and decision-makers from the energy and construction industries. Bavaria as a future region for renewable energy has found a global platform in Intersolar.\n\nFor international tech professionals, a private taxi from Munich Airport is the most practical solution for timely arrival.',
    visitorNumbers: '~45,000 professional visitors',
    internationality: '~65% international visitors',
    startDate: new Date('2026-06-09'),
    endDate: new Date('2026-06-11')
  },
  {
    slug: 'heim-handwerk',
    titleDE: 'Heim + Handwerk',
    titleEN: 'Heim + Handwerk',
    subtitleDE: 'Europas größte Messe für Wohnen und Handwerk',
    subtitleEN: 'Europe\'s Largest Fair for Home & Crafts',
    datesDE: '5.–8. November 2026',
    datesEN: 'November 5–8, 2026',
    locationDE: 'Messe München',
    locationEN: 'Munich Exhibition Centre',
    descriptionDE: 'Heim + Handwerk ist die größte Messe in Deutschland für Wohnen, Innenausstattung und Handwerk. Mit über 1.100 Ausstellern wird die ganze Bandbreite von Möbeln, Innenarchitektur und handwerklichen Produkten präsentiert. Besucher finden Inspiration für ihre Wohnprojekte und können direkt mit Herstellern und Handwerksbetrieben in Kontakt treten.',
    descriptionEN: 'Heim + Handwerk is Germany\'s largest fair for home, interior design, and crafts. With over 1,100 exhibitors, the fair showcases the full range of furniture, interior architecture, and craft products. Visitors find inspiration for their living projects and can directly contact manufacturers and craft businesses.',
    stats: [
      {
        valueDE: '1.100+',
        valueEN: '1,100+',
        labelDE: 'Aussteller',
        labelEN: 'Exhibitors',
        icon: '🏢'
      },
      {
        valueDE: '~180.000',
        valueEN: '~180,000',
        labelDE: 'Besucher',
        labelEN: 'Visitors',
        icon: '👥'
      },
      {
        valueDE: '4',
        valueEN: '4',
        labelDE: 'Tage',
        labelEN: 'Days',
        icon: '📅'
      },
      {
        valueDE: '~50.000 m²',
        valueEN: '~50,000 m²',
        labelDE: 'Ausstellungsfläche',
        labelEN: 'Exhibition Space',
        icon: '📐'
      }
    ],
    tips: [
      {
        tipDE: 'Online-Tickets vorausbuchen – spart Zeit an der Kasse',
        tipEN: 'Pre-book online tickets – saves time at the counter',
        icon: '🎫'
      },
      {
        tipDE: 'Privattaxi vom Flughafen für bequeme Anreise mit Einkäufen',
        tipEN: 'Private taxi from airport for comfortable arrival with purchases',
        icon: '🚕'
      },
      {
        tipDE: 'Notizblock und Kamera mitbringen für Ideen',
        tipEN: 'Bring notebook and camera for ideas',
        icon: '📸'
      },
      {
        tipDE: 'Die Messe ist familienfreundlich – auch für Kinder interessant',
        tipEN: 'The fair is family-friendly – interesting for children too',
        icon: '👨‍👩‍👧‍👦'
      }
    ],
    aboutDE: 'Heim + Handwerk findet jährlich im November statt und ist seit vielen Jahrzehnten Deutschlands führende Messe für Wohnkultur und Handwerk. Die Messe präsentiert das vollständige Spektrum von Möbeldesign bis zu handwerklichen Spezialitäten und ist beliebt bei Privatpersonen, die ihr Zuhause renovieren oder gestalten möchten.\n\nMünchen als Standort unterstreicht die Bedeutung für Design und Wohnqualität. Ein privates Taxi ist besonders praktisch, wenn Käufer verschiedene Stücke besichtigen und eventuell transportieren wollen.',
    aboutEN: 'Held annually in November, Heim + Handwerk has been Germany\'s leading fair for home culture and crafts for decades. The fair presents the complete spectrum from furniture design to craft specialties and is popular with individuals wanting to renovate or design their homes.\n\nMunich as a location underscores its significance for design and living quality. A private taxi is especially practical when visitors want to view various pieces and possibly transport them.',
    visitorNumbers: '~180,000 visitors',
    internationality: '~25% international visitors',
    startDate: new Date('2026-11-05'),
    endDate: new Date('2026-11-08')
  },
  {
    slug: 'ispo-muenchen',
    titleDE: 'ISPO München',
    titleEN: 'ISPO Munich',
    subtitleDE: 'Weltleitmesse für Sport & Outdoor',
    subtitleEN: 'World\'s Leading Sports & Outdoor Fair',
    datesDE: '3.–6. November 2026',
    datesEN: 'November 3–6, 2026',
    locationDE: 'Messe München',
    locationEN: 'Munich Exhibition Centre',
    descriptionDE: 'ISPO ist die weltweit führende Messe für Sport, Outdoor und Fitness. Die Messe zeigt die neuesten Trends in Sportausrüstung, Outdoor-Gear, Aktivkleidung und Trainingstechnologie. Mit über 2.500 Ausstellern und etwa 100.000 Fachbesuchern ist ISPO die zentrale Plattform für Sportindustrie-Profis und Sportfans aus aller Welt.',
    descriptionEN: 'ISPO is the world\'s leading fair for sports, outdoor, and fitness. The fair showcases the latest trends in sports equipment, outdoor gear, active wear, and training technology. With over 2,500 exhibitors and approximately 100,000 professional visitors, ISPO is the central platform for sports industry professionals and sports enthusiasts worldwide.',
    stats: [
      {
        valueDE: '2.500+',
        valueEN: '2,500+',
        labelDE: 'Aussteller',
        labelEN: 'Exhibitors',
        icon: '🏢'
      },
      {
        valueDE: '~100.000',
        valueEN: '~100,000',
        labelDE: 'Fachbesucher',
        labelEN: 'Professional Visitors',
        icon: '👥'
      },
      {
        valueDE: '100+',
        valueEN: '100+',
        labelDE: 'Länder',
        labelEN: 'Countries',
        icon: '🌍'
      },
      {
        valueDE: '4',
        valueEN: '4',
        labelDE: 'Tage',
        labelEN: 'Days',
        icon: '📅'
      },
      {
        valueDE: '~€800 Mio.',
        valueEN: '~€800M',
        labelDE: 'Gesamtumsatz',
        labelEN: 'Total Sales',
        icon: '💰'
      }
    ],
    tips: [
      {
        tipDE: 'Fachbesucher-Ausweis online beantragen',
        tipEN: 'Apply for professional visitor pass online',
        icon: '🎫'
      },
      {
        tipDE: 'Taxi vom Flughafen buchen – November-Verkehr ist intensiv',
        tipEN: 'Book airport taxi – November traffic is heavy',
        icon: '🚕'
      },
      {
        tipDE: 'Gutes Schuhwerk für viel Geherei essentiell',
        tipEN: 'Good footwear essential for lots of walking',
        icon: '👟'
      },
      {
        tipDE: 'Viele Live-Events und Produktpräsentationen anschauen',
        tipEN: 'Watch many live events and product presentations',
        icon: '🎬'
      }
    ],
    aboutDE: 'ISPO findet jährlich im November statt und ist seit 1970 die internationale Top-Messe für Sportindustrie. Die Messe verbindet Hersteller, Einzelhandelsketten, Einzelhandelsgeschäfte und private Sportbegeisterte. Bayern mit seinen Alpen und seiner Sportkultur ist der perfekte Standort für ISPO.\n\nFür Sportprofis und Enthusiasten weltweit bietet ein privates Taxi vom Flughafen eine komfortable Anfahrt zur Messe.',
    aboutEN: 'Held annually in November since 1970, ISPO is the international leading fair for the sports industry. The fair connects manufacturers, retail chains, specialty stores, and private sports enthusiasts. Bavaria with its Alps and sports culture is the perfect location for ISPO.\n\nFor sports professionals and enthusiasts worldwide, a private taxi from the airport offers comfortable access to the fair.',
    visitorNumbers: '~100,000 professional visitors',
    internationality: '~60% international visitors',
    startDate: new Date('2026-11-03'),
    endDate: new Date('2026-11-06')
  },
  {
    slug: 'analytica-muenchen',
    titleDE: 'analytica München',
    titleEN: 'analytica Munich',
    subtitleDE: 'Weltleitmesse für Labortechnik & Analysentechnologie',
    subtitleEN: 'World\'s Leading Lab Technology & Analysis Fair',
    datesDE: '7.–10. April 2026',
    datesEN: 'April 7–10, 2026',
    locationDE: 'Messe München',
    locationEN: 'Munich Exhibition Centre',
    descriptionDE: 'analytica ist die weltweit bedeutendste Fachmesse für Laborausstattung, Analytische Chemie und Labortechnik. Die Messe präsentiert innovative Lösungen für Labore in Pharmazie, Biotechnologie, Lebensmittel, Umwelt und Chemie. Mit über 1.800 Ausstellern aus etwa 60 Ländern ist analytica die Plattform für internationale Laborexperten.',
    descriptionEN: 'analytica is the world\'s most important trade fair for laboratory equipment, analytical chemistry, and lab technology. The fair presents innovative solutions for labs in pharmaceuticals, biotechnology, food, environment, and chemistry. With over 1,800 exhibitors from about 60 countries, analytica is the platform for international lab experts.',
    stats: [
      {
        valueDE: '1.800+',
        valueEN: '1,800+',
        labelDE: 'Aussteller',
        labelEN: 'Exhibitors',
        icon: '🏭'
      },
      {
        valueDE: '~55.000',
        valueEN: '~55,000',
        labelDE: 'Fachbesucher',
        labelEN: 'Professional Visitors',
        icon: '👥'
      },
      {
        valueDE: '60+',
        valueEN: '60+',
        labelDE: 'Länder',
        labelEN: 'Countries',
        icon: '🌍'
      },
      {
        valueDE: '4',
        valueEN: '4',
        labelDE: 'Tage',
        labelEN: 'Days',
        icon: '📅'
      },
      {
        valueDE: '~30.000 m²',
        valueEN: '~30,000 m²',
        labelDE: 'Nettofläche',
        labelEN: 'Net Space',
        icon: '📐'
      }
    ],
    tips: [
      {
        tipDE: 'Fachbesucher-Ausweis online anmelden',
        tipEN: 'Register for professional visitor pass online',
        icon: '🎫'
      },
      {
        tipDE: 'Taxi vom Flughafen reservieren – April ist beliebt',
        tipEN: 'Reserve airport taxi – April is popular',
        icon: '🚕'
      },
      {
        tipDE: 'Detailliertes Messeplan-Studium ist sinnvoll',
        tipEN: 'Study the detailed fair map',
        icon: '📋'
      },
      {
        tipDE: 'Produktinnovationen und Live-Demos nicht verpassen',
        tipEN: 'Don\'t miss product innovations and live demos',
        icon: '🔬'
      }
    ],
    aboutDE: 'analytica findet alle drei Jahre in München statt und ist seit 1989 die Weltleitmesse für analytische Laborausstattung. Die Messe ist für Laborleiter, Wissenschaftler und Forscher unerlässlich, um sich über neue Technologien zu informieren. Bayern ist ein wichtiger Standort für pharmazeutische und biotechnologische Unternehmen, was analytica bedeutsam macht.\n\nEin privates Taxi vom Flughafen ist für Geschäfts- und Fachbesucher ideal, um pünktlich und entspannt anzukommen.',
    aboutEN: 'Held every three years in Munich since 1989, analytica is the world\'s leading fair for analytical lab equipment. The fair is essential for lab directors, scientists, and researchers to learn about new technologies. Bavaria is an important location for pharmaceutical and biotechnology companies, making analytica significant.\n\nA private taxi from the airport is ideal for business and professional visitors to arrive on time and relaxed.',
    visitorNumbers: '~55,000 professional visitors',
    internationality: '~60% international visitors',
    startDate: new Date('2026-04-07'),
    endDate: new Date('2026-04-10')
  },
  {
    slug: 'inhorgenta-muenchen',
    titleDE: 'inhorgenta münchen',
    titleEN: 'inhorgenta munich',
    subtitleDE: 'Weltleitmesse für Schmuck, Uhren und Edelmetalle',
    subtitleEN: 'World\'s Leading Jewelry, Watches & Precious Metals Fair',
    datesDE: '14.–17. Februar 2026',
    datesEN: 'February 14–17, 2026',
    locationDE: 'Messe München',
    locationEN: 'Munich Exhibition Centre',
    descriptionDE: 'inhorgenta ist die weltweit führende Fachmesse für Schmuck, Uhren, Edelmetalle und Edelsteine. Die Messe bringt etwa 3.500 Aussteller zusammen und zeigt die neuesten Kreationen von international renommierten Schmuck- und Uhrenmachern. Mit über 100.000 Fachbesuchern ist inhorgenta die zentrale Plattform für Schmuck- und Uhrenbranche weltweit.',
    descriptionEN: 'inhorgenta is the world\'s leading trade fair for jewelry, watches, precious metals, and gemstones. The fair brings together about 3,500 exhibitors and showcases the latest creations from internationally renowned jewelers and watchmakers. With over 100,000 professional visitors, inhorgenta is the central platform for the jewelry and watch industry worldwide.',
    stats: [
      {
        valueDE: '3.500+',
        valueEN: '3,500+',
        labelDE: 'Aussteller',
        labelEN: 'Exhibitors',
        icon: '💎'
      },
      {
        valueDE: '~100.000',
        valueEN: '~100,000',
        labelDE: 'Fachbesucher',
        labelEN: 'Professional Visitors',
        icon: '👥'
      },
      {
        valueDE: '100+',
        valueEN: '100+',
        labelDE: 'Länder',
        labelEN: 'Countries',
        icon: '🌍'
      },
      {
        valueDE: '4',
        valueEN: '4',
        labelDE: 'Tage',
        labelEN: 'Days',
        icon: '📅'
      },
      {
        valueDE: '~€2 Mrd.',
        valueEN: '~€2B',
        labelDE: 'Geschäftsvolumen',
        labelEN: 'Business Volume',
        icon: '💰'
      }
    ],
    tips: [
      {
        tipDE: 'Sicherheits-Akkreditierung beantragen als Aussteller/Käufer',
        tipEN: 'Apply for security accreditation as exhibitor/buyer',
        icon: '🎫'
      },
      {
        tipDE: 'Privattaxi buchen – zur Sicherheit mit Werttransport',
        tipEN: 'Book private taxi – security-conscious transportation',
        icon: '🚕'
      },
      {
        tipDE: 'Die Messe ist diskret – ideal für hochwertige Geschäfte',
        tipEN: 'The fair is discreet – ideal for luxury business',
        icon: '💼'
      },
      {
        tipDE: 'Viele Geschäftsessen und Treffen in München-Hotels',
        tipEN: 'Many business dinners and meetings in Munich hotels',
        icon: '🍽️'
      }
    ],
    aboutDE: 'inhorgenta findet zweimal jährlich in München statt – im Februar und Herbst – und ist seit 1949 die weltführende Plattform für Schmuck-, Uhren- und Edelmetallhandel. Die Messe verbindet Designer, Hersteller, Importeure und internationale Einzelhandelsketten. München als historisches Zentrum für Schmuckhandel macht inhorgenta zur bevorzugten Messe für die Branche.\n\nFür Käufer und Aussteller ist ein diskreter, privater Transfer vom Flughafen die sicherste und komfortabelste Option.',
    aboutEN: 'Held twice yearly in Munich – February and autumn – since 1949, inhorgenta is the world\'s leading platform for jewelry, watch, and precious metal trade. The fair connects designers, manufacturers, importers, and international retail chains. Munich as a historic center for jewelry trade makes inhorgenta the preferred fair for the industry.\n\nFor buyers and exhibitors, a discreet, private transfer from the airport is the safest and most comfortable option.',
    visitorNumbers: '~100,000 professional visitors per fair',
    internationality: '~75% international visitors',
    startDate: new Date('2026-02-14'),
    endDate: new Date('2026-02-17')
  },
  {
    slug: 'christkindlmarkt-muenchen',
    titleDE: 'Christkindlmarkt München',
    titleEN: 'Munich Christmas Market',
    subtitleDE: 'Traditioneller Weihnachtsmarkt auf dem Marienplatz',
    subtitleEN: 'Traditional Christmas Market at Marienplatz',
    datesDE: '16. November 2026 – 24. Dezember 2026',
    datesEN: 'November 16 – December 24, 2026',
    locationDE: 'Marienplatz, München',
    locationEN: 'Marienplatz, Munich',
    descriptionDE: 'Der Münchner Christkindlmarkt ist einer der schönsten und traditionsreichsten Weihnachtsmärkte Deutschlands. Mit über 150 Verkaufsständen im Herzen Münchens werden traditionelle Kunsthandwerke, Weihnachtsdekoration, kulinarische Spezialitäten und festliche Getränke angeboten. Tausende von Besuchern aus aller Welt strömen täglich zum Marienplatz – besonders in den Adventssonntagen.',
    descriptionEN: 'The Munich Christmas Market is one of the most beautiful and traditional Christmas markets in Germany. With over 150 sales stands in the heart of Munich, traditional crafts, Christmas decorations, culinary specialties, and festive beverages are offered. Thousands of visitors from around the world flock to Marienplatz daily – especially on the Advent Sundays.',
    stats: [
      {
        valueDE: '~3 Mio.',
        valueEN: '~3M',
        labelDE: 'Besucher pro Saison',
        labelEN: 'Visitors per Season',
        icon: '👥'
      },
      {
        valueDE: '150+',
        valueEN: '150+',
        labelDE: 'Verkaufsstände',
        labelEN: 'Sales Stands',
        icon: '🎄'
      },
      {
        valueDE: '~39',
        valueEN: '~39',
        labelDE: 'Tage',
        labelEN: 'Days',
        icon: '📅'
      },
      {
        valueDE: '~50%',
        valueEN: '~50%',
        labelDE: 'Internationale Besucher',
        labelEN: 'International Visitors',
        icon: '✈️'
      }
    ],
    tips: [
      {
        tipDE: 'Taxi vom Flughafen zum Hotel buchen – Zentrum ist überlaufen',
        tipEN: 'Book airport taxi to hotel – city center is crowded',
        icon: '🚕'
      },
      {
        tipDE: 'Wochentags und morgens besuchen für weniger Menschenmengen',
        tipEN: 'Visit on weekdays and mornings for fewer crowds',
        icon: '⏰'
      },
      {
        tipDE: 'Warme Kleidung und festes Schuhwerk mitbringen',
        tipEN: 'Bring warm clothing and sturdy shoes',
        icon: '🧥'
      },
      {
        tipDE: 'Glühwein und bayerische Spezialitäten probieren',
        tipEN: 'Try mulled wine and Bavarian specialties',
        icon: '🍷'
      },
      {
        tipDE: 'Die Rathaus-Neogotik und Glockenspiel sind kostenlos zu sehen',
        tipEN: 'The neo-Gothic Town Hall and carillon are free to see',
        icon: '⛪'
      }
    ],
    aboutDE: 'Der Münchner Christkindlmarkt findet seit über 150 Jahren auf dem Marienplatz statt – einem UNESCO-Weltkulturerbe. Der Markt ist bekannt für seine handwerklichen Produkte, traditionellen bayerischen Speisen und die festliche Atmosphäre rund um das historische Rathaus. Der Markt zieht Familien, Paare und Solo-Reisende an, die das bayerische Weihnachtsflair erleben möchten.\n\nEin Taxi vom Flughafen München ist ideal für entspannte Ankunft vor Ort. Das Zentrum ist während der Marktzeit sehr belebt – ein Transfer erspart Stress.',
    aboutEN: 'The Munich Christmas Market has taken place at Marienplatz for over 150 years – a UNESCO World Heritage site. The market is known for its handcrafted products, traditional Bavarian cuisine, and festive atmosphere around the historic Town Hall. The market attracts families, couples, and solo travelers wanting to experience Bavarian Christmas spirit.\n\nA taxi from Munich Airport is ideal for relaxed arrival. The city center is very busy during market season – a transfer saves stress.',
    visitorNumbers: '~3 million visitors per season',
    internationality: '~50% international visitors',
    startDate: new Date('2026-11-16'),
    endDate: new Date('2026-12-24')
  },
  {
    slug: 'tollwood-sommer',
    titleDE: 'Tollwood Sommerfestival',
    titleEN: 'Tollwood Summer Festival',
    subtitleDE: 'Internationales Musik- und Kulturfestival',
    subtitleEN: 'International Music & Culture Festival',
    datesDE: '6. Juni – 31. Juli 2026',
    datesEN: 'June 6 – July 31, 2026',
    locationDE: 'Olympiapark München',
    locationEN: 'Munich Olympic Park',
    descriptionDE: 'Tollwood ist Münchens bedeutendstes internationales Musik- und Kulturfestival mit über zwei Monaten Programm. Das Festival präsentiert Weltmusik, Jazz, Klassik, World Cinema und Kunsthandwerk auf zwei Bühnen mit etwa 120 Veranstaltungen. Mit über 700.000 Besuchern pro Saison zieht Tollwood ein internationales Publikum an, das Quality-Kultur schätzt.',
    descriptionEN: 'Tollwood is Munich\'s most important international music and culture festival with over two months of programming. The festival presents world music, jazz, classical, world cinema, and art crafts on two stages with about 120 events. With over 700,000 visitors per season, Tollwood attracts an international audience that values quality culture.',
    stats: [
      {
        valueDE: '~700.000',
        valueEN: '~700,000',
        labelDE: 'Besucher',
        labelEN: 'Visitors',
        icon: '👥'
      },
      {
        valueDE: '~120',
        valueEN: '~120',
        labelDE: 'Veranstaltungen',
        labelEN: 'Events',
        icon: '🎭'
      },
      {
        valueDE: '50+',
        valueEN: '50+',
        labelDE: 'Künstler/Länder',
        labelEN: 'Artists/Countries',
        icon: '🎵'
      },
      {
        valueDE: '~56',
        valueEN: '~56',
        labelDE: 'Tage',
        labelEN: 'Days',
        icon: '📅'
      }
    ],
    tips: [
      {
        tipDE: 'Tickets online kaufen und früh bestellen',
        tipEN: 'Buy tickets online and order early',
        icon: '🎫'
      },
      {
        tipDE: 'Taxi vom Flughafen zum Olympiapark buchen',
        tipEN: 'Book airport taxi to Olympic Park',
        icon: '🚕'
      },
      {
        tipDE: 'Programmheft downloaden und Lieblingsveranstaltungen wählen',
        tipEN: 'Download program guide and choose favorites',
        icon: '📱'
      },
      {
        tipDE: 'Warme Jacke für Abendveranstaltungen mitbringen',
        tipEN: 'Bring warm jacket for evening events',
        icon: '🧥'
      },
      {
        tipDE: 'Tollwood Food Court mit internationalen Spezialitäten genießen',
        tipEN: 'Enjoy Tollwood food court with international specialties',
        icon: '🍜'
      }
    ],
    aboutDE: 'Tollwood wird seit 1988 jährlich durchgeführt und ist Münchens wichtigstes Kulturereignis im Sommer. Das Festival ist bekannt für seine Vielfalt in Musik, Tanz, Theater und bildender Kunst. Im Olympiapark bietet Tollwood eine einzigartige Atmosphäre unter freiem Himmel mit Live-Auftritten von internationalen Künstlern. Die Nachhaltigkeitsinitiative von Tollwood ist ebenfalls bemerkenswert – das Festival strebt Ressourcenschonung an.\n\nTouristen und Einheimische nutzen Tollwood gerne, um hochwertige kulturelle Darbietungen zu genießen. Ein Transfer vom Flughafen vereinfacht die Anreise erheblich.',
    aboutEN: 'Held annually since 1988, Tollwood is Munich\'s most important summer cultural event. The festival is known for its diversity in music, dance, theater, and visual arts. In the Olympic Park, Tollwood offers a unique open-air atmosphere with live performances by international artists. Tollwood\'s sustainability initiative is also notable – the festival aims for resource conservation.\n\nTourists and locals enjoy Tollwood to experience high-quality cultural performances. A transfer from the airport significantly simplifies the trip.',
    visitorNumbers: '~700,000 visitors per season',
    internationality: '~45% international visitors',
    startDate: new Date('2026-06-06'),
    endDate: new Date('2026-07-31')
  },
  {
    slug: 'tollwood-winter',
    titleDE: 'Tollwood Winterfestival',
    titleEN: 'Tollwood Winter Festival',
    subtitleDE: 'Winterliches Musik- und Kunstfestival',
    subtitleEN: 'Wintry Music & Arts Festival',
    datesDE: '18. November 2026 – 31. Dezember 2026',
    datesEN: 'November 18 – December 31, 2026',
    locationDE: 'Olympiapark München',
    locationEN: 'Munich Olympic Park',
    descriptionDE: 'Das Tollwood Winterfestival bietet winterliche Kultur, Live-Musik und festliche Atmosphäre in den kalten Monaten. Mit über 100 Veranstaltungen und internationalen Künstlern wird das Olympiagelände zum kulturellen Treffpunkt in München. Das Festival kombiniert Musik, Theater, Kunsthandwerk und weihnachtliche Unterhaltung in einer bezaubernden Winteratmosphäre.',
    descriptionEN: 'The Tollwood Winter Festival offers wintry culture, live music, and festive atmosphere during the cold months. With over 100 events and international artists, the Olympic grounds become Munich\'s cultural gathering place. The festival combines music, theater, crafts, and Christmas entertainment in an enchanting winter atmosphere.',
    stats: [
      {
        valueDE: '~400.000',
        valueEN: '~400,000',
        labelDE: 'Besucher',
        labelEN: 'Visitors',
        icon: '👥'
      },
      {
        valueDE: '100+',
        valueEN: '100+',
        labelDE: 'Veranstaltungen',
        labelEN: 'Events',
        icon: '🎭'
      },
      {
        valueDE: '40+',
        valueEN: '40+',
        labelDE: 'Länder vertreten',
        labelEN: 'Countries',
        icon: '🌍'
      },
      {
        valueDE: '~43',
        valueEN: '~43',
        labelDE: 'Tage',
        labelEN: 'Days',
        icon: '📅'
      }
    ],
    tips: [
      {
        tipDE: 'Tickets in Vorverkauf sichern – populäre Acts ausverkauft',
        tipEN: 'Secure tickets in advance – popular acts sell out',
        icon: '🎫'
      },
      {
        tipDE: 'Taxi vom Flughafen reservieren – Winter/Weihnachtszeit busy',
        tipEN: 'Reserve airport taxi – winter/Christmas season busy',
        icon: '🚕'
      },
      {
        tipDE: 'Sehr warme Kleidung notwendig – Olympiapark ist windig',
        tipEN: 'Very warm clothing necessary – Olympic Park is windy',
        icon: '🧥'
      },
      {
        tipDE: 'Glühwein und Nussknacker-Punsch probieren',
        tipEN: 'Try mulled wine and nutcracker punch',
        icon: '🍷'
      },
      {
        tipDE: 'Mit Familie oder Partnern genießen – sehr festlich',
        tipEN: 'Enjoy with family or partner – very festive',
        icon: '👨‍👩‍👧‍👦'
      }
    ],
    aboutDE: 'Das Tollwood Winterfestival findet seit 1995 jährlich in der Advents- und Weihnachtszeit statt. Es ist eine wunderbare Alternative zu klassischen Weihnachtsmärkten mit mehr Fokus auf Kultur, Live-Musik und kunsthandwerkliche Workshops. Das Festival zieht Besucher an, die sowohl festliche Tradition als auch innovative kulturelle Angebote schätzen.\n\nIm November und Dezember ist München sehr belebt. Ein privates Taxi vom Flughafen ist die komfortabelste und stressfreiste Option für Besucher.',
    aboutEN: 'The Tollwood Winter Festival has taken place annually since 1995 during the Advent and Christmas season. It\'s a wonderful alternative to classical Christmas markets with more focus on culture, live music, and craft workshops. The festival attracts visitors who appreciate both festive tradition and innovative cultural offerings.\n\nNovember and December are very busy in Munich. A private taxi from the airport is the most comfortable and stress-free option for visitors.',
    visitorNumbers: '~400,000 visitors per season',
    internationality: '~40% international visitors',
    startDate: new Date('2026-11-18'),
    endDate: new Date('2026-12-31')
  },
  {
    slug: 'muenchner-opernfestspiele',
    titleDE: 'Münchner Opernfestspiele',
    titleEN: 'Munich Opera Festival',
    subtitleDE: 'Prestigeträchtiges Opernfestival im Sommer',
    subtitleEN: 'Prestigious Summer Opera Festival',
    datesDE: '18. Juni – 31. Juli 2026',
    datesEN: 'June 18 – July 31, 2026',
    locationDE: 'Bayerische Staatsoper, München',
    locationEN: 'Bavarian State Opera, Munich',
    descriptionDE: 'Die Münchner Opernfestspiele sind eines der renommiertesten Opernfestivals Europas. Mit etwa 80 Aufführungen präsentiert das Festival klassische und zeitgenössische Opern mit weltklasse Sängern und Dirigenten. Die Münchner Opernfestspiele ziehen Opernliebhaber und Musik-Kulturreisende aus aller Welt an und machen München zu einem internationalen Zentrum der Opernkunst.',
    descriptionEN: 'The Munich Opera Festival is one of Europe\'s most prestigious opera festivals. With about 80 performances, the festival presents classical and contemporary operas with world-class singers and conductors. The Munich Opera Festival attracts opera lovers and music-culture travelers from worldwide and makes Munich an international center for opera art.',
    stats: [
      {
        valueDE: '~80',
        valueEN: '~80',
        labelDE: 'Aufführungen',
        labelEN: 'Performances',
        icon: '🎭'
      },
      {
        valueDE: '~200.000',
        valueEN: '~200,000',
        labelDE: 'Besucher',
        labelEN: 'Visitors',
        icon: '👥'
      },
      {
        valueDE: '~60%',
        valueEN: '~60%',
        labelDE: 'Internationale Gäste',
        labelEN: 'International Guests',
        icon: '✈️'
      },
      {
        valueDE: '~44',
        valueEN: '~44',
        labelDE: 'Tage Festivallaufzeit',
        labelEN: 'Festival Days',
        icon: '📅'
      },
      {
        valueDE: '20+',
        valueEN: '20+',
        labelDE: 'Top-Künstler',
        labelEN: 'Top Performers',
        icon: '⭐'
      }
    ],
    tips: [
      {
        tipDE: 'Tickets früh buchen – Premium-Vorstellungen schnell ausverkauft',
        tipEN: 'Book tickets early – premium performances sell out quickly',
        icon: '🎫'
      },
      {
        tipDE: 'Taxi vom Flughafen zur Staatsoper reservieren',
        tipEN: 'Reserve airport taxi to State Opera',
        icon: '🚕'
      },
      {
        tipDE: 'Formale Kleidung tragen – Opernbesuch ist festliches Event',
        tipEN: 'Wear formal clothing – opera is a formal event',
        icon: '👔'
      },
      {
        tipDE: 'Opernführungen und Hintergrund-Talks besuchen',
        tipEN: 'Attend opera tours and background talks',
        icon: '📚'
      },
      {
        tipDE: 'Nach der Oper in der Max-Joseph-Straße dinieren',
        tipEN: 'Dine in Max-Joseph-Strasse area after opera',
        icon: '🍽️'
      }
    ],
    aboutDE: 'Die Münchner Opernfestspiele werden seit 1968 jährlich durchgeführt und sind eines der bedeutendsten Opernfestivals Europas. Die Bayerische Staatsoper ist bekannt für ihre hochkarätigen Inszenierungen, innovativen Regiearbeiten und internationalen Top-Künstler. Das Festival ist sehr beliebt bei klassischen Musikliebhabern und kulturell interessierten Reisenden weltweit.\n\nFür International Besucher ist ein privates Taxi vom Flughafen München ideal, um pünktlich und elegant zu den Aufführungen zu gelangen.',
    aboutEN: 'Held annually since 1968, the Munich Opera Festival is one of Europe\'s leading opera festivals. The Bavarian State Opera is known for its high-caliber productions, innovative direction, and international top artists. The festival is very popular with classical music lovers and culturally interested travelers worldwide.\n\nFor international visitors, a private taxi from Munich Airport is ideal for arriving on time and elegantly for performances.',
    visitorNumbers: '~200,000 visitors per season',
    internationality: '~60% international visitors',
    startDate: new Date('2026-06-18'),
    endDate: new Date('2026-07-31')
  },
  {
    slug: 'starkbierfest',
    titleDE: 'Starkbierfest',
    titleEN: 'Strong Beer Festival',
    subtitleDE: 'Traditionelles Frühjahrsfest der Münchner Brauereien',
    subtitleEN: 'Traditional Spring Beer Festival of Munich Breweries',
    datesDE: '15. März – 5. April 2026',
    datesEN: 'March 15 – April 5, 2026',
    locationDE: 'Niklaskirche und Brauereigaststätten, München',
    locationEN: 'Niklas Church & Brewery Restaurants, Munich',
    descriptionDE: 'Das Starkbierfest ist Münchens traditionsreiches Frühjahrsfest, bei dem die Münchner Brauereien ihre Starkbiere präsentieren – dunkel, süffig und mit höherem Alkoholgehalt. Das Fest wurde 1751 gegründet und findet traditionell vor der Fastenzeit statt. Das Fest verteilt sich über mehrere Brauerei-Gaststätten und ist bekannt für bodenständige bayerische Kultur, Livemusik und fröhliche Festgemeinschaft.',
    descriptionEN: 'The Strong Beer Festival is Munich\'s traditional spring festival where Munich breweries present their strong beers – dark, smooth, and higher alcohol content. Founded in 1751, the festival traditionally takes place before Lent. The festival is spread across several brewery restaurants and is known for authentic Bavarian culture, live music, and festive camaraderie.',
    stats: [
      {
        valueDE: '~300.000',
        valueEN: '~300,000',
        labelDE: 'Besucher',
        labelEN: 'Visitors',
        icon: '👥'
      },
      {
        valueDE: '~22',
        valueEN: '~22',
        labelDE: 'Tage',
        labelEN: 'Days',
        icon: '📅'
      },
      {
        valueDE: '6',
        valueEN: '6',
        labelDE: 'Hauptbrauereien',
        labelEN: 'Major Breweries',
        icon: '🍺'
      },
      {
        valueDE: '~30%',
        valueEN: '~30%',
        labelDE: 'Internationale Gäste',
        labelEN: 'International Guests',
        icon: '✈️'
      }
    ],
    tips: [
      {
        tipDE: 'Früh am Morgen oder Wochentags kommen – weniger Menschenmassen',
        tipEN: 'Come early morning or on weekdays – fewer crowds',
        icon: '⏰'
      },
      {
        tipDE: 'Privattaxi vom Flughafen buchen – Biertests beeinträchtigen Fahrtauglichkeit',
        tipEN: 'Book private taxi from airport – beer tasting affects driving',
        icon: '🚕'
      },
      {
        tipDE: 'Tracht tragen – Dirndl und Lederhosen sind üblich',
        tipEN: 'Wear traditional costume – dirndl and lederhosen are common',
        icon: '👘'
      },
      {
        tipDE: 'Bayerische Spezialitäten probieren – Weißwurst, Käsespätzle',
        tipEN: 'Try Bavarian specialties – white sausage, cheese noodles',
        icon: '🥘'
      },
      {
        tipDE: 'Livemusik und Volkstänze genießen',
        tipEN: 'Enjoy live music and folk dances',
        icon: '🎵'
      }
    ],
    aboutDE: 'Das Starkbierfest ist eines der ältesten Volksfeste Münchens, gegründet 1751. Das Fest hat tiefe Wurzeln in der bayerischen Brauereitradition und ist ein wichtiger Teil der Münchner Kulturidentität. Im Gegensatz zum weltberühmten Oktoberfest ist das Starkbierfest authentischer, lokaler und weniger kommerziell – es ist das Fest der Münchner für die Münchner.\n\nFür Besucher, die echte bayerische Bierfestkultur erleben möchten, ist das Starkbierfest authentischer als das Oktoberfest. Ein Taxi vom Flughafen ist eine sichere Anreiseoption.',
    aboutEN: 'The Strong Beer Festival is one of Munich\'s oldest folk festivals, founded in 1751. The festival has deep roots in Bavarian brewing tradition and is an important part of Munich\'s cultural identity. Unlike the world-famous Oktoberfest, the Strong Beer Festival is more authentic, local, and less commercial – it\'s the festival of Müncheners for Müncheners.\n\nFor visitors wanting to experience authentic Bavarian beer festival culture, the Strong Beer Festival is more authentic than Oktoberfest. A taxi from the airport is a safe travel option.',
    visitorNumbers: '~300,000 visitors per festival',
    internationality: '~30% international visitors',
    startDate: new Date('2026-03-15'),
    endDate: new Date('2026-04-05')
  },
  {
    slug: 'fruehjahresfest-muenchen',
    titleDE: 'Frühjahrsfest München',
    titleEN: 'Munich Spring Festival',
    subtitleDE: 'Volksfest mit Tradition und Familie im Frühling',
    subtitleEN: 'Traditional Family-Friendly Spring Folk Festival',
    datesDE: '11. April – 5. Mai 2026',
    datesEN: 'April 11 – May 5, 2026',
    locationDE: 'Theresienwiese, München',
    locationEN: 'Theresienwiese, Munich',
    descriptionDE: 'Das Frühjahrsfest München ist ein familienfreundliches Volksfest auf der legendären Theresienwiese – demselben Gelände wie das Oktoberfest. Mit über 80 Fahrgeschäften, Festzelten mit Live-Musik und traditionellen Speisen wird das Fest zu einem Highlight des Münchner Kulturkalenders. Das Fest zieht etwa 1,5 Millionen Besucher an und bietet Vergnügen für alle Altersgruppen.',
    descriptionEN: 'The Munich Spring Festival is a family-friendly folk festival at the legendary Theresienwiese – the same grounds as Oktoberfest. With over 80 rides, festival tents with live music, and traditional foods, the festival becomes a highlight of Munich\'s cultural calendar. The festival attracts about 1.5 million visitors and offers entertainment for all ages.',
    stats: [
      {
        valueDE: '~1,5 Mio.',
        valueEN: '~1.5M',
        labelDE: 'Besucher',
        labelEN: 'Visitors',
        icon: '👥'
      },
      {
        valueDE: '80+',
        valueEN: '80+',
        labelDE: 'Fahrgeschäfte',
        labelEN: 'Rides',
        icon: '🎡'
      },
      {
        valueDE: '~25',
        valueEN: '~25',
        labelDE: 'Tage',
        labelEN: 'Days',
        icon: '📅'
      },
      {
        valueDE: '~20%',
        valueEN: '~20%',
        labelDE: 'Internationale Gäste',
        labelEN: 'International Guests',
        icon: '✈️'
      }
    ],
    tips: [
      {
        tipDE: 'Mit Familie und Kindern besonders schön – viele Kinder-Fahrgeschäfte',
        tipEN: 'Especially nice with family and kids – many kids rides',
        icon: '👨‍👩‍👧‍👦'
      },
      {
        tipDE: 'Taxi vom Flughafen zur Theresienwiese buchen',
        tipEN: 'Book airport taxi to Theresienwiese',
        icon: '🚕'
      },
      {
        tipDE: 'Wochentags morgens kommen – weniger Gedränge',
        tipEN: 'Come on weekday mornings – less crowded',
        icon: '⏰'
      },
      {
        tipDE: 'Traditionelle Tracht (optional) trägt zur Festatmosphäre bei',
        tipEN: 'Traditional costume (optional) adds to festive atmosphere',
        icon: '👘'
      },
      {
        tipDE: 'Leberkäse, Maß Bier und Süßes probieren',
        tipEN: 'Try liverwurst, beer, and sweets',
        icon: '🍺'
      }
    ],
    aboutDE: 'Das Frühjahrsfest findet jährlich im April/Mai auf der Theresienwiese statt und ist das größere Volksfest Münchens nach dem Oktoberfest. Das Fest hat Wurzeln in der königlichen Tradition und ist beliebt bei Münchner Familien und Einheimischen wie auch bei Touristen. Mit Fahrgeschäften, Festzelten, Bierständen und traditioneller Musik ist es ein vollständiges Volksfest-Erlebnis.\n\nFür Familien mit Kindern ist das Frühjahrsfest oft besser geeignet als das Oktoberfest, da es mehr familienorientiert ist. Ein Taxi vom Flughafen macht die Anreise stressfrei.',
    aboutEN: 'The Spring Festival takes place annually in April/May at Theresienwiese and is Munich\'s largest folk festival after Oktoberfest. The festival has roots in royal tradition and is popular with Munich families and locals as well as tourists. With rides, festival tents, beer stands, and traditional music, it\'s a complete folk festival experience.\n\nFor families with children, the Spring Festival is often more suitable than Oktoberfest as it\'s more family-oriented. A taxi from the airport makes the trip stress-free.',
    visitorNumbers: '~1.5 million visitors',
    internationality: '~20% international visitors',
    startDate: new Date('2026-04-11'),
    endDate: new Date('2026-05-05')
  },
  {
    slug: 'csd-muenchen',
    titleDE: 'CSD München',
    titleEN: 'CSD Munich',
    subtitleDE: 'Munich Pride – Europas größtes Diversity-Festival',
    subtitleEN: 'Munich Pride – Europe\'s Largest Diversity Festival',
    datesDE: '17.–28. Juni 2026',
    datesEN: 'June 17–28, 2026',
    locationDE: 'Innenstadt München (zentrale Stadtteile)',
    locationEN: 'Munich City Center (downtown)',
    descriptionDE: 'Der CSD München ist Europas größtes Diversity- und Pride-Festival mit etwa 500.000 Besuchern. Das zweiwöchige Fest bietet über 200 Veranstaltungen – Partys, Konzerte, Kunstausstellungen, Diskussionsforen und Aktivitäten für LGBTQ+ und deren Allies. Der CSD ist berüchtigt für die bunte und laute Demonstration, die zentrale Routen Münchens durchzieht – ein Spektakel voller Farbe, Musik und Stolz.',
    descriptionEN: 'CSD Munich is Europe\'s largest diversity and Pride festival with about 500,000 visitors. The two-week festival offers over 200 events – parties, concerts, art exhibitions, discussion forums, and activities for LGBTQ+ and their allies. The CSD is famous for the colorful and loud demonstration that runs through central routes of Munich – a spectacle full of color, music, and pride.',
    stats: [
      {
        valueDE: '~500.000',
        valueEN: '~500,000',
        labelDE: 'Besucher',
        labelEN: 'Visitors',
        icon: '👥'
      },
      {
        valueDE: '200+',
        valueEN: '200+',
        labelDE: 'Veranstaltungen',
        labelEN: 'Events',
        icon: '🎉'
      },
      {
        valueDE: '12',
        valueEN: '12',
        labelDE: 'Tage Festival',
        labelEN: 'Days',
        icon: '📅'
      },
      {
        valueDE: '~40%',
        valueEN: '~40%',
        labelDE: 'Internationale Gäste',
        labelEN: 'International Guests',
        icon: '✈️'
      }
    ],
    tips: [
      {
        tipDE: 'Hotels früh buchen – Juni ist Hauptreisezeit, CSD ist populär',
        tipEN: 'Book hotels early – June is peak season, CSD is popular',
        icon: '🏨'
      },
      {
        tipDE: 'Taxi vom Flughafen reservieren – besonders zu Demo-Zeiten nötig',
        tipEN: 'Reserve airport taxi – especially needed during parade times',
        icon: '🚕'
      },
      {
        tipDE: 'Bunte und stolze Kleidung tragen – ist Teil der Kultur',
        tipEN: 'Wear colorful and proud clothing – it\'s part of the culture',
        icon: '🌈'
      },
      {
        tipDE: 'Veranstaltungskalender herunterladen und auswählen',
        tipEN: 'Download event calendar and choose events',
        icon: '📱'
      },
      {
        tipDE: 'Laut, lebendig, bunt – unforgettable experience',
        tipEN: 'Loud, lively, colorful – unforgettable experience',
        icon: '🎊'
      }
    ],
    aboutDE: 'Der CSD München findet jährlich im Juni statt und ist einer der größten Pride-Events in Europa. Das Festival zelebriert Vielfalt, Toleranz und die LGBTQ+ Bewegung mit Farbe und Musik. Munich mit seiner weltoffenen Kultur und großer LGBTQ+ Community ist der ideale Ort für dieses einzigartige Festival. Der CSD ist nicht nur für LGBTQ+ Menschen, sondern für alle, die Vielfalt feiern möchten.\n\nIm Juni ist München sehr belebt. Ein privates Taxi vom Flughafen ist komfortabel und sicher.',
    aboutEN: 'CSD Munich takes place annually in June and is one of Europe\'s largest Pride events. The festival celebrates diversity, tolerance, and the LGBTQ+ movement with color and music. Munich with its cosmopolitan culture and large LGBTQ+ community is the ideal location for this unique festival. CSD is not just for LGBTQ+ people, but for everyone who wants to celebrate diversity.\n\nIn June, Munich is very busy. A private taxi from the airport is comfortable and safe.',
    visitorNumbers: '~500,000 visitors per festival',
    internationality: '~40% international visitors',
    startDate: new Date('2026-06-17'),
    endDate: new Date('2026-06-28')
  },
  {
    slug: 'fc-bayern-champions-league',
    titleDE: 'FC Bayern München – Champions League Heimspiele',
    titleEN: 'FC Bayern Munich – Champions League Home Games',
    subtitleDE: 'Fußballspiele in der Allianz Arena',
    subtitleEN: 'Football Matches at Allianz Arena',
    datesDE: 'Oktober 2026 – Mai 2027',
    datesEN: 'October 2026 – May 2027',
    locationDE: 'Allianz Arena, München',
    locationEN: 'Allianz Arena, Munich',
    descriptionDE: 'Der FC Bayern München spielt seine Champions-League-Heimspiele in der Allianz Arena – einem modernen Fußballstadion mit Kapazität für 75.000 Zuschauer. Die Matches der Bayern gegen europäische Top-Teams ziehen internationale Fußball-Fans und Sportenthusiasten an. Für Fans ist es ein intensives Erlebnis mit weltklasse Fußball und leidenschaftlicher Unterstützung der Bayern-Fans.',
    descriptionEN: 'FC Bayern Munich plays its Champions League home games at Allianz Arena – a modern football stadium with capacity for 75,000 spectators. Bayern\'s matches against top European teams attract international football fans and sports enthusiasts. For fans, it\'s an intense experience with world-class football and passionate Bayern fan support.',
    stats: [
      {
        valueDE: '~75.000',
        valueEN: '~75,000',
        labelDE: 'Stadion-Kapazität',
        labelEN: 'Stadium Capacity',
        icon: '⚽'
      },
      {
        valueDE: '8-13',
        valueEN: '8-13',
        labelDE: 'Heimspiele/Saison',
        labelEN: 'Home Games/Season',
        icon: '📅'
      },
      {
        valueDE: '~30%',
        valueEN: '~30%',
        labelDE: 'Internationale Fans',
        labelEN: 'International Fans',
        icon: '✈️'
      },
      {
        valueDE: '6-mal',
        valueEN: '6x',
        labelDE: 'Champions League Sieger',
        labelEN: 'Champions League Winner',
        icon: '🏆'
      }
    ],
    tips: [
      {
        tipDE: 'Tickets schnell online kaufen – populäre Matches sind schnell ausverkauft',
        tipEN: 'Buy tickets quickly online – popular matches sell out fast',
        icon: '🎫'
      },
      {
        tipDE: 'Taxi vom Flughafen zur Allianz Arena buchen',
        tipEN: 'Book airport taxi to Allianz Arena',
        icon: '🚕'
      },
      {
        tipDE: 'Bayern-Trikot tragen – zeigt Support und Atmosphäre',
        tipEN: 'Wear Bayern jersey – shows support and adds atmosphere',
        icon: '👕'
      },
      {
        tipDE: 'Früh anreisen – vor dem Spiel Zeit vor Ort genießen',
        tipEN: 'Arrive early – enjoy time at the stadium before the game',
        icon: '⏰'
      },
      {
        tipDE: 'Fußball-Enthusiasten sollten dieses Experience nicht verpassen',
        tipEN: 'Football enthusiasts shouldn\'t miss this experience',
        icon: '⚽'
      }
    ],
    aboutDE: 'Der FC Bayern München ist einer der erfolgreichsten Fußballclubs Europas mit 6 Champions-League-Titeln. Die Allianz Arena ist ein ultramodernes Stadion, das 2006 eröffnet wurde und für seine beeindruckende Architektur bekannt ist. Die Bayern-Fans sind weltberühmt für ihre Leidenschaft und ihre Gesänge. Die Champions League ist der prestigeträchtigste europäische Fußballwettbewerb, und Bayern-Heimspiele sind begehrte Tickets.\n\nFür Fußball-Fans aus aller Welt ist ein Bayern-Spiel ein Muss. Ein Taxi vom Flughafen zur Arena ist die praktischste Option.',
    aboutEN: 'FC Bayern Munich is one of Europe\'s most successful football clubs with 6 Champions League titles. Allianz Arena is a cutting-edge stadium that opened in 2006 and is known for its impressive architecture. Bayern fans are world-famous for their passion and chanting. The Champions League is football\'s most prestigious European competition, and Bayern home games are highly coveted tickets.\n\nFor football fans worldwide, a Bayern game is a must. A taxi from the airport to the arena is the most practical option.',
    visitorNumbers: '~75,000 per match',
    internationality: '~30% international visitors',
    startDate: new Date('2026-10-01'),
    endDate: new Date('2027-05-31')
  },
  {
    slug: 'bmw-international-open',
    titleDE: 'BMW International Open',
    titleEN: 'BMW International Open',
    subtitleDE: 'Internationales Golf-Turnier auf Weltklasse-Niveau',
    subtitleEN: 'International World-Class Golf Tournament',
    datesDE: '17.–20. Juni 2026',
    datesEN: 'June 17–20, 2026',
    locationDE: 'Golfclub München Nord-Eichenried',
    locationEN: 'Munich Nord-Eichenried Golf Club',
    descriptionDE: 'Das BMW International Open ist eines der ältesten und renommiertesten Golfturnier in Europa. Das Turnier zieht die weltbesten Golfer an und wird vor großem internationalen Publikum ausgetragen. Der Golfplatz in München Nord-Eichenried ist weltklasse und bietet eine spektakuläre Kulisse für professionelle Golfaction. Das Turnier ist ein Highlight für Golfaffin und Sportenthusiasten.',
    descriptionEN: 'The BMW International Open is one of Europe\'s oldest and most prestigious golf tournaments. The tournament attracts the world\'s best golfers and is played before a large international audience. The Munich Nord-Eichenried golf course is world-class and provides a spectacular setting for professional golf action. The tournament is a highlight for golf enthusiasts and sports fans.',
    stats: [
      {
        valueDE: '144',
        valueEN: '144',
        labelDE: 'Spieler',
        labelEN: 'Players',
        icon: '⛳'
      },
      {
        valueDE: '~100.000',
        valueEN: '~100,000',
        labelDE: 'Zuschauer/Woche',
        labelEN: 'Spectators/Week',
        icon: '👥'
      },
      {
        valueDE: '4',
        valueEN: '4',
        labelDE: 'Tage Turnier',
        labelEN: 'Days',
        icon: '📅'
      },
      {
        valueDE: '~50%',
        valueEN: '~50%',
        labelDE: 'Internationale Gäste',
        labelEN: 'International Guests',
        icon: '✈️'
      }
    ],
    tips: [
      {
        tipDE: 'Tickets online kaufen – besonders für Finalrunde empfohlen',
        tipEN: 'Buy tickets online – especially recommended for final round',
        icon: '🎫'
      },
      {
        tipDE: 'Taxi vom Flughafen zum Golfplatz buchen',
        tipEN: 'Book airport taxi to golf course',
        icon: '🚕'
      },
      {
        tipDE: 'Leichte, wetterfeste Kleidung tragen – viel Geherei draußen',
        tipEN: 'Wear light, weather-resistant clothing – lots of outdoor walking',
        icon: '👕'
      },
      {
        tipDE: 'Sonnenschutz und Hut essentiell',
        tipEN: 'Sun protection and hat essential',
        icon: '🧢'
      },
      {
        tipDE: 'Golf-Enthusiasten sollten nicht verpassen',
        tipEN: 'Golf enthusiasts shouldn\'t miss this',
        icon: '⛳'
      }
    ],
    aboutDE: 'Das BMW International Open findet jährlich im Juni statt und ist seit 1989 ein Klassiker auf der PGA European Tour. Das Turnier hat eine besondere Bedeutung für die europäische Golfszene und ist bekannt für seine hochwertige Organisation und spektakuläre Spielweise. Der Golfplatz ist anspruchsvoll und verlangt technische Perfektion von den weltbesten Spielern.\n\nFür Golf-Fans ist das BMW Open ein Weltniveau-Turnier. Ein Taxi vom Flughafen zum Golfplatz ist die komfortabelste Lösung.',
    aboutEN: 'Held annually in June since 1989, the BMW International Open is a classic on the PGA European Tour. The tournament has special significance for the European golf scene and is known for its high-quality organization and spectacular play. The golf course is challenging and demands technical perfection from the world\'s best players.\n\nFor golf fans, the BMW Open is a world-class tournament. A taxi from the airport to the golf course is the most comfortable solution.',
    visitorNumbers: '~100,000 spectators per week',
    internationality: '~50% international visitors',
    startDate: new Date('2026-06-17'),
    endDate: new Date('2026-06-20')
  },
  {
    slug: 'muenchen-marathon',
    titleDE: 'München Marathon',
    titleEN: 'Munich Marathon',
    subtitleDE: 'Internationaler Marathon durch München und Umland',
    subtitleEN: 'International Marathon Through Munich & Surrounding Areas',
    datesDE: '11. Oktober 2026',
    datesEN: 'October 11, 2026',
    locationDE: 'Start: Olympistaion, Ziel: Marienplatz',
    locationEN: 'Start: Olympic Stadium, Finish: Marienplatz',
    descriptionDE: 'Der München Marathon ist einer der größten Marathonläufe in Deutschland mit etwa 15.000 Läufern und 100.000 Zuschauern. Die Route führt durch München und die Umgebung – ein wunderschönes Erlebnis, die bayerische Landschaft und die Sehenswürdigkeiten während des Laufs zu sehen. Der Marathon zieht Hobby-Läufer, Profis und Fitnessenthusiasten aus aller Welt an.',
    descriptionEN: 'The Munich Marathon is one of Germany\'s largest marathon runs with about 15,000 runners and 100,000 spectators. The route runs through Munich and the surrounding area – a beautiful experience to see Bavarian landscapes and sights while running. The marathon attracts hobby runners, professionals, and fitness enthusiasts from worldwide.',
    stats: [
      {
        valueDE: '~15.000',
        valueEN: '~15,000',
        labelDE: 'Läufer',
        labelEN: 'Runners',
        icon: '🏃'
      },
      {
        valueDE: '~100.000',
        valueEN: '~100,000',
        labelDE: 'Zuschauer',
        labelEN: 'Spectators',
        icon: '👥'
      },
      {
        valueDE: '~42,2',
        valueEN: '~42.2',
        labelDE: 'Kilometer',
        labelEN: 'Kilometers',
        icon: '📏'
      },
      {
        valueDE: '~40%',
        valueEN: '~40%',
        labelDE: 'Internationale Läufer',
        labelEN: 'International Runners',
        icon: '✈️'
      }
    ],
    tips: [
      {
        tipDE: 'Früh anmelden – Plätze sind begrenzt',
        tipEN: 'Register early – spots are limited',
        icon: '🎫'
      },
      {
        tipDE: 'Taxi vom Flughafen zum Hotel buchen – vor/nach dem Marathon',
        tipEN: 'Book airport taxi to hotel – before/after marathon',
        icon: '🚕'
      },
      {
        tipDE: 'Gutes Training voraus – 42km ist eine Herausforderung',
        tipEN: 'Train well – 42km is a challenge',
        icon: '💪'
      },
      {
        tipDE: 'Wasserstationen und Verpflegung während der Route nutzen',
        tipEN: 'Use water stations and refreshments along the route',
        icon: '💧'
      },
      {
        tipDE: 'Freunde/Familie sollten zur Unterstützung kommen',
        tipEN: 'Friends/family should come for support',
        icon: '👨‍👩‍👧‍👦'
      }
    ],
    aboutDE: 'Der München Marathon findet jährlich im Oktober statt und ist seit 1987 eines der größten Marathon-Events in Deutschland. Die Route ist bekannt für ihre Schönheit – sie führt vorbei an vielen Münchner Sehenswürdigkeiten wie dem Olympiapark, der Isar und kultwürdigen Stadtteilen. Der Marathon ist ein großes Event mit bedeutendem wirtschaftlichen Einfluss und kultureller Wichtigkeit für München.\n\nFür Lauf-Enthusiasten ist der München Marathon ein unvergessliches Erlebnis. Ein Taxi vom Flughafen zu Hotels oder zum Start ist sehr praktisch.',
    aboutEN: 'Held annually in October since 1987, the Munich Marathon is one of Germany\'s largest marathon events. The route is known for its beauty – it passes many Munich sights including the Olympic Park, the Isar, and cultural neighborhoods. The marathon is a major event with significant economic impact and cultural importance for Munich.\n\nFor running enthusiasts, the Munich Marathon is an unforgettable experience. A taxi from the airport to hotels or the start is very practical.',
    visitorNumbers: '~15,000 runners, ~100,000 spectators',
    internationality: '~40% international runners',
    startDate: new Date('2026-10-11'),
    endDate: new Date('2026-10-11')
  }
];
