'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Loader2, Plane } from 'lucide-react';

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

const AIRPORT_KEYWORDS = ['flughafen', 'airport', 'terminal 1', 'terminal 2', 'terminal1', 'terminal2', 'muc ', '(muc', 'münchen flug', 'munchen flug', 'münih hava', 'munih hava', 'havalimanı', 'havaalanı'];
const AIRPORT_FILTER_KEYWORDS = ['flughafen münchen', 'flughafen munchen', 'munich airport', 'munich international airport', '(muc)', 'münchen airport'];

function isAirportSearch(input: string): boolean {
  return AIRPORT_KEYWORDS.some(kw => input.toLowerCase().trim().includes(kw));
}
function isAirportResult(description: string): boolean {
  return AIRPORT_FILTER_KEYWORDS.some(kw => description.toLowerCase().includes(kw));
}

interface Prediction { place_id: string; description: string; }
interface DropdownPos { top: number; left: number; width: number; }

export default function AdminAddressField({
  placeholder,
  value,
  onChange,
  onValidSelect,
  onCoords,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onValidSelect: (v: string) => void;
  onCoords?: (lat: number | null, lng: number | null) => void;
}) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [open, setOpen] = useState(false);
  const [showAirport, setShowAirport] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos>({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const airportRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Calculate fixed position from input wrapper when opening
  const updatePos = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false); setShowAirport(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const update = () => updatePos();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open, updatePos]);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) { setPredictions([]); setOpen(false); return; }
    if (isAirportSearch(input)) {
      setPredictions([]); setShowAirport(true); airportRef.current = true; updatePos(); setOpen(true); return;
    }
    setShowAirport(false); airportRef.current = false; setLoading(true);
    try {
      const res = await fetch(`${API_URL}/maps/autocomplete?input=${encodeURIComponent(input)}&language=de`);
      const data = await res.json();
      if (airportRef.current) return;
      const preds = (data.predictions || []).filter((p: Prediction) => !isAirportResult(p.description));
      setPredictions(preds);
      if (preds.length > 0) { updatePos(); setOpen(true); }
    } catch { setPredictions([]); } finally { setLoading(false); }
  }, [updatePos]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    onValidSelect('');
    if (val.length >= 3 && isAirportSearch(val)) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setPredictions([]); setShowAirport(true); airportRef.current = true; updatePos(); setOpen(true); return;
    }
    setShowAirport(false); airportRef.current = false;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 350);
  };

  const handleSelectTerminal = (t: typeof AIRPORT_TERMINALS[0]) => {
    onChange(t.address); onValidSelect(t.address);
    onCoords?.(48.3536, 11.7860);
    setOpen(false); setShowAirport(false);
  };

  const handleSelect = async (placeId: string, desc: string) => {
    onChange(desc); setPredictions([]); setOpen(false); setShowAirport(false); setValidating(true);
    try {
      const res = await fetch(`${API_URL}/maps/place-details?place_id=${encodeURIComponent(placeId)}&language=de`);
      const data = await res.json();
      if (data.is_specific) {
        const addr = data.formatted_address || desc;
        onChange(addr); onValidSelect(addr);
        onCoords?.(data.lat ?? null, data.lng ?? null);
      } else {
        onValidSelect('');
        onCoords?.(null, null);
      }
    } catch { onValidSelect(desc); onCoords?.(null, null); } finally { setValidating(false); }
  };

  const dropdown = open && mounted ? (
    <ul
      style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 99999 }}
      className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
    >
      {showAirport ? (
        <>
          <li className="px-4 py-2 text-xs font-bold text-primary-600 bg-primary-50 border-b border-gray-100">
            ✈️ Flughafen München — Terminal wählen
          </li>
          {AIRPORT_TERMINALS.map(t => (
            <li key={t.id} onMouseDown={() => handleSelectTerminal(t)} className="px-4 py-2.5 text-sm text-gray-800 cursor-pointer hover:bg-primary-50 flex items-center gap-2 transition-colors">
              <Plane size={12} className="text-primary-500 shrink-0" />
              {t.label}
            </li>
          ))}
        </>
      ) : predictions.map(p => (
        <li key={p.place_id} onMouseDown={() => handleSelect(p.place_id, p.description)} className="px-4 py-2.5 text-sm text-gray-800 cursor-pointer hover:bg-primary-50 flex items-center gap-2 transition-colors">
          <MapPin size={12} className="text-gray-400 shrink-0" />
          {p.description}
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div ref={wrapperRef}>
      <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary-500 bg-white">
        <MapPin size={14} className="text-gray-400 shrink-0" />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => { if (showAirport || predictions.length > 0) { updatePos(); setOpen(true); } }}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
        />
        {(loading || validating) && <Loader2 size={13} className="animate-spin text-gray-400 shrink-0" />}
      </div>
      {mounted && dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
