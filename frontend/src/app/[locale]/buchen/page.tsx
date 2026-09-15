'use client';

import { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { MapPin, ArrowRight, Calendar, Users, Car, User, UserRound, Phone, Mail, Plane, CreditCard, Banknote, CheckCircle, AlertCircle, Loader2, Luggage, ChevronLeft, Signpost, Baby, Bike, StickyNote, Map, Moon, PartyPopper, Ban, BadgeEuro, Tag, Lock, FileText, Check, X, Minus, Plus, Info, MessageSquare, Star, ArrowLeftRight, Pencil, Clock, CalendarDays, Flame, Headphones } from 'lucide-react';
import { formatPrice, cn, CONTACT_INFO, addressIcon } from '@/lib/utils';
import SocialProofToast from '@/components/SocialProofToast';
import RouteMap from '@/components/RouteMap';
import CardPaymentField, { CardPaymentFieldHandle, CardPaymentResult } from '@/components/booking/CardPaymentField';
import PhoneInput from '@/components/booking/PhoneInput';
import { parsePhone, toSubmitValue, DEFAULT_COUNTRY } from '@/lib/phone';
import { assignVariant } from '@/lib/experiment';
import Countdown from '@/components/discount/Countdown';
import { PublicAutoDiscount, pickDiscountLabel, formatRemainingSpots } from '@/components/discount/format';
import type { CountryCode } from 'libphonenumber-js/max';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

const VEHICLE_LABELS: Record<string, Record<string, string>> = {
  kombi: { de: 'Kombi', en: 'Sedan', tr: 'Kombi' },
  van: { de: 'Van / Minibus', en: 'Van / Minibus', tr: 'Van / Minibüs' },
  grossraumtaxi: { de: 'Großraumtaxi', en: 'Large Taxi', tr: 'Büyük Taksi' },
};

const VEHICLE_IMAGES: Record<string, string> = {
  kombi: '/images/kombi.webp',
  van: '/images/van.webp',
  grossraumtaxi: '/images/grossraumtaxi.webp',
};

const VEHICLE_DESC: Record<string, Record<string, string>> = {
  kombi: { de: 'Ideal für Einzelreisende & Paare', en: 'Ideal for solo travelers & couples', tr: 'Bireysel yolcular ve çiftler için ideal' },
  van: { de: 'Perfekt für Familien & Gruppen', en: 'Perfect for families & groups', tr: 'Aileler ve gruplar için mükemmel' },
  grossraumtaxi: { de: 'Für große Gruppen mit viel Gepäck', en: 'For large groups with lots of luggage', tr: 'Çok bavullu büyük gruplar için' },
};

type IconType = typeof User;

// Umrandetes Eingabefeld mit Icon links und Label über dem Wert (Buchungsformular).
// Außerhalb von BuchenContent definiert, damit Inputs beim Re-Render nicht neu gemountet werden.
function FieldBox({ icon: Icon, label, required, error, hasError, as = 'div', children }: {
  icon: IconType; label: string; required?: boolean; error?: string; hasError?: boolean;
  as?: 'div' | 'label'; children: React.ReactNode;
}) {
  const Tag = as;
  return (
    <div>
      <Tag className={cn(
        'flex items-center gap-3.5 bg-white border rounded-xl px-4 py-2.5 min-h-[64px] transition-colors',
        'focus-within:border-gold-400 focus-within:ring-2 focus-within:ring-gold-400/30',
        error || hasError ? 'border-red-400' : 'border-gray-200'
      )}>
        <Icon size={22} className="shrink-0 text-gray-900" strokeWidth={1.8} />
        <div className="flex-1 min-w-0">
          <span className="block text-[13px] text-gray-800">{label}{required && <span className="text-red-500"> *</span>}</span>
          {children}
        </div>
      </Tag>
      {error && <p className="text-red-500 text-xs mt-1 ml-1">{error}</p>}
    </div>
  );
}

function OptionRow({ checked, onToggle, icon: Icon, title, sub }: {
  checked: boolean; onToggle: () => void; icon: IconType; title: string; sub: string;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onToggle} className="w-full flex items-center gap-4 px-4 py-3 text-left">
      <span className={cn('flex items-center justify-center w-5 h-5 rounded border-2 shrink-0 transition-colors', checked ? 'bg-primary-800 border-primary-800' : 'border-gray-400 bg-white')}>
        {checked && <Check size={13} strokeWidth={3.5} className="text-white" />}
      </span>
      <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 shrink-0">
        <Icon size={20} className="text-gray-900" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-gray-900">{title}</span>
        <span className="block text-xs text-gray-600 mt-0.5 truncate">{sub}</span>
      </span>
    </button>
  );
}

function Counter({ value, onChange, max }: { value: number; onChange: (fn: (v: number) => number) => void; max: number }) {
  return (
    <div className="flex items-stretch border border-gray-200 rounded-lg overflow-hidden bg-white shrink-0">
      <button type="button" aria-label="−" onClick={() => onChange(c => Math.max(0, c - 1))} className="w-8 h-8 flex items-center justify-center text-gray-800 hover:bg-gray-50"><Minus size={14} /></button>
      <span className="w-8 flex items-center justify-center text-sm font-semibold text-gray-900 border-x border-gray-200">{value}</span>
      <button type="button" aria-label="+" onClick={() => onChange(c => Math.min(max, c + 1))} className="w-8 h-8 flex items-center justify-center text-gray-800 hover:bg-gray-50"><Plus size={14} /></button>
    </div>
  );
}

