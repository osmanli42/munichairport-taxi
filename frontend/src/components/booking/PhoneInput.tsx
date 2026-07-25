'use client';

// Phone field for the booking form: country selector + number input rendered as one
// control. Purely presentational — the parent owns `value`/`country` and passes in the
// already-parsed `result`, so there is no second source of truth about validity.
//
// The status line never blocks submission. An invalid number is shown in amber as a
// prompt to check, not in red as a hard error, because a false negative on a real
// customer's number costs a booking.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Phone, Search, AlertTriangle } from 'lucide-react';
import type { CountryCode } from 'libphonenumber-js/max';
import { cn } from '@/lib/utils';
import { getCountryOptions, formatNational, splitInternational, type PhoneResult } from '@/lib/phone';

interface Props {
  value: string;
  onChange: (value: string) => void;
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  /** parsePhone(value, country) computed by the parent. */
  result: PhoneResult;
  locale: string;
  /** Hard error from the parent's validate() — only ever "field is empty". */
  errorText?: string;
  /** Turns the advisory status line off (admin kill switch). */
  statusEnabled?: boolean;
  placeholder?: string;
}

const TX = {
  de: {
    search: 'Land suchen…',
    invalid: 'Diese Nummer scheint unvollständig zu sein — bitte prüfen.',
    landline: 'Das sieht nach einem Festnetzanschluss aus. Für Rückfragen unterwegs bitte eine Mobilnummer angeben.',
    countryLabel: 'Ländervorwahl',
    noResults: 'Kein Land gefunden',
  },
  en: {
    search: 'Search country…',
    invalid: 'This number looks incomplete — please check it.',
    landline: 'That looks like a landline. Please give a mobile number so the driver can reach you.',
    countryLabel: 'Country code',
    noResults: 'No country found',
  },
  tr: {
    search: 'Ülke ara…',
    invalid: 'Bu numara eksik görünüyor — lütfen kontrol edin.',
    landline: 'Bu bir sabit hat gibi görünüyor. Şoförün size ulaşabilmesi için cep numarası girin.',
    countryLabel: 'Ülke kodu',
    noResults: 'Ülke bulunamadı',
  },
} as const;

export default function PhoneInput({
  value,
  onChange,
  country,
  onCountryChange,
  result,
  locale,
  errorText,
  statusEnabled = true,
  placeholder = '151 41620000',
}: Props) {
  const tx = TX[(locale as keyof typeof TX)] ?? TX.de;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [touched, setTouched] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const countries = useMemo(() => getCountryOptions(locale), [locale]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(c => c.name.toLowerCase().includes(q) || c.callingCode.includes(q) || c.code.toLowerCase() === q);
  }, [countries, search]);

  const selected = countries.find(c => c.code === country);

  // Close on outside click or Escape — standard popover behaviour.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setHighlight(0);
      // Focus the filter box so the user can just start typing a country name.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  // Keep the keyboard-highlighted row inside the scroll viewport.
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.querySelector<HTMLElement>(`[data-idx="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  function pick(code: CountryCode) {
    onCountryChange(code);
    setOpen(false);
    // Reformat what's already typed for the newly chosen country.
    if (value) onChange(formatNational(value, code));
  }

  // A typed or pasted '+1 202…' / '0044 7911…' moves the selector to that country
  // rather than leaving a dial code sitting in a field that already shows one.
  function handleInput(raw: string) {
    const international = splitInternational(raw);
    if (international) {
      onCountryChange(international.country);
      onChange(international.national);
      return;
    }
    onChange(formatNational(raw, country));
  }

  function onSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = filtered[highlight];
      if (hit) pick(hit.code);
    }
  }

  const showInvalid = statusEnabled && touched && !errorText && value.trim().length > 0 && !result.ok;
  const showLandline = statusEnabled && !errorText && result.ok && !result.mobileLikely;
  const showValid = statusEnabled && !errorText && result.ok && result.mobileLikely;

  const borderTone = errorText
    ? 'border-red-400'
    : showInvalid
      ? 'border-amber-400'
      : showValid
        ? 'border-emerald-300'
        : 'border-gray-200';

  return (
    <div ref={wrapRef} className="relative">
      {/* One bordered shell around both controls so it reads as a single field. */}
      <div
        className={cn(
          'flex items-stretch rounded-xl border bg-white transition-colors',
          'focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-primary-400',
          borderTone,
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={tx.countryLabel}
          className="flex items-center gap-1 pl-3 pr-2 py-3 text-sm font-medium text-gray-700 hover:text-primary-600 rounded-l-xl focus:outline-none shrink-0"
        >
          <span className="tabular-nums">{selected?.callingCode ?? '+49'}</span>
          <ChevronDown size={14} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
        </button>

        <span className="w-px my-2 bg-gray-200 shrink-0" aria-hidden="true" />

        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value}
          onChange={e => handleInput(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent px-3 py-3 text-sm text-gray-900 rounded-r-xl focus:outline-none"
        />

        {showValid && (
          <span className="flex items-center pr-3 text-emerald-500 shrink-0" aria-hidden="true">
            <Check size={16} />
          </span>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full sm:w-80 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => { setSearch(e.target.value); setHighlight(0); }}
              onKeyDown={onSearchKeyDown}
              placeholder={tx.search}
              className="w-full bg-transparent text-sm text-gray-900 focus:outline-none"
            />
          </div>
          <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.map((c, i) => (
              <li key={c.code} data-idx={i}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.code === country}
                  onClick={() => pick(c.code)}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm',
                    i === highlight ? 'bg-primary-50' : 'bg-transparent',
                    c.code === country ? 'font-medium text-primary-600' : 'text-gray-700',
                  )}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="tabular-nums text-gray-400 shrink-0">{c.callingCode}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-gray-400">{tx.noResults}</li>
            )}
          </ul>
        </div>
      )}

      {/* Exactly one line below the field, in priority order: hard error, then advisory. */}
      {errorText ? (
        <p className="text-red-500 text-xs mt-1">{errorText}</p>
      ) : showInvalid ? (
        <p className="flex items-start gap-1 text-amber-600 text-xs mt-1">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{tx.invalid}</span>
        </p>
      ) : showLandline ? (
        <p className="flex items-start gap-1 text-amber-600 text-xs mt-1">
          <Phone size={12} className="mt-0.5 shrink-0" />
          <span>{tx.landline}</span>
        </p>
      ) : showValid ? (
        <p className="text-gray-400 text-xs mt-1 tabular-nums">{result.formatted}</p>
      ) : null}
    </div>
  );
}
