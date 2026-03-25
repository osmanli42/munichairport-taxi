'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { MapPin, Users, Search, Loader2, AlertCircle, Plane, ArrowLeftRight, Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

const AIRPORT_TERMINALS = [
  { id: 'muc-t1a', label: '✈️ Terminal 1 · Modul A', address: 'Flughafen München, Terminal 1 Modul A, 85356 München-Flughafen' },
  { id: 'muc-t1b', label: '✈️ Terminal 1 · Modul B', address: 'Flughafen München, Terminal 1 Modul B, 85356 München-Flughafen' },
  { id: 'muc-t1c', label: '✈️ Terminal 1 · Modul C', address: 'Flughafen München, Terminal 1 Modul C, 85356 München-Flughafen' },
  { id: 'muc-t1d', label: '✈️ Terminal 1 · Modul D', address: 'Flughafen München, Terminal 1 Modul D, 85356 München-Flughafen' },
  { id: 'muc-t1e', label: '✈️ Terminal 1 · Modul E', address: 'Flughafen München, Terminal 1 Modul E, 85356 München-Flughafen' },
  { id: 'muc-t2',  label: '✈️ Terminal 2', address: 'Flughafen München, Terminal 2, Terminalstraße Mitte 18, 85356 München-Flughafen' },
];

const AIRPORT_KEYWORDS = ['flughafen', 'flugplatz', 'airport', 'aeropuerto', 'aéroport', 'aeroport', 'aeroporto', 'havalimanı', 'havaalanı', 'havaalani', 'havalimani', 'lotnisko', 'port lotniczy', 'luchthaven', 'vliegveld', 'letiště', 'letiste', 'repülőtér', 'repuloter', 'aerodrom', 'muc ', 'muc)', '(muc', 'munich ai', 'münchen flug', 'munchen flug', 'münih hava', 'munih hava', 'terminal 1', 'terminal 2', 'terminal1', 'terminal2'];
const AIRPORT_FILTER_KEYWORDS = ['flughafen münchen', 'flughafen munchen', 'munich airport', 'munich international airport', 'aeropuerto de múnich', 'aeropuerto de munich', 'aéroport de munich', 'aeroport de munich', 'aeroporto di monaco', 'münih havalimanı', 'münih havaalanı', 'munih havaalani', 'lotnisko monachium', 'luchthaven münchen', '(muc)', 'muc,', 'münchen airport', 'munchen airport'];

function isAirportSearch(input: string): boolean {
  return AIRPORT_KEYWORDS.some(kw => input.toLowerCase().trim().includes(kw));
}
function isAirportResult(description: string): boolean {
  return AIRPORT_FILTER_KEYWORDS.some(kw => description.toLowerCase().includes(kw));
}

interface Prediction { place_id: string; description: string; }

const MONTHS_SHORT_DE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const MONTHS_SHORT_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_SHORT_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

