'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { MapPin, ArrowRight, Calendar, Users, Car, User, Phone, Mail, Plane, CreditCard, Banknote, CheckCircle, AlertCircle, Loader2, Luggage, ChevronLeft, Signpost, Baby, Bike, StickyNote, Map, Moon, PartyPopper, Ban, BadgeEuro, Tag, Briefcase, Lock, BadgeCheck } from 'lucide-react';
import { formatPrice, cn, CONTACT_INFO, addressIcon } from '@/lib/utils';
import SocialProofToast from '@/components/SocialProofToast';
import RouteMap from '@/components/RouteMap';
import CardPaymentField, { CardPaymentFieldHandle, CardPaymentResult } from '@/components/booking/CardPaymentField';

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
  grossraumtaxi: '/images/van.webp',
};

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
  useEffect(() => {
    fetch(`${API_URL}/settings`).then(r => r.json()).then(s => {
      if (s.stadtfahrt_enabled === '1') setStadtfahrtEnabled(true);
      if (s.zwischenstopp_enabled === '1') setZwischenstoppEnabled(true);
      if (s.night_confirm_enabled === '0') setNightConfirmEnabled(false);
      if (s.night_confirm_start) setNightStart(parseInt(s.night_confirm_start, 10));
      if (s.night_confirm_end) setNightEnd(parseInt(s.night_confirm_end, 10));
      if (s.flight_validation_enabled === '0') setFlightValidationEnabled(false);
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
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [flightCheckStatus, setFlightCheckStatus] = useState<'idle' | 'checking' | 'found' | 'wrongairport' | 'notfound'>('idle');
  const [flightCheckResult, setFlightCheckResult] = useState<{ airline?: string; origin?: string; scheduledArrival?: string; arrivesMUC?: boolean } | null>(null);
  const flightCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flightCheckAbort = useRef<AbortController | null>(null);
  const [pickupSign, setPickupSign] = useState('');
  const [luggageCount, setLuggageCount] = useState(1);
  const [notes, setNotes] = useState('');
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
      .then(d => { if (d?.hasActive) setHasAnyActivePromo(true); })
      .catch(() => {});
  }, []);

  const discountAmount = appliedPromo?.discountAmount ?? 0;
  const promoBase = appliedPromo?.promoBase ?? price;
  const finalPrice = Math.max(0, promoBase - discountAmount);

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

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = tx.err_name;
    if (!phone.trim()) errs.phone = tx.err_phone;
    if (!email.trim() || !email.includes('@')) errs.email = tx.err_email;
    if (flightNumberRequired && !flightNumber.trim()) errs.flightNumber = locale === 'de' ? 'Flugnummer erforderlich' : locale === 'en' ? 'Flight number required' : 'Uçuş numarası gerekli';
    if (flightNumberRequired && !pickupSign.trim()) errs.pickupSign = locale === 'de' ? 'Abholschild erforderlich' : locale === 'en' ? 'Pickup sign required' : 'Tabela gerekli';
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
        pickup_address: pickup,
        dropoff_address: dropoff,
        pickup_datetime: pickupDatetime,
        vehicle_type: vehicle,
        passengers,
        name: name.trim(),
        phone: phone.trim(),
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
          phone_number: phone.trim(),
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
                  <span className="text-xl font-bold text-primary-600">{formatPrice(finalPrice)}</span>
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

  // Review screen
  if ((submitState as string) === 'review' || (submitState as string) === 'loading' && submitState !== 'idle') {
    if ((submitState as string) === 'review' || (submitState as string) === 'loading') {
      const returnDateFormatted = returnDate
        ? new Date(returnDate + 'T00:00:00').toLocaleDateString(
            locale === 'en' ? 'en-GB' : locale === 'tr' ? 'tr-TR' : 'de-DE',
            { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }
          )
        : '';

      return (
        <div className="min-h-screen bg-gray-50">
          <div className="bg-white border-b border-gray-100 py-3">
            <div className="max-w-3xl mx-auto px-4">
              <button onClick={() => setSubmitState('idle')} className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium">
                <ChevronLeft size={18} /> {tx.review_edit}
              </button>
            </div>
          </div>

          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-primary-700">{tx.review_title}</h1>
              <p className="text-gray-500 mt-1">{tx.review_subtitle}</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Vehicle & Price header */}
              <div className="bg-primary-600 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                    <img src={VEHICLE_IMAGES[vehicle] || '/images/kombi.webp'} alt={vehicleLabel} loading="lazy" width={400} height={240} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">{vehicleLabel}</p>
                    <p className="text-primary-200 text-sm">{effectiveDistanceKm.toFixed(1)} km · ca. {effectiveDuration} Min.</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/70 text-xs">{locale === 'de' ? 'Gesamtpreis' : locale === 'en' ? 'Total' : 'Toplam'}</p>
                  <p className="text-white font-bold text-2xl">{formatPrice(finalPrice)}</p>
                  {appliedPromo && (
                    <p className="text-white/70 text-xs line-through">{formatPrice(price)}</p>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Route */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{tx.review_route}</h3>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <MapPin size={16} className="text-green-500 mt-0.5 shrink-0" />
                      <p className="text-gray-800 text-sm">{addressIcon(pickup)}{pickup}</p>
                    </div>
                    {(zwischenstoppFromErgebnisse || localZwischenstopp) && (
                      <div className="flex items-start gap-3">
                        <MapPin size={16} className="text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-blue-700 text-sm font-medium flex items-center gap-1"><MapPin size={14} /> {params.get('zwischenstopp_address') || localZwischenstopp}</p>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <MapPin size={16} className="text-red-500 mt-0.5 shrink-0" />
                      <p className="text-gray-800 text-sm">{addressIcon(dropoff)}{dropoff}</p>
                    </div>
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

                <hr className="border-gray-100" />

                {/* Date & Time */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{tx.review_datetime}</h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <Calendar size={16} className="text-primary-500 shrink-0" />
                      <p className="text-gray-800 text-sm">
                        <span className="font-semibold">{locale === 'de' ? 'Hinfahrt:' : locale === 'en' ? 'Outbound:' : 'Gidiş:'}</span>{' '}
                        {dateFormatted} · {time} Uhr
                      </p>
                    </div>
                    {tripType === 'roundtrip' && returnDate && (
                      <div className="flex items-center gap-3">
                        <Calendar size={16} className="text-primary-500 shrink-0" />
                        <p className="text-primary-600 text-sm font-medium">
                          <span className="font-semibold">{locale === 'de' ? 'Rückfahrt:' : locale === 'en' ? 'Return:' : 'Dönüş:'}</span>{' '}
                          {returnDateFormatted} · {returnTime} Uhr
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* Passengers & Luggage */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{tx.review_persons}</h3>
                    <p className="text-gray-800 text-sm flex items-center gap-2"><Users size={16} className="text-primary-500" /> {passengers}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{tx.review_luggage_label}</h3>
                    <p className="text-gray-800 text-sm flex items-center gap-2"><Luggage size={16} className="text-primary-500" /> {luggageCount}</p>
                  </div>
                </div>

                {(childSeat || fahrradCount > 0) && (
                  <>
                    <hr className="border-gray-100" />
                    <div>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Extras</h3>
                      <div className="space-y-1 text-sm">
                        {childSeat && <p className="text-gray-800"><Baby size={14} className="text-gray-400 inline mr-1" /> {locale === 'de' ? 'Kindersitz' : locale === 'en' ? 'Child seat' : 'Çocuk koltuğu'} ({locale === 'de' ? 'kostenlos' : locale === 'en' ? 'free' : 'ücretsiz'}){buildChildSeatDetails() ? ` — ${buildChildSeatDetails()}` : ''}</p>}
                        {fahrradCount > 0 && <p className="text-gray-800"><Bike size={14} className="text-gray-400 inline mr-1" /> {fahrradCount}× {locale === 'de' ? 'Fahrrad' : locale === 'en' ? 'Bicycle' : 'Bisiklet'}</p>}
                      </div>
                    </div>
                  </>
                )}

                <hr className="border-gray-100" />

                {/* Contact */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{tx.review_contact}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2"><User size={14} className="text-gray-400" /> <span className="text-gray-800">{name}</span></div>
                    <div className="flex items-center gap-2"><Phone size={14} className="text-gray-400" /> <span className="text-gray-800">{phone}</span></div>
                    <div className="flex items-center gap-2"><Mail size={14} className="text-gray-400" /> <span className="text-gray-800">{email}</span></div>
                    {flightNumber && <div className="flex items-center gap-2"><Plane size={14} className="text-gray-400" /> <span className="text-gray-800">{flightNumber}</span></div>}
                    {pickupSign && <div className="flex items-center gap-2"><Signpost size={14} className="text-gray-400" /> <span className="text-gray-800"><span className="text-gray-500">{locale === 'de' ? 'Abholschild:' : locale === 'en' ? 'Pickup sign:' : 'Tabela:'}</span> <span className="font-medium">{pickupSign}</span></span></div>}
                  </div>
                </div>

                {notes && (
                  <>
                    <hr className="border-gray-100" />
                    <div>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{tx.review_notes_label}</h3>
                      <p className="text-gray-700 text-sm">{notes}</p>
                    </div>
                  </>
                )}

                <hr className="border-gray-100" />

                {/* Payment */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{tx.review_payment_label}</h3>
                  <p className="text-gray-800 text-sm">{payment === 'cash' ? tx.cash : tx.card}{payment === 'card' && cardResult?.last4 ? ` ···· ${cardResult.last4}` : ''}</p>
                </div>
              </div>

              {/* Promo code — shown when any active promo exists (with or without banner) */}
              {hasAnyActivePromo && (
                <div className="px-6 pb-2">
                  <hr className="border-gray-100 mb-4" />
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {locale === 'tr' ? 'Promosyon Kodu' : locale === 'en' ? 'Promo Code' : 'Aktionscode'}
                  </h3>
                  {appliedPromo ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
                        <span className="text-green-700 font-medium">
                          <PartyPopper size={13} className="inline mr-1" /> {appliedPromo.code}: −{formatPrice(appliedPromo.discountAmount)}
                        </span>
                        <button onClick={() => { setAppliedPromo(null); setPromoInput(''); }}
                          className="text-gray-400 hover:text-gray-600 text-xs">
                          × {locale === 'tr' ? 'Kaldır' : locale === 'en' ? 'Remove' : 'Entfernen'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-sm px-1">
                        <span className="text-gray-500">
                          {locale === 'tr' ? 'Grundpreis' : locale === 'en' ? 'Base price' : 'Grundpreis'}:
                        </span>
                        <span className="text-gray-500 line-through">{formatPrice(promoBase)}</span>
                      </div>
                      <div className="flex items-center justify-between text-base font-bold px-1">
                        <span className="text-gray-800">
                          {locale === 'tr' ? 'Toplam' : locale === 'en' ? 'Total' : 'Gesamtpreis'}:
                        </span>
                        <span className="text-green-600">{formatPrice(finalPrice)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                          placeholder={locale === 'tr' ? 'Kod girin...' : locale === 'en' ? 'Enter code...' : 'Code eingeben...'}
                          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary-400"
                        />
                        <button
                          onClick={handleApplyPromo}
                          disabled={promoLoading || !promoInput.trim()}
                          className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                        >
                          {promoLoading ? '…' : (locale === 'tr' ? 'Uygula' : locale === 'en' ? 'Apply' : 'Anwenden')}
                        </button>
                      </div>
                      {promoError && (
                        <p className="text-red-600 text-xs px-1">{promoError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="px-6 pb-6 space-y-3">
                {/* Trust mini-bar */}
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-2">
                  <p className="text-center text-sm font-bold text-green-800">
                    {locale === 'tr' ? '✅ 0 Risk — Güvenle Rezervasyon Yap' : locale === 'en' ? '✅ Zero Risk — Book with Confidence' : '✅ 0 Risiko — Einfach & sicher buchen'}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-green-700 font-medium justify-center">
                    <span className="inline-flex items-center gap-1"><Ban size={12} /> {locale === 'tr' ? '3 saate kadar ücretsiz iptal' : locale === 'en' ? 'Free cancellation up to 3 hrs' : 'Kostenloser Storno bis 3 Std. vorher'}</span>
                    <span className="inline-flex items-center gap-1"><Banknote size={12} /> {locale === 'tr' ? 'Şoföre ödeme de mümkün — rezervasyon ücretsiz' : locale === 'en' ? 'Pay the driver also possible — booking is free' : 'Zahlung auch beim Fahrer möglich — Reservierung kostenlos'}</span>
                    <span className="inline-flex items-center gap-1"><BadgeEuro size={12} /> {locale === 'tr' ? 'Sabit fiyat garantili' : locale === 'en' ? 'Fixed price guaranteed' : 'Festpreis garantiert'}</span>
                  </div>
                </div>
                {(submitState as string) === 'error' && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm">
                    <AlertCircle size={16} /> {tx.err_submit}
                  </div>
                )}
                <button onClick={handleSubmit} disabled={(submitState as string) === 'loading'}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-70 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-base shadow-lg">
                  {(submitState as string) === 'loading' ? <><Loader2 size={20} className="animate-spin" /> {tx.submitting}</> : <><CheckCircle size={20} /> {tx.review_confirm}</>}
                </button>
                <button onClick={() => setSubmitState('idle')}
                  className="w-full text-gray-500 hover:text-primary-600 font-medium py-2 text-sm transition-colors">
                  {tx.review_edit}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back bar */}
      <div className="bg-white border-b border-gray-100 py-3">
        <div className="max-w-5xl mx-auto px-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm font-medium">
            <ChevronLeft size={18} /> {tx.back}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Form */}
          <div className="lg:col-span-2 space-y-5">
            <h1 className="text-2xl font-bold text-primary-700">{tx.title}</h1>

            {/* Return trip — TOP (hide if already set from ergebnisse) */}
            {roundtripFromErgebnisse ? null : tripType === 'roundtrip' ? (
              <div className="bg-primary-50 border border-primary-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-primary-700 flex items-center gap-2">⇄ {locale === 'de' ? 'Rückfahrt' : locale === 'en' ? 'Return trip' : 'Dönüş'}</h3>
                  <button
                    type="button"
                    onClick={() => { setTripType('oneway'); setReturnDate(''); setReturnTime('10:00'); setAppliedPromo(null); setPromoInput(''); setPromoError(''); }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    × {locale === 'de' ? 'Entfernen' : locale === 'en' ? 'Remove' : 'Kaldır'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                    <label className="text-xs text-gray-500 font-medium">
                      {locale === 'de' ? 'Rückfahrtdatum' : locale === 'en' ? 'Return date' : 'Dönüş tarihi'}
                    </label>
                    <input
                      type="date"
                      value={returnDate}
                      min={date}
                      onChange={e => setReturnDate(e.target.value)}
                      className="border border-primary-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                    <label className="text-xs text-gray-500 font-medium">
                      {locale === 'de' ? 'Rückfahrtzeit' : locale === 'en' ? 'Return time' : 'Dönüş saati'}
                    </label>
                    <input
                      type="time"
                      value={returnTime}
                      onChange={e => setReturnTime(e.target.value)}
                      className="border border-primary-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                    />
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-700 font-medium">
                  <Tag size={12} className="inline mr-1" /> {roundtripDiscount}% {locale === 'de' ? 'Hin- & Rückfahrt Rabatt inklusive' : locale === 'en' ? 'Round trip discount included' : 'Gidiş-dönüş indirimi dahil'}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setTripType('roundtrip'); setAppliedPromo(null); setPromoInput(''); setPromoError(''); }}
                className="flex items-center gap-2 w-full border-2 border-dashed border-primary-300 hover:border-primary-500 bg-white hover:bg-primary-50 text-primary-600 hover:text-primary-700 rounded-2xl px-5 py-4 text-sm font-semibold transition-colors justify-center"
              >
                <span className="text-lg">⇄</span>
                {locale === 'de' ? '+ Rückfahrt hinzufügen' : locale === 'en' ? '+ Add return trip' : '+ Dönüş ekle'}
                <span className="text-xs font-normal text-green-600">
                  ({roundtripDiscount}% {locale === 'de' ? 'Rabatt' : locale === 'en' ? 'discount' : 'indirim'})
                </span>
              </button>
            )}

            {/* Zwischenstopp — only show if not already added from ergebnisse */}
            {zwischenstoppEnabled && !zwischenstoppFromErgebnisse && (
              localZwischenstopp ? (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3">
                  <div className="flex items-center gap-2 text-sm text-blue-700 font-medium">
                    <MapPin size={14} className="shrink-0" />
                    <span>
                      {locale === 'de' ? 'Zwischenstopp:' : locale === 'en' ? 'Intermediate stop:' : 'Ara durak:'}{' '}
                      {localZwischenstopp}
                    </span>
                  </div>
                  <button type="button" onClick={() => { setLocalZwischenstopp(''); setLocalZwischenstoppBasePrice(0); setLocalZwischenstoppDistanceKm(0); setLocalZwischenstoppDuration(0); }} className="text-xs text-red-500 hover:text-red-700 font-medium">
                    × {locale === 'de' ? 'Entfernen' : locale === 'en' ? 'Remove' : 'Kaldır'}
                  </button>
                </div>
              ) : showZwischenstoppPicker ? (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 space-y-3 relative">
                  <p className="text-sm font-semibold text-primary-700">
                    {locale === 'de' ? 'Zwischenstopp hinzufügen' : locale === 'en' ? 'Add intermediate stop' : 'Ara durak ekle'}
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      value={zwischenstoppInput}
                      onChange={e => setZwischenstoppInput(e.target.value)}
                      placeholder={locale === 'de' ? 'Adresse eingeben...' : locale === 'en' ? 'Enter address...' : 'Adres girin...'}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                      autoFocus
                    />
                    {zwischenstoppSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
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
                  {zwischenstoppLoading && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <button type="button" onClick={() => { setShowZwischenstoppPicker(false); setZwischenstoppInput(''); setZwischenstoppSuggestions([]); }} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
                    {locale === 'de' ? 'Abbrechen' : locale === 'en' ? 'Cancel' : 'İptal'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowZwischenstoppPicker(true)}
                  className="flex items-center gap-2 w-full border-2 border-dashed border-blue-300 hover:border-blue-500 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 rounded-2xl px-5 py-4 text-sm font-semibold transition-colors justify-center"
                >
                  <MapPin size={14} className="shrink-0" />
                  {locale === 'de' ? '+ Zwischenstopp hinzufügen' : locale === 'en' ? '+ Add intermediate stop' : '+ Ara durak ekle'}
                </button>
              )
            )}

            {/* Personal details */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div>
                <label className={labelCls}><span className="flex items-center gap-1"><User size={14} /> {tx.name}</span></label>
                <input value={name} onChange={e => setName(e.target.value)} className={cn(inputCls, errors.name && 'border-red-400')} placeholder="Max Mustermann" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Phone size={14} /> {tx.phone}
                      <span className="relative group ml-0.5">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold cursor-default">?</span>
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                          {locale === 'tr' ? 'WhatsApp ile rezervasyon onayı için gereklidir.' : locale === 'en' ? 'Required for WhatsApp booking confirmation.' : 'Für die WhatsApp-Buchungsbestätigung erforderlich.'}
                        </span>
                      </span>
                    </span>
                  </label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={cn(inputCls, errors.phone && 'border-red-400')} placeholder="+49 151 ..." />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Mail size={14} /> {tx.email}
                      <span className="relative group ml-0.5">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold cursor-default">?</span>
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                          {locale === 'tr' ? 'Rezervasyon onayı bu adrese gönderilecek.' : locale === 'en' ? 'Your booking confirmation will be sent here.' : 'Ihre Buchungsbestätigung wird an diese Adresse gesendet.'}
                        </span>
                      </span>
                    </span>
                  </label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={cn(inputCls, errors.email && 'border-red-400')} placeholder="name@example.com" />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Plane size={14} /> {flightNumberRequired ? (tx as any).flightRequired : tx.flight}
                      <span className="relative group ml-0.5">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold cursor-default">?</span>
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                          {locale === 'tr' ? 'Uçuş gecikmelerini takip edebilmemiz için uçuş numaranızı girin.' : locale === 'en' ? 'We monitor your flight for delays so your driver is always on time.' : 'Damit wir Ihren Flug auf Verspätungen überwachen und den Fahrer rechtzeitig informieren können.'}
                        </span>
                      </span>
                    </span>
                  </label>
                  <input value={flightNumber} onChange={e => setFlightNumber(e.target.value)} className={cn(inputCls, (errors as any).flightNumber && 'border-red-400')} placeholder="LH 1234" />
                  {(errors as any).flightNumber && <p className="text-red-500 text-xs mt-1">{(errors as any).flightNumber}</p>}
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
                <div>
                  <label className={labelCls}><span className="flex items-center gap-1"><Luggage size={14} /> {tx.luggage}</span></label>
                  <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 bg-white">
                    <button onClick={() => setLuggageCount(l => Math.max(0, l - 1))} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 flex items-center justify-center">−</button>
                    <span className="flex-1 text-center text-sm font-semibold text-gray-900">{luggageCount}</span>
                    <button onClick={() => setLuggageCount(l => Math.min(maxLuggage, l + 1))} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 flex items-center justify-center">+</button>
                  </div>
                </div>
              </div>
              {flightNumberRequired && (
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1">
                      <Signpost size={13} className="inline mr-1" /> {locale === 'de' ? 'Abholschild' : locale === 'en' ? 'Pickup Sign' : 'Karşılama Tabelası'} *
                      <span className="relative group ml-0.5">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold cursor-default">?</span>
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                          {locale === 'tr' ? 'Sürücünüz havalimanında bu isimle sizi karşılayacak.' : locale === 'en' ? 'Your driver will hold a sign with this name at the airport.' : 'Ihr Fahrer erwartet Sie am Flughafen mit diesem Namen auf dem Schild.'}
                        </span>
                      </span>
                    </span>
                  </label>
                  <input value={pickupSign} onChange={e => setPickupSign(e.target.value)} className={`${inputCls}${errors.pickupSign ? ' border-red-400' : ''}`} placeholder={locale === 'de' ? 'z.B. Familie Müller' : locale === 'en' ? 'e.g. Smith family' : 'örn. Müller ailesi'} />
                  {errors.pickupSign ? <p className="text-red-500 text-xs mt-1">{errors.pickupSign}</p> : <p className="text-xs text-gray-400 mt-1">{locale === 'de' ? 'Name auf dem Abholschild am Flughafen' : locale === 'en' ? 'Name on the pickup sign at the airport' : 'Havalimanında karşılama tabelasındaki isim'}</p>}
                </div>
              )}
              <div>
                <label className={labelCls}>
                  <span className="flex items-center gap-1">
                    {tx.notes}
                    <span className="relative group ml-0.5">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold cursor-default">?</span>
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                        {locale === 'tr' ? 'Özel isteklerinizi buraya yazın: bebek koltuğu, ekstra bagaj, karşılama tercihleri vb.' : locale === 'en' ? 'Special requests: child seat details, extra luggage, meeting preferences, etc.' : 'Besondere Wünsche: Kindersitz-Details, extra Gepäck, Treffpunkt-Präferenzen usw.'}
                      </span>
                    </span>
                  </span>
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} placeholder={locale === 'de' ? 'Besondere Wünsche...' : locale === 'en' ? 'Special requests...' : 'Özel istekler...'} />
              </div>
            </div>

            {/* Extras */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Briefcase size={16} /> Extras</h3>

              {/* Kindersitz */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <Baby size={22} className="text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{locale === 'de' ? 'Kindersitz' : locale === 'en' ? 'Child seat' : 'Çocuk koltuğu'}</p>
                    <p className="text-xs text-green-600 font-medium">{locale === 'de' ? 'Kostenlos' : locale === 'en' ? 'Free' : 'Ücretsiz'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newVal = !childSeat;
                    setChildSeat(newVal);
                    if (!newVal) { setChildSeatBabyschale(0); setChildSeatKindersitz(0); setChildSeatSitzerhoehung(0); }
                  }}
                  className={cn(
                    'w-12 h-7 rounded-full transition-colors relative',
                    childSeat ? 'bg-green-500' : 'bg-gray-300'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
                    childSeat ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </button>
              </div>
              {childSeat && (
                <div className="mt-3 mb-3 bg-green-50 rounded-xl p-4 border border-green-100 space-y-3">
                  <p className="text-xs text-gray-500 font-medium mb-2">{locale === 'de' ? 'Bitte wählen Sie die benötigten Kindersitze:' : locale === 'en' ? 'Please select the child seats you need:' : 'Lütfen ihtiyacınız olan çocuk koltuklarını seçin:'}</p>
                  {/* Babyschale (0-12 Monate) */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{locale === 'de' ? 'Babyschale' : locale === 'en' ? 'Infant carrier' : 'Bebek taşıyıcı'}</p>
                      <p className="text-xs text-gray-400">{locale === 'de' ? '0–12 Monate' : locale === 'en' ? '0–12 months' : '0–12 ay'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setChildSeatBabyschale(c => Math.max(0, c - 1))} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">−</button>
                      <span className="w-5 text-center text-sm font-bold text-gray-800">{childSeatBabyschale}</span>
                      <button type="button" onClick={() => setChildSeatBabyschale(c => Math.min(3, c + 1))} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">+</button>
                    </div>
                  </div>
                  {/* Kindersitz (1-4 Jahre) */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{locale === 'de' ? 'Kindersitz' : locale === 'en' ? 'Child seat' : 'Çocuk koltuğu'}</p>
                      <p className="text-xs text-gray-400">{locale === 'de' ? '1–4 Jahre, bis 18 kg' : locale === 'en' ? '1–4 years, up to 18 kg' : '1–4 yaş, 18 kg\'a kadar'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setChildSeatKindersitz(c => Math.max(0, c - 1))} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">−</button>
                      <span className="w-5 text-center text-sm font-bold text-gray-800">{childSeatKindersitz}</span>
                      <button type="button" onClick={() => setChildSeatKindersitz(c => Math.min(3, c + 1))} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">+</button>
                    </div>
                  </div>
                  {/* Sitzerhöhung (4-12 Jahre) */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{locale === 'de' ? 'Sitzerhöhung' : locale === 'en' ? 'Booster seat' : 'Yükseltici koltuk'}</p>
                      <p className="text-xs text-gray-400">{locale === 'de' ? '4–12 Jahre, bis 36 kg' : locale === 'en' ? '4–12 years, up to 36 kg' : '4–12 yaş, 36 kg\'a kadar'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setChildSeatSitzerhoehung(c => Math.max(0, c - 1))} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">−</button>
                      <span className="w-5 text-center text-sm font-bold text-gray-800">{childSeatSitzerhoehung}</span>
                      <button type="button" onClick={() => setChildSeatSitzerhoehung(c => Math.min(3, c + 1))} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">+</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Fahrrad */}
              {fahrradEnabled && (
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Bike size={22} className="text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{locale === 'de' ? 'Fahrrad' : locale === 'en' ? 'Bicycle' : 'Bisiklet'}</p>
                    <p className="text-xs text-gray-500">{fahrradPrice > 0 ? `${formatPrice(fahrradPrice)} / ${locale === 'de' ? 'Stk.' : locale === 'en' ? 'each' : 'adet'}` : (locale === 'de' ? 'Kostenlos' : locale === 'en' ? 'Free' : 'Ücretsiz')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setFahrradCount(c => Math.max(0, c - 1))} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 flex items-center justify-center text-sm">−</button>
                  <span className="w-6 text-center text-sm font-bold text-gray-800">{fahrradCount}</span>
                  <button type="button" onClick={() => setFahrradCount(c => Math.min(4, c + 1))} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 flex items-center justify-center text-sm">+</button>
                </div>
              </div>
              )}

              {/* Rechnung für Firma */}
              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <FileText size={22} className="text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{rx.toggle}</p>
                    <p className="text-xs text-gray-500">{rx.toggleHint}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
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
                  className={cn(
                    'w-12 h-7 rounded-full transition-colors relative',
                    rechnungRequired ? 'bg-green-500' : 'bg-gray-300'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
                    rechnungRequired ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </button>
              </div>
              {rechnungRequired && rechnungAdresse && (
                <div className="mb-3 bg-green-50 rounded-xl p-4 border border-green-100 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-green-700 flex items-center gap-1">
                      <Check size={12} /> {rx.saved}
                    </p>
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
              {errors.rechnung && <p className="text-red-500 text-xs mb-3">{errors.rechnung}</p>}
            </div>

            {/* Payment */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><CreditCard size={16} /> {tx.payment}</h3>
              <div className="flex gap-2 mb-4">
                {(['cash', 'card'] as const).map(m => (
                  <button key={m} onClick={() => setPayment(m)}
                    className={cn('flex-1 py-3 rounded-xl text-sm font-semibold transition-all border-2 flex items-center justify-center gap-2', payment === m ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300')}>
                    {m === 'cash' ? <><Banknote size={16} /> {tx.cash}</> : <><CreditCard size={16} /> {tx.card}</>}
                  </button>
                ))}
              </div>
              {payment === 'card' && (
                <div className="space-y-3 animate-fade-in">
                  <CardPaymentField
                    ref={cardFieldRef}
                    locale={locale}
                    name={name.trim() || undefined}
                    email={email.trim() || undefined}
                    errorText={errors.card}
                    notConfiguredText={locale === 'tr' ? 'Kart ödemesi henüz yapılandırılmadı.' : locale === 'en' ? 'Card payment is not configured yet.' : 'Kartenzahlung ist noch nicht konfiguriert.'}
                    trustText={locale === 'tr' ? 'Kart bilgileriniz şifrelenerek doğrudan ödeme sağlayıcımız Stripe\'a iletilir ve sunucularımızda asla saklanmaz.' : locale === 'en' ? 'Your card details are encrypted and transmitted directly to our payment provider Stripe — they are never stored on our servers.' : 'Ihre Kreditkartendaten werden verschlüsselt direkt an unseren Zahlungsdienstleister Stripe übertragen und niemals auf unseren Servern gespeichert.'}
                  />
                  {/* SSL trust box */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-700 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Lock size={15} />
                      <p className="font-semibold">
                        {locale === 'tr' ? 'SSL şifreli — kart bilgileriniz güvende' : locale === 'en' ? 'SSL encrypted — your card data is secure' : 'SSL-verschlüsselt — Ihre Kartendaten sind sicher'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard size={15} />
                      <p className="text-blue-600">
                        {locale === 'tr' ? 'Ödeme yolculuktan 1 gün önce — iptal halinde tam iade' : locale === 'en' ? 'Payment 1 day before the trip — full refund if cancelled' : 'Keine Abbuchung bis 1 Tag vor der Fahrt — vollständige Rückerstattung bei Storno'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <BadgeCheck size={15} />
                      <p className="font-semibold text-blue-800">
                        {locale === 'tr' ? '%100 Risk Yok — Güvenle Rezervasyon Yap' : locale === 'en' ? '100% No Risk — Book with Confidence' : '100% Kein Risiko — Einfach & sicher buchen'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            {submitState === 'error' && (
              <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm">
                <AlertCircle size={16} /> {tx.err_submit}
              </div>
            )}
            {/* Trust mini-bar */}
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-green-700 font-medium justify-center">
                <span className="inline-flex items-center gap-1"><Ban size={12} /> {locale === 'tr' ? '3 saate kadar ücretsiz iptal' : locale === 'en' ? 'Free cancellation up to 3 hrs' : 'Kostenloser Storno bis 3 Std. vor Abfahrt'}</span>
                <span className="inline-flex items-center gap-1"><BadgeEuro size={12} /> {locale === 'tr' ? 'Sabit fiyat garantili' : locale === 'en' ? 'Fixed price guaranteed' : 'Festpreis garantiert'}</span>
                <span className="inline-flex items-center gap-1"><Mail size={12} /> {locale === 'tr' ? 'Anında e-posta onayı' : locale === 'en' ? 'Instant email confirmation' : 'Sofortige E-Mail-Bestätigung'}</span>
              </div>
            </div>
            <button onClick={handleContinueToReview} disabled={cardSubmitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-base shadow-lg disabled:opacity-60">
              {cardSubmitting ? <><Loader2 size={20} className="animate-spin" /> {tx.submitting}</> : <><CheckCircle size={20} /> {tx.submit}</>}
            </button>
            <p className="text-center text-xs text-gray-400">
              {locale === 'tr' ? 'Henüz rezervasyon değil — sadece kontrol' : locale === 'en' ? 'Not a booking yet — review only' : 'Noch keine Buchung — nur Überprüfung Ihrer Angaben'}
            </p>
          </div>

          {/* RIGHT: Booking summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 sticky top-24 overflow-hidden">
              <div className="bg-primary-600 px-5 py-4">
                <h3 className="text-white font-bold">{tx.summary}</h3>
              </div>
              {/* Payment trust badge */}
              <div className="mx-4 mt-4 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-center">
                <p className="font-bold text-amber-800 text-sm">
                  <Banknote size={14} className="inline mr-1" /> {locale === 'tr' ? 'Şoföre Ödeme de Mümkün' : locale === 'en' ? 'Pay the Driver Also Possible' : 'Zahlung auch beim Fahrer möglich'}
                </p>
              </div>
              <div className="p-5 space-y-4 text-sm">
                {/* Vehicle */}
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                    <img src={VEHICLE_IMAGES[vehicle] || '/images/kombi.webp'} alt={vehicleLabel} loading="lazy" width={400} height={240} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{vehicleLabel}</p>
                    <p className="text-gray-500 text-xs">{locale === 'de' ? 'Festpreis garantiert' : locale === 'en' ? 'Fixed price guaranteed' : 'Sabit fiyat garantili'}</p>
                  </div>
                </div>
                {/* Route */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-green-500 mt-0.5 shrink-0" />
                    <p className="text-gray-700 text-xs leading-relaxed">{addressIcon(pickup)}{pickup}</p>
                  </div>
                  {(zwischenstoppFromErgebnisse || localZwischenstopp) && (
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-blue-500 mt-0.5 shrink-0" />
                      <p className="text-blue-700 text-xs leading-relaxed font-medium flex items-center gap-1"><MapPin size={12} /> {params.get('zwischenstopp_address') || localZwischenstopp}</p>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-gray-700 text-xs leading-relaxed">{addressIcon(dropoff)}{dropoff}</p>
                  </div>
                  {/* Inline route map */}
                  {(() => {
                    const zwStop = params.get('zwischenstopp_address') || localZwischenstopp;
                    return (
                      <RouteMap
                        pickup={pickup}
                        dropoff={dropoff}
                        waypoint={zwStop || undefined}
                        pickupCoords={pickupLat && pickupLng ? { lat: Number(pickupLat), lng: Number(pickupLng) } : null}
                        dropoffCoords={dropoffLat && dropoffLng ? { lat: Number(dropoffLat), lng: Number(dropoffLng) } : null}
                      />
                    );
                  })()}
                </div>
                {/* Info */}
                <div className="space-y-2 text-xs text-gray-600 border-t border-gray-100 pt-4">
                  <div className="flex items-start gap-2">
                    <Calendar size={13} className="text-primary-400 mt-0.5" />
                    <div>
                      <div><span className="font-semibold text-gray-700">{locale === 'de' ? 'Hinfahrt:' : locale === 'en' ? 'Outbound:' : 'Gidiş:'}</span> {dateFormatted} · {time} Uhr</div>
                      {tripType === 'roundtrip' && returnDate && (
                        <div className="text-primary-500 font-medium mt-1">
                          <span className="font-semibold">{locale === 'de' ? 'Rückfahrt:' : locale === 'en' ? 'Return:' : 'Dönüş:'}</span>{' '}
                          {new Date(returnDate + 'T00:00:00').toLocaleDateString(
                            locale === 'en' ? 'en-GB' : locale === 'tr' ? 'tr-TR' : 'de-DE',
                            { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }
                          )} · {returnTime} Uhr
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2"><Users size={13} className="text-primary-400" /><span>{passengers} {locale === 'de' ? 'Person(en)' : locale === 'en' ? 'Passenger(s)' : 'Kişi'}</span></div>
                  <div className="flex items-center gap-2"><Car size={13} className="text-primary-400" /><span>{effectiveDistanceKm.toFixed(1)} km · ca. {effectiveDuration} Min.</span></div>
                  {tripType === 'roundtrip' && (
                    <div className="flex items-center gap-2 text-primary-500 font-medium">
                      <ArrowRight size={13} className="text-primary-400" />
                      <span>{locale === 'de' ? 'Hin- & Rückfahrt' : locale === 'en' ? 'Round trip' : 'Gidiş-Dönüş'}</span>
                    </div>
                  )}
                </div>
                {/* Extras in sidebar */}
                {(childSeat || fahrradCount > 0) && (
                  <div className="space-y-1 text-xs text-gray-600 border-t border-gray-100 pt-3">
                    {childSeat && <div className="flex items-center gap-2"><Baby size={14} className="text-gray-400" /> <span>{buildChildSeatDetails() || (locale === 'de' ? 'Kindersitz' : locale === 'en' ? 'Child seat' : 'Çocuk koltuğu')} ({locale === 'de' ? 'kostenlos' : locale === 'en' ? 'free' : 'ücretsiz'})</span></div>}
                    {fahrradCount > 0 && <div className="flex items-center gap-2"><Bike size={14} className="text-gray-400" /> <span>{fahrradCount}× {locale === 'de' ? 'Fahrrad' : locale === 'en' ? 'Bicycle' : 'Bisiklet'}</span></div>}
                  </div>
                )}
                {/* Price */}
                <div className="border-t-2 border-dashed border-gray-200 pt-4">
                  {tripType === 'roundtrip' && (
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>{locale === 'de' ? 'Hin- & Rückfahrt ohne Rabatt' : locale === 'en' ? 'Round trip without discount' : 'İndirimiz gidiş-dönüş'}</span>
                      <span className="line-through">{formatPrice(oneWayPrice * 2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-700">{locale === 'de' ? 'Gesamtpreis' : locale === 'en' ? 'Total price' : 'Toplam fiyat'}</span>
                    <span className="text-2xl font-bold text-primary-600">{formatPrice(price)}</span>
                  </div>
                  {tripType === 'roundtrip' && roundtripDiscount > 0 && (
                    <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1"><Tag size={12} /> {roundtripDiscount}% {locale === 'de' ? 'Rabatt inklusive' : locale === 'en' ? 'discount included' : 'indirim dahil'}</p>
                  )}
                  {anfahrtCost > 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1"><Car size={12} /> {locale === 'de' ? 'inkl.' : locale === 'en' ? 'incl.' : 'dahil'} {formatPrice(anfahrtCost)} {locale === 'de' ? 'Anfahrtskosten' : locale === 'en' ? 'approach fee' : 'yaklaşım ücreti'}</p>
                  )}
                  <p className="text-xs text-green-600 font-medium mt-1">✅ {locale === 'de' ? 'Inkl. Maut & Gepäck' : locale === 'en' ? 'Incl. tolls & luggage' : 'Otoyol & bagaj dahil'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <SocialProofToast locale={locale} />
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
