'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '@/components/portal/PortalShell';
import SearchBar from '@/components/SearchBar';
import PortalVehicleSelect, { VehicleSelection } from '@/components/portal/PortalVehicleSelect';
import { portalApi } from '@/lib/portalApi';
import { Send, Star, Trash2, CheckCircle, MapPin, ArrowRight, Calendar, Car, Pencil, Tag, Sparkles } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

type Step = 'search' | 'vehicle' | 'form';

const VEHICLE_NAMES: Record<string, string> = { kombi: 'Kombi', van: 'Van / Minibus', grossraumtaxi: 'Großraumtaxi' };

function BookWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('search');
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);
  const [selection, setSelection] = useState<VehicleSelection | null>(null);

  const [favorites, setFavorites] = useState<any[]>([]);
  const [favInit, setFavInit] = useState<{ pickup: string; dropoff: string } | null>(null);
  const [searchKey, setSearchKey] = useState(0);

  const [company, setCompany] = useState<{
    discount_percent: number; discount_kombinierbar: boolean; pg_discount_override: boolean;
    allowed_payment_methods: string[]; user_email: string;
    has_saved_card: boolean; card_brand?: string; card_last4?: string;
  } | null>(null);

  // Form fields (step 3)
  const [form, setForm] = useState({
    name: '', phone: '', email: '', cost_center: '', flight_number: '',
    pickup_sign: '', notes: '', payment_method: '',
  });
  const [childSeat, setChildSeat] = useState(false);
  const [childSeatBabyschale, setChildSeatBabyschale] = useState(0);
  const [childSeatKindersitz, setChildSeatKindersitz] = useState(0);
  const [childSeatSitzerhoehung, setChildSeatSitzerhoehung] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saveFavLabel, setSaveFavLabel] = useState('');
  const [showFavSave, setShowFavSave] = useState(false);
  const [favSaved, setFavSaved] = useState(false);

  const loadMeta = useCallback(async () => {
    const [meRes, favRes] = await Promise.all([portalApi.me(), portalApi.favorites()]);
    if (meRes.ok) {
      const me = await meRes.json();
      const methods = (me.allowed_payment_methods || 'cash,card').split(',').map((m: string) => m.trim()).filter(Boolean);
      setCompany({
        discount_percent: Number(me.discount_percent) || 0,
        discount_kombinierbar: !!me.discount_kombinierbar,
        pg_discount_override: !!me.pg_discount_override,
        allowed_payment_methods: methods,
        user_email: me.email || '',
        has_saved_card: !!me.has_saved_card,
        card_brand: me.card_brand,
        card_last4: me.card_last4,
      });
      if (methods.length === 1) setForm(f => ({ ...f, payment_method: methods[0] }));
    }
    if (favRes.ok) setFavorites(await favRes.json());
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const applyFavorite = (fav: any) => {
    setFavInit({ pickup: fav.pickup_address, dropoff: fav.dropoff_address });
    setSearchKey(k => k + 1); // remount SearchBar with new initialValues
  };

  const handleDeleteFavorite = async (id: number) => {
    await portalApi.deleteFavorite(id);
    const res = await portalApi.favorites(); if (res.ok) setFavorites(await res.json());
  };

  const handleSaveFavorite = async () => {
    if (!saveFavLabel || !searchParams) return;
    await portalApi.addFavorite({
      label: saveFavLabel,
      pickup_address: searchParams.get('pickup') || '',
      dropoff_address: searchParams.get('dropoff') || '',
      vehicle_type: selection?.vehicle || 'kombi',
    });
    setShowFavSave(false); setSaveFavLabel(''); setFavSaved(true);
    const res = await portalApi.favorites(); if (res.ok) setFavorites(await res.json());
  };

  const buildChildSeatDetails = (): string => {
    const parts: string[] = [];
    if (childSeatBabyschale > 0) parts.push(`${childSeatBabyschale}× Babyschale`);
    if (childSeatKindersitz > 0) parts.push(`${childSeatKindersitz}× Kindersitz`);
    if (childSeatSitzerhoehung > 0) parts.push(`${childSeatSitzerhoehung}× Sitzerhöhung`);
    return parts.join(', ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchParams || !selection) return;
    const effectivePaymentMethod = form.payment_method || company?.allowed_payment_methods[0] || 'cash';
    if (effectivePaymentMethod === 'card' && !company?.has_saved_card) {
      setError('Bitte zuerst in den Einstellungen eine Kreditkarte hinterlegen, um mit Karte zu bezahlen.');
      return;
    }
    setError(''); setLoading(true);
    try {
      const date = searchParams.get('date') || '';
      const time = searchParams.get('time') || '';
      const isRoundtrip = (searchParams.get('trip_type') || 'oneway') === 'roundtrip';
      const returnDate = searchParams.get('return_date') || '';
      const returnTime = searchParams.get('return_time') || '';

      const payload: any = {
        pickup_address: searchParams.get('pickup') || '',
        dropoff_address: searchParams.get('dropoff') || '',
        pickup_datetime: `${date}T${time}`,
        vehicle_type: selection.vehicle,
        passengers: searchParams.get('passengers') || '1',
        name: form.name,
        phone: form.phone,
        email: form.email || company?.user_email || '',
        flight_number: form.flight_number,
        pickup_sign: form.pickup_sign,
        notes: form.notes,
        cost_center: form.cost_center,
        payment_method: form.payment_method || company?.allowed_payment_methods[0] || 'cash',
        child_seat: childSeat,
        child_seat_details: childSeat ? buildChildSeatDetails() : undefined,
        distance_km: searchParams.get('distance_km') || '',
        duration_minutes: searchParams.get('duration') || '',
        trip_type: isRoundtrip ? 'roundtrip' : 'oneway',
        language: 'de',
      };
      if (isRoundtrip && returnDate) payload.return_datetime = `${returnDate}T${returnTime}`;
      if (selection.anfahrtCost > 0) payload.anfahrt_cost = selection.anfahrtCost.toFixed(2);
      if (selection.tollAmount > 0) payload.toll_amount = selection.tollAmount.toFixed(2);
      const zw = searchParams.get('zwischenstopp_address');
      if (zw) payload.zwischenstopp_address = zw;

      const res = await portalApi.createBooking(payload);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Buchung fehlgeschlagen'); setLoading(false); return; }
      setSuccess(true);
      setTimeout(() => router.push('/portal/dashboard'), 2000);
    } catch { setError('Verbindungsfehler'); }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle size={48} className="text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Buchung erfolgreich!</h2>
        <p className="text-gray-500 text-sm mt-2">Sie werden zum Dashboard weitergeleitet...</p>
      </div>
    );
  }

  // ── Step indicator ──
  const steps: { id: Step; label: string }[] = [
    { id: 'search', label: 'Route' },
    { id: 'vehicle', label: 'Fahrzeug & Preis' },
    { id: 'form', label: 'Buchungsdetails' },
  ];
  const stepIdx = steps.findIndex(s => s.id === step);

  const pickup = searchParams?.get('pickup') || '';
  const dropoff = searchParams?.get('dropoff') || '';
  const date = searchParams?.get('date') || '';
  const time = searchParams?.get('time') || '';
  const isRoundtrip = (searchParams?.get('trip_type') || 'oneway') === 'roundtrip';
  const isAirportPickup = ['flughafen', 'airport', '85356'].some(kw => pickup.toLowerCase().includes(kw));
  const dateFormatted = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  return (
    <div className={step === 'search' ? 'max-w-6xl mx-auto' : 'max-w-4xl mx-auto'}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Neue Buchung</h1>
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              {i > 0 && <div className={`w-6 h-0.5 ${i <= stepIdx ? 'bg-primary-500' : 'bg-gray-200'}`} />}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                i === stepIdx ? 'bg-primary-600 text-white' : i < stepIdx ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'
              }`}>
                <span className="font-bold">{i + 1}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ STEP 1: SEARCH ══ */}
      {step === 'search' && (
        <div className="bg-gradient-to-br from-[#0c2d48] via-[#123a5c] to-[#0c2d48] rounded-3xl p-6 sm:p-10 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <Sparkles size={13} /> Firmenkunden-Konditionen{company && company.discount_percent > 0 ? ` · ${company.discount_percent}% Rabatt` : ''}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Wohin soll die Fahrt gehen?</h2>
            <p className="text-blue-200 text-sm">Adresse, Datum und Personenzahl eingeben — im nächsten Schritt sehen Sie Fahrzeuge und Festpreise.</p>
          </div>

          {favorites.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-medium text-blue-200 mb-2 text-center">Favoriten — antippen zum Übernehmen</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {favorites.map(f => (
                  <div key={f.id} className="flex items-center gap-1">
                    <button onClick={() => applyFavorite(f)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/20 text-amber-200 rounded-lg text-sm hover:bg-white/20 transition-colors">
                      <Star size={12} className="fill-amber-300 text-amber-300" /> {f.label}
                    </button>
                    <button onClick={() => handleDeleteFavorite(f.id)} className="p-1 text-blue-300/60 hover:text-red-300">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <SearchBar
            key={searchKey}
            initialValues={favInit ? {
              pickup: favInit.pickup, dropoff: favInit.dropoff,
              date: '', time: '10:00', passengers: 2, hasReturn: false,
            } : undefined}
            onSearchComplete={params => { setSearchParams(params); setStep('vehicle'); }}
          />

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-xs text-blue-200">
            <span className="flex items-center gap-1.5">✅ Festpreis garantiert</span>
            <span className="flex items-center gap-1.5">✅ Kostenloser Storno bis 3 Std.</span>
            <span className="flex items-center gap-1.5">✅ Zahlung auf Rechnung möglich</span>
          </div>
        </div>
      )}

      {/* ══ STEP 2: VEHICLE & PRICE ══ */}
      {step === 'vehicle' && searchParams && company && (
        <PortalVehicleSelect
          searchParams={searchParams}
          company={company}
          onBack={() => setStep('search')}
          onSelect={sel => { setSelection(sel); setStep('form'); }}
        />
      )}

      {/* ══ STEP 3: CORPORATE BOOKING FORM ══ */}
      {step === 'form' && searchParams && selection && (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="bg-[#0c2d48] text-white rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-green-400" />
                <span className="font-medium max-w-[180px] truncate">{pickup}</span>
                <ArrowRight size={13} className="text-blue-300" />
                <MapPin size={14} className="text-red-400" />
                <span className="font-medium max-w-[180px] truncate">{dropoff}</span>
              </div>
              <span className="flex items-center gap-1 text-blue-200 text-xs">
                <Calendar size={12} /> {dateFormatted} · {time} {isRoundtrip && <span className="text-amber-400 font-semibold ml-1">⇄</span>}
              </span>
              <span className="flex items-center gap-1 text-blue-200 text-xs">
                <Car size={12} /> {VEHICLE_NAMES[selection.vehicle] || selection.vehicle}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <div className="text-right">
                  <span className="text-lg font-bold">{formatPrice(selection.estimatedPrice)}</span>
                  {company && company.discount_percent > 0 && selection.estimatedPrice < selection.originalPrice && (
                    <span className="ml-2 text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full font-medium">
                      <Tag size={9} className="inline mr-0.5" />{company.discount_percent}% Rabatt
                    </span>
                  )}
                </div>
                <button onClick={() => setStep('vehicle')}
                  className="flex items-center gap-1 text-xs text-blue-200 hover:text-white border border-white/20 rounded-lg px-2 py-1 transition-colors">
                  <Pencil size={11} /> Ändern
                </button>
              </div>
            </div>

            {/* Save as favorite */}
            <div className="mt-3 pt-3 border-t border-white/10">
              {favSaved ? (
                <p className="text-xs text-green-300 flex items-center gap-1"><CheckCircle size={12} /> Diese Route ist jetzt ein Favorit</p>
              ) : !showFavSave ? (
                <button type="button" onClick={() => setShowFavSave(true)}
                  className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 font-medium">
                  <Star size={12} className="fill-amber-300" /> Diese Route als Favorit speichern
                </button>
              ) : (
                <div className="flex gap-2">
                  <input type="text" placeholder="Favoritenname (z.B. Hotel → Flughafen)" value={saveFavLabel} onChange={e => setSaveFavLabel(e.target.value)}
                    className="flex-1 border border-white/20 bg-white/10 text-white placeholder:text-blue-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-amber-300" />
                  <button type="button" onClick={handleSaveFavorite} className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">Speichern</button>
                  <button type="button" onClick={() => setShowFavSave(false)} className="px-2 py-1.5 text-blue-200 text-sm">×</button>
                </div>
              )}
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            {/* Guest info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Gastname *</label>
                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Telefon *</label>
                <input type="tel" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">E-Mail des Gastes <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Leer = Bestätigung an Ihr Firmenkonto" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Kostenstelle / Referenz</label>
                <input type="text" value={form.cost_center} onChange={e => setForm({ ...form, cost_center: e.target.value })}
                  className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="z.B. Zimmer 305, Abt. Marketing" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {isAirportPickup && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Flugnummer</label>
                  <input type="text" value={form.flight_number} onChange={e => setForm({ ...form, flight_number: e.target.value })}
                    className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="z.B. TK1629" />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">Namensschild</label>
                <input type="text" value={form.pickup_sign} onChange={e => setForm({ ...form, pickup_sign: e.target.value })}
                  className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Name auf dem Abholschild" />
              </div>
            </div>

            {/* Kindersitz */}
            <div className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👶</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Kindersitz</p>
                    <p className="text-xs text-green-600 font-medium">Kostenlos</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newVal = !childSeat;
                    setChildSeat(newVal);
                    if (!newVal) { setChildSeatBabyschale(0); setChildSeatKindersitz(0); setChildSeatSitzerhoehung(0); }
                  }}
                  className={`w-12 h-7 rounded-full transition-colors relative ${childSeat ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${childSeat ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {childSeat && (
                <div className="mt-3 bg-green-50 rounded-xl p-4 border border-green-100 space-y-3">
                  <p className="text-xs text-gray-500 font-medium mb-2">Bitte wählen Sie die benötigten Kindersitze:</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Babyschale</p>
                      <p className="text-xs text-gray-400">0–12 Monate</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setChildSeatBabyschale(c => Math.max(0, c - 1))} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">−</button>
                      <span className="w-5 text-center text-sm font-bold text-gray-800">{childSeatBabyschale}</span>
                      <button type="button" onClick={() => setChildSeatBabyschale(c => Math.min(3, c + 1))} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">+</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Kindersitz</p>
                      <p className="text-xs text-gray-400">1–4 Jahre, bis 18 kg</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setChildSeatKindersitz(c => Math.max(0, c - 1))} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">−</button>
                      <span className="w-5 text-center text-sm font-bold text-gray-800">{childSeatKindersitz}</span>
                      <button type="button" onClick={() => setChildSeatKindersitz(c => Math.min(3, c + 1))} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">+</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Sitzerhöhung</p>
                      <p className="text-xs text-gray-400">4–12 Jahre, bis 36 kg</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setChildSeatSitzerhoehung(c => Math.max(0, c - 1))} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">−</button>
                      <span className="w-5 text-center text-sm font-bold text-gray-800">{childSeatSitzerhoehung}</span>
                      <button type="button" onClick={() => setChildSeatSitzerhoehung(c => Math.min(3, c + 1))} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">+</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment method */}
            {company && company.allowed_payment_methods.length > 1 && (
              <div>
                <label className="text-sm font-medium text-gray-700">Zahlungsart</label>
                <div className="flex gap-2 mt-1">
                  {company.allowed_payment_methods.map(m => {
                    const labels: Record<string, string> = { cash: 'Barzahlung', card: 'Kreditkarte', rechnung: 'Auf Rechnung' };
                    const cardDisabled = m === 'card' && !company.has_saved_card;
                    return (
                      <button key={m} type="button" disabled={cardDisabled}
                        onClick={() => setForm({ ...form, payment_method: m })}
                        title={cardDisabled ? 'Bitte zuerst in den Einstellungen eine Kreditkarte hinterlegen' : undefined}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${form.payment_method === m ? 'border-primary-500 bg-primary-50 text-primary-700' : cardDisabled ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {labels[m] || m}
                      </button>
                    );
                  })}
                </div>
                {form.payment_method === 'card' && company.has_saved_card && (
                  <p className="mt-2 text-xs text-gray-500">
                    Wird mit hinterlegter {company.card_brand?.toUpperCase()}-Karte •••• {company.card_last4} bezahlt.
                  </p>
                )}
                {company.allowed_payment_methods.includes('card') && !company.has_saved_card && (
                  <p className="mt-2 text-xs text-amber-600">
                    Für Kartenzahlung bitte zuerst in den <a href="/portal/settings" className="underline">Einstellungen</a> eine Kreditkarte hinterlegen.
                  </p>
                )}
              </div>
            )}
            {company && company.allowed_payment_methods.length === 1 && company.allowed_payment_methods[0] === 'card' && (
              company.has_saved_card ? (
                <p className="text-xs text-gray-500">
                  Wird mit hinterlegter {company.card_brand?.toUpperCase()}-Karte •••• {company.card_last4} bezahlt.
                </p>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-3">
                  Für Kartenzahlung bitte zuerst in den <a href="/portal/settings" className="underline">Einstellungen</a> eine Kreditkarte hinterlegen.
                </p>
              )
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">Anmerkungen</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-[#0c2d48] text-white py-3 rounded-xl font-semibold hover:bg-[#0a2540] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {loading
                ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                : <><Send size={18} /> Jetzt buchen — {formatPrice(selection.estimatedPrice)}</>}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function BookPage() {
  return (
    <PortalShell>
      {/* SearchBar uses useSearchParams → needs Suspense boundary */}
      <Suspense fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <BookWizard />
      </Suspense>
    </PortalShell>
  );
}
