'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  MapPin, Clock, ArrowRight, Baby, Tag, Plane, CalendarDays, CalendarCheck, UsersRound, UserRound, Pencil,
  ChevronRight, ShieldCheck, CircleCheck, ArrowLeftRight, BriefcaseBusiness, Info, CarFront, Headphones, X,
} from 'lucide-react';
import { formatPrice, cn, calculateToll, extractCountryFromAddress, addressIcon } from '@/lib/utils';
import SocialProofToast from '@/components/SocialProofToast';
import SearchBar, { DateTimeField } from '@/components/SearchBar';
import Countdown from '@/components/discount/Countdown';
import { PublicAutoDiscount, formatDiscountValue, pickDiscountLabel, formatRemainingSpots } from '@/components/discount/format';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

// Pflichtfahrgebiet (mandatory tariff zone) types + helpers
interface PgConfig {
  enabled: number; mode: string; radius_km: number;
  airport_enabled: number; airport_lat: number; airport_lng: number;
  betriebssitz_enabled: number; betriebssitz_lat: number; betriebssitz_lng: number;
}
interface PgTarif { vehicle_type: string; grundgebuehr: number; min_per_km: number; }

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function pgPointInZone(p: { lat: number; lng: number } | null, cfg: PgConfig): boolean {
  if (!p) return false;
  const r = cfg.radius_km > 0 ? cfg.radius_km : 50;
  if (cfg.airport_enabled && haversineKm(p.lat, p.lng, cfg.airport_lat, cfg.airport_lng) <= r) return true;
  if (cfg.betriebssitz_enabled && haversineKm(p.lat, p.lng, cfg.betriebssitz_lat, cfg.betriebssitz_lng) <= r) return true;
  return false;
}

const VEHICLES = [
  {
    type: 'kombi' as const,
    image: '/images/kombi.webp',
    nameDE: 'Kombi', nameEN: 'Sedan', nameTR: 'Kombi',
    descDE: 'Ideal für Einzelreisende & Paare',
    descEN: 'Ideal for solo travelers & couples',
    descTR: 'Bireysel yolcular ve çiftler için ideal',
    maxPassengers: 3,
    maxLuggage: 3,
    badge: null,
    features: ['Klimaanlage'],
    color: 'border-gray-200',
  },
  {
    type: 'van' as const,
    image: '/images/van.webp',
    nameDE: 'Van / Minibus', nameEN: 'Van / Minibus', nameTR: 'Van / Minibüs',
    descDE: 'Perfekt für Familien & Gruppen',
    descEN: 'Perfect for families & groups',
    descTR: 'Aileler ve gruplar için mükemmel',
    maxPassengers: 7,
    maxLuggage: 7,
    badge: 'BELIEBT',
    features: ['Klimaanlage'],
    color: 'border-primary-400',
  },
  {
    type: 'grossraumtaxi' as const,
    image: '/images/grossraumtaxi.webp',
    nameDE: 'Großraumtaxi', nameEN: 'Large Taxi', nameTR: 'Büyük Taksi',
    descDE: 'Für große Gruppen mit viel Gepäck',
    descEN: 'For large groups with lots of luggage',
    descTR: 'Çok bavullu büyük gruplar için',
    maxPassengers: 8,
    maxLuggage: 10,
    badge: null,
    features: ['Klimaanlage', 'Max. Kapazität'],
    color: 'border-gray-200',
  },
];

type TagKey = 'ac' | 'fixed' | 'storno' | 'childseat' | 'space' | 'capacity';

const VEHICLE_TAGS: Record<(typeof VEHICLES)[number]['type'], TagKey[]> = {
  kombi: ['ac', 'fixed', 'storno', 'childseat'],
  van: ['ac', 'space', 'fixed', 'childseat'],
  grossraumtaxi: ['ac', 'capacity', 'fixed', 'storno'],
};

type DesignText = {
  eyebrow: string; titleA: string; titleB: string; subtitle: string;
  pickup: string; dropoff: string; person: string; persons: string; change: string; closeEdit: string; editTitle: string;
  upTo: string; approx: string; journey: string;
  tags: Record<TagKey, string>;
  trustTop: { title: string; text: string }[];
  trustBottom: { title: string; text: string }[];
};

