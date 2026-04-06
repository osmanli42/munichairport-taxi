import { ReactNode } from 'react';

export interface EventTip {
  de: string;
  en: string;
}

export interface EventStats {
  visitors: string;
  duration: string;
  location: string;
  price?: string;
}

export interface EventSchema {
  '@context': string;
  '@type': string;
  name: string;
  startDate: string;
  endDate: string;
  location: {
    '@type': string;
    name: string;
    address: {
      '@type': string;
      streetAddress: string;
      addressLocality: string;
      postalCode: string;
      addressCountry: string;
    };
  };
  image: string;
  description: string;
  organizer: {
    '@type': string;
    name: string;
    url: string;
  };
  url: string;
}

export interface Event {
  id: string;
  slug: string;
  title: {
    de: string;
    en: string;
  };
  description: {
    de: string;
    en: string;
  };
  shortDescription: {
    de: string;
    en: string;
  };
  dateRange: {
    start: string;
    end: string;
    month: string;
  };
  location: {
    de: string;
    en: string;
    address: string;
  };
  stats: EventStats;
  tips: EventTip[];
  highlights: {
    de: string[];
    en: string[];
  };
  highlights_description: {
    de: string;
    en: string;
  };
  website?: string;
  category: 'trade' | 'cultural' | 'festival' | 'sports' | 'market';
  // SEO Fields
  seoTitle: {
    de: string;
    en: string;
  };
  seoDescription: {
    de: string;
    en: string;
  };
  seoKeywords: {
    de: string[];
    en: string[];
  };
  ogImage: string;
  schema: EventSchema;
  relatedEvents: string[];
}

