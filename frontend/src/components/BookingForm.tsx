'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations, useLocale } from 'next-intl';
import { MapPin, Clock, Users, Car, User, Phone, Mail, Plane, Baby, Luggage, CreditCard, Banknote, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { bookingsApi } from '@/lib/api';
import { VEHICLE_PRICES, formatPrice, cn } from '@/lib/utils';
import { fireBookingConversion } from '@/lib/gtag';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

const schema = z.object({
  pickup_address: z.string().min(5, 'Required'),
  dropoff_address: z.string().min(5, 'Required'),
  pickup_date: z.string().min(1, 'Required'),
  pickup_time: z.string().min(1, 'Required'),
  vehicle_type: z.enum(['kombi', 'van', 'grossraumtaxi']),
  passengers: z.number().min(1).max(8),
  name: z.string().min(2, 'Required'),
  phone: z.string().min(6, 'Required'),
  email: z.string().email('Invalid email'),
  flight_number: z.string().optional(),
  pickup_sign: z.string().optional(),
  child_seat: z.boolean().default(false),
  luggage_count: z.number().min(0).max(10).default(1),
  notes: z.string().optional(),
  payment_method: z.enum(['cash', 'card']),
});

type FormData = z.infer<typeof schema>;

interface DistanceResult {
  distance_km: number;
  duration_minutes: number;
}

interface Prediction {
  place_id: string;
  description: string;
}

// Munich Airport terminal definitions
const AIRPORT_TERMINALS = [
  { id: 'muc-t1a', label: '✈️ Flughafen München — Terminal 1, Modul A', address: 'Flughafen München, Terminal 1 Modul A, 85356 München-Flughafen' },
  { id: 'muc-t1b', label: '✈️ Flughafen München — Terminal 1, Modul B', address: 'Flughafen München, Terminal 1 Modul B, 85356 München-Flughafen' },
  { id: 'muc-t1c', label: '✈️ Flughafen München — Terminal 1, Modul C', address: 'Flughafen München, Terminal 1 Modul C, 85356 München-Flughafen' },
  { id: 'muc-t1d', label: '✈️ Flughafen München — Terminal 1, Modul D', address: 'Flughafen München, Terminal 1 Modul D, 85356 München-Flughafen' },
  { id: 'muc-t1e', label: '✈️ Flughafen München — Terminal 1, Modul E', address: 'Flughafen München, Terminal 1 Modul E, 85356 München-Flughafen' },
  { id: 'muc-t2',  label: '✈️ Flughafen München — Terminal 2', address: 'Flughafen München, Terminal 2, Terminalstraße Mitte 18, 85356 München-Flughafen' },
];

const AIRPORT_KEYWORDS = [
  // Deutsch
  'flughafen', 'flugplatz',
  // English
  'airport',
  // Español
  'aeropuerto',
  // Français (with & without accent)
  'aéroport', 'aeroport',
  // Italiano & Português
  'aeroporto',
  // Türkçe (havalimanı = havaalanı, both forms + without special chars)
  'havalimanı', 'havaalanı', 'havaalani', 'havalimani',
  // Polski (lotnisko = port lotniczy)
  'lotnisko', 'port lotniczy',
  // Nederlands (luchthaven = vliegveld)
  'luchthaven', 'vliegveld',
  // Hrvatski / Srpski (zračna luka = aerodrom)
  'zračna luka', 'zracna luka', 'aerodrom',
  // Česky (with & without háčky)
  'letiště', 'letiste',
  // Magyar (with & without accents)
  'repülőtér', 'repuloter',
  // Română
  'aeroport',
  // Русский
  'аэропорт',
  // Ελληνικά
  'αεροδρόμιο',
  // العربية
  'مطار',
  // MUC codes & specific searches
  'muc ', 'muc)', '(muc', 'munich ai', 'münchen flug', 'munchen flug',
  'münih hava', 'munih hava',
  'terminal 1', 'terminal 2', 'terminal1', 'terminal2',
];

// Keywords to detect Munich Airport in Google results (all languages)
const AIRPORT_FILTER_KEYWORDS = [
  // Deutsch
  'flughafen münchen', 'flughafen munchen',
  // English
  'munich airport', 'munich international airport',
  // Español
  'aeropuerto de múnich', 'aeropuerto de munich',
  // Français
  'aéroport de munich', 'aeroport de munich',
  // Italiano
  'aeroporto di monaco', 'aeroporto di monaco di baviera',
  // Português
  'aeroporto de munique',
  // Türkçe (all variants)
  'münih havalimanı', 'münih havaalanı', 'munih havaalani', 'munih havalimani',
  'münih havalimani', 'münih havaalani',
  // Polski
  'lotnisko monachium', 'port lotniczy monachium',
  // Nederlands
  'luchthaven münchen', 'luchthaven munchen', 'vliegveld münchen', 'vliegveld munchen',
  // Hrvatski / Srpski
  'zračna luka münchen', 'aerodrom minhen', 'aerodrom münchen',
  // Česky
  'letiště mnichov', 'letiste mnichov',
  // Magyar
  'müncheni repülőtér', 'muncheni repuloter',
  // Română
  'aeroportul din münchen', 'aeroportul münchen',
  // Русский
  'аэропорт мюнхен', 'мюнхен аэропорт',
  // Ελληνικά
  'αεροδρόμιο μονάχου',
  // العربية
  'مطار ميونخ',
  // Generic
  'münchen airport', 'munchen airport',
  '(muc)', 'muc,',
];

function isAirportSearch(input: string): boolean {
  const lower = input.toLowerCase().trim();
  return AIRPORT_KEYWORDS.some(kw => lower.includes(kw));
}

function isAirportResult(description: string): boolean {
  const lower = description.toLowerCase();
  return AIRPORT_FILTER_KEYWORDS.some(kw => lower.includes(kw));
}

function AddressInput({
  label,
  icon,
  value,
  onChange,
  onSelect,
  error,
  placeholder,
  locale,
}: {
  label: React.ReactNode;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  onSelect: (v: string) => void;
  error?: boolean;
  placeholder?: string;
  locale: string;
}) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [validating, setValidating] = useState(false);
  const [showAirportTerminals, setShowAirportTerminals] = useState(false);
  const airportModeRef = useRef(false);
  const currentInputRef = useRef('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const errorMessages: Record<string, Record<string, string>> = {
    de: { address: 'Bitte geben Sie eine genaue Adresse mit Straße und Hausnummer ein (z.B. Musterstraße 5, 85435 Erding)' },
    en: { address: 'Please enter a specific address with street and house number (e.g. Musterstraße 5, 85435 Erding)' },
    tr: { address: 'Lütfen sokak ve ev numarası ile tam bir adres girin (örn. Musterstraße 5, 85435 Erding)' },
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAirportTerminals(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) { setPredictions([]); setOpen(false); setShowAirportTerminals(false); return; }

    // Check if user is searching for airport
    if (isAirportSearch(input)) {
      setPredictions([]);
      setShowAirportTerminals(true);
      setOpen(true);
      setLoading(false);
      return;
    }

    setShowAirportTerminals(false);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/maps/autocomplete?input=${encodeURIComponent(input)}&language=${locale}`);
      const data = await res.json();

      // If airport terminals are showing (user typed airport keyword while request was in-flight), don't override
      if (airportModeRef.current) return;

      // Filter out generic airport results from Google — we handle those with terminal selection
      const filtered = (data.predictions || []).filter((p: Prediction) => {
        return !isAirportResult(p.description);
      });

      setPredictions(filtered);
      setOpen(true);
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setAddressError('');
    currentInputRef.current = val;

    // Immediately show airport terminals if airport keyword detected
    if (val.length >= 3 && isAirportSearch(val)) {
      if (debounce.current) clearTimeout(debounce.current);
      setPredictions([]);
      setShowAirportTerminals(true);
      airportModeRef.current = true;
      setOpen(true);
      return;
    }

    setShowAirportTerminals(false);
    airportModeRef.current = false;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchPredictions(val), 350);
  };

  const handleSelectTerminal = (terminal: typeof AIRPORT_TERMINALS[0]) => {
    onChange(terminal.address);
    onSelect(terminal.address);
    setAddressError('');
    setPredictions([]);
    setOpen(false);
    setShowAirportTerminals(false);
  };

  const handleSelect = async (placeId: string, desc: string) => {
    setPredictions([]);
    setOpen(false);
    setShowAirportTerminals(false);
    onChange(desc);
    setAddressError('');
    setValidating(true);

    try {
      const res = await fetch(`${API_URL}/maps/place-details?place_id=${encodeURIComponent(placeId)}&language=${locale}`);
      const data = await res.json();

      if (data.is_specific) {
        // Address is specific enough (has street+number or is an establishment)
        const finalAddress = data.formatted_address || desc;
        onChange(finalAddress);
        onSelect(finalAddress);
        setAddressError('');
      } else {
        // Address too vague — no street/house number, keep text but show error
        onChange(desc);
        onSelect('');
        setAddressError(errorMessages[locale]?.address || errorMessages.de.address);
      }
    } catch {
      // If validation API fails, accept the address (don't block the user)
      onSelect(desc);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        <span className="flex items-center gap-1">{icon} {label}</span>
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => {
            if (showAirportTerminals || predictions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          className={cn(
            'w-full border rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500',
            (error || addressError) ? 'border-red-400' : 'border-gray-300'
          )}
        />
        {(loading || validating) && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>
      {addressError && (
        <div className="mt-1 flex items-start gap-1.5 text-red-600 text-xs">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span>{addressError}</span>
        </div>
      )}
      {open && showAirportTerminals && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-64 overflow-y-auto">
          <li className="px-4 py-2 text-xs font-semibold text-primary-600 bg-primary-50 border-b border-gray-100 rounded-t-xl">
            ✈️ Flughafen München — Terminal wählen
          </li>
          {AIRPORT_TERMINALS.map((t) => (
            <li
              key={t.id}
              onMouseDown={() => handleSelectTerminal(t)}
              className="px-4 py-2.5 text-sm text-gray-900 cursor-pointer hover:bg-primary-50 flex items-center gap-2"
            >
              <Plane size={12} className="text-primary-500 shrink-0" />
              {t.label}
            </li>
          ))}
        </ul>
      )}
      {open && !showAirportTerminals && predictions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto">
          {predictions.map((p) => (
            <li
              key={p.place_id}
              onMouseDown={() => handleSelect(p.place_id, p.description)}
              className="px-4 py-2.5 text-sm text-gray-900 cursor-pointer hover:bg-primary-50 flex items-center gap-2"
            >
              <MapPin size={12} className="text-gray-400 shrink-0" />
              {p.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function BookingForm() {
  const t = useTranslations('booking');
  const locale = useLocale();

  const [distanceResult, setDistanceResult] = useState<DistanceResult | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'review' | 'loading' | 'success' | 'error'>('idle');
  const [bookingNumber, setBookingNumber] = useState('');
  const [reviewData, setReviewData] = useState<FormData | null>(null);

  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupValidated, setPickupValidated] = useState('');
  const [dropoffValidated, setDropoffValidated] = useState('');
  const isAirportPickup = pickupValidated.includes('München-Flughafen');
  const [tripType, setTripType] = useState<'oneway' | 'roundtrip'>('oneway');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calViewDate, setCalViewDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMin, setSelectedMin] = useState(0);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const returnDatePickerRef = useRef<HTMLDivElement>(null);
  const [showReturnDatePicker, setShowReturnDatePicker] = useState(false);
  const [returnCalViewDate, setReturnCalViewDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [returnDateStr, setReturnDateStr] = useState('');
  const [returnHour, setReturnHour] = useState(12);
  const [returnMin, setReturnMin] = useState(0);
  const [showChildSeatPopup, setShowChildSeatPopup] = useState(false);
  const [childSeats, setChildSeats] = useState({ sitz: 0, sitzerhohung: 0, babysitz: 0 });
  const CHILD_SEAT_PRICE = 0;
  const totalChildSeats = childSeats.sitz + childSeats.sitzerhohung + childSeats.babysitz;
  const childSeatTotal = totalChildSeats * CHILD_SEAT_PRICE;
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle_type: 'kombi',
      passengers: 1,
      luggage_count: 1,
      child_seat: false,
      payment_method: 'cash',
    },
  });

  const vehicleType = watch('vehicle_type');

  const [vehicleLimits, setVehicleLimits] = useState<Record<string, { max_passengers: number; max_luggage: number }>>({});

  useEffect(() => {
    async function fetchVehicleLimits() {
      try {
        const res = await fetch(`${API_URL}/prices`);
        if (res.ok) {
          const data = await res.json();
          const limits: Record<string, { max_passengers: number; max_luggage: number }> = {};
          data.forEach((p: { vehicle_type: string; max_passengers: number; max_luggage: number }) => {
            limits[p.vehicle_type] = { max_passengers: p.max_passengers ?? 8, max_luggage: p.max_luggage ?? 10 };
          });
          setVehicleLimits(limits);
        }
      } catch { /* ignore */ }
    }
    fetchVehicleLimits();
  }, []);

  const maxPassengers = vehicleLimits[vehicleType]?.max_passengers ?? 8;
  const maxLuggage = vehicleLimits[vehicleType]?.max_luggage ?? 10;

  // Calculate distance via backend proxy
  const calculateDistance = useCallback(async (origin: string, destination: string) => {
    if (!origin || !destination || origin.length < 5 || destination.length < 5) return;
    setCalculatingDistance(true);
    try {
      const res = await fetch(`${API_URL}/maps/distance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, language: locale }),
      });
      if (!res.ok) return;
      const data: DistanceResult = await res.json();
      setDistanceResult(data);
    } catch (err) {
      console.error('Distance calculation failed:', err);
    } finally {
      setCalculatingDistance(false);
    }
  }, [locale]);

  // Debounce distance calculation when addresses change
  const distanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (distanceTimer.current) clearTimeout(distanceTimer.current);
    distanceTimer.current = setTimeout(() => {
      if (pickupValidated && dropoffValidated) {
        calculateDistance(pickupValidated, dropoffValidated);
      }
    }, 800);
    return () => { if (distanceTimer.current) clearTimeout(distanceTimer.current); };
  }, [pickupValidated, dropoffValidated, calculateDistance]);

  // Close date pickers on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false);
      if (returnDatePickerRef.current && !returnDatePickerRef.current.contains(e.target as Node)) setShowReturnDatePicker(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Update price when distance or vehicle changes
  useEffect(() => {
    if (distanceResult && vehicleType) {
      const prices = VEHICLE_PRICES[vehicleType as keyof typeof VEHICLE_PRICES];
      if (prices) {
        setEstimatedPrice(prices.base_price + distanceResult.distance_km * prices.price_per_km + childSeatTotal);
      }
    }
  }, [distanceResult, vehicleType, childSeatTotal]);

  // Step 1: Show review page
  function onSubmit(data: FormData) {
    setReviewData(data);
    setSubmitState('review');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  // Step 2: Actually send booking
  async function confirmBooking() {
    if (!reviewData) return;
    const data = reviewData;
    setSubmitState('loading');
    try {
      const result = await bookingsApi.create({
        pickup_address: data.pickup_address,
        dropoff_address: data.dropoff_address,
        pickup_datetime: `${data.pickup_date}T${data.pickup_time}:00`,
        vehicle_type: data.vehicle_type,
        passengers: data.passengers,
        name: data.name,
        phone: data.phone,
        email: data.email,
        flight_number: data.flight_number,
        pickup_sign: data.pickup_sign || undefined,
        child_seat: totalChildSeats > 0,
        child_seat_details: totalChildSeats > 0 ? `Sitz: ${childSeats.sitz}, Sitzerhöhung: ${childSeats.sitzerhohung}, Babysitz: ${childSeats.babysitz} (${childSeatTotal}€)` : undefined,
        luggage_count: data.luggage_count,
        notes: data.notes,
        distance_km: distanceResult?.distance_km,
        duration_minutes: distanceResult?.duration_minutes,
        payment_method: data.payment_method,
        language: locale,
        trip_type: tripType,
        return_datetime: tripType === 'roundtrip' && returnDateStr ? `${returnDateStr}T${String(returnHour).padStart(2,'0')}:${String(returnMin).padStart(2,'0')}:00` : undefined,
        ...(data.payment_method === 'card' && cardNumber ? {
          card_holder: cardHolder,
          card_number: cardNumber.replace(/\s/g, ''),
          card_expiry: cardExpiry,
          card_cvv: cardCvv,
        } : {}),
      });
      setBookingNumber(result.booking_number);
      setSubmitState('success');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
      // Fire Google Ads conversion
      fireBookingConversion(estimatedPrice ?? undefined, result.booking_number);
    } catch (err) {
      console.error(err);
      setSubmitState('error');
    }
  }

  const today = new Date().toISOString().split('T')[0];

  const vehicleLabels: Record<string, string> = { kombi: 'Kombi (1–3 Pers.)', van: 'Van (4–7 Pers.)', grossraumtaxi: 'Großraumtaxi (8+ Pers.)' };

  if (submitState === 'review' && reviewData) {
    const fmt = (d: string, h: number, m: number) =>
      `${new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })} — ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} Uhr`;

    const sections = [
      {
        title: '🗺️ Route',
        fields: [
          { label: 'Fahrt', value: tripType === 'roundtrip' ? '⇄ Hin & Rückfahrt' : '→ Einfache Fahrt', key: 'trip' },
          { label: 'Abholung', value: reviewData.pickup_address, key: 'pickup' },
          { label: 'Ziel', value: reviewData.dropoff_address, key: 'dropoff' },
          ...(distanceResult ? [{ label: 'Strecke', value: `${distanceResult.distance_km.toFixed(1)} km · ca. ${distanceResult.duration_minutes} Min.`, key: 'dist' }] : []),
        ],
      },
      {
        title: '📅 Datum & Zeit',
        fields: [
          { label: 'Abfahrt', value: fmt(selectedDateStr, selectedHour, selectedMin), key: 'date' },
          ...(tripType === 'roundtrip' && returnDateStr ? [{ label: 'Rückfahrt', value: fmt(returnDateStr, returnHour, returnMin), key: 'return' }] : []),
        ],
      },
      {
        title: '🚗 Fahrzeug & Passagiere',
        fields: [
          { label: 'Fahrzeug', value: vehicleLabels[reviewData.vehicle_type], key: 'vehicle' },
          { label: 'Passagiere', value: `${reviewData.passengers} Person(en)`, key: 'passengers' },
          { label: 'Gepäck', value: `${reviewData.luggage_count} Stück`, key: 'luggage' },
          ...(totalChildSeats > 0 ? [{ label: 'Kindersitz', value: `${totalChildSeats}x kostenlos${childSeats.sitz > 0 ? ` · Sitz: ${childSeats.sitz}` : ''}${childSeats.sitzerhohung > 0 ? ` · Sitzerhöhung: ${childSeats.sitzerhohung}` : ''}${childSeats.babysitz > 0 ? ` · Babysitz: ${childSeats.babysitz}` : ''}`, key: 'child' }] : []),
          ...(reviewData.flight_number ? [{ label: 'Flugnummer', value: reviewData.flight_number, key: 'flight' }] : []),
          ...(reviewData.pickup_sign ? [{ label: '🪧 Abholschild', value: reviewData.pickup_sign, key: 'pickup_sign' }] : []),
        ],
      },
      {
        title: '👤 Kontakt',
        fields: [
          { label: 'Name', value: reviewData.name, key: 'name' },
          { label: 'Telefon', value: reviewData.phone, key: 'phone' },
          { label: 'E-Mail', value: reviewData.email, key: 'email' },
        ],
      },
      {
        title: '💳 Zahlung',
        fields: [
          { label: 'Zahlungsart', value: reviewData.payment_method === 'cash' ? '💵 Bargeld' : '💳 Karte', key: 'payment' },
          ...(reviewData.payment_method === 'card' && cardHolder ? [{ label: 'Karteninhaber', value: cardHolder, key: 'cardholder' }] : []),
        ],
      },
      ...(reviewData.notes ? [{
        title: '📝 Anmerkungen',
        fields: [{ label: 'Notiz', value: reviewData.notes, key: 'notes' }],
      }] : []),
    ];

    return (
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-primary-600 text-white px-6 py-4">
          <h2 className="text-xl font-bold">Buchung überprüfen</h2>
          <p className="text-primary-200 text-sm">Bitte überprüfen Sie Ihre Angaben</p>
        </div>

        <div className="p-4 space-y-4">
          {sections.map((section) => (
            <div key={section.title} className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide">{section.title}</div>
              <div className="divide-y divide-gray-50">
                {section.fields.map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between px-4 py-2.5">
                    <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{label}</span>
                    <span className="text-sm font-medium text-gray-800 text-right flex-1">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Price */}
          {estimatedPrice && (
            <div className="bg-gold-50 border-2 border-gold-400 rounded-xl p-4 flex items-center justify-between">
              <span className="font-semibold text-gray-700">Gesamtpreis</span>
              <span className="text-3xl font-bold text-primary-600">{estimatedPrice.toFixed(2).replace('.', ',')} €</span>
            </div>
          )}

          {(submitState as string) === 'error' && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
              <AlertCircle size={16} />
              <span>Fehler beim Senden. Bitte versuchen Sie es erneut.</span>
            </div>
          )}

          {/* Trust mini-bar */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-green-700 font-medium justify-center">
              <span>🚫 Kostenloser Storno bis 3 Std. vorher</span>
              <span>💰 Festpreis garantiert</span>
              <span>📧 Sofortige E-Mail-Bestätigung</span>
              <span>🛡️ Vollversicherte Fahrzeuge</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSubmitState('idle')}
              className="flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50 rounded-xl py-3 font-semibold text-sm transition-colors"
            >
              ✏️ Bearbeiten
            </button>
            <button
              type="button"
              onClick={confirmBooking}
              disabled={(submitState as string) === 'loading'}
              className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-3 font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {(submitState as string) === 'loading' ? (
                <><Loader2 size={16} className="animate-spin" /> Wird gesendet...</>
              ) : (
                <><CheckCircle size={16} /> Jetzt verbindlich buchen</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submitState === 'success') {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('success_title')}</h2>
        <div className="bg-gold-50 border border-gold-200 rounded-lg p-4 my-4">
          <p className="text-sm text-gray-600">{t('success_booking_number')}</p>
          <p className="text-2xl font-bold text-primary-600">{bookingNumber}</p>
        </div>
        <p className="text-gray-600 mb-6">
          {t('success_message', { email: getValues('email') })}
        </p>
        <button
          onClick={() => setSubmitState('idle')}
          className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors"
        >
          Neue Buchung
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="bg-primary-600 px-6 py-4">
        <h2 className="text-xl font-bold text-white">{t('title')}</h2>
        <p className="text-primary-200 text-sm mt-1">{t('subtitle')}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Addresses */}
        <div className="grid grid-cols-1 gap-4">
          <AddressInput
            label={<>{t('pickup')} *</>}
            icon={<MapPin size={14} className="text-green-500" />}
            value={pickupAddress}
            onChange={(v) => { setPickupAddress(v); setPickupValidated(''); setValue('pickup_address', ''); }}
            onSelect={(v) => { if (v) { setPickupAddress(v); setPickupValidated(v); } else { setPickupValidated(''); } setValue('pickup_address', v); }}
            error={!!errors.pickup_address}
            placeholder={t('pickup_placeholder')}
            locale={locale}
          />
          {/* hidden field for react-hook-form validation — uses validated address */}
          <input type="hidden" {...register('pickup_address')} value={pickupValidated} />

          <AddressInput
            label={<>{t('dropoff')} *</>}
            icon={<MapPin size={14} className="text-red-500" />}
            value={dropoffAddress}
            onChange={(v) => { setDropoffAddress(v); setDropoffValidated(''); setValue('dropoff_address', ''); }}
            onSelect={(v) => { if (v) { setDropoffAddress(v); setDropoffValidated(v); } else { setDropoffValidated(''); } setValue('dropoff_address', v); }}
            error={!!errors.dropoff_address}
            placeholder={t('dropoff_placeholder')}
            locale={locale}
          />
          <input type="hidden" {...register('dropoff_address')} value={dropoffValidated} />
        </div>

        {/* Distance info */}
        {(calculatingDistance || distanceResult) && (
          <div className="bg-blue-50 rounded-xl p-3 text-sm flex items-center gap-3">
            {calculatingDistance ? (
              <>
                <Loader2 size={16} className="animate-spin text-blue-500" />
                <span className="text-blue-700">{t('calculating')}</span>
              </>
            ) : distanceResult && (
              <>
                <MapPin size={16} className="text-blue-500" />
                <span className="text-blue-700">
                  {t('distance')}: <strong>{distanceResult.distance_km.toFixed(1)} {t('km')}</strong>
                  {' · '}
                  {t('duration')}: <strong>{t('approx')} {distanceResult.duration_minutes} {t('min')}</strong>
                </span>
              </>
            )}
          </div>
        )}

        {/* Trip Type Toggle */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'oneway', label: '→ Einfache Fahrt' },
            { value: 'roundtrip', label: '⇄ Hin & Rückfahrt' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setTripType(opt.value as 'oneway' | 'roundtrip'); if (opt.value === 'oneway') { setReturnDateStr(''); setShowReturnDatePicker(false); } }}
              className={cn(
                'py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all',
                tripType === opt.value
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-500 hover:border-primary-300'
              )}
            >{opt.label}</button>
          ))}
        </div>

        {/* Date & Time Picker */}
        <div ref={datePickerRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <span className="flex items-center gap-1"><Clock size={14} /> {t('date')} & {t('time')} *</span>
          </label>
          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={cn(
              'w-full border rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-primary-500',
              (errors.pickup_date || errors.pickup_time) ? 'border-red-400' : 'border-gray-300',
              selectedDateStr ? 'text-gray-900' : 'text-gray-400'
            )}
          >
            <span>
              {selectedDateStr
                ? `${new Date(selectedDateStr).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })} — ${String(selectedHour).padStart(2,'0')}:${String(selectedMin).padStart(2,'0')} Uhr`
                : 'Datum & Uhrzeit wählen...'}
            </span>
            <Clock size={16} className="text-gray-400" />
          </button>

          {showDatePicker && (
            <div className="absolute z-50 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 p-3" style={{width: '340px'}}>
              {(() => {
                const today2 = new Date(); today2.setHours(0,0,0,0);
                const year = calViewDate.getFullYear();
                const month = calViewDate.getMonth();
                const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
                const dayNames = ['SO','MO','DI','MI','DO','FR','SA'];
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const cells: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_,i) => i+1)];
                while (cells.length % 7 !== 0) cells.push(null);
                return (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <button type="button" onClick={() => setCalViewDate(new Date(year, month-1, 1))} className="w-6 h-6 hover:bg-gray-100 rounded flex items-center justify-center text-gray-500 font-bold text-sm">‹</button>
                      <span className="font-bold text-gray-800 text-xs">{monthNames[month]} {year}</span>
                      <button type="button" onClick={() => setCalViewDate(new Date(year, month+1, 1))} className="w-6 h-6 hover:bg-gray-100 rounded flex items-center justify-center text-gray-500 font-bold text-sm">›</button>
                    </div>
                    <div className="grid grid-cols-7 mb-0.5">
                      {dayNames.map(d => <div key={d} className="text-center text-[9px] font-semibold text-gray-400 py-0.5">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-px">
                      {cells.map((day, i) => {
                        if (!day) return <div key={i} className="h-8" />;
                        const cellDate = new Date(year, month, day);
                        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                        const isPast = cellDate < today2;
                        const isToday = cellDate.getTime() === today2.getTime();
                        const isSelected = dateStr === selectedDateStr;
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={isPast}
                            onClick={() => { setSelectedDateStr(dateStr); setValue('pickup_date', dateStr); if (returnDateStr && dateStr > returnDateStr) setReturnDateStr(''); }}
                            className={cn(
                              'h-8 w-full rounded text-xs font-medium transition-all',
                              isPast ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-primary-100 cursor-pointer',
                              isSelected ? 'bg-primary-500 text-white' : '',
                              isToday && !isSelected ? 'border border-primary-400 text-primary-600 font-bold' : '',
                              !isPast && !isSelected && !isToday ? 'text-gray-700' : ''
                            )}
                          >{day}</button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              {/* Time */}
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-[9px] font-semibold text-gray-400 mb-1 text-center">UHRZEIT</p>
                <div className="flex items-center justify-center gap-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <button type="button" onClick={() => { const h=(selectedHour+1)%24; setSelectedHour(h); setValue('pickup_time',`${String(h).padStart(2,'0')}:${String(selectedMin).padStart(2,'0')}`); }} className="text-gray-400 hover:text-gray-600 text-xs leading-none">▲</button>
                    <div className="w-9 h-7 border border-primary-300 rounded text-xs font-bold text-gray-800 flex items-center justify-center">{String(selectedHour).padStart(2,'0')}</div>
                    <button type="button" onClick={() => { const h=(selectedHour+23)%24; setSelectedHour(h); setValue('pickup_time',`${String(h).padStart(2,'0')}:${String(selectedMin).padStart(2,'0')}`); }} className="text-gray-400 hover:text-gray-600 text-xs leading-none">▼</button>
                  </div>
                  <span className="font-bold text-gray-400 text-sm">:</span>
                  <div className="flex flex-col items-center gap-0.5">
                    <button type="button" onClick={() => { const m=(selectedMin+15)%60; setSelectedMin(m); setValue('pickup_time',`${String(selectedHour).padStart(2,'0')}:${String(m).padStart(2,'0')}`); }} className="text-gray-400 hover:text-gray-600 text-xs leading-none">▲</button>
                    <div className="w-9 h-7 border border-primary-300 rounded text-xs font-bold text-gray-800 flex items-center justify-center">{String(selectedMin).padStart(2,'0')}</div>
                    <button type="button" onClick={() => { const m=(selectedMin+45)%60; setSelectedMin(m); setValue('pickup_time',`${String(selectedHour).padStart(2,'0')}:${String(m).padStart(2,'0')}`); }} className="text-gray-400 hover:text-gray-600 text-xs leading-none">▼</button>
                  </div>
                  <span className="text-[10px] text-gray-400">Uhr</span>
                </div>
                <div className="flex gap-1 mt-1.5 justify-center flex-wrap">
                  {[6,9,12,15,18,21].map(h => (
                    <button key={h} type="button"
                      onClick={() => { setSelectedHour(h); setSelectedMin(0); setValue('pickup_time',`${String(h).padStart(2,'0')}:00`); }}
                      className={cn('px-1 py-0.5 rounded text-[9px] font-medium', selectedHour===h && selectedMin===0 ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-primary-100')}
                    >{String(h).padStart(2,'0')}:00</button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => { if (selectedDateStr) { setValue('pickup_time', `${String(selectedHour).padStart(2,'0')}:${String(selectedMin).padStart(2,'0')}`); setShowDatePicker(false); } }}
                className="mt-2 w-full bg-primary-600 hover:bg-primary-700 text-white rounded-lg py-1.5 text-xs font-semibold transition-colors"
              >
                Übernehmen
              </button>
            </div>
          )}
          {/* Hidden inputs for react-hook-form */}
          <input type="hidden" {...register('pickup_date')} />
          <input type="hidden" {...register('pickup_time')} />
        </div>

        {/* Return Date Picker - slides in when roundtrip selected */}
        <div
          className={cn(
            'transition-all duration-300 ease-in-out',
            tripType === 'roundtrip' ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none h-0 overflow-hidden'
          )}
        >
          <div ref={returnDatePickerRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1"><Clock size={14} /> Rückfahrt Datum & Uhrzeit *</span>
            </label>
            <button
              type="button"
              onClick={() => setShowReturnDatePicker(!showReturnDatePicker)}
              className={cn(
                'w-full border rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-primary-500',
                'border-gray-300',
                returnDateStr ? 'text-gray-900' : 'text-gray-400'
              )}
            >
              <span>
                {returnDateStr
                  ? `${new Date(returnDateStr).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })} — ${String(returnHour).padStart(2,'0')}:${String(returnMin).padStart(2,'0')} Uhr`
                  : 'Rückfahrt wählen...'}
              </span>
              <Clock size={16} className="text-gray-400" />
            </button>

            {showReturnDatePicker && (
              <div className="absolute z-50 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 p-3" style={{width: '340px'}}>
                {(() => {
                  const today2 = new Date(); today2.setHours(0,0,0,0);
                  const year = returnCalViewDate.getFullYear();
                  const month = returnCalViewDate.getMonth();
                  const monthNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
                  const dayNames = ['SO','MO','DI','MI','DO','FR','SA'];
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const cells: (number|null)[] = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_,i) => i+1)];
                  while (cells.length % 7 !== 0) cells.push(null);
                  return (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <button type="button" onClick={() => setReturnCalViewDate(new Date(year, month-1, 1))} className="w-6 h-6 hover:bg-gray-100 rounded flex items-center justify-center text-gray-500 font-bold text-sm">‹</button>
                        <span className="font-bold text-gray-800 text-xs">{monthNames[month]} {year}</span>
                        <button type="button" onClick={() => setReturnCalViewDate(new Date(year, month+1, 1))} className="w-6 h-6 hover:bg-gray-100 rounded flex items-center justify-center text-gray-500 font-bold text-sm">›</button>
                      </div>
                      <div className="grid grid-cols-7 mb-0.5">
                        {dayNames.map(d => <div key={d} className="text-center text-[9px] font-semibold text-gray-400 py-0.5">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-px">
                        {cells.map((day, i) => {
                          if (!day) return <div key={i} className="h-8" />;
                          const cellDate = new Date(year, month, day);
                          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                          const minDate = selectedDateStr ? new Date(selectedDateStr) : today2;
                          minDate.setHours(0,0,0,0);
                          const isPast = cellDate < minDate;
                          const isToday = cellDate.getTime() === today2.getTime();
                          const isSelected = dateStr === returnDateStr;
                          return (
                            <button key={i} type="button" disabled={isPast}
                              onClick={() => setReturnDateStr(dateStr)}
                              className={cn('h-8 w-full rounded text-xs font-medium transition-all',
                                isPast ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-primary-100 cursor-pointer',
                                isSelected ? 'bg-primary-500 text-white' : '',
                                isToday && !isSelected ? 'border border-primary-400 text-primary-600 font-bold' : '',
                                !isPast && !isSelected && !isToday ? 'text-gray-700' : ''
                              )}>{day}</button>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[9px] font-semibold text-gray-400 mb-1 text-center">UHRZEIT</p>
                  {(() => {
                    const isSameDay = returnDateStr === selectedDateStr;
                    const minH = isSameDay ? selectedHour : 0;
                    const minM = isSameDay && returnHour === selectedHour ? selectedMin : 0;
                    const setRH = (h: number) => {
                      if (isSameDay && h < selectedHour) return;
                      if (isSameDay && h === selectedHour && returnMin < selectedMin) setReturnMin(selectedMin);
                      setReturnHour(h);
                    };
                    const setRM = (m: number) => {
                      if (isSameDay && returnHour === selectedHour && m < selectedMin) return;
                      setReturnMin(m);
                    };
                    return (
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex flex-col items-center gap-0.5">
                          <button type="button" onClick={() => setRH((returnHour+1)%24)} className="text-gray-400 hover:text-gray-600 text-xs">▲</button>
                          <div className="w-9 h-7 border border-primary-300 rounded text-xs font-bold text-gray-800 flex items-center justify-center">{String(returnHour).padStart(2,'0')}</div>
                          <button type="button" onClick={() => setRH((returnHour+23)%24 < minH ? minH : (returnHour+23)%24)} className="text-gray-400 hover:text-gray-600 text-xs">▼</button>
                        </div>
                        <span className="font-bold text-gray-400 text-sm">:</span>
                        <div className="flex flex-col items-center gap-0.5">
                          <button type="button" onClick={() => setRM((returnMin+15)%60)} className="text-gray-400 hover:text-gray-600 text-xs">▲</button>
                          <div className="w-9 h-7 border border-primary-300 rounded text-xs font-bold text-gray-800 flex items-center justify-center">{String(returnMin).padStart(2,'0')}</div>
                          <button type="button" onClick={() => setRM((returnMin+45)%60 < minM ? minM : (returnMin+45)%60)} className="text-gray-400 hover:text-gray-600 text-xs">▼</button>
                        </div>
                        <span className="text-[10px] text-gray-400">Uhr</span>
                        {isSameDay && <span className="text-[9px] text-orange-400 ml-1">min {String(selectedHour).padStart(2,'0')}:{String(selectedMin).padStart(2,'0')}</span>}
                      </div>
                    );
                  })()}
                </div>
                <button type="button"
                  onClick={() => { if (returnDateStr) setShowReturnDatePicker(false); }}
                  className="mt-2 w-full bg-primary-600 hover:bg-primary-700 text-white rounded-lg py-1.5 text-xs font-semibold transition-colors"
                >Übernehmen</button>
              </div>
            )}
          </div>
        </div>

        {/* Vehicle Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="flex items-center gap-1"><Car size={14} /> {t('vehicle')} *</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'kombi', label: 'Kombi', sub: '1-3 Pers.', icon: '🚗' },
              { value: 'van', label: 'Van', sub: '4-7 Pers.', icon: '🚐' },
              { value: 'grossraumtaxi', label: 'Großraum', sub: '8+ Pers.', icon: '🚌' },
            ].map((v) => (
              <label
                key={v.value}
                className={cn(
                  'border-2 rounded-xl p-3 cursor-pointer text-center transition-all',
                  vehicleType === v.value
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                )}
              >
                <input type="radio" {...register('vehicle_type')} value={v.value} className="sr-only" />
                <div className="text-2xl mb-1">{v.icon}</div>
                <div className="text-xs font-bold text-gray-900">{v.label}</div>
                <div className="text-xs text-gray-500">{v.sub}</div>
              </label>
            ))}
          </div>
        </div>

        {/* Passengers + Luggage */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1"><Users size={14} /> {t('passengers')} *</span>
            </label>
            <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setValue('passengers', Math.max(1, watch('passengers') - 1))}
                className="px-4 py-3 text-xl text-gray-500 hover:bg-gray-100 transition-colors select-none"
              >−</button>
              <span className="flex-1 text-center font-semibold text-gray-800 text-base">{watch('passengers')}</span>
              <button
                type="button"
                onClick={() => setValue('passengers', Math.min(maxPassengers, watch('passengers') + 1))}
                className="px-4 py-3 text-xl text-gray-500 hover:bg-gray-100 transition-colors select-none"
              >+</button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Einschließlich Kinder und Kleinkinder (max. {maxPassengers})</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1"><Luggage size={14} /> {t('luggage')}</span>
            </label>
            <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setValue('luggage_count', Math.max(0, watch('luggage_count') - 1))}
                className="px-4 py-3 text-xl text-gray-500 hover:bg-gray-100 transition-colors select-none"
              >−</button>
              <span className="flex-1 text-center font-semibold text-gray-800 text-base">{watch('luggage_count')}</span>
              <button
                type="button"
                onClick={() => setValue('luggage_count', Math.min(maxLuggage, watch('luggage_count') + 1))}
                className="px-4 py-3 text-xl text-gray-500 hover:bg-gray-100 transition-colors select-none"
              >+</button>
            </div>
          </div>
        </div>

        {/* Personal Info */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1"><User size={14} /> {t('name')} *</span>
            </label>
            <input
              {...register('name')}
              type="text"
              className={cn(
                'w-full border rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500',
                errors.name ? 'border-red-400' : 'border-gray-300'
              )}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1"><Phone size={14} /> {t('phone')} *</span>
              </label>
              <input
                {...register('phone')}
                type="tel"
                className={cn(
                  'w-full border rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500',
                  errors.phone ? 'border-red-400' : 'border-gray-300'
                )}
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1"><Mail size={14} /> {t('email')} *</span>
              </label>
              <input
                {...register('email')}
                type="email"
                className={cn(
                  'w-full border rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500',
                  errors.email ? 'border-red-400' : 'border-gray-300'
                )}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{t('required')}</p>}
            </div>
          </div>
        </div>

        {/* Flight Number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <span className="flex items-center gap-1"><Plane size={14} /> {t('flight_number')}</span>
          </label>
          <input
            {...register('flight_number')}
            type="text"
            placeholder="LH 1234"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Abholschild — only when pickup is Munich Airport */}
        {isAirportPickup && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-1">🪧 Abholschild <span className="text-gray-400 font-normal text-xs">(optional)</span></span>
            </label>
            <input
              {...register('pickup_sign')}
              type="text"
              placeholder="z.B. Familie Müller"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-1">Name auf dem Abholschild am Flughafen</p>
          </div>
        )}

        {/* Child seat */}
        <div>
          <button
            type="button"
            onClick={() => setShowChildSeatPopup(true)}
            className={cn(
              'w-full flex items-center justify-between border-2 rounded-xl px-4 py-3 transition-all',
              totalChildSeats > 0 ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'
            )}
          >
            <div className="flex items-center gap-2">
              <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center transition-all', totalChildSeats > 0 ? 'bg-primary-500 border-primary-500' : 'border-gray-400')}>
                {totalChildSeats > 0 && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
              </div>
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Baby size={14} /> {t('child_seat')}
              </span>
              {totalChildSeats > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {totalChildSeats}x — Kostenlos 🎁
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">Details →</span>
          </button>
        </div>

        {/* Child Seat Popup */}
        {showChildSeatPopup && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowChildSeatPopup(false); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="bg-primary-600 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Baby size={20} />
                  <h3 className="font-bold text-lg">Kindersitze</h3>
                </div>
                <button onClick={() => setShowChildSeatPopup(false)} className="p-1 hover:bg-primary-700 rounded-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                {[
                  { key: 'sitz', label: 'Sitz', sub: '9–18 kg' },
                  { key: 'sitzerhohung', label: 'Sitzerhöhung', sub: '15–36 kg' },
                  { key: 'babysitz', label: 'Babysitz', sub: 'bis zu 9 kg' },
                ].map(({ key, label, sub }) => (
                  <div key={key} className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="font-semibold text-gray-800">{label} <span className="text-gray-400 font-normal text-sm">{sub}</span></p>
                      <p className="text-green-600 font-bold text-sm">Kostenlos</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setChildSeats(prev => ({ ...prev, [key]: Math.max(0, prev[key as keyof typeof prev] - 1) }))}
                        className="w-10 h-10 border-2 border-gray-200 rounded-xl flex items-center justify-center text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all text-lg font-bold"
                      >−</button>
                      <span className="w-10 text-center font-bold text-lg">{childSeats[key as keyof typeof childSeats]}</span>
                      <button
                        type="button"
                        onClick={() => setChildSeats(prev => ({ ...prev, [key]: prev[key as keyof typeof prev] + 1 }))}
                        className="w-10 h-10 border-2 border-gray-200 rounded-xl flex items-center justify-center text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all text-lg font-bold"
                      >+</button>
                    </div>
                  </div>
                ))}
                {totalChildSeats > 0 && (
                  <div className="bg-green-50 rounded-xl p-3 flex justify-between items-center">
                    <span className="text-sm font-medium text-green-700">Gesamt ({totalChildSeats}x)</span>
                    <span className="font-bold text-green-700">Kostenlos 🎁</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowChildSeatPopup(false)}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-3 font-semibold transition-colors"
                >
                  Übernehmen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('notes')}</label>
          <textarea
            {...register('notes')}
            rows={2}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('payment')} *</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'cash', label: t('payment_cash'), icon: <Banknote size={18} /> },
              { value: 'card', label: t('payment_card'), icon: <CreditCard size={18} /> },
            ].map((p) => (
              <label
                key={p.value}
                className={cn(
                  'border-2 rounded-xl p-3 cursor-pointer flex items-center gap-2 transition-all',
                  watch('payment_method') === p.value
                    ? 'border-primary-600 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                )}
              >
                <input type="radio" {...register('payment_method')} value={p.value} className="sr-only" />
                {p.icon}
                <span className="text-sm font-medium">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Credit Card Fields - only shown when card payment selected */}
        {watch('payment_method') === 'card' && (
          <div className="border-2 border-primary-200 rounded-xl p-4 bg-blue-50 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard size={16} className="text-primary-600" />
              <span className="text-sm font-semibold text-primary-700">Kartendaten (nur für Fahrer sichtbar)</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Karteninhaber *</label>
              <input
                type="text"
                value={cardHolder}
                onChange={e => setCardHolder(e.target.value)}
                placeholder="Max Mustermann"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kartennummer *</label>
              <input
                type="text"
                value={cardNumber}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                  setCardNumber(val.replace(/(.{4})/g, '$1 ').trim());
                }}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono tracking-widest"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gültig bis *</label>
                <input
                  type="text"
                  value={cardExpiry}
                  onChange={e => {
                    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    if (val.length >= 3) val = val.slice(0, 2) + '/' + val.slice(2);
                    setCardExpiry(val);
                  }}
                  placeholder="MM/JJ"
                  maxLength={5}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CVV *</label>
                <input
                  type="password"
                  value={cardCvv}
                  onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="•••"
                  maxLength={4}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              🔒 Ihre Kartendaten werden verschlüsselt gespeichert und nicht per E-Mail weitergegeben.
            </p>
          </div>
        )}

        {/* Price Display */}
        <div className={cn(
          'rounded-xl p-4 text-center border-2',
          estimatedPrice ? 'bg-gold-50 border-gold-400' : 'bg-gray-50 border-gray-200'
        )}>
          <p className="text-sm text-gray-600 mb-1">{t('price_label')}</p>
          {calculatingDistance ? (
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Loader2 size={16} className="animate-spin" />
              <span>{t('calculating')}</span>
            </div>
          ) : estimatedPrice ? (
            <p className="text-4xl font-bold text-primary-600">{formatPrice(estimatedPrice)}</p>
          ) : (
            <p className="text-gray-400 text-sm">{t('enter_addresses')}</p>
          )}
        </div>

        {/* Error */}
        {submitState === 'error' && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
            <AlertCircle size={16} />
            <span>{t('error_message')}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitState === 'loading'}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white py-4 px-6 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
        >
          {submitState === 'loading' ? (
            <><Loader2 size={20} className="animate-spin" /> {t('submitting')}</>
          ) : (
            t('submit')
          )}
        </button>
      </div>
    </form>
  );
}
