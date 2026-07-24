'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Search, MapPin, Calendar, Users, Car, CreditCard, Ban, CheckCircle2, AlertTriangle, Phone, Loader2 } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

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
  price: number;
  payment_method: string;
  trip_type?: string;
  return_datetime?: string;
  can_cancel_free: boolean;
  rechnung_number?: string | null;
  rechnung_sent_at?: string | null;
}

type LookupState = 'idle' | 'loading' | 'error' | 'found';

export default function ManageBookingClient() {
  const t = useTranslations('manageBooking');
  const tVehicles = useTranslations('vehicles');
  const locale = useLocale();

  const [bookingNumber, setBookingNumber] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<LookupState>('idle');
  const [errorKey, setErrorKey] = useState<'errorNotFound' | 'errorGeneric'>('errorGeneric');
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
    try {
      const res = await fetch(`${API_URL}/bookings/manage/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_number: bookingNumber.trim(), email: email.trim() }),
      });
      if (!res.ok) {
        setErrorKey(res.status === 404 ? 'errorNotFound' : 'errorGeneric');
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
                {booking.can_cancel_free ? (
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
