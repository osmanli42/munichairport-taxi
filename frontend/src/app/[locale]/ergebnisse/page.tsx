'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { MapPin, Clock, Users, Luggage, CheckCircle, ArrowRight, Calendar, ChevronLeft, Baby, Shield, Tag } from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

const VEHICLES = [
  {
    type: 'kombi' as const,
    image: '/images/kombi.PNG',
    nameDE: 'Kombi', nameEN: 'Sedan', nameTR: 'Kombi',
    descDE: 'Ideal für Einzelreisende & Paare',
    descEN: 'Ideal for solo travelers & couples',
    descTR: 'Bireysel yolcular ve çiftler için ideal',
    maxPassengers: 3,
    maxLuggage: 3,
    badge: null,
    features: ['Klimaanlage', 'Festpreis'],
    color: 'border-gray-200',
  },
  {
    type: 'van' as const,
    image: '/images/van.PNG',
    nameDE: 'Van / Minibus', nameEN: 'Van / Minibus', nameTR: 'Van / Minibüs',
    descDE: 'Perfekt für Familien & Gruppen',
    descEN: 'Perfect for families & groups',
    descTR: 'Aileler ve gruplar için mükemmel',
    maxPassengers: 7,
    maxLuggage: 7,
    badge: 'BELIEBT',
    features: ['Klimaanlage', 'Kindersitz kostenlos'],
    color: 'border-primary-400',
  },
  {
    type: 'grossraumtaxi' as const,
    image: '/images/van.PNG',
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
    }).catch(() => {}).finally(() => setSettingsLoaded(true));
  }, []);
  useEffect(() => {
    if (!settingsLoaded) return;
    if (pickup && dropoff && !isAirportArea(pickup) && !isAirportArea(dropoff) && !stadtfahrtEnabled) {
      router.replace(`/${locale}`);
    }
  }, [pickup, dropoff, locale, router, stadtfahrtEnabled, settingsLoaded]);

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

  const dateFormatted = date
    ? new Date(date + 'T00:00:00').toLocaleDateString(
        locale === 'en' ? 'en-GB' : locale === 'tr' ? 'tr-TR' : 'de-DE',
        { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }
      )
    : '';

  const texts: Record<string, Record<string, string>> = {
    de: { title: 'Fahrzeug wählen', subtitle: 'Alle Preise sind Festpreise inkl. Maut & Gepäck', book: 'Dieses Fahrzeug buchen', notSuitable: 'Nicht geeignet für', passengers_label: 'Person', duration_label: 'Min. Fahrtzeit', back: '← Suche ändern', total: 'Gesamtpreis', oneway_price: 'Einfache Fahrt', roundtrip_price: 'Hin- & Rückfahrt', discount: 'Rabatt', fixed: '✅ Festpreis garantiert', badge_popular: 'BELIEBT', persons: 'Passagiere', luggage: 'Gepäckstücke' },
    en: { title: 'Choose your vehicle', subtitle: 'All prices are fixed rates incl. tolls & luggage', book: 'Book this vehicle', notSuitable: 'Not suitable for', passengers_label: 'Person', duration_label: 'min. journey', back: '← Change search', total: 'Total price', oneway_price: 'One way', roundtrip_price: 'Round trip', discount: 'Discount', fixed: '✅ Fixed price guaranteed', badge_popular: 'POPULAR', persons: 'Passengers', luggage: 'Pieces of luggage' },
    tr: { title: 'Araç seçin', subtitle: 'Tüm fiyatlar otoyol ve bagaj dahil sabit fiyatlardır', book: 'Bu aracı rezerve et', notSuitable: 'Uygun değil:', passengers_label: 'Kişi', duration_label: 'dk. yolculuk', back: '← Aramayı değiştir', total: 'Toplam fiyat', oneway_price: 'Tek yön', roundtrip_price: 'Gidiş-Dönüş', discount: 'İndirim', fixed: '✅ Sabit fiyat garantili', badge_popular: 'POPÜLER', persons: 'Yolcu', luggage: 'Bagaj' },
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
    if (isRoundtrip && returnDate) {
      bp.set('return_date', returnDate);
      bp.set('return_time', returnTime);
    }
    if (anfahrtKm > 0) {
      bp.set('anfahrt_km', String(anfahrtKm));
      bp.set('anfahrt_cost', anfahrtCost.toFixed(2));
    }
    if (zwischenstoppAddress) {
      bp.set('zwischenstopp_address', zwischenstoppAddress);
    }
    const prefix = locale === 'de' ? '' : `/${locale}`;
    router.push(`${prefix}/buchen?${bp.toString()}`);
  }

  if (!apiPrices) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar - route summary */}
      <div className="bg-primary-700 text-white sticky top-16 z-40 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button onClick={() => {
              const sp = new URLSearchParams();
              sp.set('pickup', pickup);
              sp.set('dropoff', dropoff);
              sp.set('date', date);
              sp.set('time', time);
              sp.set('passengers', passengers.toString());
              if (isRoundtrip) {
                sp.set('trip_type', 'roundtrip');
                if (returnDate) sp.set('return_date', returnDate);
                if (returnTime) sp.set('return_time', returnTime);
              }
              router.push(`/${locale}?${sp.toString()}`);
            }} className="flex items-center gap-1 text-primary-200 hover:text-white transition-colors mr-2 shrink-0">
              <ChevronLeft size={16} /> {t.back}
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              <MapPin size={14} className="text-green-400" />
              <span className="font-medium max-w-[160px] truncate">{pickup}</span>
            </div>
            <ArrowRight size={14} className="text-primary-300 shrink-0" />
            <div className="flex items-center gap-1.5 shrink-0">
              <MapPin size={14} className="text-red-400" />
              <span className="font-medium max-w-[160px] truncate">{dropoff}</span>
            </div>
            <div className="flex items-center gap-3 ml-auto text-primary-200 text-xs shrink-0">
              <span className="flex items-center gap-1"><Calendar size={12} /> {dateFormatted} · {time}</span>
              {isRoundtrip && <span className="text-gold-400 font-semibold">⇄ {t.roundtrip_price}</span>}
              <span className="flex items-center gap-1"><Users size={12} /> {passengers}</span>
              <span className="font-medium text-white">{distanceKm.toFixed(1)} km · {duration} Min.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-primary-700">{t.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{t.subtitle}</p>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { icon: <Shield size={14} />, text: locale === 'de' ? 'Festpreisgarantie' : locale === 'en' ? 'Fixed price guarantee' : 'Sabit fiyat garantisi' },
            { icon: <Baby size={14} />, text: locale === 'de' ? 'Kindersitz kostenlos' : locale === 'en' ? 'Free child seat' : 'Ücretsiz çocuk koltuğu' },
{ icon: <CheckCircle size={14} />, text: locale === 'de' ? 'Sofortbestätigung' : locale === 'en' ? 'Instant confirmation' : 'Anında onay' },
          ].map(b => (
            <div key={b.text} className="flex items-center gap-1.5 bg-white text-gray-600 text-xs px-3 py-2 rounded-full shadow-sm border border-gray-100">
              <span className="text-primary-500">{b.icon}</span> {b.text}
            </div>
          ))}
        </div>

        {/* Pickers (full width, shown one at a time) */}
        {showReturnPicker && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 mb-4 space-y-3">
            <p className="text-sm font-semibold text-primary-700">
              {locale === 'de' ? '⇄ Rückfahrt hinzufügen' : locale === 'en' ? '⇄ Add return trip' : '⇄ Dönüş ekle'}
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">
                  {locale === 'de' ? 'Datum' : locale === 'en' ? 'Date' : 'Tarih'}
                </label>
                <input type="date" value={localReturnDate} min={date} onChange={e => setLocalReturnDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">
                  {locale === 'de' ? 'Uhrzeit' : locale === 'en' ? 'Time' : 'Saat'}
                </label>
                <input type="time" value={localReturnTime} onChange={e => setLocalReturnTime(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addReturnTrip} disabled={!localReturnDate} className="bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                {locale === 'de' ? 'Bestätigen' : locale === 'en' ? 'Confirm' : 'Onayla'}
              </button>
              <button onClick={() => setShowReturnPicker(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
                {locale === 'de' ? 'Abbrechen' : locale === 'en' ? 'Cancel' : 'İptal'}
              </button>
            </div>
          </div>
        )}
        {showZwischenstoppPicker && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 mb-4 space-y-3 relative">
            <p className="text-sm font-semibold text-primary-700">
              {locale === 'de' ? '📍 Zwischenstopp hinzufügen' : locale === 'en' ? '📍 Add intermediate stop' : '📍 Ara durak ekle'}
            </p>
            <div className="relative">
              <input type="text" value={zwischenstoppInput} onChange={e => setZwischenstoppInput(e.target.value)} placeholder={locale === 'de' ? 'Adresse eingeben...' : locale === 'en' ? 'Enter address...' : 'Adres girin...'} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white" autoFocus />
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
          <div className="flex gap-3 mb-4">
            {/* Rückfahrt: active banner OR add button */}
            {isRoundtrip ? (
              <div className="flex items-center justify-between flex-1 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-primary-700 font-medium truncate">
                  <span>⇄</span>
                  <span className="truncate">
                    {locale === 'de' ? 'Rückfahrt:' : locale === 'en' ? 'Return:' : 'Dönüş:'}{' '}
                    {new Date(returnDate + 'T00:00:00').toLocaleDateString(
                      locale === 'en' ? 'en-GB' : locale === 'tr' ? 'tr-TR' : 'de-DE',
                      { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }
                    )} · {returnTime}
                  </span>
                </div>
                <button onClick={removeReturnTrip} className="text-xs text-red-500 hover:text-red-700 font-medium ml-2 shrink-0">
                  ✕ {locale === 'de' ? 'Entfernen' : locale === 'en' ? 'Remove' : 'Kaldır'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowReturnPicker(true)}
                className="flex items-center gap-2 flex-1 border-2 border-dashed border-primary-300 hover:border-primary-500 text-primary-600 hover:text-primary-700 rounded-xl px-4 py-3 text-sm font-semibold transition-colors justify-center"
              >
                <span className="text-lg">⇄</span>
                {locale === 'de' ? '+ Rückfahrt' : locale === 'en' ? '+ Return trip' : '+ Dönüş'}
                <span className="text-xs font-normal text-green-600 ml-1">
                  ({locale === 'de' ? '5% Rabatt' : locale === 'en' ? '5% discount' : '%5 indirim'})
                </span>
              </button>
            )}

            {/* Zwischenstopp: active banner OR add button */}
            {zwischenstoppEnabled && (
              zwischenstoppAddress ? (
                <div className="flex items-center justify-between flex-1 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-blue-700 font-medium truncate">
                    <span>📍</span>
                    <span className="truncate">{zwischenstoppAddress}</span>
                  </div>
                  <button onClick={removeZwischenstopp} className="text-xs text-red-500 hover:text-red-700 font-medium ml-2 shrink-0">
                    ✕ {locale === 'de' ? 'Entfernen' : locale === 'en' ? 'Remove' : 'Kaldır'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowZwischenstoppPicker(true)}
                  className="flex items-center gap-2 flex-1 border-2 border-dashed border-blue-300 hover:border-blue-500 text-blue-600 hover:text-blue-700 rounded-xl px-4 py-3 text-sm font-semibold transition-colors justify-center"
                >
                  <span>📍</span>
                  {locale === 'de' ? '+ Zwischenstopp' : locale === 'en' ? '+ Intermediate stop' : '+ Ara durak'}
                </button>
              )
            )}
          </div>
        )}

        {/* Vehicle cards */}
        <div className="space-y-4">
          {VEHICLES.map(vehicle => {
            const priceData = apiPrices[vehicle.type];
            if (!priceData) return null;
            const calculatedPrice = priceData.base_price + distanceKm * priceData.price_per_km;
            const oneWayPrice = (priceData.min_price > 0 && distanceKm <= (priceData.min_price_km || 15))
              ? Math.max(calculatedPrice, priceData.min_price)
              : calculatedPrice;
            const discount = priceData.roundtrip_discount || 0;
            const fullRoundtripPrice = oneWayPrice * 2;
            const discountedRoundtripPrice = fullRoundtripPrice * (1 - discount / 100);
            const tripPrice = isRoundtrip ? discountedRoundtripPrice : oneWayPrice;
            const finalPrice = tripPrice + anfahrtCost;
            const tooMany = passengers > (priceData.max_passengers ?? vehicle.maxPassengers);

            return (
              <div
                key={vehicle.type}
                className={cn(
                  'bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all duration-200',
                  tooMany ? 'opacity-50 border-gray-100' : vehicle.badge ? 'border-primary-400 shadow-md' : 'border-gray-100 hover:border-primary-200 hover:shadow-md'
                )}
              >
                {vehicle.badge && (
                  <div className="bg-primary-600 text-white text-xs font-bold text-center py-1.5 tracking-widest">
                    ⭐ {t.badge_popular} ⭐
                  </div>
                )}

                <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5">
                  {/* Vehicle image */}
                  <div className="shrink-0 w-36 h-36 rounded-2xl overflow-hidden border border-gray-100">
                    <img src={vehicle.image} alt={getVehicleName(vehicle)} className="w-full h-full object-cover" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{getVehicleName(vehicle)}</h2>
                        <p className="text-gray-500 text-sm mt-0.5">{getVehicleDesc(vehicle)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {isRoundtrip ? (
                          <>
                            <div className="text-xs text-gray-400 mb-0.5">{t.roundtrip_price}</div>
                            <div className="text-sm text-gray-400 line-through">{formatPrice(fullRoundtripPrice + anfahrtCost)}</div>
                            <div className="text-3xl font-bold text-primary-600">{formatPrice(finalPrice)}</div>
                            <div className="flex items-center gap-1 justify-end mt-0.5">
                              <Tag size={11} className="text-green-600" />
                              <span className="text-xs text-green-600 font-bold">{discount}% {t.discount}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-xs text-gray-400 mb-0.5">{t.total}</div>
                            <div className="text-3xl font-bold text-primary-600">{formatPrice(finalPrice)}</div>
                          </>
                        )}
                        {anfahrtCost > 0 && (
                          <div className="text-xs text-amber-600 font-medium mt-0.5">
                            {locale === 'de' ? 'inkl.' : locale === 'en' ? 'incl.' : 'dahil'} {formatPrice(anfahrtCost)} {locale === 'de' ? 'Anfahrtskosten' : locale === 'en' ? 'approach fee' : 'yaklaşım ücreti'}
                          </div>
                        )}
                        <div className="text-xs text-green-600 font-semibold mt-0.5">{t.fixed}</div>
                      </div>
                    </div>

                    {/* Capacity row */}
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Users size={15} className="text-primary-400" />
                        <span>{locale === 'de' ? 'Bis zu' : locale === 'en' ? 'Up to' : 'Max.'} {priceData.max_passengers ?? vehicle.maxPassengers} {t.persons}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Luggage size={15} className="text-primary-400" />
                        <span>{priceData.max_luggage ?? vehicle.maxLuggage} {t.luggage}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={15} className="text-primary-400" />
                        <span>{locale === 'de' ? 'ca.' : 'approx.'} {duration} {t.duration_label}</span>
                      </div>
                    </div>

                    {/* Feature tags */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {vehicle.features.map(f => (
                        <span key={f} className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full">
                          <CheckCircle size={10} /> {f}
                        </span>
                      ))}
                      {isRoundtrip && discount > 0 && (
                        <span className="flex items-center gap-1 text-xs bg-gold-50 text-gold-700 border border-gold-200 px-2.5 py-1 rounded-full font-semibold">
                          <Tag size={10} /> {discount}% {locale === 'de' ? 'Hin- & Rückfahrt Rabatt' : locale === 'en' ? 'Round trip discount' : 'Gidiş-dönüş indirimi'}
                        </span>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="mt-4">
                      {tooMany ? (
                        <p className="text-sm text-red-500 font-medium">⚠️ {t.notSuitable} {passengers} {t.passengers_label}</p>
                      ) : (
                        <button
                          onClick={() => handleBook(vehicle.type, oneWayPrice)}
                          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
                        >
                          {t.book} <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Price note */}
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
          ℹ️ {locale === 'de'
            ? 'Alle Preise sind Festpreise inklusive Maut, Gepäck und Kindersitz. Keine versteckten Kosten.'
            : locale === 'en'
            ? 'All prices are fixed rates including tolls, luggage, and child seat. No hidden costs.'
            : 'Tüm fiyatlar otoyol, bagaj ve çocuk koltuğu dahil sabit fiyatlardır. Gizli maliyet yoktur.'}
        </div>
      </div>
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