const DESIGN: Record<'de' | 'en' | 'tr', DesignText> = {
  de: {
    eyebrow: 'Ihre Buchung', titleA: 'Fahrzeug', titleB: 'wählen',
    subtitle: 'Alle Preise sind Festpreise inkl. Maut & Gepäck – keine versteckten Kosten.',
    pickup: 'Abholung', dropoff: 'Ziel', person: 'Person', persons: 'Personen', change: 'Suche ändern', closeEdit: 'Schließen', editTitle: 'Suche bearbeiten',
    upTo: 'Bis zu', approx: 'ca.', journey: 'Fahrtzeit',
    tags: { ac: 'Klimaanlage', fixed: 'Festpreis', storno: 'Kostenloser Storno bis 3 Std.', childseat: 'Kindersitz kostenlos', space: 'Viel Platz', capacity: 'Max. Kapazität' },
    trustTop: [
      { title: 'Festpreisgarantie', text: 'Keine versteckten Kosten' },
      { title: 'Kindersitz kostenlos', text: 'Auf Anfrage' },
      { title: 'Sofortbestätigung', text: 'Direkt per E-Mail' },
      { title: 'Kostenlose Stornierung', text: 'Bis 3 Stunden vorher' },
    ],
    trustBottom: [
      { title: 'Sicher & zuverlässig', text: 'Ihr Transfer in besten Händen' },
      { title: 'Moderne Fahrzeuge', text: 'Komfortabel & klimatisiert' },
      { title: 'Pünktlich am Ziel', text: 'Wir überwachen Ihren Flug' },
      { title: 'Persönlicher Service', text: 'Wir sind 24/7 für Sie da' },
    ],
  },
  en: {
    eyebrow: 'Your booking', titleA: 'Choose your', titleB: 'vehicle',
    subtitle: 'All prices are fixed rates incl. tolls & luggage – no hidden costs.',
    pickup: 'Pickup', dropoff: 'Destination', person: 'Passenger', persons: 'Passengers', change: 'Change search', closeEdit: 'Close', editTitle: 'Edit search',
    upTo: 'Up to', approx: 'approx.', journey: 'Journey time',
    tags: { ac: 'Air conditioning', fixed: 'Fixed price', storno: 'Free cancellation up to 3 hrs', childseat: 'Free child seat', space: 'Lots of space', capacity: 'Max. capacity' },
    trustTop: [
      { title: 'Fixed price guarantee', text: 'No hidden costs' },
      { title: 'Free child seat', text: 'On request' },
      { title: 'Instant confirmation', text: 'Directly by email' },
      { title: 'Free cancellation', text: 'Up to 3 hours before' },
    ],
    trustBottom: [
      { title: 'Safe & reliable', text: 'Your transfer in the best hands' },
      { title: 'Modern vehicles', text: 'Comfortable & air-conditioned' },
      { title: 'On time', text: 'We monitor your flight' },
      { title: 'Personal service', text: 'We are here for you 24/7' },
    ],
  },
  tr: {
    eyebrow: 'Rezervasyonunuz', titleA: 'Araç', titleB: 'seçin',
    subtitle: 'Tüm fiyatlar otoyol ve bagaj dahil sabit fiyatlardır – gizli maliyet yok.',
    pickup: 'Alış', dropoff: 'Varış', person: 'Kişi', persons: 'Kişi', change: 'Aramayı değiştir', closeEdit: 'Kapat', editTitle: 'Aramayı düzenle',
    upTo: 'En fazla', approx: 'yakl.', journey: 'Yolculuk süresi',
    tags: { ac: 'Klima', fixed: 'Sabit fiyat', storno: '3 saate kadar ücretsiz iptal', childseat: 'Ücretsiz çocuk koltuğu', space: 'Geniş alan', capacity: 'Maks. kapasite' },
    trustTop: [
      { title: 'Sabit fiyat garantisi', text: 'Gizli maliyet yok' },
      { title: 'Ücretsiz çocuk koltuğu', text: 'Talep üzerine' },
      { title: 'Anında onay', text: 'Doğrudan e-posta ile' },
      { title: 'Ücretsiz iptal', text: '3 saat öncesine kadar' },
    ],
    trustBottom: [
      { title: 'Güvenli & güvenilir', text: 'Transferiniz emin ellerde' },
      { title: 'Modern araçlar', text: 'Konforlu & klimalı' },
      { title: 'Zamanında varış', text: 'Uçuşunuzu takip ediyoruz' },
      { title: 'Kişisel hizmet', text: '7/24 yanınızdayız' },
    ],
  },
};

interface PriceData {
  base_price: number;
  price_per_km: number;
  roundtrip_discount: number;
  min_price: number;
  min_price_km: number;
  max_passengers?: number;
  max_luggage?: number;
}

