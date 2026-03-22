'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { MapPin, Clock, Users, Luggage, CheckCircle, ArrowRight, Calendar, ChevronLeft, Wifi, Baby, Shield, Tag } from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

const VEHICLES = [
  {
    type: 'kombi' as const,
    emoji: '🚗',
    nameDE: 'Kombi', nameEN: 'Sedan', nameTR: 'Kombi',
    descDE: 'Ideal für Einzelreisende & Paare',
    descEN: 'Ideal for solo travelers & couples',
    descTR: 'Bireysel yolcular ve çiftler için ideal',
    maxPassengers: 3,
    maxLuggage: 3,
    badge: null,
    features: ['WiFi', 'Klimaanlage', 'Festpreis'],
    color: 'border-gray-200',
  },
  {
    type: 'van' as const,
    emoji: '🚐',
    nameDE: 'Van / Minibus', nameEN: 'Van / Minibus', nameTR: 'Van / Minibüs',
    descDE: 'Perfekt für Familien & Gruppen',
    descEN: 'Perfect for families & groups',
    descTR: 'Aileler ve gruplar için mükemmel',
    maxPassengers: 7,
    maxLuggage: 7,
    badge: 'BELIEBT',
    features: ['WiFi', 'Klimaanlage', 'Kindersitz kostenlos'],
    color: 'border-primary-400',
  },
  {
    type: 'grossraumtaxi' as const,
    emoji: '🚌',
    nameDE: 'Großraumtaxi', nameEN: 'Large Taxi', nameTR: 'Büyük Taksi',
    descDE: 'Für große Gruppen mit viel Gepäck',
    descEN: 'For large groups with lots of luggage',
    descTR: 'Çok bavullu büyük gruplar için',
    maxPassengers: 8,
    maxLuggage: 10,
    badge: null,
    features: ['WiFi', 'Klimaanlage', 'Max. Kapazität'],
    color: 'border-gray-200',
  },
];

interface PriceData {
  base_price: number;
  price_per_km: number;
  roundtrip_discount: number;
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
          kombi: { base_price: 8, price_per_km: 2.1, roundtrip_discount: 5 },
          van: { base_price: 10, price_per_km: 2.2, roundtrip_discount: 5 },
          grossraumtaxi: { base_price: 15, price_per_km: 2.4, roundtrip_discount: 5 },
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
            <button onClick={() => router.back()} className="flex items-center gap-1 text-primary-200 hover:text-white transition-colors mr-2 shrink-0">
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
            { icon: <Wifi size={14} />, text: locale === 'de' ? 'WiFi im Fahrzeug' : locale === 'en' ? 'WiFi included' : 'WiFi dahil' },
            { icon: <CheckCircle size={14} />, text: locale === 'de' ? 'Sofortbestätigung' : locale === 'en' ? 'Instant confirmation' : 'Anında onay' },
          ].map(b => (
            <div key={b.text} className="flex items-center gap-1.5 bg-white text-gray-600 text-xs px-3 py-2 rounded-full shadow-sm border border-gray-100">
              <span className="text-primary-500">{b.icon}</span> {b.text}
            </div>
          ))}
        </div>

        {/* Vehicle cards */}
        <div className="space-y-4">
          {VEHICLES.map(vehicle => {
            const priceData = apiPrices[vehicle.type];
            if (!priceData) return null;
            const oneWayPrice = priceData.base_price + distanceKm * priceData.price_per_km;
            const discount = priceData.roundtrip_discount || 0;
            const fullRoundtripPrice = oneWayPrice * 2;
            const discountedRoundtripPrice = fullRoundtripPrice * (1 - discount / 100);
            const finalPrice = isRoundtrip ? discountedRoundtripPrice : oneWayPrice;
            const tooMany = passengers > vehicle.maxPassengers;

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
                  {/* Emoji icon */}
                  <div className="text-7xl shrink-0 flex items-center justify-center w-24 h-24 bg-gray-50 rounded-2xl border border-gray-100">
                    {vehicle.emoji}
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
                            <div className="text-sm text-gray-400 line-through">{formatPrice(fullRoundtripPrice)}</div>
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
                        <div className="text-xs text-green-600 font-semibold mt-0.5">{t.fixed}</div>
                      </div>
                    </div>

                    {/* Capacity row */}
                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Users size={15} className="text-primary-400" />
                        <span>{locale === 'de' ? 'Bis zu' : locale === 'en' ? 'Up to' : 'Max.'} {vehicle.maxPassengers} {t.persons}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Luggage size={15} className="text-primary-400" />
                        <span>{vehicle.maxLuggage} {t.luggage}</span>
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
                          onClick={() => handleBook(vehicle.type, finalPrice)}
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
