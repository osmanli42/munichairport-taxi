'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { MapPin, ArrowRight, Calendar, Users, Car, User, Phone, Mail, Plane, CreditCard, Banknote, CheckCircle, AlertCircle, Loader2, Luggage, ChevronLeft } from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

const VEHICLE_LABELS: Record<string, Record<string, string>> = {
  kombi: { de: 'Kombi', en: 'Sedan', tr: 'Kombi' },
  van: { de: 'Van / Minibus', en: 'Van / Minibus', tr: 'Van / Minibüs' },
  grossraumtaxi: { de: 'Großraumtaxi', en: 'Large Taxi', tr: 'Büyük Taksi' },
};

const VEHICLE_IMAGES: Record<string, string> = {
  kombi: '/images/kombi.PNG',
  van: '/images/van.PNG',
  grossraumtaxi: '/images/van.PNG',
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
  useEffect(() => {
    fetch(`${API_URL}/settings`).then(r => r.json()).then(s => {
      if (s.stadtfahrt_enabled === '1') setStadtfahrtEnabled(true);
      if (s.zwischenstopp_enabled === '1') setZwischenstoppEnabled(true);
    }).catch(() => {}).finally(() => setSettingsLoaded(true));
  }, []);
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

  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const cardNumberRef = useRef<HTMLInputElement>(null);
  const cardExpiryRef = useRef<HTMLInputElement>(null);
  const cardCvvRef = useRef<HTMLInputElement>(null);
  const [submitState, setSubmitState] = useState<'idle' | 'review' | 'loading' | 'success' | 'error'>('idle');
  const [bookingNumber, setBookingNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const t: Record<string, Record<string, string>> = {
    de: { title: 'Ihre Angaben', summary: 'Buchungsübersicht', name: 'Name *', phone: 'Telefonnummer *', email: 'E-Mail *', flight: 'Flugnummer (optional)', luggage: 'Gepäckstücke', notes: 'Anmerkungen', payment: 'Zahlungsmethode', cash: '💵 Barzahlung', card: '💳 Kreditkarte', cardHolder: 'Karteninhaber', cardNumber: 'Kartennummer', cardExpiry: 'Gültig bis', cardCvv: 'CVV', oneway: '→ Einfache Fahrt', roundtrip: '⇄ Hin & Rückfahrt', returnDate: 'Rückfahrtdatum', returnTime: 'Rückfahrtzeit', submit: 'Weiter zur Überprüfung', submitting: 'Wird gebucht...', success_title: 'Buchung erfolgreich! 🎉', success_msg: 'Ihre Buchung wurde bestätigt. Sie erhalten in Kürze eine Bestätigungs-E-Mail an', new_booking: 'Neue Buchung', back: '← Zurück zur Fahrzeugauswahl', err_name: 'Name erforderlich', err_phone: 'Telefon erforderlich', err_email: 'Gültige E-Mail erforderlich', err_card: 'Kartendetails erforderlich', err_submit: 'Fehler beim Senden. Bitte versuchen Sie es erneut.', review_title: 'Buchung überprüfen', review_subtitle: 'Bitte überprüfen Sie Ihre Angaben, bevor Sie die Buchung bestätigen.', review_route: 'Strecke', review_datetime: 'Datum & Uhrzeit', review_vehicle: 'Fahrzeug', review_contact: 'Kontaktdaten', review_payment_label: 'Zahlung', review_confirm: 'Jetzt verbindlich buchen', review_edit: '← Angaben bearbeiten', review_persons: 'Personen', review_luggage_label: 'Gepäck', review_notes_label: 'Anmerkungen', review_flight_label: 'Flugnummer' },
    en: { title: 'Your details', summary: 'Booking summary', name: 'Name *', phone: 'Phone number *', email: 'Email *', flight: 'Flight number (optional)', luggage: 'Pieces of luggage', notes: 'Notes', payment: 'Payment method', cash: '💵 Cash', card: '💳 Credit card', cardHolder: 'Card holder', cardNumber: 'Card number', cardExpiry: 'Expiry date', cardCvv: 'CVV', oneway: '→ One way', roundtrip: '⇄ Round trip', returnDate: 'Return date', returnTime: 'Return time', submit: 'Continue to review', submitting: 'Booking...', success_title: 'Booking confirmed! 🎉', success_msg: 'Your booking has been confirmed. You will receive a confirmation email at', new_booking: 'New booking', back: '← Back to vehicle selection', err_name: 'Name required', err_phone: 'Phone required', err_email: 'Valid email required', err_card: 'Card details required', err_submit: 'Error submitting. Please try again.', review_title: 'Review your booking', review_subtitle: 'Please review your details before confirming the booking.', review_route: 'Route', review_datetime: 'Date & Time', review_vehicle: 'Vehicle', review_contact: 'Contact details', review_payment_label: 'Payment', review_confirm: 'Confirm booking', review_edit: '← Edit details', review_persons: 'Passengers', review_luggage_label: 'Luggage', review_notes_label: 'Notes', review_flight_label: 'Flight number' },
    tr: { title: 'Bilgileriniz', summary: 'Rezervasyon özeti', name: 'Ad Soyad *', phone: 'Telefon numarası *', email: 'E-posta *', flight: 'Uçuş numarası (isteğe bağlı)', luggage: 'Bagaj sayısı', notes: 'Notlar', payment: 'Ödeme yöntemi', cash: '💵 Nakit', card: '💳 Kredi kartı', cardHolder: 'Kart sahibi', cardNumber: 'Kart numarası', cardExpiry: 'Son kullanma tarihi', cardCvv: 'CVV', oneway: '→ Tek yön', roundtrip: '⇄ Gidiş-dönüş', returnDate: 'Dönüş tarihi', returnTime: 'Dönüş saati', submit: 'Kontrol et', submitting: 'Rezervasyon yapılıyor...', success_title: 'Rezervasyon onaylandı! 🎉', success_msg: 'Rezervasyonunuz onaylandı. Kısa süre içinde onay e-postası alacaksınız:', new_booking: 'Yeni rezervasyon', back: '← Araç seçimine dön', err_name: 'Ad gerekli', err_phone: 'Telefon gerekli', err_email: 'Geçerli e-posta gerekli', err_card: 'Kart bilgileri gerekli', err_submit: 'Gönderme hatası. Lütfen tekrar deneyin.', review_title: 'Rezervasyonu kontrol edin', review_subtitle: 'Lütfen rezervasyonu onaylamadan önce bilgilerinizi kontrol edin.', review_route: 'Güzergah', review_datetime: 'Tarih & Saat', review_vehicle: 'Araç', review_contact: 'İletişim bilgileri', review_payment_label: 'Ödeme', review_confirm: 'Rezervasyonu onayla', review_edit: '← Bilgileri düzenle', review_persons: 'Kişi', review_luggage_label: 'Bagaj', review_notes_label: 'Notlar', review_flight_label: 'Uçuş numarası' },
  };
  const tx = t[locale] || t.de;
  const isAirportPickup = pickup.includes('München-Flughafen');

  function luhnCheck(num: string): boolean {
    const digits = num.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(digits)) return false;
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function expiryValid(expiry: string): boolean {
    const match = expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!match) return false;
    const month = parseInt(match[1], 10);
    const year = parseInt('20' + match[2], 10);
    if (month < 1 || month > 12) return false;
    const now = new Date();
    const cardDate = new Date(year, month - 1, 1);
    return cardDate >= new Date(now.getFullYear(), now.getMonth(), 1);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = tx.err_name;
    if (!phone.trim()) errs.phone = tx.err_phone;
    if (!email.trim() || !email.includes('@')) errs.email = tx.err_email;
    if (payment === 'card') {
      if (!cardHolder.trim()) errs.card = tx.err_card;
      else if (!luhnCheck(cardNumber)) errs.card = locale === 'de' ? 'Ungültige Kartennummer' : locale === 'en' ? 'Invalid card number' : 'Geçersiz kart numarası';
      else if (!expiryValid(cardExpiry)) errs.card = locale === 'de' ? 'Ungültiges oder abgelaufenes Ablaufdatum' : locale === 'en' ? 'Invalid or expired expiry date' : 'Geçersiz veya süresi dolmuş son kullanma tarihi';
      else if (!/^\d{3,4}$/.test(cardCvv)) errs.card = locale === 'de' ? 'Ungültiger CVV' : locale === 'en' ? 'Invalid CVV' : 'Geçersiz CVV';
    }
    if (isAirportPickup && !pickupSign.trim()) errs.pickupSign = locale === 'de' ? 'Abholschild erforderlich' : locale === 'en' ? 'Pickup sign required' : 'Tabela gerekli';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildChildSeatDetails(): string {
    const parts: string[] = [];
    if (childSeatBabyschale > 0) parts.push(`${childSeatBabyschale}× Babyschale`);
    if (childSeatKindersitz > 0) parts.push(`${childSeatKindersitz}× Kindersitz`);
    if (childSeatSitzerhoehung > 0) parts.push(`${childSeatSitzerhoehung}× Sitzerhöhung`);
    return parts.join(', ');
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitState('loading');
    try {
      const pickupDatetime = `${date}T${time}:00`;
      const returnDatetime = tripType === 'roundtrip' && returnDate ? `${returnDate}T${returnTime}:00` : undefined;

      const body: Record<string, unknown> = {
        pickup_address: pickup,
        dropoff_address: dropoff,
        pickup_datetime: pickupDatetime,
        vehicle_type: vehicle,
        passengers,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        flight_number: flightNumber || undefined,
        pickup_sign: pickupSign || undefined,
        child_seat: childSeat,
        child_seat_details: childSeat ? buildChildSeatDetails() : undefined,
        luggage_count: luggageCount,
        fahrrad_count: fahrradCount,
        notes: notes || undefined,
        distance_km: effectiveDistanceKm,
        duration_minutes: effectiveDuration,
        payment_method: payment,
        language: locale,
        trip_type: tripType,
        return_datetime: returnDatetime,
        anfahrt_cost: anfahrtCost > 0 ? anfahrtCost : undefined,
        zwischenstopp_address: params.get('zwischenstopp_address') || localZwischenstopp || undefined,
      };
      if (payment === 'card') {
        body.card_holder = cardHolder;
        body.card_number = cardNumber.replace(/\s/g, '');
        body.card_expiry = cardExpiry;
        body.card_cvv = cardCvv;
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
      // Google Ads conversion tracking
      if (typeof window !== 'undefined' && (window as any).gtag) {
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
                      <img src={VEHICLE_IMAGES[vehicle] || '/images/kombi.PNG'} alt={vehicleLabel} className="w-full h-full object-cover" />
                    </div>
                    <span className="font-semibold text-gray-800">{vehicleLabel}</span>
                  </div>
                  <span className="text-xl font-bold text-primary-600">{formatPrice(price)}</span>
                </div>

                {/* Route */}
                <div className="space-y-2 pb-4 border-b border-gray-100">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-green-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{pickup}</span>
                  </div>
                  {(zwischenstoppFromErgebnisse || localZwischenstopp) && (
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-blue-500 mt-0.5 shrink-0" />
                      <span className="text-blue-700 font-medium">📍 {params.get('zwischenstopp_address') || localZwischenstopp}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{dropoff}</span>
                  </div>
                  {/* Route link */}
                  {(() => {
                    const zwStop = params.get('zwischenstopp_address') || localZwischenstopp;
                    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(dropoff)}${zwStop ? `&waypoints=${encodeURIComponent(zwStop)}` : ''}&travelmode=driving`;
                    return (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-600 hover:text-gray-800 transition-colors">
                        <span>🗺️</span> {locale === 'de' ? 'Route auf Google Maps anzeigen' : locale === 'en' ? 'View route on Google Maps' : 'Rotayı Google Maps\'te göster'}
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
                  {pickupSign && <div className="flex items-center gap-2"><span className="text-gray-400">🪧</span> <span className="text-gray-500">{locale === 'de' ? 'Abholschild:' : locale === 'en' ? 'Pickup sign:' : 'Tabela:'}</span> {pickupSign}</div>}
                  <div className="flex items-center gap-2">{payment === 'cash' ? <Banknote size={14} className="text-gray-400" /> : <CreditCard size={14} className="text-gray-400" />} {payment === 'cash' ? (locale === 'de' ? 'Barzahlung' : locale === 'en' ? 'Cash' : 'Nakit') : (locale === 'de' ? 'Kreditkarte' : locale === 'en' ? 'Credit card' : 'Kredi kartı')}</div>
                  {childSeat && <div className="flex items-center gap-2 col-span-2">👶 {buildChildSeatDetails() || (locale === 'de' ? 'Kindersitz' : locale === 'en' ? 'Child seat' : 'Çocuk koltuğu')}</div>}
                  {fahrradCount > 0 && <div className="flex items-center gap-2">🚲 {fahrradCount}× {locale === 'de' ? 'Fahrrad' : locale === 'en' ? 'Bicycle' : 'Bisiklet'}</div>}
                  {notes && <div className="flex items-start gap-2 col-span-2"><span className="text-gray-400">📝</span> {notes}</div>}
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
                    <img src={VEHICLE_IMAGES[vehicle] || '/images/kombi.PNG'} alt={vehicleLabel} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">{vehicleLabel}</p>
                    <p className="text-primary-200 text-sm">{effectiveDistanceKm.toFixed(1)} km · ca. {effectiveDuration} Min.</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/70 text-xs">{locale === 'de' ? 'Gesamtpreis' : locale === 'en' ? 'Total' : 'Toplam'}</p>
                  <p className="text-white font-bold text-2xl">{formatPrice(price)}</p>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Route */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{tx.review_route}</h3>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <MapPin size={16} className="text-green-500 mt-0.5 shrink-0" />
                      <p className="text-gray-800 text-sm">{pickup}</p>
                    </div>
                    {(zwischenstoppFromErgebnisse || localZwischenstopp) && (
                      <div className="flex items-start gap-3">
                        <MapPin size={16} className="text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-blue-700 text-sm font-medium">📍 {params.get('zwischenstopp_address') || localZwischenstopp}</p>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <MapPin size={16} className="text-red-500 mt-0.5 shrink-0" />
                      <p className="text-gray-800 text-sm">{dropoff}</p>
                    </div>
                  </div>
                  {/* Route link */}
                  {(() => {
                    const zwStop = params.get('zwischenstopp_address') || localZwischenstopp;
                    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(dropoff)}${zwStop ? `&waypoints=${encodeURIComponent(zwStop)}` : ''}&travelmode=driving`;
                    return (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-600 hover:text-gray-800 transition-colors">
                        <span>🗺️</span> {locale === 'de' ? 'Route auf Google Maps anzeigen' : locale === 'en' ? 'View route on Google Maps' : 'Rotayı Google Maps\'te göster'}
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
                        {childSeat && <p className="text-gray-800">👶 {locale === 'de' ? 'Kindersitz' : locale === 'en' ? 'Child seat' : 'Çocuk koltuğu'} ({locale === 'de' ? 'kostenlos' : locale === 'en' ? 'free' : 'ücretsiz'}){buildChildSeatDetails() ? ` — ${buildChildSeatDetails()}` : ''}</p>}
                        {fahrradCount > 0 && <p className="text-gray-800">🚲 {fahrradCount}× {locale === 'de' ? 'Fahrrad' : locale === 'en' ? 'Bicycle' : 'Bisiklet'}</p>}
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
                    {pickupSign && <div className="flex items-center gap-2"><span>🪧</span> <span className="text-gray-800"><span className="text-gray-500">{locale === 'de' ? 'Abholschild:' : locale === 'en' ? 'Pickup sign:' : 'Tabela:'}</span> <span className="font-medium">{pickupSign}</span></span></div>}
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
                  <p className="text-gray-800 text-sm">{payment === 'cash' ? tx.cash : tx.card}{payment === 'card' && cardNumber ? ` ···· ${cardNumber.slice(-4)}` : ''}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="px-6 pb-6 space-y-3">
                {/* Trust mini-bar */}
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-green-700 font-medium justify-center">
                    <span>🚫 {locale === 'tr' ? '3 saate kadar ücretsiz iptal' : locale === 'en' ? 'Free cancellation up to 3 hrs' : 'Kostenloser Storno bis 3 Std.'}</span>
                    <span>💰 {locale === 'tr' ? 'Sabit fiyat garantili' : locale === 'en' ? 'Fixed price guaranteed' : 'Festpreis garantiert'}</span>
                    <span>🛡️ {locale === 'tr' ? 'Tam sigortalı araçlar' : locale === 'en' ? 'Fully insured vehicles' : 'Vollversicherte Fahrzeuge'}</span>
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
                    onClick={() => { setTripType('oneway'); setReturnDate(''); setReturnTime('10:00'); }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    ✕ {locale === 'de' ? 'Entfernen' : locale === 'en' ? 'Remove' : 'Kaldır'}
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
                  🏷️ {roundtripDiscount}% {locale === 'de' ? 'Hin- & Rückfahrt Rabatt inklusive' : locale === 'en' ? 'Round trip discount included' : 'Gidiş-dönüş indirimi dahil'}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTripType('roundtrip')}
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
                    <span>📍</span>
                    <span>
                      {locale === 'de' ? 'Zwischenstopp:' : locale === 'en' ? 'Intermediate stop:' : 'Ara durak:'}{' '}
                      {localZwischenstopp}
                    </span>
                  </div>
                  <button type="button" onClick={() => { setLocalZwischenstopp(''); setLocalZwischenstoppBasePrice(0); setLocalZwischenstoppDistanceKm(0); setLocalZwischenstoppDuration(0); }} className="text-xs text-red-500 hover:text-red-700 font-medium">
                    ✕ {locale === 'de' ? 'Entfernen' : locale === 'en' ? 'Remove' : 'Kaldır'}
                  </button>
                </div>
              ) : showZwischenstoppPicker ? (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 space-y-3 relative">
                  <p className="text-sm font-semibold text-primary-700">
                    {locale === 'de' ? '📍 Zwischenstopp hinzufügen' : locale === 'en' ? '📍 Add intermediate stop' : '📍 Ara durak ekle'}
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
                  <span>📍</span>
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
                  <label className={labelCls}><span className="flex items-center gap-1"><Phone size={14} /> {tx.phone}</span></label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={cn(inputCls, errors.phone && 'border-red-400')} placeholder="+49 151 ..." />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className={labelCls}><span className="flex items-center gap-1"><Mail size={14} /> {tx.email}</span></label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={cn(inputCls, errors.email && 'border-red-400')} placeholder="name@example.com" />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}><span className="flex items-center gap-1"><Plane size={14} /> {tx.flight}</span></label>
                  <input value={flightNumber} onChange={e => setFlightNumber(e.target.value)} className={inputCls} placeholder="LH 1234" />
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
              {isAirportPickup && (
                <div>
                  <label className={labelCls}><span className="flex items-center gap-1">🪧 {locale === 'de' ? 'Abholschild' : locale === 'en' ? 'Pickup Sign' : 'Karşılama Tabelası'} *</span></label>
                  <input value={pickupSign} onChange={e => setPickupSign(e.target.value)} className={`${inputCls}${errors.pickupSign ? ' border-red-400' : ''}`} placeholder={locale === 'de' ? 'z.B. Familie Müller' : locale === 'en' ? 'e.g. Smith family' : 'örn. Müller ailesi'} />
                  {errors.pickupSign ? <p className="text-red-500 text-xs mt-1">{errors.pickupSign}</p> : <p className="text-xs text-gray-400 mt-1">{locale === 'de' ? 'Name auf dem Abholschild am Flughafen' : locale === 'en' ? 'Name on the pickup sign at the airport' : 'Havalimanında karşılama tabelasındaki isim'}</p>}
                </div>
              )}
              <div>
                <label className={labelCls}>{tx.notes}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} placeholder={locale === 'de' ? 'Besondere Wünsche...' : locale === 'en' ? 'Special requests...' : 'Özel istekler...'} />
              </div>
            </div>

            {/* Extras */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">🎒 Extras</h3>

              {/* Kindersitz */}
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👶</span>
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
                  <span className="text-2xl">🚲</span>
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
                  <input value={cardHolder} onChange={e => setCardHolder(e.target.value)} className={inputCls} placeholder={tx.cardHolder} />
                  <input
                    ref={cardNumberRef}
                    value={cardNumber}
                    onChange={e => {
                      const formatted = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
                      setCardNumber(formatted);
                      if (cardNumberRef.current) cardNumberRef.current.value = formatted;
                    }}
                    maxLength={19} className={inputCls} placeholder="1234 5678 9012 3456" inputMode="numeric"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      ref={cardExpiryRef}
                      value={cardExpiry}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
                        const formatted = raw.length > 2 ? raw.slice(0, 2) + '/' + raw.slice(2) : raw;
                        setCardExpiry(formatted);
                        if (cardExpiryRef.current) cardExpiryRef.current.value = formatted;
                      }}
                      className={inputCls} placeholder="MM/YY" maxLength={5} inputMode="numeric"
                    />
                    <input
                      ref={cardCvvRef}
                      value={cardCvv}
                      onChange={e => {
                        const formatted = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setCardCvv(formatted);
                        if (cardCvvRef.current) cardCvvRef.current.value = formatted;
                      }}
                      maxLength={4} className={inputCls} placeholder="CVV" inputMode="numeric"
                    />
                  </div>
                  {errors.card && <p className="text-red-500 text-xs">{errors.card}</p>}
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
                <span>🚫 {locale === 'tr' ? '3 saate kadar ücretsiz iptal' : locale === 'en' ? 'Free cancellation up to 3 hrs' : 'Kostenloser Storno bis 3 Std.'}</span>
                <span>💰 {locale === 'tr' ? 'Sabit fiyat garantili' : locale === 'en' ? 'Fixed price guaranteed' : 'Festpreis garantiert'}</span>
                <span>📧 {locale === 'tr' ? 'Anında e-posta onayı' : locale === 'en' ? 'Instant email confirmation' : 'Sofortige E-Mail-Bestätigung'}</span>
              </div>
            </div>
            <button onClick={() => { if (validate()) { setSubmitState('review'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50); } }}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-base shadow-lg">
              <CheckCircle size={20} /> {tx.submit}
            </button>
          </div>

          {/* RIGHT: Booking summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 sticky top-24 overflow-hidden">
              <div className="bg-primary-600 px-5 py-4">
                <h3 className="text-white font-bold">{tx.summary}</h3>
              </div>
              <div className="p-5 space-y-4 text-sm">
                {/* Vehicle */}
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                    <img src={VEHICLE_IMAGES[vehicle] || '/images/kombi.PNG'} alt={vehicleLabel} className="w-full h-full object-cover" />
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
                    <p className="text-gray-700 text-xs leading-relaxed">{pickup}</p>
                  </div>
                  {(zwischenstoppFromErgebnisse || localZwischenstopp) && (
                    <>
                      <div className="flex items-center gap-2 pl-6">
                        <ArrowRight size={12} className="text-blue-400" />
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin size={14} className="text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-blue-700 text-xs leading-relaxed font-medium">📍 {params.get('zwischenstopp_address') || localZwischenstopp}</p>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-2 pl-6">
                    <ArrowRight size={12} className="text-gray-300" />
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-gray-700 text-xs leading-relaxed">{dropoff}</p>
                  </div>
                  {/* Route link */}
                  {(() => {
                    const zwStop = params.get('zwischenstopp_address') || localZwischenstopp;
                    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(dropoff)}${zwStop ? `&waypoints=${encodeURIComponent(zwStop)}` : ''}&travelmode=driving`;
                    return (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 hover:text-gray-800 transition-colors">
                        <span>🗺️</span> {locale === 'de' ? 'Route anzeigen' : locale === 'en' ? 'View route' : 'Rotayı göster'}
                      </a>
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
                    {childSeat && <div className="flex items-center gap-2">👶 <span>{buildChildSeatDetails() || (locale === 'de' ? 'Kindersitz' : locale === 'en' ? 'Child seat' : 'Çocuk koltuğu')} ({locale === 'de' ? 'kostenlos' : locale === 'en' ? 'free' : 'ücretsiz'})</span></div>}
                    {fahrradCount > 0 && <div className="flex items-center gap-2">🚲 <span>{fahrradCount}× {locale === 'de' ? 'Fahrrad' : locale === 'en' ? 'Bicycle' : 'Bisiklet'}</span></div>}
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
                    <p className="text-xs text-green-600 font-medium mt-1">🏷️ {roundtripDiscount}% {locale === 'de' ? 'Rabatt inklusive' : locale === 'en' ? 'discount included' : 'indirim dahil'}</p>
                  )}
                  {anfahrtCost > 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-1">🚗 {locale === 'de' ? 'inkl.' : locale === 'en' ? 'incl.' : 'dahil'} {formatPrice(anfahrtCost)} {locale === 'de' ? 'Anfahrtskosten' : locale === 'en' ? 'approach fee' : 'yaklaşım ücreti'}</p>
                  )}
                  <p className="text-xs text-green-600 font-medium mt-1">✅ {locale === 'de' ? 'Inkl. Maut & Gepäck' : locale === 'en' ? 'Incl. tolls & luggage' : 'Otoyol & bagaj dahil'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