function BuchenContent() {
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
  const vehicle = params.get('vehicle') || 'kombi';
  const basePrice = Number(params.get('price') || 0);
  const pickupLat = params.get('pickup_lat');
  const pickupLng = params.get('pickup_lng');
  const dropoffLat = params.get('dropoff_lat');
  const dropoffLng = params.get('dropoff_lng');
  const tollAmount = Number(params.get('toll_amount') || 0);

  const dateFormatted = date
    ? new Date(date + 'T00:00:00').toLocaleDateString(
        locale === 'en' ? 'en-GB' : locale === 'tr' ? 'tr-TR' : 'de-DE',
        { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }
      )
    : '';

  const vehicleLabel = VEHICLE_LABELS[vehicle]?.[locale] || VEHICLE_LABELS[vehicle]?.de || vehicle;

  // Anfahrtskosten from URL params
  const anfahrtCost = Number(params.get('anfahrt_cost') || 0);

  // Airport transfer filter — redirect if neither address is airport area (unless stadtfahrt enabled)
  const isAirportArea = (addr: string) => {
    const lower = addr.toLowerCase();
    return ['flughafen münchen', 'munich airport', 'münchen-flughafen', 'munchen-flughafen', '85356', 'oberding', 'hallbergmoos', 'freising'].some(kw => lower.includes(kw));
  };
  const [stadtfahrtEnabled, setStadtfahrtEnabled] = useState(false);
  const [zwischenstoppEnabled, setZwischenstoppEnabled] = useState(false);
  const [nightConfirmEnabled, setNightConfirmEnabled] = useState(true);
  const [nightStart, setNightStart] = useState(22);
  const [nightEnd, setNightEnd] = useState(7);
  const [flightValidationEnabled, setFlightValidationEnabled] = useState(true);
  const [phoneValidationEnabled, setPhoneValidationEnabled] = useState(true);
  // checkout_v2 A/B variant — computed client-side (synchronous, same hash as the
  // server) so there's no flash of variant A before a network round trip resolves.
  // The server independently recomputes and persists the authoritative variant from
  // visitor_id at booking time (backend/src/routes/bookings.ts) — this is display-only.
  const [checkoutV2, setCheckoutV2] = useState(false);
  useEffect(() => {
    fetch(`${API_URL}/settings`).then(r => r.json()).then(s => {
      if (s.stadtfahrt_enabled === '1') setStadtfahrtEnabled(true);
      if (s.zwischenstopp_enabled === '1') setZwischenstoppEnabled(true);
      if (s.night_confirm_enabled === '0') setNightConfirmEnabled(false);
      if (s.night_confirm_start) setNightStart(parseInt(s.night_confirm_start, 10));
      if (s.night_confirm_end) setNightEnd(parseInt(s.night_confirm_end, 10));
      if (s.flight_validation_enabled === '0') setFlightValidationEnabled(false);
      if (s.phone_validation_enabled === '0') setPhoneValidationEnabled(false);
      const visitorId = typeof localStorage !== 'undefined' ? localStorage.getItem('mt_visitor_id') : null;
      setCheckoutV2(assignVariant(visitorId, 'checkout_v2', s.experiment_checkout_v2) === 'b');
    }).catch(() => {}).finally(() => setSettingsLoaded(true));
  }, []);

  // Show the safety notice only when BOTH the booking arrives during the night
  // window (current Munich time, owner likely asleep) AND the trip departs during
  // the night window (owner can't dispatch in time). We are open 24/7, this is
  // just a guarantee for genuinely late-hour trips.
  const inNightWindow = (h: number): boolean => {
    if (isNaN(h) || nightStart === nightEnd) return false;
    return nightStart < nightEnd ? (h >= nightStart && h < nightEnd) : (h >= nightStart || h < nightEnd);
  };
  const munichHourNow = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(new Date()), 10);
  const pickupHour = time ? parseInt(time.split(':')[0], 10) : NaN;
  const isNightBooking = nightConfirmEnabled && inNightWindow(munichHourNow) && inNightWindow(pickupHour);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Zwischenstopp state (only for buchen-page-added stops)
  const zwischenstoppFromErgebnisse = !!params.get('zwischenstopp_address');
  const [localZwischenstopp, setLocalZwischenstopp] = useState('');
  const [localZwischenstoppDistanceKm, setLocalZwischenstoppDistanceKm] = useState(0);
  const [localZwischenstoppDuration, setLocalZwischenstoppDuration] = useState(0);
  const [localZwischenstoppBasePrice, setLocalZwischenstoppBasePrice] = useState(0);
  const [showZwischenstoppPicker, setShowZwischenstoppPicker] = useState(false);
  const [zwischenstoppInput, setZwischenstoppInput] = useState('');
  const [zwischenstoppSuggestions, setZwischenstoppSuggestions] = useState<any[]>([]);
  const [zwischenstoppLoading, setZwischenstoppLoading] = useState(false);

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
  useEffect(() => {
    if (!settingsLoaded) return;
    if (pickup && dropoff && !isAirportArea(pickup) && !isAirportArea(dropoff) && !stadtfahrtEnabled) {
      router.replace(`/${locale}`);
    }
  }, [pickup, dropoff, locale, router, stadtfahrtEnabled, settingsLoaded]);

  // Form state
  // Vor- und Nachname getrennt erfasst, ans Backend geht weiterhin ein kombiniertes `name`.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  // `phone` holds only the national part — the dial code lives in `phoneCountry`,
  // shown in its own control inside PhoneInput.
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const phoneResult = useMemo(() => parsePhone(phone, phoneCountry), [phone, phoneCountry]);
  const [email, setEmail] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [flightCheckStatus, setFlightCheckStatus] = useState<'idle' | 'checking' | 'found' | 'wrongairport' | 'notfound'>('idle');
  const [flightCheckResult, setFlightCheckResult] = useState<{ airline?: string; origin?: string; scheduledArrival?: string; arrivesMUC?: boolean } | null>(null);
  const flightCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flightCheckAbort = useRef<AbortController | null>(null);
  const [pickupSign, setPickupSign] = useState('');
  const [luggageCount, setLuggageCount] = useState(1);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [payment, setPayment] = useState<'cash' | 'card'>('cash');
  const paramTripType = params.get('trip_type') || 'oneway';
  const paramReturnDate = params.get('return_date') || '';
  const paramReturnTime = params.get('return_time') || '10:00';
  const roundtripFromErgebnisse = paramTripType === 'roundtrip' && !!paramReturnDate;
  const [tripType, setTripType] = useState<'oneway' | 'roundtrip'>(paramTripType === 'roundtrip' ? 'roundtrip' : 'oneway');
  const [returnDate, setReturnDate] = useState(paramReturnDate);
  const [returnTime, setReturnTime] = useState(paramReturnTime);
  // Extras
  const [childSeat, setChildSeat] = useState(false);
  const [childSeatDetails, setChildSeatDetails] = useState('');
  const [childSeatBabyschale, setChildSeatBabyschale] = useState(0);
  const [childSeatKindersitz, setChildSeatKindersitz] = useState(0);
  const [childSeatSitzerhoehung, setChildSeatSitzerhoehung] = useState(0);
  const [fahrradCount, setFahrradCount] = useState(0);
  const [fahrradEnabled, setFahrradEnabled] = useState(false);
  const [fahrradPrice, setFahrradPrice] = useState(0);
  // Optional company invoice: customer supplies their own billing address, which the
  // backend mails as a PDF once the ride is over (see autoRechnungJob).
  const [rechnungRequired, setRechnungRequired] = useState(false);
  const [rechnungAdresse, setRechnungAdresse] = useState('');
  const [showRechnungModal, setShowRechnungModal] = useState(false);
  const [rechnungDraft, setRechnungDraft] = useState('');
  const [showRechnungBeispiel, setShowRechnungBeispiel] = useState(false);
  const [maxLuggage, setMaxLuggage] = useState(10);
  const [maxPassengers, setMaxPassengers] = useState<number | null>(null);
  const [roundtripDiscount, setRoundtripDiscount] = useState(5);
  const [vehiclePriceConfig, setVehiclePriceConfig] = useState<{ base_price: number; price_per_km: number; min_price: number; min_price_km: number } | null>(null);

  // Fetch vehicle price config (fahrrad_enabled etc.)
  useEffect(() => {
    async function fetchVehicleConfig() {
      try {
        const res = await fetch(`${API_URL}/prices/${vehicle}`);
        if (res.ok) {
          const data = await res.json();
          setFahrradEnabled(data.fahrrad_enabled === 1);
          setFahrradPrice(data.fahrrad_price || 0);
          setMaxLuggage(data.max_luggage ?? 10);
          if (data.max_passengers) setMaxPassengers(data.max_passengers);
          setRoundtripDiscount(data.roundtrip_discount || 5);
          setVehiclePriceConfig({
            base_price: data.base_price || 0,
            price_per_km: data.price_per_km || 0,
            min_price: data.min_price || 0,
            min_price_km: data.min_price_km || 15,
          });
        }
      } catch { /* ignore */ }
    }
    fetchVehicleConfig();
  }, [vehicle]);

  // Dynamic total price including extras and roundtrip
  const oneWayPrice = localZwischenstoppBasePrice > 0 ? localZwischenstoppBasePrice : basePrice;
  const roundtripPrice = oneWayPrice * 2 * (1 - roundtripDiscount / 100);
  const price = (tripType === 'roundtrip' ? roundtripPrice : oneWayPrice) + (fahrradCount * fahrradPrice) + anfahrtCost;
  const effectiveDistanceKm = localZwischenstoppDistanceKm > 0 ? localZwischenstoppDistanceKm : distanceKm;
  const effectiveDuration = localZwischenstoppDuration > 0 ? localZwischenstoppDuration : duration;

  const cardFieldRef = useRef<CardPaymentFieldHandle>(null);
  const [cardResult, setCardResult] = useState<CardPaymentResult | null>(null);
  const [cardSubmitting, setCardSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'review' | 'loading' | 'success' | 'error'>('idle');
  const [bookingNumber, setBookingNumber] = useState('');
  const [confirmedPrice, setConfirmedPrice] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Promo code state
  const [activePromo, setActivePromo] = useState<{ code: string; type: string; value: number } | null>(null);
  const [hasAnyActivePromo, setHasAnyActivePromo] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountAmount: number; promoBase: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/promotions/active`)
      .then(r => r.json())
      .then(d => { if (d?.code) setActivePromo(d); })
      .catch(() => {});
    fetch(`${API_URL}/promotions/has-active`)
      .then(r => r.json())
      .then(d => { if (d?.hasCodePromo) setHasAnyActivePromo(true); })
      .catch(() => {});
  }, []);

  const discountAmount = appliedPromo?.discountAmount ?? 0;
  const promoBase = appliedPromo?.promoBase ?? price;
  const finalPrice = Math.max(0, promoBase - discountAmount);

  // Automatische Rabatte (Rabatte-Tab, kein Code nötig) — Vorschau vom Server,
  // damit Anzeige und tatsächliche Abrechnung immer übereinstimmen.
  const [autoDiscount, setAutoDiscount] = useState<PublicAutoDiscount | null>(null);
  const [discountRefresh, setDiscountRefresh] = useState(0); // Countdown abgelaufen → neu prüfen
  // Solange die erste Prüfung für diese Route noch läuft, wird der Preis nicht gezeigt —
  // sonst blitzt kurz der (falsche) Preis ohne Rabatt auf, bevor der Rabatt nachträglich
  // abgezogen wird ("92€ → 87€"-Flackern).
  const [autoDiscountReady, setAutoDiscountReady] = useState(false);
  useEffect(() => {
    if (!distanceKm || distanceKm <= 0) { setAutoDiscount(null); setAutoDiscountReady(true); return; }
    setAutoDiscountReady(false);
    const visitorId = typeof localStorage !== 'undefined' ? localStorage.getItem('mt_visitor_id') : null;
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`${API_URL}/bookings/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          vehicle_type: vehicle,
          distance_km: effectiveDistanceKm,
          pickup_lat: pickupLat, pickup_lng: pickupLng,
          dropoff_lat: dropoffLat, dropoff_lng: dropoffLng,
          pickup_address: pickup, dropoff_address: dropoff,
          visitor_id: visitorId,
          email: email || undefined,
          pickup_datetime: date && time ? `${date}T${time}` : undefined,
          trip_type: tripType,
        }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => setAutoDiscount(d?.auto_discount || null))
        .catch(() => {})
        .finally(() => setAutoDiscountReady(true));
    }, 0);
    return () => { clearTimeout(t); controller.abort(); };
  }, [vehicle, effectiveDistanceKm, pickupLat, pickupLng, dropoffLat, dropoffLng, pickup, dropoff, date, time, tripType, email, discountRefresh]);

  // Backend wendet serverseitig nur den größeren von Promo-Code und Auto-Rabatt an —
  // Anzeige spiegelt das, indem der Auto-Rabatt nur ohne aktiven Promo-Code gezeigt wird.
  const autoDiscountAmount = (autoDiscount && !appliedPromo) ? autoDiscount.amount : 0;
  const finalPriceWithAutoDiscount = Math.max(0, finalPrice - autoDiscountAmount);
  const autoDiscountLabel = autoDiscount ? pickDiscountLabel(autoDiscount, locale) : '';
  const autoDiscountRed = !!autoDiscount && autoDiscount.badge !== 'classic';
  const autoDiscountRemaining = autoDiscount ? formatRemainingSpots(autoDiscount.remaining, locale) : null;
  const onAutoDiscountExpire = () => setDiscountRefresh(n => n + 1);

  const t: Record<string, Record<string, string>> = {
    de: { title: 'Ihre Angaben', summary: 'Buchungsübersicht', name: 'Name *', phone: 'Handynummer *', email: 'E-Mail *', flight: 'Flugnummer (optional)', flightRequired: 'Flugnummer *', flightChecking: 'Flug wird geprüft...', flightConfirmed: 'Flug bestätigt', flightNotFound: 'Flug nicht gefunden – bitte Flugnummer prüfen', flightWrongAirport: 'Dieser Flug landet laut Daten nicht in München (MUC) – bitte Flugnummer prüfen', flightArrival: 'Ankunft', luggage: 'Gepäckstücke', notes: 'Anmerkungen', payment: 'Zahlungsmethode', cash: 'Barzahlung', card: 'Kreditkarte', cardHolder: 'Karteninhaber', cardNumber: 'Kartennummer', cardExpiry: 'Gültig bis', cardCvv: 'CVV', oneway: 'Einfache Fahrt', roundtrip: 'Hin & Rückfahrt', returnDate: 'Rückfahrtdatum', returnTime: 'Rückfahrtzeit', submit: 'Weiter zur Überprüfung', submitting: 'Wird gebucht...', success_title: 'Buchung erfolgreich!', success_msg: 'Ihre Buchung wurde bestätigt. Sie erhalten in Kürze eine Bestätigungs-E-Mail an', new_booking: 'Neue Buchung', back: 'Zurück zur Fahrzeugauswahl', err_name: 'Name erforderlich', err_phone: 'Telefon erforderlich', err_email: 'Gültige E-Mail erforderlich', err_card: 'Kartendetails erforderlich', err_submit: 'Fehler beim Senden. Bitte versuchen Sie es erneut.', review_title: 'Buchung überprüfen', review_subtitle: 'Bitte überprüfen Sie Ihre Angaben, bevor Sie die Buchung bestätigen.', review_route: 'Strecke', review_datetime: 'Datum & Uhrzeit', review_vehicle: 'Fahrzeug', review_contact: 'Kontaktdaten', review_payment_label: 'Zahlung', review_confirm: 'Jetzt verbindlich buchen', review_edit: 'Angaben bearbeiten', review_persons: 'Personen', review_luggage_label: 'Gepäck', review_notes_label: 'Anmerkungen', review_flight_label: 'Flugnummer' },
    en: { title: 'Your details', summary: 'Booking summary', name: 'Name *', phone: 'Mobile number *', email: 'Email *', flight: 'Flight number (optional)', flightRequired: 'Flight number *', flightChecking: 'Checking flight...', flightConfirmed: 'Flight confirmed', flightNotFound: 'Flight not found – please check the flight number', flightWrongAirport: 'This flight does not appear to land in Munich (MUC) – please check the flight number', flightArrival: 'Arrival', luggage: 'Pieces of luggage', notes: 'Notes', payment: 'Payment method', cash: 'Cash', card: 'Credit card', cardHolder: 'Card holder', cardNumber: 'Card number', cardExpiry: 'Expiry date', cardCvv: 'CVV', oneway: 'One way', roundtrip: 'Round trip', returnDate: 'Return date', returnTime: 'Return time', submit: 'Continue to review', submitting: 'Booking...', success_title: 'Booking confirmed!', success_msg: 'Your booking has been confirmed. You will receive a confirmation email at', new_booking: 'New booking', back: 'Back to vehicle selection', err_name: 'Name required', err_phone: 'Phone required', err_email: 'Valid email required', err_card: 'Card details required', err_submit: 'Error submitting. Please try again.', review_title: 'Review your booking', review_subtitle: 'Please review your details before confirming the booking.', review_route: 'Route', review_datetime: 'Date & Time', review_vehicle: 'Vehicle', review_contact: 'Contact details', review_payment_label: 'Payment', review_confirm: 'Confirm booking', review_edit: 'Edit details', review_persons: 'Passengers', review_luggage_label: 'Luggage', review_notes_label: 'Notes', review_flight_label: 'Flight number' },
    tr: { title: 'Bilgileriniz', summary: 'Rezervasyon özeti', name: 'Ad Soyad *', phone: 'Cep numarası *', email: 'E-posta *', flight: 'Uçuş numarası (isteğe bağlı)', flightRequired: 'Uçuş numarası *', flightChecking: 'Uçuş kontrol ediliyor...', flightConfirmed: 'Uçuş doğrulandı', flightNotFound: 'Uçuş bulunamadı – lütfen uçuş numarasını kontrol edin', flightWrongAirport: 'Bu uçuş verilere göre Münih\'e (MUC) inmiyor – lütfen uçuş numarasını kontrol edin', flightArrival: 'Varış', luggage: 'Bagaj sayısı', notes: 'Notlar', payment: 'Ödeme yöntemi', cash: 'Nakit', card: 'Kredi kartı', cardHolder: 'Kart sahibi', cardNumber: 'Kart numarası', cardExpiry: 'Son kullanma tarihi', cardCvv: 'CVV', oneway: 'Tek yön', roundtrip: 'Gidiş-dönüş', returnDate: 'Dönüş tarihi', returnTime: 'Dönüş saati', submit: 'Kontrol et', submitting: 'Rezervasyon yapılıyor...', success_title: 'Rezervasyon onaylandı!', success_msg: 'Rezervasyonunuz onaylandı. Kısa süre içinde onay e-postası alacaksınız:', new_booking: 'Yeni rezervasyon', back: 'Araç seçimine dön', err_name: 'Ad gerekli', err_phone: 'Telefon gerekli', err_email: 'Geçerli e-posta gerekli', err_card: 'Kart bilgileri gerekli', err_submit: 'Gönderme hatası. Lütfen tekrar deneyin.', review_title: 'Rezervasyonu kontrol edin', review_subtitle: 'Lütfen rezervasyonu onaylamadan önce bilgilerinizi kontrol edin.', review_route: 'Güzergah', review_datetime: 'Tarih & Saat', review_vehicle: 'Araç', review_contact: 'İletişim bilgileri', review_payment_label: 'Ödeme', review_confirm: 'Rezervasyonu onayla', review_edit: 'Bilgileri düzenle', review_persons: 'Kişi', review_luggage_label: 'Bagaj', review_notes_label: 'Notlar', review_flight_label: 'Uçuş numarası' },
  };
  const tx = t[locale] || t.de;

  // Company-invoice strings. Kept in their own dictionary rather than appended to the
  // giant single-line `t` objects above so the block stays readable.
  const rechnungT: Record<string, Record<string, string>> = {
    de: {
      toggle: 'Rechnung für Ihr Unternehmen?',
      toggleHint: 'Mit Firmenname & Anschrift — für die Reisekostenabrechnung',
      modalTitle: 'Rechnungsadresse',
      modalSubtitle: 'Erscheint genau so auf Ihrer Rechnung',
      warning: 'Bitte jede Angabe in eine eigene Zeile schreiben — keine Leerzeilen dazwischen.',
      example: 'Beispiel anzeigen',
      placeholder: 'Firmenname\nVor- und Nachname\nStraße und Hausnummer\nPLZ Ort\nLand',
      save: 'Speichern', cancel: 'Abbrechen',
      saved: 'Rechnungsadresse gespeichert', edit: 'Bearbeiten',
      error: 'Bitte geben Sie Ihre Rechnungsadresse ein',
      recipient: 'RECHNUNGSEMPFÄNGER', country: 'Deutschland',
    },
    en: {
      toggle: 'Invoice for your company?',
      toggleHint: 'With company name & address — for expense reports',
      modalTitle: 'Billing address',
      modalSubtitle: 'Appears exactly like this on your invoice',
      warning: 'Please put each item on its own line — no blank lines in between.',
      example: 'Show example',
      placeholder: 'Company name\nFirst and last name\nStreet and number\nPostcode City\nCountry',
      save: 'Save', cancel: 'Cancel',
      saved: 'Billing address saved', edit: 'Edit',
      error: 'Please enter your billing address',
      recipient: 'BILL TO', country: 'Germany',
    },
    tr: {
      toggle: 'Firmanız için fatura?',
      toggleHint: 'Firma adı ve adresi ile — gider beyanı için',
      modalTitle: 'Fatura adresi',
      modalSubtitle: 'Faturanızda tam olarak böyle görünecek',
      warning: 'Her bilgiyi ayrı satıra yazın — aralarda boş satır bırakmayın.',
      example: 'Örnek göster',
      placeholder: 'Firma adı\nAd Soyad\nSokak ve numara\nPosta kodu Şehir\nÜlke',
      save: 'Kaydet', cancel: 'İptal',
      saved: 'Fatura adresi kaydedildi', edit: 'Düzenle',
      error: 'Lütfen fatura adresinizi girin',
      recipient: 'FATURA ALICISI', country: 'Almanya',
    },
  };
  const rx = rechnungT[locale] || rechnungT.de;
  // Collapses blank lines and stray indentation, matching what the backend stores and
  // what the PDF's RECHNUNGSEMPFÄNGER block renders.
  const cleanRechnungAdresse = (v: string) =>
    v.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
  // Dismissing without saving must not leave the toggle on with an empty address.
  const closeRechnungModal = () => {
    setShowRechnungModal(false);
    if (!rechnungAdresse) setRechnungRequired(false);
  };

  // Esc to dismiss + lock background scroll while the modal is open.
  useEffect(() => {
    if (!showRechnungModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowRechnungModal(false);
        setRechnungAdresse(prev => { if (!prev) setRechnungRequired(false); return prev; });
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showRechnungModal]);

  const isAirportPickup = pickup.includes('München-Flughafen');
  const isAirportDropoff = dropoff.includes('München-Flughafen');
  // Flight number is required whenever the driver needs it to track an arrival:
  // either the outbound pickup is at the airport, or a Rückfahrt was added and the
  // outbound dropoff is the airport (so the return leg picks the customer up there).
  const flightNumberRequired = isAirportPickup || (tripType === 'roundtrip' && isAirportDropoff);

  // Debounced, best-effort flight-number check against the backend's AeroDataBox proxy.
  // Never blocks booking — only shows a confirmation card or a non-blocking warning.
  // When the pickup itself isn't the airport but a Rückfahrt was added from the
  // airport, the flight that matters is the one landing on the RETURN date, not
  // the outbound date.
  const flightCheckDate = isAirportPickup ? date : returnDate;
  useEffect(() => {
    if (flightCheckTimer.current) clearTimeout(flightCheckTimer.current);
    if (!settingsLoaded || !flightValidationEnabled || !flightNumberRequired || !flightNumber.trim() || !flightCheckDate) {
      flightCheckAbort.current?.abort();
      setFlightCheckStatus('idle');
      setFlightCheckResult(null);
      return;
    }
    flightCheckTimer.current = setTimeout(() => {
      flightCheckAbort.current?.abort();
      const controller = new AbortController();
      flightCheckAbort.current = controller;
      setFlightCheckStatus('checking');
      fetch(`${API_URL}/flights/validate?flight=${encodeURIComponent(flightNumber.trim())}&date=${encodeURIComponent(flightCheckDate)}`, { signal: controller.signal })
        .then(r => r.json())
        .then(data => {
          if (!data.available) {
            setFlightCheckStatus('idle');
            setFlightCheckResult(null);
          } else if (data.found) {
            setFlightCheckStatus(data.arrivesMUC === false ? 'wrongairport' : 'found');
            setFlightCheckResult({ airline: data.airline, origin: data.origin, scheduledArrival: data.scheduledArrival, arrivesMUC: data.arrivesMUC });
          } else {
            setFlightCheckStatus('notfound');
            setFlightCheckResult(null);
          }
        })
        .catch(() => { /* aborted or network error — stay silent, non-blocking */ });
    }, 700);
    return () => { if (flightCheckTimer.current) clearTimeout(flightCheckTimer.current); };
  }, [flightNumber, flightCheckDate, flightNumberRequired, settingsLoaded, flightValidationEnabled]);

  function buildFlightInfo(): string | undefined {
    if ((flightCheckStatus !== 'found' && flightCheckStatus !== 'wrongairport') || !flightCheckResult) return undefined;
    const { airline, origin, scheduledArrival, arrivesMUC } = flightCheckResult;
    return [airline, origin && (arrivesMUC ? `${origin} → MUC` : origin), scheduledArrival && `${tx.flightArrival} ${scheduledArrival}`].filter(Boolean).join(' · ') || undefined;
  }

  function validateField(field: string, value: string) {
    let err = '';
    if (field === 'firstName' && !value.trim()) err = locale === 'de' ? 'Vorname erforderlich' : locale === 'en' ? 'First name required' : 'Ad gerekli';
    if (field === 'lastName' && !value.trim()) err = locale === 'de' ? 'Nachname erforderlich' : locale === 'en' ? 'Last name required' : 'Soyad gerekli';
    if (field === 'phone' && !value.trim()) err = tx.err_phone;
    if (field === 'email' && (!value.trim() || !value.includes('@'))) err = tx.err_email;
    if (field === 'flightNumber' && flightNumberRequired && !value.trim()) err = locale === 'de' ? 'Flugnummer erforderlich' : locale === 'en' ? 'Flight number required' : 'Uçuş numarası gerekli';
    if (field === 'pickupSign' && flightNumberRequired && !value.trim()) err = locale === 'de' ? 'Abholschild erforderlich' : locale === 'en' ? 'Pickup sign required' : 'Tabela gerekli';
    setErrors(prev => err ? { ...prev, [field]: err } : (({ [field]: _, ...rest }) => rest)(prev));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = locale === 'de' ? 'Vorname erforderlich' : locale === 'en' ? 'First name required' : 'Ad gerekli';
    if (!lastName.trim()) errs.lastName = locale === 'de' ? 'Nachname erforderlich' : locale === 'en' ? 'Last name required' : 'Soyad gerekli';
    if (!phone.trim()) errs.phone = tx.err_phone;
    if (!email.trim() || !email.includes('@')) errs.email = tx.err_email;
    if (flightNumberRequired && !flightNumber.trim()) errs.flightNumber = locale === 'de' ? 'Flugnummer erforderlich' : locale === 'en' ? 'Flight number required' : 'Uçuş numarası gerekli';
    if (flightNumberRequired && !pickupSign.trim()) errs.pickupSign = locale === 'de' ? 'Abholschild erforderlich' : locale === 'en' ? 'Pickup sign required' : 'Tabela gerekli';
    if (rechnungRequired && !rechnungAdresse.trim()) errs.rechnung = rx.error;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleContinueToReview() {
    if (!validate()) return;
    if (payment === 'card') {
      setCardSubmitting(true);
      const result = await cardFieldRef.current?.confirmCard();
      setCardSubmitting(false);
      if (!result || !result.success) {
        setErrors(prev => ({ ...prev, card: result?.error || tx.err_card }));
        return;
      }
      setCardResult(result);
    }
    setSubmitState('review');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  function buildChildSeatDetails(): string {
    const parts: string[] = [];
    if (childSeatBabyschale > 0) parts.push(`${childSeatBabyschale}× Babyschale`);
    if (childSeatKindersitz > 0) parts.push(`${childSeatKindersitz}× Kindersitz`);
    if (childSeatSitzerhoehung > 0) parts.push(`${childSeatSitzerhoehung}× Sitzerhöhung`);
    return parts.join(', ');
  }

  async function handleApplyPromo() {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    try {
      const res = await fetch(`${API_URL}/promotions/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoInput.trim(), base_price: price, lang: locale }),
      });
      const data = await res.json();
      if (data.valid) {
        // If nicht kombinierbar + roundtrip with discount: reject the code
        if (!data.kombinierbar && tripType === 'roundtrip' && roundtripDiscount > 0) {
          const errMsg = locale === 'tr'
            ? 'Bu kod Gidiş-Dönüş indirimiyle birleştirilemez.'
            : locale === 'en'
            ? 'This code cannot be combined with the round trip discount.'
            : 'Dieser Aktionscode ist nicht mit dem Hin- & Rückfahrt-Rabatt kombinierbar.';
          setPromoError(errMsg);
          setAppliedPromo(null);
        } else {
          setAppliedPromo({ code: data.code, discountAmount: data.discount_amount, promoBase: price });
          setPromoError('');
        }
      } else {
        setPromoError(data.message || 'Ungültiger Code');
        setAppliedPromo(null);
      }
    } catch {
      setPromoError(locale === 'tr' ? 'Bir hata oluştu.' : locale === 'en' ? 'An error occurred.' : 'Ein Fehler ist aufgetreten.');
    } finally {
      setPromoLoading(false);
    }
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitState('loading');
    try {
      const pickupDatetime = `${date}T${time}:00`;
      const returnDatetime = tripType === 'roundtrip' && returnDate ? `${returnDate}T${returnTime}:00` : undefined;

      const body: Record<string, unknown> = {
        visitor_id: typeof localStorage !== 'undefined' ? localStorage.getItem('mt_visitor_id') || undefined : undefined,
        // Ties this booking back to the exact visitor_sessions row it came from, so the
        // admin funnel (tracking.ts) can count real web conversions instead of every
        // booking regardless of source. Dies with the tab, unlike mt_visitor_id.
        session_id: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('mt_session_id') || undefined : undefined,
        pickup_address: pickup,
        dropoff_address: dropoff,
        pickup_datetime: pickupDatetime,
        vehicle_type: vehicle,
        passengers,
        name: name.trim(),
        phone: toSubmitValue(phone, phoneCountry),
        email: email.trim(),
        flight_number: flightNumber || undefined,
        flight_validated: flightNumber.trim() ? (flightCheckStatus === 'found' ? '1' : '0') : undefined,
        flight_info: buildFlightInfo(),
        pickup_sign: pickupSign || undefined,
        child_seat: childSeat,
        child_seat_details: childSeat ? buildChildSeatDetails() : undefined,
        luggage_count: luggageCount,
        fahrrad_count: fahrradCount,
        notes: notes || undefined,
        distance_km: effectiveDistanceKm,
        duration_minutes: effectiveDuration,
        pickup_lat: pickupLat ? Number(pickupLat) : undefined,
        pickup_lng: pickupLng ? Number(pickupLng) : undefined,
        dropoff_lat: dropoffLat ? Number(dropoffLat) : undefined,
        dropoff_lng: dropoffLng ? Number(dropoffLng) : undefined,
        payment_method: payment,
        language: locale,
        trip_type: tripType,
        return_datetime: returnDatetime,
        anfahrt_cost: anfahrtCost > 0 ? anfahrtCost : undefined,
        toll_amount: tollAmount > 0 ? tollAmount : undefined,
        zwischenstopp_address: params.get('zwischenstopp_address') || localZwischenstopp || undefined,
        promo_code: appliedPromo?.code || undefined,
        rechnung_required: rechnungRequired && rechnungAdresse.trim() ? 1 : 0,
        rechnung_adresse: rechnungRequired && rechnungAdresse.trim() ? rechnungAdresse : undefined,
      };
      if (payment === 'card' && cardResult) {
        body.stripe_customer_id = cardResult.customerId;
        body.stripe_payment_method_id = cardResult.paymentMethodId;
      }

      const res = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBookingNumber(data.booking_number);
      const serverPrice = data.booking?.price;
      setConfirmedPrice(serverPrice != null ? Number(serverPrice) : null);
      setSubmitState('success');
      try {
        const parts = name.trim().split(/\s+/);
        const anonName = parts[0] + (parts.length > 1 ? ' ' + parts[parts.length - 1][0] + '.' : '');
        localStorage.setItem('mt_last_booking', JSON.stringify({
          name: anonName,
          dest: dropoff.replace(/,\s*Deutschland$/i, '').replace(/,\s*Germany$/i, ''),
          ts: Date.now(),
        }));
      } catch {}
      // Google Ads conversion tracking with Enhanced Conversions
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('set', 'user_data', {
          email: email.trim(),
          // Enhanced Conversions matches on E.164 — a raw '0151…' silently fails to match.
          phone_number: toSubmitValue(phone, phoneCountry),
        });
        (window as any).gtag('event', 'conversion', {
          send_to: 'AW-829027982/VhRbCJL0oXgQju2niwM',
          transaction_id: data.booking_number || '',
        });
      }
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    } catch {
      setSubmitState('error');
    }
  }

  if (submitState === 'success') {
    const returnDateFmt = returnDate
      ? new Date(returnDate + 'T00:00:00').toLocaleDateString(
          locale === 'en' ? 'en-GB' : locale === 'tr' ? 'tr-TR' : 'de-DE',
          { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }
        )
      : '';

    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Success header */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-green-500 px-8 py-8 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={36} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{tx.success_title}</h2>
              <p className="text-green-100 text-sm">{tx.success_msg} <strong className="text-white">{email}</strong></p>
            </div>

            <div className="p-8">
              {/* Out-of-office-hours (night) phone confirmation notice */}
              {isNightBooking && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 mb-6">
                  <p className="font-bold text-amber-800 mb-1">
                    <Moon size={13} className="inline mr-1" /> {locale === 'tr' ? 'Garanti olması için lütfen telefonla da arayın' : locale === 'en' ? 'Please also call us, just to be safe' : 'Sicherheitshalber bitte zusätzlich anrufen'}
                  </p>
                  <p className="text-sm text-amber-700 mb-3">
                    {locale === 'tr'
                      ? '7/24 hizmetinizdeyiz. Bu geç saatte verdiğiniz rezervasyonun kesinlikle planlandığından ve bir şoförün zamanında hazır olduğundan emin olmak için lütfen her ihtimale karşı bizi telefonla da kısaca arayın:'
                      : locale === 'en'
                        ? 'We are available around the clock. To make absolutely sure your trip booked at this late hour is scheduled and a driver is ready in time, please also give us a quick call to be safe:'
                        : 'Wir sind rund um die Uhr für Sie da. Damit Ihre Fahrt zu dieser späten Uhrzeit ganz sicher eingeplant ist und ein Fahrer rechtzeitig bereitsteht, rufen Sie uns bitte sicherheitshalber zusätzlich kurz an:'}
                  </p>
                  <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold px-5 py-2.5 rounded-lg transition-colors">
                    <Phone size={16} /> {CONTACT_INFO.phone}
                  </a>
                </div>
              )}

              {/* Booking number */}
              <div className="bg-gold-50 border border-gold-200 rounded-xl p-5 text-center mb-6">
                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Buchungsnummer</p>
                <p className="text-3xl font-bold text-primary-600 tracking-wide">{bookingNumber}</p>
              </div>

              {/* Booking details summary */}
              <div className="space-y-4 text-sm">
                {/* Vehicle & Price */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                      <img src={VEHICLE_IMAGES[vehicle] || '/images/kombi.webp'} alt={vehicleLabel} loading="lazy" width={400} height={240} className="w-full h-full object-cover" />
                    </div>
                    <span className="font-semibold text-gray-800">{vehicleLabel}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-primary-600">{formatPrice(confirmedPrice ?? finalPriceWithAutoDiscount)}</span>
                    <p className="text-[11px] text-green-600 font-medium mt-0.5">
                      {locale === 'de' ? 'Keine Vorauszahlung' : locale === 'en' ? 'No prepayment' : 'Ön ödeme yok'}
                    </p>
                  </div>
                </div>

                {/* Route */}
                <div className="space-y-2 pb-4 border-b border-gray-100">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-green-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{addressIcon(pickup)}{pickup}</span>
                  </div>
                  {(zwischenstoppFromErgebnisse || localZwischenstopp) && (
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-blue-500 mt-0.5 shrink-0" />
                      <span className="text-blue-700 font-medium inline-flex items-center gap-1"><MapPin size={14} /> {params.get('zwischenstopp_address') || localZwischenstopp}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{addressIcon(dropoff)}{dropoff}</span>
                  </div>
                  {/* Route link */}
                  {(() => {
                    const zwStop = params.get('zwischenstopp_address') || localZwischenstopp;
                    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(dropoff)}${zwStop ? `&waypoints=${encodeURIComponent(zwStop)}` : ''}&travelmode=driving`;
                    return (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-600 hover:text-gray-800 transition-colors">
                        <Map size={14} /> {locale === 'de' ? 'Route auf Google Maps anzeigen' : locale === 'en' ? 'View route on Google Maps' : 'Rotayı Google Maps\'te göster'}
                      </a>
                    );
                  })()}
                </div>

                {/* Date/Time */}
                <div className="pb-4 border-b border-gray-100 space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-primary-500" />
                    <span className="text-gray-700">
                      <span className="font-semibold">{locale === 'de' ? 'Hinfahrt:' : locale === 'en' ? 'Outbound:' : 'Gidiş:'}</span> {dateFormatted} · {time} Uhr
                    </span>
                  </div>
                  {tripType === 'roundtrip' && returnDate && (
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-primary-500" />
                      <span className="text-primary-600 font-medium">
                        <span className="font-semibold">{locale === 'de' ? 'Rückfahrt:' : locale === 'en' ? 'Return:' : 'Dönüş:'}</span> {returnDateFmt} · {returnTime} Uhr
                      </span>
                    </div>
                  )}
                </div>

                {/* Contact & Details */}
                <div className="grid grid-cols-2 gap-3 text-gray-600">
                  <div className="flex items-center gap-2"><User size={14} className="text-gray-400" /> {name}</div>
                  <div className="flex items-center gap-2"><Phone size={14} className="text-gray-400" /> {phone}</div>
                  <div className="flex items-center gap-2"><Users size={14} className="text-gray-400" /> {passengers} {locale === 'de' ? 'Person(en)' : locale === 'en' ? 'Passenger(s)' : 'Kişi'}</div>
                  <div className="flex items-center gap-2"><Luggage size={14} className="text-gray-400" /> {luggageCount} {locale === 'de' ? 'Gepäckstück(e)' : locale === 'en' ? 'Luggage' : 'Bagaj'}</div>
                  {flightNumber && <div className="flex items-center gap-2"><Plane size={14} className="text-gray-400" /> {flightNumber}</div>}
                  {pickupSign && <div className="flex items-center gap-2"><Signpost size={14} className="text-gray-400" /> <span className="text-gray-500">{locale === 'de' ? 'Abholschild:' : locale === 'en' ? 'Pickup sign:' : 'Tabela:'}</span> {pickupSign}</div>}
                  <div className="flex items-center gap-2">{payment === 'cash' ? <Banknote size={14} className="text-gray-400" /> : <CreditCard size={14} className="text-gray-400" />} {payment === 'cash' ? (locale === 'de' ? 'Barzahlung' : locale === 'en' ? 'Cash' : 'Nakit') : (locale === 'de' ? 'Kreditkarte' : locale === 'en' ? 'Credit card' : 'Kredi kartı')}</div>
                  {childSeat && <div className="flex items-center gap-2 col-span-2"><Baby size={14} className="text-gray-400 inline mr-1" /> {buildChildSeatDetails() || (locale === 'de' ? 'Kindersitz' : locale === 'en' ? 'Child seat' : 'Çocuk koltuğu')}</div>}
                  {fahrradCount > 0 && <div className="flex items-center gap-2"><Bike size={14} className="text-gray-400 inline mr-1" /> {fahrradCount}× {locale === 'de' ? 'Fahrrad' : locale === 'en' ? 'Bicycle' : 'Bisiklet'}</div>}
                  {notes && <div className="flex items-start gap-2 col-span-2"><StickyNote size={14} className="text-gray-400" /> {notes}</div>}
                </div>
              </div>

              {/* Action */}
              <div className="mt-8 text-center">
                <button onClick={() => router.push(locale === 'de' ? '/' : `/${locale}`)}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-10 py-3 rounded-xl font-semibold transition-colors">
                  {tx.new_booking}
                </button>
              </div>
            </div>
          </div>
        </div>
        <SocialProofToast locale={locale} />
      </div>
    );
  }

  const L = (de: string, en: string, tr: string) => (locale === 'en' ? en : locale === 'tr' ? tr : de);
  const zwStopAddress = params.get('zwischenstopp_address') || localZwischenstopp;
  const vehicleDesc = VEHICLE_DESC[vehicle]?.[locale] || VEHICLE_DESC[vehicle]?.de || '';
  const kmText = effectiveDistanceKm.toFixed(1).replace('.', locale === 'en' ? '.' : ',');
  const returnDateLong = returnDate
    ? new Date(returnDate + 'T00:00:00').toLocaleDateString(
        locale === 'en' ? 'en-GB' : locale === 'tr' ? 'tr-TR' : 'de-DE',
        { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }
      )
    : '';
  const strikePrice = (appliedPromo || autoDiscount) ? price : tripType === 'roundtrip' ? oneWayPrice * 2 : null;

  // Zurück zur Fahrzeugauswahl statt zur Startseite: dort lässt sich die Suche
  // inline bearbeiten und der Preis wird direkt neu berechnet.
  function changeSearch() {
    const sp = new URLSearchParams();
    sp.set('pickup', pickup);
    sp.set('dropoff', dropoff);
    sp.set('date', date);
    sp.set('time', time);
    sp.set('passengers', passengers.toString());
    sp.set('distance_km', String(effectiveDistanceKm));
    sp.set('duration', String(effectiveDuration));
    sp.set('trip_type', tripType);
    if (tripType === 'roundtrip') {
      if (returnDate) sp.set('return_date', returnDate);
      if (returnTime) sp.set('return_time', returnTime);
    }
    if (zwStopAddress) sp.set('zwischenstopp_address', zwStopAddress);
    const prefix = locale === 'de' ? '' : `/${locale}`;
    router.push(`${prefix}/ergebnisse?${sp.toString()}`);
  }

  const sectionHead = (Icon: typeof User, title: string, sub: string) => (
    <div className="flex items-center gap-4 mb-5">
      <span className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0" style={{ background: '#fdf0c8' }}>
        <Icon size={24} className="text-primary-800" />
      </span>
      <div className="min-w-0">
        <h2 className="text-lg md:text-xl font-extrabold text-primary-800 leading-tight">{title}</h2>
        <p className="text-sm text-gray-600 mt-0.5">{sub}</p>
      </div>
    </div>
  );

  const editBtn = (onClick: () => void) => (
    <button type="button" onClick={onClick} className="shrink-0 text-xs font-medium text-gray-700 border border-gray-200 hover:border-primary-400 hover:text-primary-700 rounded-md px-2.5 py-1 transition-colors">
      {L('Ändern', 'Change', 'Değiştir')}
    </button>
  );

  const steps = [
    L('Fahrzeug wählen', 'Choose vehicle', 'Araç seçimi'),
    L('Ihre Angaben', 'Your details', 'Bilgileriniz'),
    L('Überprüfung', 'Review', 'Kontrol'),
    L('Bestätigung', 'Confirmation', 'Onay'),
  ];

  // Hero-Hintergrund (Flughafen-/Taxi-Foto) — gemeinsam für Ihre Angaben und Überprüfung
  const heroBackdrop = (
    <>
        {/* < lg: Foto hinter dem Titel, stark aufgehellt */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[300px] md:h-[360px] lg:hidden" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-full md:w-[640px]">
            <img src="/images/contact-bg-right.webp" alt="" width={554} height={348} className="w-full h-full object-cover" style={{ objectPosition: '40% 30%' }} />
            <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(to right, #f4f7fb 0%, rgba(244,247,251,.75) 18%, rgba(244,247,251,.15) 45%, rgba(244,247,251,0) 70%)' }} />
            <div className="absolute inset-0 md:hidden" style={{ background: 'linear-gradient(to right, rgba(244,247,251,.97) 0%, rgba(244,247,251,.9) 60%, rgba(244,247,251,.7) 100%)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #f4f7fb 0%, rgba(244,247,251,0) 35%)' }} />
          </div>
        </div>
        {/* ≥ lg: ganzes Foto über der rechten Spalte, Taxi vollständig sichtbar — die Buchungsübersicht beginnt darunter */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <div className="relative max-w-6xl h-full mx-auto">
            <div className="absolute top-0 right-0 w-[460px] h-[290px] xl:w-[540px] xl:h-[340px]">
              <img src="/images/contact-bg-right.webp" alt="" width={554} height={348} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #f4f7fb 0%, rgba(244,247,251,.55) 16%, rgba(244,247,251,0) 38%)' }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, #f4f7fb 0%, rgba(244,247,251,.7) 7%, rgba(244,247,251,0) 22%)' }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #f4f7fb 0%, rgba(244,247,251,.6) 8%, rgba(244,247,251,0) 22%)' }} />
            </div>
          </div>
        </div>
    </>
  );

  // Review screen
  if ((submitState as string) === 'review' || (submitState as string) === 'loading' && submitState !== 'idle') {
    if ((submitState as string) === 'review' || (submitState as string) === 'loading') {
      const isLoading = (submitState as string) === 'loading';
      const backToForm = () => { setSubmitState('idle'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50); };
      const cardCls = 'bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(15,27,45,.06)] p-4 sm:p-5';
      const cardHead = (Icon: typeof User, title: string, onEdit?: () => void) => (
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center justify-center w-10 h-10 xl:w-11 xl:h-11 rounded-full shrink-0" style={{ background: '#fdf0c8' }}>
              <Icon size={20} className="text-primary-800" />
            </span>
            <h2 className="text-base xl:text-[17px] font-bold text-primary-800 leading-tight xl:whitespace-nowrap">{title}</h2>
          </div>
          {onEdit && (
            <button type="button" onClick={onEdit} className="shrink-0 text-sm font-semibold text-primary-800 underline underline-offset-2 border border-gray-200 hover:border-primary-400 rounded-lg px-3 xl:px-4 py-1.5 xl:py-2 transition-colors">
              {L('Ändern', 'Change', 'Değiştir')}
            </button>
          )}
        </div>
      );
      const line = (Icon: typeof User, text: React.ReactNode, key?: string) => (
        <div key={key} className="flex items-start gap-3 text-sm text-gray-800 min-w-0">
          <Icon size={18} className="mt-0.5 shrink-0 text-gray-900" />
          <span className="min-w-0 break-words">{text}</span>
        </div>
      );
      const hasExtras = childSeat || fahrradCount > 0;

      return (
        <div className="min-h-screen" style={{ background: '#f4f7fb' }}>
          <section className="relative overflow-hidden lg:overflow-visible">
            {heroBackdrop}
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 md:pt-10 pb-6">
              <p className="text-xs md:text-sm font-bold tracking-[.2em] uppercase text-gold-600">{L('Schritt 3 von 4', 'Step 3 of 4', 'Adım 3 / 4')}</p>
              <h1 className="mt-2 text-4xl md:text-[46px] font-extrabold tracking-tight text-primary-800">
                {L('Buchung', 'Review', 'Rezervasyonu')} <span className="text-gold-400">{L('überprüfen', 'your booking', 'kontrol edin')}</span>
              </h1>
              <p className="mt-2 text-base md:text-lg text-gray-700">{tx.review_subtitle}</p>

              <ol className="mt-7 flex items-center gap-2 sm:gap-3">
                {steps.map((label, i) => {
                  const done = i < 2;
                  const active = i === 2;
                  return (
                    <li key={label} className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {i > 0 && <span className="hidden sm:block h-px w-6 lg:w-10 bg-gray-300 shrink-0" aria-hidden="true" />}
                      <button
                        type="button"
                        disabled={!done}
                        onClick={() => { if (i === 0) router.back(); else if (i === 1) backToForm(); }}
                        className="flex items-center gap-2 min-w-0 disabled:cursor-default"
                      >
                        <span className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0',
                          done && 'bg-primary-800 text-white',
                          active && 'bg-gold-400 text-primary-800 ring-2 ring-primary-800',
                          !done && !active && 'bg-gray-200 text-gray-700'
                        )}>
                          {i + 1}
                        </span>
                        <span className={cn('text-sm whitespace-nowrap', active ? 'font-bold text-gray-900' : 'font-semibold text-gray-800', !active && 'hidden md:inline lg:hidden xl:inline')}>{label}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
              {/* LEFT */}
              <div className="space-y-4 min-w-0">
                {/* Fahrzeugdetails */}
                <div className={cardCls}>
                  {cardHead(Car, L('Fahrzeugdetails', 'Vehicle details', 'Araç bilgileri'), () => router.back())}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-full sm:w-[136px] aspect-[800/344] sm:aspect-auto sm:h-[100px] rounded-xl overflow-hidden bg-gray-50 shrink-0">
                      <img src={VEHICLE_IMAGES[vehicle] || '/images/kombi.webp'} alt={vehicleLabel} loading="lazy" width={800} height={344} className="w-full h-full object-cover object-[35%_center]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold text-primary-800">{vehicleLabel}</p>
                      {vehicleDesc && <p className="text-sm text-gray-600">{vehicleDesc}</p>}
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3 text-[11px] sm:text-[13px] leading-tight text-gray-700 max-w-[440px]">
                        {[
                          { Icon: User, a: maxPassengers ? `${L('Bis zu', 'Up to', 'En fazla')} ${maxPassengers}` : String(passengers), b: L('Passagiere', 'Passengers', 'Yolcu') },
                          { Icon: Luggage, a: String(maxLuggage), b: L('Gepäckstücke', 'Luggage', 'Bagaj') },
                          { Icon: Clock, a: `ca. ${effectiveDuration} Min.`, b: L('Fahrtzeit', 'Journey time', 'Süre') },
                        ].map(({ Icon, a, b }) => (
                          <div key={b} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            <Icon size={20} className="shrink-0 text-gray-900" strokeWidth={1.8} />
                            <div className="min-w-0"><div className="whitespace-nowrap">{a}</div><div className="whitespace-nowrap">{b}</div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Strecke */}
                <div className={cardCls}>
                  {cardHead(MapPin, tx.review_route, changeSearch)}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                    <div className="space-y-4">
                      <div className="relative flex items-start gap-3">
                        <span className="absolute left-[9px] top-6 bottom-[-18px] border-l-2 border-dashed border-gray-300" aria-hidden="true" />
                        <span className="relative mt-0.5 w-5 h-5 rounded-full border-[4px] border-gold-400 bg-white shrink-0" />
                        <div className="min-w-0 text-sm">
                          <p className="font-bold text-gray-900">{L('Abholung', 'Pickup', 'Alış')}</p>
                          <p className="text-gray-700 break-words">{addressIcon(pickup)}{pickup}</p>
                        </div>
                      </div>
                      {zwStopAddress && (
                        <div className="relative flex items-start gap-3">
                          <span className="absolute left-[9px] top-6 bottom-[-18px] border-l-2 border-dashed border-gray-300" aria-hidden="true" />
                          <span className="relative mt-0.5 w-5 h-5 rounded-full bg-blue-500 border-[4px] border-blue-100 shrink-0" />
                          <div className="min-w-0 text-sm">
                            <p className="font-bold text-gray-900">{L('Zwischenstopp', 'Intermediate stop', 'Ara durak')}</p>
                            <p className="text-gray-700 break-words">{zwStopAddress}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <MapPin size={20} className="shrink-0 text-primary-800" fill="#10233e" stroke="#fff" />
                        <div className="min-w-0 text-sm">
                          <p className="font-bold text-gray-900">{L('Ziel', 'Destination', 'Varış')}</p>
                          <p className="font-semibold text-gray-900 break-words">{addressIcon(dropoff)}{dropoff}</p>
                        </div>
                      </div>
                      {(() => {
                        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(dropoff)}${zwStopAddress ? `&waypoints=${encodeURIComponent(zwStopAddress)}` : ''}&travelmode=driving`;
                        return (
                          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-primary-700 underline underline-offset-2">
                            <Map size={13} /> {L('Route auf Google Maps anzeigen', 'View route on Google Maps', "Rotayı Google Maps'te göster")}
                          </a>
                        );
                      })()}
                    </div>
                    <div className="relative [&>div]:mt-0 [&>div]:rounded-xl [&>div]:!h-[180px]">
                      <RouteMap
                        pickup={pickup}
                        dropoff={dropoff}
                        waypoint={zwStopAddress || undefined}
                        pickupCoords={pickupLat && pickupLng ? { lat: Number(pickupLat), lng: Number(pickupLng) } : null}
                        dropoffCoords={dropoffLat && dropoffLng ? { lat: Number(dropoffLat), lng: Number(dropoffLng) } : null}
                      />
                      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/95 border border-gray-200 rounded-md px-2.5 py-1 text-xs font-medium text-gray-800 shadow-sm whitespace-nowrap">
                        {kmText} km · ca. {effectiveDuration} Min.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Datum & Uhrzeit + Personen & Gepäck */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={cardCls}>
                    {cardHead(CalendarDays, tx.review_datetime, changeSearch)}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <CalendarDays size={18} className="mt-0.5 shrink-0 text-gray-900" />
                        <div className="text-sm">
                          <p className="font-bold text-gray-900">{L('Hinfahrt', 'Outbound', 'Gidiş')}</p>
                          <p className="text-gray-700">{dateFormatted} · {time} {L('Uhr', '', '')}</p>
                        </div>
                      </div>
                      {tripType === 'roundtrip' && returnDate && (
                        <div className="flex items-start gap-3">
                          <CalendarDays size={18} className="mt-0.5 shrink-0 text-gray-900" />
                          <div className="text-sm">
                            <p className="font-bold text-gray-900">{L('Rückfahrt', 'Return', 'Dönüş')}</p>
                            <p className="text-gray-700">{returnDateLong} · {returnTime} {L('Uhr', '', '')}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={cardCls}>
                    {cardHead(User, L('Personen & Gepäck', 'Passengers & luggage', 'Kişi & bagaj'), backToForm)}
                    <div className="space-y-2.5 sm:pl-14">
                      {line(User, `${passengers} ${passengers === 1 ? L('Person', 'passenger', 'kişi') : L('Personen', 'passengers', 'kişi')}`)}
                      {line(Luggage, `${luggageCount} ${luggageCount === 1 ? L('Gepäckstück', 'piece of luggage', 'bagaj') : L('Gepäckstücke', 'pieces of luggage', 'bagaj')}`)}
                    </div>
                  </div>
                </div>

                {/* Extras + Kontaktdaten */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-4">
                  <div className={cardCls}>
                    {cardHead(Star, 'Extras', backToForm)}
                    {hasExtras ? (
                      <div className="space-y-3">
                        {childSeat && (
                          <div className="flex items-start gap-3">
                            <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 shrink-0"><Baby size={22} className="text-gray-900" /></span>
                            <div className="text-sm text-gray-800">
                              <p>{L('Kindersitz', 'Child seat', 'Çocuk koltuğu')} ({L('kostenlos', 'free', 'ücretsiz')})</p>
                              {buildChildSeatDetails() && <p className="text-gray-600">{buildChildSeatDetails().replace(/, /g, ' · ')}</p>}
                            </div>
                          </div>
                        )}
                        {fahrradCount > 0 && (
                          <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 shrink-0"><Bike size={22} className="text-gray-900" /></span>
                            <p className="text-sm text-gray-800">{fahrradCount}× {L('Fahrrad', 'Bicycle', 'Bisiklet')}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">{L('Keine Extras gewählt', 'No extras selected', 'Ekstra seçilmedi')}</p>
                    )}
                  </div>
                  <div className={cardCls}>
                    {cardHead(User, tx.review_contact, backToForm)}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                      {line(User, name)}
                      {line(Phone, phone ? toSubmitValue(phone, phoneCountry) : '')}
                      {line(Mail, email)}
                      {flightNumber && line(Plane, <>{tx.review_flight_label}: <span className="font-medium">{flightNumber}</span></>)}
                      {pickupSign && line(Tag, <>{L('Abholschild', 'Pickup sign', 'Tabela')}: <span className="font-medium">{pickupSign}</span></>)}
                    </div>
                    {notes && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        {line(MessageSquare, <><span className="text-gray-500">{tx.review_notes_label}:</span> {notes}</>)}
                      </div>
                    )}
                    {rechnungRequired && rechnungAdresse && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        {line(FileText, <><span className="block text-gray-500">{rx.modalTitle}</span><span className="whitespace-pre-line">{rechnungAdresse}</span></>)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="hidden lg:flex items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-sm text-gray-700 border" style={{ background: '#eaf1fa', borderColor: '#dbe6f3' }}>
                  <Info size={18} className="shrink-0 text-primary-800" fill="#10233e" stroke="#fff" />
                  <span>
                    {L('Mit der Buchung akzeptieren Sie unsere', 'By booking you accept our', 'Rezervasyonla')}{' '}
                    <a href={locale === 'de' ? '/agb' : `/${locale}/agb`} target="_blank" className="underline underline-offset-2 hover:text-primary-800">{L('AGB', 'Terms', 'Hizmet Şartlarımızı')}</a>{' '}
                    {L('und', 'and', 've')}{' '}
                    <a href={locale === 'de' ? '/datenschutz' : `/${locale}/datenschutz`} target="_blank" className="underline underline-offset-2 hover:text-primary-800">{L('Datenschutzerklärung', 'Privacy Policy', 'Gizlilik Politikamızı')}</a>
                    {locale === 'tr' ? ' kabul etmiş olursunuz.' : '.'}
                  </span>
                </div>
              </div>

              {/* RIGHT */}
              <div className="space-y-4 lg:mt-[68px] xl:mt-[118px] lg:sticky lg:top-24">
                {/* Gesamtpreis */}
                <div className="rounded-2xl p-5 sm:p-6 text-white shadow-[0_10px_30px_rgba(15,27,45,.25)]" style={{ background: '#0f1b2d' }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-lg font-bold">{L('Gesamtpreis', 'Total price', 'Toplam fiyat')}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-400 border border-white/10 bg-white/5 rounded-lg px-3 py-1.5">
                      <Tag size={14} className="text-gold-400" fill="#f6c644" stroke="#0f1b2d" /> {L('Festpreis garantiert', 'Fixed price guaranteed', 'Sabit fiyat garantili')}
                    </span>
                  </div>
                  <div className="mt-5 flex items-end gap-3 flex-wrap">
                    <span className="text-[44px] leading-none font-extrabold tracking-tight">{formatPrice(finalPriceWithAutoDiscount)}</span>
                    {strikePrice != null && strikePrice > finalPriceWithAutoDiscount && (
                      <span className="text-base text-white/50 line-through mb-1">{formatPrice(strikePrice)}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-white/80">{L('Inkl. MwSt., Maut & Gepäck', 'Incl. VAT, tolls & luggage', 'KDV, otoyol & bagaj dahil')}</p>

                  {autoDiscount && !appliedPromo && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className={cn('inline-flex items-center text-xs font-bold uppercase px-2.5 py-1 rounded-md', autoDiscountRed ? 'bg-red-600 text-white' : 'bg-green-600 text-white')}>
                        −{formatPrice(autoDiscountAmount)} · {autoDiscountLabel}
                      </span>
                      {autoDiscountRemaining && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-300"><Flame size={13} /> {autoDiscountRemaining}</span>
                      )}
                      <Countdown endsAt={autoDiscount.ends_at} locale={locale} onExpire={onAutoDiscountExpire} className="text-xs font-semibold text-red-300" />
                    </div>
                  )}
                  {tripType === 'roundtrip' && roundtripDiscount > 0 && (
                    <p className="mt-2 text-xs text-green-300 font-medium flex items-center gap-1"><Tag size={12} /> {roundtripDiscount}% {L('Hin- & Rückfahrt Rabatt inklusive', 'round trip discount included', 'gidiş-dönüş indirimi dahil')}</p>
                  )}
                  {anfahrtCost > 0 && (
                    <p className="mt-1 text-xs text-amber-300 font-medium flex items-center gap-1"><Car size={12} /> {L('inkl.', 'incl.', 'dahil')} {formatPrice(anfahrtCost)} {L('Anfahrtskosten', 'approach fee', 'yaklaşım ücreti')}</p>
                  )}

                  {/* Promo code — shown when any active promo exists (with or without banner) */}
                  {hasAnyActivePromo && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      {appliedPromo ? (
                        <div className="flex items-center justify-between gap-2 bg-green-500/15 border border-green-400/30 rounded-lg px-3 py-2 text-sm">
                          <span className="text-green-300 font-medium"><PartyPopper size={13} className="inline mr-1" /> {appliedPromo.code}: −{formatPrice(appliedPromo.discountAmount)}</span>
                          <button onClick={() => { setAppliedPromo(null); setPromoInput(''); }} className="text-white/60 hover:text-white text-xs">
                            × {L('Entfernen', 'Remove', 'Kaldır')}
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={promoInput}
                              onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                              placeholder={L('Aktionscode', 'Promo code', 'Promosyon kodu')}
                              className="flex-1 min-w-0 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm uppercase tracking-wider text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold-400"
                            />
                            <button onClick={handleApplyPromo} disabled={promoLoading || !promoInput.trim()} className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
                              {promoLoading ? '…' : L('Anwenden', 'Apply', 'Uygula')}
                            </button>
                          </div>
                          {promoError && <p className="text-red-300 text-xs mt-1.5">{promoError}</p>}
                        </>
                      )}
                    </div>
                  )}

                  <ul className="mt-5 space-y-3">
                    {[
                      L('Keine versteckten Kosten', 'No hidden costs', 'Gizli maliyet yok'),
                      L('Kostenloser Storno bis 3 Std.', 'Free cancellation up to 3 hrs', '3 saate kadar ücretsiz iptal'),
                      L('Zahlung auch beim Fahrer möglich', 'Payment to the driver also possible', 'Şoföre ödeme de mümkün'),
                      L('Sofortige Bestätigung', 'Instant confirmation', 'Anında onay'),
                      L('Festpreis garantiert', 'Fixed price guaranteed', 'Sabit fiyat garantili'),
                    ].map((item, i) => (
                      <li key={item} className="flex items-center gap-3 text-sm text-white/90">
                        {i === 2 ? (
                          <span className="flex items-center justify-center w-5 h-5 rounded bg-green-500 shrink-0"><Banknote size={13} className="text-white" /></span>
                        ) : (
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 shrink-0"><Check size={12} strokeWidth={3.5} className="text-white" /></span>
                        )}
                        {item}
                      </li>
                    ))}
                  </ul>

                  {submitState === 'error' && (
                    <div className="mt-4 flex items-center gap-2 text-red-200 bg-red-500/15 border border-red-400/30 px-3 py-2.5 rounded-lg text-sm">
                      <AlertCircle size={16} className="shrink-0" /> {tx.err_submit}
                    </div>
                  )}

                  <button onClick={handleSubmit} disabled={isLoading}
                    className="mt-6 w-full bg-gold-400 hover:bg-[#f0b92b] active:bg-gold-500 disabled:opacity-70 text-primary-800 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2.5 text-base">
                    {isLoading ? <><Loader2 size={20} className="animate-spin" /> {tx.submitting}</> : <><Lock size={18} /> {tx.review_confirm} <ArrowRight size={18} /></>}
                  </button>
                  <p className="mt-3 flex items-start justify-center gap-2 text-xs text-white/75 text-center">
                    <Lock size={14} className="shrink-0 mt-0.5" /> {L('Ihre Daten sind bei uns sicher und werden verschlüsselt übertragen.', 'Your data is safe with us and transmitted encrypted.', 'Verileriniz bizde güvende ve şifreli olarak iletilir.')}
                  </p>
                </div>

                {/* Zahlungsart */}
                <div className={cardCls}>
                  {cardHead(CreditCard, L('Zahlungsart', 'Payment method', 'Ödeme yöntemi'), backToForm)}
                  <div className="flex items-center gap-3 sm:pl-1">
                    <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-gray-50 border border-gray-200 shrink-0">
                      {payment === 'cash' ? <Banknote size={22} className="text-gray-900" /> : <CreditCard size={22} className="text-gray-900" />}
                    </span>
                    <div className="text-sm">
                      <p className="font-bold text-gray-900">{payment === 'cash' ? tx.cash : tx.card}{payment === 'card' && cardResult?.last4 ? ` ···· ${cardResult.last4}` : ''}</p>
                      <p className="text-gray-600">{payment === 'cash' ? L('Zahlung direkt beim Fahrer', 'Pay the driver directly', 'Doğrudan şoföre ödeme') : L('Sicher über Stripe hinterlegt', 'Securely stored via Stripe', 'Stripe ile güvenle kaydedildi')}</p>
                    </div>
                  </div>
                </div>

                {/* Hilfe */}
                <div className={cardCls}>
                  <div className="flex items-center gap-3.5">
                    <span className="flex items-center justify-center w-11 h-11 rounded-full shrink-0" style={{ background: '#fdf0c8' }}>
                      <Headphones size={20} className="text-primary-800" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-primary-800">{L('Fragen? Wir helfen gern!', 'Questions? We are happy to help!', 'Sorunuz mu var? Yardımcı olalım!')}</p>
                      <p className="text-sm text-gray-600">{L('Unser Team ist 24/7 für Sie erreichbar.', 'Our team is available 24/7.', 'Ekibimiz 7/24 ulaşılabilir.')}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                    <a href={CONTACT_INFO.phoneHref} className="group flex flex-col items-center gap-2">
                      <span className="flex items-center justify-center w-11 h-11 rounded-full group-hover:scale-105 transition-transform" style={{ background: '#fdf0c8' }}><Phone size={19} className="text-primary-800" /></span>
                      <span className="text-[11px] sm:text-xs font-semibold text-gray-900 whitespace-nowrap">{CONTACT_INFO.phone}</span>
                    </a>
                    <a href={CONTACT_INFO.whatsapp} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-2">
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-green-500 group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.79 14.02c-.24.68-1.42 1.3-1.95 1.35-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.92-4.66-4.1-.13-.18-1.1-1.47-1.1-2.8 0-1.33.7-1.99.95-2.26.24-.27.53-.34.71-.34l.51.01c.16.01.38-.06.6.46.22.53.75 1.83.82 1.96.07.13.11.29.02.47-.09.18-.13.29-.27.45-.13.16-.28.35-.4.47-.13.13-.27.28-.12.54.16.27.69 1.14 1.48 1.84 1.02.91 1.88 1.19 2.15 1.32.27.13.42.11.58-.07.16-.18.67-.78.85-1.05.18-.27.36-.22.6-.13.25.09 1.56.74 1.83.87.27.13.44.2.51.31.07.11.07.64-.17 1.32z" /></svg>
                      </span>
                      <span className="text-[11px] sm:text-xs font-semibold text-gray-900">WhatsApp</span>
                    </a>
                    <a href={`mailto:${CONTACT_INFO.email}`} className="group flex flex-col items-center gap-2">
                      <span className="flex items-center justify-center w-11 h-11 rounded-full group-hover:scale-105 transition-transform" style={{ background: '#fdf0c8' }}><Mail size={19} className="text-primary-800" /></span>
                      <span className="text-[11px] sm:text-xs font-semibold text-gray-900">E-Mail</span>
                    </a>
                  </div>
                </div>

                <div className="lg:hidden flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs text-gray-700 border" style={{ background: '#eaf1fa', borderColor: '#dbe6f3' }}>
                  <Info size={16} className="shrink-0 text-primary-800 mt-0.5" />
                  <span>
                    {L('Mit der Buchung akzeptieren Sie unsere', 'By booking you accept our', 'Rezervasyonla')}{' '}
                    <a href={locale === 'de' ? '/agb' : `/${locale}/agb`} target="_blank" className="underline">{L('AGB', 'Terms', 'Hizmet Şartlarımızı')}</a>{' '}
                    {L('und', 'and', 've')}{' '}
                    <a href={locale === 'de' ? '/datenschutz' : `/${locale}/datenschutz`} target="_blank" className="underline">{L('Datenschutzerklärung', 'Privacy Policy', 'Gizlilik Politikamızı')}</a>
                    {locale === 'tr' ? ' kabul etmiş olursunuz.' : '.'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <SocialProofToast locale={locale} />
        </div>
      );
    }
  }

  const inputCls = 'w-full bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none py-0.5';
  return (
    <div className="min-h-screen" style={{ background: '#f4f7fb' }}>
      {/* Hero — heller Verlauf, rechts Flughafenfoto (Terminal, Tower, Flugzeug, "Mehr als ein Taxi") */}
      <section className="relative overflow-hidden lg:overflow-visible">
        {heroBackdrop}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 md:pt-10 pb-6">
          <p className="text-xs font-semibold tracking-[.28em] uppercase text-gray-700">{L('Buchung', 'Booking', 'Rezervasyon')}</p>
          <h1 className="mt-2 text-4xl md:text-[44px] font-extrabold tracking-tight text-primary-800">{tx.title}</h1>
          <p className="mt-2 text-base md:text-lg text-gray-700">{L('Nur noch wenige Schritte zu Ihrem stressfreien Transfer.', 'Just a few steps to your stress-free transfer.', 'Stressiz transferinize sadece birkaç adım kaldı.')}</p>

          {/* Stepper */}
          <ol className="mt-7 flex items-center gap-2 sm:gap-3">
            {steps.map((label, i) => {
              const done = i === 0;
              const active = i === 1;
              return (
                <li key={label} className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {i > 0 && <span className="hidden sm:block h-px w-6 lg:w-10 bg-gray-300 shrink-0" aria-hidden="true" />}
                  <button
                    type="button"
                    disabled={!done}
                    onClick={() => done && router.back()}
                    className="flex items-center gap-2 min-w-0 disabled:cursor-default"
                  >
                    <span className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0',
                      done && 'bg-primary-800 text-white',
                      active && 'bg-gold-400 text-primary-800 ring-2 ring-primary-800',
                      !done && !active && 'bg-gray-200 text-gray-700'
                    )}>
                      {done ? <Check size={16} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className={cn('text-sm whitespace-nowrap', active ? 'font-bold text-gray-900' : 'font-medium text-gray-700', !active && 'hidden md:inline lg:hidden xl:inline')}>{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
          {/* LEFT: Form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(15,27,45,.06)] p-4 sm:p-6">
            {/* Persönliche Daten */}
            {sectionHead(User, L('Persönliche Daten', 'Personal details', 'Kişisel bilgiler'), L('Bitte geben Sie Ihre Daten ein, um die Buchung abzuschließen.', 'Please enter your details to complete the booking.', 'Rezervasyonu tamamlamak için lütfen bilgilerinizi girin.'))}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldBox as="label" icon={User} label={L('Vorname', 'First name', 'Ad')} required error={errors.firstName}>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} onBlur={e => validateField('firstName', e.target.value)} autoComplete="given-name" enterKeyHint="next" className={inputCls} placeholder="Max" />
              </FieldBox>
              <FieldBox as="label" icon={UserRound} label={L('Nachname', 'Last name', 'Soyad')} required error={errors.lastName}>
                <input value={lastName} onChange={e => setLastName(e.target.value)} onBlur={e => validateField('lastName', e.target.value)} autoComplete="family-name" enterKeyHint="next" className={inputCls} placeholder="Mustermann" />
              </FieldBox>
              <FieldBox icon={Phone} label={L('Telefonnummer', 'Phone number', 'Telefon numarası')} required hasError={!!errors.phone}>
                <div className="pt-1">
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                    country={phoneCountry}
                    onCountryChange={setPhoneCountry}
                    result={phoneResult}
                    locale={locale}
                    errorText={errors.phone}
                    statusEnabled={phoneValidationEnabled}
                    compact
                  />
                </div>
              </FieldBox>
              <FieldBox as="label" icon={Mail} label={L('E-Mail', 'Email', 'E-posta')} required error={errors.email}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={e => validateField('email', e.target.value)} autoComplete="email" inputMode="email" autoCapitalize="off" enterKeyHint="next" className={inputCls} placeholder="max.mustermann@example.com" />
              </FieldBox>
              <div>
                <FieldBox as="label" icon={Plane} label={flightNumberRequired ? L('Flugnummer', 'Flight number', 'Uçuş numarası') : L('Flugnummer (optional)', 'Flight number (optional)', 'Uçuş numarası (isteğe bağlı)')} required={flightNumberRequired} error={errors.flightNumber}>
                  <input value={flightNumber} onChange={e => setFlightNumber(e.target.value)} onBlur={e => validateField('flightNumber', e.target.value)} className={inputCls} placeholder={L('z. B. LH1234', 'e.g. LH1234', 'örn. LH1234')} />
                </FieldBox>
                {flightCheckStatus === 'checking' && (
                  <p className="text-gray-400 text-xs mt-1.5 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> {tx.flightChecking}
                  </p>
                )}
                {flightCheckStatus === 'found' && flightCheckResult && (
                  <div className="mt-1.5 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 text-xs text-green-700 flex items-start gap-1.5">
                    <CheckCircle size={13} className="mt-0.5 shrink-0" />
                    <span>{tx.flightConfirmed}: {buildFlightInfo()}</span>
                  </div>
                )}
                {flightCheckStatus === 'wrongairport' && flightCheckResult && (
                  <div className="mt-1.5 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5 text-xs text-orange-700 flex items-start gap-1.5">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    <span>{tx.flightWrongAirport} ({buildFlightInfo()})</span>
                  </div>
                )}
                {flightCheckStatus === 'notfound' && (
                  <div className="mt-1.5 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-1.5 text-xs text-yellow-700 flex items-start gap-1.5">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    <span>{tx.flightNotFound}</span>
                  </div>
                )}
              </div>
              <FieldBox icon={Luggage} label={tx.luggage}>
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-stretch border border-gray-200 rounded-lg overflow-hidden flex-1 max-w-[220px]">
                    <button type="button" aria-label="−" onClick={() => setLuggageCount(l => Math.max(0, l - 1))} className="w-10 flex items-center justify-center text-gray-800 hover:bg-gray-50"><Minus size={16} /></button>
                    <span className="flex-1 text-center text-[15px] font-semibold text-gray-900 border-x border-gray-200 py-1.5">{luggageCount}</span>
                    <button type="button" aria-label="+" onClick={() => setLuggageCount(l => Math.min(maxLuggage, l + 1))} className="w-10 flex items-center justify-center text-gray-800 hover:bg-gray-50"><Plus size={16} /></button>
                  </div>
                  <span className="relative group shrink-0">
                    <Info size={18} className="text-gray-500" />
                    <span className="absolute right-0 bottom-full mb-2 w-48 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                      {L(`Maximal ${maxLuggage} Gepäckstücke für dieses Fahrzeug.`, `Up to ${maxLuggage} pieces of luggage for this vehicle.`, `Bu araç için en fazla ${maxLuggage} bagaj.`)}
                    </span>
                  </span>
                </div>
              </FieldBox>
              {flightNumberRequired && (
                <div className="sm:col-span-2">
                  <FieldBox as="label" icon={Signpost} label={L('Abholschild', 'Pickup sign', 'Karşılama tabelası')} required error={errors.pickupSign}>
                    <input value={pickupSign} onChange={e => setPickupSign(e.target.value)} onBlur={e => validateField('pickupSign', e.target.value)} className={inputCls} placeholder={L('z. B. Familie Müller', 'e.g. Smith family', 'örn. Müller ailesi')} />
                  </FieldBox>
                  {!errors.pickupSign && <p className="text-xs text-gray-400 mt-1 ml-1">{L('Name auf dem Abholschild am Flughafen', 'Name on the pickup sign at the airport', 'Havalimanında karşılama tabelasındaki isim')}</p>}
                </div>
              )}
              <div className="sm:col-span-2">
                <FieldBox as="label" icon={MessageSquare} label={L('Anmerkung (optional)', 'Note (optional)', 'Not (isteğe bağlı)')}>
                  <textarea value={notes} onChange={e => setNotes(e.target.value.slice(0, 500))} rows={3} maxLength={500} className={cn(inputCls, 'resize-none')} placeholder={L('z. B. Kindersitz, besondere Wünsche …', 'e.g. child seat, special requests …', 'örn. çocuk koltuğu, özel istekler …')} />
                  <span className="block text-right text-xs text-gray-400">{notes.length}/500</span>
                </FieldBox>
              </div>
            </div>

            {/* Extras */}
            <div className="mt-8">
              {sectionHead(Star, 'Extras', L('Machen Sie Ihre Fahrt noch komfortabler.', 'Make your ride even more comfortable.', 'Yolculuğunuzu daha da konforlu hale getirin.'))}
              <div className="space-y-3">
                {/* Kindersitz */}
                <div className={cn('border rounded-xl transition-colors', childSeat ? 'border-gold-400 bg-[#fffbef]' : 'border-gray-200')}>
                  <OptionRow
                    checked={childSeat}
                    onToggle={() => {
                      const newVal = !childSeat;
                      setChildSeat(newVal);
                      if (!newVal) { setChildSeatBabyschale(0); setChildSeatKindersitz(0); setChildSeatSitzerhoehung(0); }
                    }}
                    icon={Baby}
                    title={L('Kindersitz', 'Child seat', 'Çocuk koltuğu')}
                    sub={L('Kostenlos – bitte bei der Buchung angeben.', 'Free – please specify when booking.', 'Ücretsiz – lütfen rezervasyonda belirtin.')}
                  />
                  {childSeat && (
                    <div className="px-4 pb-4 pl-4 sm:pl-[74px] space-y-3">
                      <p className="text-xs text-gray-500 font-medium">{L('Bitte wählen Sie die benötigten Kindersitze:', 'Please select the child seats you need:', 'Lütfen ihtiyacınız olan çocuk koltuklarını seçin:')}</p>
                      {[
                        { label: L('Babyschale', 'Infant carrier', 'Bebek taşıyıcı'), hint: L('0–12 Monate', '0–12 months', '0–12 ay'), value: childSeatBabyschale, set: setChildSeatBabyschale },
                        { label: L('Kindersitz', 'Child seat', 'Çocuk koltuğu'), hint: L('1–4 Jahre, bis 18 kg', '1–4 years, up to 18 kg', "1–4 yaş, 18 kg'a kadar"), value: childSeatKindersitz, set: setChildSeatKindersitz },
                        { label: L('Sitzerhöhung', 'Booster seat', 'Yükseltici koltuk'), hint: L('4–12 Jahre, bis 36 kg', '4–12 years, up to 36 kg', "4–12 yaş, 36 kg'a kadar"), value: childSeatSitzerhoehung, set: setChildSeatSitzerhoehung },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{row.label}</p>
                            <p className="text-xs text-gray-400">{row.hint}</p>
                          </div>
                          <Counter value={row.value} onChange={row.set} max={3} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rückfahrt */}
                {!roundtripFromErgebnisse && (
                  <div className={cn('border rounded-xl transition-colors', tripType === 'roundtrip' ? 'border-gold-400 bg-[#fffbef]' : 'border-gray-200')}>
                    <OptionRow
                      checked={tripType === 'roundtrip'}
                      onToggle={() => {
                        if (tripType === 'roundtrip') { setTripType('oneway'); setReturnDate(''); setReturnTime('10:00'); }
                        else setTripType('roundtrip');
                        setAppliedPromo(null); setPromoInput(''); setPromoError('');
                      }}
                      icon={ArrowLeftRight}
                      title={L('Rückfahrt hinzufügen', 'Add return trip', 'Dönüş ekle')}
                      sub={`${roundtripDiscount}% ${L('Rabatt auf Hin- & Rückfahrt', 'discount on the round trip', 'gidiş-dönüş indirimi')}`}
                    />
                    {tripType === 'roundtrip' && (
                      <div className="px-4 pb-4 pl-4 sm:pl-[74px] flex flex-wrap gap-3">
                        <label className="flex flex-col gap-1 flex-1 min-w-[140px]">
                          <span className="text-xs text-gray-500 font-medium">{L('Rückfahrtdatum', 'Return date', 'Dönüş tarihi')}</span>
                          <input type="date" value={returnDate} min={date} onChange={e => setReturnDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400 bg-white" />
                        </label>
                        <label className="flex flex-col gap-1 flex-1 min-w-[120px]">
                          <span className="text-xs text-gray-500 font-medium">{L('Rückfahrtzeit', 'Return time', 'Dönüş saati')}</span>
                          <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400 bg-white" />
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* Zwischenstopp */}
                {zwischenstoppEnabled && !zwischenstoppFromErgebnisse && (
                  <div className={cn('border rounded-xl transition-colors relative', (localZwischenstopp || showZwischenstoppPicker) ? 'border-gold-400 bg-[#fffbef]' : 'border-gray-200')}>
                    <OptionRow
                      checked={!!localZwischenstopp || showZwischenstoppPicker}
                      onToggle={() => {
                        if (localZwischenstopp) { setLocalZwischenstopp(''); setLocalZwischenstoppBasePrice(0); setLocalZwischenstoppDistanceKm(0); setLocalZwischenstoppDuration(0); }
                        else if (showZwischenstoppPicker) { setShowZwischenstoppPicker(false); setZwischenstoppInput(''); setZwischenstoppSuggestions([]); }
                        else setShowZwischenstoppPicker(true);
                      }}
                      icon={MapPin}
                      title={L('Zwischenstopp', 'Intermediate stop', 'Ara durak')}
                      sub={localZwischenstopp || L('Unterwegs einen Halt einlegen', 'Make a stop on the way', 'Yolda bir mola verin')}
                    />
                    {showZwischenstoppPicker && !localZwischenstopp && (
                      <div className="px-4 pb-4 pl-4 sm:pl-[74px] relative">
                        <input
                          type="text"
                          value={zwischenstoppInput}
                          onChange={e => setZwischenstoppInput(e.target.value)}
                          placeholder={L('Adresse eingeben...', 'Enter address...', 'Adres girin...')}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400 bg-white"
                          autoFocus
                        />
                        {zwischenstoppSuggestions.length > 0 && (
                          <div className="absolute left-4 sm:left-[74px] right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                            {zwischenstoppSuggestions.map((s: any) => (
                              <button
                                key={s.place_id}
                                type="button"
                                onClick={async () => {
                                  setShowZwischenstoppPicker(false);
                                  setZwischenstoppInput('');
                                  setZwischenstoppSuggestions([]);
                                  setZwischenstoppLoading(true);
                                  try {
                                    const r = await fetch(`${API_URL}/maps/distance`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ origin: pickup, destination: dropoff, zwischenstopp: s.description, language: locale }),
                                    });
                                    const data = await r.json();
                                    if (data.zwischenstopp_total_km && vehiclePriceConfig) {
                                      const km = data.zwischenstopp_total_km;
                                      const calc = vehiclePriceConfig.base_price + km * vehiclePriceConfig.price_per_km;
                                      const newBasePrice = (vehiclePriceConfig.min_price > 0 && km <= (vehiclePriceConfig.min_price_km || 15))
                                        ? Math.max(calc, vehiclePriceConfig.min_price)
                                        : calc;
                                      setLocalZwischenstoppDistanceKm(km);
                                      setLocalZwischenstoppDuration(data.zwischenstopp_total_duration || duration);
                                      setLocalZwischenstoppBasePrice(Math.ceil(newBasePrice * 2) / 2);
                                    }
                                  } catch (e) {
                                    console.error('Zwischenstopp distance calc failed:', e);
                                  } finally {
                                    setZwischenstoppLoading(false);
                                  }
                                  setLocalZwischenstopp(s.description);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 border-b border-gray-50 last:border-0"
                              >
                                {s.description}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {zwischenstoppLoading && (
                      <div className="px-4 pb-3 pl-4 sm:pl-[74px] flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 size={14} className="animate-spin" /> {L('Berechne Route...', 'Calculating route...', 'Rota hesaplanıyor...')}
                      </div>
                    )}
                  </div>
                )}

                {/* Fahrrad */}
                {fahrradEnabled && (
                  <div className="flex items-center gap-4 border border-gray-200 rounded-xl px-4 py-3">
                    <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 shrink-0 ml-9">
                      <Bike size={20} className="text-gray-800" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{L('Fahrrad', 'Bicycle', 'Bisiklet')}</p>
                      <p className="text-xs text-gray-600">{fahrradPrice > 0 ? `${formatPrice(fahrradPrice)} / ${L('Stk.', 'each', 'adet')}` : L('Kostenlos', 'Free', 'Ücretsiz')}</p>
                    </div>
                    <Counter value={fahrradCount} onChange={setFahrradCount} max={4} />
                  </div>
                )}

                {/* Rechnung für Firma */}
                <div className={cn('border rounded-xl transition-colors', rechnungRequired ? 'border-gold-400 bg-[#fffbef]' : 'border-gray-200')}>
                  <OptionRow
                    checked={rechnungRequired}
                    onToggle={() => {
                      const newVal = !rechnungRequired;
                      setRechnungRequired(newVal);
                      if (newVal) {
                        setRechnungDraft(rechnungAdresse);
                        setShowRechnungBeispiel(false);
                        setShowRechnungModal(true);
                      } else {
                        setRechnungAdresse('');
                        setErrors(e => { const { rechnung, ...rest } = e; return rest; });
                      }
                    }}
                    icon={FileText}
                    title={rx.toggle}
                    sub={rx.toggleHint}
                  />
                  {rechnungRequired && rechnungAdresse && (
                    <div className="px-4 pb-4 pl-4 sm:pl-[74px] flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-green-700 flex items-center gap-1"><Check size={12} /> {rx.saved}</p>
                        <p className="text-sm text-gray-700 mt-1 whitespace-pre-line break-words">{rechnungAdresse}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setRechnungDraft(rechnungAdresse); setShowRechnungBeispiel(false); setShowRechnungModal(true); }}
                        className="text-xs font-semibold text-primary-600 hover:text-primary-700 shrink-0"
                      >
                        {rx.edit}
                      </button>
                    </div>
                  )}
                </div>
                {errors.rechnung && <p className="text-red-500 text-xs">{errors.rechnung}</p>}
              </div>
            </div>

            {/* Zahlungsart */}
            <div className="mt-8">
              {sectionHead(CreditCard, L('Zahlungsart', 'Payment method', 'Ödeme yöntemi'), L('Sie können bequem vorab oder direkt beim Fahrer bezahlen.', 'Pay conveniently in advance or directly to the driver.', 'Rahatça önceden veya doğrudan şoföre ödeyebilirsiniz.'))}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { key: 'cash' as const, Icon: Banknote, title: tx.cash, sub: L('Zahlung direkt beim Fahrer', 'Pay the driver directly', 'Doğrudan şoföre ödeme') },
                  { key: 'card' as const, Icon: CreditCard, title: tx.card, sub: 'Visa, Mastercard, Amex' },
                ]).map(({ key, Icon, title, sub }) => {
                  const selected = payment === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPayment(key)}
                      aria-pressed={selected}
                      className={cn(
                        'flex items-center gap-4 text-left rounded-xl px-4 py-4 transition-all',
                        selected ? 'border-2 border-gold-400 bg-[#fffaeb]' : 'border border-gray-200 bg-white hover:border-gray-300 m-px'
                      )}
                    >
                      <span className={cn('flex items-center justify-center w-12 h-12 rounded-lg shrink-0', selected ? 'bg-[#fdf0c8]' : 'bg-gray-50 border border-gray-200')}>
                        <Icon size={24} className="text-gray-900" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-gray-900">{title}</span>
                        <span className="block text-xs text-gray-600 mt-0.5">{sub}</span>
                      </span>
                      {selected ? (
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gold-400 shrink-0"><Check size={14} strokeWidth={3} className="text-primary-800" /></span>
                      ) : (
                        <span className="w-6 h-6 rounded-full border-2 border-gray-300 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
              {payment === 'card' && (
                <div className="mt-4 space-y-3">
                  <CardPaymentField
                    ref={cardFieldRef}
                    locale={locale}
                    name={name || undefined}
                    email={email.trim() || undefined}
                    errorText={errors.card}
                    notConfiguredText={L('Kartenzahlung ist noch nicht konfiguriert.', 'Card payment is not configured yet.', 'Kart ödemesi henüz yapılandırılmadı.')}
                    trustText={L('Ihre Kreditkartendaten werden verschlüsselt direkt an unseren Zahlungsdienstleister Stripe übertragen und niemals auf unseren Servern gespeichert.', 'Your card details are encrypted and transmitted directly to our payment provider Stripe — they are never stored on our servers.', "Kart bilgileriniz şifrelenerek doğrudan ödeme sağlayıcımız Stripe'a iletilir ve sunucularımızda asla saklanmaz.")}
                  />
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-700 font-semibold">
                    <Lock size={14} /> {L('SSL-verschlüsselt — Ihre Kartendaten sind sicher', 'SSL encrypted — your card data is secure', 'SSL şifreli — kart bilgileriniz güvende')}
                  </div>
                </div>
              )}
            </div>

            {/* Trust row */}
            <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-2 gap-4 md:flex md:flex-wrap md:justify-between md:gap-x-2 md:gap-y-3">
              {[
                { Icon: Ban, title: L('Kostenloser Storno', 'Free cancellation', 'Ücretsiz iptal'), sub: L('bis 3 Std. vor Abfahrt', 'up to 3 hrs before', 'kalkıştan 3 saat önce'), green: true },
                { Icon: BadgeEuro, title: L('Festpreis garantiert', 'Fixed price guaranteed', 'Sabit fiyat garantili'), sub: L('Ohne versteckte Kosten', 'No hidden costs', 'Gizli maliyet yok'), green: true },
                { Icon: Mail, title: L('Sofortige Bestätigung', 'Instant confirmation', 'Anında onay'), sub: L('Per E-Mail', 'By email', 'E-posta ile'), green: true },
                { Icon: Banknote, title: L('Zahlung beim Fahrer', 'Pay the driver', 'Şoföre ödeme'), sub: L('Bar oder Karte', 'Cash or card', 'Nakit veya kart'), green: false },
              ].map(({ title, sub, green }) => (
                <div key={title} className="flex items-center gap-1.5 min-w-0 md:whitespace-nowrap">
                  {green ? (
                    <span className="flex items-center justify-center w-[22px] h-[22px] rounded-full bg-green-500 shrink-0"><Check size={13} strokeWidth={3} className="text-white" /></span>
                  ) : (
                    <span className="flex items-center justify-center w-6 h-6 shrink-0"><Banknote size={22} className="text-green-600" /></span>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs md:text-[11.5px] font-bold text-gray-900 leading-tight">{title}</p>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {submitState === 'error' && (
              <div className="mt-5 flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm">
                <AlertCircle size={16} /> {tx.err_submit}
              </div>
            )}

            <button onClick={handleContinueToReview} disabled={cardSubmitting}
              className="mt-6 w-full bg-gold-400 hover:bg-[#f0b92b] active:bg-gold-500 text-primary-800 font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-base shadow-sm disabled:opacity-60">
              {cardSubmitting ? <><Loader2 size={20} className="animate-spin" /> {tx.submitting}</> : <>{tx.submit} <ArrowRight size={18} /></>}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-gray-600">
              <Lock size={13} /> {L('Ihre Daten sind bei uns sicher und werden verschlüsselt übertragen.', 'Your data is safe with us and transmitted encrypted.', 'Verileriniz bizde güvende ve şifreli olarak iletilir.')}
            </p>
          </div>

          {/* RIGHT: Booking summary */}
          <div className="lg:sticky lg:top-24 lg:mt-[68px] xl:mt-[118px]">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(15,27,45,.08)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4" style={{ background: '#0f1b2d' }}>
                <h3 className="text-white font-bold text-lg">{tx.summary}</h3>
                <button type="button" onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-white/90 hover:text-gold-400 underline underline-offset-2">
                  <Pencil size={14} /> {L('Ändern', 'Change', 'Değiştir')}
                </button>
              </div>

              <div className="p-5">
                {/* Vehicle */}
                <div className="flex items-center gap-4">
                  <div className="w-[108px] h-[68px] rounded-lg overflow-hidden shrink-0 bg-gray-50">
                    <img src={VEHICLE_IMAGES[vehicle] || '/images/kombi.webp'} alt={vehicleLabel} loading="lazy" width={800} height={344} className="w-full h-full object-cover object-[35%_center]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold text-primary-800 leading-tight">{vehicleLabel}</p>
                    {vehicleDesc && <p className="text-sm text-gray-600 mt-0.5">{vehicleDesc}</p>}
                  </div>
                </div>
                <div className="mt-4 pb-4 border-b border-gray-100 grid grid-cols-3 gap-2 text-[12px] leading-tight text-gray-800">
                  {[
                    { Icon: User, a: maxPassengers ? `${L('Bis zu', 'Up to', 'En fazla')} ${maxPassengers}` : String(passengers), b: L('Passagiere', 'Passengers', 'Yolcu') },
                    { Icon: Luggage, a: String(maxLuggage), b: L('Gepäckstücke', 'Luggage', 'Bagaj') },
                    { Icon: Clock, a: `ca. ${effectiveDuration} Min.`, b: L('Fahrtzeit', 'Journey time', 'Süre') },
                  ].map(({ Icon, a, b }) => (
                    <div key={b} className="flex items-center gap-1.5 min-w-0">
                      <Icon size={20} className="shrink-0 text-gray-900" />
                      <div className="min-w-0"><div className="truncate">{a}</div><div className="truncate text-gray-600">{b}</div></div>
                    </div>
                  ))}
                </div>

                {/* Route timeline */}
                <div className="mt-4 space-y-4">
                  <div className="relative flex items-start gap-3">
                    <span className="absolute left-[7px] top-5 bottom-[-18px] border-l-2 border-dotted border-gray-400" aria-hidden="true" />
                    <span className="relative mt-1 w-4 h-4 rounded-full border-[3px] border-gold-400 bg-white shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{L('Abholung', 'Pickup', 'Alış')}</p>
                      <p className="text-sm text-gray-700 break-words">{addressIcon(pickup)}{pickup}</p>
                    </div>
                    {editBtn(changeSearch)}
                  </div>
                  {zwStopAddress && (
                    <div className="relative flex items-start gap-3">
                      <span className="absolute left-[7px] top-5 bottom-[-18px] border-l-2 border-dotted border-gray-400" aria-hidden="true" />
                      <span className="relative mt-1 w-4 h-4 rounded-full bg-blue-500 border-[3px] border-blue-100 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{L('Zwischenstopp', 'Intermediate stop', 'Ara durak')}</p>
                        <p className="text-sm text-gray-700 break-words">{zwStopAddress}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-primary-800 shrink-0"><Plus size={10} strokeWidth={3.5} className="text-white" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{L('Ziel', 'Destination', 'Varış')}</p>
                      <p className="text-sm font-bold text-gray-900 break-words">{dropoff}</p>
                    </div>
                    {editBtn(changeSearch)}
                  </div>
                </div>

                <div className="[&>div]:mt-4 [&>div]:rounded-xl">
                  <RouteMap
                    pickup={pickup}
                    dropoff={dropoff}
                    waypoint={zwStopAddress || undefined}
                    pickupCoords={pickupLat && pickupLng ? { lat: Number(pickupLat), lng: Number(pickupLng) } : null}
                    dropoffCoords={dropoffLat && dropoffLng ? { lat: Number(dropoffLat), lng: Number(dropoffLng) } : null}
                  />
                </div>

                {/* Details */}
                <div className="mt-5 space-y-3.5">
                  <div className="flex items-start gap-3">
                    <CalendarDays size={20} className="mt-0.5 shrink-0 text-gray-900" />
                    <div className="flex-1 min-w-0 text-sm">
                      <p className="text-gray-900">{L('Abfahrt', 'Departure', 'Kalkış')}</p>
                      <p className="text-gray-700">{dateFormatted} · {time} {L('Uhr', '', '')}</p>
                    </div>
                    {editBtn(changeSearch)}
                  </div>
                  {tripType === 'roundtrip' && returnDate && (
                    <div className="flex items-start gap-3">
                      <ArrowLeftRight size={20} className="mt-0.5 shrink-0 text-gray-900" />
                      <div className="flex-1 min-w-0 text-sm">
                        <p className="text-gray-900">{L('Rückfahrt', 'Return trip', 'Dönüş')}</p>
                        <p className="text-gray-700">{returnDateLong} · {returnTime} {L('Uhr', '', '')}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <User size={20} className="mt-0.5 shrink-0 text-gray-900" />
                    <div className="flex-1 min-w-0 text-sm">
                      <p className="text-gray-900">{L('Personen', 'Passengers', 'Kişi')}</p>
                      <p className="text-gray-700">{passengers} {passengers === 1 ? L('Person', 'passenger', 'kişi') : L('Personen', 'passengers', 'kişi')}</p>
                    </div>
                    {editBtn(changeSearch)}
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin size={20} className="mt-0.5 shrink-0 text-gray-900" />
                    <div className="flex-1 min-w-0 text-sm">
                      <p className="text-gray-900">{L('Strecke', 'Distance', 'Mesafe')}</p>
                      <p className="text-gray-700">{kmText} km · ca. {effectiveDuration} Min.</p>
                    </div>
                  </div>
                  {(childSeat || fahrradCount > 0) && (
                    <div className="flex items-start gap-3">
                      <Star size={20} className="mt-0.5 shrink-0 text-gray-900" />
                      <div className="flex-1 min-w-0 text-sm">
                        <p className="text-gray-900">Extras</p>
                        {childSeat && <p className="text-gray-700">{buildChildSeatDetails() || L('Kindersitz', 'Child seat', 'Çocuk koltuğu')} ({L('kostenlos', 'free', 'ücretsiz')})</p>}
                        {fahrradCount > 0 && <p className="text-gray-700">{fahrradCount}× {L('Fahrrad', 'Bicycle', 'Bisiklet')}</p>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Price */}
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-lg font-extrabold text-primary-800 mt-4">{L('Gesamtpreis', 'Total price', 'Toplam fiyat')}</span>
                    <div className="text-right">
                      {autoDiscountReady && strikePrice != null && strikePrice > finalPriceWithAutoDiscount && (
                        <div className="text-base text-gray-400 line-through">{formatPrice(strikePrice)}</div>
                      )}
                      {autoDiscountReady
                        ? <div className="text-[32px] leading-tight font-extrabold text-primary-800">{formatPrice(finalPriceWithAutoDiscount)}</div>
                        : <span className="h-9 w-28 mt-5 bg-gray-100 rounded animate-pulse inline-block" />}
                    </div>
                  </div>

                  {autoDiscount && !appliedPromo && (
                    autoDiscountRed ? (
                      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                        <span className="inline-flex items-center bg-red-50 text-red-600 text-xs font-bold uppercase px-3 py-1.5 rounded-lg">
                          −{formatPrice(autoDiscountAmount)} · {autoDiscountLabel}
                        </span>
                        {autoDiscountRemaining && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><Flame size={14} className="text-red-500" /> {autoDiscountRemaining}</span>
                        )}
                        <Countdown endsAt={autoDiscount.ends_at} locale={locale} onExpire={onAutoDiscountExpire} className="text-xs font-bold text-red-600 w-full justify-end" />
                      </div>
                    ) : (
                      <p className="text-xs text-green-600 font-medium mt-2 flex items-center gap-1 flex-wrap"><Tag size={12} /> {autoDiscountLabel}: −{formatPrice(autoDiscountAmount)}
                        {autoDiscountRemaining && <span className="ml-1 font-semibold">· {autoDiscountRemaining}</span>}
                        <Countdown endsAt={autoDiscount.ends_at} locale={locale} onExpire={onAutoDiscountExpire} className="ml-1 font-semibold" /></p>
                    )
                  )}
                  {tripType === 'roundtrip' && roundtripDiscount > 0 && (
                    <p className="text-xs text-green-600 font-medium mt-2 flex items-center gap-1"><Tag size={12} /> {roundtripDiscount}% {L('Hin- & Rückfahrt Rabatt inklusive', 'round trip discount included', 'gidiş-dönüş indirimi dahil')}</p>
                  )}
                  {appliedPromo && (
                    <p className="text-xs text-green-600 font-medium mt-2 flex items-center gap-1"><Tag size={12} /> {appliedPromo.code}: −{formatPrice(appliedPromo.discountAmount)}</p>
                  )}
                  {anfahrtCost > 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-2 flex items-center gap-1"><Car size={12} /> {L('inkl.', 'incl.', 'dahil')} {formatPrice(anfahrtCost)} {L('Anfahrtskosten', 'approach fee', 'yaklaşım ücreti')}</p>
                  )}

                  <ul className="mt-5 space-y-2.5">
                    {[
                      L('Inkl. Maut & Gepäck', 'Incl. tolls & luggage', 'Otoyol & bagaj dahil'),
                      L('Keine Vorauszahlung', 'No prepayment', 'Ön ödeme yok'),
                      L('Zahlung auch beim Fahrer möglich', 'Payment to the driver also possible', 'Şoföre ödeme de mümkün'),
                    ].map(item => (
                      <li key={item} className="flex items-center gap-3 text-sm text-gray-800">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 shrink-0"><Check size={12} strokeWidth={3.5} className="text-white" /></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky price + CTA — checkout_v2 variant B only, so uplift is measurable
          via bookings.experiment_variant before rolling out past the rollout percentage.
          Replaces (not stacks with) the global MobileStickyCTA on this page — see the
          matching suppression in SiteChrome.tsx. Reuses the site-wide pb-[88px] bottom
          reservation on <main>, so no separate spacer is needed here. */}
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-gray-400 leading-none">{L('Gesamtpreis', 'Total price', 'Toplam fiyat')}</p>
          {autoDiscountReady
            ? <p className="text-lg font-extrabold text-primary-800 leading-tight">{formatPrice(finalPriceWithAutoDiscount)}</p>
            : <span className="h-5 w-16 bg-gray-100 rounded animate-pulse inline-block" />}
        </div>
        <button
          onClick={handleContinueToReview}
          disabled={cardSubmitting}
          className="flex-1 max-w-[220px] bg-gold-400 hover:bg-[#f0b92b] text-primary-800 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-md disabled:opacity-60"
        >
          {cardSubmitting ? <Loader2 size={18} className="animate-spin" /> : <>{L('Weiter', 'Continue', 'Devam')} <ArrowRight size={16} /></>}
        </button>
      </div>
      <SocialProofToast locale={locale} />

      {/* Rechnungsadresse modal */}
      {showRechnungModal && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[998] transition-opacity duration-300" />
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 animate-cookie-in"
            onClick={(e) => { if (e.target === e.currentTarget) closeRechnungModal(); }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="rechnung-modal-title"
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                    <FileText size={24} className="text-gold-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 id="rechnung-modal-title" className="text-lg font-bold text-white">{rx.modalTitle}</h3>
                    <p className="text-primary-200 text-xs mt-0.5">{rx.modalSubtitle}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeRechnungModal}
                    aria-label={rx.cancel}
                    className="ml-auto text-white/70 hover:text-white transition-colors shrink-0"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-4">
                {/* Warning + example toggle */}
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 mb-3">
                  <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 flex-1">{rx.warning}</p>
                  <button
                    type="button"
                    onClick={() => setShowRechnungBeispiel(v => !v)}
                    title={rx.example}
                    aria-expanded={showRechnungBeispiel}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold shrink-0 hover:bg-amber-300 transition-colors"
                  >
                    ?
                  </button>
                </div>

                {/* Example — mirrors the RECHNUNGSEMPFÄNGER block on the real PDF */}
                {showRechnungBeispiel && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-3 animate-fade-in">
                    <p className="text-[10px] tracking-wide text-gray-400 mb-1">{rx.recipient}</p>
                    <p className="text-sm font-semibold text-gray-900">Muster GmbH</p>
                    <p className="text-xs text-gray-600 leading-5">
                      Max Mustermann<br />
                      Musterstraße 12<br />
                      80331 München<br />
                      {rx.country}
                    </p>
                  </div>
                )}

                <textarea
                  autoFocus
                  rows={6}
                  value={rechnungDraft}
                  onChange={(e) => setRechnungDraft(e.target.value)}
                  placeholder={rx.placeholder}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition placeholder:text-gray-400"
                />

                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <button
                    type="button"
                    disabled={cleanRechnungAdresse(rechnungDraft).split('\n').length < 2}
                    onClick={() => {
                      const cleaned = cleanRechnungAdresse(rechnungDraft);
                      setRechnungAdresse(cleaned);
                      setRechnungRequired(true);
                      setErrors(e => { const { rechnung, ...rest } = e; return rest; });
                      setShowRechnungModal(false);
                    }}
                    className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 hover:shadow-lg disabled:hover:shadow-none text-sm"
                  >
                    {rx.save}
                  </button>
                  <button
                    type="button"
                    onClick={closeRechnungModal}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-all duration-200 text-sm"
                  >
                    {rx.cancel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function BuchenPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BuchenContent />
    </Suspense>
  );
}
