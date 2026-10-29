'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Search, MapPin, Calendar, Users, Car, CreditCard, Ban, CheckCircle2, AlertTriangle, Phone, Loader2, FileDown, Pencil, Minus, Plus, Luggage, ArrowLeftRight } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';
import { returnLeg } from '@/lib/returnLeg';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

interface ManagedBooking {
  booking_number: string;
  status: 'new' | 'confirmed' | 'completed' | 'cancelled';
  pickup_address: string;
  dropoff_address: string;
  pickup_datetime: string;
  vehicle_type: 'kombi' | 'van' | 'grossraumtaxi';
  passengers: number;
  luggage_count?: number;
  price: number;
  payment_method: string;
  trip_type?: string;
  return_datetime?: string;
  return_pickup_address?: string | null;
  return_dropoff_address?: string | null;
  can_cancel_free: boolean;
  /** Nacht-Stornierung: Fahrt beginnt, bevor wir morgens wach sind → nur telefonisch */
  night_phone_required?: boolean;
  rechnung_number?: string | null;
  rechnung_sent_at?: string | null;
  /** Selbst ändern (Abholzeit, Personen, Gepäck) — null, wenn der Server es nicht liefert */
  edit?: ManageEdit | null;
}

interface ManageEdit {
  enabled: boolean;
  /** Änderungen bis so viele Stunden vor der Abholung */
  hours: number;
  can_edit: boolean;
  /** Datum/Uhrzeit nur telefonisch: Nachtfenster bzw. Rabatt hängt am Fahrtdatum */
  time_phone_only: 'night' | 'discount' | null;
  max_passengers: number;
  max_luggage: number;
}

// Antwortcodes von POST /bookings/manage/update → Übersetzungsschlüssel
const EDIT_ERROR_KEYS: Record<string, string> = {
  invalid_datetime: 'editErrorDatetime',
  pickup_too_soon: 'editErrorTooSoon',
  pickup_too_far: 'editErrorTooFar',
  return_before_pickup: 'editErrorReturn',
  edit_window_closed: 'editWindowClosedText',
  edit_disabled: 'editErrorDisabled',
  night_phone_required: 'editTimeNightText',
  time_locked: 'editTimeLockedText',
  too_many_attempts: 'errorTooMany',
};

type LookupState = 'idle' | 'loading' | 'error' | 'found';

