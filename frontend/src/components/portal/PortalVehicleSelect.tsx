'use client';

import { useState, useEffect } from 'react';
import { MapPin, Clock, Users, Luggage, CheckCircle, ArrowRight, Calendar, ChevronLeft, Tag } from 'lucide-react';
import { formatPrice, cn, calculateToll, extractCountryFromAddress } from '@/lib/utils';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

// ── Pflichtfahrgebiet helpers (same as ergebnisse) ──
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
function isAirportArea(addr: string): boolean {
  const lower = addr.toLowerCase();
  return ['flughafen münchen', 'munich airport', 'münchen-flughafen', 'munchen-flughafen', '85356', 'oberding', 'hallbergmoos', 'freising'].some(kw => lower.includes(kw));
}

const VEHICLES = [
  { type: 'kombi' as const, image: '/images/kombi.webp', name: 'Kombi', desc: 'Ideal für Einzelreisende & Paare', maxPassengers: 3, maxLuggage: 3, badge: null as string | null },
  { type: 'van' as const, image: '/images/van.webp', name: 'Van / Minibus', desc: 'Perfekt für Familien & Gruppen', maxPassengers: 7, maxLuggage: 7, badge: 'BELIEBT' },
  { type: 'grossraumtaxi' as const, image: '/images/van.webp', name: 'Großraumtaxi', desc: 'Für große Gruppen mit viel Gepäck', maxPassengers: 8, maxLuggage: 10, badge: null },
];

interface PriceData {
  base_price: number; price_per_km: number; roundtrip_discount: number;
  min_price: number; min_price_km: number; max_passengers?: number; max_luggage?: number;
}
interface FixedRoute {
  id: number; name: string; pickup_keywords: string; dropoff_keywords: string;
  price_kombi: number; price_van: number; price_grossraumtaxi: number;
  bidirectional: number; enabled: number;
}

export interface VehicleSelection {
  vehicle: string;
  estimatedPrice: number;
  originalPrice: number;
  anfahrtCost: number;
  tollAmount: number;
}