function ResultsContent() {
  const params = useSearchParams();
  const locale = useLocale();
  const router = useRouter();

  const pickup = params.get('pickup') || '';
  const dropoff = params.get('dropoff') || '';
  const date = params.get('date') || '';
  const time = params.get('time') || '';
  const passengers = Number(params.get('passengers') || 1);
  const distanceKm = Number(params.get('distance_km') || 0);
  const duration = Number(params.get('duration') || 0);
  const tripType = params.get('trip_type') || 'oneway';
  const returnDate = params.get('return_date') || '';
  const returnTime = params.get('return_time') || '';
  const isRoundtrip = tripType === 'roundtrip';

  // Anfahrtskosten
  const anfahrtKm = Number(params.get('anfahrt_km') || 0);
  const [anfahrtPricePerKm, setAnfahrtPricePerKm] = useState(1.70);
  const anfahrtCost = anfahrtKm > 0 ? anfahrtKm * anfahrtPricePerKm : 0;

  // PLZ surcharge
  const [plzSurcharge, setPlzSurcharge] = useState(0);

  // Maut — component seviyesinde, tüm araçlar için ortak (varış ülkesine bağlı)
  const onewayToll = calculateToll(extractCountryFromAddress(dropoff), dropoff);

  // Airport transfer filter — redirect if neither address is airport area (unless stadtfahrt enabled)
  const isAirportArea = (addr: string) => {
    const lower = addr.toLowerCase();
    return ['flughafen münchen', 'munich airport', 'münchen-flughafen', 'munchen-flughafen', '85356', 'oberding', 'hallbergmoos', 'freising'].some(kw => lower.includes(kw));
  };
  const [stadtfahrtEnabled, setStadtfahrtEnabled] = useState(false);
  const [zwischenstoppEnabled, setZwischenstoppEnabled] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  useEffect(() => {
    fetch(`${API_URL}/settings`).then(r => r.json()).then(s => {
      if (s.stadtfahrt_enabled === '1') setStadtfahrtEnabled(true);
      if (s.anfahrt_price_per_km) setAnfahrtPricePerKm(parseFloat(s.anfahrt_price_per_km));
      if (s.zwischenstopp_enabled === '1') setZwischenstoppEnabled(true);

      if (s.plz_surcharge_enabled === '1') {
        const plzMatch = pickup?.match(/\b(\d{5})\b/);
        if (plzMatch) {
          fetch(`${API_URL}/plz-surcharges`).then(r => r.json()).then((rows: { plz: string; surcharge: number }[]) => {
            const match = rows.find(r => r.plz === plzMatch[1]);
            if (match) setPlzSurcharge(match.surcharge);
          }).catch(() => {});
        }
      }
    }).catch(() => {}).finally(() => setSettingsLoaded(true));
  }, []);
  useEffect(() => {
    if (!settingsLoaded) return;
    if (pickup && dropoff && !isAirportArea(pickup) && !isAirportArea(dropoff) && !stadtfahrtEnabled) {
      router.replace(`/${locale}`);
    }
  }, [pickup, dropoff, locale, router, stadtfahrtEnabled, settingsLoaded]);

  // Inline-Suche bearbeiten: statt zurück zur Startseite wird die Suchleiste
  // direkt auf dieser Seite aufgeklappt; das Ergebnis aktualisiert nur die URL.
  const [showSearchEdit, setShowSearchEdit] = useState(false);

  // Return trip picker state
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [localReturnDate, setLocalReturnDate] = useState('');
  const [localReturnTime, setLocalReturnTime] = useState('10:00');

  function addReturnTrip() {
    if (!localReturnDate) return;
    const sp = new URLSearchParams(params.toString());
    sp.set('trip_type', 'roundtrip');
    sp.set('return_date', localReturnDate);
    sp.set('return_time', localReturnTime);
    router.replace(`?${sp.toString()}`);
    setShowReturnPicker(false);
  }

  function removeReturnTrip() {
    const sp = new URLSearchParams(params.toString());
    sp.set('trip_type', 'oneway');
    sp.delete('return_date');
    sp.delete('return_time');
    router.replace(`?${sp.toString()}`);
  }

  // Zwischenstopp state
  const zwischenstoppAddress = params.get('zwischenstopp_address') || '';
  const [showZwischenstoppPicker, setShowZwischenstoppPicker] = useState(false);
  const [zwischenstoppInput, setZwischenstoppInput] = useState('');
  const [zwischenstoppSuggestions, setZwischenstoppSuggestions] = useState<any[]>([]);
  const [zwischenstoppLoading, setZwischenstoppLoading] = useState(false);
  // Store original distance for when zwischenstopp is removed
  const originalDistanceKm = Number(params.get('original_distance_km') || 0);
  const originalDuration = Number(params.get('original_duration') || 0);

  // Autocomplete for zwischenstopp
  useEffect(() => {
    if (zwischenstoppInput.length < 3) { setZwischenstoppSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`${API_URL}/maps/autocomplete?input=${encodeURIComponent(zwischenstoppInput)}&language=${locale}`);
        const data = await r.json();
        setZwischenstoppSuggestions(data.predictions || []);
      } catch { setZwischenstoppSuggestions([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [zwischenstoppInput, locale]);

  async function addZwischenstopp(address: string) {
    setZwischenstoppLoading(true);
    try {
      const r = await fetch(`${API_URL}/maps/distance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: pickup, destination: dropoff, zwischenstopp: address, language: locale }),
      });
      const data = await r.json();
      if (data.zwischenstopp_total_km) {
        const sp = new URLSearchParams(params.toString());
        sp.set('zwischenstopp_address', address);
        // Save original distance if not already saved
        if (!sp.get('original_distance_km')) {
          sp.set('original_distance_km', String(distanceKm));
          sp.set('original_duration', String(duration));
        }
        sp.set('distance_km', String(data.zwischenstopp_total_km));
        sp.set('duration', String(data.zwischenstopp_total_duration));
        router.replace(`?${sp.toString()}`);
      }
    } catch (e) {
      console.error('Zwischenstopp distance calc failed:', e);
    } finally {
      setZwischenstoppLoading(false);
      setShowZwischenstoppPicker(false);
      setZwischenstoppInput('');
      setZwischenstoppSuggestions([]);
    }
  }

  function removeZwischenstopp() {
    const sp = new URLSearchParams(params.toString());
    sp.delete('zwischenstopp_address');
    if (originalDistanceKm > 0) {
      sp.set('distance_km', String(originalDistanceKm));
      sp.set('duration', String(originalDuration));
    }
    sp.delete('original_distance_km');
    sp.delete('original_duration');
    router.replace(`?${sp.toString()}`);
  }

  // Fetch prices from API
  // Automatische Rabatte (Rabatte-Tab) — Vorschau vom Server je Fahrzeug (Regeln können auf Fahrzeuge beschränkt sein)
  const [autoDiscounts, setAutoDiscounts] = useState<Record<string, PublicAutoDiscount | null>>({});
  const [discountRefresh, setDiscountRefresh] = useState(0); // Countdown abgelaufen → neu laden
  useEffect(() => {
    if (!distanceKm || distanceKm <= 0) { setAutoDiscounts({}); return; }
    const visitorId = typeof localStorage !== 'undefined' ? localStorage.getItem('mt_visitor_id') : null;
    Promise.all(VEHICLES.map(v =>
      fetch(`${API_URL}/bookings/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_type: v.type,
          distance_km: distanceKm,
          pickup_address: pickup, dropoff_address: dropoff,
          visitor_id: visitorId,
          pickup_datetime: date && time ? `${date}T${time}` : undefined,
          trip_type: tripType,
        }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => [v.type, (d?.auto_discount as PublicAutoDiscount) || null] as const)
        .catch(() => [v.type, null] as const)
    )).then(entries => setAutoDiscounts(Object.fromEntries(entries)));
  }, [distanceKm, pickup, dropoff, date, time, tripType, discountRefresh]);

  const [apiPrices, setApiPrices] = useState<Record<string, PriceData> | null>(null);
  useEffect(() => {
    fetch(`${API_URL}/prices`)
      .then(r => r.json())
      .then((data: PriceData[]) => {
        const map: Record<string, PriceData> = {};
        data.forEach((p: any) => { map[p.vehicle_type] = p; });
        setApiPrices(map);
      })
      .catch(() => {
        // Fallback to hardcoded
        setApiPrices({
          kombi: { base_price: 8, price_per_km: 2.1, roundtrip_discount: 5, min_price: 0, min_price_km: 15 },
          van: { base_price: 10, price_per_km: 2.2, roundtrip_discount: 5, min_price: 0, min_price_km: 15 },
          grossraumtaxi: { base_price: 15, price_per_km: 2.4, roundtrip_discount: 5, min_price: 0, min_price_km: 15 },
        });
      });
  }, []);

  // Fixed-price routes (Festpreisrouten) — highest priority, overrides all other pricing
  interface FixedRoute {
    id: number; name: string; pickup_keywords: string; dropoff_keywords: string;
    price_kombi: number; price_van: number; price_grossraumtaxi: number;
    bidirectional: number; enabled: number;
  }
  const [fixedRoutes, setFixedRoutes] = useState<FixedRoute[]>([]);
  useEffect(() => {
    fetch(`${API_URL}/fixed-routes`).then(r => r.json()).then(setFixedRoutes).catch(() => {});
  }, []);
  const matchFixedRoute = (p: string, d: string): FixedRoute | null => {
    // Comma-separated groups are OR'd; within a group, '+' joins terms that must
    // ALL be present (AND) — mirrors backend/src/routes/fixed-routes.ts matchesKeywords.
    const matchKw = (addr: string, kws: string) => {
      if (!addr || !kws) return false;
      const lower = addr.toLowerCase();
      return kws.split(',').some(group => {
        const terms = group.split('+').map(t => t.trim().toLowerCase()).filter(Boolean);
        return terms.length > 0 && terms.every(term => lower.includes(term));
      });
    };
    for (const r of fixedRoutes) {
      if (!r.enabled) continue;
      if (matchKw(p, r.pickup_keywords) && matchKw(d, r.dropoff_keywords)) return r;
      if (r.bidirectional && matchKw(p, r.dropoff_keywords) && matchKw(d, r.pickup_keywords)) return r;
    }
    return null;
  };
  const fixedRouteMatch = matchFixedRoute(pickup, dropoff);

  // Pflichtfahrgebiet config + tariffs + exclusions
  const [pgConfig, setPgConfig] = useState<PgConfig | null>(null);
  const [pgTarife, setPgTarife] = useState<PgTarif[]>([]);
  const [pgExclusions, setPgExclusions] = useState<string[]>([]);
  const [ipBypass, setIpBypass] = useState(false);
  const [pgConfigLoaded, setPgConfigLoaded] = useState(false);
  const [pgCoordsLoaded, setPgCoordsLoaded] = useState(false);
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/pflichtgebiet`)
        .then(r => r.json())
        .then((d: { config: PgConfig | null; tarife: PgTarif[] }) => { setPgConfig(d.config); setPgTarife(d.tarife || []); })
        .catch(() => {}),
      fetch(`${API_URL}/pflichtgebiet/exclusions`)
        .then(r => r.json())
        .then((rows: { plz: string }[]) => setPgExclusions(rows.map(r => r.plz)))
        .catch(() => {}),
      fetch(`${API_URL}/pflichtgebiet/ip-check`)
        .then(r => r.json())
        .then(d => { if (d.bypass === true) setIpBypass(true); })
        .catch(() => {}),
    ]).finally(() => setPgConfigLoaded(true));
  }, []);

  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    setPgCoordsLoaded(false);
    if (!pgConfigLoaded) return;
    if (!pgConfig || !pgConfig.enabled) { setPgCoordsLoaded(true); return; }
    let cancelled = false;
    let pending = 2;
    const done = () => { if (--pending === 0 && !cancelled) setPgCoordsLoaded(true); };
    const geo = async (addr: string, set: (c: { lat: number; lng: number } | null) => void) => {
      if (!addr) { set(null); done(); return; }
      try {
        const r = await fetch(`${API_URL}/maps/geocode?address=${encodeURIComponent(addr)}`);
        if (!r.ok) { if (!cancelled) set(null); done(); return; }
        const c = await r.json();
        if (!cancelled && typeof c.lat === 'number') set({ lat: c.lat, lng: c.lng });
        else if (!cancelled) set(null);
      } catch { if (!cancelled) set(null); }
      done();
    };
    geo(pickup, setPickupCoords);
    geo(dropoff, setDropoffCoords);
    return () => { cancelled = true; };
  }, [pgConfigLoaded, pgConfig, pickup, dropoff]);

  // Both endpoints must be inside the zone AND the road distance must not exceed
  // the radius. Haversine can be shorter than road distance (mountains, lakes,
  // detours), so trips with road distance > radius_km use free pricing.
  const pgRadius = pgConfig?.radius_km ?? 50;
  const pickupPlz = pickup.match(/\b(\d{5})\b/)?.[1];
  const dropoffPlz = dropoff.match(/\b(\d{5})\b/)?.[1];
  const pgPlzExcluded = pgExclusions.includes(pickupPlz || '') || pgExclusions.includes(dropoffPlz || '');
  const pgInZone = !ipBypass && !pgPlzExcluded && !!(pgConfig && pgConfig.enabled && distanceKm <= pgRadius && (
    (pgPointInZone(pickupCoords, pgConfig) || (pgConfig.airport_enabled === 1 && isAirportArea(pickup))) &&
    (pgPointInZone(dropoffCoords, pgConfig) || (pgConfig.airport_enabled === 1 && isAirportArea(dropoff)))
  ));

  const dateFormatted = date
    ? new Date(date + 'T00:00:00').toLocaleDateString(
        locale === 'en' ? 'en-GB' : locale === 'tr' ? 'tr-TR' : 'de-DE',
        { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }
      )
    : '';

  const texts: Record<string, Record<string, string>> = {
    de: { title: 'Fahrzeug wählen', subtitle: 'Alle Preise sind Festpreise inkl. Maut & Gepäck', book: 'Dieses Fahrzeug buchen', notSuitable: 'Nicht geeignet für', passengers_label: 'Person', duration_label: 'Min. Fahrtzeit', back: '← Suche ändern', total: 'Gesamtpreis', oneway_price: 'Einfache Fahrt', roundtrip_price: 'Hin- & Rückfahrt', discount: 'Rabatt', fixed: 'Festpreis garantiert', badge_popular: 'BELIEBT', persons: 'Passagiere', luggage: 'Gepäckstücke' },
    en: { title: 'Choose your vehicle', subtitle: 'All prices are fixed rates incl. tolls & luggage', book: 'Book this vehicle', notSuitable: 'Not suitable for', passengers_label: 'Person', duration_label: 'min. journey', back: '← Change search', total: 'Total price', oneway_price: 'One way', roundtrip_price: 'Round trip', discount: 'Discount', fixed: 'Fixed price guaranteed', badge_popular: 'POPULAR', persons: 'Passengers', luggage: 'Pieces of luggage' },
    tr: { title: 'Araç seçin', subtitle: 'Tüm fiyatlar otoyol ve bagaj dahil sabit fiyatlardır', book: 'Bu aracı rezerve et', notSuitable: 'Uygun değil:', passengers_label: 'Kişi', duration_label: 'dk. yolculuk', back: '← Aramayı değiştir', total: 'Toplam fiyat', oneway_price: 'Tek yön', roundtrip_price: 'Gidiş-Dönüş', discount: 'İndirim', fixed: 'Sabit fiyat garantili', badge_popular: 'POPÜLER', persons: 'Yolcu', luggage: 'Bagaj' },
  };
  const t = texts[locale] || texts.de;

  function getVehicleName(v: typeof VEHICLES[0]) {
    return locale === 'en' ? v.nameEN : locale === 'tr' ? v.nameTR : v.nameDE;
  }
  function getVehicleDesc(v: typeof VEHICLES[0]) {
    return locale === 'en' ? v.descEN : locale === 'tr' ? v.descTR : v.descDE;
  }

  function handleBook(vehicleType: string, finalPrice: number) {
    const bp = new URLSearchParams({
      pickup, dropoff, date, time,
      passengers: String(passengers),
      distance_km: String(distanceKm),
      duration: String(duration),
      vehicle: vehicleType,
      price: finalPrice.toFixed(2),
      trip_type: tripType,
    });
    if (pickupCoords) { bp.set('pickup_lat', String(pickupCoords.lat)); bp.set('pickup_lng', String(pickupCoords.lng)); }
    if (dropoffCoords) { bp.set('dropoff_lat', String(dropoffCoords.lat)); bp.set('dropoff_lng', String(dropoffCoords.lng)); }
    if (isRoundtrip && returnDate) {
      bp.set('return_date', returnDate);
      bp.set('return_time', returnTime);
    }
    if (anfahrtKm > 0) {
      bp.set('anfahrt_km', String(anfahrtKm));
      bp.set('anfahrt_cost', anfahrtCost.toFixed(2));
    }
    if (onewayToll > 0) {
      bp.set('toll_amount', onewayToll.toFixed(2));
    }
    if (zwischenstoppAddress) {
      bp.set('zwischenstopp_address', zwischenstoppAddress);
    }
    const prefix = locale === 'de' ? '' : `/${locale}`;
    router.push(`${prefix}/buchen?${bp.toString()}`);
  }

  if (!apiPrices || !pgCoordsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const dz = DESIGN[locale as 'de' | 'en' | 'tr'] || DESIGN.de;

  return (
    <div className="min-h-screen" style={{ background: '#f4f7fb' }}>
      {/* Hero — koyu lacivert zemin, sağda havalimanı fotoğrafı (kule + uçak) sola doğru laciverte soluyor */}
      <section className="relative overflow-hidden text-white" style={{ background: '#0f1b2d' }}>
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full md:w-[72%]">
            <img src="/images/hero-airport.webp" alt="" width={1774} height={887} className="w-full h-full object-cover" style={{ objectPosition: '82% 18%' }} />
            <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(to right, #0f1b2d 0%, rgba(15,27,45,.82) 22%, rgba(15,27,45,.35) 55%, rgba(15,27,45,.08) 100%)' }} />
            <div className="absolute inset-0 md:hidden" style={{ background: 'linear-gradient(to right, rgba(15,27,45,.92) 0%, rgba(15,27,45,.75) 60%, rgba(15,27,45,.55) 100%)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(15,27,45,.85) 0%, rgba(15,27,45,0) 45%)' }} />
          </div>
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20 md:pt-10 md:pb-24">
          <p className="text-xs md:text-sm font-bold tracking-[.2em] uppercase text-white/90">{dz.eyebrow}</p>
          <h1 className="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            {dz.titleA} <span className="text-gold-400">{dz.titleB}</span>
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/90">{dz.subtitle}</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        {/* Search summary card — overlaps the hero */}
        <div className="relative z-10 -mt-12 md:-mt-14 bg-white rounded-2xl border border-gray-100 shadow-[0_12px_32px_rgba(15,27,45,.10)] px-4 py-4 md:px-6 md:py-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 lg:flex lg:items-center lg:gap-0">
            <div className="col-span-2 sm:col-span-1 flex items-center gap-3 min-w-0 lg:flex-1 lg:pr-4">
              <MapPin size={22} className="shrink-0 text-gold-500" fill="#f6c644" stroke="#b7860b" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500">{dz.pickup}</div>
                <div className="text-sm font-bold text-gray-900 truncate">{addressIcon(pickup)}{pickup}</div>
              </div>
              <ChevronRight size={16} className="hidden lg:block shrink-0 text-gray-400" />
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-center gap-3 min-w-0 lg:flex-1 lg:px-4">
              <Plane size={22} className="shrink-0 text-gray-900" />
              <div className="min-w-0">
                <div className="text-xs text-gray-500">{dz.dropoff}</div>
                <div className="text-sm font-bold text-gray-900 truncate">{dropoff}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-0 lg:flex-none lg:px-5 lg:border-l lg:border-gray-200 lg:whitespace-nowrap">
              <CalendarDays size={22} className="shrink-0 text-gray-900" />
              <div className="min-w-0 text-sm text-gray-900 leading-snug">
                <div className="truncate lg:overflow-visible">{dateFormatted}</div>
                <div>{time}{isRoundtrip && <span className="ml-1.5 text-xs font-semibold text-gold-600">⇄ {t.roundtrip_price}</span>}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 min-w-0 lg:flex-none lg:px-5 lg:border-l lg:border-gray-200 lg:whitespace-nowrap">
              <UsersRound size={22} className="shrink-0 text-gray-900" />
              <div className="min-w-0 text-sm text-gray-900 leading-snug">
                <div>{passengers} {passengers === 1 ? dz.person : dz.persons}</div>
                <div className="text-gray-600">{distanceKm.toFixed(1).replace('.', locale === 'en' ? '.' : ',')} km · {duration} Min.</div>
              </div>
            </div>
            <button
              onClick={() => setShowSearchEdit(v => !v)}
              aria-expanded={showSearchEdit}
              className="col-span-2 lg:ml-2 flex items-center justify-center gap-2 bg-gold-400 hover:bg-[#f0b92b] text-primary-800 font-bold text-sm px-5 py-3 rounded-xl transition-colors shrink-0"
            >
              {showSearchEdit ? <><X size={16} /> {dz.closeEdit}</> : <><Pencil size={16} /> {dz.change}</>}
            </button>
          </div>
        </div>

        {/* Suche bearbeiten — dieselbe SearchBar wie auf der Startseite, bleibt aber auf dieser Seite */}
        {showSearchEdit && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-[0_12px_32px_rgba(15,27,45,.10)] px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-sm font-bold text-primary-800 mb-3">{dz.editTitle}</p>
            <SearchBar
              initialValues={{
                pickup, dropoff, date, time, passengers,
                hasReturn: isRoundtrip,
                returnDate: returnDate || undefined,
                returnTime: returnTime || undefined,
              }}
              onSearchComplete={sp => {
                const zw = params.get('zwischenstopp_address');
                if (zw) sp.set('zwischenstopp_address', zw);
                router.replace(`?${sp.toString()}`);
                setShowSearchEdit(false);
                // Mobil: nach dem Aktualisieren zurück nach oben, sonst steht man
                // unterhalb der neu berechneten Preise.
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
              }}
            />
          </div>
        )}

        {/* Trust row */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-y-5">
          {[
            { Icon: ShieldCheck, ...dz.trustTop[0] },
            { Icon: Baby, ...dz.trustTop[1] },
            { Icon: CalendarCheck, ...dz.trustTop[2] },
            { Icon: CircleCheck, ...dz.trustTop[3] },
          ].map(({ Icon, title, text }, i) => (
            <div key={title} className={cn('flex items-center gap-2.5 sm:gap-3 px-1 lg:px-3', i > 0 && 'lg:border-l lg:border-gray-200', i === 0 && 'lg:pl-1')}>
              <span className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full shrink-0" style={{ background: '#fdf0c8' }}>
                <Icon size={18} className="text-primary-800" />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] sm:text-sm font-bold text-gray-900 leading-tight lg:whitespace-nowrap [overflow-wrap:anywhere] sm:[overflow-wrap:normal]">{title}</div>
                <div className="text-xs text-gray-500">{text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pickers (full width, shown one at a time) */}
        {showReturnPicker && (
          <div className="mt-8 bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3 shadow-sm">
            <p className="text-sm font-bold text-primary-800">
              {locale === 'de' ? '⇄ Rückfahrt hinzufügen' : locale === 'en' ? '⇄ Add return trip' : '⇄ Dönüş ekle'}
            </p>
            <div className="inline-block border border-gray-300 rounded-lg bg-white">
              <DateTimeField
                label={locale === 'de' ? 'Rückfahrt' : locale === 'en' ? 'Return' : 'Dönüş'}
                date={localReturnDate}
                time={localReturnTime}
                onDateChange={setLocalReturnDate}
                onTimeChange={setLocalReturnTime}
                minDate={date}
                locale={locale}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={addReturnTrip} disabled={!localReturnDate} className="bg-gold-400 hover:bg-[#f0b92b] disabled:opacity-40 text-primary-800 text-sm font-bold px-5 py-2.5 rounded-lg transition-colors">
                {locale === 'de' ? 'Bestätigen' : locale === 'en' ? 'Confirm' : 'Onayla'}
              </button>
              <button onClick={() => setShowReturnPicker(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
                {locale === 'de' ? 'Abbrechen' : locale === 'en' ? 'Cancel' : 'İptal'}
              </button>
            </div>
          </div>
        )}
        {showZwischenstoppPicker && (
          <div className="mt-8 bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-3 relative shadow-sm">
            <p className="text-sm font-bold text-primary-800">
              {locale === 'de' ? 'Zwischenstopp hinzufügen' : locale === 'en' ? 'Add intermediate stop' : 'Ara durak ekle'}
            </p>
            <div className="relative">
              <input type="text" value={zwischenstoppInput} onChange={e => setZwischenstoppInput(e.target.value)} placeholder={locale === 'de' ? 'Adresse eingeben...' : locale === 'en' ? 'Enter address...' : 'Adres girin...'} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400 bg-white" autoFocus />
              {zwischenstoppSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {zwischenstoppSuggestions.map((s: any) => (
                    <button key={s.place_id} onClick={() => addZwischenstopp(s.description)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 border-b border-gray-50 last:border-0">{s.description}</button>
                  ))}
                </div>
              )}
            </div>
            {zwischenstoppLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                {locale === 'de' ? 'Berechne Route...' : locale === 'en' ? 'Calculating route...' : 'Rota hesaplanıyor...'}
              </div>
            )}
            <button onClick={() => { setShowZwischenstoppPicker(false); setZwischenstoppInput(''); setZwischenstoppSuggestions([]); }} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
              {locale === 'de' ? 'Abbrechen' : locale === 'en' ? 'Cancel' : 'İptal'}
            </button>
          </div>
        )}

        {/* Rückfahrt + Zwischenstopp — always same row (active banners + add buttons) */}
        {!showReturnPicker && !showZwischenstoppPicker && (
          <div className={cn('mt-8 grid grid-cols-1 gap-4', zwischenstoppEnabled && 'sm:grid-cols-2')}>
            {/* Rückfahrt: active banner OR add button */}
            {isRoundtrip ? (
              <div className="flex items-center justify-between bg-white border border-gray-300 rounded-xl px-5 min-h-[56px]">
                <div className="flex items-center gap-2.5 text-sm text-primary-800 font-semibold min-w-0">
                  <ArrowLeftRight size={18} className="shrink-0" />
                  <span className="truncate">
                    {locale === 'de' ? 'Rückfahrt:' : locale === 'en' ? 'Return:' : 'Dönüş:'}{' '}
                    {new Date(returnDate + 'T00:00:00').toLocaleDateString(
                      locale === 'en' ? 'en-GB' : locale === 'tr' ? 'tr-TR' : 'de-DE',
                      { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }
                    )} · {returnTime}
                  </span>
                </div>
                <button onClick={removeReturnTrip} className="text-xs text-red-500 hover:text-red-700 font-semibold ml-2 shrink-0">
                  × {locale === 'de' ? 'Entfernen' : locale === 'en' ? 'Remove' : 'Kaldır'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowReturnPicker(true)}
                className="relative flex items-center justify-center gap-2.5 bg-white border border-gray-300 hover:border-primary-400 hover:shadow-sm rounded-xl px-10 min-h-[56px] text-primary-800 transition-all"
              >
                <ArrowLeftRight size={20} className="shrink-0" />
                <span className="text-base font-bold">{locale === 'de' ? '+ Rückfahrt' : locale === 'en' ? '+ Return trip' : '+ Dönüş'}</span>
                <span className="text-xs font-medium text-gray-800 px-2 py-0.5 rounded-md" style={{ background: '#fdf0c8' }}>
                  {locale === 'de' ? '5% Rabatt' : locale === 'en' ? '5% discount' : '%5 indirim'}
                </span>
                <ChevronRight size={18} className="absolute right-5 text-gray-900" />
              </button>
            )}

            {/* Zwischenstopp: active banner OR add button */}
            {zwischenstoppEnabled && (
              zwischenstoppAddress ? (
                <div className="flex items-center justify-between bg-white border border-gray-300 rounded-xl px-5 min-h-[56px]">
                  <div className="flex items-center gap-2.5 text-sm text-primary-800 font-semibold min-w-0">
                    <MapPin size={18} className="shrink-0" />
                    <span className="truncate">{zwischenstoppAddress}</span>
                  </div>
                  <button onClick={removeZwischenstopp} className="text-xs text-red-500 hover:text-red-700 font-semibold ml-2 shrink-0">
                    × {locale === 'de' ? 'Entfernen' : locale === 'en' ? 'Remove' : 'Kaldır'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowZwischenstoppPicker(true)}
                  className="relative flex items-center justify-center gap-2.5 border-2 border-dashed border-gray-300 hover:border-primary-400 rounded-xl px-10 min-h-[56px] text-primary-800 transition-colors"
                >
                  <MapPin size={20} className="shrink-0" />
                  <span className="text-base font-bold">{locale === 'de' ? '+ Zwischenstopp' : locale === 'en' ? '+ Intermediate stop' : '+ Ara durak'}</span>
                  <ChevronRight size={18} className="absolute right-5 text-gray-400" />
                </button>
              )
            )}
          </div>
        )}

        {/* Vehicle cards */}
        <div className="mt-6 space-y-5">
          {VEHICLES.map(vehicle => {
            const priceData = apiPrices[vehicle.type];
            if (!priceData) return null;
            const calculatedPrice = priceData.base_price + distanceKm * priceData.price_per_km;
            let oneWayPrice = (priceData.min_price > 0 && distanceKm <= (priceData.min_price_km || 15))
              ? Math.max(calculatedPrice, priceData.min_price)
              : calculatedPrice;

            // Fixed-price route override (highest priority)
            const frPrice = fixedRouteMatch
              ? (vehicle.type === 'kombi' ? fixedRouteMatch.price_kombi
                : vehicle.type === 'van' ? fixedRouteMatch.price_van
                : fixedRouteMatch.price_grossraumtaxi)
              : 0;
            if (frPrice > 0) {
              oneWayPrice = frPrice;
            }

            // Pflichtfahrgebiet: inside the zone the fare may not fall below the mandatory tariff
            if (!fixedRouteMatch && pgInZone && pgConfig) {
              const tar = pgTarife.find(x => x.vehicle_type === vehicle.type);
              if (tar) {
                let mandatory = Number(tar.grundgebuehr) + distanceKm * Number(tar.min_per_km);
                if (priceData.min_price > 0 && distanceKm <= (priceData.min_price_km || 15)) {
                  mandatory = Math.max(mandatory, priceData.min_price);
                }
                oneWayPrice = pgConfig.mode === 'replace' ? mandatory : Math.max(oneWayPrice, mandatory);
              }
            }

            const discount = priceData.roundtrip_discount || 0;
            const oneWayWithToll = oneWayPrice + onewayToll;
            const fullRoundtripPrice = oneWayWithToll * 2;
            const discountedRoundtripPrice = fullRoundtripPrice * (1 - discount / 100);
            const tripPrice = isRoundtrip ? discountedRoundtripPrice : oneWayWithToll;
            const preAutoDiscountPrice = tripPrice + anfahrtCost + plzSurcharge;
            const autoDiscount = autoDiscounts[vehicle.type] || null;
            const redBadge = !!autoDiscount && autoDiscount.badge !== 'classic';
            const discountLabel = autoDiscount ? pickDiscountLabel(autoDiscount, locale) : '';
            const remainingText = autoDiscount ? formatRemainingSpots(autoDiscount.remaining, locale) : null;
            const autoDiscountAmount = autoDiscount
              ? (autoDiscount.type === 'fixed' ? Math.min(autoDiscount.value, preAutoDiscountPrice) : preAutoDiscountPrice * (autoDiscount.value / 100))
              : 0;
            const finalPrice = Math.max(0, preAutoDiscountPrice - autoDiscountAmount);
            // formatPrice rundet auf 0,50 € auf — Ersparnis aus den angezeigten Preisen ableiten,
            // damit "alter Preis − Badge = neuer Preis" für den Kunden exakt aufgeht.
            const shownSaving = Math.max(0, Math.ceil(preAutoDiscountPrice * 2) / 2 - Math.ceil(finalPrice * 2) / 2);
            const tooMany = passengers > (priceData.max_passengers ?? vehicle.maxPassengers);
            const maxPax = priceData.max_passengers ?? vehicle.maxPassengers;
            const maxLug = priceData.max_luggage ?? vehicle.maxLuggage;

            return (
              <div
                key={vehicle.type}
                className={cn(
                  'relative bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(15,27,45,.05)] overflow-hidden transition-all duration-200',
                  tooMany ? 'opacity-60' : 'hover:shadow-[0_8px_24px_rgba(15,27,45,.10)]'
                )}
              >
                {redBadge && autoDiscount && (
                  <div className="absolute top-[20px] -left-[38px] z-10 w-[140px] -rotate-45 bg-red-600 text-white text-xs font-extrabold text-center py-1.5 shadow-md">
                    {formatDiscountValue(autoDiscount.type, autoDiscount.value, locale)}
                  </div>
                )}

                <div className="p-4 sm:p-5 flex flex-col md:grid md:grid-cols-[190px_minmax(0,1fr)_210px] gap-5 md:gap-6 md:items-center">
                  {/* Vehicle image */}
                  <div className="w-full aspect-[800/344] md:aspect-auto md:h-[150px] rounded-xl overflow-hidden bg-gray-50">
                    <img src={vehicle.image} alt={getVehicleName(vehicle)} loading="lazy" width={800} height={344} className="w-full h-full object-cover object-[35%_center]" />
                  </div>

                  {/* Details */}
                  <div className="min-w-0">
                    <h2 className="text-2xl font-extrabold text-primary-800 tracking-tight">{getVehicleName(vehicle)}</h2>
                    <p className="text-gray-500 text-[15px] mt-0.5">{getVehicleDesc(vehicle)}</p>

                    {/* Capacity row */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {[
                        { Icon: UserRound, a: `${dz.upTo} ${maxPax}`, b: t.persons },
                        { Icon: BriefcaseBusiness, a: String(maxLug), b: t.luggage },
                        { Icon: Clock, a: `${dz.approx} ${duration} Min.`, b: dz.journey },
                      ].map(({ Icon, a, b }) => (
                        <div key={b} className="flex items-center gap-2 border border-gray-200 rounded-xl px-2.5 py-2">
                          <Icon size={19} className="shrink-0 text-gray-900" />
                          <div className="text-[12px] leading-tight text-gray-800 whitespace-nowrap">
                            <div>{a}</div>
                            <div className="text-gray-600">{b}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Feature tags */}
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {VEHICLE_TAGS[vehicle.type].map(k => (
                        <span key={k} className="text-[11px] text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md whitespace-nowrap">{dz.tags[k]}</span>
                      ))}
                      {isRoundtrip && discount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-800 px-3 py-1.5 rounded-lg font-semibold" style={{ background: '#fdf0c8' }}>
                          <Tag size={11} /> {discount}% {locale === 'de' ? 'Hin- & Rückfahrt Rabatt' : locale === 'en' ? 'Round trip discount' : 'Gidiş-dönüş indirimi'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price + CTA */}
                  <div className="flex flex-col items-stretch md:items-end border-t border-gray-100 pt-4 md:border-0 md:pt-0">
                    <div className="flex items-baseline justify-between md:justify-end gap-3 w-full">
                      <span className="text-sm text-gray-500">{isRoundtrip ? t.roundtrip_price : t.total}</span>
                      {isRoundtrip ? (
                        <span className={cn('text-sm line-through', redBadge ? 'text-red-600' : 'text-gray-400')}>{formatPrice(fullRoundtripPrice + anfahrtCost + plzSurcharge)}</span>
                      ) : autoDiscount ? (
                        <span className={cn('text-sm line-through', redBadge ? 'text-red-600' : 'text-gray-400')}>{formatPrice(preAutoDiscountPrice)}</span>
                      ) : null}
                    </div>
                    <div className="text-[32px] leading-tight font-extrabold text-primary-800 mt-0.5 md:text-right">{formatPrice(finalPrice)}</div>

                    {isRoundtrip && (
                      <div className="flex items-center gap-1 md:justify-end mt-0.5">
                        <Tag size={11} className="text-green-600" />
                        <span className="text-xs text-green-600 font-bold">{discount}% {t.discount}</span>
                      </div>
                    )}
                    {autoDiscount && redBadge && (
                      <div className="flex flex-col items-start md:items-end gap-1 mt-1.5">
                        <span className="inline-block bg-red-600 text-white text-[11px] font-bold uppercase px-2.5 py-1 rounded-md max-w-[240px] leading-snug md:text-right">
                          −{formatPrice(shownSaving)} – {discountLabel}
                        </span>
                        {remainingText && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                            <UsersRound size={13} className="shrink-0" /> {remainingText}
                          </span>
                        )}
                        <Countdown endsAt={autoDiscount.ends_at} locale={locale} onExpire={() => setDiscountRefresh(n => n + 1)}
                          className="text-xs font-semibold text-red-600" />
                      </div>
                    )}
                    {autoDiscount && !redBadge && (
                      <div className="flex items-center gap-1 md:justify-end mt-0.5">
                        <Tag size={11} className="text-green-600" />
                        <span className="text-xs text-green-600 font-bold">
                          {formatDiscountValue(autoDiscount.type, autoDiscount.value, locale)} {discountLabel}
                        </span>
                      </div>
                    )}
                    {autoDiscount && !redBadge && remainingText && (
                      <div className="text-xs font-semibold text-green-700 mt-0.5 md:text-right">{remainingText}</div>
                    )}
                    {autoDiscount && !redBadge && autoDiscount.ends_at && (
                      <Countdown endsAt={autoDiscount.ends_at} locale={locale} onExpire={() => setDiscountRefresh(n => n + 1)}
                        className="text-xs font-semibold text-green-700 md:justify-end w-full" />
                    )}
                    {anfahrtCost > 0 && (
                      <div className="text-xs text-amber-600 font-medium mt-0.5 md:text-right">
                        {locale === 'de' ? 'inkl.' : locale === 'en' ? 'incl.' : 'dahil'} {formatPrice(anfahrtCost)} {locale === 'de' ? 'Anfahrtskosten' : locale === 'en' ? 'approach fee' : 'yaklaşım ücreti'}
                      </div>
                    )}

                    <div className="mt-4 w-full">
                      {tooMany ? (
                        <p className="text-sm text-red-500 font-semibold md:text-right">{t.notSuitable} {passengers} {t.passengers_label}</p>
                      ) : (
                        <button
                          onClick={() => handleBook(vehicle.type, oneWayWithToll + plzSurcharge)}
                          className="w-full flex items-center justify-center gap-2 bg-gold-400 hover:bg-[#f0b92b] active:bg-gold-500 text-primary-800 font-bold px-3 py-3.5 rounded-xl transition-colors text-sm shadow-sm whitespace-nowrap"
                        >
                          {t.book} <ArrowRight size={16} />
                        </button>
                      )}
                      {!tooMany && (
                        <div className="mt-2 text-[11px] text-gray-500 text-center">
                          {locale === 'de' ? 'Keine Vorauszahlung' : locale === 'en' ? 'No prepayment' : 'Ön ödeme yok'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Price note */}
        <div className="mt-6 flex items-center gap-3 rounded-xl px-5 py-4 text-sm text-primary-800 border" style={{ background: '#eaf2fc', borderColor: '#d8e5f5' }}>
          <Info size={18} className="shrink-0 text-primary-500" />
          <span>
            {locale === 'de'
              ? 'Alle Preise sind Festpreise inklusive Maut, Gepäck und Kindersitz. Keine versteckten Kosten.'
              : locale === 'en'
              ? 'All prices are fixed rates including tolls, luggage, and child seat. No hidden costs.'
              : 'Tüm fiyatlar otoyol, bagaj ve çocuk koltuğu dahil sabit fiyatlardır. Gizli maliyet yoktur.'}
          </span>
        </div>

        {/* Bottom trust row */}
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-y-6">
          {[
            { Icon: ShieldCheck, ...dz.trustBottom[0] },
            { Icon: CarFront, ...dz.trustBottom[1] },
            { Icon: Clock, ...dz.trustBottom[2] },
            { Icon: Headphones, ...dz.trustBottom[3] },
          ].map(({ Icon, title, text }, i) => (
            <div key={title} className={cn('flex items-center gap-2.5 sm:gap-3 px-1 lg:px-3', i > 0 && 'lg:border-l lg:border-gray-200')}>
              <span className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full shrink-0" style={{ background: '#fdf0c8' }}>
                <Icon size={19} className="text-primary-800" />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] sm:text-sm font-bold text-gray-900 leading-tight lg:whitespace-nowrap [overflow-wrap:anywhere] sm:[overflow-wrap:normal]">{title}</div>
                <div className="text-xs text-gray-500">{text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SocialProofToast locale={locale} />
    </div>
  );
}

export default function ErgebnissePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Lädt...</p>
        </div>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