export default function ManageBookingClient() {
  const t = useTranslations('manageBooking');
  const tVehicles = useTranslations('vehicles');
  const locale = useLocale();

  const [bookingNumber, setBookingNumber] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<LookupState>('idle');
  const [errorKey, setErrorKey] = useState<'errorNotFound' | 'errorGeneric' | 'errorTooMany'>('errorGeneric');
  const [booking, setBooking] = useState<ManagedBooking | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [invoiceState, setInvoiceState] = useState<'idle' | 'loading' | 'error'>('idle');

  const dateLocale = locale === 'en' ? 'en-GB' : locale === 'tr' ? 'tr-TR' : 'de-DE';

  function formatDateTime(iso: string): string {
    try {
      return new Date(iso).toLocaleString(dateLocale, {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function formatPrice(v: number): string {
    return `${Number(v).toFixed(2).replace('.', ',')} €`;
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingNumber.trim() || !email.trim()) return;
    setState('loading');
    setCancelResult('idle');
    setConfirming(false);
    setEditing(false);
    setEditSuccess(false);
    setEditError(null);
    try {
      const res = await fetch(`${API_URL}/bookings/manage/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_number: bookingNumber.trim(), email: email.trim() }),
      });
      if (!res.ok) {
        setErrorKey(res.status === 404 ? 'errorNotFound' : res.status === 429 ? 'errorTooMany' : 'errorGeneric');
        setState('error');
        return;
      }
      const data = await res.json();
      setBooking(data);
      setState('found');
    } catch {
      setErrorKey('errorGeneric');
      setState('error');
    }
  }

  // Nacht-Stornierung: Server warnt das Büro per E-Mail; der Kunde muss anrufen (WhatsApp wird nachts evtl. nicht gelesen)
  const [nightNotified, setNightNotified] = useState(false);
  function notifyNightCancel() {
    if (!booking || nightNotified) return;
    setNightNotified(true);
    fetch(`${API_URL}/bookings/manage/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_number: booking.booking_number, email: email.trim() }),
      keepalive: true,
    }).catch(() => {});
  }

  async function handleCancel() {
    if (!booking) return;
    setCancelling(true);
    try {
      const res = await fetch(`${API_URL}/bookings/manage/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_number: booking.booking_number, email: email.trim() }),
      });
      if (!res.ok) {
        // Seite war vor Beginn des Nachtfensters geladen: jetzt gilt „nur telefonisch“
        const data = await res.json().catch(() => ({}));
        if (data?.error === 'night_phone_required') {
          setBooking({ ...booking, night_phone_required: true });
          setNightNotified(true);
          setConfirming(false);
          setCancelling(false);
          return;
        }
        setCancelResult('error');
        setCancelling(false);
        return;
      }
      setBooking({ ...booking, status: 'cancelled', can_cancel_free: false });
      setCancelResult('success');
      setConfirming(false);
    } catch {
      setCancelResult('error');
    } finally {
      setCancelling(false);
    }
  }

  // Fetched as a blob rather than linked directly, so the email stays out of the URL
  // (and therefore out of access logs, history and Referer headers).
  async function handleDownloadInvoice() {
    if (!booking) return;
    setInvoiceState('loading');
    try {
      const res = await fetch(`${API_URL}/bookings/manage/rechnung`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_number: booking.booking_number, email: email.trim() }),
      });
      if (!res.ok) { setInvoiceState('error'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rechnung_${booking.rechnung_number || booking.booking_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setInvoiceState('idle');
    } catch {
      setInvoiceState('error');
    }
  }

  function resetSearch() {
    setState('idle');
    setBooking(null);
    setCancelResult('idle');
    setConfirming(false);
    setInvoiceState('idle');
    setEditing(false);
    setEditSuccess(false);
    setEditError(null);
  }

  // ── Fahrt ändern: Abholzeit, Personen, Gepäck ──
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPassengers, setEditPassengers] = useState(1);
  const [editLuggage, setEditLuggage] = useState(0);
  const [capHit, setCapHit] = useState<'passengers' | 'luggage' | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<{ key: string; n?: number } | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);
  const [editMailSent, setEditMailSent] = useState(true);

  const editStamp = (iso: string) => String(iso).replace(' ', 'T');

  function startEditing() {
    if (!booking) return;
    const iso = editStamp(booking.pickup_datetime);
    setEditDate(iso.slice(0, 10));
    setEditTime(iso.slice(11, 16));
    setEditPassengers(booking.passengers);
    setEditLuggage(booking.luggage_count || 0);
    setCapHit(null);
    setEditError(null);
    setEditSuccess(false);
    setEditing(true);
  }

  const currentIso = booking ? editStamp(booking.pickup_datetime) : '';
  const timeChanged = !!booking && !!editDate && !!editTime
    && `${editDate}T${editTime}` !== currentIso.slice(0, 16);
  const countsChanged = !!booking
    && (editPassengers !== booking.passengers || editLuggage !== (booking.luggage_count || 0));
  // Heutiges Datum in München (nicht Browser-Zeitzone) — Untergrenze des Datumsfelds
  const todayMunich = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

  async function handleSaveEdit() {
    if (!booking) return;
    setSaving(true);
    setEditError(null);
    try {
      const body: Record<string, unknown> = { booking_number: booking.booking_number, email: email.trim() };
      if (timeChanged) body.pickup_datetime = `${editDate}T${editTime}`;
      if (editPassengers !== booking.passengers) body.passengers = editPassengers;
      if (editLuggage !== (booking.luggage_count || 0)) body.luggage_count = editLuggage;
      const res = await fetch(`${API_URL}/bookings/manage/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === 'capacity_exceeded') {
          setEditError({ key: data.field === 'luggage_count' ? 'editCapacityLuggageMax' : 'editCapacityPassengersMax', n: data.max });
        } else {
          setEditError({ key: EDIT_ERROR_KEYS[data?.error] || 'editErrorGeneric', n: data?.hours });
        }
        return;
      }
      setBooking(data.booking);
      setEditing(false);
      setEditMailSent(data.confirmation_mail !== false);
      setEditSuccess(true);
    } catch {
      setEditError({ key: 'editErrorGeneric' });
    } finally {
      setSaving(false);
    }
  }

  const vehicleName = booking ? tVehicles(`${booking.vehicle_type}.name`) : '';

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 text-center">
          <span className="inline-block bg-white/10 text-gold-300 text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full mb-4">
            {t('badge')}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{t('title')}</h1>
          <p className="text-primary-100 max-w-xl mx-auto">{t('subtitle')}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 pb-16">
        {/* Search card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('formBookingNumber')}</label>
              <input
                type="text"
                required
                value={bookingNumber}
                onChange={(e) => setBookingNumber(e.target.value)}
                placeholder={t('formBookingNumberPlaceholder')}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('formEmail')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('formEmailPlaceholder')}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={state === 'loading'}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
            >
              {state === 'loading' ? (
                <><Loader2 size={16} className="animate-spin" /> {t('lookupLoading')}</>
              ) : (
                <><Search size={16} /> {t('lookupButton')}</>
              )}
            </button>
          </form>

          {state === 'error' && (
            <div className="mt-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 flex items-start gap-2">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{t(errorKey)}</span>
            </div>
          )}
        </div>

        {/* Result card */}
        {state === 'found' && booking && (
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mt-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">{t('resultTitle')}</h2>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                booking.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                'bg-green-100 text-green-700'
              }`}>
                {t(`status.${booking.status}`)}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-primary-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-gray-400 text-xs">{t('pickupLabel')}</p>
                  <p className="text-gray-800 font-medium">{booking.pickup_address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-gold-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-gray-400 text-xs">{t('dropoffLabel')}</p>
                  <p className="text-gray-800 font-medium">{booking.dropoff_address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-primary-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-gray-400 text-xs">{t('datetimeLabel')}</p>
                  <p className="text-gray-800 font-medium">{formatDateTime(booking.pickup_datetime)}</p>
                </div>
              </div>
              {booking.trip_type === 'roundtrip' && booking.return_datetime && (
                <div className="flex items-start gap-3">
                  <ArrowLeftRight size={16} className="text-primary-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-gray-400 text-xs">{t('returnLabel')}</p>
                    <p className="text-gray-800 font-medium">{formatDateTime(booking.return_datetime)}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{returnLeg(booking).from} → {returnLeg(booking).to}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <Car size={16} className="text-primary-600 shrink-0" />
                  <div>
                    <p className="text-gray-400 text-xs">{t('vehicleLabel')}</p>
                    <p className="text-gray-800 font-medium">{vehicleName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-primary-600 shrink-0" />
                  <div>
                    <p className="text-gray-400 text-xs">{t('passengersLabel')}</p>
                    <p className="text-gray-800 font-medium">{booking.passengers}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Luggage size={16} className="text-primary-600 shrink-0" />
                  <div>
                    <p className="text-gray-400 text-xs">{t('luggageLabel')}</p>
                    <p className="text-gray-800 font-medium">{booking.luggage_count || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-primary-600 shrink-0" />
                  <div>
                    <p className="text-gray-400 text-xs">{t('paymentLabel')}</p>
                    <p className="text-gray-800 font-medium">{booking.payment_method === 'card' ? t('paymentCard') : t('paymentCash')}</p>
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('priceLabel')}</p>
                  <p className="text-gray-900 font-bold text-lg">{formatPrice(booking.price)}</p>
                </div>
              </div>
            </div>

            {/* Fahrt ändern: Abholzeit, Personen, Gepäck — bis booking.edit.hours vor der Abholung */}
            {booking.edit?.enabled && booking.status !== 'cancelled' && booking.status !== 'completed' && cancelResult !== 'success' && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h3 className="font-bold text-gray-900 mb-2">{t('editSectionTitle')}</h3>

                {editSuccess && (
                  <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 flex items-start gap-2">
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> <span>{t(editMailSent ? 'editSuccess' : 'editSuccessShort')}</span>
                  </div>
                )}

                {!booking.edit.can_edit ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                    <p className="flex items-start gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> <span>{t('editWindowClosedText', { hours: booking.edit.hours })}</span></p>
                    <a href={CONTACT_INFO.phoneHref}
                      className="mt-3 inline-flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white font-semibold px-4 py-2.5 rounded-lg">
                      <Phone size={15} /> {t('nightCancelCall')} · {CONTACT_INFO.phone}
                    </a>
                  </div>
                ) : !editing ? (
                  <>
                    <p className="text-sm text-gray-500 mb-4 flex items-start gap-2">
                      <Pencil size={14} className="text-primary-600 shrink-0 mt-0.5" /> <span>{t('editHint', { hours: booking.edit.hours })}</span>
                    </p>
                    <button
                      onClick={startEditing}
                      className="w-full border-2 border-primary-600 text-primary-700 hover:bg-primary-50 font-bold px-6 py-3 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Pencil size={16} /> {t('editButton')}
                    </button>
                  </>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-5">
                    {/* Datum & Uhrzeit — nachts / bei tagesabhängigem Rabatt nur telefonisch */}
                    {booking.edit.time_phone_only ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                        <p className="font-semibold flex items-center gap-2"><AlertTriangle size={16} className="shrink-0" /> {t('editTimePhoneTitle')}</p>
                        <p className="mt-1.5 text-amber-800">{t(booking.edit.time_phone_only === 'night' ? 'editTimeNightText' : 'editTimeLockedText')}</p>
                        <a href={CONTACT_INFO.phoneHref}
                          className="mt-3 inline-flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white font-semibold px-4 py-2.5 rounded-lg">
                          <Phone size={15} /> {t('nightCancelCall')} · {CONTACT_INFO.phone}
                        </a>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                          <Calendar size={15} className="text-primary-600" /> {t('datetimeLabel')}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1" htmlFor="edit-date">{t('editDateLabel')}</label>
                            <input id="edit-date" type="date" value={editDate} min={todayMunich}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1" htmlFor="edit-time">{t('editTimeLabel')}</label>
                            <input id="edit-time" type="time" value={editTime}
                              onChange={(e) => setEditTime(e.target.value)}
                              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Personen & Gepäck — nie über die Kapazität des gebuchten Fahrzeugs */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                          <Users size={15} className="text-primary-600" /> {t('passengersLabel')}
                        </p>
                        <div className="inline-flex items-stretch border border-gray-300 rounded-xl bg-white overflow-hidden">
                          <button type="button" aria-label="−" disabled={editPassengers <= 1}
                            onClick={() => { setCapHit(null); setEditPassengers(p => Math.max(1, p - 1)); }}
                            className="w-10 h-10 flex items-center justify-center text-gray-800 hover:bg-gray-50 disabled:opacity-30"><Minus size={16} /></button>
                          <span className="w-10 flex items-center justify-center font-semibold text-gray-900">{editPassengers}</span>
                          <button type="button" aria-label="+"
                            onClick={() => {
                              if (editPassengers >= booking.edit!.max_passengers) { setCapHit('passengers'); return; }
                              setCapHit(null); setEditPassengers(p => p + 1);
                            }}
                            className={`w-10 h-10 flex items-center justify-center text-gray-800 hover:bg-gray-50 ${editPassengers >= booking.edit.max_passengers ? 'opacity-30' : ''}`}><Plus size={16} /></button>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                          <Luggage size={15} className="text-primary-600" /> {t('luggageLabel')}
                        </p>
                        <div className="inline-flex items-stretch border border-gray-300 rounded-xl bg-white overflow-hidden">
                          <button type="button" aria-label="−" disabled={editLuggage <= 0}
                            onClick={() => { setCapHit(null); setEditLuggage(l => Math.max(0, l - 1)); }}
                            className="w-10 h-10 flex items-center justify-center text-gray-800 hover:bg-gray-50 disabled:opacity-30"><Minus size={16} /></button>
                          <span className="w-10 flex items-center justify-center font-semibold text-gray-900">{editLuggage}</span>
                          <button type="button" aria-label="+"
                            onClick={() => {
                              if (editLuggage >= booking.edit!.max_luggage) { setCapHit('luggage'); return; }
                              setCapHit(null); setEditLuggage(l => l + 1);
                            }}
                            className={`w-10 h-10 flex items-center justify-center text-gray-800 hover:bg-gray-50 ${editLuggage >= booking.edit.max_luggage ? 'opacity-30' : ''}`}><Plus size={16} /></button>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 -mt-2">
                      {t('editCapacityInfo', { vehicle: vehicleName, passengers: booking.edit.max_passengers, luggage: booking.edit.max_luggage })}
                    </p>
                    {capHit && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-start gap-2">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span>{t(capHit === 'passengers' ? 'editCapacityPassengersMax' : 'editCapacityLuggageMax', { n: capHit === 'passengers' ? booking.edit.max_passengers : booking.edit.max_luggage })}</span>
                      </div>
                    )}

                    {editError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-start gap-2">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span>{t(editError.key, { n: editError.n ?? 0, hours: editError.n ?? 0 })}</span>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving || (!timeChanged && !countsChanged) || (!!booking.edit.time_phone_only && !countsChanged)}
                        className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-lg text-sm inline-flex items-center justify-center gap-2"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                        {saving ? t('editSaving') : t('editSave')}
                      </button>
                      <button
                        onClick={() => { setEditing(false); setEditError(null); setCapHit(null); }}
                        disabled={saving}
                        className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-100 font-semibold px-4 py-2.5 rounded-lg text-sm"
                      >
                        {t('editClose')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cancellation */}
            {booking.status === 'cancelled' ? (
              <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 flex items-center gap-2">
                <Ban size={16} className="text-gray-400" /> {t('alreadyCancelled')}
              </div>
            ) : booking.status === 'completed' ? (
              <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-gray-400" /> {t('alreadyCompleted')}
              </div>
            ) : cancelResult === 'success' ? (
              <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" /> {t('cancelSuccess')}
              </div>
            ) : (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h3 className="font-bold text-gray-900 mb-2">{t('cancelSectionTitle')}</h3>
                {booking.can_cancel_free && booking.night_phone_required ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                    <p className="font-semibold flex items-center gap-2"><AlertTriangle size={16} className="shrink-0" /> {t('nightCancelTitle')}</p>
                    <p className="mt-1.5 text-amber-800">{t('nightCancelText')}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <a href={CONTACT_INFO.phoneHref} onClick={notifyNightCancel}
                        className="inline-flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white font-semibold px-4 py-2.5 rounded-lg">
                        <Phone size={15} /> {t('nightCancelCall')} · {CONTACT_INFO.phone}
                      </a>
                    </div>
                    {nightNotified && (
                      <p className="mt-3 text-xs text-green-700 flex items-center gap-1.5"><CheckCircle2 size={13} /> {t('nightCancelNotified')}</p>
                    )}
                  </div>
                ) : booking.can_cancel_free ? (
                  <>
                    <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
                      <Ban size={14} className="text-green-600" /> {t('cancelFreeText')}
                    </p>
                    {cancelResult === 'error' && (
                      <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
                        {t('cancelError')}
                      </div>
                    )}
                    {!confirming ? (
                      <button
                        onClick={() => setConfirming(true)}
                        className="w-full border-2 border-red-500 text-red-600 hover:bg-red-50 font-bold px-6 py-3 rounded-xl transition-colors"
                      >
                        {t('cancelButton')}
                      </button>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <p className="text-sm text-red-800 mb-3">{t('cancelConfirmPrompt')}</p>
                        <div className="flex gap-3">
                          <button
                            onClick={handleCancel}
                            disabled={cancelling}
                            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-4 py-2.5 rounded-lg text-sm inline-flex items-center justify-center gap-2"
                          >
                            {cancelling ? <Loader2 size={14} className="animate-spin" /> : null}
                            {cancelling ? t('cancelling') : t('cancelConfirmYes')}
                          </button>
                          <button
                            onClick={() => setConfirming(false)}
                            disabled={cancelling}
                            className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 font-semibold px-4 py-2.5 rounded-lg text-sm"
                          >
                            {t('cancelConfirmNo')}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 flex items-start gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{t('cancelWindowClosedText')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Invoice download — only once it has actually been sent, and never for a
                cancelled ride (the backend rejects those too; see /manage/rechnung) */}
            {booking.rechnung_number && booking.status !== 'cancelled' && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h3 className="font-bold text-gray-900 mb-2">{t('invoiceSectionTitle')}</h3>
                <p className="text-sm text-gray-500 mb-4">{t('invoiceHint')}</p>
                {invoiceState === 'error' && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
                    {t('invoiceError')}
                  </div>
                )}
                <button
                  onClick={handleDownloadInvoice}
                  disabled={invoiceState === 'loading'}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
                >
                  {invoiceState === 'loading' ? (
                    <><Loader2 size={16} className="animate-spin" /> {t('invoiceDownloading')}</>
                  ) : (
                    <><FileDown size={16} /> {t('invoiceDownload')}</>
                  )}
                </button>
                <p className="mt-2 text-xs text-gray-400 text-center">
                  {booking.rechnung_number}
                  {booking.rechnung_sent_at ? ` · ${formatDateTime(booking.rechnung_sent_at)}` : ''}
                </p>
              </div>
            )}

            <button
              onClick={resetSearch}
              className="mt-6 text-sm font-semibold text-primary-600 hover:text-primary-700"
            >
              {t('newSearch')}
            </button>
          </div>
        )}

        {/* Contact hint */}
        <div className="mt-8 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
          <Phone size={14} className="text-primary-600" />
          <span>{t('contactHint')}</span>
        </div>
        <div className="mt-3 text-center">
          <a href={CONTACT_INFO.phoneHref} className="font-bold text-primary-600 hover:text-primary-700">
            {CONTACT_INFO.phone}
          </a>
        </div>
      </div>
    </div>
  );
}