export default function PortalVehicleSelect({
  searchParams,
  company,
  onSelect,
  onBack,
}: {
  searchParams: URLSearchParams;
  company: { discount_percent: number; discount_kombinierbar: boolean; pg_discount_override: boolean };
  onSelect: (sel: VehicleSelection) => void;
  onBack: () => void;
}) {
  const pickup = searchParams.get('pickup') || '';
  const dropoff = searchParams.get('dropoff') || '';
  const date = searchParams.get('date') || '';
  const time = searchParams.get('time') || '';
  const passengers = Number(searchParams.get('passengers') || 1);
  const distanceKm = Number(searchParams.get('distance_km') || 0);
  const duration = Number(searchParams.get('duration') || 0);
  const isRoundtrip = (searchParams.get('trip_type') || 'oneway') === 'roundtrip';
  const anfahrtKm = Number(searchParams.get('anfahrt_km') || 0);

  const onewayToll = calculateToll(extractCountryFromAddress(dropoff), dropoff);

  const [apiPrices, setApiPrices] = useState<Record<string, PriceData> | null>(null);
  const [fixedRoutes, setFixedRoutes] = useState<FixedRoute[]>([]);
  const [anfahrtPricePerKm, setAnfahrtPricePerKm] = useState(1.70);
  const [plzSurcharge, setPlzSurcharge] = useState(0);
  const [pgConfig, setPgConfig] = useState<PgConfig | null>(null);
  const [pgTarife, setPgTarife] = useState<PgTarif[]>([]);
  const [pgExclusions, setPgExclusions] = useState<string[]>([]);
  const [pgConfigLoaded, setPgConfigLoaded] = useState(false);
  const [pgCoordsLoaded, setPgCoordsLoaded] = useState(false);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/prices`).then(r => r.json()).then((data: any[]) => {
      const map: Record<string, PriceData> = {};
      data.forEach(p => { map[p.vehicle_type] = p; });
      setApiPrices(map);
    }).catch(() => {
      setApiPrices({
        kombi: { base_price: 8, price_per_km: 2.1, roundtrip_discount: 5, min_price: 0, min_price_km: 15 },
        van: { base_price: 10, price_per_km: 2.2, roundtrip_discount: 5, min_price: 0, min_price_km: 15 },
        grossraumtaxi: { base_price: 15, price_per_km: 2.4, roundtrip_discount: 5, min_price: 0, min_price_km: 15 },
      });
    });
    fetch(`${API_URL}/fixed-routes`).then(r => r.json()).then(setFixedRoutes).catch(() => {});
    fetch(`${API_URL}/settings`).then(r => r.json()).then(s => {
      if (s.anfahrt_price_per_km) setAnfahrtPricePerKm(parseFloat(s.anfahrt_price_per_km));
      if (s.plz_surcharge_enabled === '1') {
        const plzMatch = pickup?.match(/\b(\d{5})\b/);
        if (plzMatch) {
          fetch(`${API_URL}/plz-surcharges`).then(r => r.json()).then((rows: { plz: string; surcharge: number }[]) => {
            const match = rows.find(r => r.plz === plzMatch[1]);
            if (match) setPlzSurcharge(match.surcharge);
          }).catch(() => {});
        }
      }
    }).catch(() => {});
    Promise.all([
      fetch(`${API_URL}/pflichtgebiet`).then(r => r.json())
        .then((d: { config: PgConfig | null; tarife: PgTarif[] }) => { setPgConfig(d.config); setPgTarife(d.tarife || []); })
        .catch(() => {}),
      fetch(`${API_URL}/pflichtgebiet/exclusions`).then(r => r.json())
        .then((rows: { plz: string }[]) => setPgExclusions(rows.map(r => r.plz)))
        .catch(() => {}),
    ]).finally(() => setPgConfigLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const anfahrtCost = anfahrtKm > 0 ? anfahrtKm * anfahrtPricePerKm : 0;

  const matchFixedRoute = (p: string, d: string): FixedRoute | null => {
    const matchKw = (addr: string, kws: string) => {
      if (!addr || !kws) return false;
      const lower = addr.toLowerCase();
      return kws.split(',').some(kw => lower.includes(kw.trim().toLowerCase()));
    };
    for (const r of fixedRoutes) {
      if (!r.enabled) continue;
      if (matchKw(p, r.pickup_keywords) && matchKw(d, r.dropoff_keywords)) return r;
      if (r.bidirectional && matchKw(p, r.dropoff_keywords) && matchKw(d, r.pickup_keywords)) return r;
    }
    return null;
  };
  const fixedRouteMatch = matchFixedRoute(pickup, dropoff);

  const pgRadius = pgConfig?.radius_km ?? 50;
  const pickupPlz = pickup.match(/\b(\d{5})\b/)?.[1];
  const dropoffPlz = dropoff.match(/\b(\d{5})\b/)?.[1];
  const pgPlzExcluded = pgExclusions.includes(pickupPlz || '') || pgExclusions.includes(dropoffPlz || '');
  const pgInZone = !pgPlzExcluded && !!(pgConfig && pgConfig.enabled && distanceKm <= pgRadius && (
    (pgPointInZone(pickupCoords, pgConfig) || (pgConfig.airport_enabled === 1 && isAirportArea(pickup))) &&
    (pgPointInZone(dropoffCoords, pgConfig) || (pgConfig.airport_enabled === 1 && isAirportArea(dropoff)))
  ));

  const corpPct = company.discount_percent || 0;
  const dateFormatted = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  if (!apiPrices || !pgCoordsLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Route summary bar */}
      <div className="bg-[#0c2d48] text-white rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button onClick={onBack} className="flex items-center gap-1 text-blue-200 hover:text-white transition-colors mr-2 shrink-0">
            <ChevronLeft size={16} /> Suche ändern
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <MapPin size={14} className="text-green-400" />
            <span className="font-medium max-w-[160px] truncate">{pickup}</span>
          </div>
          <ArrowRight size={14} className="text-blue-300 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <MapPin size={14} className="text-red-400" />
            <span className="font-medium max-w-[160px] truncate">{dropoff}</span>
          </div>
          <div className="flex items-center gap-3 ml-auto text-blue-200 text-xs shrink-0">
            <span className="flex items-center gap-1"><Calendar size={12} /> {dateFormatted} · {time}</span>
            {isRoundtrip && <span className="text-amber-400 font-semibold">⇄ Hin- & Rückfahrt</span>}
            <span className="flex items-center gap-1"><Users size={12} /> {passengers}</span>
            <span className="font-medium text-white">{distanceKm.toFixed(1)} km · {duration} Min.</span>
          </div>
        </div>
      </div>

      {/* Vehicle cards */}
      {VEHICLES.map(vehicle => {
        const priceData = apiPrices[vehicle.type];
        if (!priceData) return null;

        // ── Same layered pricing as ergebnisse ──
        const calculatedPrice = priceData.base_price + distanceKm * priceData.price_per_km;
        let oneWayPrice = (priceData.min_price > 0 && distanceKm <= (priceData.min_price_km || 15))
          ? Math.max(calculatedPrice, priceData.min_price)
          : calculatedPrice;

        const frPrice = fixedRouteMatch
          ? (vehicle.type === 'kombi' ? fixedRouteMatch.price_kombi
            : vehicle.type === 'van' ? fixedRouteMatch.price_van
            : fixedRouteMatch.price_grossraumtaxi)
          : 0;
        if (frPrice > 0) oneWayPrice = frPrice;

        let pgMandatoryOneWay = 0;
        if (!fixedRouteMatch && pgInZone && pgConfig) {
          const tar = pgTarife.find(x => x.vehicle_type === vehicle.type);
          if (tar) {
            let mandatory = Number(tar.grundgebuehr) + distanceKm * Number(tar.min_per_km);
            if (priceData.min_price > 0 && distanceKm <= (priceData.min_price_km || 15)) {
              mandatory = Math.max(mandatory, priceData.min_price);
            }
            pgMandatoryOneWay = mandatory;
            oneWayPrice = pgConfig.mode === 'replace' ? mandatory : Math.max(oneWayPrice, mandatory);
          }
        }

        const rtDiscount = priceData.roundtrip_discount || 0;
        const oneWayWithToll = oneWayPrice + onewayToll;
        const fullRoundtripPrice = oneWayWithToll * 2;
        const discountedRoundtripPrice = fullRoundtripPrice * (1 - rtDiscount / 100);
        const tripPrice = isRoundtrip ? discountedRoundtripPrice : oneWayWithToll;
        const originalPrice = tripPrice + anfahrtCost + plzSurcharge; // regular-customer price

        // ── Company layer (mirrors backend bookings.ts) ──
        // kombinierbar=0 + roundtrip: skip roundtrip discount, apply only company %
        const corpBase = (isRoundtrip && corpPct > 0 && !company.discount_kombinierbar)
          ? fullRoundtripPrice + anfahrtCost + plzSurcharge
          : originalPrice;
        let companyPrice = corpPct > 0 ? corpBase * (1 - corpPct / 100) : corpBase;

        // Pflichtgebiet floor: discount may not push price below mandatory tariff (unless override)
        if (corpPct > 0 && pgMandatoryOneWay > 0 && !company.pg_discount_override) {
          const pgFloorTotal = (pgMandatoryOneWay + onewayToll) * (isRoundtrip ? 2 : 1) + anfahrtCost + plzSurcharge;
          companyPrice = Math.max(companyPrice, pgFloorTotal);
        }
        companyPrice = Math.round(companyPrice * 100) / 100;

        const hasCorpDiscount = corpPct > 0 && companyPrice < originalPrice - 0.005;
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
                ⭐ {vehicle.badge} ⭐
              </div>
            )}
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5">
              <div className="shrink-0 w-32 h-32 rounded-2xl overflow-hidden border border-gray-100">
                <img src={vehicle.image} alt={vehicle.name} loading="lazy" width={400} height={240} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{vehicle.name}</h2>
                    <p className="text-gray-500 text-sm mt-0.5">{vehicle.desc}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-400 mb-0.5">{isRoundtrip ? 'Hin- & Rückfahrt' : 'Gesamtpreis'}</div>
                    {hasCorpDiscount && (
                      <div className="text-sm text-gray-400 line-through">{formatPrice(originalPrice)}</div>
                    )}
                    <div className="text-3xl font-bold text-primary-600">{formatPrice(companyPrice)}</div>
                    {hasCorpDiscount && (
                      <div className="flex items-center gap-1 justify-end mt-0.5">
                        <Tag size={11} className="text-green-600" />
                        <span className="text-xs text-green-600 font-bold">{corpPct}% Firmenrabatt</span>
                      </div>
                    )}
                    {anfahrtCost > 0 && (
                      <div className="text-xs text-amber-600 font-medium mt-0.5">inkl. {formatPrice(anfahrtCost)} Anfahrtskosten</div>
                    )}
                    <div className="text-xs text-green-600 font-semibold mt-0.5">✅ Festpreis garantiert</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Users size={15} className="text-primary-400" />
                    <span>Bis zu {priceData.max_passengers ?? vehicle.maxPassengers} Passagiere</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Luggage size={15} className="text-primary-400" />
                    <span>{priceData.max_luggage ?? vehicle.maxLuggage} Gepäckstücke</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={15} className="text-primary-400" />
                    <span>ca. {duration} Min. Fahrtzeit</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full">
                    <CheckCircle size={10} /> Festpreis
                  </span>
                  <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full">
                    <CheckCircle size={10} /> Kostenloser Storno bis 3 Std.
                  </span>
                  {isRoundtrip && rtDiscount > 0 && (!corpPct || company.discount_kombinierbar) && (
                    <span className="flex items-center gap-1 text-xs bg-gold-50 text-gold-700 border border-gold-200 px-2.5 py-1 rounded-full font-semibold">
                      <Tag size={10} /> {rtDiscount}% Hin- & Rückfahrt Rabatt
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  {tooMany ? (
                    <p className="text-sm text-red-500 font-medium">⚠️ Nicht geeignet für {passengers} Personen</p>
                  ) : (
                    <button
                      onClick={() => onSelect({
                        vehicle: vehicle.type,
                        estimatedPrice: companyPrice,
                        originalPrice,
                        anfahrtCost,
                        tollAmount: onewayToll,
                      })}
                      className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
                    >
                      Dieses Fahrzeug buchen <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        ℹ️ Alle Preise sind Festpreise inklusive Maut, Gepäck und Kindersitz. Der exakte Endpreis wird bei Buchungsbestätigung final berechnet.
      </div>
    </div>
  );
}