function formatDateShort(dateStr: string, locale: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const months = locale === 'en' ? MONTHS_SHORT_EN : locale === 'tr' ? MONTHS_SHORT_TR : MONTHS_SHORT_DE;
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/* ─── Address Field ─── */
function AddressField({
  placeholder, value, onChange, onValidSelect, locale, icon,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onValidSelect: (v: string) => void;
  locale: string;
  icon: React.ReactNode;
}) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [open, setOpen] = useState(false);
  const [showAirport, setShowAirport] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const airportRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const errorMsg: Record<string, string> = {
    de: 'Bitte genaue Adresse mit Straße und Hausnummer eingeben',
    en: 'Please enter a specific address with street and house number',
    tr: 'Lütfen sokak ve ev numarası ile tam adres girin',
  };

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false); setShowAirport(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) { setPredictions([]); setOpen(false); return; }
    if (isAirportSearch(input)) {
      setPredictions([]); setShowAirport(true); airportRef.current = true; setOpen(true); return;
    }
    setShowAirport(false); airportRef.current = false; setLoading(true);
    try {
      const res = await fetch(`${API_URL}/maps/autocomplete?input=${encodeURIComponent(input)}&language=${locale}`);
      const data = await res.json();
      if (airportRef.current) return;
      setPredictions((data.predictions || []).filter((p: Prediction) => !isAirportResult(p.description)));
      setOpen(true);
    } catch { setPredictions([]); } finally { setLoading(false); }
  }, [locale]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val); onValidSelect(''); setFieldError('');
    if (val.length >= 3 && isAirportSearch(val)) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setPredictions([]); setShowAirport(true); airportRef.current = true; setOpen(true); return;
    }
    setShowAirport(false); airportRef.current = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 350);
  };

  const handleSelectTerminal = (t: typeof AIRPORT_TERMINALS[0]) => {
    onChange(t.address); onValidSelect(t.address); setFieldError('');
    setOpen(false); setShowAirport(false);
  };

  const handleSelect = async (placeId: string, desc: string) => {
    onChange(desc); setPredictions([]); setOpen(false); setShowAirport(false); setValidating(true);
    try {
      const res = await fetch(`${API_URL}/maps/place-details?place_id=${encodeURIComponent(placeId)}&language=${locale}`);
      const data = await res.json();
      if (data.is_specific) {
        const addr = data.formatted_address || desc;
        onChange(addr); onValidSelect(addr); setFieldError('');
      } else {
        onValidSelect(''); setFieldError(errorMsg[locale] || errorMsg.de);
      }
    } catch { onValidSelect(desc); } finally { setValidating(false); }
  };

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-0">
      <div className="flex items-center gap-2 h-full bg-white px-4 py-3">
        <span className="shrink-0">{icon}</span>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => (showAirport || predictions.length > 0) && setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-gray-800 text-[15px] font-medium outline-none placeholder:text-gray-400 min-w-0"
        />
        {(loading || validating) && <Loader2 size={14} className="animate-spin text-gray-400 shrink-0" />}
      </div>
      {fieldError && (
        <div className="absolute left-0 top-full mt-1 flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5 shadow-sm z-[70] whitespace-nowrap">
          <AlertCircle size={10} /> {fieldError}
        </div>
      )}
      {open && showAirport && (
        <ul className="absolute z-[70] left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl mt-1 overflow-hidden">
          <li className="px-4 py-2.5 text-xs font-bold text-primary-600 bg-primary-50 border-b border-gray-100">
            ✈️ Flughafen München — Terminal wählen
          </li>
          {AIRPORT_TERMINALS.map(t => (
            <li key={t.id} onMouseDown={() => handleSelectTerminal(t)} className="px-4 py-2.5 text-sm text-gray-800 cursor-pointer hover:bg-primary-50 flex items-center gap-2 transition-colors">
              <Plane size={12} className="text-primary-500 shrink-0" />
              {t.label}
            </li>
          ))}
        </ul>
      )}
      {open && !showAirport && predictions.length > 0 && (
        <ul className="absolute z-[70] left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl mt-1 max-h-52 overflow-y-auto">
          {predictions.map(p => (
            <li key={p.place_id} onMouseDown={() => handleSelect(p.place_id, p.description)} className="px-4 py-2.5 text-sm text-gray-800 cursor-pointer hover:bg-primary-50 flex items-center gap-2 transition-colors">
              <MapPin size={12} className="text-gray-400 shrink-0" />
              {p.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── Date-Time Picker with Popup ─── */
const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const DAYS_DE = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const DAYS_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYS_TR = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];

function DateTimeField({
  label, date, time, onDateChange, onTimeChange, minDate, locale,
}: {
  label: string;
  date: string;
  time: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  minDate: string;
  locale: string;
}) {
  const [open, setOpen] = useState(false);
  const [pickerStep, setPickerStep] = useState<'date' | 'time'>('date');
  const [viewMonth, setViewMonth] = useState(() => {
    const d = date ? new Date(date + 'T00:00:00') : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPickerStep('date');
      }
    };
    // Use setTimeout to avoid the opening click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  const months = locale === 'en' ? MONTHS_EN : locale === 'tr' ? MONTHS_TR : MONTHS_DE;
  const dayNames = locale === 'en' ? DAYS_EN : locale === 'tr' ? DAYS_TR : DAYS_DE;

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  // Monday = 0
  const firstDayRaw = new Date(viewMonth.year, viewMonth.month, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const minD = minDate ? new Date(minDate + 'T00:00:00') : today;
  const selectedDate = date ? new Date(date + 'T00:00:00') : null;

  function prevMonth() {
    setViewMonth(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  }
  function nextMonth() {
    setViewMonth(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });
  }
  function selectDay(day: number) {
    const m = String(viewMonth.month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onDateChange(`${viewMonth.year}-${m}-${d}`);
    setPickerStep('time');
  }
  function selectTime(t: string) {
    onTimeChange(t);
    setOpen(false);
    setPickerStep('date');
  }

  const timeSlots: string[] = [];
  for (let h = 0; h < 24; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`);
    timeSlots.push(`${String(h).padStart(2, '0')}:30`);
  }

  const dateFormatted = date
    ? new Date(date + 'T00:00:00').toLocaleDateString(locale === 'en' ? 'en-GB' : locale === 'tr' ? 'tr-TR' : 'de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '--.--.----';

  return (
    <div ref={ref} className="relative">
      {/* Button */}
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) setPickerStep('date'); }}
        className="flex items-center gap-2.5 bg-white px-4 py-3 h-full hover:bg-gray-50 transition-colors w-full text-left"
      >
        <Calendar size={18} className="text-gray-400 shrink-0" />
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none">{label}</div>
          <div className="text-[15px] font-bold text-gray-800 mt-0.5 whitespace-nowrap">
            {dateFormatted} - {time}
          </div>
        </div>
      </button>

      {/* Popup */}
      {open && (
        <div
          className="absolute z-[80] top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200" style={{ width: '340px' }}
          onMouseDown={e => e.stopPropagation()}
        >
          {pickerStep === 'date' ? (
            /* ── Calendar ── */
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <button type="button" onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                  <span className="text-primary-600 text-lg font-bold">‹</span>
                </button>
                <span className="font-bold text-gray-800 text-base">{months[viewMonth.month]} {viewMonth.year}</span>
                <button type="button" onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                  <span className="text-primary-600 text-lg font-bold">›</span>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }} className="mb-2">
                {dayNames.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: '4px' }}>
                {Array.from({ length: firstDay }, (_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const thisDate = new Date(viewMonth.year, viewMonth.month, day);
                  const isPast = thisDate < minD;
                  const isSelected = selectedDate && thisDate.getTime() === selectedDate.getTime();
                  const isToday = thisDate.getTime() === today.getTime();
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isPast}
                      onClick={() => selectDay(day)}
                      className={cn(
                        'w-10 h-10 mx-auto rounded-full text-sm font-medium transition-all',
                        isPast && 'text-gray-300 cursor-not-allowed',
                        !isPast && !isSelected && 'hover:bg-primary-50 text-gray-700',
                        isSelected && 'bg-primary-600 text-white',
                        isToday && !isSelected && 'ring-2 ring-primary-300 text-primary-600 font-bold',
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Time ── */
            <div className="p-5">
              <div className="text-sm font-bold text-gray-600 mb-3">
                {locale === 'de' ? 'Uhrzeit wählen' : locale === 'tr' ? 'Saat seçin' : 'Select time'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                {timeSlots.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => selectTime(t)}
                    className={cn(
                      'py-2.5 rounded-lg text-sm font-semibold transition-colors',
                      time === t
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-50 text-gray-700 hover:bg-primary-50 hover:text-primary-700'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPickerStep('date')}
                className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                ← {locale === 'de' ? 'Zurück zum Kalender' : locale === 'tr' ? 'Takvime dön' : 'Back to calendar'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main SearchBar ─── */
interface SearchBarProps {
  initialValues?: {
    pickup: string;
    dropoff: string;
    date: string;
    time: string;
    passengers: number;
    hasReturn: boolean;
    returnDate?: string;
    returnTime?: string;
  };
  onSearchComplete?: (params: URLSearchParams) => void;
  compact?: boolean;
}

export default function SearchBar({ initialValues, onSearchComplete, compact }: SearchBarProps = {}) {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read from URL params if no initialValues provided (e.g. returning from ergebnisse)
  const urlInit = !initialValues && searchParams.get('pickup') ? {
    pickup: searchParams.get('pickup') || '',
    dropoff: searchParams.get('dropoff') || '',
    date: searchParams.get('date') || '',
    time: searchParams.get('time') || '10:00',
    passengers: parseInt(searchParams.get('passengers') || '2', 10),
    hasReturn: searchParams.get('trip_type') === 'roundtrip',
    returnDate: searchParams.get('return_date') || undefined,
    returnTime: searchParams.get('return_time') || undefined,
  } : undefined;

  const init = initialValues || urlInit;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];
  const minDate = new Date().toISOString().split('T')[0];

  const [pickup, setPickup] = useState(init?.pickup || '');
  const [pickupVal, setPickupVal] = useState(init?.pickup || '');
  const [dropoff, setDropoff] = useState(init?.dropoff || '');
  const [dropoffVal, setDropoffVal] = useState(init?.dropoff || '');
  const [date, setDate] = useState(init?.date || defaultDate);
  const [time, setTime] = useState(init?.time || '10:00');
  const [passengers, setPassengers] = useState(init?.passengers || 2);
  const [searching, setSearching] = useState(false);
  const [formError, setFormError] = useState('');

  // Settings (stadtfahrt toggle)
  const [stadtfahrtEnabled, setStadtfahrtEnabled] = useState(false);
  useEffect(() => {
    fetch(`${API_URL}/settings`).then(r => r.json()).then(s => {
      if (s.stadtfahrt_enabled === '1') setStadtfahrtEnabled(true);
    }).catch(() => {});
  }, []);

  // Return trip
  const [hasReturn, setHasReturn] = useState(init?.hasReturn || false);
  const returnDefault = new Date();
  returnDefault.setDate(returnDefault.getDate() + 3);
  const [returnDate, setReturnDate] = useState(init?.returnDate || returnDefault.toISOString().split('T')[0]);
  const [returnTime, setReturnTime] = useState(init?.returnTime || '16:00');

  // Auto-correct return date/time: must be after departure
  useEffect(() => {
    if (!hasReturn || !date) return;
    if (returnDate < date) {
      // Set return date to departure date + 1 day
      const next = new Date(date + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      setReturnDate(next.toISOString().split('T')[0]);
    } else if (returnDate === date && returnTime <= time) {
      // Same day: push return time to at least 1 hour after departure
      const [h, m] = time.split(':').map(Number);
      const newH = Math.min(h + 1, 23);
      setReturnTime(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }, [date, time, hasReturn, returnDate, returnTime]);

  const labels: Record<string, {
    from: string; to: string; search: string; searching: string;
    errFrom: string; errTo: string; errDate: string; errRoute: string; errAirport: string;
    arrival: string; addReturn: string; returnFlight: string;
    swap: string; persons: string; person: string;
  }> = {
    de: {
      from: 'Abholadresse...', to: 'Zieladresse...', search: 'Suchen', searching: 'Suchen...',
      errFrom: 'Bitte Abholadresse auswählen', errTo: 'Bitte Zieladresse auswählen',
      errDate: 'Bitte Datum auswählen', errRoute: 'Route konnte nicht berechnet werden.',
      errAirport: 'Wir bieten nur Flughafentransfers an. Bitte wählen Sie den Flughafen München oder eine Adresse in der Nähe (Oberding, Hallbergmoos, Freising) als Abhol- oder Zielort.',
      arrival: 'Hinfahrt', addReturn: 'Rückfahrt hinzufügen', returnFlight: 'Rückfahrt',
      swap: 'Adressen tauschen', persons: 'Personen', person: 'Person',
    },
    en: {
      from: 'Pickup address...', to: 'Destination...', search: 'Search', searching: 'Searching...',
      errFrom: 'Please select a pickup address', errTo: 'Please select a destination',
      errDate: 'Please select a date', errRoute: 'Could not calculate route.',
      errAirport: 'We only offer airport transfers. Please select Munich Airport or a nearby address (Oberding, Hallbergmoos, Freising) as pickup or destination.',
      arrival: 'Flight arrival', addReturn: 'Add a return', returnFlight: 'Return flight',
      swap: 'Swap addresses', persons: 'Passengers', person: 'Passenger',
    },
    tr: {
      from: 'Alış adresi...', to: 'Varış adresi...', search: 'Ara', searching: 'Aranıyor...',
      errFrom: 'Lütfen alış adresi seçin', errTo: 'Lütfen varış adresi seçin',
      errDate: 'Lütfen tarih seçin', errRoute: 'Rota hesaplanamadı.',
      errAirport: 'Sadece havalimanı transferi sunuyoruz. Lütfen Münih Havalimanı veya yakın bir adres (Oberding, Hallbergmoos, Freising) seçin.',
      arrival: 'Gidiş', addReturn: 'Dönüş ekle', returnFlight: 'Dönüş',
      swap: 'Adresleri değiştir', persons: 'Kişi', person: 'Kişi',
    },
  };
  const l = labels[locale] || labels.de;

  function isAirportArea(address: string): boolean {
    const lower = address.toLowerCase();
    const airportKeywords = ['flughafen münchen', 'munich airport', 'münchen-flughafen', 'munchen-flughafen', '85356'];
    const nearbyAreas = ['oberding', 'hallbergmoos', 'freising'];
    return [...airportKeywords, ...nearbyAreas].some(kw => lower.includes(kw));
  }

  async function handleSearch() {
    if (!pickupVal) { setFormError(l.errFrom); return; }
    if (!dropoffVal) { setFormError(l.errTo); return; }
    if (!date) { setFormError(l.errDate); return; }
    // At least one address must be airport or nearby area (unless stadtfahrt enabled)
    const isAirportTrip = isAirportArea(pickupVal) || isAirportArea(dropoffVal);
    if (!isAirportTrip && !stadtfahrtEnabled) {
      setFormError(l.errAirport); return;
    }
    setFormError('');
    setSearching(true);
    try {
      const res = await fetch(`${API_URL}/maps/distance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: pickupVal, destination: dropoffVal, language: locale, check_anfahrt: !isAirportTrip }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Route not found');
      const params = new URLSearchParams({
        pickup: pickupVal, dropoff: dropoffVal,
        date, time,
        passengers: String(passengers),
        distance_km: String(data.distance_km),
        duration: String(data.duration_minutes),
        trip_type: hasReturn ? 'roundtrip' : 'oneway',
      });
      if (data.anfahrt_distance_km) {
        params.set('anfahrt_km', String(data.anfahrt_distance_km));
      }
      if (hasReturn) {
        params.set('return_date', returnDate);
        params.set('return_time', returnTime);
      }
      if (onSearchComplete) {
        onSearchComplete(params);
      } else {
        const prefix = locale === 'de' ? '' : `/${locale}`;
        router.push(`${prefix}/ergebnisse?${params.toString()}`);
      }
    } catch {
      setFormError(l.errRoute);
    } finally {
      setSearching(false);
    }
  }

  function swapAddresses() {
    const tP = pickup; setPickup(dropoff); setDropoff(tP);
    const tV = pickupVal; setPickupVal(dropoffVal); setDropoffVal(tV);
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* ─── DESKTOP ─── */}
      <div className="hidden lg:block">
        <div className="border-[3px] border-gold-400 rounded-2xl shadow-2xl overflow-visible bg-white">
          <div className="flex items-stretch overflow-visible rounded-xl">
            {/* From */}
            <div className="flex-1 min-w-0 overflow-visible rounded-l-xl">
              <AddressField
                icon={<MapPin size={18} className="text-green-500" />}
                placeholder={l.from}
                value={pickup}
                onChange={setPickup}
                onValidSelect={setPickupVal}
                locale={locale}
              />
            </div>

            {/* Swap */}
            <button
              onClick={swapAddresses}
              title={l.swap}
              className="shrink-0 w-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-primary-600 transition-colors border-x border-gray-200"
            >
              <ArrowLeftRight size={14} />
            </button>

            {/* To */}
            <div className="flex-1 min-w-0 overflow-visible">
              <AddressField
                icon={<MapPin size={18} className="text-red-400" />}
                placeholder={l.to}
                value={dropoff}
                onChange={setDropoff}
                onValidSelect={setDropoffVal}
                locale={locale}
              />
            </div>

            {/* Divider */}
            <div className="w-px bg-gray-200" />

            {/* Date/Time */}
            <div className="shrink-0">
              <DateTimeField
                label={l.arrival}
                date={date}
                time={time}
                onDateChange={setDate}
                onTimeChange={setTime}
                minDate={minDate}
                locale={locale}
              />
            </div>

            {/* Divider */}
            <div className="w-px bg-gray-200" />

            {/* Return or Add Return */}
            <div className="shrink-0">
              {hasReturn ? (
                <div className="flex items-center h-full">
                  <DateTimeField
                    label={l.returnFlight}
                    date={returnDate}
                    time={returnTime}
                    onDateChange={setReturnDate}
                    onTimeChange={setReturnTime}
                    minDate={date || minDate}
                    locale={locale}
                  />
                  <button
                    onClick={() => setHasReturn(false)}
                    className="mr-2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-red-100 text-gray-500 hover:text-red-500 transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setHasReturn(true)}
                  className="flex items-center gap-2 bg-white px-3 py-3 h-full hover:bg-gray-50 transition-colors"
                >
                  <Calendar size={16} className="text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-gray-400 whitespace-nowrap">{l.addReturn}</span>
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="w-px bg-gray-200" />

            {/* Passengers */}
            <div className="shrink-0 flex items-center gap-2 bg-white px-3 py-3">
              <Users size={16} className="text-gray-400 shrink-0" />
              <span className="text-sm font-bold text-gray-800 whitespace-nowrap">{passengers}</span>
              <div className="flex flex-col">
                <button onClick={() => setPassengers(p => Math.min(8, p + 1))} className="w-5 h-4 flex items-center justify-center text-gray-500 hover:text-primary-600 text-xs font-bold leading-none">▲</button>
                <button onClick={() => setPassengers(p => Math.max(1, p - 1))} className="w-5 h-4 flex items-center justify-center text-gray-500 hover:text-primary-600 text-xs font-bold leading-none">▼</button>
              </div>
            </div>

            {/* Search */}
            <button
              onClick={handleSearch}
              disabled={searching}
              className="shrink-0 flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-70 text-white font-bold px-6 rounded-r-xl transition-colors text-[15px]"
            >
              {searching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              {l.search}
            </button>
          </div>
        </div>
      </div>

      {/* ─── MOBILE ─── */}
      <div className="lg:hidden">
        <div className="bg-gold-400 rounded-2xl p-1 shadow-2xl overflow-visible">
          <div className="flex flex-col overflow-visible">
            {/* From */}
            <div className="overflow-visible rounded-t-xl">
              <AddressField
                icon={<MapPin size={18} className="text-green-500" />}
                placeholder={l.from}
                value={pickup}
                onChange={setPickup}
                onValidSelect={setPickupVal}
                locale={locale}
              />
            </div>

            {/* Swap */}
            <div className="px-3 py-0.5 flex items-center bg-white">
              <button onClick={swapAddresses} className="flex items-center gap-1.5 text-gray-400 hover:text-primary-600 text-xs transition-colors">
                <ArrowLeftRight size={12} /> {l.swap}
              </button>
            </div>

            {/* To */}
            <div className="overflow-visible border-t border-gray-100">
              <AddressField
                icon={<MapPin size={18} className="text-red-400" />}
                placeholder={l.to}
                value={dropoff}
                onChange={setDropoff}
                onValidSelect={setDropoffVal}
                locale={locale}
              />
            </div>

            {/* Date & Return row */}
            <div className="flex border-t border-gray-100">
              {/* Departure Date/Time */}
              <div className="flex-1 border-r border-gray-100">
                <DateTimeField
                  label={l.arrival}
                  date={date}
                  time={time}
                  onDateChange={setDate}
                  onTimeChange={setTime}
                  minDate={minDate}
                  locale={locale}
                />
              </div>

              {/* Return */}
              <div className="flex-1">
                {hasReturn ? (
                  <div className="flex items-center h-full">
                    <div className="flex-1 min-w-0">
                      <DateTimeField
                        label={l.returnFlight}
                        date={returnDate}
                        time={returnTime}
                        onDateChange={setReturnDate}
                        onTimeChange={setReturnTime}
                        minDate={date || minDate}
                        locale={locale}
                      />
                    </div>
                    <button
                      onClick={() => setHasReturn(false)}
                      className="mr-2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-red-100 text-gray-500 hover:text-red-500 shrink-0"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setHasReturn(true)}
                    className="flex items-center gap-2 bg-white px-4 py-3 w-full h-full"
                  >
                    <Calendar size={16} className="text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-400">{l.addReturn}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Passengers & Search */}
            <div className="flex border-t border-gray-100">
              <div className="flex items-center gap-3 bg-white px-4 py-3 flex-1 border-r border-gray-100 rounded-bl-xl">
                <Users size={16} className="text-gray-400" />
                <span className="text-sm font-bold text-gray-800 flex-1">{passengers} {passengers > 1 ? l.persons : l.person}</span>
                <button onClick={() => setPassengers(p => Math.max(1, p - 1))} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 text-sm">−</button>
                <button onClick={() => setPassengers(p => Math.min(8, p + 1))} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 text-sm">+</button>
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="shrink-0 flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-70 text-white font-bold px-6 py-3 rounded-br-xl transition-colors text-sm"
              >
                {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                {l.search}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {formError && (
        <div className="flex items-center gap-2 mt-3 px-4 py-2.5 bg-red-500/20 text-red-100 text-sm rounded-xl backdrop-blur-sm">
          <AlertCircle size={14} /> {formError}
        </div>
      )}
    </div>
  );
}