export const eventsData: Event[] = [
  {
    id: 'bauma',
    slug: 'bauma',
    title: {
      de: 'bauma - Weltleitmesse für Baumaschinen',
      en: 'bauma - World\'s Leading Trade Fair for Construction Equipment',
    },
    description: {
      de: 'Die bauma ist die größte Messe für Baumaschinen, Baufahrzeuge und Baugeräte der Welt. Mit über 600.000 Besuchern und mehr als 3.600 Ausstellern zeigt die bauma Innovationen der Baubranche aus aller Welt.',
      en: 'bauma is the world\'s largest trade fair for construction machines, construction vehicles and equipment. With over 600,000 visitors and more than 3,600 exhibitors, bauma showcases innovations in the construction industry from around the world.',
    },
    shortDescription: {
      de: 'Weltleitmesse für Baumaschinen und Baugeräte',
      en: 'World\'s leading trade fair for construction equipment',
    },
    dateRange: {
      start: '08.04.2024',
      end: '14.04.2024',
      month: 'April',
    },
    location: {
      de: 'München Messe',
      en: 'Munich Trade Fair Centre',
      address: 'Messegelände, 81823 München',
    },
    stats: {
      visitors: '600.000+',
      duration: '7 Tage',
      location: 'München Messe',
      price: 'Tagesticket ab €25',
    },
    tips: [
      {
        de: 'Buchen Sie eine Taxifahrt im Voraus, um lange Wartezeiten zu vermeiden, besonders während der Stoßzeiten morgens und abends.',
        en: 'Book a taxi in advance to avoid long waiting times, especially during peak hours in the morning and evening.',
      },
      {
        de: 'Der Messegelände ist groß - tragen Sie bequeme Schuhe und planen Sie mindestens 4-5 Stunden ein.',
        en: 'The trade fair grounds are large - wear comfortable shoes and plan for at least 4-5 hours.',
      },
      {
        de: 'Nutzen Sie die Shuttleservice vom Flughafen direkt zum Messegelände für maximale Bequemlichkeit.',
        en: 'Use the shuttle service from the airport directly to the trade fair grounds for maximum convenience.',
      },
      {
        de: 'Bringen Sie mehrere Kopien Ihres Ausweises mit - große Messen sind streng mit Sicherheitskontrollen.',
        en: 'Bring multiple copies of your ID - large trade fairs have strict security controls.',
      },
    ],
    highlights: {
      de: [
        'Neueste Bautechnologien und Innovationen',
        'Live-Demonstrationen von Baumaschinen',
        'Netzwerkveranstaltungen für Profis',
        'International renommierte Aussteller',
        'Konferenzen und Vorträge zu Branchentrends',
      ],
      en: [
        'Latest construction technologies and innovations',
        'Live demonstrations of construction machinery',
        'Networking events for professionals',
        'Internationally renowned exhibitors',
        'Conferences and lectures on industry trends',
      ],
    },
    highlights_description: {
      de: 'Die bauma bietet umfassende Einblicke in die Zukunft des Baugewerbes mit praktischen Demonstrationen und Networking-Möglichkeiten für Fachleute.',
      en: 'bauma provides comprehensive insights into the future of the construction industry with practical demonstrations and networking opportunities for professionals.',
    },
    website: 'https://www.bauma.de',
    category: 'trade',
    // SEO Fields
    seoTitle: {
      de: 'bauma München 2024 | Flughafen Transfer | Taxi buchen',
      en: 'bauma Munich 2024 | Airport Taxi Transfer | Book Now',
    },
    seoDescription: {
      de: 'Taxi vom Flughafen München zur bauma. Festpreise, pünktlich, online buchen. 8-14 April 2024.',
      en: 'Airport taxi to bauma Munich. Fixed prices, punctual, book online. April 8-14, 2024.',
    },
    seoKeywords: {
      de: ['bauma münchen', 'messe münchen', 'flughafen taxi', 'baumaschinen messe', 'messeevent'],
      en: ['bauma munich', 'construction fair', 'airport taxi', 'trade fair transfer', 'Munich events'],
    },
    ogImage: '🏗️',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'bauma - Weltleitmesse für Baumaschinen',
      startDate: '2024-04-08',
      endDate: '2024-04-14',
      location: {
        '@type': 'Place',
        name: 'München Messe',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Messegelände',
          addressLocality: 'Munich',
          postalCode: '81823',
          addressCountry: 'DE',
        },
      },
      image: '🏗️',
      description: 'Weltleitmesse für Baumaschinen und Baugeräte',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/bauma',
    },
    relatedEvents: ['ifat', 'expo-real', 'electronica'],
  },
  {
    id: 'iaa',
    slug: 'iaa',
    title: {
      de: 'IAA - Internationale Automobil Ausstellung',
      en: 'IAA - International Motor Show',
    },
    description: {
      de: 'Die IAA in München ist eine der weltweit führenden Automobilmessen, die die neuesten Fahrzeuge, Elektromobilität und autonome Fahrtechnik präsentiert. Mit hundertausenden von Besuchern zeigt die IAA die Zukunft der Mobilität.',
      en: 'The IAA in Munich is one of the world\'s leading motor shows, presenting the latest vehicles, electric mobility and autonomous driving technology. With hundreds of thousands of visitors, the IAA showcases the future of mobility.',
    },
    shortDescription: {
      de: 'Internationale Automobil Ausstellung',
      en: 'International Motor Show',
    },
    dateRange: {
      start: '05.09.2025',
      end: '14.09.2025',
      month: 'September',
    },
    location: {
      de: 'München Messe',
      en: 'Munich Trade Fair Centre',
      address: 'Messegelände, 81823 München',
    },
    stats: {
      visitors: '500.000+',
      duration: '10 Tage',
      location: 'München Messe',
      price: 'Tagesticket ab €20',
    },
    tips: [
      {
        de: 'Reservieren Sie ein Taxi mit größerem Platzangebot, um bequem von Ihrem Hotel zur IAA zu gelangen.',
        en: 'Reserve a taxi with larger capacity to travel comfortably from your hotel to the IAA.',
      },
      {
        de: 'Die IAA zieht große Menschenmengen an - kommen Sie früh morgens an, um die besten Exponaten ohne Gedränge zu sehen.',
        en: 'The IAA attracts large crowds - arrive early in the morning to see the best exhibits without crowds.',
      },
      {
        de: 'Laden Sie die offizielle IAA-App herunter für Ausstellerverzeichnis und aktuelle Informationen.',
        en: 'Download the official IAA app for exhibitor directory and up-to-date information.',
      },
      {
        de: 'Elektrofahrzeuge und autonome Fahrsysteme sind Schwerpunkte - besuchen Sie die speziellen Technologie-Pavillons.',
        en: 'Electric vehicles and autonomous driving systems are the focus - visit the special technology pavilions.',
      },
    ],
    highlights: {
      de: [
        'Präsentation der neuesten Automodelle',
        'Elektromobilität und Hybridtechnik',
        'Autonome Fahrzeuge und Fahrassistenten',
        'Hersteller-Debüts und Weltpremieren',
        'Interaktive Testfahrten und Simulationen',
      ],
      en: [
        'Presentation of the latest car models',
        'Electric mobility and hybrid technology',
        'Autonomous vehicles and driver assistance systems',
        'Manufacturer debuts and world premieres',
        'Interactive test drives and simulations',
      ],
    },
    highlights_description: {
      de: 'Die IAA zeigt die Zukunft der Mobilität mit großem Fokus auf Elektromobilität, autonomes Fahren und innovative Fahrtechnologien.',
      en: 'The IAA showcases the future of mobility with a strong focus on electric mobility, autonomous driving and innovative driving technologies.',
    },
    website: 'https://www.iaa.de',
    category: 'trade',
    // SEO Fields
    seoTitle: {
      de: 'IAA München 2025 | Automobilmesse | Flughafen Taxi',
      en: 'IAA Munich 2025 | Motor Show | Airport Taxi Service',
    },
    seoDescription: {
      de: 'Taxi zur IAA München mit fixem Preis. Elektrofahrzeuge, autonomes Fahren. 5-14 Sept. 2025.',
      en: 'Taxi to IAA Munich with fixed price. Electric cars, autonomous driving. Sept 5-14, 2025.',
    },
    seoKeywords: {
      de: ['iaa münchen', 'automobilmesse', 'elektrofahrzeuge', 'airport transfer', 'businessataxi'],
      en: ['iaa munich', 'motor show', 'electric vehicles', 'airport transfer', 'business taxi'],
    },
    ogImage: '🚗',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'IAA - Internationale Automobil Ausstellung',
      startDate: '2025-09-05',
      endDate: '2025-09-14',
      location: {
        '@type': 'Place',
        name: 'München Messe',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Messegelände',
          addressLocality: 'Munich',
          postalCode: '81823',
          addressCountry: 'DE',
        },
      },
      image: '🚗',
      description: 'Internationale Automobil Ausstellung',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/iaa',
    },
    relatedEvents: ['expo-real', 'ispo', 'analytica'],
  },
  {
    id: 'ifat',
    slug: 'ifat',
    title: {
      de: 'IFAT - Messe für Umwelttechnik und Wasser',
      en: 'IFAT - World\'s Leading Trade Fair for Environmental and Water Technology',
    },
    description: {
      de: 'IFAT ist die weltgrößte Messe für Umwelttechnik, Wasser- und Abfallwirtschaft. Mit über 200.000 Besuchern und etwa 3.000 Ausstellern aus der ganzen Welt präsentiert IFAT innovative Lösungen für Umweltschutz und Ressourcenmanagement.',
      en: 'IFAT is the world\'s largest trade fair for environmental technology, water and waste management. With over 200,000 visitors and approximately 3,000 exhibitors from around the world, IFAT presents innovative solutions for environmental protection and resource management.',
    },
    shortDescription: {
      de: 'Weltleitmesse für Umwelt- und Wassertechnik',
      en: 'World\'s leading fair for environmental and water technology',
    },
    dateRange: {
      start: '27.05.2024',
      end: '31.05.2024',
      month: 'Mai',
    },
    location: {
      de: 'München Messe',
      en: 'Munich Trade Fair Centre',
      address: 'Messegelände, 81823 München',
    },
    stats: {
      visitors: '200.000+',
      duration: '5 Tage',
      location: 'München Messe',
      price: 'Tagesticket ab €20',
    },
    tips: [
      {
        de: 'IFAT bietet spezialisierte Vorträge und Seminare - überprüfen Sie das Programm im Voraus und melden Sie sich an.',
        en: 'IFAT offers specialized lectures and seminars - check the program in advance and register.',
      },
      {
        de: 'Professionelle Besucher sollten die Fachkonferenzen nicht verpassen - perfekt zum Netzwerken mit Branchenführern.',
        en: 'Professional visitors should not miss the technical conferences - perfect for networking with industry leaders.',
      },
      {
        de: 'Tragen Sie passendes Schuhwerk - viele Ausstellungen zeigen Feldinstallationen und Technologie in Echtzeit.',
        en: 'Wear appropriate footwear - many exhibits showcase field installations and technology in real-time.',
      },
      {
        de: 'Die Messe ist besonders relevant für Fachleute in Wasserwirtschaft, Abfallwirtschaft und Umweltmanagement.',
        en: 'The fair is particularly relevant for professionals in water management, waste management and environmental management.',
      },
    ],
    highlights: {
      de: [
        'Innovative Umwelttechnologien',
        'Wasser- und Abfallwirtschaftslösungen',
        'Ressourcenmanagement und Recycling',
        'Fachkonferenzen und Seminare',
        'Internationale Fachanbieter',
      ],
      en: [
        'Innovative environmental technologies',
        'Water and waste management solutions',
        'Resource management and recycling',
        'Professional conferences and seminars',
        'International suppliers',
      ],
    },
    highlights_description: {
      de: 'IFAT präsentiert wegweisende Lösungen für Umweltschutz, Wasserwirtschaft und Ressourcenmanagement auf der weltgrößten Plattform.',
      en: 'IFAT presents groundbreaking solutions for environmental protection, water management and resource management on the world\'s largest platform.',
    },
    website: 'https://www.ifat.de',
    category: 'trade',
    // SEO Fields
    seoTitle: {
      de: 'IFAT München 2024 | Wassertechnik Messe | Taxi Service',
      en: 'IFAT Munich 2024 | Water Fair | Airport Taxi Service',
    },
    seoDescription: {
      de: 'Zuverlässiger Taxi-Transfer zur IFAT München. Umwelttechnik & Wasserwirtschaft. 27-31 Mai.',
      en: 'Reliable taxi to IFAT Munich environmental fair. Fixed prices, 24/7. May 27-31, 2024.',
    },
    seoKeywords: {
      de: ['ifat münchen', 'wassertechnik', 'umweltmesse', 'flughafen münchen', 'event transfer'],
      en: ['ifat munich', 'water technology', 'environmental fair', 'airport service', 'event taxi'],
    },
    ogImage: '💧',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'IFAT - Messe für Umwelttechnik und Wasser',
      startDate: '2024-05-27',
      endDate: '2024-05-31',
      location: {
        '@type': 'Place',
        name: 'München Messe',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Messegelände',
          addressLocality: 'Munich',
          postalCode: '81823',
          addressCountry: 'DE',
        },
      },
      image: '💧',
      description: 'Weltleitmesse für Umwelt- und Wassertechnik',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/ifat',
    },
    relatedEvents: ['bauma', 'electronica', 'intersolar'],
  },
  {
    id: 'electronica',
    slug: 'electronica',
    title: {
      de: 'electronica - Internationale Elektronikmesse',
      en: 'electronica - International Electronics Trade Fair',
    },
    description: {
      de: 'electronica ist die weltführende Messe für Komponenten, Systeme und Anwendungen in der Elektronik. Mit etwa 600 Ausstellern und zehntausenden von Fachbesuchern präsentiert electronica die neuesten Entwicklungen in der Elektronik- und Halbleitergechnologie.',
      en: 'electronica is the world\'s leading trade fair for components, systems and applications in electronics. With approximately 600 exhibitors and tens of thousands of professional visitors, electronica presents the latest developments in electronics and semiconductor technology.',
    },
    shortDescription: {
      de: 'Internationale Elektronik- und Halbleitermesse',
      en: 'International electronics and semiconductor fair',
    },
    dateRange: {
      start: '12.11.2024',
      end: '15.11.2024',
      month: 'November',
    },
    location: {
      de: 'München Messe',
      en: 'Munich Trade Fair Centre',
      address: 'Messegelände, 81823 München',
    },
    stats: {
      visitors: '100.000+',
      duration: '4 Tage',
      location: 'München Messe',
      price: 'Tagesticket ab €18',
    },
    tips: [
      {
        de: 'electronica ist eine Fachmesse für Profis - bringen Sie Ihre Geschäftskarten mit und nutzen Sie das Netzwerk-Potenzial.',
        en: 'electronica is a professional trade fair - bring your business cards and use the networking potential.',
      },
      {
        de: 'Die neuesten Halbleiter und elektronischen Komponenten werden vorgestellt - besonders interessant für Techniker und Ingenieure.',
        en: 'The latest semiconductors and electronic components are presented - particularly interesting for engineers and technicians.',
      },
      {
        de: 'Buchen Sie einen Meetingraum oder Lounge-Zugang für exklusivere Networking-Möglichkeiten.',
        en: 'Book a meeting room or lounge access for more exclusive networking opportunities.',
      },
      {
        de: 'Viele hochspezialisierte Aussteller - besuchen Sie gezielt die Hallen mit relevanten Produktkategorien.',
        en: 'Many highly specialized exhibitors - specifically visit the halls with relevant product categories.',
      },
    ],
    highlights: {
      de: [
        'Halbleiter und Mikroelektronik',
        'Elektronische Komponenten und Module',
        'Embedded Systems und IoT-Technologien',
        'Fachvorträge von Branchenführern',
        'Große Hersteller aus aller Welt',
      ],
      en: [
        'Semiconductors and microelectronics',
        'Electronic components and modules',
        'Embedded systems and IoT technologies',
        'Expert lectures from industry leaders',
        'Major manufacturers from around the world',
      ],
    },
    highlights_description: {
      de: 'electronica ist das Schaufenster für die globale Elektronik-Industrie und zeigt Innovationen in Halbleiter- und Komponentenentwicklung.',
      en: 'electronica is the showcase for the global electronics industry and presents innovations in semiconductor and component development.',
    },
    website: 'https://www.electronica.de',
    category: 'trade',
    // SEO Fields
    seoTitle: {
      de: 'electronica München 2024 | Elektronik Messe | Taxi buchen',
      en: 'electronica Munich 2024 | Electronics Fair | Book Taxi',
    },
    seoDescription: {
      de: 'Schneller Airport-Transfer zur electronica München. Halbleiter, IoT, Elektronik. 12-15 Nov.',
      en: 'Fast airport transfer to electronica Munich electronics fair. Semiconductors, IoT. Nov 12-15.',
    },
    seoKeywords: {
      de: ['electronica münchen', 'elektronik messe', 'halbleiter', 'technik messe', 'business transfer'],
      en: ['electronica munich', 'electronics fair', 'semiconductors', 'tech expo', 'business transfer'],
    },
    ogImage: '⚡',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'electronica - Internationale Elektronikmesse',
      startDate: '2024-11-12',
      endDate: '2024-11-15',
      location: {
        '@type': 'Place',
        name: 'München Messe',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Messegelände',
          addressLocality: 'Munich',
          postalCode: '81823',
          addressCountry: 'DE',
        },
      },
      image: '⚡',
      description: 'Internationale Elektronik- und Halbleitermesse',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/electronica',
    },
    relatedEvents: ['bauma', 'ispo', 'intersolar'],
  },
  {
    id: 'expo-real',
    slug: 'expo-real',
    title: {
      de: 'EXPO REAL - Internationale Messe für Immobilien und Investitionen',
      en: 'EXPO REAL - International Real Estate and Investment Fair',
    },
    description: {
      de: 'EXPO REAL ist Europas führende Messe für Immobilien, Investitionen und Stadtentwicklung. Mit über 300 Ausstellern und zehntausenden von Investoren, Entwicklern und Immobilienprofis präsentiert EXPO REAL die neuesten Trends in der Immobilienbranche.',
      en: 'EXPO REAL is Europe\'s leading trade fair for real estate, investments and urban development. With over 300 exhibitors and tens of thousands of investors, developers and real estate professionals, EXPO REAL presents the latest trends in the real estate industry.',
    },
    shortDescription: {
      de: 'Europas führende Immobilien- und Investitionsmesse',
      en: 'Europe\'s leading real estate and investment fair',
    },
    dateRange: {
      start: '07.10.2024',
      end: '09.10.2024',
      month: 'Oktober',
    },
    location: {
      de: 'München Messe',
      en: 'Munich Trade Fair Centre',
      address: 'Messegelände, 81823 München',
    },
    stats: {
      visitors: '150.000+',
      duration: '3 Tage',
      location: 'München Messe',
      price: 'Tagesticket ab €25',
    },
    tips: [
      {
        de: 'EXPO REAL ist eine hochwertige Investitionsmesse - registrieren Sie sich vorab für Fachbesucher-Zugang und exklusive Events.',
        en: 'EXPO REAL is a high-end investment fair - register in advance for professional visitor access and exclusive events.',
      },
      {
        de: 'Investoren und Entwickler präsentieren ihre Projekte - perfekt zum Treffen von Geschäftspartnern und Investoren.',
        en: 'Investors and developers present their projects - perfect for meeting business partners and investors.',
      },
      {
        de: 'Die Konferenzprogramme sind sehr informativ - wählen Sie Themen aus, die für Ihre Investitionsziele relevant sind.',
        en: 'The conference programs are very informative - select topics relevant to your investment goals.',
      },
      {
        de: 'Business-Casual-Kleidung wird empfohlen für professionelle Meetings mit Investoren und Entwicklern.',
        en: 'Business casual attire is recommended for professional meetings with investors and developers.',
      },
    ],
    highlights: {
      de: [
        'Weltweite Immobilienprojekte',
        'Investitionschancen und Kapitalbereitstellung',
        'Digitalisierung in der Immobilienbranche',
        'Nachhaltige Stadtentwicklung',
        'Netzwerk mit Top-Investoren und Entwicklern',
      ],
      en: [
        'Worldwide real estate projects',
        'Investment opportunities and capital availability',
        'Digitalization in the real estate industry',
        'Sustainable urban development',
        'Network with top investors and developers',
      ],
    },
    highlights_description: {
      de: 'EXPO REAL verbindet Investoren, Entwickler und Profis auf Europas größter Plattform für Immobilieninvestitionen und Stadtentwicklung.',
      en: 'EXPO REAL connects investors, developers and professionals on Europe\'s largest platform for real estate investments and urban development.',
    },
    website: 'https://www.exporeal.de',
    category: 'trade',
    // SEO Fields
    seoTitle: {
      de: 'EXPO REAL München 2024 | Immobilien Messe | Taxi Service',
      en: 'EXPO REAL Munich 2024 | Real Estate Fair | Taxi Service',
    },
    seoDescription: {
      de: 'Immobilien-Messe Taxi Transfer. EXPO REAL mit Investoren & Entwicklern. 1-3 Oktober 2024.',
      en: 'Real estate fair taxi service. EXPO REAL with investors & developers. Oct 1-3, 2024.',
    },
    seoKeywords: {
      de: ['expo real', 'immobilien messe', 'realitätenmesse', 'investmentmesse', 'münchen taxi'],
      en: ['expo real', 'real estate fair', 'property fair', 'investment fair', 'munich taxi'],
    },
    ogImage: '🏢',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'EXPO REAL - Internationale Messe für Immobilien und Investitionen',
      startDate: '2024-10-01',
      endDate: '2024-10-03',
      location: {
        '@type': 'Place',
        name: 'München Messe',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Messegelände',
          addressLocality: 'Munich',
          postalCode: '81823',
          addressCountry: 'DE',
        },
      },
      image: '🏢',
      description: 'Europas führende Immobilien- und Investitionsmesse',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/expo-real',
    },
    relatedEvents: ['iaa', 'bauma', 'heim-handwerk'],
  },
  {
    id: 'intersolar',
    slug: 'intersolar',
    title: {
      de: 'Intersolar - Internationale Solarenergie Messe',
      en: 'Intersolar - International Solar Energy Trade Fair',
    },
    description: {
      de: 'Intersolar ist die weltweit größte Messe für Solarwirtschaft und Photovoltaik. Mit über 150.000 Besuchern und etwa 1.200 Ausstellern präsentiert Intersolar die neuesten Technologien in Solarenergie, Speichersystemen und erneuerbaren Energien.',
      en: 'Intersolar is the world\'s largest trade fair for the solar industry and photovoltaics. With over 150,000 visitors and approximately 1,200 exhibitors, Intersolar presents the latest technologies in solar energy, storage systems and renewable energy.',
    },
    shortDescription: {
      de: 'Weltweit größte Solarenergie Messe',
      en: 'World\'s largest solar energy fair',
    },
    dateRange: {
      start: '11.06.2024',
      end: '13.06.2024',
      month: 'Juni',
    },
    location: {
      de: 'München Messe',
      en: 'Munich Trade Fair Centre',
      address: 'Messegelände, 81823 München',
    },
    stats: {
      visitors: '150.000+',
      duration: '3 Tage',
      location: 'München Messe',
      price: 'Tagesticket ab €22',
    },
    tips: [
      {
        de: 'Intersolar ist perfekt zum Vergleichen von Solaranlagen und Speichersystemen - bringen Sie Ihre technischen Spezifikationen mit.',
        en: 'Intersolar is perfect for comparing solar systems and storage solutions - bring your technical specifications.',
      },
      {
        de: 'Die Messe ist beliebt bei Handwerkern, Installateuren und Hausbesitzern - große Menschenmengen möglich.',
        en: 'The fair is popular with craftspeople, installers and homeowners - expect large crowds.',
      },
      {
        de: 'Live-Demonstrationen von Solarmodulen und Wechselrichtern - praktisch um die Technologie in Aktion zu sehen.',
        en: 'Live demonstrations of solar modules and inverters - practical to see the technology in action.',
      },
      {
        de: 'Förderungen und Subventionen für Solaranlagen werden oft auf Messeständen erklärt - informativ für private Nutzer.',
        en: 'Solar subsidies and grants are often explained at booth displays - informative for private users.',
      },
    ],
    highlights: {
      de: [
        'Photovoltaik-Module und Wechselrichter',
        'Energiespeichersysteme und Batterien',
        'Solarthermie und Heizungssysteme',
        'Elektromobilität und Lademöglichkeiten',
        'Nachhaltige Energielösungen',
      ],
      en: [
        'Photovoltaic modules and inverters',
        'Energy storage systems and batteries',
        'Solar thermal and heating systems',
        'Electric mobility and charging solutions',
        'Sustainable energy solutions',
      ],
    },
    highlights_description: {
      de: 'Intersolar zeigt die Zukunft der erneuerbaren Energien mit Fokus auf Solarenergie, Speichersysteme und nachhaltige Lösungen für die Energiewende.',
      en: 'Intersolar showcases the future of renewable energy with a focus on solar energy, storage systems and sustainable solutions for the energy transition.',
    },
    website: 'https://www.intersolar.de',
    category: 'trade',
    // SEO Fields
    seoTitle: {
      de: 'Intersolar München 2024 | Solar Messe | Flughafen Taxi',
      en: 'Intersolar Munich 2024 | Solar Fair | Airport Taxi',
    },
    seoDescription: {
      de: 'Taxi zur Intersolar München - Energiewende & Solarenergie. 19-21 Juni 2024.',
      en: 'Taxi to Intersolar Munich solar energy fair. Renewable energy, solar tech. June 19-21.',
    },
    seoKeywords: {
      de: ['intersolar', 'solarenergie', 'energiewende', 'photovoltaik', 'münchen messe'],
      en: ['intersolar', 'solar energy', 'renewable energy', 'photovoltaic', 'munich fair'],
    },
    ogImage: '☀️',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Intersolar - Internationale Fachmesse für Solarwirtschaft',
      startDate: '2024-06-19',
      endDate: '2024-06-21',
      location: {
        '@type': 'Place',
        name: 'München Messe',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Messegelände',
          addressLocality: 'Munich',
          postalCode: '81823',
          addressCountry: 'DE',
        },
      },
      image: '☀️',
      description: 'Weltführende Messe für Solarenergie und Photovoltaik',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/intersolar',
    },
    relatedEvents: ['ifat', 'analytica', 'electronica'],
  },
  {
    id: 'analytica',
    slug: 'analytica',
    title: {
      de: 'analytica - Internationale Labormesse und Konferenz',
      en: 'analytica - International Laboratory Trade Fair and Conference',
    },
    description: {
      de: 'analytica ist die weltweit führende Messe für Laborausstattung, Analysentechnik und Life Science. Mit über 35.000 Besuchern und etwa 1.000 Ausstellern präsentiert analytica innovative Lösungen für Forschung, Qualitätskontrolle und Diagnostik.',
      en: 'analytica is the world\'s leading trade fair for laboratory equipment, analysis technology and life sciences. With over 35,000 visitors and approximately 1,000 exhibitors, analytica presents innovative solutions for research, quality control and diagnostics.',
    },
    shortDescription: {
      de: 'Weltweit führende Labormesse und Konferenz',
      en: 'World\'s leading laboratory trade fair',
    },
    dateRange: {
      start: '22.05.2024',
      end: '25.05.2024',
      month: 'Mai',
    },
    location: {
      de: 'München Messe',
      en: 'Munich Trade Fair Centre',
      address: 'Messegelände, 81823 München',
    },
    stats: {
      visitors: '35.000+',
      duration: '4 Tage',
      location: 'München Messe',
      price: 'Tagesticket ab €20',
    },
    tips: [
      {
        de: 'analytica richtet sich an Laborprofis - bringen Sie Ihre Qualifikationen und Geschäftskarten mit.',
        en: 'analytica is aimed at laboratory professionals - bring your credentials and business cards.',
      },
      {
        de: 'Hochspezialisierte Ausstellungen - der Besuch einzelner Hallen mit relevanten Produkten ist effizienter als die gesamte Messe.',
        en: 'Highly specialized exhibits - visiting individual halls with relevant products is more efficient than the entire fair.',
      },
      {
        de: 'Konferenzen und Seminare decken aktuelle Themen wie Analytik, Diagnostik und Qualitätssicherung ab.',
        en: 'Conferences and seminars cover current topics such as analytics, diagnostics and quality assurance.',
      },
      {
        de: 'Besonders interessant für Chemiker, Biologen und medizinische Fachkräfte - spezialisierte Networking-Events.',
        en: 'Particularly interesting for chemists, biologists and medical professionals - specialized networking events.',
      },
    ],
    highlights: {
      de: [
        'Laborausstattung und Analyseinstrumente',
        'Life Science Technologien',
        'Qualitätskontroll- und Testlösungen',
        'Digitalisierung von Laboren',
        'Fachkonferenzen und Seminare',
      ],
      en: [
        'Laboratory equipment and analysis instruments',
        'Life science technologies',
        'Quality control and testing solutions',
        'Laboratory digitalization',
        'Professional conferences and seminars',
      ],
    },
    highlights_description: {
      de: 'analytica präsentiert Innovationen in der Labortechnik, Analytik und Life Sciences mit großem Fokus auf Qualität, Genauigkeit und Digitalisierung.',
      en: 'analytica presents innovations in laboratory technology, analytics and life sciences with a strong focus on quality, accuracy and digitalization.',
    },
    website: 'https://www.analytica.de',
    category: 'trade',
    // SEO Fields
    seoTitle: {
      de: 'analytica München 2024 | Labortechnik Messe | Taxi buchen',
      en: 'analytica Munich 2024 | Lab Technology Fair | Book Taxi',
    },
    seoDescription: {
      de: 'Schneller Taxi-Transfer zur analytica München. Labortechnik, Analytik. 25-28 Juni 2024.',
      en: 'Fast taxi to analytica Munich laboratory technology fair. Analytics, lab equipment. June.',
    },
    seoKeywords: {
      de: ['analytica', 'labortechnik', 'labormesse', 'analytik', 'flughafen münchen'],
      en: ['analytica', 'laboratory technology', 'lab fair', 'analytical equipment', 'airport taxi'],
    },
    ogImage: '🔬',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'analytica - Internationale Fachmesse für Labortechnik',
      startDate: '2024-06-25',
      endDate: '2024-06-28',
      location: {
        '@type': 'Place',
        name: 'München Messe',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Messegelände',
          addressLocality: 'Munich',
          postalCode: '81823',
          addressCountry: 'DE',
        },
      },
      image: '🔬',
      description: 'Internationale Fachmesse für Labortechnik und Analytik',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/analytica',
    },
    relatedEvents: ['intersolar', 'ifat', 'electronica'],
  },
  {
    id: 'inhorgenta',
    slug: 'inhorgenta',
    title: {
      de: 'inhorgenta - Internationale Schmuckmesse',
      en: 'inhorgenta - International Jewelry Trade Fair',
    },
    description: {
      de: 'inhorgenta ist die weltweit führende Schmuckmesse mit über 2.500 Ausstellern aus der ganzen Welt. Die Messe präsentiert Schmuck, Uhren, Edelsteine und Goldwaren von führenden Marken und Handwerkern aus der ganzen Welt.',
      en: 'inhorgenta is the world\'s leading jewelry trade fair with over 2,500 exhibitors from around the world. The fair presents jewelry, watches, gemstones and precious metals from leading brands and craftspeople from around the world.',
    },
    shortDescription: {
      de: 'Weltweit führende internationale Schmuckmesse',
      en: 'World\'s leading international jewelry fair',
    },
    dateRange: {
      start: '13.02.2025',
      end: '16.02.2025',
      month: 'Februar',
    },
    location: {
      de: 'München Messe',
      en: 'Munich Trade Fair Centre',
      address: 'Messegelände, 81823 München',
    },
    stats: {
      visitors: '100.000+',
      duration: '4 Tage',
      location: 'München Messe',
      price: 'Tagesticket ab €20',
    },
    tips: [
      {
        de: 'inhorgenta ist eine exklusive Fachmesse für Juweliere, Uhrmacher und Schmuchhändler - Fachbesucherausweis erforderlich.',
        en: 'inhorgenta is an exclusive trade fair for jewelers, watchmakers and jewelry dealers - professional visitor pass required.',
      },
      {
        de: 'Die hochwertige Schmuckkollektion ist beeindruckend - Kameras sind in vielen Bereichen nicht erlaubt.',
        en: 'The high-end jewelry collection is impressive - cameras are not allowed in many areas.',
      },
      {
        de: 'Besucherhanschuhe werden oft empfohlen beim Umgang mit edlen Steinen und kostbarem Schmuck.',
        en: 'Visitor gloves are often recommended when handling precious stones and valuable jewelry.',
      },
      {
        de: 'Termin mit Ausstellern im Voraus abmachen - beliebteste Aussteller sind oft ausgebucht.',
        en: 'Schedule meetings with exhibitors in advance - popular exhibitors are often fully booked.',
      },
    ],
    highlights: {
      de: [
        'Schmuck und Schmuckdesign',
        'Uhren und Zeitmesser',
        'Edelsteine und Diamanten',
        'Goldwaren und Silberschmuck',
        'Handwerk und innovative Designs',
      ],
      en: [
        'Jewelry and jewelry design',
        'Watches and timepieces',
        'Gemstones and diamonds',
        'Gold and silver jewelry',
        'Craftsmanship and innovative designs',
      ],
    },
    highlights_description: {
      de: 'inhorgenta zeigt exklusive Schmuckkollektion von Weltmarken und Handwerkern mit Fokus auf Design, Qualität und Kostbarkeit.',
      en: 'inhorgenta presents exclusive jewelry collections from world brands and craftspeople with a focus on design, quality and luxury.',
    },
    website: 'https://www.inhorgenta.de',
    category: 'trade',
    // SEO Fields
    seoTitle: {
      de: 'inhorgenta 2024 München | Schmuck Messe | Taxi Transfer',
      en: 'inhorgenta 2024 Munich | Jewelry Fair | Taxi Transfer',
    },
    seoDescription: {
      de: 'Schmuck & Uhren Messe Taxi-Service. inhorgenta München 16-19 Feb. Flughafen Transfer.',
      en: 'Jewelry & watch fair taxi service. inhorgenta Munich Feb 16-19. Airport transfer included.',
    },
    seoKeywords: {
      de: ['inhorgenta', 'schmuck messe', 'uhren messe', 'luxus', 'münchen events'],
      en: ['inhorgenta', 'jewelry fair', 'watch fair', 'luxury', 'munich events'],
    },
    ogImage: '💎',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'inhorgenta - Internationale Schmuck- und Uhrmesse',
      startDate: '2024-02-16',
      endDate: '2024-02-19',
      location: {
        '@type': 'Place',
        name: 'München Messe',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Messegelände',
          addressLocality: 'Munich',
          postalCode: '81823',
          addressCountry: 'DE',
        },
      },
      image: '💎',
      description: 'Internationale Schmuck- und Uhrenmesse',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/inhorgenta',
    },
    relatedEvents: ['heim-handwerk', 'christkindlmarkt', 'expo-real'],
  },
  {
    id: 'ispo',
    slug: 'ispo',
    title: {
      de: 'ISPO - Internationale Sportmesse',
      en: 'ISPO - International Sports Trade Fair',
    },
    description: {
      de: 'ISPO ist die weltgrößte Messe für Sportgeräte, Sportmode und Sportschuhkultur. Mit über 80.000 Besuchern und etwa 2.000 Ausstellern präsentiert ISPO die neuesten Trends in Sport und Fitness von weltweit führenden Marken.',
      en: 'ISPO is the world\'s largest trade fair for sports equipment, sportswear and sports shoe culture. With over 80,000 visitors and approximately 2,000 exhibitors, ISPO presents the latest trends in sports and fitness from leading worldwide brands.',
    },
    shortDescription: {
      de: 'Weltgrößte internationale Sportmesse',
      en: 'World\'s largest international sports fair',
    },
    dateRange: {
      start: '27.01.2025',
      end: '29.01.2025',
      month: 'Januar',
    },
    location: {
      de: 'München Messe',
      en: 'Munich Trade Fair Centre',
      address: 'Messegelände, 81823 München',
    },
    stats: {
      visitors: '80.000+',
      duration: '3 Tage',
      location: 'München Messe',
      price: 'Tagesticket ab €18',
    },
    tips: [
      {
        de: 'ISPO ist ideal zum Vergleichen der neuesten Sportausrüstung und Marken - besonders während Winter für Wintersportgeräte.',
        en: 'ISPO is ideal for comparing the latest sports equipment and brands - especially in winter for winter sports equipment.',
      },
      {
        de: 'Die Messe ist beliebt bei Sportlern, Trainern und Fans - große Menschenmengen möglich.',
        en: 'The fair is popular with athletes, coaches and fans - expect large crowds.',
      },
      {
        de: 'Live-Demonstrationen von Sportlern und Athleten - spannend zum Sehen neuer Technologien in Aktion.',
        en: 'Live demonstrations by athletes - exciting to see new technologies in action.',
      },
      {
        de: 'Sportschuhe Test-Strecke und Ausprobieren möglich - tragen Sie bequeme Kleidung für physische Aktivitäten.',
        en: 'Sports shoe test track and trial available - wear comfortable clothing for physical activities.',
      },
    ],
    highlights: {
      de: [
        'Sportgeräte und Ausrüstung',
        'Sportmode und Bekleidung',
        'Sportschuhe und Schuhkultur',
        'Fitnessgeräte und Trainingstechnologien',
        'Live-Demonstrationen und Wettbewerbe',
      ],
      en: [
        'Sports equipment and gear',
        'Sportswear and clothing',
        'Sports shoes and shoe culture',
        'Fitness equipment and training technologies',
        'Live demonstrations and competitions',
      ],
    },
    highlights_description: {
      de: 'ISPO zeigt die neuesten Innovationen in Sport, Fitness und Sportmode mit dem Fokus auf Technologie, Design und Performance.',
      en: 'ISPO showcases the latest innovations in sports, fitness and sportswear with a focus on technology, design and performance.',
    },
    website: 'https://www.ispo.com',
    category: 'trade',
    // SEO Fields
    seoTitle: {
      de: 'ISPO München 2024 | Sportmesse | Flughafen Taxi buchen',
      en: 'ISPO Munich 2024 | Sports Fair | Airport Taxi Book',
    },
    seoDescription: {
      de: 'ISPO München - Sportausrüstung & Outdoor Messe. Zuverlässiger Taxi-Transfer. 3-6 Juni.',
      en: 'ISPO Munich sports equipment fair. Reliable airport taxi transfer. June 3-6, 2024.',
    },
    seoKeywords: {
      de: ['ispo', 'sportmesse', 'outdoormesse', 'sportausrüstung', 'flughafen transfer'],
      en: ['ispo', 'sports fair', 'outdoor fair', 'sports equipment', 'airport transfer'],
    },
    ogImage: '⚽',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'ISPO - Internationale Sportmesse',
      startDate: '2024-06-03',
      endDate: '2024-06-06',
      location: {
        '@type': 'Place',
        name: 'München Messe',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Messegelände',
          addressLocality: 'Munich',
          postalCode: '81823',
          addressCountry: 'DE',
        },
      },
      image: '⚽',
      description: 'Internationale Sportmesse für Ausrüstung und Outdoor',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/ispo',
    },
    relatedEvents: ['iaa', 'electronica', 'analytica'],
  },
  {
    id: 'heim-handwerk',
    slug: 'heim-handwerk',
    title: {
      de: 'Heim+Handwerk - Messe für Handwerk und Wohnen',
      en: 'Heim+Handwerk - Fair for Crafts and Living',
    },
    description: {
      de: 'Heim+Handwerk ist die größte Messe für Handwerk, Wohnen und Hobbykultur in Bayern. Mit über 100.000 Besuchern und etwa 700 Ausstellern präsentiert die Messe traditionelle und moderne Handwerkstechniken, Wohnaccessoires und DIY-Projekte.',
      en: 'Heim+Handwerk is the largest trade fair for crafts, living and hobby culture in Bavaria. With over 100,000 visitors and approximately 700 exhibitors, the fair presents traditional and modern craft techniques, home accessories and DIY projects.',
    },
    shortDescription: {
      de: 'Größte Handwerks- und Wohnenmesse Bayerns',
      en: 'Bavaria\'s largest crafts and living fair',
    },
    dateRange: {
      start: '06.09.2024',
      end: '15.09.2024',
      month: 'September',
    },
    location: {
      de: 'München Messe',
      en: 'Munich Trade Fair Centre',
      address: 'Messegelände, 81823 München',
    },
    stats: {
      visitors: '100.000+',
      duration: '10 Tage',
      location: 'München Messe',
      price: 'Tagesticket ab €12',
    },
    tips: [
      {
        de: 'Heim+Handwerk ist großartig für Hobby-Handwerker und DIY-Enthusiasten - viele Kurse und Workshops zum Mitmachen.',
        en: 'Heim+Handwerk is great for hobby craftspeople and DIY enthusiasts - many hands-on classes and workshops.',
      },
      {
        de: 'Die Messe zeigt traditionelle Handwerkstechniken sowie moderne Innovationen - faszinierend für alle Altersgruppen.',
        en: 'The fair showcases traditional craftsmanship as well as modern innovations - fascinating for all ages.',
      },
      {
        de: 'Günstiger Eintritt im Vergleich zu anderen Messen - perfekt für einen entspannten Familienausflug.',
        en: 'Inexpensive admission compared to other fairs - perfect for a relaxed family day out.',
      },
      {
        de: 'Bringen Sie ein Notizbuch mit - Sie werden Inspirationen für Heimwerkerprojekte sammeln.',
        en: 'Bring a notebook - you\'ll gather inspirations for home improvement projects.',
      },
    ],
    highlights: {
      de: [
        'Traditionelle Handwerkstechniken',
        'DIY und Heimwerker-Projekte',
        'Wohnaccessoires und Inneneinrichtung',
        'Kreative Workshops und Kurse',
        'Nachhaltige und ökologische Produkte',
      ],
      en: [
        'Traditional craft techniques',
        'DIY and home improvement projects',
        'Home accessories and interior design',
        'Creative workshops and courses',
        'Sustainable and ecological products',
      ],
    },
    highlights_description: {
      de: 'Heim+Handwerk inspiriert mit traditionellen Handwerkstechniken und modernen Wohnideen, perfekt für kreative und praktisch veranlagte Besucher.',
      en: 'Heim+Handwerk inspires with traditional craft techniques and modern living ideas, perfect for creative and practically-minded visitors.',
    },
    website: 'https://www.heim-handwerk.de',
    category: 'cultural',
    // SEO Fields
    seoTitle: {
      de: 'Heim + Handwerk München | Heimwerk Messe | Taxi Service',
      en: 'Heim + Handwerk Munich | Home Fair | Taxi Service',
    },
    seoDescription: {
      de: 'Heimwerk & Handwerk Messe Taxi. Heim + Handwerk Sept. 2024. Flughafen München Transfer.',
      en: 'Home & crafts fair taxi service. Heim + Handwerk September 2024. Airport transfer service.',
    },
    seoKeywords: {
      de: ['heim handwerk', 'heimwerk', 'handwerk messe', 'do-it-yourself', 'münchen'],
      en: ['heim handwerk', 'home crafts', 'diy fair', 'craft fair', 'munich'],
    },
    ogImage: '🔨',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Heim+Handwerk - Messe für Handwerk und Wohnen',
      startDate: '2024-09-19',
      endDate: '2024-09-22',
      location: {
        '@type': 'Place',
        name: 'München Messe',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Messegelände',
          addressLocality: 'Munich',
          postalCode: '81823',
          addressCountry: 'DE',
        },
      },
      image: '🔨',
      description: 'Heimwerk und Handwerksmesse',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/heim-handwerk',
    },
    relatedEvents: ['expo-real', 'inhorgenta', 'ispo'],
  },
  {
    id: 'christkindlmarkt',
    slug: 'christkindlmarkt',
    title: {
      de: 'Münchner Christkindlmarkt',
      en: 'Munich Christmas Market',
    },
    description: {
      de: 'Der Münchner Christkindlmarkt ist einer der schönsten Weihnachtsmärkte in Deutschland. Mit über 150 Ständen auf dem Marienplatz bietet der Markt traditionelle Weihnachtsdekoration, Handwerk, Geschenke und festliche Speisen und Getränke.',
      en: 'The Munich Christmas Market is one of the most beautiful Christmas markets in Germany. With over 150 stands on Marienplatz, the market offers traditional Christmas decorations, crafts, gifts and festive food and beverages.',
    },
    shortDescription: {
      de: 'Weihnachtsmarkt auf dem Marienplatz',
      en: 'Christmas Market on Marienplatz',
    },
    dateRange: {
      start: '25.11.2024',
      end: '24.12.2024',
      month: 'November - Dezember',
    },
    location: {
      de: 'Marienplatz',
      en: 'Marienplatz',
      address: 'Marienplatz, 80331 München',
    },
    stats: {
      visitors: '2.000.000+',
      duration: '30 Tage',
      location: 'Marienplatz',
    },
    tips: [
      {
        de: 'Der Weihnachtsmarkt ist sehr beliebt und zieht Millionen von Besuchern an - kommen Sie an Wochentagen oder früh morgens an.',
        en: 'The Christmas market is very popular and attracts millions of visitors - come on weekdays or early in the morning.',
      },
      {
        de: 'Das traditionelle Glühwein und Bayern-Würstchen sind Highlights - probieren Sie die lokalen Spezialitäten.',
        en: 'Traditional mulled wine and Bavarian sausages are highlights - try the local specialties.',
      },
      {
        de: 'Der Markt ist wunderschön beleuchtet nachts - besonders stimmungsvoll von 17 Uhr an.',
        en: 'The market is beautifully lit at night - especially atmospheric from 5 PM onwards.',
      },
      {
        de: 'Das Rathausgebäude mit seiner beleuchteten Weihnachtsdekoration bietet perfekte Fotogelegenheiten.',
        en: 'The town hall building with its illuminated Christmas decorations provides perfect photo opportunities.',
      },
    ],
    highlights: {
      de: [
        'Traditionelle Weihnachtsdekoration und Handwerk',
        'Glühwein und Feuerzangenbowle',
        'Bayern-Spezialitäten und Weihnachtsgebäck',
        'Live-Musik und Unterhaltung',
        'Weihnachtsgeschenke und Souvenir',
      ],
      en: [
        'Traditional Christmas decorations and crafts',
        'Mulled wine and Christmas punch',
        'Bavarian specialties and Christmas baked goods',
        'Live music and entertainment',
        'Christmas gifts and souvenirs',
      ],
    },
    highlights_description: {
      de: 'Der Münchner Christkindlmarkt bietet traditionelle Weihnachtsstimmung, bayerische Kultur und festliche Speisen auf Münchens schönstem Platz.',
      en: 'The Munich Christmas Market offers traditional Christmas atmosphere, Bavarian culture and festive food on Munich\'s most beautiful square.',
    },
    website: 'https://www.christkindlmarkt.de',
    category: 'festival',
    // SEO Fields
    seoTitle: {
      de: 'Christkindlmarkt München 2024 | Weihnacht | Taxi Service',
      en: 'Christkindl Market Munich 2024 | Christmas Fair | Taxi',
    },
    seoDescription: {
      de: 'Christkindl Weihnachtsmarkt München. Weihnachts-Taxi-Transfer. Dezember 2024.',
      en: 'Christkindl Christmas market Munich. Holiday taxi transfer service. December 2024.',
    },
    seoKeywords: {
      de: ['christkindlmarkt', 'weihnachtsmarkt', 'weihnacht', 'münchen dezember', 'holiday'],
      en: ['christkindl market', 'christmas market', 'holiday market', 'munich christmas', 'winter'],
    },
    ogImage: '🎄',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Christkindlmarkt München',
      startDate: '2024-11-27',
      endDate: '2024-12-24',
      location: {
        '@type': 'Place',
        name: 'Marienplatz',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Marienplatz',
          addressLocality: 'Munich',
          postalCode: '80331',
          addressCountry: 'DE',
        },
      },
      image: '🎄',
      description: 'Traditioneller Weihnachtsmarkt',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/christkindlmarkt',
    },
    relatedEvents: ['tollwood-winter', 'starkbierfest', 'fruehlingsfest'],
  },
  {
    id: 'tollwood-sommer',
    slug: 'tollwood-sommer',
    title: {
      de: 'Tollwood Sommerfestival',
      en: 'Tollwood Summer Festival',
    },
    description: {
      de: 'Das Tollwood Sommerfestival ist eines der größten Kultur- und Musikfestivals in München. Mit über 180 Veranstaltungen an 40 Tagen präsentiert Tollwood Musik, Theater, Tanz, Kleinkunst und kulinarische Genüsse von hoher Qualität.',
      en: 'Tollwood Summer Festival is one of the largest cultural and music festivals in Munich. With over 180 events over 40 days, Tollwood presents music, theater, dance, cabaret and culinary delights of high quality.',
    },
    shortDescription: {
      de: 'Kultur- und Musikfestival mit über 180 Veranstaltungen',
      en: 'Cultural and music festival with over 180 events',
    },
    dateRange: {
      start: '21.06.2024',
      end: '31.07.2024',
      month: 'Juni - Juli',
    },
    location: {
      de: 'Tollwood-Gelände, Theresienwiese',
      en: 'Tollwood Festival Grounds, Theresienwiese',
      address: 'Theresienwiese, 80336 München',
    },
    stats: {
      visitors: '350.000+',
      duration: '40 Tage',
      location: 'Theresienwiese',
    },
    tips: [
      {
        de: 'Das Festival hat viele Veranstaltungen gleichzeitig - wählen Sie Ihre Favoriten im Voraus und buchen Sie Tickets.',
        en: 'The festival has many events simultaneously - choose your favorites in advance and book tickets.',
      },
      {
        de: 'Das Tollwood ist hochwertig und vielfältig - mit internationalen Künstlern und lokalen Talenten.',
        en: 'Tollwood is high-quality and diverse - with international artists and local talents.',
      },
      {
        de: 'Kulinarische Highlights mit weltweiter Küche - probieren Sie die vielfältigen Verpflegungsstände.',
        en: 'Culinary highlights with worldwide cuisine - try the diverse food stalls.',
      },
      {
        de: 'Die Sommernächte auf dem Festival sind magisch - bringen Sie eine Decke und genießen Sie Musik unter Sternen.',
        en: 'The summer nights at the festival are magical - bring a blanket and enjoy music under the stars.',
      },
    ],
    highlights: {
      de: [
        'Internationale und lokale Musikakts',
        'Theater und Performance-Kunst',
        'Tanz und Bühnenproduktionen',
        'Kulinarische Weltreise',
        'Kunsthandwerk und Kleinkunst',
      ],
      en: [
        'International and local music acts',
        'Theater and performance art',
        'Dance and stage productions',
        'Culinary world tour',
        'Arts and crafts and cabaret',
      ],
    },
    highlights_description: {
      de: 'Tollwood Sommer präsentiert ein vielfältiges Kulturprogramm mit Weltklasse-Musikern, Künstlern und kulinarischen Erlebnissen in einem wunderschönen Open-Air-Setting.',
      en: 'Tollwood Summer presents a diverse cultural program with world-class musicians, artists and culinary experiences in a beautiful open-air setting.',
    },
    website: 'https://www.tollwood.de',
    category: 'festival',
    // SEO Fields
    seoTitle: {
      de: 'Tollwood München Sommer | Kulturfestival | Flughafen Taxi',
      en: 'Tollwood Munich Summer | Cultural Festival | Airport Taxi',
    },
    seoDescription: {
      de: 'Tollwood Sommer-Kulturfestival München. Musik, Kunst, Kulinarik. Juni-Juli 2024.',
      en: 'Tollwood summer cultural festival Munich. Music, art, food. June-July 2024.',
    },
    seoKeywords: {
      de: ['tollwood', 'sommer festival', 'kulturprogramm', 'konzerte', 'flughafen taxi'],
      en: ['tollwood', 'summer festival', 'cultural festival', 'concerts', 'airport taxi'],
    },
    ogImage: '🎪',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Tollwood Sommer',
      startDate: '2024-06-14',
      endDate: '2024-08-04',
      location: {
        '@type': 'Place',
        name: 'Theresienwiese',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Theresienwiese',
          addressLocality: 'Munich',
          postalCode: '80336',
          addressCountry: 'DE',
        },
      },
      image: '🎪',
      description: 'Sommer-Kulturfestival',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/tollwood-sommer',
    },
    relatedEvents: ['tollwood-winter', 'opera-festival', 'csd'],
  },
  {
    id: 'tollwood-winter',
    slug: 'tollwood-winter',
    title: {
      de: 'Tollwood Winterfestival',
      en: 'Tollwood Winter Festival',
    },
    description: {
      de: 'Das Tollwood Winterfestival ist das Gegenstück zum Sommerfestival und präsentiert auch über 100 Kulturveranstaltungen. Mit Fokus auf Winter-Atmosphäre bietet Tollwood Winter Musik, Tanz, kulinarische Spezialitäten und festliche Stimmung.',
      en: 'Tollwood Winter Festival is the counterpart to the summer festival and also presents over 100 cultural events. With a focus on winter atmosphere, Tollwood Winter offers music, dance, culinary specialties and festive mood.',
    },
    shortDescription: {
      de: 'Winter Kultur- und Musikfestival mit 100+ Veranstaltungen',
      en: 'Winter cultural and music festival with 100+ events',
    },
    dateRange: {
      start: '28.11.2024',
      end: '31.12.2024',
      month: 'November - Dezember',
    },
    location: {
      de: 'Tollwood-Gelände, Theresienwiese',
      en: 'Tollwood Festival Grounds, Theresienwiese',
      address: 'Theresienwiese, 80336 München',
    },
    stats: {
      visitors: '300.000+',
      duration: '34 Tage',
      location: 'Theresienwiese',
    },
    tips: [
      {
        de: 'Das Winterfestival hat wärmere Zelte und Heizstrahler - trotzdem warme Kleidung empfohlen.',
        en: 'The winter festival has heated tents and heaters - still recommended to wear warm clothing.',
      },
      {
        de: 'Glühwein und warme Getränke sind hier Highlights - wärmend und gemütlich für kalte Wintertage.',
        en: 'Mulled wine and hot drinks are highlights here - warming and cozy for cold winter days.',
      },
      {
        de: 'Das Festival hat weihnachtliche Atmosphäre und ist perfekt für Silvesterfeierlichkeiten.',
        en: 'The festival has Christmas atmosphere and is perfect for New Year\'s Eve celebrations.',
      },
      {
        de: 'Viele Veranstaltungen sind familienfreundlich - Kinderprogramme vorhanden.',
        en: 'Many events are family-friendly - children\'s programs available.',
      },
    ],
    highlights: {
      de: [
        'Musikkonzerte und Theateraufführungen',
        'Weihnachts- und Silvester-Events',
        'Kulinarische Wintergenüsse',
        'Kunstinstallationen und Lichtskulpturen',
        'Familienfreundliche Programme',
      ],
      en: [
        'Music concerts and theater performances',
        'Christmas and New Year\'s Eve events',
        'Culinary winter delights',
        'Art installations and light sculptures',
        'Family-friendly programs',
      ],
    },
    highlights_description: {
      de: 'Tollwood Winter bietet festliche Weihnachtsstimmung und Silvester-Highlights mit Musik, Kultur und kulinarischen Genüssen in gemütlicher Winteratmosphäre.',
      en: 'Tollwood Winter offers festive Christmas atmosphere and New Year\'s Eve highlights with music, culture and culinary delights in a cozy winter setting.',
    },
    website: 'https://www.tollwood.de',
    category: 'festival',
    // SEO Fields
    seoTitle: {
      de: 'Tollwood München Winter | Christmasmarkt | Taxi Service',
      en: 'Tollwood Munich Winter | Christmas Market | Taxi Service',
    },
    seoDescription: {
      de: 'Tollwood Winter Kulturfestival München. Weihnacht, Märkte. Nov-Januar. Taxi Transfer.',
      en: 'Tollwood winter festival Munich. Christmas, markets. Nov-Jan. Airport taxi service.',
    },
    seoKeywords: {
      de: ['tollwood', 'winter festival', 'weihnachtsfestival', 'münchen dezember', 'taxi'],
      en: ['tollwood', 'winter festival', 'christmas festival', 'munich', 'taxi service'],
    },
    ogImage: '❄️',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Tollwood Winter',
      startDate: '2024-11-16',
      endDate: '2025-01-05',
      location: {
        '@type': 'Place',
        name: 'Theresienwiese',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Theresienwiese',
          addressLocality: 'Munich',
          postalCode: '80336',
          addressCountry: 'DE',
        },
      },
      image: '❄️',
      description: 'Winter-Kulturfestival',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/tollwood-winter',
    },
    relatedEvents: ['christkindlmarkt', 'tollwood-sommer', 'neujahr'],
  },
  {
    id: 'opera-festival',
    slug: 'opera-festival',
    title: {
      de: 'Münchner Opernfestspiele',
      en: 'Munich Opera Festival',
    },
    description: {
      de: 'Die Münchner Opernfestspiele sind eines der wichtigsten Opernfestivals in Europa. Mit weltweit renommierten Sänger:innen, Dirigent:innen und Regisseur:innen präsentiert das Festival hochwertige Opernproduktionen in der Bayerischen Staatsoper.',
      en: 'The Munich Opera Festival is one of the most important opera festivals in Europe. With world-renowned singers, conductors and directors, the festival presents high-quality opera productions at the Bavarian State Opera.',
    },
    shortDescription: {
      de: 'Europas wichtiges Opernfestival mit Weltklasse-Produktionen',
      en: 'Europe\'s important opera festival with world-class productions',
    },
    dateRange: {
      start: '21.06.2024',
      end: '31.08.2024',
      month: 'Juni - August',
    },
    location: {
      de: 'Bayerische Staatsoper',
      en: 'Bavarian State Opera',
      address: 'Max-Joseph-Platz 2, 80539 München',
    },
    stats: {
      visitors: '150.000+',
      duration: '72 Tage',
      location: 'Bayerische Staatsoper',
    },
    tips: [
      {
        de: 'Opernkarten sind beliebt und oft ausverkauft - buchen Sie Tickets so früh wie möglich.',
        en: 'Opera tickets are popular and often sold out - book tickets as early as possible.',
      },
      {
        de: 'Die Bayerische Staatsoper ist ein prachtvolles Gebäude - buchen Sie einen Stadttrip um die Gegend zu erkunden.',
        en: 'The Bavarian State Opera is a magnificent building - book a city trip to explore the area.',
      },
      {
        de: 'Formelle Kleidung wird manchmal empfohlen - überprüfen Sie die Dresscode für spezifische Aufführungen.',
        en: 'Formal attire is sometimes recommended - check the dress code for specific performances.',
      },
      {
        de: 'Das Festival bietet eine Mischung aus klassischen Opern und modernen Interpretationen - für jeden Geschmack etwas dabei.',
        en: 'The festival offers a mix of classical operas and modern interpretations - something for every taste.',
      },
    ],
    highlights: {
      de: [
        'Weltklasse-Sänger:innen und Dirigent:innen',
        'Hochwertige Opernproduktionen',
        'Klassische und moderne Werke',
        'Prachtvolle Ausstattungen und Bühnenbilder',
        'Kulturelle Höhepunkte des Sommers',
      ],
      en: [
        'World-class singers and conductors',
        'High-quality opera productions',
        'Classical and modern works',
        'Splendid sets and stage designs',
        'Cultural highlights of the summer',
      ],
    },
    highlights_description: {
      de: 'Die Münchner Opernfestspiele präsentieren weltklassige Opernproduktionen mit renommierten Künstler:innen in einem der schönsten Opernhäuser Europas.',
      en: 'The Munich Opera Festival presents world-class opera productions with renowned artists in one of Europe\'s most beautiful opera houses.',
    },
    website: 'https://www.bavarian-state-opera.de',
    category: 'cultural',
    // SEO Fields
    seoTitle: {
      de: 'München Opernfestival | Kulturveranstaltung | Taxi zum',
      en: 'Munich Opera Festival | Cultural Event | Taxi Service',
    },
    seoDescription: {
      de: 'Opernfestival München Juni-Juli. Klassische Musik & Theater. Zuverlässiger Taxi-Transfer.',
      en: 'Munich opera festival June-July. Classical music & theater. Reliable airport taxi.',
    },
    seoKeywords: {
      de: ['opernfestival', 'oper münchen', 'klassische musik', 'theater', 'kulturveranstaltung'],
      en: ['opera festival', 'munich opera', 'classical music', 'theater', 'cultural event'],
    },
    ogImage: '🎭',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Opernfestival München',
      startDate: '2024-06-01',
      endDate: '2024-07-31',
      location: {
        '@type': 'Place',
        name: 'Bayerische Staatsoper',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Max-Joseph-Platz 2',
          addressLocality: 'Munich',
          postalCode: '80539',
          addressCountry: 'DE',
        },
      },
      image: '🎭',
      description: 'Opernfestival München',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/opera-festival',
    },
    relatedEvents: ['tollwood-sommer', 'tollwood-winter', 'csd'],
  },
  {
    id: 'starkbierfest',
    slug: 'starkbierfest',
    title: {
      de: 'Münchner Starkbierfest',
      en: 'Munich Strong Beer Festival',
    },
    description: {
      de: 'Das Münchner Starkbierfest ist ein traditionelles Bierfest, das jedes Jahr im März stattfindet. Mit über 100.000 Besuchern werden bayerische Starkbiere und traditionelle bayerische Speisen gefeiert - eine wichtige Tradition im Münchner Jahreskalender.',
      en: 'The Munich Strong Beer Festival is a traditional beer festival that takes place every year in March. With over 100,000 visitors, Bavarian strong beers and traditional Bavarian food are celebrated - an important tradition in the Munich calendar.',
    },
    shortDescription: {
      de: 'Traditionelles Bierfest im März',
      en: 'Traditional beer festival in March',
    },
    dateRange: {
      start: '09.03.2024',
      end: '07.04.2024',
      month: 'März - April',
    },
    location: {
      de: 'Theresienwiese',
      en: 'Theresienwiese',
      address: 'Theresienwiese, 80336 München',
    },
    stats: {
      visitors: '100.000+',
      duration: '30 Tage',
      location: 'Theresienwiese',
    },
    tips: [
      {
        de: 'Starkbier hat höheren Alkoholgehalt - trinken Sie verantwortungsvoll und essen Sie bayerisches Essen dazu.',
        en: 'Strong beer has higher alcohol content - drink responsibly and eat Bavarian food with it.',
      },
      {
        de: 'Traditionelle bayerische Tracht ist beliebt beim Fest - viele Besucher:innen tragen Lederhose und Dirndl.',
        en: 'Traditional Bavarian clothing is popular at the festival - many visitors wear lederhosen and dirndl.',
      },
      {
        de: 'Das Festival ist frühjahrslustig und voller bayrischer Tradition - ein Muss für Bierliebhaber.',
        en: 'The festival is spring celebration and full of Bavarian tradition - a must for beer lovers.',
      },
      {
        de: 'Buchen Sie ein Taxi zurück zu Ihrem Hotel - sichere Alternative zum Auto fahren nach mehreren Bieren.',
        en: 'Book a taxi back to your hotel - a safe alternative to driving after several beers.',
      },
    ],
    highlights: {
      de: [
        'Bayerische Starkbiere',
        'Traditionelle bayerische Speisen',
        'Live-Musik und Tänzer',
        'Bayerische Festtracht',
        'Frühjahrs- und Flirtkultur',
      ],
      en: [
        'Bavarian strong beers',
        'Traditional Bavarian food',
        'Live music and dancers',
        'Bavarian festival attire',
        'Spring celebration and culture',
      ],
    },
    highlights_description: {
      de: 'Das Starkbierfest ist eine bayrische Tradition voller Festlichkeit, traditioneller Biere und bayrischer Kultur - perfekt um Münchens Bierkultur zu erleben.',
      en: 'The Strong Beer Festival is a Bavarian tradition full of celebration, traditional beers and Bavarian culture - perfect to experience Munich\'s beer culture.',
    },
    website: 'https://www.starkbierfest.de',
    category: 'festival',
    // SEO Fields
    seoTitle: {
      de: 'Starkbierfest München 2024 | Bierfestival | Taxi Service',
      en: 'Starkbier Festival Munich 2024 | Beer Festival | Taxi',
    },
    seoDescription: {
      de: 'Starkbierfest München März 2024. Bayerisches Bierfestival. Flughafen Taxi-Transfer.',
      en: 'Starkbier festival Munich March 2024. Bavarian beer festival. Airport taxi transfer.',
    },
    seoKeywords: {
      de: ['starkbierfest', 'bierfest', 'bayern fest', 'münchen march', 'iftea'],
      en: ['starkbier festival', 'beer festival', 'bavarian fest', 'munich march', 'beer'],
    },
    ogImage: '🍺',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Starkbierfest München',
      startDate: '2024-03-16',
      endDate: '2024-04-01',
      location: {
        '@type': 'Place',
        name: 'Theresienwiese',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Theresienwiese',
          addressLocality: 'Munich',
          postalCode: '80336',
          addressCountry: 'DE',
        },
      },
      image: '🍺',
      description: 'Bayerisches Bierfestival',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/starkbierfest',
    },
    relatedEvents: ['fruehlingsfest', 'christkindlmarkt', 'tollwood-winter'],
  },
  {
    id: 'fruehlingsfest',
    slug: 'fruehlingsfest',
    title: {
      de: 'Münchner Frühlingsfest',
      en: 'Munich Spring Festival',
    },
    description: {
      de: 'Das Münchner Frühlingsfest ist ein traditionelles Volksfest mit hundertausenden von Besuchern. Mit Fahrgeschäften, traditionellen bayerischen Speisen, Bieren und Unterhaltung ist das Frühlingsfest eines der wichtigsten Volksfeste Münchens nach dem Oktoberfest.',
      en: 'The Munich Spring Festival is a traditional folk festival with hundreds of thousands of visitors. With amusement rides, traditional Bavarian food, beers and entertainment, the Spring Festival is one of Munich\'s most important folk festivals after Oktoberfest.',
    },
    shortDescription: {
      de: 'Traditionelles Volksfest mit Fahrgeschäften und Bier',
      en: 'Traditional folk festival with rides and beer',
    },
    dateRange: {
      start: '19.04.2024',
      end: '05.05.2024',
      month: 'April - Mai',
    },
    location: {
      de: 'Theresienwiese',
      en: 'Theresienwiese',
      address: 'Theresienwiese, 80336 München',
    },
    stats: {
      visitors: '1.000.000+',
      duration: '17 Tage',
      location: 'Theresienwiese',
    },
    tips: [
      {
        de: 'Das Frühlingsfest ist beliebt und zieht große Massen an - kommen Sie an Wochentagen an für weniger Gedränge.',
        en: 'The Spring Festival is popular and attracts large crowds - come on weekdays for less crowding.',
      },
      {
        de: 'Bayerische Festtracht ist wieder beliebt - viele Besucher:innen tragen Lederhose und Dirndl.',
        en: 'Bavarian festival attire is popular again - many visitors wear lederhosen and dirndl.',
      },
      {
        de: 'Das Fest hat traditionelle Fahrgeschäfte und auch moderne Attraktionen - für Familien und Erwachsene geeignet.',
        en: 'The festival has traditional rides and also modern attractions - suitable for families and adults.',
      },
      {
        de: 'Das Wetter im April/Mai ist typischerweise angenehm - bringen Sie aber eine Leichte Jacke mit für Abends.',
        en: 'The weather in April/May is typically pleasant - but bring a light jacket for evenings.',
      },
    ],
    highlights: {
      de: [
        'Traditionelle Fahrgeschäfte und Karusselle',
        'Bayerische Festkultur',
        'Lokale Biere und Speisen',
        'Live-Musik und Entertainment',
        'Familienfreundliche Attraktionen',
      ],
      en: [
        'Traditional rides and carousels',
        'Bavarian festival culture',
        'Local beers and food',
        'Live music and entertainment',
        'Family-friendly attractions',
      ],
    },
    highlights_description: {
      de: 'Das Frühlingsfest ist Münchens traditionelles Volksfest mit Fahrgeschäften, bayerischer Kultur und Festlichkeit - ähnlich wie das Oktoberfest aber im Frühling.',
      en: 'The Spring Festival is Munich\'s traditional folk festival with rides, Bavarian culture and celebration - similar to Oktoberfest but in spring.',
    },
    website: 'https://www.fruehlingsfest.de',
    category: 'festival',
    // SEO Fields
    seoTitle: {
      de: 'Frühlingsfest München 2024 | Volksfest | Taxi buchen',
      en: 'Spring Festival Munich 2024 | Volksfest | Book Taxi',
    },
    seoDescription: {
      de: 'Frühlingsfest München April 2024. Volksfest mit Bier & Musik. Taxi zum Festgelände.',
      en: 'Spring festival Munich April 2024. Volksfest with beer & music. Airport taxi to venue.',
    },
    seoKeywords: {
      de: ['frühlingsfest', 'volksfest', 'münchen april', 'fest', 'flughafen transfer'],
      en: ['spring festival', 'volksfest', 'munich april', 'beer fest', 'airport transfer'],
    },
    ogImage: '🎉',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Frühlingsfest München',
      startDate: '2024-04-20',
      endDate: '2024-05-05',
      location: {
        '@type': 'Place',
        name: 'Theresienwiese',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Theresienwiese',
          addressLocality: 'Munich',
          postalCode: '80336',
          addressCountry: 'DE',
        },
      },
      image: '🎉',
      description: 'Frühlingsfest Volksfest',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/fruehlingsfest',
    },
    relatedEvents: ['starkbierfest', 'christkindlmarkt', 'oktoberfest'],
  },
  {
    id: 'csd',
    slug: 'csd',
    title: {
      de: 'Christopher Street Day München',
      en: 'Munich Christopher Street Day',
    },
    description: {
      de: 'Der Christopher Street Day München ist Münchens wichtigste LGBTQ+ Pride-Veranstaltung. Mit hundertausenden von Teilnehmer:innen feiert München Vielfalt, Toleranz und LGBTQ+-Rechte mit Paraden, Konzerten und Kulturveranstaltungen im Juni/Juli.',
      en: 'Munich Christopher Street Day is Munich\'s most important LGBTQ+ Pride event. With hundreds of thousands of participants, Munich celebrates diversity, tolerance and LGBTQ+ rights with parades, concerts and cultural events in June/July.',
    },
    shortDescription: {
      de: 'LGBTQ+ Pride Veranstaltung mit Parade und Konzerten',
      en: 'LGBTQ+ Pride event with parade and concerts',
    },
    dateRange: {
      start: '30.06.2024',
      end: '07.07.2024',
      month: 'Juni - Juli',
    },
    location: {
      de: 'Münchner Innenstadt (Marienplatz, Stachus)',
      en: 'Munich City Center (Marienplatz, Stachus)',
      address: 'Marienplatz / Stachus, München',
    },
    stats: {
      visitors: '250.000+',
      duration: '8 Tage',
      location: 'Münchner Innenstadt',
    },
    tips: [
      {
        de: 'Der CSD ist ein wichtiges Fest für LGBTQ+-Rechte - alle Orientierungen und Identitäten sind willkommen.',
        en: 'CSD is an important celebration of LGBTQ+ rights - all orientations and identities are welcome.',
      },
      {
        de: 'Die Pride Parade ist der Höhepunkt - reservieren Sie gute Platzierungen früh am Morgen oder buchen Sie einen Parade-Pass.',
        en: 'The Pride Parade is the highlight - reserve good spots early in the morning or book a parade pass.',
      },
      {
        de: 'Das Festival hat viele Konzerte, Reden und Kulturveranstaltungen über mehrere Tage - wählen Sie die Events, die Sie interessieren.',
        en: 'The festival has many concerts, speeches and cultural events over several days - choose the events that interest you.',
      },
      {
        de: 'Bunt und Festlich - viele Besucher:innen tragen bunte und ausdrucksstarke Kleidung und Dekoration.',
        en: 'Colorful and festive - many visitors wear colorful and expressive clothing and decorations.',
      },
    ],
    highlights: {
      de: [
        'Pride Parade durch die Stadt',
        'Konzerte von bekannten Künstler:innen',
        'LGBTQ+ Kulturveranstaltungen',
        'Reden und Diskussionen über Rechte',
        'Community Feiern und Networking',
      ],
      en: [
        'Pride Parade through the city',
        'Concerts by well-known artists',
        'LGBTQ+ cultural events',
        'Speeches and discussions about rights',
        'Community celebrations and networking',
      ],
    },
    highlights_description: {
      de: 'Der Christopher Street Day München feiert LGBTQ+-Rechte, Vielfalt und Toleranz mit der großen Pride Parade, Konzerten und Kulturveranstaltungen - ein wichtiges Fest für Münchens Vielfalt.',
      en: 'Munich Christopher Street Day celebrates LGBTQ+ rights, diversity and tolerance with the big Pride Parade, concerts and cultural events - an important celebration of Munich\'s diversity.',
    },
    website: 'https://www.csd-muenchen.de',
    category: 'festival',
    // SEO Fields
    seoTitle: {
      de: 'München CSD Pride 2024 | LGBTQ+ Festival | Taxi Service',
      en: 'Munich CSD Pride 2024 | LGBTQ+ Festival | Taxi Service',
    },
    seoDescription: {
      de: 'München CSD Pride Festival Juli 2024. LGBTQ+ Veranstaltung. Zuverlässiger Taxi-Transfer.',
      en: 'Munich CSD Pride Festival July 2024. LGBTQ+ event. Reliable taxi transfer service.',
    },
    seoKeywords: {
      de: ['csd münchen', 'pride', 'lgbtq', 'festival', 'münchen juli'],
      en: ['csd munich', 'pride festival', 'lgbtq event', 'munich july', 'festival'],
    },
    ogImage: '🏳️‍🌈',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Munich CSD Pride Festival',
      startDate: '2024-07-13',
      endDate: '2024-07-14',
      location: {
        '@type': 'Place',
        name: 'Marienplatz',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Marienplatz',
          addressLocality: 'Munich',
          postalCode: '80331',
          addressCountry: 'DE',
        },
      },
      image: '🏳️‍🌈',
      description: 'LGBTQ+ Pride Festival',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/csd',
    },
    relatedEvents: ['tollwood-sommer', 'opera-festival', 'fruehlingsfest'],
  },
  {
    id: 'bayern-football',
    slug: 'bayern-football',
    title: {
      de: 'FC Bayern München Heimspiele',
      en: 'FC Bayern Munich Home Matches',
    },
    description: {
      de: 'Die Heimspiele des FC Bayern München in der Allianz Arena sind Höhepunkte für Fußballfans. Mit hundertausenden Fans feiern die Besucher:innen Münchens erfolgreichsten Fußballclub in einem der schönsten Stadien Deutschlands.',
      en: 'FC Bayern Munich home matches at the Allianz Arena are highlights for football fans. With hundreds of thousands of fans, visitors celebrate Munich\'s most successful football club in one of Germany\'s most beautiful stadiums.',
    },
    shortDescription: {
      de: 'FC Bayern München Heimspiele in der Allianz Arena',
      en: 'FC Bayern Munich home matches in the Allianz Arena',
    },
    dateRange: {
      start: 'ganzjährig',
      end: 'ganzjährig',
      month: 'August - Mai',
    },
    location: {
      de: 'Allianz Arena',
      en: 'Allianz Arena',
      address: 'Werner-Heisenberg-Allee 25, 80939 München',
    },
    stats: {
      visitors: '75.000',
      duration: 'Saisonal',
      location: 'Allianz Arena',
    },
    tips: [
      {
        de: 'Bayern-Tickets sind sehr beliebt und oft schnell ausverkauft - buchen Sie weit im Voraus oder auf der offiziellen Webseite.',
        en: 'Bayern tickets are very popular and often sell out quickly - book well in advance or on the official website.',
      },
      {
        de: 'Die Allianz Arena hat eine einzigartige Atmosphäre mit knallig roten Sitzplätzen - ein Muss für Fußballfans.',
        en: 'The Allianz Arena has a unique atmosphere with bright red seats - a must for football fans.',
      },
      {
        de: 'Erreichbarkeit: Die U6 Bahn fahrt direkt zur Allianz Arena - perfekt um Parking zu vermeiden.',
        en: 'Accessibility: The U6 subway line goes directly to the Allianz Arena - perfect to avoid parking.',
      },
      {
        de: 'Das Stadion-Erlebnis ist ganzjährig möglich - wählen Sie ein Heimspiel während Ihrer Reise nach München.',
        en: 'The stadium experience is available year-round - choose a home match during your trip to Munich.',
      },
    ],
    highlights: {
      de: [
        'Weltklasse-Fußball',
        'Elektrisierende Stadionatmosphäre',
        'Hochwertige Fußball-Talente',
        'Europäische Champions-League Spiele',
        'Bayernfan-Kultur und Leidenschaft',
      ],
      en: [
        'World-class football',
        'Electrifying stadium atmosphere',
        'High-quality football talent',
        'European Champions League matches',
        'Bayern fan culture and passion',
      ],
    },
    highlights_description: {
      de: 'FC Bayern München Heimspiele bieten Weltklasse-Fußball und eine Elektrisierend Stadionatmosphäre in der beeindruckenden Allianz Arena - perfekt für Fußballfans.',
      en: 'FC Bayern Munich home matches offer world-class football and an electrifying stadium atmosphere in the impressive Allianz Arena - perfect for football fans.',
    },
    website: 'https://www.fcbayern.com',
    category: 'sports',
    // SEO Fields
    seoTitle: {
      de: 'FC Bayern München Spiele | Fußball | Allianz Arena Taxi',
      en: 'FC Bayern Munich Games | Football | Allianz Arena Taxi',
    },
    seoDescription: {
      de: 'Fußball Taxi zum FC Bayern München Spiel. Allianz Arena Transfer. Schnell & zuverlässig.',
      en: 'Football taxi to Bayern Munich games. Allianz Arena. Fast & reliable airport service.',
    },
    seoKeywords: {
      de: ['fc bayern', 'allianz arena', 'fußball', 'münchen spiele', 'stadium transfer'],
      en: ['fc bayern', 'allianz arena', 'football', 'soccer', 'stadium transfer'],
    },
    ogImage: '⚽',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'FC Bayern München Spiele',
      startDate: '2024-08-16',
      endDate: '2025-05-31',
      location: {
        '@type': 'Place',
        name: 'Allianz Arena',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Werner-Heynkes-Straße 10',
          addressLocality: 'Munich',
          postalCode: '80939',
          addressCountry: 'DE',
        },
      },
      image: '⚽',
      description: 'FC Bayern München Spiele',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/bayern-football',
    },
    relatedEvents: ['bmw-golf', 'ispo', 'munich-marathon'],
  },
  {
    id: 'bmw-golf',
    slug: 'bmw-golf',
    title: {
      de: 'BMW International Open Golfturnier',
      en: 'BMW International Open Golf Tournament',
    },
    description: {
      de: 'Das BMW International Open ist eines der wichtigsten Golfturniere Europas. Mit weltbekannten Golfprofis präsentiert das Turnier hochklassigen Golf im traditionsreichen Golfclub Münchens.',
      en: 'The BMW International Open is one of Europe\'s most important golf tournaments. With world-famous professional golfers, the tournament presents high-class golf at Munich\'s traditional golf club.',
    },
    shortDescription: {
      de: 'Europas wichtiges Golfturnier mit Weltklasse-Profis',
      en: 'Europe\'s important golf tournament with world-class professionals',
    },
    dateRange: {
      start: '20.06.2024',
      end: '23.06.2024',
      month: 'Juni',
    },
    location: {
      de: 'Golfclub München Eichenried',
      en: 'Munich Eichenried Golf Club',
      address: 'Eschenried 6, 85254 Sulzemoos',
    },
    stats: {
      visitors: '50.000+',
      duration: '4 Tage',
      location: 'Golfclub München Eichenried',
    },
    tips: [
      {
        de: 'Das BMW International Open ist ein prestigeträchtiges Turnier - Eintrittskarten sind beliebt und teilweise teuer.',
        en: 'The BMW International Open is a prestigious tournament - admission tickets are popular and sometimes expensive.',
      },
      {
        de: 'Das Turnier findet auf dem traditionsreichen Golfclub München Eichenried statt - ein wunderschönes Setting.',
        en: 'The tournament takes place at the prestigious Munich Eichenried Golf Club - a beautiful setting.',
      },
      {
        de: 'Die besten Golfer Europas treten an - großartig um Weltklasse-Golf zu sehen.',
        en: 'Europe\'s best golfers compete - great to see world-class golf.',
      },
      {
        de: 'Buchen Sie einen Mietwagen oder Taxi zum Golfclub - er ist etwas außerhalb Münchens.',
        en: 'Book a rental car or taxi to the golf club - it\'s a bit outside Munich.',
      },
    ],
    highlights: {
      de: [
        'Weltklasse-Golfer und Profis',
        'Hohe Turnierstandards und Prestige',
        'Schöne Golfplatz-Landschaft',
        'Europäische Golf-Elite',
        'Hochwertige Sportveranstaltung',
      ],
      en: [
        'World-class golfers and professionals',
        'High tournament standards and prestige',
        'Beautiful golf course landscape',
        'European golf elite',
        'High-quality sports event',
      ],
    },
    highlights_description: {
      de: 'Das BMW International Open zeigt Weltklasse-Golf mit den besten Europäischen Profis auf einem traditionsreichen und wunderschönen Golfplatz.',
      en: 'The BMW International Open showcases world-class golf with Europe\'s best professionals on a prestigious and beautiful golf course.',
    },
    website: 'https://www.bmw-international-open.de',
    category: 'sports',
    // SEO Fields
    seoTitle: {
      de: 'BMW Golf Tournament München | Golfturnier | Taxi Service',
      en: 'BMW Golf Tournament Munich | Golf Event | Taxi Service',
    },
    seoDescription: {
      de: 'Golf-Tournament München. Flughafen zum Golfplatz Taxi. BMW Event Juni 2024.',
      en: 'Golf tournament Munich. Airport to golf course taxi. BMW event June 2024.',
    },
    seoKeywords: {
      de: ['golf tournament', 'bmw golf', 'münchen golf', 'golfplatz', 'airport transfer'],
      en: ['golf tournament', 'bmw golf', 'munich golf', 'golf course', 'airport taxi'],
    },
    ogImage: '⛳',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'BMW International Open Golf Tournament',
      startDate: '2024-06-20',
      endDate: '2024-06-23',
      location: {
        '@type': 'Place',
        name: 'Golfclub München Nord-Eichenried',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Eichenried 1',
          addressLocality: 'Munich',
          postalCode: '80639',
          addressCountry: 'DE',
        },
      },
      image: '⛳',
      description: 'BMW International Open Golf Tournament',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/bmw-golf',
    },
    relatedEvents: ['ispo', 'bayern-football', 'iaa'],
  },
  {
    id: 'munich-marathon',
    slug: 'munich-marathon',
    title: {
      de: 'München Marathon',
      en: 'Munich Marathon',
    },
    description: {
      de: 'Der München Marathon ist einer der größten Marathons in Deutschland mit über 18.000 Teilnehmer:innen. Der Marathon führt durch Münchens schönste Gegenden und ist ein großes Sportereignis für Lauf-Enthusiasten.',
      en: 'The Munich Marathon is one of Germany\'s largest marathons with over 18,000 participants. The marathon takes runners through Munich\'s most beautiful areas and is a major sporting event for running enthusiasts.',
    },
    shortDescription: {
      de: 'Großer Marathon durch Münchens Sehenswürdigkeiten',
      en: 'Large marathon through Munich\'s landmarks',
    },
    dateRange: {
      start: '13.10.2024',
      end: '13.10.2024',
      month: 'Oktober',
    },
    location: {
      de: 'Münchner Innenstadt Start/Ziel',
      en: 'Munich City Center Start/Finish',
      address: 'Theresienwiese, München',
    },
    stats: {
      visitors: '18.000+',
      duration: '1 Tag',
      location: 'Münchner Innenstadt',
    },
    tips: [
      {
        de: 'Der Marathon ist beliebt und Plätze sind oft ausverkauft - melden Sie sich früh an wenn Sie teilnehmen möchten.',
        en: 'The marathon is popular and spots often sell out - register early if you want to participate.',
      },
      {
        de: 'Die Strecke führt durch wunderschöne Gegenden Münchens - perfekt zum Anfeuern und Fotografieren für Zuschauer.',
        en: 'The route runs through beautiful areas of Munich - perfect for cheering and photographing for spectators.',
      },
      {
        de: 'Der Oktober-Termin ist ideal für Laufen - angenehme Temperaturen ohne zu große Hitze.',
        en: 'The October date is ideal for running - pleasant temperatures without excessive heat.',
      },
      {
        de: 'Viele Verpflegungsstationen und Unterstützung entlang der Strecke - großartig organisiert.',
        en: 'Many food stations and support along the route - well organized.',
      },
    ],
    highlights: {
      de: [
        'Lange Laufstrecke durch München',
        'Schöne Landschaften und Sehenswürdigkeiten',
        'Große Running Community',
        'Professionelle Organisation',
        'Sportereignis mit großem Publikum',
      ],
      en: [
        'Long running route through Munich',
        'Beautiful landscapes and landmarks',
        'Large running community',
        'Professional organization',
        'Sports event with large audience',
      ],
    },
    highlights_description: {
      de: 'Der München Marathon ist ein großartiges Sportereignis für Läufer mit einer wunderschönen Strecke durch Münchens Sehenswürdigkeiten und die Community-Unterstützung.',
      en: 'The Munich Marathon is a great sporting event for runners with a beautiful route through Munich\'s landmarks and community support.',
    },
    website: 'https://www.muenchen-marathon.de',
    category: 'sports',
    // SEO Fields
    seoTitle: {
      de: 'München Marathon 2024 | Lauf-Event | Taxi-Service',
      en: 'Munich Marathon 2024 | Running Event | Taxi Service',
    },
    seoDescription: {
      de: 'München Marathon Oktober 2024. Lauf-Event mit Zuverlässiger Taxi Flughafen Transfer.',
      en: 'Munich marathon October 2024. Running event. Reliable airport taxi transfer service.',
    },
    seoKeywords: {
      de: ['münchen marathon', 'lauf', 'sport event', 'marathon', 'oktober'],
      en: ['munich marathon', 'running', 'sport event', 'marathon', 'october'],
    },
    ogImage: '🏃',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'München Marathon',
      startDate: '2024-10-13',
      endDate: '2024-10-13',
      location: {
        '@type': 'Place',
        name: 'Münchner Innenstadt',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Theresienwiese',
          addressLocality: 'Munich',
          postalCode: '80336',
          addressCountry: 'DE',
        },
      },
      image: '🏃',
      description: 'München Marathon Lauf-Event',
      organizer: {
        '@type': 'Organization',
        name: 'flughafen-muenchen.taxi',
        url: 'https://flughafen-muenchen.taxi',
      },
      url: 'https://flughafen-muenchen.taxi/de/events/munich-marathon',
    },
    relatedEvents: ['ispo', 'bayern-football', 'bmw-golf'],
  },
];
