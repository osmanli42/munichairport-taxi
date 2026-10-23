'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { adminApi, pricesApi, settingsApi, plzSurchargesApi, fixedRoutesApi, Booking, Price, PlzSurcharge, FixedRoute, CalendarStats } from '@/lib/api';
import { formatPrice, formatDateTime, cn } from '@/lib/utils';
import { waNumber, parsePhone } from '@/lib/phone';
import {
  LogIn, LogOut, BarChart3, List, Tag, RefreshCw, ChevronLeft, ChevronRight,
  TrendingUp, Calendar, Check, X, Search, Lock, Eye, PieChart, FileText, Building2, Send,
  Mail, Upload, Users, BadgePercent, Activity, Flame, Server, Play, MousePointerClick, MapPin, Pencil, Plus,
  Zap, CheckCircle2, AlertCircle, CalendarDays, Percent, Car, ShieldCheck,
  Settings, Settings2, Route, Milestone, Moon, Plane, Megaphone, Workflow, Landmark, Clock, Phone, Ban, CarFront,
  ClipboardList, Bike, Save, Trash2, Bell,
} from 'lucide-react';
import LiveVisitorsTab from '@/components/LiveVisitorsTab';
import HeatmapTab from '@/components/HeatmapTab';
import SystemTab from '@/components/SystemTab';
import ReplayTab from '@/components/ReplayTab';
import { InvoiceCustomerBookingCard, InvoiceCustomersList } from '@/components/InvoiceCustomerAdmin';
import { Toggle, SectionCard, SettingCard, Field, BlockField, HourSelect, SectionNav } from '@/components/admin/SettingsUI';
import AdminShell from '@/components/admin/AdminShell';
import SeoTab from '@/components/SeoTab';
import AdsTab from '@/components/AdsTab';
import PflichtgebietTab from '@/components/PflichtgebietTab';
import B2BTab from '@/components/B2BTab';
import KalenderTab from '@/components/KalenderTab';
import CancelBookingDialog, { CancelPayload } from '@/components/booking/CancelBookingDialog';
import InvoiceStornoCard from '@/components/booking/InvoiceStornoCard';
import StornoRegister from '@/components/booking/StornoRegister';
import ResendAdminMailButton from '@/components/booking/ResendAdminMailButton';
import MarketingTab from '@/components/marketing/MarketingTab';
import FinalConfirmButton from '@/components/booking/FinalConfirmButton';
import { GutscheinButton } from '@/components/discount/PersonalLinkPanel';
import AdminAddressField from '@/components/AdminAddressField';
import RabatteTab from '@/components/RabatteTab';
import DriversTab from '@/components/DriversTab';
import DashboardTab from '@/components/DashboardTab';
import CalendarRevenuePanel from '@/components/CalendarRevenuePanel';
import BookingTrackingPanel from '@/components/tracking/BookingTrackingPanel';
import TrackingAlerts from '@/components/tracking/TrackingAlerts';

type Tab = 'dashboard' | 'bookings' | 'prices' | 'pflichtgebiet' | 'statistics' | 'rechnung' | 'marketing' | 'promotions' | 'rabatte' | 'live' | 'heatmap' | 'replay' | 'system' | 'seo' | 'ads' | 'b2b' | 'kalender' | 'fahrer';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  confirmed: 'Bestätigt',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};


// Display labels for bookings.payment_method. Kept in one place because the raw column
// holds English codes ('cash' | 'card' | 'ueberweisung' | 'rechnung' | 'invoice') while
// the admin UI is German — the old inline `=== 'cash' ? 'Bargeld' : 'Karte'` ternary
// mislabelled every non-cash value as "Karte".
const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Bargeld',
  card: 'Karte',
  ueberweisung: 'Überweisung',
  rechnung: 'Auf Rechnung',
  invoice: 'Auf Rechnung',
  // Legacy spelling from an old Kalender import (one historical booking) — labelled
  // so it does not show up as the raw column value.
  transfer: 'Überweisung',
};
const paymentLabel = (method?: string | null): string => PAYMENT_LABELS[method || 'cash'] || method || '—';

// Payment deadline shown for a proforma: one day before pickup, never in the past.
// Mirrors proformaDueDate() in backend/src/services/rechnungSender.ts, which is what
// actually lands on the PDF — this is only the preview in the dialog.
const proformaDueDate = (pickup?: string | null): Date => {
  const today = new Date();
  if (!pickup) return today;
  const p = new Date(pickup);
  if (isNaN(p.getTime())) return today;
  const due = new Date(p);
  due.setDate(due.getDate() - 1);
  return due.getTime() < today.getTime() ? today : due;
};

// When autoRechnungJob will mail the invoice for a booking. Mirrors the cron's own rule
// (services/autoRechnungJob.ts): pickup + estimated ride duration + a 15 min buffer.
// pickup_datetime is Berlin wall-clock text, so it is parsed as local time — the same way
// formatDateTime renders every other time in this panel.
function autoRechnungSendAt(booking: Booking): Date | null {
  const raw = String(booking.pickup_datetime || '').replace(' ', 'T');
  const pickup = new Date(raw);
  if (isNaN(pickup.getTime())) return null;
  return new Date(pickup.getTime() + ((Number(booking.duration_minutes) || 0) + 15) * 60000);
}

// Whether autoRechnungJob will invoice this ride because of the per-payment-method switches
// in the Rechnung tab (not because the customer asked). Mirrors the cron's rule so the admin
// shows "wird automatisch gesendet" for exactly the rides that will get one: switch on, no
// company (B2B is billed via Sammelrechnung), confirmed/completed, card charge not failed,
// and the ride ending after the switch was turned on (*_since, Berlin wall clock).
function autoRechnungViaZahlungsart(booking: Booking, settings: Record<string, string>): 'card' | 'cash' | null {
  const pm = booking.payment_method === 'card' ? 'card' : booking.payment_method === 'cash' ? 'cash' : null;
  if (!pm || booking.company_id) return null;
  if (settings[`auto_rechnung_${pm}_enabled`] !== '1') return null;
  if (booking.status !== 'confirmed' && booking.status !== 'completed') return null;
  if (pm === 'card' && booking.charge_status === 'failed') return null;
  const since = new Date(String(settings[`auto_rechnung_${pm}_since`] || '').replace(' ', 'T'));
  const end = autoRechnungSendAt(booking);
  if (!end || isNaN(since.getTime())) return null;
  return end.getTime() >= since.getTime() ? pm : null;
}

const EMPTY_BOOKING_FILTERS = { status: '', vehicle_type: '', search: '', date_from: '', date_to: '', payment: '', customer: '', rechnung: '', paid: '', source: '', trip: '', repeat: '', same_as: '', same_as_label: '', sort: '' };

// Nacht-Stornierung: <input type="time"> braucht HH:MM (ältere Werte waren ganze Stunden wie "22")
const toClock = (v: string | undefined, fallback: string): string => {
  const m = String(v ?? '').trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  return m ? `${m[1].padStart(2, '0')}:${m[2] ?? '00'}` : fallback;
};

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  // 2FA second step: set when the password was right and a TOTP code is still needed
  const [mfa, setMfa] = useState<{ token: string; code: string; recovery: boolean; remember: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  // Replay derin bağlantısı (?tab=replay&replay=<session>&t=<sn>) doğrudan o sekmeyi açar
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'replay') setActiveTab('replay');
  }, []);
  const [kalenderOpenCount, setKalenderOpenCount] = useState<number | null>(null);
  const [seoDueCount, setSeoDueCount] = useState<number | null>(null);
  const [marketingDueCount, setMarketingDueCount] = useState<number | null>(null);
  const [adsDueCount, setAdsDueCount] = useState<number | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pagination, setPagination] = useState<{ total: number; page: number; pages: number; total_price?: number }>({ total: 0, page: 1, pages: 1 });
  const [prices, setPrices] = useState<Price[]>([]);
  const [filters, setFilters] = useState({ status: '', vehicle_type: '', search: '', date_from: '', date_to: '', payment: '', customer: '', rechnung: '', paid: '', source: '', trip: '', repeat: '', same_as: '', same_as_label: '', sort: '' });
  const [loading, setLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Booking>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);
  const [editError, setEditError] = useState('');
  const [editPickupValid, setEditPickupValid] = useState('');
  const [editDropoffValid, setEditDropoffValid] = useState('');
  const [editPickupCoords, setEditPickupCoords] = useState<{lat: number, lng: number} | null>(null);
  const [editDropoffCoords, setEditDropoffCoords] = useState<{lat: number, lng: number} | null>(null);
  // Confirmed (autocomplete-selected) Zwischenstopp address — null means no stopover,
  // so the price recalc below falls back to the direct pickup→dropoff route.
  const [editZwischenstoppValid, setEditZwischenstoppValid] = useState<string | null>(null);
  const [editDistanceKm, setEditDistanceKm] = useState<number | null>(null);
  const [editPriceCalcLoading, setEditPriceCalcLoading] = useState(false);
  const [editBaseTripPrice, setEditBaseTripPrice] = useState<number | null>(null);
  // Guards the auto-recalc effect below: opening the edit modal seeds
  // editPickupValid/editDropoffValid from the existing booking, which would
  // otherwise trigger a fresh price calculation and silently overwrite a price
  // that already has manual discounts/surcharges baked in. Only real user edits
  // (address re-select, vehicle type change) arm it. Always armed for new bookings.
  const [editRecalcArmed, setEditRecalcArmed] = useState(false);
  const [editChildSeatBabyschale, setEditChildSeatBabyschale] = useState(0);
  const [editChildSeatKindersitz, setEditChildSeatKindersitz] = useState(0);
  const [editChildSeatSitzerhoehung, setEditChildSeatSitzerhoehung] = useState(0);
  const [priceEdits, setPriceEdits] = useState<Record<string, { base_price: string; price_per_km: string; roundtrip_discount: string; fahrrad_price: string; fahrrad_enabled: boolean; max_passengers: string; max_luggage: string; min_price: string; min_price_km: string }>>({});
  const [priceSuccess, setPriceSuccess] = useState('');
  // Legacy raw-card reveal (pre-Stripe-tokenization bookings only — new bookings use
  // stripe_payment_method_id + the unified charge-card button instead). Remove once all
  // legacy card bookings have been manually processed.
  const [showCardPopup, setShowCardPopup] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({ stadtfahrt_enabled: '0', anfahrt_price_per_km: '1.70', zwischenstopp_enabled: '0', plz_surcharge_enabled: '0', min_advance_hours: '1.5', night_confirm_enabled: '1', night_confirm_start: '22', night_confirm_end: '7', night_confirm_ride_until: '9', night_cancel_enabled: '1', night_cancel_start: '20:30', night_cancel_end: '08:30', flight_validation_enabled: '1', phone_validation_enabled: '1', booking_form_restore_enabled: '1', auto_status_enabled: '0', auto_confirm_hours: '1', auto_complete_buffer_minutes: '0', auto_complete_include_company_charge: '0', experiment_checkout_v2: 'off', social_proof_enabled: '1' });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('18:00');
  const [reminderSaving, setReminderSaving] = useState(false);
  const [plzSurcharges, setPlzSurcharges] = useState<PlzSurcharge[]>([]);
  const [fixedRoutes, setFixedRoutes] = useState<FixedRoute[]>([]);
  const [editingRoute, setEditingRoute] = useState<Partial<FixedRoute> | null>(null);
  const [newPlz, setNewPlz] = useState('');
  const [newPlzStadt, setNewPlzStadt] = useState('');
  const [newPlzSurcharge, setNewPlzSurcharge] = useState('10');
  const [plzSaving, setPlzSaving] = useState(false);
  // Preise-Tab: geänderte, noch nicht gespeicherte Einstellungs-Schlüssel (gesammelt gespeichert)
  const [settingsDirty, setSettingsDirty] = useState<string[]>([]);
  const [editingPlz, setEditingPlz] = useState<{ id: number; stadt: string; surcharge: string } | null>(null);
  const [showPlzForm, setShowPlzForm] = useState(false);
  const [bankSettings, setBankSettings] = useState<Record<string, string>>({
    bank_name: '', bank_iban: '', bank_bic: '', bank_kontoinhaber: '',
    company_name: '', company_address: '', company_phone: '', company_email: '',
    company_steuernr: '', company_ustidnr: '',
  });
  const [bankSaving, setBankSaving] = useState(false);
  const [bankSuccess, setBankSuccess] = useState('');
  const [showRechnungModal, setShowRechnungModal] = useState(false);
  const [rechnungsnummer, setRechnungsnummer] = useState('');
  const [rechnungMwst, setRechnungMwst] = useState<0 | 7 | 19>(7);
  const [rechnungSprache, setRechnungSprache] = useState<'de' | 'en'>('de');
  const [rechnungEmpfaenger, setRechnungEmpfaenger] = useState('');
  const [editingEmpfaenger, setEditingEmpfaenger] = useState(false);
  const [rechnungZahlungsart, setRechnungZahlungsart] = useState<'ueberweisung' | 'bar' | 'kreditkarte'>('ueberweisung');
  const [rechnungSending, setRechnungSending] = useState(false);
  const [rechnungSuccess, setRechnungSuccess] = useState(false);
  const [rechnungError, setRechnungError] = useState('');
  // The same dialog serves both documents; 'proforma' hides the Zahlungsart picker
  // (a proforma is always the bank-transfer document) and shows the payment deadline.
  const [rechnungMode, setRechnungMode] = useState<'rechnung' | 'proforma'>('rechnung');
  // "Automatische Rechnung" block in the booking detail modal: arms the same
  // autoRechnungJob the booking form's tickbox arms, for customers who asked for an
  // invoice afterwards or never noticed the box.
  const [vormerkenAdresse, setVormerkenAdresse] = useState('');
  const [vormerkenSaving, setVormerkenSaving] = useState(false);
  const [vormerkenError, setVormerkenError] = useState('');
  const [ueberweisungSaving, setUeberweisungSaving] = useState(false);
  const [chargingId, setChargingId] = useState<number | null>(null);
  // Bumped whenever something the dashboard shows changed elsewhere (e.g. a card charge).
  const [dashboardTick, setDashboardTick] = useState(0);
  // Closing the detail modal may have changed a booking (status, payment…) — refresh.
  const hadSelection = useRef(false);
  useEffect(() => {
    if (selectedBooking) hadSelection.current = true;
    else if (hadSelection.current) { hadSelection.current = false; setDashboardTick((t) => t + 1); }
  }, [selectedBooking]);
  const [detailedStats, setDetailedStats] = useState<Record<string, unknown> | null>(null);
  // Google-Calendar-only rides for the Statistik tab (null = not loaded / not available).
  const [calStats, setCalStats] = useState<CalendarStats | null>(null);
  const [geoRange, setGeoRange] = useState<'today' | '7d' | '30d' | '6m' | 'all'>('30d');
  const [geoStats, setGeoStats] = useState<{ visitorCountries: any[]; visitorCities: any[] } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // Promotions state
  interface Promotion {
    id: number; code: string; type: 'fixed' | 'percent'; value: number;
    start_date: string; end_date: string; max_uses: number | null;
    used_count: number; active: number; description: string | null; kombinierbar: number; show_banner: number;
  }
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promoForm, setPromoForm] = useState({ code: '', type: 'fixed', value: '', start_date: '', end_date: '', max_uses: '', description: '', kombinierbar: false, show_banner: true });
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoMsg, setPromoMsg] = useState('');


  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      try {
        const payload = JSON.parse(atob(savedToken.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('admin_token');
          return;
        }
      } catch { /* malformed token → stay logged out */ }
      setToken(savedToken);
      setIsLoggedIn(true);
    }
  }, []);

  // Offene Rechnungsfahrten aus dem Kalender → Zahl am Kalender-Tab, damit keine Rechnung vergessen wird
  const refreshKalenderCount = useCallback(() => {
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/admin/calendar/open-count`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setKalenderOpenCount(typeof d?.count === 'number' ? d.count : null))
      .catch(() => {});
  }, [token]);

  // Fällige SEO-Aufgaben (z. B. monatlicher Backlink-CSV-Upload) → Zahl am SEO-Tab
  const refreshSeoDue = useCallback(() => {
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/admin/seo2/reminders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSeoDueCount(typeof d?.count === 'number' ? d.count : null))
      .catch(() => {});
  }, [token]);

  // Wöchentlicher Google-Ads-Report-Upload fällig → Zahl am Google-Ads-Tab
  const refreshAdsDue = useCallback(() => {
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/admin/ads/v2/reminders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAdsDueCount(typeof d?.count === 'number' ? d.count : null))
      .catch(() => {});
  }, [token]);

  // Offene Marketing-Anlässe (Ferien, Weihnachten, …) → Zahl am Marketing-Tab
  const refreshMarketingDue = useCallback(() => {
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/admin/marketing2/reminders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMarketingDueCount(typeof d?.count === 'number' && d.count > 0 ? d.count : null))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!isLoggedIn) return;
    refreshSeoDue();
    refreshAdsDue();
    refreshMarketingDue();
    const timer = setInterval(() => { refreshSeoDue(); refreshAdsDue(); refreshMarketingDue(); }, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isLoggedIn, refreshSeoDue, refreshAdsDue, refreshMarketingDue]);

  useEffect(() => {
    if (!isLoggedIn) return;
    refreshKalenderCount();
    const timer = setInterval(refreshKalenderCount, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isLoggedIn, refreshKalenderCount]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    try {
      const data = await adminApi.login(loginForm.username, loginForm.password);
      if (data.mfa_required && data.mfa_token) {
        setMfa({ token: data.mfa_token, code: '', recovery: false, remember: true });
        return;
      }
      if (!data.token) throw new Error('no token');
      localStorage.setItem('admin_token', data.token);
      setToken(data.token);
      setIsLoggedIn(true);
    } catch (err: any) {
      setLoginError(err?.response?.status === 429 ? (err.response.data?.error || 'Zu viele Versuche') : 'Ungültige Anmeldedaten');
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfa) return;
    setLoginError('');
    try {
      const data = await adminApi.login2fa({
        mfa_token: mfa.token,
        ...(mfa.recovery ? { recovery_code: mfa.code } : { code: mfa.code }),
        remember: mfa.remember,
      });
      try {
        if (data.device_token) localStorage.setItem('admin_trusted_device', data.device_token);
      } catch { /* private mode: just ask again next time */ }
      localStorage.setItem('admin_token', data.token);
      setMfa(null);
      setToken(data.token);
      setIsLoggedIn(true);
    } catch (err: any) {
      if (err?.response?.data?.code === 'MFA_EXPIRED') {
        setMfa(null);
        setLoginError('Die Anmeldung ist abgelaufen. Bitte erneut mit Passwort anmelden.');
        return;
      }
      setLoginError(err?.response?.data?.error || 'Code ungültig');
      setMfa((m) => (m ? { ...m, code: '' } : m));
    }
  }

  function handleLogout() {
    localStorage.removeItem('admin_token');
    setIsLoggedIn(false);
    setToken('');
  }


  const loadDetailedStats = useCallback(async () => {
    try {
      const [data, cal] = await Promise.all([adminApi.getStatistics(), adminApi.getCalendarStats().catch(() => null)]);
      setDetailedStats(data);
      setCalStats(cal);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadGeoStats = useCallback(async (range: 'today' | '7d' | '30d' | '6m' | 'all') => {
    setGeoLoading(true);
    try {
      const data = await adminApi.getVisitorGeoStats(range);
      setGeoStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setGeoLoading(false);
    }
  }, []);

  const loadBookings = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const { same_as_label: _label, ...query } = filters;
      const data = await adminApi.getBookings({ ...query, page, limit: 15 });
      setBookings(data.bookings);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Arms (or disarms) the automatic invoice for the open booking. The response carries
  // the updated row, so the detail modal and the list badge stay in step without a reload.
  const saveVormerken = async (enabled: boolean) => {
    if (!selectedBooking) return;
    setVormerkenSaving(true);
    setVormerkenError('');
    try {
      const r = await adminApi.setRechnungVormerken(selectedBooking.id, enabled, vormerkenAdresse);
      setSelectedBooking(r.booking);
      setVormerkenAdresse(r.booking.rechnung_adresse || '');
      loadBookings(pagination.page);
    } catch (err: any) {
      setVormerkenError(err.response?.data?.error || err.message || 'Konnte nicht gespeichert werden.');
    } finally {
      setVormerkenSaving(false);
    }
  };

  // Seed the address field whenever a different booking is opened, so the existing
  // detail-modal open handlers stay untouched.
  useEffect(() => {
    setVormerkenAdresse(selectedBooking?.rechnung_adresse || '');
    setVormerkenError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBooking?.id]);

  const loadPrices = useCallback(async () => {
    try {
      const data = await pricesApi.getAll();
      setPrices(data);
      const edits: Record<string, { base_price: string; price_per_km: string; roundtrip_discount: string; fahrrad_price: string; fahrrad_enabled: boolean; max_passengers: string; max_luggage: string; min_price: string; min_price_km: string }> = {};
      data.forEach((p: Price) => {
        edits[p.vehicle_type] = {
          base_price: p.base_price.toString(),
          price_per_km: p.price_per_km.toString(),
          roundtrip_discount: (p.roundtrip_discount ?? 5).toString(),
          fahrrad_price: (p.fahrrad_price ?? 10).toString(),
          fahrrad_enabled: p.fahrrad_enabled !== 0,
          max_passengers: (p.max_passengers ?? 8).toString(),
          max_luggage: (p.max_luggage ?? 10).toString(),
          min_price: (p.min_price ?? 0).toString(),
          min_price_km: (p.min_price_km ?? 15).toString(),
        };
      });
      setPriceEdits(edits);
    } catch (err) {
      console.error(err);
    }
  }, []);

  async function handleChargeSavedCard(bookingId: number) {
    setChargingId(bookingId);
    try {
      await adminApi.chargeSavedCard(bookingId);
    } catch { /* result reflected via charge_status on reload regardless of outcome */ }
    setDashboardTick((t) => t + 1);
    setChargingId(null);
  }

  // Dashboard rows carry only list fields; the detail modal needs the whole booking.
  function openBookingById(id: number) {
    adminApi.getBooking(id)
      .then((b: Booking) => { setSelectedBooking(b); setShowCardPopup(false); })
      .catch(() => alert('Buchung konnte nicht geladen werden'));
  }

  useEffect(() => {
    if (isLoggedIn) {
      if (activeTab === 'bookings') {
        loadBookings(); if (prices.length === 0) loadPrices();
        // The per-payment-method auto-invoice switches decide the "🧾 ausstehend" badge.
        settingsApi.getAll().then(s => setSettings(prev => ({ ...prev, ...s }))).catch(() => {});
      }
      if (activeTab === 'statistics') { loadDetailedStats(); loadGeoStats('30d'); }
      if (activeTab === 'prices') {
        loadPrices();
        settingsApi.getAll().then(s => setSettings(prev => ({ ...prev, ...s }))).catch(() => {});
        plzSurchargesApi.getAll().then(setPlzSurcharges).catch(() => {});
        fixedRoutesApi.getAll().then(setFixedRoutes).catch(() => {});
        adminApi.getReminderSettings().then(d => {
          setReminderEnabled(d.enabled);
          setReminderTime(d.time);
        }).catch(() => {});
      }
      if (activeTab === 'rechnung') {
        adminApi.getBankSettings().then(d => setBankSettings(d)).catch(() => {});
        settingsApi.getAll().then(s => setSettings(prev => ({ ...prev, ...s }))).catch(() => {});
      }
      if (activeTab === 'promotions') {
        const promoBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
        fetch(`${promoBase}/api/promotions/admin/list`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(setPromotions).catch(() => {});
      }
    }
  }, [isLoggedIn, activeTab, token, loadBookings, loadPrices, loadDetailedStats, loadGeoStats]);

  // Cancelling always goes through the reason dialog (the reason shapes the customer mail).
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  async function updateStatus(id: number, status: string, cancel?: CancelPayload) {
    if (status === 'cancelled' && !cancel) {
      const b = bookings.find((x) => x.id === id) || (selectedBooking?.id === id ? selectedBooking : null);
      if (b) { setCancelTarget(b); return; }
    }
    try {
      await adminApi.updateStatus(id, status, cancel);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: status as Booking['status'] } : b));
      if (selectedBooking?.id === id) {
        setSelectedBooking(prev => prev ? { ...prev, status: status as Booking['status'] } : null);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function parseChildSeatCounts(details: string | undefined | null) {
    return {
      babyschale: parseInt(details?.match(/(\d+)[×x]\s*Babyschale/i)?.[1] || '0'),
      kindersitz: parseInt(details?.match(/(\d+)[×x]\s*Kindersitz/i)?.[1] || '0'),
      sitzerhoehung: parseInt(details?.match(/(\d+)[×x]\s*Sitzerhöhung/i)?.[1] || '0'),
    };
  }

  function buildChildSeatDetails(baby: number, kind: number, sitz: number) {
    return [baby > 0 && `${baby}× Babyschale`, kind > 0 && `${kind}× Kindersitz`, sitz > 0 && `${sitz}× Sitzerhöhung`].filter(Boolean).join(', ');
  }

  function openEditModal(booking: Booking) {
    setEditingBooking(booking);
    setIsCreatingBooking(false);
    setEditForm({ ...booking });
    setEditSuccess(false);
    setEditError('');
    setEditPickupValid(booking.pickup_address || '');
    setEditDropoffValid(booking.dropoff_address || '');
    setEditPickupCoords(null);
    setEditDropoffCoords(null);
    setEditZwischenstoppValid(booking.zwischenstopp_address || null);
    setEditDistanceKm(booking.distance_km ?? null);
    setEditBaseTripPrice(null);
    const counts = parseChildSeatCounts(booking.child_seat_details);
    setEditChildSeatBabyschale(counts.babyschale);
    setEditChildSeatKindersitz(counts.kindersitz);
    setEditChildSeatSitzerhoehung(counts.sitzerhoehung);
    setEditRecalcArmed(false);
  }

  function openCreateModal() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().substring(0, 10);
    setEditingBooking(null);
    setIsCreatingBooking(true);
    setEditForm({
      vehicle_type: 'kombi',
      passengers: 1,
      payment_method: 'cash',
      language: 'de',
      trip_type: 'oneway',
      luggage_count: 0,
      child_seat: 0,
      fahrrad_count: 0,
      pickup_datetime: `${defaultDate}T12:00:00`,
    });
    setEditSuccess(false);
    setEditError('');
    setEditPickupValid('');
    setEditDropoffValid('');
    setEditPickupCoords(null);
    setEditDropoffCoords(null);
    setEditZwischenstoppValid(null);
    setEditDistanceKm(null);
    setEditBaseTripPrice(null);
    setEditChildSeatBabyschale(0);
    setEditChildSeatKindersitz(0);
    setEditChildSeatSitzerhoehung(0);
    setEditRecalcArmed(true);
  }

  // Auto-calculate price when both addresses are confirmed in edit/create modal
  useEffect(() => {
    if (!editPickupValid || !editDropoffValid) return;
    if (!editRecalcArmed) return;
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api');
    const vehicleType = editForm.vehicle_type || 'kombi';
    setEditPriceCalcLoading(true);
    fetch(`${apiBase}/maps/distance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: editPickupValid,
        destination: editDropoffValid,
        ...(editZwischenstoppValid ? { zwischenstopp: editZwischenstoppValid } : {}),
      }),
    })
      .then(r => r.json())
      .then(async distData => {
        // With a Zwischenstopp, price the full pickup→stop→dropoff route instead of
        // the direct one — same fields the public booking page uses for this.
        const km: number | undefined = editZwischenstoppValid ? distData.zwischenstopp_total_km : distData.distance_km;
        const durationMin = editZwischenstoppValid ? distData.zwischenstopp_total_duration : distData.duration_minutes;
        if (km) {
          setEditDistanceKm(km);
          setEditForm(prev => ({ ...prev, distance_km: km, duration_minutes: durationMin || prev.duration_minutes }));
          // Use backend calculate-price so Pflichtfahrgebiet & fixed routes are included
          const body: Record<string, unknown> = {
            vehicle_type: vehicleType,
            distance_km: km,
            pickup_address: editPickupValid,
            dropoff_address: editDropoffValid,
            trip_type: editForm.trip_type || 'oneway',
          };
          if (editPickupCoords) { body.pickup_lat = editPickupCoords.lat; body.pickup_lng = editPickupCoords.lng; }
          if (editDropoffCoords) { body.dropoff_lat = editDropoffCoords.lat; body.dropoff_lng = editDropoffCoords.lng; }
          const priceRes = await fetch(`${apiBase}/bookings/calculate-price`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const priceData = await priceRes.json();
          if (priceData.total_price != null) {
            const priceRow = prices.find(p => p.vehicle_type === vehicleType);
            const fahrradAddon = (editForm.fahrrad_count ?? 0) * (priceRow?.fahrrad_price ?? 0);
            const totalChildSeats = editChildSeatBabyschale + editChildSeatKindersitz + editChildSeatSitzerhoehung;
            const childSeatAddon = totalChildSeats * (priceRow?.child_seat_price ?? 0);
            // calculate-price liefert immer den Preis für die EINFACHE Fahrt. Bei Hin- & Rückfahrt
            // wie auf der Kundenseite: 2 × einfache Fahrt abzüglich Rückfahrt-Rabatt.
            const tripPrice: number = editForm.trip_type === 'roundtrip'
              ? priceData.total_price * 2 * (1 - (priceRow?.roundtrip_discount ?? 0) / 100)
              : priceData.total_price;
            const total = parseFloat((tripPrice + fahrradAddon + childSeatAddon).toFixed(2));
            setEditBaseTripPrice(tripPrice);
            setEditForm(prev => ({ ...prev, price: total }));
          }
        }
      })
      .catch(() => {})
      .finally(() => setEditPriceCalcLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPickupValid, editDropoffValid, editZwischenstoppValid, editForm.vehicle_type, editForm.trip_type, editRecalcArmed]);

  // Update price when fahrrad or child seat counts change
  useEffect(() => {
    if (editBaseTripPrice == null) return;
    const vehicleType = editForm.vehicle_type || 'kombi';
    const priceRow = prices.find(p => p.vehicle_type === vehicleType);
    const fahrradAddon = (editForm.fahrrad_count ?? 0) * (priceRow?.fahrrad_price ?? 0);
    const totalChildSeats = editChildSeatBabyschale + editChildSeatKindersitz + editChildSeatSitzerhoehung;
    const childSeatAddon = totalChildSeats * (priceRow?.child_seat_price ?? 0);
    const total = parseFloat((editBaseTripPrice + fahrradAddon + childSeatAddon).toFixed(2));
    setEditForm(prev => ({ ...prev, price: total }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm.fahrrad_count, editChildSeatBabyschale, editChildSeatKindersitz, editChildSeatSitzerhoehung]);

  async function deleteBooking(id: number) {
    if (!confirm('Buchung endgültig löschen?')) return;
    try {
      await adminApi.deleteBooking(id);
      setBookings(prev => prev.filter(b => b.id !== id));
      if (selectedBooking?.id === id) setSelectedBooking(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function savePrice(vehicleType: string) {
    const edit = priceEdits[vehicleType];
    if (!edit) return;
    try {
      await adminApi.updatePrice(vehicleType, parseFloat(edit.base_price), parseFloat(edit.price_per_km), parseFloat(edit.roundtrip_discount), parseFloat(edit.fahrrad_price), edit.fahrrad_enabled, parseInt(edit.max_passengers), parseInt(edit.max_luggage), parseFloat(edit.min_price), parseFloat(edit.min_price_km));
      setPriceSuccess(`Preis für ${vehicleType} gespeichert!`);
      setTimeout(() => setPriceSuccess(''), 3000);
      await loadPrices();
    } catch (err) {
      console.error(err);
    }
  }

  // Angemeldeter Benutzer aus dem Token (nur zur Anzeige)
  const adminUser = (() => {
    try { return JSON.parse(atob((token || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).username || 'Admin'; } catch { return 'Admin'; }
  })();

  // Allgemeine Einstellungen: ein Feld/mehrere Felder speichern und Erfolgsmeldung zeigen
  const saveSettingsPatch = async (patch: Record<string, string>, message: string): Promise<boolean> => {
    setSettingsSaving(true);
    let ok = false;
    try {
      const updated = await adminApi.updateSettings(patch);
      // noch ungespeicherte Eingaben anderer Felder nicht mit dem Serverstand überschreiben
      const keep = settingsDirty.filter(k => !(k in patch));
      setSettings(prev => { const next = { ...updated }; keep.forEach(k => { next[k] = prev[k]; }); return next; });
      setPriceSuccess(message);
      setTimeout(() => setPriceSuccess(''), 3000);
      ok = true;
    } catch { }
    setSettingsSaving(false);
    return ok;
  };
  // defaultOn: Schalter, die ohne gespeicherten Wert als aktiv gelten (!== '0' statt === '1')
  const settingOn = (key: string, defaultOn = false) => (defaultOn ? settings[key] !== '0' : settings[key] === '1');
  const toggleSetting = (key: string, label: string, defaultOn = false) => {
    const newVal = settingOn(key, defaultOn) ? '0' : '1';
    return saveSettingsPatch({ [key]: newVal }, `${label} ${newVal === '1' ? 'aktiviert' : 'deaktiviert'}`);
  };
  // Wertfelder werden erst über „Änderungen speichern“ gesammelt gesichert
  const editSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSettingsDirty(prev => (prev.includes(key) ? prev : [...prev, key]));
  };
  const normalizeSetting = (key: string, value: string | undefined): string => {
    if (key === 'night_cancel_start') return toClock(value, '20:30');
    if (key === 'night_cancel_end') return toClock(value, '08:30');
    if (key === 'night_confirm_ride_until') return value || '9';
    return value ?? '';
  };
  // Fahrzeugkarte geändert? (Vergleich mit dem zuletzt geladenen Stand, gleiche Umrechnung wie loadPrices)
  const vehicleDirty = (p: Price) => {
    const e = priceEdits[p.vehicle_type];
    if (!e) return false;
    return e.base_price !== p.base_price.toString()
      || e.price_per_km !== p.price_per_km.toString()
      || e.roundtrip_discount !== (p.roundtrip_discount ?? 5).toString()
      || e.fahrrad_price !== (p.fahrrad_price ?? 10).toString()
      || e.fahrrad_enabled !== (p.fahrrad_enabled !== 0)
      || e.max_passengers !== (p.max_passengers ?? 8).toString()
      || e.max_luggage !== (p.max_luggage ?? 10).toString()
      || e.min_price !== (p.min_price ?? 0).toString()
      || e.min_price_km !== (p.min_price_km ?? 15).toString();
  };
  const dirtyVehicles = prices.filter(vehicleDirty).map(p => p.vehicle_type);
  const pendingChanges = settingsDirty.length + dirtyVehicles.length;
  const saveAllChanges = async () => {
    if (settingsDirty.length) {
      const patch: Record<string, string> = {};
      settingsDirty.forEach(k => { patch[k] = normalizeSetting(k, settings[k]); });
      if (await saveSettingsPatch(patch, 'Änderungen gespeichert')) setSettingsDirty([]);
    }
    for (const vt of dirtyVehicles) await savePrice(vt);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="bg-primary-600 p-6 text-white text-center">
            <div className="w-16 h-16 bg-gold-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock size={24} className="text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-primary-200 text-sm mt-1">Munich Airport Taxi</p>
          </div>
          {mfa ? (
            <form onSubmit={handleMfa} className="p-6 space-y-4">
              <div className="flex items-start gap-3 bg-primary-50 text-primary-800 rounded-xl p-3 text-sm">
                <ShieldCheck size={20} className="shrink-0 mt-0.5" />
                <span>
                  {mfa.recovery
                    ? 'Geben Sie einen Ihrer Wiederherstellungscodes ein (z. B. 7KQ4-M2XP). Jeder Code gilt nur einmal.'
                    : 'Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein.'}
                </span>
              </div>
              <input
                key={mfa.recovery ? 'rc' : 'otp'}
                type="text"
                inputMode={mfa.recovery ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                autoFocus
                maxLength={mfa.recovery ? 9 : 6}
                value={mfa.code}
                onChange={(e) => {
                  const v = mfa.recovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '');
                  setMfa((m) => (m ? { ...m, code: v } : m));
                }}
                placeholder={mfa.recovery ? 'XXXX-XXXX' : '123456'}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={mfa.remember}
                  onChange={(e) => setMfa((m) => (m ? { ...m, remember: e.target.checked } : m))}
                  className="rounded"
                />
                Diesem Gerät 30 Tage vertrauen
              </label>
              {loginError && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{loginError}</div>
              )}
              <button
                type="submit"
                className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck size={18} />
                Bestätigen
              </button>
              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => { setLoginError(''); setMfa((m) => (m ? { ...m, code: '', recovery: !m.recovery } : m)); }}
                  className="text-primary-600 hover:underline"
                >
                  {mfa.recovery ? 'Code aus der App verwenden' : 'Wiederherstellungscode verwenden'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMfa(null); setLoginError(''); }}
                  className="text-gray-500 hover:underline"
                >
                  Zurück
                </button>
              </div>
            </form>
          ) : (
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            {loginError && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{loginError}</div>
            )}
            <button
              type="submit"
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <LogIn size={18} />
              Anmelden
            </button>
          </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Live-tracking alerts (sound + toast); clicking one opens the booking */}
      <TrackingAlerts onOpenBooking={(id) => { adminApi.getBooking(id).then((b) => setSelectedBooking(b)).catch(() => {}); }} />
      <AdminShell<Tab>
        active={activeTab}
        onSelect={setActiveTab}
        user={adminUser}
        onLogout={handleLogout}
        onSearch={(q) => { setFilters(p => ({ ...p, search: q })); setActiveTab('bookings'); }}
        items={[
          { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
          { id: 'live', icon: Activity, label: 'Live' },
          { id: 'heatmap', icon: Flame, label: 'Heatmap' },
          { id: 'replay', icon: Play, label: 'Replay' },
          { id: 'bookings', icon: List, label: 'Buchungen' },
          { id: 'prices', icon: Tag, label: 'Preise' },
          { id: 'pflichtgebiet', icon: MapPin, label: 'Pflichtfahrgebiet' },
          { id: 'fahrer', icon: Car, label: 'Fahrer' },
          { id: 'marketing', icon: Mail, label: 'Marketing', badge: marketingDueCount, badgeTitle: `${marketingDueCount ?? 0} Marketing-Anlass: E-Mail senden` },
          { id: 'promotions', icon: BadgePercent, label: 'Aktionen' },
          { id: 'rabatte', icon: Percent, label: 'Rabatte' },
          { id: 'ads', icon: MousePointerClick, label: 'Google Ads', badge: adsDueCount, badgeTitle: 'Google-Ads-Reports dieser Woche fehlen' },
          { id: 'b2b', icon: Building2, label: 'B2B Business' },
          { id: 'seo', icon: TrendingUp, label: 'SEO', badge: seoDueCount, badgeTitle: 'Backlink-CSV dieses Monats fehlt' },
          { id: 'statistics', icon: PieChart, label: 'Statistik' },
          { id: 'rechnung', icon: FileText, label: 'Rechnung' },
          { id: 'system', icon: Server, label: 'System' },
          { id: 'kalender', icon: CalendarDays, label: 'Kalender', badge: kalenderOpenCount, badgeTitle: `${kalenderOpenCount ?? 0} Kalender-Rechnungsfahrten offen` },
        ]}
      >
        {/* Live Visitors */}
        {activeTab === 'live' && <LiveVisitorsTab token={token} />}

        {/* Heatmap */}
        {activeTab === 'heatmap' && <HeatmapTab token={token} />}

        {/* Replay */}
        {activeTab === 'replay' && <ReplayTab token={token} />}

        {/* System */}
        {activeTab === 'system' && <SystemTab token={token} />}

        {/* SEO */}
        {activeTab === 'seo' && <SeoTab token={token} onRemindersChange={refreshSeoDue} />}

        {/* Google Ads */}
        {activeTab === 'ads' && <AdsTab token={token} onRemindersChange={refreshAdsDue} />}

        {/* Pflichtfahrgebiet */}
        {activeTab === 'pflichtgebiet' && <PflichtgebietTab token={token} />}

        {/* B2B Business */}
        {activeTab === 'b2b' && <B2BTab token={token} />}

        {/* Kalender-Import (Sammelrechnung für Telefon/E-Mail-Fahrten) */}
        {activeTab === 'kalender' && <KalenderTab token={token} onOpenCountChange={refreshKalenderCount} />}

        {/* Automatische Rabatte */}
        {activeTab === 'rabatte' && <RabatteTab token={token} />}

        {/* Marketing: Kampagnenkalender, Empfänger, Versand */}
        {activeTab === 'marketing' && <MarketingTab onRemindersChange={refreshMarketingDue} />}

        {/* Fahrer & Live-Tracking */}
        {activeTab === 'fahrer' && <DriversTab />}

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <DashboardTab
            reloadToken={dashboardTick}
            onOpenBooking={openBookingById}
            onShowCard={(b) => { setSelectedBooking(b); setShowCardPopup(true); setCardVisible(false); }}
            onCharge={handleChargeSavedCard}
            chargingId={chargingId}
            onNewBooking={openCreateModal}
            onGoTab={(t) => setActiveTab(t as Tab)}
          />
        )}

        {/* Bookings */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="relative col-span-2">
                  <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Name, Telefon, E-Mail, Buchungsnr, Ort, Straße..."
                    value={filters.search}
                    onChange={(e) => setFilters(p => ({ ...p, search: e.target.value }))}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(p => ({ ...p, status: e.target.value }))}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Alle Status</option>
                  <option value="new">Neu</option>
                  <option value="confirmed">Bestätigt</option>
                  <option value="completed">Abgeschlossen</option>
                  <option value="cancelled">Storniert</option>
                </select>
                <select
                  value={filters.vehicle_type}
                  onChange={(e) => setFilters(p => ({ ...p, vehicle_type: e.target.value }))}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Alle Fahrzeuge</option>
                  <option value="kombi">Kombi</option>
                  <option value="van">Van</option>
                  <option value="grossraumtaxi">Großraumtaxi</option>
                </select>
                <input
                  type="date"
                  value={filters.date_from}
                  placeholder="Abholtag"
                  onChange={(e) => setFilters(p => ({ ...p, date_from: e.target.value, date_to: e.target.value }))}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => loadBookings(1)}
                    className="flex-1 flex items-center justify-center gap-1 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm transition-colors"
                  >
                    <Search size={14} />
                    Suchen
                  </button>
                  <button
                    onClick={() => { setFilters({ status: '', vehicle_type: '', search: '', date_from: '', date_to: '', payment: '', customer: '', rechnung: '', paid: '', source: '', trip: '', repeat: '', same_as: '', same_as_label: '', sort: '' }); }}
                    className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm transition-colors"
                    title="Filter zurücksetzen"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              {/* Erweiterte Filter: Zahlung, Kunde, Rechnung, Quelle … */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
                {([
                  ['payment', 'Zahlungsart: alle', [['cash', 'Bar'], ['card', 'Kreditkarte'], ['ueberweisung', 'Überweisung'], ['rechnung', 'Auf Rechnung (B2B)']]],
                  ['customer', 'Kunde: alle', [['private', 'Privatkunde'], ['company', 'Firmenkunde (B2B)'], ['invoice', 'Rechnungskunde']]],
                  ['rechnung', 'Rechnung: alle', [['requested', 'Rechnung gewünscht'], ['pending', 'Rechnung ausstehend'], ['sent', 'Rechnung gesendet'], ['failed', 'Rechnung fehlgeschlagen'], ['none', 'Keine Rechnung']]],
                  ['paid', 'Bezahlung: alle', [['transfer_open', 'Überweisung offen'], ['transfer_paid', 'Überweisung bezahlt'], ['card_paid', 'Karte belastet'], ['card_failed', 'Karte fehlgeschlagen']]],
                  ['source', 'Quelle: alle', [['web', 'Website'], ['portal', 'Firmenportal'], ['calendar', 'Kalender'], ['admin', 'Admin / manuell']]],
                  ['trip', 'Fahrt: alle', [['oneway', 'Einfache Fahrt'], ['roundtrip', 'Hin & Rück'], ['flight', 'Mit Flugnummer']]],
                  ['repeat', 'Häufigkeit: alle', [['repeat2', 'Stammkunde (2+ Buchungen)'], ['repeat3', 'Vielfahrer (3+ Buchungen)'], ['once', 'Einmalkunde']]],
                  ['sort', 'Neueste Buchung zuerst', [['pickup_asc', 'Abholzeit aufsteigend'], ['pickup_desc', 'Abholzeit absteigend'], ['price_desc', 'Höchster Preis zuerst']]],
                ] as [keyof typeof filters, string, [string, string][]][]).map(([key, placeholder, opts]) => (
                  <select
                    key={key}
                    value={filters[key]}
                    onChange={(e) => setFilters(p => ({ ...p, [key]: e.target.value }))}
                    className={cn(
                      'border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                      filters[key] ? 'border-primary-400 bg-primary-50 text-primary-800 font-medium' : 'border-gray-300'
                    )}
                  >
                    <option value="">{placeholder}</option>
                    {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ))}
                <label className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-gray-500 shrink-0">bis</span>
                  <input
                    type="date"
                    value={filters.date_to}
                    title="Abholtag bis (zusammen mit dem Datum oben: Zeitraum)"
                    onChange={(e) => setFilters(p => ({ ...p, date_to: e.target.value }))}
                    className={cn(
                      'w-full min-w-0 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
                      filters.date_to && filters.date_to !== filters.date_from ? 'border-primary-400 bg-primary-50' : 'border-gray-300'
                    )}
                  />
                </label>
              </div>
              {/* Ergebnis: Anzahl + Summe der gefilterten Buchungen */}
              <div className="flex items-center gap-3 mt-3 text-sm text-gray-600 flex-wrap">
                <span><b className="text-gray-900">{pagination.total.toLocaleString('de-DE')}</b> Buchungen</span>
                {pagination.total_price != null && (
                  <span>· Summe <b className="text-gray-900">{Number(pagination.total_price).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</b> <span className="text-xs text-gray-400">(ohne stornierte)</span></span>
                )}
                {(() => {
                  const n = (['status', 'vehicle_type', 'search', 'date_from', 'payment', 'customer', 'rechnung', 'paid', 'source', 'trip', 'repeat', 'same_as'] as const).filter(k => filters[k]).length;
                  return n > 0 ? <span className="text-primary-700 font-medium">· {n} Filter aktiv</span> : null;
                })()}
                {filters.same_as && (
                  <span className="inline-flex items-center gap-1 text-xs bg-sky-100 text-sky-800 font-medium px-2 py-0.5 rounded-full">
                    🔁 Alle Buchungen von {filters.same_as_label || 'diesem Kunden'}
                    <button type="button" onClick={() => setFilters(p => ({ ...p, same_as: '', same_as_label: '' }))} className="ml-0.5 hover:text-sky-950" title="Kundenfilter entfernen">
                      <X size={12} />
                    </button>
                  </span>
                )}
                {filters.date_from && (
                  <span className="text-xs text-gray-400">
                    · Abholtag {filters.date_from}{filters.date_to && filters.date_to !== filters.date_from ? ` bis ${filters.date_to}` : ''}
                  </span>
                )}
              </div>
            </div>

            {/* New Booking Button */}
            <div className="flex justify-end">
              <button
                onClick={() => openCreateModal()}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <Plus size={16} /> Neue Buchung
              </button>
            </div>

            {/* Bookings Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-gray-500">
                  <RefreshCw size={32} className="animate-spin mx-auto mb-3" />
                  <p>Laden...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left py-3 px-4 text-gray-500 font-medium">Buchungsnr.</th>
                          <th className="text-left py-3 px-4 text-gray-500 font-medium">Datum</th>
                          <th className="text-left py-3 px-4 text-gray-500 font-medium">Kunde</th>
                          <th className="text-left py-3 px-4 text-gray-500 font-medium">Fahrzeug</th>
                          <th className="text-left py-3 px-4 text-gray-500 font-medium">Preis</th>
                          <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                          <th className="text-left py-3 px-4 text-gray-500 font-medium">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {bookings.map((booking) => (
                          <tr key={booking.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 font-mono text-xs text-primary-600">{booking.booking_number}</td>
                            <td className="py-3 px-4 text-xs">{formatDateTime(booking.pickup_datetime)}</td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900 flex items-center gap-1.5 flex-wrap">
                                {booking.name}
                                {/* Stammkunde: Klick zeigt alle Buchungen dieses Kunden (über E-Mail bzw. Telefon) */}
                                {(booking.customer_booking_count ?? 0) >= 2 && (
                                  <button
                                    type="button"
                                    onClick={() => setFilters({ ...EMPTY_BOOKING_FILTERS, same_as: String(booking.id), same_as_label: booking.name })}
                                    title={`${booking.customer_booking_count} Buchungen von diesem Kunden — klicken zeigt alle`}
                                    className={cn(
                                      'inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-colors',
                                      (booking.customer_booking_count ?? 0) >= 3
                                        ? 'bg-violet-100 text-violet-800 hover:bg-violet-200'
                                        : 'bg-sky-100 text-sky-800 hover:bg-sky-200'
                                    )}
                                  >
                                    🔁 {booking.customer_booking_count}×
                                  </button>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">{booking.phone}</div>
                              {booking.company_id && (
                                <span className="inline-flex items-center gap-1 mt-1 bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                                  🏢 {booking.company_name || 'Kurumsal'}
                                </span>
                              )}
                              {booking.notes?.includes('🐾') && (
                                <span className="inline-flex items-center gap-1 mt-1 ml-1 bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" title="Haustier im Käfig (vom Kunden bestätigt)">
                                  🐾 Haustier
                                </span>
                              )}
                              {/* Customer-requested invoice: sent / still pending / failed */}
                              {booking.rechnung_number ? (
                                <span
                                  className="inline-flex items-center gap-1 mt-1 ml-1 bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                  title={`${booking.rechnung_number}${booking.rechnung_sent_at ? ` · ${formatDateTime(booking.rechnung_sent_at)}` : ''}`}
                                >
                                  🧾 Rechnung
                                </span>
                              ) : booking.rechnung_error ? (
                                <span
                                  className="inline-flex items-center gap-1 mt-1 ml-1 bg-red-100 text-red-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                  title={booking.rechnung_error}
                                >
                                  🧾 Fehler
                                </span>
                              ) : booking.rechnung_required || autoRechnungViaZahlungsart(booking, settings) ? (
                                <span
                                  className="inline-flex items-center gap-1 mt-1 ml-1 bg-gray-100 text-gray-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                  title={booking.rechnung_required
                                    ? 'Kunde hat eine Rechnung angefordert — wird nach der Fahrt automatisch versendet'
                                    : `${booking.payment_method === 'card' ? 'Kreditkarte' : 'Bar'}-Automatik — wird nach der Fahrt automatisch versendet`}
                                >
                                  🧾 ausstehend
                                </span>
                              ) : null}
                              {/* Bank transfer: proforma sent before the ride, and whether
                                  the money has been confirmed as received. */}
                              {booking.proforma_number && (
                                <span
                                  className="inline-flex items-center gap-1 mt-1 ml-1 bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                  title={`${booking.proforma_number}${booking.proforma_sent_at ? ` · ${formatDateTime(booking.proforma_sent_at)}` : ''}`}
                                >
                                  📄 Proforma
                                </span>
                              )}
                              {booking.payment_method === 'ueberweisung' && (
                                <span
                                  className={`inline-flex items-center gap-1 mt-1 ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                    booking.ueberweisung_paid_at ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                                  }`}
                                  title={booking.ueberweisung_paid_at
                                    ? `Überweisung eingegangen am ${formatDateTime(booking.ueberweisung_paid_at)}`
                                    : 'Überweisung noch nicht als eingegangen markiert'}
                                >
                                  {booking.ueberweisung_paid_at ? '💰 bezahlt' : '🏦 offen'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 capitalize">{booking.vehicle_type}</td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-primary-600">{formatPrice(booking.price)}</span>
                              <span className={cn(
                                'ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                booking.steuersatz === 7 ? 'bg-green-100 text-green-700'
                                  : booking.steuersatz === 19 ? 'bg-blue-100 text-blue-700'
                                  : 'bg-red-100 text-red-600'
                              )}>
                                {booking.steuersatz ? `${booking.steuersatz}%` : 'MwSt?'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {booking.status === 'cancelled' ? (
                                <button
                                  onClick={() => deleteBooking(booking.id)}
                                  title="Endgültig löschen"
                                  className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[booking.status]} hover:bg-red-200 hover:line-through cursor-pointer transition-all`}
                                >
                                  {STATUS_LABELS[booking.status]}
                                </button>
                              ) : (
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[booking.status]}`}>
                                  {STATUS_LABELS[booking.status]}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setSelectedBooking(booking)}
                                  className="p-1 text-gray-500 hover:text-primary-600 transition-colors"
                                  title="Details"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => openEditModal(booking)}
                                  className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                                  title="Bearbeiten"
                                >
                                  <Pencil size={16} />
                                </button>
                                {booking.status === 'new' && (
                                  <button
                                    onClick={() => updateStatus(booking.id, 'confirmed')}
                                    className="p-1 text-gray-500 hover:text-green-600 transition-colors"
                                    title="Bestätigen"
                                  >
                                    <Check size={16} />
                                  </button>
                                )}
                                {booking.status === 'confirmed' && (
                                  <button
                                    onClick={() => updateStatus(booking.id, 'completed')}
                                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                    title="Abschließen"
                                  >
                                    ✓ Done
                                  </button>
                                )}
                                {booking.status !== 'cancelled' && (
                                  <button
                                    onClick={() => setCancelTarget(booking)}
                                    className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                                    title="Stornieren"
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                      <span className="text-sm text-gray-500">
                        {pagination.total} Buchungen gesamt
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadBookings(pagination.page - 1)}
                          disabled={pagination.page <= 1}
                          className="p-2 rounded-lg disabled:opacity-50 hover:bg-gray-100 transition-colors"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm">Seite {pagination.page} von {pagination.pages}</span>
                        <button
                          onClick={() => loadBookings(pagination.page + 1)}
                          disabled={pagination.page >= pagination.pages}
                          className="p-2 rounded-lg disabled:opacity-50 hover:bg-gray-100 transition-colors"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Prices */}
        {activeTab === 'prices' && (() => {
          const sw = (key: string, label: string, defaultOn = false) => (
            <Toggle on={settingOn(key, defaultOn)} disabled={settingsSaving} label={label} onClick={() => toggleSetting(key, label, defaultOn)} />
          );
          const sv = (key: string, fallback: string) => ({
            value: settings[key] || fallback,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => editSetting(key, e.target.value),
          });
          type PriceEditKey = 'base_price' | 'price_per_km' | 'roundtrip_discount' | 'fahrrad_price' | 'max_passengers' | 'max_luggage' | 'min_price' | 'min_price_km';
          const pe = (vt: string, key: PriceEditKey) => ({
            value: priceEdits[vt]?.[key] ?? '',
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPriceEdits(prev => ({ ...prev, [vt]: { ...prev[vt], [key]: e.target.value } })),
          });
          const vehicleMeta: Record<string, { name: string; tagline: string; img: string }> = {
            kombi: { name: 'Kombi / Limousine', tagline: 'Ideal für kleine Gruppen', img: '/images/kombi.webp' },
            van: { name: 'Van', tagline: 'Beliebt bei Familien', img: '/images/van.webp' },
            grossraumtaxi: { name: 'Großraumtaxi', tagline: 'Gruppen & viel Gepäck', img: '/images/grossraumtaxi.webp' },
          };
          return (
          <div className="space-y-5 pb-24">
            {/* Kopf */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gray-200/70 bg-white text-primary-600 shadow-sm">
                  <Settings className="h-7 w-7" aria-hidden />
                </span>
                <div>
                  <h2 className="text-2xl font-bold leading-tight text-gray-900">Preise &amp; Einstellungen</h2>
                  <p className="text-sm text-gray-500">Verwalten Sie Preisstruktur, Zuschläge, Fahrzeuge und Buchungsregeln.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {pendingChanges > 0 ? (
                  <span className="hidden sm:inline-flex whitespace-nowrap items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    {pendingChanges} {pendingChanges === 1 ? 'ungespeicherte Änderung' : 'ungespeicherte Änderungen'}
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex whitespace-nowrap items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Alles gespeichert
                  </span>
                )}
                <button
                  type="button"
                  onClick={saveAllChanges}
                  disabled={pendingChanges === 0 || settingsSaving}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-gold-400 px-5 text-sm font-semibold text-primary-800 shadow-sm transition hover:bg-gold-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
                >
                  <Save className="h-[18px] w-[18px]" aria-hidden />
                  Änderungen speichern
                </button>
              </div>
            </div>

            <SectionNav items={[
              { id: 'preise-allgemein', label: 'Allgemeine Einstellungen', icon: Car },
              { id: 'preise-fahrzeuge', label: 'Fahrzeugpreise', icon: CarFront },
              { id: 'preise-plz', label: 'PLZ-Zuschläge', icon: MapPin },
              { id: 'preise-festpreis', label: 'Festpreisrouten', icon: CalendarDays },
              { id: 'preise-regeln', label: 'Buchungsregeln', icon: ClipboardList },
              { id: 'preise-weitere', label: 'Weitere Optionen', icon: Settings2 },
            ]} />

            {/* ── Allgemeine Einstellungen ── */}
            <SectionCard id="preise-allgemein" icon={Settings} title="Allgemeine Einstellungen">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <SettingCard
                  icon={Building2}
                  title="Stadtfahrt erlauben"
                  description="Nicht-Flughafen-Fahrten erlauben (Anfahrtskosten werden berechnet)."
                  on={settingOn('stadtfahrt_enabled')}
                  control={sw('stadtfahrt_enabled', 'Stadtfahrt')}
                />
                <SettingCard
                  icon={Route}
                  title="Anfahrtskosten pro km (€)"
                  description="Preis pro km für die Anfahrt von Freising zum Abholort (nur bei Nicht-Flughafen-Fahrten)."
                >
                  <Field unit="€/km" type="number" step="0.10" min="0" aria-label="Anfahrtskosten pro km" {...sv('anfahrt_price_per_km', '1.70')} />
                </SettingCard>
                <SettingCard
                  icon={Clock}
                  title="Minimum Vorlaufzeit (Stunden)"
                  description="Buchungen müssen mindestens so viele Stunden vor der Fahrt erfolgen. Standard: 1,5 Std."
                >
                  <Field unit="Std." type="number" step="0.5" min="0" aria-label="Minimum Vorlaufzeit" {...sv('min_advance_hours', '1.5')} />
                </SettingCard>

                <SettingCard
                  icon={Moon}
                  tone="amber"
                  title="Nacht-Bestätigung"
                  description="Hinweis bei Buchungen in der Nacht und früher Abfahrt am Morgen anzeigen."
                  info={<>Der Hinweis erscheint, wenn die Buchung in diesem Zeitfenster (Münchner Zeit) eingeht und die Fahrt vor der angegebenen Uhrzeit am Morgen startet (z. B. Buchung 06:04 für 08:00: ja · Buchung 23:30 für 10:00: nein). Dann wird der Kunde gebeten, sicherheitshalber zusätzlich telefonisch zu bestätigen (Bestätigungsseite + E-Mail). Standard: Buchung 22–07 Uhr, Fahrt vor 09:00 Uhr.</>}
                  on={settingOn('night_confirm_enabled')}
                  control={sw('night_confirm_enabled', 'Nacht-Bestätigung')}
                  indent={false}
                >
                  {settingOn('night_confirm_enabled') && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <HourSelect label="Von" value={settings.night_confirm_start || '22'} onChange={(v) => editSetting('night_confirm_start', v)} />
                      <HourSelect label="bis" value={settings.night_confirm_end || '7'} onChange={(v) => editSetting('night_confirm_end', v)} />
                      <HourSelect label="Fahrt vor" value={settings.night_confirm_ride_until || '9'} onChange={(v) => editSetting('night_confirm_ride_until', v)} />
                    </div>
                  )}
                </SettingCard>
                <SettingCard
                  icon={Moon}
                  tone="amber"
                  badge={<span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 ring-2 ring-white"><Ban className="h-2.5 w-2.5 text-white" aria-hidden /></span>}
                  title="Nacht-Stornierung"
                  description="Online-Storno im gewählten Zeitraum sperren – Kunde muss anrufen (Münchner Zeit)."
                  info={<>Storniert ein Kunde zwischen „Von“ und „Bis“ über „Buchung verwalten“ eine Fahrt, die vor der „Bis“-Uhrzeit beginnt, ist das Online-Storno gesperrt: der Kunde muss anrufen (kein WhatsApp – nachts evtl. ungelesen), und du bekommst sofort eine Warn-E-Mail („Kunde möchte stornieren – ruft an“). Die Fahrt bleibt aktiv, bis du sie stornierst. Beispiel 20:30–08:30: Storno um 21:00 für morgen 05:00 → nur telefonisch; für morgen 10:00 oder in zwei Tagen → online.</>}
                  on={settingOn('night_cancel_enabled', true)}
                  control={sw('night_cancel_enabled', 'Nacht-Stornierung', true)}
                  indent={false}
                >
                  {settingOn('night_cancel_enabled', true) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Field inline label="Von" type="time" widthClass="w-[7.5rem]"
                        value={toClock(settings.night_cancel_start, '20:30')}
                        onChange={(e) => editSetting('night_cancel_start', e.target.value)} />
                      <Field inline label="bis" type="time" widthClass="w-[7.5rem]"
                        value={toClock(settings.night_cancel_end, '08:30')}
                        onChange={(e) => editSetting('night_cancel_end', e.target.value)} />
                    </div>
                  )}
                </SettingCard>
                <SettingCard
                  icon={Plane}
                  title="Flugnummer-Validierung"
                  description="Prüft eingegebene Flugnummern live gegen eine Flugdaten-API."
                  info={<>Gilt bei Flughafen-Abholungen. Der Kunde sieht eine Bestätigung oder Warnung. Blockiert die Buchung nie.</>}
                  on={settingOn('flight_validation_enabled')}
                  control={sw('flight_validation_enabled', 'Flugnummer-Validierung')}
                />

                <SettingCard
                  icon={Phone}
                  title="Telefonnummer-Prüfung"
                  description="Prüft Handynummern auf fehlende Ziffern, Ländervorwahl und Festnetz."
                  info={<>Die Prüfung läuft beim Tippen. Blockiert die Buchung nie — der Kunde kann immer absenden.</>}
                  on={settingOn('phone_validation_enabled')}
                  control={sw('phone_validation_enabled', 'Telefonnummer-Prüfung')}
                />
                <SettingCard
                  icon={FileText}
                  title="Formular merken"
                  description="Eingegebene Kundendaten im Browser behalten (keine Kartendaten)."
                  info={<>Geht der Kunde von „Ihre Angaben“ zurück (z. B. um ein anderes Fahrzeug anzusehen), bleiben Name, Telefon, E-Mail, Flugnummer, Extras und Rechnungsadresse ausgefüllt. Nur im Browser-Tab des Kunden gespeichert, nach der Buchung gelöscht.</>}
                  on={settingOn('booking_form_restore_enabled', true)}
                  control={sw('booking_form_restore_enabled', 'Formular merken', true)}
                />
                <SettingCard
                  icon={MapPin}
                  title="Hotels & Lokale an der Adresse"
                  description="Zeigt Hotels, Gasthäuser und Restaurants in der Adresssuche (max. 3 pro Adresse)."
                  info={<>Tippt der Kunde eine Hausadresse (z. B. „Sonnenstraße 25“), erscheint in der Vorschlagsliste, was genau dort ist. Kostet pro Adresse eine Google-Umkreissuche; Ergebnisse werden 24 h zwischengespeichert.</>}
                  on={settingOn('address_poi_enabled', true)}
                  control={sw('address_poi_enabled', 'Hotels & Lokale an der Adresse', true)}
                />
              </div>
            </SectionCard>

            {/* ── Fahrzeugpreise ── */}
            <SectionCard id="preise-fahrzeuge" icon={CarFront} title="Fahrzeugpreise & Parameter" subtitle="Grundpreise, Kilometerpreise, Mindestgebühr und Fahrzeugkapazitäten verwalten.">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {prices.map((price) => {
                  const vt = price.vehicle_type;
                  const meta = vehicleMeta[vt] ?? { name: vt, tagline: '', img: '' };
                  const dirty = vehicleDirty(price);
                  return (
                    <div key={vt} className={cn('flex flex-col overflow-hidden rounded-xl border bg-white transition-colors', dirty ? 'border-gold-400 ring-1 ring-gold-400' : 'border-gray-200/80')}>
                      <div className="relative h-36 overflow-hidden bg-gray-100">
                        {meta.img && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={meta.img} alt="" className="h-full w-full object-cover object-center" />
                        )}
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-gray-700 shadow-sm">
                          <Users className="h-3 w-3" aria-hidden />
                          bis {priceEdits[vt]?.max_passengers || price.max_passengers} Personen
                        </span>
                        {dirty && (
                          <span className="absolute right-3 top-3 rounded-full bg-gold-400 px-2.5 py-1 text-[11px] font-semibold text-primary-800 shadow-sm">Geändert</span>
                        )}
                      </div>
                      <div className="border-b border-gray-100 px-4 pb-3 pt-3.5">
                        <h4 className="text-lg font-bold leading-tight text-gray-900">{meta.name}</h4>
                        <p className="text-xs text-gray-500">{meta.tagline}</p>
                      </div>

                      <div className="flex flex-1 flex-col gap-4 p-4">
                        <div className="grid grid-cols-3 gap-2.5">
                          <BlockField label="Grundpreis (€)" type="number" step="0.01" min="0" {...pe(vt, 'base_price')} />
                          <BlockField label="Preis pro km (€)" type="number" step="0.01" min="0" {...pe(vt, 'price_per_km')} />
                          <BlockField label="Rückfahrt-Rabatt" unit="%" type="number" step="1" min="0" max="50" {...pe(vt, 'roundtrip_discount')} />
                        </div>
                        <div>
                          <div className="grid grid-cols-2 gap-2.5">
                            <BlockField label="Mindestpreis (€)" type="number" step="0.50" min="0" {...pe(vt, 'min_price')} />
                            <BlockField label="Gültig bis (km)" type="number" step="1" min="0" {...pe(vt, 'min_price_km')} />
                          </div>
                          <p className="mt-1.5 text-[11px] text-gray-400">Mindestpreis gilt bis zu diesem km-Wert (0 = deaktiviert)</p>
                        </div>
                        <div className="flex min-h-10 items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Bike className="h-5 w-5 text-gray-700" aria-hidden />
                            <span className="text-sm font-semibold text-gray-800">Fahrrad</span>
                            <Toggle
                              size="sm"
                              label={`Fahrrad für ${meta.name}`}
                              on={!!priceEdits[vt]?.fahrrad_enabled}
                              onClick={() => setPriceEdits(prev => ({ ...prev, [vt]: { ...prev[vt], fahrrad_enabled: !prev[vt]?.fahrrad_enabled } }))}
                            />
                          </div>
                          {priceEdits[vt]?.fahrrad_enabled ? (
                            <Field unit="€/Stk." type="number" step="0.50" min="0" widthClass="w-24" aria-label={`Fahrradpreis ${meta.name}`} {...pe(vt, 'fahrrad_price')} />
                          ) : (
                            <span className="text-xs text-gray-400">deaktiviert</span>
                          )}
                        </div>
                        <div>
                          <div className="grid grid-cols-2 gap-2.5">
                            <BlockField label="Max. Personen" type="number" step="1" min="1" max="20" {...pe(vt, 'max_passengers')} />
                            <BlockField label="Max. Koffer" type="number" step="1" min="0" max="30" {...pe(vt, 'max_luggage')} />
                          </div>
                          <p className="mt-1.5 text-[11px] text-gray-400">Keine Buchung über diesem Limit möglich</p>
                        </div>
                        <div className="mt-auto space-y-1.5">
                          <button
                            type="button"
                            onClick={() => savePrice(vt)}
                            className={cn(
                              'flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                              dirty ? 'bg-gold-400 text-primary-800 hover:bg-gold-500' : 'bg-primary-700 text-white hover:bg-primary-800'
                            )}
                          >
                            <Save className="h-4 w-4" aria-hidden />
                            {dirty ? 'Änderungen speichern' : 'Speichern'}
                          </button>
                          <p className="text-center text-[11px] text-gray-400">Zuletzt geändert: {new Date(price.updated_at).toLocaleDateString('de-DE')}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 md:grid-cols-3">
                <p><strong className="text-slate-800">Einfach:</strong> Grundpreis + (Distanz in km × Preis/km)</p>
                <p><strong className="text-slate-800">Hin- &amp; Rückfahrt:</strong> (Einfach × 2) − Rabatt %</p>
                <p><strong className="text-slate-800">Mindestgebühr:</strong> Distanz ≤ km-Limit und Preis &lt; Mindestpreis → Mindestpreis</p>
              </div>
            </SectionCard>

            {/* ── PLZ-Zuschläge ── */}
            <SectionCard
              id="preise-plz"
              icon={MapPin}
              title="PLZ-Zuschläge"
              subtitle="Bestimmte PLZ-Gebiete erhalten einen Aufschlag auf den Fahrpreis. Der Zuschlag wird unsichtbar zum Gesamtpreis addiert."
              action={
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className={cn('text-sm font-medium', settings.plz_surcharge_enabled === '1' ? 'text-emerald-700' : 'text-gray-500')}>
                      {settings.plz_surcharge_enabled === '1' ? 'Aktiv' : 'Aus'}
                    </span>
                    <Toggle
                      label="PLZ-Zuschläge"
                      on={settings.plz_surcharge_enabled === '1'}
                      disabled={settingsSaving}
                      onClick={async () => {
                        const newVal = settings.plz_surcharge_enabled === '1' ? '0' : '1';
                        setSettingsSaving(true);
                        try {
                          const updated = await adminApi.updateSettings({ plz_surcharge_enabled: newVal });
                          setSettings(updated);
                        } catch {}
                        setSettingsSaving(false);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPlzForm(v => !v)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold-400 px-4 text-sm font-semibold text-primary-800 transition hover:bg-gold-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    PLZ hinzufügen
                  </button>
                </div>
              }
            >
              {showPlzForm && (
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <BlockField label="PLZ" className="w-28" type="text" placeholder="85435" maxLength={5} value={newPlz} onChange={e => setNewPlz(e.target.value)} />
                  <BlockField label="Stadt / Ort" className="w-48" type="text" placeholder="Erding" value={newPlzStadt} onChange={e => setNewPlzStadt(e.target.value)} />
                  <BlockField label="Zuschlag" unit="€" className="w-32" type="number" placeholder="10" step="0.50" min="0" value={newPlzSurcharge} onChange={e => setNewPlzSurcharge(e.target.value)} />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newPlz.trim() || !newPlzSurcharge) return;
                      setPlzSaving(true);
                      try {
                        const rows = await plzSurchargesApi.create(newPlz.trim(), newPlzStadt.trim(), parseFloat(newPlzSurcharge));
                        setPlzSurcharges(rows);
                        setNewPlz('');
                        setNewPlzStadt('');
                        setNewPlzSurcharge('10');
                      } catch {}
                      setPlzSaving(false);
                    }}
                    disabled={plzSaving || !newPlz.trim()}
                    className="h-10 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
                  >
                    {plzSaving ? 'Speichert…' : 'Hinzufügen'}
                  </button>
                  <button type="button" onClick={() => setShowPlzForm(false)} className="h-10 rounded-lg px-3 text-sm text-gray-500 hover:bg-gray-100">Abbrechen</button>
                </div>
              )}
              {plzSurcharges.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                      <tr>
                        <th className="px-4 py-2.5">PLZ</th>
                        <th className="px-4 py-2.5">Stadt / Ort</th>
                        <th className="px-4 py-2.5">Zuschlag (€)</th>
                        <th className="w-28 px-4 py-2.5 text-right">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {plzSurcharges.map(s => {
                        const editing = editingPlz?.id === s.id;
                        return (
                          <tr key={s.id} className="hover:bg-gray-50/60">
                            <td className="px-4 py-2.5 font-medium tabular-nums text-gray-900">{s.plz}</td>
                            <td className="px-4 py-2.5 text-gray-700">
                              {editing ? (
                                <input value={editingPlz.stadt} onChange={e => setEditingPlz(p => p && { ...p, stadt: e.target.value })} aria-label="Stadt / Ort"
                                  className="h-9 w-full max-w-xs rounded-lg border border-gray-200 px-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
                              ) : s.stadt}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-gray-900">
                              {editing ? (
                                <input type="number" step="0.50" min="0" value={editingPlz.surcharge} onChange={e => setEditingPlz(p => p && { ...p, surcharge: e.target.value })} aria-label="Zuschlag in Euro"
                                  className="h-9 w-24 rounded-lg border border-gray-200 px-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
                              ) : `${s.surcharge.toFixed(2).replace('.', ',')} €`}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center justify-end gap-1">
                                {editing ? (
                                  <>
                                    <button
                                      type="button"
                                      title="Speichern"
                                      aria-label={`PLZ ${s.plz} speichern`}
                                      disabled={plzSaving || !editingPlz.surcharge}
                                      onClick={async () => {
                                        setPlzSaving(true);
                                        try {
                                          const rows = await plzSurchargesApi.update(s.id, parseFloat(editingPlz.surcharge), editingPlz.stadt.trim());
                                          setPlzSurcharges(rows);
                                          setEditingPlz(null);
                                        } catch {}
                                        setPlzSaving(false);
                                      }}
                                      className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                                    >
                                      <Check className="h-4 w-4" aria-hidden />
                                    </button>
                                    <button type="button" title="Abbrechen" aria-label="Bearbeiten abbrechen" onClick={() => setEditingPlz(null)} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100">
                                      <X className="h-4 w-4" aria-hidden />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      title="Bearbeiten"
                                      aria-label={`PLZ ${s.plz} bearbeiten`}
                                      onClick={() => setEditingPlz({ id: s.id, stadt: s.stadt || '', surcharge: String(s.surcharge) })}
                                      className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100"
                                    >
                                      <Pencil className="h-4 w-4" aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      title="Löschen"
                                      aria-label={`PLZ ${s.plz} löschen`}
                                      disabled={plzSaving}
                                      onClick={async () => {
                                        if (!confirm(`PLZ-Zuschlag ${s.plz}${s.stadt ? ` (${s.stadt})` : ''} löschen?`)) return;
                                        setPlzSaving(true);
                                        try {
                                          const rows = await plzSurchargesApi.remove(s.id);
                                          setPlzSurcharges(rows);
                                        } catch {}
                                        setPlzSaving(false);
                                      }}
                                      className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                                    >
                                      <Trash2 className="h-4 w-4" aria-hidden />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">Noch keine PLZ-Zuschläge angelegt.</p>
              )}
            </SectionCard>

            {/* ── Festpreisrouten ── */}
            <SectionCard
              id="preise-festpreis"
              icon={CalendarDays}
              title="Festpreisrouten"
              subtitle="Gesetzlich vorgeschriebene Festpreise für bestimmte Strecken. Überschreibt alle anderen Preisberechnungen."
              action={
                <button
                  type="button"
                  onClick={() => setEditingRoute({ name: '', pickup_keywords: '', dropoff_keywords: '', price_kombi: 0, price_van: 0, price_grossraumtaxi: 0, bidirectional: 1, enabled: 1 })}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gold-400 px-4 text-sm font-semibold text-primary-800 transition hover:bg-gold-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Neue Route
                </button>
              }
            >
              {editingRoute && (
                <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <BlockField label="Name" type="text" placeholder="z. B. Flughafen ↔ Messe"
                    value={editingRoute.name || ''} onChange={e => setEditingRoute(r => ({ ...r!, name: e.target.value }))} />
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <BlockField label="Abholort-Schlüsselwörter (kommagetrennt)" type="text" placeholder="flughafen münchen,munich airport"
                      value={editingRoute.pickup_keywords || ''} onChange={e => setEditingRoute(r => ({ ...r!, pickup_keywords: e.target.value }))} />
                    <BlockField label="Zielort-Schlüsselwörter (kommagetrennt)" type="text" placeholder="neue messe,81829"
                      value={editingRoute.dropoff_keywords || ''} onChange={e => setEditingRoute(r => ({ ...r!, dropoff_keywords: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <BlockField label="Kombi" unit="€" type="number" step="0.50"
                      value={editingRoute.price_kombi || ''} onChange={e => setEditingRoute(r => ({ ...r!, price_kombi: parseFloat(e.target.value) || 0 }))} />
                    <BlockField label="Van" unit="€" type="number" step="0.50"
                      value={editingRoute.price_van || ''} onChange={e => setEditingRoute(r => ({ ...r!, price_van: parseFloat(e.target.value) || 0 }))} />
                    <BlockField label="Großraumtaxi" unit="€" type="number" step="0.50"
                      value={editingRoute.price_grossraumtaxi || ''} onChange={e => setEditingRoute(r => ({ ...r!, price_grossraumtaxi: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="flex flex-wrap items-center gap-5">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={!!editingRoute.bidirectional}
                        onChange={e => setEditingRoute(r => ({ ...r!, bidirectional: e.target.checked ? 1 : 0 }))} />
                      Beide Richtungen (↔)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={editingRoute.enabled !== 0}
                        onChange={e => setEditingRoute(r => ({ ...r!, enabled: e.target.checked ? 1 : 0 }))} />
                      Aktiv
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="h-10 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800"
                      onClick={async () => {
                        try {
                          if (editingRoute.id) {
                            await fixedRoutesApi.update(editingRoute.id, editingRoute);
                          } else {
                            await fixedRoutesApi.create(editingRoute);
                          }
                          setEditingRoute(null);
                          fixedRoutesApi.getAll().then(setFixedRoutes);
                        } catch (err: any) {
                          alert(`Fehler beim Speichern: ${err?.response?.data?.error || err?.message || 'Unbekannter Fehler'}`);
                        }
                      }}
                    >Speichern</button>
                    <button type="button" className="h-10 rounded-lg px-4 text-sm text-gray-500 hover:bg-gray-100" onClick={() => setEditingRoute(null)}>Abbrechen</button>
                  </div>
                </div>
              )}

              {fixedRoutes.length === 0 && !editingRoute && (
                <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">Keine Festpreisrouten definiert.</p>
              )}
              {fixedRoutes.length > 0 && (
                <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                  {fixedRoutes.map(r => (
                    <div key={r.id} className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3', !r.enabled && 'bg-gray-50')}>
                      <div className={cn('min-w-0', !r.enabled && 'opacity-60')}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{r.name} {r.bidirectional ? '↔' : '→'}</span>
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', r.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-200 text-gray-500')}>
                            {r.enabled ? 'Aktiv' : 'Aus'}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">Kombi <strong>{r.price_kombi} €</strong></span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">Van <strong>{r.price_van} €</strong></span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">Großraum <strong>{r.price_grossraumtaxi} €</strong></span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" title="Bearbeiten" aria-label={`${r.name} bearbeiten`} className="rounded-lg p-2 text-gray-700 hover:bg-gray-100" onClick={() => setEditingRoute({ ...r })}>
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button type="button" title="Löschen" aria-label={`${r.name} löschen`} className="rounded-lg p-2 text-red-500 hover:bg-red-50" onClick={async () => {
                          if (confirm('Route löschen?')) {
                            await fixedRoutesApi.remove(r.id);
                            fixedRoutesApi.getAll().then(setFixedRoutes);
                          }
                        }}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* ── Buchungsregeln ── */}
            <SectionCard id="preise-regeln" icon={ClipboardList} title="Buchungsregeln" subtitle="Zwischenstopps, Status-Automatik und Rechnungskunden.">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <SettingCard
                  icon={Milestone}
                  title="Zwischenstopp erlauben"
                  description="Kunden können einen Zwischenstopp zur Fahrt hinzufügen."
                  on={settingOn('zwischenstopp_enabled')}
                  control={sw('zwischenstopp_enabled', 'Zwischenstopp')}
                />
                <SettingCard
                  className="xl:col-span-2"
                  icon={Workflow}
                  title="Automatischer Buchungsstatus"
                  description="Neue Buchungen automatisch bestätigen und nach der Abholzeit abschließen."
                  info={<>Ohne manuelles Klicken: Neue Buchungen werden nach der festgelegten Zeit bestätigt, bestätigte Buchungen abgeschlossen, sobald die Abholzeit vorbei ist. <strong>Beim Aktivieren werden bereits fällige Buchungen sofort umgestellt</strong> – vorher die Liste kurz prüfen.</>}
                  on={settingOn('auto_status_enabled')}
                  control={sw('auto_status_enabled', 'Automatischer Status')}
                >
                  {settingOn('auto_status_enabled') && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <Field inline label="Neu → Bestätigt nach" unit="Std." type="number" min="0" step="0.5" widthClass="w-20" {...sv('auto_confirm_hours', '1')} />
                        <Field inline label="Abgeschlossen" unit="Min. nach Abholzeit" type="number" min="0" widthClass="w-20" {...sv('auto_complete_buffer_minutes', '0')} />
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs text-gray-500">Firmenkunden mit hinterlegter Karte, die bei Fahrtabschluss automatisch belastet werden („bei Abschluss zahlen“)</p>
                        <div className="inline-flex rounded-lg bg-gray-200/70 p-0.5" role="radiogroup" aria-label="Firmenkunden in der Automatik">
                          {([['0', 'Firmenkunden ausschließen', 'Firmenkunden werden von der Automatik ausgeschlossen'], ['1', 'Alle Fahrten', 'Alle Fahrten werden automatisch abgeschlossen — inkl. automatischer Kartenbelastung']] as const).map(([val, label, msg]) => {
                            const active = val === '1' ? settings.auto_complete_include_company_charge === '1' : settings.auto_complete_include_company_charge !== '1';
                            return (
                              <button
                                key={val}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => saveSettingsPatch({ auto_complete_include_company_charge: val }, msg)}
                                disabled={settingsSaving}
                                className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', active ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </SettingCard>
                {/* Rechnungskunden (Überweisung) — kein globaler Schalter: die Freischaltung pro Kunde ist maßgeblich */}
                <SettingCard
                  className="xl:col-span-3"
                  icon={Landmark}
                  title="Rechnungskunden (Überweisung)"
                  description="Freigeschaltete Kunden sehen auf /buchen zusätzlich „Überweisung“. Hier pausieren oder löschen."
                  info={<>Freischalten im Buchungsdetail („Als Rechnungskunde freischalten“). „Überweisung“ erscheint nur, wenn E-Mail und Telefon passen und höchstens die erlaubte Zahl unbezahlter Überweisungen offen ist. Die Rechnung geht nach der Fahrt automatisch an die hinterlegte Adresse.</>}
                >
                  <InvoiceCustomersList />
                </SettingCard>
              </div>
            </SectionCard>

            {/* ── Weitere Optionen ── */}
            <SectionCard id="preise-weitere" icon={Settings2} title="Weitere Optionen">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <SettingCard
                  icon={Megaphone}
                  title="Social-Proof-Toast"
                  description="Animierte Hinweise auf kürzliche Buchungen auf /buchen und /ergebnisse."
                  info={<>Beispiel: „Vor 5 Std.: Max M. hat Fahrt gebucht ✓“.</>}
                  on={settingOn('social_proof_enabled')}
                  control={sw('social_proof_enabled', 'Social-Proof-Toast')}
                />
                <SettingCard
                  icon={Bell}
                  title="Tägliche Fahrt-Erinnerung"
                  description="Kunden erhalten zur eingestellten Uhrzeit eine E-Mail zu ihrer Fahrt am nächsten Tag (DE/EN/TR)."
                  on={reminderEnabled}
                  control={
                    <Toggle
                      label="Tägliche Fahrt-Erinnerung"
                      on={reminderEnabled}
                      disabled={reminderSaving}
                      onClick={async () => {
                        const newVal = !reminderEnabled;
                        setReminderSaving(true);
                        try {
                          await adminApi.saveReminderSettings({ enabled: newVal });
                          setReminderEnabled(newVal);
                        } catch {}
                        setReminderSaving(false);
                      }}
                    />
                  }
                >
                  {reminderEnabled && (
                    <div className="flex flex-wrap items-center gap-3">
                      <Field inline label="Versand um" unit="Uhr" type="time" widthClass="w-[7.5rem]" value={reminderTime} disabled={reminderSaving} onChange={(e) => setReminderTime(e.target.value)} />
                      <button
                        type="button"
                        onClick={async () => {
                          setReminderSaving(true);
                          try {
                            await adminApi.saveReminderSettings({ time: reminderTime });
                            setPriceSuccess('Erinnerungszeit gespeichert');
                            setTimeout(() => setPriceSuccess(''), 3000);
                          } catch {}
                          setReminderSaving(false);
                        }}
                        disabled={reminderSaving}
                        className="h-10 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-50"
                      >
                        {reminderSaving ? 'Speichert…' : 'Speichern'}
                      </button>
                    </div>
                  )}
                </SettingCard>
              </div>
            </SectionCard>

            {/* Ungespeicherte Änderungen / Erfolgsmeldung */}
            {(pendingChanges > 0 || priceSuccess) && (
              <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
                {pendingChanges > 0 ? (
                  <div role="status" className="pointer-events-auto flex items-center gap-4 rounded-2xl bg-primary-700 py-2.5 pl-5 pr-2.5 text-sm text-white shadow-xl">
                    <span>{pendingChanges} {pendingChanges === 1 ? 'ungespeicherte Änderung' : 'ungespeicherte Änderungen'}</span>
                    <button
                      type="button"
                      onClick={saveAllChanges}
                      disabled={settingsSaving}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gold-400 px-4 font-semibold text-primary-800 transition hover:bg-gold-500 disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" aria-hidden />
                      {settingsSaving ? 'Speichert…' : 'Jetzt speichern'}
                    </button>
                  </div>
                ) : (
                  <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-xl">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    {priceSuccess}
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })()}

        {/* Statistik Tab */}
        {activeTab === 'statistics' && (
          <div className="space-y-6">
            {!detailedStats ? (
              <div className="text-center py-12 text-gray-400">Statistiken werden geladen...</div>
            ) : (
              <>
                {calStats?.enabled && <CalendarRevenuePanel stats={calStats} onChanged={loadDetailedStats} />}

                {/* KPI Summary Row */}
                {(() => {
                  const avg = detailedStats.avgStats as { avg_price: number; avg_distance: number; avg_passengers: number; max_price: number; min_price: number };
                  const monthly = detailedStats.monthlyRevenue as Array<{ month: string; count: number; revenue: number }>;
                  const now = new Date();
                  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  const currentMonthData = monthly.find(m => m.month === currentMonth);
                  const lastMonth = currentMonthData;
                  const calOn = !!calStats?.enabled && calStats.include;
                  const calMonth = calOn ? calStats!.monthly.find(m => m.month === currentMonth) : undefined;
                  // MTD karşılaştırma: bu ayın 1→bugün vs geçen ayın 1→aynı gün
                  const mtd = detailedStats.mtdComparison as Array<{ period: string; revenue: number; count: number }> | undefined;
                  const mtdCurrent = mtd?.find(r => r.period === 'current');
                  const mtdPrevious = mtd?.find(r => r.period === 'previous');
                  const mtdCurRev = Number(mtdCurrent?.revenue ?? 0) + (calOn ? calStats!.mtd.current.revenue : 0);
                  const mtdPrevRev = Number(mtdPrevious?.revenue ?? 0) + (calOn ? calStats!.mtd.previous.revenue : 0);
                  const growth = mtdPrevRev > 0
                    ? (((mtdCurRev - mtdPrevRev) / mtdPrevRev) * 100).toFixed(1)
                    : null;
                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white rounded-2xl p-5 shadow-sm">
                        <div className="text-xs text-gray-500 mb-1">Ø Fahrpreis</div>
                        <div className="text-2xl font-bold text-gray-900">{formatPrice(avg?.avg_price ?? 0)}</div>
                        <div className="text-xs text-gray-400 mt-1">Höchst: {formatPrice(avg?.max_price ?? 0)}</div>
                      </div>
                      <div className="bg-white rounded-2xl p-5 shadow-sm">
                        <div className="text-xs text-gray-500 mb-1">Ø Distanz</div>
                        <div className="text-2xl font-bold text-gray-900">{avg?.avg_distance ? `${avg.avg_distance} km` : '—'}</div>
                        <div className="text-xs text-gray-400 mt-1">Ø Passagiere: {avg?.avg_passengers ?? '—'}</div>
                      </div>
                      <div className="bg-white rounded-2xl p-5 shadow-sm">
                        <div className="text-xs text-gray-500 mb-1">Dieser Monat</div>
                        <div className="text-2xl font-bold text-gray-900">{lastMonth || calMonth ? formatPrice(Number(lastMonth?.revenue ?? 0) + (calMonth?.revenue ?? 0)) : '—'}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {Number(lastMonth?.count ?? 0) + (calMonth?.count ?? 0)} Fahrten
                          {calMonth && <span className="text-teal-600"> · davon Kalender {formatPrice(calMonth.revenue)} ({calMonth.count})</span>}
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl p-5 shadow-sm">
                        <div className="text-xs text-gray-500 mb-1">Wachstum (1–{now.getDate()}. {now.toLocaleString('de-DE', { month: 'short' })})</div>
                        <div className={`text-2xl font-bold ${growth !== null ? (parseFloat(growth) >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                          {growth !== null ? `${parseFloat(growth) >= 0 ? '+' : ''}${growth}%` : '—'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          vs. {mtdPrevRev > 0 ? formatPrice(mtdPrevRev) : '—'} (Vormonat gleicher Zeitraum{calOn ? ', inkl. Kalender' : ''})
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Monthly Revenue Chart */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-2">Monatlicher Umsatz (letzte 12 Monate{calStats?.enabled && calStats.include ? ', inkl. Kalender' : ''})</h3>
                  <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary-600 inline-block" />Kreditkarte</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Barzahlung</span>
                    {calStats?.enabled && calStats.include && (
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-teal-400 inline-block" />Kalender</span>
                    )}
                  </div>
                  {(() => {
                    type MonthRow = { month: string; count: number; revenue: number; cash_revenue: number; card_revenue: number; cash_count: number; card_count: number; cal_revenue?: number; cal_count?: number; cal_priced?: number };
                    const bookingMonths = detailedStats.monthlyRevenue as MonthRow[];
                    // Calendar-only rides (by ride month) join the bars when switched on; months
                    // before the website only have calendar rides, so they are added as rows.
                    const calOn = !!calStats?.enabled && calStats.include;
                    const d0 = new Date();
                    const firstMonth = new Date(d0.getFullYear(), d0.getMonth() - 11, 1);
                    const minMonth = `${firstMonth.getFullYear()}-${String(firstMonth.getMonth() + 1).padStart(2, '0')}`;
                    const byMonth = new Map<string, MonthRow>(bookingMonths.map(m => [m.month, { ...m, revenue: Number(m.revenue), count: Number(m.count) }]));
                    if (calOn) {
                      for (const c of calStats!.monthly) {
                        if (c.month < minMonth) continue;
                        const r = byMonth.get(c.month) || { month: c.month, count: 0, revenue: 0, cash_revenue: 0, card_revenue: 0, cash_count: 0, card_count: 0 };
                        byMonth.set(c.month, { ...r, revenue: r.revenue + c.revenue, count: r.count + c.count, cal_revenue: c.revenue, cal_count: c.count, cal_priced: c.priced });
                      }
                    }
                    const data = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
                    const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
                    return (
                      <div className="space-y-2">
                        {data.map(d => {
                          const [year, month] = d.month.split('-');
                          const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
                          const totalPct = (d.revenue / maxRevenue) * 100;
                          const cardPct = d.revenue > 0 ? (d.card_revenue / d.revenue) * totalPct : 0;
                          const cashPct = d.revenue > 0 ? (d.cash_revenue / d.revenue) * totalPct : 0;
                          const calPct = d.revenue > 0 ? ((d.cal_revenue ?? 0) / d.revenue) * totalPct : 0;
                          return (
                            <div key={d.month}>
                              <div className="flex items-center gap-3">
                                <div className="w-14 text-xs text-gray-500 text-right shrink-0">{label}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden flex">
                                  <div className="h-full bg-primary-600 transition-all" style={{ width: `${cardPct}%` }} />
                                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${cashPct}%` }} />
                                  {calPct > 0 && <div className="h-full bg-teal-400 transition-all" style={{ width: `${calPct}%` }} />}
                                  <div className="absolute inset-0 flex items-center px-3">
                                    <span className="text-xs font-bold text-white drop-shadow">{formatPrice(d.revenue)}</span>
                                  </div>
                                </div>
                                <div className="w-14 text-xs text-gray-400 shrink-0">{d.count} Fhrt.</div>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 mb-1">
                                <div className="w-14 shrink-0" />
                                <div className="flex-1 flex gap-3 px-1">
                                  {(d.card_revenue ?? 0) > 0 && <span className="text-[11px] text-primary-600 font-medium">Kreditkarte: {formatPrice(d.card_revenue)}</span>}
                                  {(d.cash_revenue ?? 0) > 0 && <span className="text-[11px] text-emerald-600 font-medium">Bar: {formatPrice(d.cash_revenue)}</span>}
                                  {(d.cal_count ?? 0) > 0 && (
                                    <span className="text-[11px] text-teal-600 font-medium">
                                      Kalender: {formatPrice(d.cal_revenue ?? 0)} ({d.cal_count} Fhrt.{(d.cal_count ?? 0) > (d.cal_priced ?? 0) ? `, ${(d.cal_count ?? 0) - (d.cal_priced ?? 0)} ohne Preis` : ''})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Vehicle + Payment breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Vehicle Breakdown */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4">Fahrzeugtypen</h3>
                    {(() => {
                      const data = detailedStats.vehicleBreakdown as Array<{ vehicle_type: string; count: number; revenue: number; avg_price: number }>;
                      const total = data.reduce((s, d) => s + d.count, 0);
                      const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
                      return (
                        <div className="space-y-3">
                          {data.map((d, i) => {
                            const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : '0';
                            return (
                              <div key={d.vehicle_type}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium capitalize">{d.vehicle_type}</span>
                                  <span className="text-gray-500">{d.count} × · Ø {formatPrice(d.avg_price)}</span>
                                </div>
                                <div className="bg-gray-100 rounded-full h-5 relative overflow-hidden">
                                  <div className={`h-full ${colors[i % colors.length]} rounded-full`} style={{ width: `${pct}%` }} />
                                  <div className="absolute inset-0 flex items-center px-2">
                                    <span className="text-xs font-medium text-white drop-shadow">{pct}%</span>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5 text-right">{formatPrice(d.revenue)} Umsatz</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Payment Method */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4">Zahlungsmethoden</h3>
                    {(() => {
                      const data = detailedStats.paymentBreakdown as Array<{ payment_method: string; count: number; revenue: number }>;
                      const total = data.reduce((s, d) => s + d.count, 0);
                      return (
                        <div className="space-y-4">
                          {data.map(d => {
                            const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : '0';
                            // The breakdown is GROUP BY payment_method, so it already carries
                            // every value the column holds — label them all rather than
                            // collapsing everything that is not 'card' into "Barzahlung".
                            const PM_CHART: Record<string, { label: string; bar: string }> = {
                              card: { label: '💳 Kreditkarte', bar: 'bg-blue-500' },
                              cash: { label: '💵 Barzahlung', bar: 'bg-emerald-500' },
                              ueberweisung: { label: '🏦 Überweisung', bar: 'bg-amber-500' },
                              rechnung: { label: '🧾 Auf Rechnung', bar: 'bg-violet-500' },
                              invoice: { label: '🧾 Auf Rechnung', bar: 'bg-violet-500' },
                              transfer: { label: '🏦 Überweisung (Altwert)', bar: 'bg-amber-400' },
                            };
                            const chart = PM_CHART[d.payment_method] || { label: d.payment_method, bar: 'bg-gray-400' };
                            return (
                              <div key={d.payment_method}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium">{chart.label}</span>
                                  <span className="text-gray-500">{d.count} Fahrten</span>
                                </div>
                                <div className="bg-gray-100 rounded-full h-7 relative overflow-hidden">
                                  <div className={`h-full ${chart.bar} rounded-full`} style={{ width: `${pct}%` }} />
                                  <div className="absolute inset-0 flex items-center px-3">
                                    <span className="text-xs font-medium text-white drop-shadow">{pct}% · {formatPrice(d.revenue)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {(() => {
                            const trip = detailedStats.tripTypeStats as Array<{ trip_type: string; count: number; revenue: number }>;
                            const rt = trip.find(t => t.trip_type === 'roundtrip');
                            const ow = trip.find(t => t.trip_type === 'oneway');
                            const totalT = (rt?.count ?? 0) + (ow?.count ?? 0);
                            if (!totalT) return null;
                            const rtPct = totalT > 0 ? (((rt?.count ?? 0) / totalT) * 100).toFixed(1) : '0';
                            return (
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="text-sm font-bold text-gray-700 mb-3">Hin- & Rückfahrt</div>
                                <div className="flex gap-4">
                                  <div className="flex-1 bg-indigo-50 rounded-xl p-3 text-center">
                                    <div className="text-lg font-bold text-indigo-600">{rtPct}%</div>
                                    <div className="text-xs text-gray-500">Rückfahrt ({rt?.count ?? 0}×)</div>
                                  </div>
                                  <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                                    <div className="text-lg font-bold text-gray-600">{(100 - parseFloat(rtPct)).toFixed(1)}%</div>
                                    <div className="text-xs text-gray-500">Einfach ({ow?.count ?? 0}×)</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Day of week + Hour heatmap */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Day of week — improved */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4">Buchungen nach Wochentag</h3>
                    {(() => {
                      const data = detailedStats.dayOfWeekStats as Array<{ dow: number; count: number; revenue: number }>;
                      const daysShort = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
                      const daysFull = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
                      const maxCount = Math.max(...data.map(d => d.count), 1);
                      const totalCount = data.reduce((s, d) => s + d.count, 0);
                      const bestDow = data.reduce((best, d) => d.count > (best?.count ?? 0) ? d : best, data[0]);
                      return (
                        <div className="space-y-2">
                          {daysShort.map((day, i) => {
                            const d = data.find(x => x.dow === i);
                            const count = d?.count ?? 0;
                            const revenue = d?.revenue ?? 0;
                            const pct = (count / maxCount) * 100;
                            const totalPct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(0) : '0';
                            const isBest = bestDow?.dow === i;
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <div className={`w-7 text-xs font-semibold shrink-0 ${isBest ? 'text-primary-600' : 'text-gray-500'}`}>{day}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${isBest ? 'bg-primary-600' : 'bg-primary-400'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                  {count > 0 && (
                                    <div className="absolute inset-0 flex items-center px-3 gap-2">
                                      <span className="text-xs font-bold text-white drop-shadow">{count}</span>
                                      <span className="text-[10px] text-white/70 drop-shadow">{totalPct}%</span>
                                    </div>
                                  )}
                                </div>
                                <div className="w-20 text-xs text-gray-500 shrink-0 text-right">{formatPrice(revenue)}</div>
                              </div>
                            );
                          })}
                          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                            <span>Stärkster Tag: <strong className="text-primary-600">{daysFull[bestDow?.dow ?? 0]} ({bestDow?.count ?? 0}×)</strong></span>
                            <span>Gesamt: {totalCount}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Hour heatmap — improved with time blocks */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-1">Buchungen nach Uhrzeit</h3>
                    <p className="text-xs text-gray-400 mb-4">Wann werden Buchungen aufgegeben?</p>
                    {(() => {
                      const data = detailedStats.hourStats as Array<{ hour: number; count: number }>;
                      const maxCount = Math.max(...data.map(d => d.count), 1);
                      const peakHour = data.reduce((best, d) => d.count > (best?.count ?? 0) ? d : best, data[0]);
                      const timeBlocks = [
                        { label: 'Nacht', range: '00–06', hours: [0,1,2,3,4,5], color: 'text-indigo-500' },
                        { label: 'Morgen', range: '06–12', hours: [6,7,8,9,10,11], color: 'text-amber-500' },
                        { label: 'Mittag', range: '12–18', hours: [12,13,14,15,16,17], color: 'text-orange-500' },
                        { label: 'Abend', range: '18–24', hours: [18,19,20,21,22,23], color: 'text-blue-500' },
                      ];
                      return (
                        <div>
                          <div className="space-y-3">
                            {timeBlocks.map(block => (
                              <div key={block.label}>
                                <div className={`text-xs font-semibold mb-1.5 ${block.color}`}>
                                  {block.label} <span className="text-gray-400 font-normal">{block.range} Uhr</span>
                                </div>
                                <div className="grid grid-cols-6 gap-1">
                                  {block.hours.map(h => {
                                    const d = data.find(x => x.hour === h);
                                    const count = d?.count ?? 0;
                                    const intensity = Math.round((count / maxCount) * 5);
                                    const bg = ['bg-gray-100','bg-primary-100','bg-primary-200','bg-primary-400','bg-primary-600','bg-primary-800'][intensity];
                                    const textColor = intensity >= 3 ? 'text-white' : 'text-gray-500';
                                    const isPeak = peakHour?.hour === h;
                                    return (
                                      <div
                                        key={h}
                                        title={`${h}:00 Uhr — ${count} Fahrten`}
                                        className={`${bg} rounded-lg aspect-square flex flex-col items-center justify-center cursor-default ${isPeak ? 'ring-2 ring-primary-400' : ''}`}
                                      >
                                        <span className={`text-sm font-bold ${textColor}`}>{h}</span>
                                        {count > 0 && <span className={`text-[11px] ${textColor} opacity-80`}>{count}×</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                              <span>Wenig</span>
                              {['bg-gray-100','bg-primary-100','bg-primary-200','bg-primary-400','bg-primary-600','bg-primary-800'].map((c,i) => (
                                <div key={i} className={`${c} w-3 h-3 rounded`} />
                              ))}
                              <span>Viel</span>
                            </div>
                            <span>Peak: <strong className="text-primary-600">{peakHour?.hour ?? 0}:00 Uhr</strong></span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Weekly Revenue + Price Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Weekly Revenue */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-2">Wöchentlicher Umsatz (letzte 8 Wochen)</h3>
                    <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary-600 inline-block" />Kreditkarte</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Barzahlung</span>
                    </div>
                    {(() => {
                      const data = (detailedStats.weeklyRevenue as Array<{ week: string; count: number; revenue: number; cash_revenue: number; card_revenue: number; cash_count: number; card_count: number }>) || [];
                      const maxRev = Math.max(...data.map(d => d.revenue), 1);
                      return (
                        <div className="space-y-2">
                          {data.map((d, i) => {
                            const totalPct = (d.revenue / maxRev) * 100;
                            const cardPct = d.revenue > 0 ? (d.card_revenue / d.revenue) * totalPct : 0;
                            const cashPct = d.revenue > 0 ? (d.cash_revenue / d.revenue) * totalPct : 0;
                            const weekNum = d.week.split('-W')[1];
                            return (
                              <div key={i}>
                                <div className="flex items-center gap-3">
                                  <div className="w-14 text-xs text-gray-500 shrink-0">KW {weekNum}</div>
                                  <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden flex">
                                    <div className="h-full bg-primary-600 transition-all" style={{ width: `${cardPct}%` }} />
                                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${cashPct}%` }} />
                                    <div className="absolute inset-0 flex items-center px-3">
                                      <span className="text-xs font-bold text-white drop-shadow">{formatPrice(d.revenue)}</span>
                                    </div>
                                  </div>
                                  <div className="w-12 text-xs text-gray-400 shrink-0 text-right">{d.count} Fhrt.</div>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 mb-1">
                                  <div className="w-14 shrink-0" />
                                  <div className="flex-1 flex gap-3 px-1">
                                    {(d.card_revenue ?? 0) > 0 && <span className="text-[11px] text-primary-600 font-medium">Kreditkarte: {formatPrice(d.card_revenue)}</span>}
                                    {(d.cash_revenue ?? 0) > 0 && <span className="text-[11px] text-emerald-600 font-medium">Bar: {formatPrice(d.cash_revenue)}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {data.length === 0 && <div className="text-gray-400 text-sm text-center py-4">Keine Daten</div>}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Top 5 by trip date */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-1">Top 5 Fahrt-Tage</h3>
                    <p className="text-xs text-gray-400 mb-4">🚗 Yolculuk tarihi (ne zaman yapıldı)</p>
                    {(() => {
                      const data = (detailedStats.topDaysByTrip as Array<{ day: string; count: number; revenue: number }>) || [];
                      const maxRev = Math.max(...data.map(d => d.revenue), 1);
                      return (
                        <div className="space-y-3">
                          {data.map((d, i) => {
                            const date = new Date(d.day);
                            const label = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' });
                            const pct = (d.revenue / maxRev) * 100;
                            const medals = ['🥇','🥈','🥉','4.','5.'];
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <div className="w-6 text-sm shrink-0 text-center">{medals[i]}</div>
                                <div className="w-28 text-xs text-gray-500 shrink-0">{label}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                                  <div className={`h-full rounded-full ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-green-400'}`} style={{ width: `${pct}%` }} />
                                  <div className="absolute inset-0 flex items-center px-3">
                                    <span className="text-xs font-bold text-white drop-shadow">{formatPrice(d.revenue)}</span>
                                  </div>
                                </div>
                                <div className="w-10 text-xs text-gray-400 shrink-0 text-right">{d.count}×</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Price Distribution */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4">Preis-Verteilung</h3>
                    {(() => {
                      const data = (detailedStats.priceDistribution as Array<{ bucket: string; count: number; revenue: number }>) || [];
                      const maxCount = Math.max(...data.map(d => d.count), 1);
                      const totalCount = data.reduce((s, d) => s + d.count, 0);
                      const colors = ['bg-sky-400','bg-blue-500','bg-primary-500','bg-primary-600','bg-primary-700','bg-primary-800'];
                      return (
                        <div className="space-y-2">
                          {data.map((d, i) => {
                            const pct = (d.count / maxCount) * 100;
                            const share = totalCount > 0 ? ((d.count / totalCount) * 100).toFixed(0) : '0';
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <div className="w-20 text-xs text-gray-500 shrink-0">{d.bucket}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                                  <div className={`h-full ${colors[i]} rounded-full`} style={{ width: `${pct}%` }} />
                                  {d.count > 0 && (
                                    <div className="absolute inset-0 flex items-center px-3 gap-2">
                                      <span className="text-xs font-bold text-white drop-shadow">{d.count}×</span>
                                      <span className="text-[10px] text-white/70 drop-shadow">{share}%</span>
                                    </div>
                                  )}
                                </div>
                                <div className="w-20 text-xs text-gray-400 shrink-0 text-right">{formatPrice(d.revenue)}</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Lead Time + Language */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Lead Time */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-1">Vorlaufzeit-Analyse</h3>
                    <p className="text-xs text-gray-400 mb-4">Wie weit im Voraus buchen Kunden?</p>
                    {(() => {
                      const data = (detailedStats.leadTimeBuckets as Array<{ bucket: string; count: number }>) || [];
                      const totalCount = data.reduce((s, d) => s + d.count, 0);
                      const maxCount = Math.max(...data.map(d => d.count), 1);
                      const bucketColors = ['bg-red-400','bg-orange-400','bg-amber-400','bg-lime-500','bg-green-500','bg-emerald-600'];
                      return (
                        <div className="space-y-2">
                          {data.map((d, i) => {
                            const pct = (d.count / maxCount) * 100;
                            const share = totalCount > 0 ? ((d.count / totalCount) * 100).toFixed(0) : '0';
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <div className="w-24 text-xs text-gray-500 shrink-0">{d.bucket}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                                  <div className={`h-full ${bucketColors[i % bucketColors.length]} rounded-full`} style={{ width: `${pct}%` }} />
                                  {d.count > 0 && (
                                    <div className="absolute inset-0 flex items-center px-3 gap-2">
                                      <span className="text-xs font-bold text-white drop-shadow">{d.count}×</span>
                                      <span className="text-[10px] text-white/70 drop-shadow">{share}%</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Language + Top Days */}
                  <div className="space-y-4">
                    {/* Language breakdown */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm">
                      <h3 className="font-bold text-gray-900 mb-3">Kundensprache</h3>
                      {(() => {
                        const data = (detailedStats.languageStats as Array<{ language: string; count: number; revenue: number }>) || [];
                        const total = data.reduce((s, d) => s + d.count, 0);
                        return (
                          <div className="flex gap-3">
                            {data.map(d => {
                              const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : '0';
                              const isDE = d.language === 'de';
                              return (
                                <div key={d.language} className={`flex-1 rounded-xl p-3 text-center ${isDE ? 'bg-blue-50' : 'bg-red-50'}`}>
                                  <div className={`text-2xl font-bold ${isDE ? 'text-blue-600' : 'text-red-500'}`}>{pct}%</div>
                                  <div className="text-xs font-semibold text-gray-600 mt-0.5">{isDE ? '🇩🇪 Deutsch' : '🇬🇧 Englisch'}</div>
                                  <div className="text-xs text-gray-400">{d.count} · {formatPrice(d.revenue)}</div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Extras overview */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm">
                      <h3 className="font-bold text-gray-900 mb-3">Extras & Gepäck</h3>
                      {(() => {
                        const e = detailedStats.extrasStats as { fahrrad_bookings: number; total_fahrrad: number; child_seat_bookings: number; avg_luggage: number; heavy_luggage_bookings: number; total: number } | null;
                        if (!e) return <div className="text-gray-400 text-sm">Keine Daten</div>;
                        const items = [
                          { label: 'Kindersitz', value: e.child_seat_bookings, sub: 'Buchungen', color: 'text-pink-500', bg: 'bg-pink-50' },
                          { label: 'Fahrräder', value: e.fahrrad_bookings, sub: `${e.total_fahrrad} Stück`, color: 'text-green-600', bg: 'bg-green-50' },
                          { label: 'Ø Gepäck', value: e.avg_luggage ?? 0, sub: 'Stück/Fahrt', color: 'text-amber-600', bg: 'bg-amber-50', decimal: true },
                          { label: 'Viel Gepäck', value: e.heavy_luggage_bookings, sub: '4+ Stück', color: 'text-orange-600', bg: 'bg-orange-50' },
                        ];
                        return (
                          <div className="grid grid-cols-4 gap-2">
                            {items.map(item => (
                              <div key={item.label} className={`${item.bg} rounded-xl p-2.5 text-center`}>
                                <div className={`text-xl font-bold ${item.color}`}>
                                  {item.decimal ? Number(item.value).toFixed(1) : item.value}
                                </div>
                                <div className="text-[10px] font-semibold text-gray-600">{item.label}</div>
                                <div className="text-[9px] text-gray-400">{item.sub}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Top 5 Days + Cancellation Rate */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top 5 earning days */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-1">Top 5 Umsatz-Tage</h3>
                    <p className="text-xs text-gray-400 mb-4">📅 Sipariş tarihi (ne zaman alındı)</p>
                    {(() => {
                      const data = (detailedStats.topDays as Array<{ day: string; count: number; revenue: number }>) || [];
                      const maxRev = Math.max(...data.map(d => d.revenue), 1);
                      return (
                        <div className="space-y-3">
                          {data.map((d, i) => {
                            const date = new Date(d.day);
                            const label = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' });
                            const pct = (d.revenue / maxRev) * 100;
                            const medals = ['🥇','🥈','🥉','4.','5.'];
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <div className="w-6 text-sm shrink-0 text-center">{medals[i]}</div>
                                <div className="w-28 text-xs text-gray-500 shrink-0">{label}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                                  <div className={`h-full rounded-full ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-primary-400'}`} style={{ width: `${pct}%` }} />
                                  <div className="absolute inset-0 flex items-center px-3">
                                    <span className="text-xs font-bold text-white drop-shadow">{formatPrice(d.revenue)}</span>
                                  </div>
                                </div>
                                <div className="w-10 text-xs text-gray-400 shrink-0 text-right">{d.count}×</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Cancellation Rate */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4">Stornierungsrate (letzte 6 Monate)</h3>
                    {(() => {
                      const data = (detailedStats.cancellationStats as Array<{ month: string; total: number; cancelled: number }>) || [];
                      return (
                        <div className="space-y-2">
                          {data.map(d => {
                            const [year, month] = d.month.split('-');
                            const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
                            const rate = d.total > 0 ? ((d.cancelled / d.total) * 100) : 0;
                            const confirmed = d.total - d.cancelled;
                            return (
                              <div key={d.month} className="flex items-center gap-3">
                                <div className="w-12 text-xs text-gray-500 shrink-0">{label}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden flex">
                                  <div className="h-full bg-emerald-500" style={{ width: `${100 - rate}%` }} />
                                  <div className="h-full bg-red-400" style={{ width: `${rate}%` }} />
                                  <div className="absolute inset-0 flex items-center px-3 gap-2">
                                    <span className="text-xs font-medium text-white drop-shadow">{confirmed} best.</span>
                                    {d.cancelled > 0 && <span className="text-xs text-white/80 drop-shadow">{d.cancelled} storn.</span>}
                                  </div>
                                </div>
                                <div className={`w-12 text-xs shrink-0 text-right font-semibold ${rate > 20 ? 'text-red-500' : rate > 10 ? 'text-orange-500' : 'text-emerald-600'}`}>
                                  {rate.toFixed(0)}%
                                </div>
                              </div>
                            );
                          })}
                          {data.length === 0 && <div className="text-gray-400 text-sm text-center py-4">Keine Daten</div>}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Visitor Countries + Cities */}
                {(() => {
                  const flags: Record<string, string> = {
                    DE: '🇩🇪', AT: '🇦🇹', CH: '🇨🇭', US: '🇺🇸', GB: '🇬🇧', FR: '🇫🇷', IT: '🇮🇹', NL: '🇳🇱', ES: '🇪🇸', PL: '🇵🇱',
                    TR: '🇹🇷', CZ: '🇨🇿', RU: '🇷🇺', CN: '🇨🇳', JP: '🇯🇵', KR: '🇰🇷', IN: '🇮🇳', BR: '🇧🇷', CA: '🇨🇦', AU: '🇦🇺',
                    SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮', BE: '🇧🇪', PT: '🇵🇹', GR: '🇬🇷', HU: '🇭🇺', RO: '🇷🇴', HR: '🇭🇷',
                    IE: '🇮🇪', SK: '🇸🇰', BG: '🇧🇬', RS: '🇷🇸', UA: '🇺🇦', IL: '🇮🇱', AE: '🇦🇪', SA: '🇸🇦', MX: '🇲🇽', AR: '🇦🇷',
                  };
                  const rangeLabel: Record<string, string> = { 'today': 'Heute', '7d': 'Letzte 7 Tage', '30d': 'Letzte 30 Tage', '6m': 'Letzte 6 Monate', 'all': 'Gesamt' };
                  const countries = geoStats?.visitorCountries || [];
                  const cities = geoStats?.visitorCities || [];
                  const totalSessions = countries.reduce((s: number, d: any) => s + Number(d.sessions), 0);
                  const maxCountry = Math.max(...countries.map((d: any) => Number(d.sessions)), 1);
                  const maxCity = Math.max(...cities.map((d: any) => Number(d.sessions)), 1);
                  return (
                    <div className="space-y-4">
                      {/* Range toggle */}
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900">Ziyaretçi Coğrafyası</h3>
                        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                          {(['today', '7d', '30d', '6m', 'all'] as const).map(r => (
                            <button
                              key={r}
                              onClick={() => { setGeoRange(r); loadGeoStats(r); }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${geoRange === r ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                              {r === 'today' ? 'Heute' : r === '7d' ? '7 Tage' : r === '30d' ? '30 Tage' : r === '6m' ? '6 Mon.' : 'Gesamt'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {geoLoading ? (
                        <div className="text-center py-8 text-gray-400 text-sm">Wird geladen...</div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Countries */}
                          <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h4 className="font-semibold text-gray-800 mb-1">Nach Land</h4>
                            <p className="text-xs text-gray-400 mb-4">{rangeLabel[geoRange]} · IP-Geolokalisierung</p>
                            {countries.length === 0 ? (
                              <div className="text-gray-400 text-sm text-center py-4">Keine Daten</div>
                            ) : (
                              <div className="space-y-2">
                                {countries.map((d: any, i: number) => {
                                  const pct = totalSessions > 0 ? ((Number(d.sessions) / totalSessions) * 100).toFixed(1) : '0';
                                  const barPct = (Number(d.sessions) / maxCountry) * 100;
                                  const colors = ['bg-blue-600','bg-blue-500','bg-blue-400','bg-sky-500','bg-sky-400','bg-cyan-500'];
                                  return (
                                    <div key={d.country} className="flex items-center gap-3">
                                      <div className="w-16 text-sm shrink-0 flex items-center gap-1.5">
                                        <span>{flags[d.country] || '🏳️'}</span>
                                        <span className="text-xs font-medium text-gray-600">{d.country}</span>
                                      </div>
                                      <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                                        <div className={`h-full ${colors[i % colors.length]} rounded-full`} style={{ width: `${barPct}%` }} />
                                        <div className="absolute inset-0 flex items-center px-3 gap-2">
                                          <span className="text-xs font-bold text-white drop-shadow">{d.sessions}</span>
                                          <span className="text-[10px] text-white/70 drop-shadow">{pct}%</span>
                                        </div>
                                      </div>
                                      <div className="w-14 text-xs text-gray-400 shrink-0 text-right">{d.visitors} Bes.</div>
                                    </div>
                                  );
                                })}
                                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                                  <span>Gesamt: {totalSessions} Sitzungen</span>
                                  <span>{countries.length} Länder</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Cities */}
                          <div className="bg-white rounded-2xl p-6 shadow-sm">
                            <h4 className="font-semibold text-gray-800 mb-1">Top Städte</h4>
                            <p className="text-xs text-gray-400 mb-4">{rangeLabel[geoRange]} · Top 15</p>
                            {cities.length === 0 ? (
                              <div className="text-gray-400 text-sm text-center py-4">Keine Daten</div>
                            ) : (
                              <div className="space-y-2">
                                {cities.map((d: any, i: number) => {
                                  const barPct = (Number(d.sessions) / maxCity) * 100;
                                  const colors = ['bg-emerald-600','bg-emerald-500','bg-emerald-400','bg-teal-500','bg-teal-400','bg-cyan-500'];
                                  return (
                                    <div key={`${d.city}-${d.country}`} className="flex items-center gap-3">
                                      <div className="w-36 text-xs shrink-0 flex items-center gap-1.5 truncate">
                                        <span className="text-sm">{flags[d.country] || '🏳️'}</span>
                                        <span className="font-medium text-gray-600 truncate">{d.city}</span>
                                      </div>
                                      <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                                        <div className={`h-full ${colors[i % colors.length]} rounded-full`} style={{ width: `${barPct}%` }} />
                                        <div className="absolute inset-0 flex items-center px-3">
                                          <span className="text-xs font-bold text-white drop-shadow">{d.sessions}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </AdminShell>

      {/* Legacy Card Info Popup — only for pre-Stripe-migration bookings (raw card data,
          no stripe_payment_method_id). Remove once all such bookings are processed. */}
      {showCardPopup && selectedBooking && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCardPopup(false); setCardVisible(false); } }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-amber-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💳</span>
                <div>
                  <h3 className="font-bold text-lg">Kartendaten (alte Buchung)</h3>
                  <p className="text-amber-100 text-xs">{selectedBooking.booking_number}</p>
                </div>
              </div>
              <button onClick={() => { setShowCardPopup(false); setCardVisible(false); }} className="p-2 hover:bg-amber-700 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gradient-to-br from-amber-600 to-amber-800 rounded-xl p-5 text-white space-y-3 shadow-lg">
                <div>
                  <p className="text-amber-200 text-xs mb-1">Karteninhaber</p>
                  <p className="font-bold text-lg tracking-wide">{selectedBooking.card_holder || '—'}</p>
                </div>
                <div>
                  <p className="text-amber-200 text-xs mb-1">Kartennummer</p>
                  <p className="font-mono text-xl tracking-widest">
                    {cardVisible
                      ? (selectedBooking.card_number || '').replace(/(.{4})/g, '$1 ').trim()
                      : '•••• •••• •••• ' + (selectedBooking.card_number?.slice(-4) || '????')}
                  </p>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="text-amber-200 text-xs mb-1">Gültig bis</p>
                    <p className="font-mono font-bold">{selectedBooking.card_expiry || '—'}</p>
                  </div>
                  <div>
                    <p className="text-amber-200 text-xs mb-1">CVV</p>
                    <p className="font-mono font-bold">{cardVisible ? selectedBooking.card_cvv : '•••'}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setCardVisible(!cardVisible)}
                className="w-full flex items-center justify-center gap-2 border-2 border-amber-600 text-amber-700 hover:bg-amber-50 rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                <Eye size={16} />
                {cardVisible ? 'Verbergen' : 'Vollständig anzeigen'}
              </button>
              <p className="text-xs text-gray-400 text-center">🔒 Diese Daten sind nur für Administratoren sichtbar — alte Buchung, noch nicht auf Stripe migriert</p>
            </div>
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedBooking(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-primary-600 text-white p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{selectedBooking.booking_number}</h2>
                <p className="text-primary-200 text-sm">Buchungsdetails</p>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-primary-700 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              {/* Fahrer & Live-Tracking — top of modal (components/tracking/BookingTrackingPanel) */}
              <BookingTrackingPanel booking={selectedBooking} />

              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status:</span>
                <div className="flex gap-2">
                  {['new', 'confirmed', 'completed', 'cancelled'].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selectedBooking.id, s)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                        selectedBooking.status === s
                          ? STATUS_COLORS[s]
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              {/* Endgültige Bestätigung (Mail an den Kunden) */}
              <FinalConfirmButton key={`fc-${selectedBooking.id}`} booking={selectedBooking as any}
                onSent={(at) => setBookings(prev => prev.map(b => b.id === selectedBooking.id ? ({ ...b, confirmed_email_sent_at: at, status: b.status === 'new' ? 'confirmed' : b.status } as any) : b))} />
              {/* Persönlicher Gutschein (Entschuldigung/Dankeschön) für diesen Kunden */}
              <div className="flex justify-end gap-2">
                <ResendAdminMailButton key={`am-${selectedBooking.id}`} bookingId={selectedBooking.id} />
                <GutscheinButton key={`gs-${selectedBooking.id}`} prefill={{ name: selectedBooking.name, email: selectedBooking.email, lang: selectedBooking.language }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Preis</p>
                  <p className="text-xl font-bold text-primary-600">{formatPrice(selectedBooking.price)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Zahlung</p>
                  {selectedBooking.payment_method === 'card' && (selectedBooking.company_id || selectedBooking.stripe_payment_method_id) ? (
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">
                        {selectedBooking.company_id
                          ? '🏢 Firmenkunde'
                          : `${(selectedBooking.card_brand || 'Karte').toUpperCase()} •••• ${selectedBooking.card_last4 || ''}`}
                      </p>
                      {selectedBooking.charge_status === 'succeeded' ? (
                        <span className="text-xs text-green-600 font-medium">Abgebucht</span>
                      ) : (
                        <button
                          onClick={() => handleChargeSavedCard(selectedBooking.id)}
                          disabled={chargingId === selectedBooking.id}
                          className="flex items-center gap-1 text-xs bg-primary-600 hover:bg-primary-700 text-white px-2 py-1 rounded-lg whitespace-nowrap transition-colors disabled:opacity-50"
                        >
                          <Zap size={11} />
                          {chargingId === selectedBooking.id ? '...' : (selectedBooking.charge_status === 'failed' ? 'Erneut versuchen' : 'Abbuchen')}
                        </button>
                      )}
                    </div>
                  ) : selectedBooking.payment_method === 'card' && selectedBooking.card_number ? (
                    <button
                      onClick={() => { setShowCardPopup(true); setCardVisible(false); }}
                      className="font-semibold text-amber-700 underline underline-offset-2 flex items-center gap-1 hover:text-amber-900 transition-colors"
                      title="Alte Buchung — noch keine Stripe-Karte"
                    >
                      💳 Karte — Details anzeigen
                    </button>
                  ) : (
                    <p className="font-semibold">{paymentLabel(selectedBooking.payment_method)}</p>
                  )}
                </div>
              </div>

              {/* Steuersatz - applies to any payment method (relevant for company/Sammelrechnung billing too) */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Steuersatz:</span>
                <div className="flex gap-2">
                  {[7, 19].map((rate) => (
                    <button
                      key={rate}
                      onClick={async () => {
                        const newRate = selectedBooking.steuersatz === rate ? null : rate;
                        try {
                          const updated = await adminApi.updateSteuersatz(selectedBooking.id, newRate);
                          setSelectedBooking(prev => prev ? { ...prev, steuersatz: newRate } : null);
                          setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, steuersatz: newRate } : b));
                        } catch (err) { console.error(err); }
                      }}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                        selectedBooking.steuersatz === rate
                          ? rate === 7 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Stripe Zahlungsdatum - only for card payments */}
              {selectedBooking.payment_method === 'card' && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Stripe Zahlungsdatum:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      defaultValue={selectedBooking.stripe_payment_date ? selectedBooking.stripe_payment_date.substring(0, 10) : ''}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      onChange={async (e) => {
                        const val = e.target.value || null;
                        try {
                          const updated = await adminApi.setStripeDate(selectedBooking.id, val ? `${val}T12:00:00` : null);
                          setSelectedBooking(prev => prev ? { ...prev, stripe_payment_date: val ? `${val}T12:00:00` : null } : null);
                          setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, stripe_payment_date: val ? `${val}T12:00:00` : null } : b));
                        } catch (err) { console.error(err); }
                      }}
                    />
                    {selectedBooking.stripe_payment_date && (
                      <span className="text-xs text-green-600 font-medium">gesetzt</span>
                    )}
                  </div>
                </div>
              )}

              {[
                { label: 'Abholung', value: selectedBooking.pickup_address },
                { label: 'Ziel', value: selectedBooking.dropoff_address },
                { label: 'Fahrttyp', value: selectedBooking.trip_type === 'roundtrip' ? '⇄ Hin- & Rückfahrt' : '→ Einfache Fahrt' },
                { label: 'Hinfahrt', value: formatDateTime(selectedBooking.pickup_datetime) },
                { label: 'Rückfahrt', value: selectedBooking.return_datetime ? formatDateTime(selectedBooking.return_datetime) : '-' },
                { label: 'Fahrzeug', value: selectedBooking.vehicle_type },
                { label: 'Passagiere', value: selectedBooking.passengers.toString() },
                { label: 'Distanz', value: selectedBooking.distance_km ? `${selectedBooking.distance_km.toFixed(1)} km` : '-' },
                { label: 'Name', value: selectedBooking.name },
                { label: 'Telefon', value: selectedBooking.phone },
                { label: 'E-Mail', value: selectedBooking.email },
                { label: 'Flugnummer', value: selectedBooking.flight_number || '-' },
                { label: 'Kindersitz', value: selectedBooking.child_seat ? `Ja${selectedBooking.child_seat_details ? ' — ' + selectedBooking.child_seat_details : ''}` : 'Nein' },
                { label: 'Fahrrad', value: selectedBooking.fahrrad_count ? `${selectedBooking.fahrrad_count}×` : 'Nein' },
                { label: 'Gepäck', value: `${selectedBooking.luggage_count} Stück` },
                { label: 'Sprache', value: selectedBooking.language?.toUpperCase() || '-' },
                { label: 'Notizen', value: selectedBooking.notes || '-' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between border-b border-gray-100 py-2 last:border-0">
                  <span className="text-gray-500">{label}:</span>
                  <span className="font-medium text-right max-w-xs">{value}</span>
                </div>
              ))}
              {/* Phone warnings. Derived from the number itself rather than from a NULL
                  phone_e164, so bookings made before that column existed don't all get
                  flagged as unverified. */}
              {!parsePhone(selectedBooking.phone_e164 || selectedBooking.phone).ok && (
                <div className="flex justify-between border-b border-gray-100 py-2 last:border-0">
                  <span className="text-gray-500">Nummer:</span>
                  <span className="font-medium text-right max-w-xs text-amber-600">
                    ⚠️ Nicht verifizierbar — vor Fahrtantritt bestätigen
                  </span>
                </div>
              )}
              {selectedBooking.phone_line_type && selectedBooking.phone_line_type !== 'mobile' && (
                <div className="flex justify-between border-b border-gray-100 py-2 last:border-0">
                  <span className="text-gray-500">Anschlussart:</span>
                  <span className="font-medium text-right max-w-xs text-amber-600">
                    {selectedBooking.phone_line_type} — WhatsApp/SMS evtl. nicht zustellbar
                  </span>
                </div>
              )}
              {selectedBooking.rechnung_adresse && (
                <div className="flex justify-between border-b border-gray-100 py-2 last:border-0">
                  <span className="text-gray-500">Rechnungsadresse:</span>
                  {/* Multi-line, customer-supplied — needs pre-line inside this flex row */}
                  <span className="font-medium text-right max-w-xs whitespace-pre-line">{selectedBooking.rechnung_adresse}</span>
                </div>
              )}
              {selectedBooking.rechnung_number && (
                <div className="flex justify-between border-b border-gray-100 py-2 last:border-0">
                  <span className="text-gray-500">Rechnung:</span>
                  <span className="font-medium text-right max-w-xs text-emerald-700">
                    {selectedBooking.rechnung_number}
                    {selectedBooking.rechnung_sent_at && ` · ${formatDateTime(selectedBooking.rechnung_sent_at)}`}
                  </span>
                </div>
              )}
              {!selectedBooking.rechnung_number && selectedBooking.rechnung_error && (
                <div className="flex justify-between border-b border-gray-100 py-2 last:border-0">
                  <span className="text-gray-500">Rechnung-Fehler:</span>
                  <span className="font-medium text-right max-w-xs text-red-600">{selectedBooking.rechnung_error}</span>
                </div>
              )}
              {selectedBooking.flight_number && (
                <div className="flex justify-between border-b border-gray-100 py-2 last:border-0">
                  <span className="text-gray-500">Flugstatus:</span>
                  {selectedBooking.flight_validated === '1' ? (
                    <span className="font-medium text-right max-w-xs text-green-600">✓ Bestätigt{selectedBooking.flight_info ? `: ${selectedBooking.flight_info}` : ''}</span>
                  ) : (
                    <span className="font-medium text-right max-w-xs text-yellow-600">⚠ Nicht verifiziert</span>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4 flex-wrap">
                <a
                  href={`tel:${selectedBooking.phone}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  Anrufen
                </a>
                <a
                  href={`https://wa.me/${waNumber(selectedBooking.phone_e164 || selectedBooking.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  WhatsApp
                </a>
                <button
                  onClick={() => {
                    setRechnungsnummer('');
                    setRechnungMwst(
                      selectedBooking.steuersatz === 7 || selectedBooking.steuersatz === 19 || selectedBooking.steuersatz === 0
                        ? selectedBooking.steuersatz
                        : 19
                    );
                    setRechnungMode('rechnung');
                    setRechnungSprache(selectedBooking.language === 'en' ? 'en' : 'de');
                    // Prefer the billing address the customer supplied when booking;
                    // fall back to name + email for older bookings.
                    setRechnungEmpfaenger(
                      selectedBooking.rechnung_adresse
                        || selectedBooking.name + (selectedBooking.email ? '\n' + selectedBooking.email : '')
                    );
                    setEditingEmpfaenger(false);
                    setRechnungZahlungsart(
                      selectedBooking.payment_method === 'card'
                        ? 'kreditkarte'
                        : selectedBooking.payment_method === 'ueberweisung' ? 'ueberweisung' : 'bar'
                    );
                    setRechnungSuccess(false);
                    setRechnungError('');
                    setShowRechnungModal(true);
                    // Vorschlag für die nächste laufende Nummer — bleibt frei editierbar.
                    adminApi.getNextRechnungsnummer()
                      .then((r) => setRechnungsnummer(r.rechnungsnummer))
                      .catch(() => {});
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  <FileText size={15} />
                  Rechnung senden
                </button>
              </div>
              {/* Automatische Rechnung — for customers who asked for an invoice afterwards
                  or never noticed the tickbox at booking time. Storing the address here
                  sets the same rechnung_required flag the tickbox sets, so autoRechnungJob
                  mails the invoice on its own once the ride is over; nobody has to watch
                  the calendar and press "Rechnung senden" on the day. Hidden once an
                  invoice exists — there is nothing left to arm. */}
              {!selectedBooking.rechnung_number && (
                <div className={cn(
                  'mt-3 rounded-xl border p-3',
                  selectedBooking.rechnung_required || autoRechnungViaZahlungsart(selectedBooking, settings)
                    ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'
                )}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <CalendarDays size={15} />
                    Automatische Rechnung
                  </div>
                  {selectedBooking.rechnung_required || autoRechnungViaZahlungsart(selectedBooking, settings) ? (
                    <p className="mt-1 text-xs font-medium text-emerald-700">
                      {(() => {
                        // Name the switch when that is the only reason, so the office knows
                        // why a ride nobody asked about is getting an invoice.
                        const via = !selectedBooking.rechnung_required ? autoRechnungViaZahlungsart(selectedBooking, settings) : null;
                        const tag = via === 'card' ? ' (Kreditkarte-Automatik)' : via === 'cash' ? ' (Bar-Automatik)' : '';
                        const at = autoRechnungSendAt(selectedBooking);
                        if (!at) return `✓ Wird nach der Fahrt automatisch gesendet${tag}.`;
                        return at.getTime() <= Date.now()
                          ? `✓ Fahrt ist vorbei — die Rechnung geht in Kürze automatisch raus${tag}.`
                          : `✓ Wird automatisch gesendet${tag} — ca. ${formatDateTime(at.toISOString())}`;
                      })()}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      Adresse eintragen und aktivieren — die Rechnung geht dann nach der Fahrt von selbst raus.
                    </p>
                  )}
                  {!selectedBooking.rechnung_required && autoRechnungViaZahlungsart(selectedBooking, settings) && (
                    <p className="mt-1 text-[11px] text-gray-500">
                      Ohne Adresse stehen Name und E-Mail des Kunden auf der Rechnung. Für eine Firmenadresse unten eintragen.
                    </p>
                  )}

                  {!selectedBooking.email ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Diese Buchung hat keine E-Mail-Adresse — eine Rechnung kann nicht automatisch versendet werden.
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-[11px] text-gray-500">
                        Jede Angabe in eine eigene Zeile — genau so erscheint sie auf der Rechnung.
                      </p>
                      <textarea
                        value={vormerkenAdresse}
                        onChange={(e) => setVormerkenAdresse(e.target.value)}
                        rows={5}
                        maxLength={500}
                        placeholder={'Firmenname\nVor- und Nachname\nStraße und Hausnummer\nPLZ Ort\nLand'}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-sm focus:border-primary-500 focus:outline-none"
                      />
                      {vormerkenError && (
                        <p className="mt-1 text-xs text-red-600">{vormerkenError}</p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => saveVormerken(true)}
                          disabled={vormerkenSaving || !vormerkenAdresse.trim()}
                          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-medium transition-colors"
                        >
                          {vormerkenSaving
                            ? <><RefreshCw size={15} className="animate-spin" /> Speichern...</>
                            : <><CheckCircle2 size={15} /> {selectedBooking.rechnung_required || autoRechnungViaZahlungsart(selectedBooking, settings) ? 'Adresse speichern' : 'Automatisch senden aktivieren'}</>}
                        </button>
                        {!!selectedBooking.rechnung_required && (
                          <button
                            onClick={() => saveVormerken(false)}
                            disabled={vormerkenSaving}
                            className="px-3 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 border border-gray-300 py-2 rounded-xl text-sm font-medium transition-colors"
                          >
                            Deaktivieren
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
              {/* Proforma: only for bank-transfer rides. Sent BEFORE the ride so the money
                  is on the account in time; the real invoice still goes out automatically
                  afterwards via autoRechnungJob. */}
              {selectedBooking.payment_method === 'ueberweisung' && (
                <button
                  onClick={() => {
                    setRechnungMode('proforma');
                    setRechnungsnummer('');
                    setRechnungMwst(
                      selectedBooking.steuersatz === 7 || selectedBooking.steuersatz === 19 || selectedBooking.steuersatz === 0
                        ? selectedBooking.steuersatz
                        : 19
                    );
                    setRechnungSprache(selectedBooking.language === 'en' ? 'en' : 'de');
                    setRechnungEmpfaenger(
                      selectedBooking.proforma_adresse
                        || selectedBooking.rechnung_adresse
                        || selectedBooking.name + (selectedBooking.email ? '\n' + selectedBooking.email : '')
                    );
                    setEditingEmpfaenger(false);
                    setRechnungZahlungsart('ueberweisung');
                    setRechnungSuccess(false);
                    setRechnungError('');
                    setShowRechnungModal(true);
                    adminApi.getNextProformaNummer()
                      .then((r) => setRechnungsnummer(r.proformanummer))
                      .catch(() => {});
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  <FileText size={15} />
                  Proforma senden
                </button>
              )}
              {/* Rechnungskunde: beim nächsten Mal Überweisung auf /buchen anbieten */}
              <InvoiceCustomerBookingCard key={selectedBooking.id} bookingId={selectedBooking.id} isCompany={!!selectedBooking.company_id} />
              {/* Re-open the invoice that was actually sent (rebuilt from the stored
                  render params, so date and number match the customer's copy). */}
              {selectedBooking.rechnung_number && (
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/admin/bookings/${selectedBooking.id}/rechnung.pdf?token=${typeof window !== 'undefined' ? localStorage.getItem('admin_token') : ''}&v=${Date.now()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  <FileText size={15} />
                  Gesendete Rechnung ansehen ({selectedBooking.rechnung_number})
                </a>
              )}
              {/* Stornorechnung (GoBD): cancel the sent invoice instead of deleting it */}
              <InvoiceStornoCard key={`storno-${selectedBooking.id}`} booking={selectedBooking} onChanged={loadBookings} />
              {selectedBooking.proforma_number && (
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/admin/bookings/${selectedBooking.id}/proforma.pdf?token=${typeof window !== 'undefined' ? localStorage.getItem('admin_token') : ''}&v=${Date.now()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  <FileText size={15} />
                  Gesendete Proforma ansehen ({selectedBooking.proforma_number})
                </a>
              )}
              {/* Confirming the incoming transfer is what makes the real invoice print
                  "Bereits per Überweisung bezahlt" instead of Zahlungsziel + IBAN. */}
              {selectedBooking.payment_method === 'ueberweisung' && (
                <button
                  disabled={ueberweisungSaving}
                  onClick={async () => {
                    const nowPaid = !selectedBooking.ueberweisung_paid_at;
                    setUeberweisungSaving(true);
                    try {
                      const r = await adminApi.setUeberweisungPaid(selectedBooking.id, nowPaid);
                      setSelectedBooking({ ...selectedBooking, ueberweisung_paid_at: r.ueberweisung_paid_at });
                      loadBookings();
                    } catch {
                      alert('Zahlungsstatus konnte nicht gespeichert werden.');
                    } finally {
                      setUeberweisungSaving(false);
                    }
                  }}
                  className={`mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 ${
                    selectedBooking.ueberweisung_paid_at
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300'
                  }`}
                >
                  {selectedBooking.ueberweisung_paid_at
                    ? `✓ Überweisung eingegangen (${new Date(selectedBooking.ueberweisung_paid_at).toLocaleDateString('de-DE')}) — rückgängig`
                    : 'Überweisung eingegangen ✓'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rechnung Tab */}
      {activeTab === 'rechnung' && (
        <div className="space-y-6">
          <StornoRegister />
          {bankSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <Check size={16} />{bankSuccess}
            </div>
          )}
          {/* Automatic invoice by payment method. Two independent switches (card / cash) read
              by autoRechnungJob every minute, so they take effect without a deploy. Switching
              one on is stamped server-side (*_since) and only rides ending after that get an
              invoice — the backlog of old, never-invoiced rides is left alone. */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Send size={18} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Automatischer Rechnungsversand</h3>
                <p className="text-xs text-gray-500">Rechnung per E-Mail 15 Min. nach Fahrtende — zusätzlich zu Kunden, die selbst eine Rechnung angefordert haben</p>
              </div>
            </div>
            <div className="space-y-5">
              {([
                { pm: 'card', label: 'Kreditkarte', text: 'Jede mit Kreditkarte bezahlte Fahrt bekommt automatisch eine Rechnung („Kreditkarte bezahlt“). Fehlgeschlagene Stripe-Zahlungen werden übersprungen.' },
                { pm: 'cash', label: 'Bar', text: 'Jede bar bezahlte Fahrt bekommt automatisch eine Rechnung („Bar bezahlt“).' },
              ] as const).map(({ pm, label, text }) => {
                const key = `auto_rechnung_${pm}_enabled`;
                const on = settings[key] === '1';
                const since = settings[`auto_rechnung_${pm}_since`];
                return (
                  <div key={pm} className="flex items-start justify-between gap-4">
                    <div>
                      <label className="font-semibold text-gray-700">{label}</label>
                      <p className="text-xs text-gray-500 mt-0.5">{text}</p>
                      <p className={cn('text-xs mt-1', on ? 'text-emerald-700 font-medium' : 'text-gray-400')}>
                        {on && since
                          ? `✓ Aktiv seit ${formatDateTime(since.replace(' ', 'T'))} — nur Fahrten, die danach enden.`
                          : 'Aus. Beim Aktivieren bekommen bereits beendete Fahrten keine Rechnung.'}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const newVal = on ? '0' : '1';
                        // Outward-facing: from now on real customers get mail, so confirm first.
                        if (newVal === '1' && !window.confirm(`Ab jetzt bekommt jede ${label}-Fahrt nach Fahrtende automatisch eine Rechnung per E-Mail. Aktivieren?`)) return;
                        setSettingsSaving(true);
                        try {
                          const updated = await adminApi.updateSettings({ [key]: newVal });
                          setSettings(prev => ({ ...prev, ...updated }));
                          setBankSuccess(newVal === '1' ? `${label}: automatische Rechnung aktiviert` : `${label}: automatische Rechnung deaktiviert`);
                          setTimeout(() => setBankSuccess(''), 3000);
                        } catch {
                          alert('Einstellung konnte nicht gespeichert werden.');
                        }
                        setSettingsSaving(false);
                      }}
                      className={cn(
                        'relative w-14 h-7 rounded-full transition-colors shrink-0',
                        on ? 'bg-green-500' : 'bg-gray-300'
                      )}
                      disabled={settingsSaving}
                      aria-label={`${label}: automatische Rechnung ${on ? 'deaktivieren' : 'aktivieren'}`}
                    >
                      <div className={cn(
                        'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
                        on ? 'translate-x-7' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] text-gray-400">
              Firmenkunden (B2B) sind ausgenommen — sie werden über die Sammelrechnung abgerechnet. Ohne Rechnungsadresse stehen Name und E-Mail des Kunden auf der Rechnung. Nur bestätigte oder abgeschlossene Buchungen.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center">
                <Building2 size={18} className="text-primary-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Bankverbindung</h3>
                <p className="text-xs text-gray-500">Wird auf der Rechnung und im PDF angezeigt</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'bank_kontoinhaber', label: 'Kontoinhaber', placeholder: 'Taxi N&N GbR' },
                { key: 'bank_name', label: 'Bankname', placeholder: 'Sparkasse / Deutsche Bank...' },
                { key: 'bank_iban', label: 'IBAN', placeholder: 'DE89 3704 0044 0532 0130 00' },
                { key: 'bank_bic', label: 'BIC / SWIFT', placeholder: 'COBADEFFXXX' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">{label}</label>
                  <input
                    type="text"
                    value={bankSettings[key] || ''}
                    onChange={(e) => setBankSettings(prev => ({ ...prev, [key]: key === 'bank_iban' ? e.target.value.toUpperCase() : e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                <FileText size={18} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Firmendaten</h3>
                <p className="text-xs text-gray-500">Erscheinen im Briefkopf der Rechnung</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'company_name', label: 'Firmenname', placeholder: 'Taxi N&N GbR' },
                { key: 'company_address', label: 'Adresse', placeholder: 'Eisvogelweg 2, 85356 Freising' },
                { key: 'company_phone', label: 'Telefon', placeholder: '+49 151 4162 0000' },
                { key: 'company_email', label: 'E-Mail', placeholder: 'info@flughafen-muenchen.taxi' },
                { key: 'company_steuernr', label: 'Steuer-Nr.', placeholder: '123/456/78900' },
                { key: 'company_ustidnr', label: 'USt-IdNr.', placeholder: 'DE123456789' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">{label}</label>
                  <input
                    type="text"
                    value={bankSettings[key] || ''}
                    onChange={(e) => setBankSettings(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={async () => {
              setBankSaving(true);
              try {
                const updated = await adminApi.updateBankSettings(bankSettings);
                setBankSettings(updated);
                setBankSuccess('Einstellungen gespeichert!');
                setTimeout(() => setBankSuccess(''), 3000);
              } catch { setBankSuccess(''); } finally { setBankSaving(false); }
            }}
            disabled={bankSaving}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {bankSaving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
            {bankSaving ? 'Speichern...' : 'Speichern'}
          </button>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
            <p><strong>Hinweis:</strong> Um eine Rechnung zu senden, öffnen Sie eine Buchung unter &quot;Buchungen&quot; und klicken Sie auf &quot;Rechnung senden&quot;.</p>
          </div>
        </div>
      )}

      {/* Promotions tab */}
      {activeTab === 'promotions' && (() => {
        const promoBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

        async function loadPromos() {
          const r = await fetch(`${promoBase}/api/promotions/admin/list`, { headers: { Authorization: `Bearer ${token}` } });
          setPromotions(await r.json());
        }

        async function handleCreatePromo(e: React.FormEvent) {
          e.preventDefault();
          setPromoSaving(true); setPromoMsg('');
          try {
            const r = await fetch(`${promoBase}/api/promotions/admin`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ ...promoForm, value: parseFloat(promoForm.value), max_uses: promoForm.max_uses ? parseInt(promoForm.max_uses) : null }),
            });
            const d = await r.json();
            if (d.success) {
              setPromoMsg('✅ Code erstellt!');
              setPromoForm({ code: '', type: 'fixed', value: '', start_date: '', end_date: '', max_uses: '', description: '', kombinierbar: false, show_banner: true });
              await loadPromos();
            } else { setPromoMsg('❌ ' + (d.error || 'Fehler')); }
          } catch { setPromoMsg('❌ Netzwerkfehler'); } finally { setPromoSaving(false); }
        }

        async function toggleActive(promo: Promotion) {
          await fetch(`${promoBase}/api/promotions/admin/${promo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ...promo, active: promo.active ? 0 : 1 }),
          });
          await loadPromos();
        }

        async function deletePromo(id: number) {
          if (!confirm('Diesen Code löschen?')) return;
          await fetch(`${promoBase}/api/promotions/admin/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          await loadPromos();
        }

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Existing codes list */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <BadgePercent size={18} /> Aktionscodes
                  <span className="text-xs font-normal text-gray-500">({promotions.length})</span>
                </h3>
                <button onClick={loadPromos} className="text-primary-600 hover:text-primary-700">
                  <RefreshCw size={16} />
                </button>
              </div>
              {promotions.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Noch keine Aktionscodes vorhanden.</p>
              ) : (
                <div className="space-y-3">
                  {promotions.map(p => (
                    <div key={p.id} className={cn('border rounded-xl p-4 flex items-center justify-between gap-3', p.active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50')}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 font-mono tracking-wider">{p.code}</span>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', p.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600')}>
                            {p.active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                            {p.type === 'fixed' ? `−${p.value} €` : `−${p.value}%`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(p.start_date).toLocaleDateString('de-DE')} – {new Date(p.end_date).toLocaleDateString('de-DE')}
                          {' · '}{p.used_count}{p.max_uses ? `/${p.max_uses}` : ''} mal verwendet
                          {' · '}{p.kombinierbar ? '🔗 kombinierbar' : '🚫 nicht kombinierbar'}
                          {' · '}{p.show_banner ? '📢 Banner aktiv' : '🔕 kein Banner'}
                          {p.description ? ` · ${p.description}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => toggleActive(p)} title={p.active ? 'Deaktivieren' : 'Aktivieren'}
                          className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', p.active ? 'bg-green-100 hover:bg-red-100 text-green-700 hover:text-red-700' : 'bg-gray-100 hover:bg-green-100 text-gray-500 hover:text-green-700')}>
                          {p.active ? <Check size={14} /> : <X size={14} />}
                        </button>
                        <button onClick={() => deletePromo(p.id)} title="Löschen"
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-700 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create new code form */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <BadgePercent size={18} /> Neuen Code erstellen
              </h3>
              <form onSubmit={handleCreatePromo} className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
                    <input type="text" required value={promoForm.code}
                      onChange={e => setPromoForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="WELCOME15" maxLength={50}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary-400 font-mono" />
                  </div>
                  <button type="button"
                    onClick={() => setPromoForm(f => ({ ...f, code: Math.random().toString(36).slice(2, 8).toUpperCase() }))}
                    className="mt-5 px-3 py-2.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-medium">
                    Zufällig
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Typ *</label>
                    <select value={promoForm.type} onChange={e => setPromoForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                      <option value="fixed">Fester Betrag (€)</option>
                      <option value="percent">Prozent (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Wert * {promoForm.type === 'fixed' ? '(€)' : '(%)'}
                    </label>
                    <input type="number" required min="0.01" step="0.01" value={promoForm.value}
                      onChange={e => setPromoForm(f => ({ ...f, value: e.target.value }))}
                      placeholder={promoForm.type === 'fixed' ? '15.00' : '10'}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Gültig von *</label>
                    <input type="date" required value={promoForm.start_date}
                      onChange={e => setPromoForm(f => ({ ...f, start_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Gültig bis *</label>
                    <input type="date" required value={promoForm.end_date}
                      onChange={e => setPromoForm(f => ({ ...f, end_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Max. Nutzungen (leer = unbegrenzt)</label>
                  <input type="number" min="1" value={promoForm.max_uses}
                    onChange={e => setPromoForm(f => ({ ...f, max_uses: e.target.value }))}
                    placeholder="50"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Beschreibung (intern)</label>
                  <input type="text" value={promoForm.description}
                    onChange={e => setPromoForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="z.B. E-Mail Kampagne Mai 2026"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>

                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <input type="checkbox" id="kombinierbar" checked={promoForm.kombinierbar}
                    onChange={e => setPromoForm(f => ({ ...f, kombinierbar: e.target.checked }))}
                    className="w-4 h-4 accent-amber-500" />
                  <label htmlFor="kombinierbar" className="text-sm text-gray-700 cursor-pointer">
                    <span className="font-medium">Kombinierbar mit Hin & Rück Rabatt</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Wenn aktiv: Beide Rabatte werden addiert. Standard: nicht kombinierbar.</span>
                  </label>
                </div>

                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <input type="checkbox" id="show_banner" checked={promoForm.show_banner}
                    onChange={e => setPromoForm(f => ({ ...f, show_banner: e.target.checked }))}
                    className="w-4 h-4 accent-blue-600" />
                  <label htmlFor="show_banner" className="text-sm text-gray-700 cursor-pointer">
                    <span className="font-medium">Banner auf der Startseite anzeigen</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Deaktivieren für E-Mail-Kampagnen — der Code funktioniert, aber kein Banner auf der Website.</span>
                  </label>
                </div>

                {promoMsg && (
                  <p className={cn('text-sm px-3 py-2 rounded-lg', promoMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                    {promoMsg}
                  </p>
                )}

                <button type="submit" disabled={promoSaving}
                  className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors">
                  {promoSaving ? <><RefreshCw size={16} className="animate-spin" /> Wird erstellt...</> : <><BadgePercent size={16} /> Code erstellen</>}
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Edit / Create Booking Modal */}
      {(editingBooking || isCreatingBooking) && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !editSaving) { setEditingBooking(null); setIsCreatingBooking(false); } }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-primary-600 text-white p-6 flex items-center justify-between sticky top-0 rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {isCreatingBooking ? <><Plus size={18} /> Neue Buchung erstellen</> : <><Pencil size={18} /> Buchung bearbeiten</>}
                </h2>
                {!isCreatingBooking && editingBooking && (
                  <p className="text-primary-200 text-sm">{editingBooking.booking_number}</p>
                )}
              </div>
              {!editSaving && (
                <button onClick={() => { setEditingBooking(null); setIsCreatingBooking(false); }} className="p-2 hover:bg-primary-700 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              )}
            </div>

            <div className="p-6 space-y-6 text-sm">
              {/* Success + resend button */}
              {editSuccess && editingBooking && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-green-700 font-medium flex items-center gap-2">
                    <Check size={16} /> Buchung erfolgreich gespeichert!
                  </p>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Bestätigungs-E-Mail an ${editingBooking.email || '—'} senden?`)) return;
                      try {
                        await adminApi.resendConfirmation(editingBooking.id);
                        alert('Bestätigungs-E-Mail wurde gesendet.');
                      } catch (err: any) {
                        alert('Fehler beim Senden: ' + (err?.response?.data?.error || err?.message || 'Unbekannter Fehler'));
                      }
                    }}
                    className="mt-2 flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <Send size={14} /> Bestätigungs-E-Mail senden
                  </button>
                </div>
              )}

              {editError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                  {editError}
                </div>
              )}

              {/* Kundendaten */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Kundendaten</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Name</label>
                    <input type="text" value={editForm.name || ''} onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">E-Mail</label>
                    <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm(p => ({ ...p, email: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Telefon</label>
                    <input type="text" value={editForm.phone || ''} onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>
              </div>

              {/* Fahrtdetails */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Fahrtdetails</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Abholadresse</label>
                    <AdminAddressField
                      placeholder="Abholadresse eingeben..."
                      value={editForm.pickup_address || ''}
                      onChange={(v) => setEditForm(p => ({ ...p, pickup_address: v }))}
                      onValidSelect={(v) => {
                        setEditPickupValid(v);
                        setEditRecalcArmed(true);
                        if (v) setEditForm(p => ({ ...p, pickup_address: v }));
                      }}
                      onCoords={(lat, lng) => setEditPickupCoords(lat != null && lng != null ? { lat, lng } : null)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Zieladresse</label>
                    <AdminAddressField
                      placeholder="Zieladresse eingeben..."
                      value={editForm.dropoff_address || ''}
                      onChange={(v) => setEditForm(p => ({ ...p, dropoff_address: v }))}
                      onValidSelect={(v) => {
                        setEditDropoffValid(v);
                        setEditRecalcArmed(true);
                        if (v) setEditForm(p => ({ ...p, dropoff_address: v }));
                      }}
                      onCoords={(lat, lng) => setEditDropoffCoords(lat != null && lng != null ? { lat, lng } : null)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Abholdatum</label>
                      <input
                        type="date"
                        value={editForm.pickup_datetime ? editForm.pickup_datetime.substring(0, 10) : ''}
                        onChange={(e) => {
                          const time = editForm.pickup_datetime ? editForm.pickup_datetime.substring(11, 16) : '12:00';
                          setEditForm(p => ({ ...p, pickup_datetime: `${e.target.value}T${time}:00` }));
                        }}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Abholzeit</label>
                      <input
                        type="time"
                        value={editForm.pickup_datetime ? editForm.pickup_datetime.substring(11, 16) : ''}
                        onChange={(e) => {
                          const date = editForm.pickup_datetime ? editForm.pickup_datetime.substring(0, 10) : new Date().toISOString().substring(0, 10);
                          setEditForm(p => ({ ...p, pickup_datetime: `${date}T${e.target.value}:00` }));
                        }}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  {editForm.trip_type === 'roundtrip' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Rückfahrt Datum</label>
                        <input
                          type="date"
                          value={editForm.return_datetime ? editForm.return_datetime.substring(0, 10) : ''}
                          onChange={(e) => {
                            const time = editForm.return_datetime ? editForm.return_datetime.substring(11, 16) : '12:00';
                            setEditForm(p => ({ ...p, return_datetime: `${e.target.value}T${time}:00` }));
                          }}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Rückfahrt Zeit</label>
                        <input
                          type="time"
                          value={editForm.return_datetime ? editForm.return_datetime.substring(11, 16) : ''}
                          onChange={(e) => {
                            const date = editForm.return_datetime ? editForm.return_datetime.substring(0, 10) : new Date().toISOString().substring(0, 10);
                            setEditForm(p => ({ ...p, return_datetime: `${date}T${e.target.value}:00` }));
                          }}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Fahrzeug</label>
                      <select value={editForm.vehicle_type || 'kombi'} onChange={(e) => { setEditForm(p => ({ ...p, vehicle_type: e.target.value })); setEditRecalcArmed(true); }} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                        <option value="kombi">Kombi</option>
                        <option value="van">Van</option>
                        <option value="grossraumtaxi">Großraumtaxi</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Passagiere</label>
                      <input type="number" min="1" max="9" value={editForm.passengers ?? 1} onChange={(e) => setEditForm(p => ({ ...p, passengers: parseInt(e.target.value) || 1 }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Fahrttyp</label>
                      <select value={editForm.trip_type || 'oneway'} onChange={(e) => { setEditForm(p => ({ ...p, trip_type: e.target.value })); setEditRecalcArmed(true); }} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                        <option value="oneway">Einfache Fahrt</option>
                        <option value="roundtrip">Hin- & Rückfahrt</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Extras */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Extras</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Flugnummer</label>
                    <input type="text" value={editForm.flight_number || ''} onChange={(e) => setEditForm(p => ({ ...p, flight_number: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Abholschild</label>
                    <input type="text" value={editForm.pickup_sign || ''} onChange={(e) => setEditForm(p => ({ ...p, pickup_sign: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Gepäck (Stück)</label>
                    <input type="number" min="0" value={editForm.luggage_count ?? 0} onChange={(e) => setEditForm(p => ({ ...p, luggage_count: parseInt(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div className="col-span-full">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🚲</span>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Fahrrad</p>
                          <p className="text-xs text-gray-400">{(() => { const fp = prices.find(p => p.vehicle_type === (editForm.vehicle_type || 'kombi'))?.fahrrad_price; return fp ? `${fp.toFixed(2).replace('.', ',')} € / Stk.` : ''; })()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setEditForm(p => ({ ...p, fahrrad_count: Math.max(0, (p.fahrrad_count ?? 0) - 1) }))} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 flex items-center justify-center text-sm">−</button>
                        <span className="w-6 text-center text-sm font-bold text-gray-800">{editForm.fahrrad_count ?? 0}</span>
                        <button type="button" onClick={() => setEditForm(p => ({ ...p, fahrrad_count: Math.min(4, (p.fahrrad_count ?? 0) + 1) }))} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 flex items-center justify-center text-sm">+</button>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-full">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👶</span>
                        <p className="text-sm font-medium text-gray-700">Kindersitz <span className="text-xs text-green-600 font-normal">{(() => { const csp = prices.find(p => p.vehicle_type === (editForm.vehicle_type || 'kombi'))?.child_seat_price ?? 0; return csp > 0 ? `${csp.toFixed(2).replace('.', ',')} € / Stk.` : 'Kostenlos'; })()}</span></p>
                      </div>
                      <button type="button" onClick={() => {
                        const newVal = !editForm.child_seat;
                        setEditForm(p => ({ ...p, child_seat: newVal ? 1 : 0, child_seat_details: newVal ? buildChildSeatDetails(editChildSeatBabyschale, editChildSeatKindersitz, editChildSeatSitzerhoehung) : '' }));
                        if (!newVal) { setEditChildSeatBabyschale(0); setEditChildSeatKindersitz(0); setEditChildSeatSitzerhoehung(0); }
                      }} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.child_seat ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.child_seat ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    {!!editForm.child_seat && (
                      <div className="mt-2 bg-green-50 rounded-xl p-3 border border-green-100 space-y-2">
                        <p className="text-xs text-gray-500 font-medium">Bitte wählen Sie die benötigten Kindersitze:</p>
                        {[
                          { label: 'Babyschale', sub: '0–12 Monate', val: editChildSeatBabyschale, set: setEditChildSeatBabyschale },
                          { label: 'Kindersitz', sub: '1–4 Jahre, bis 18 kg', val: editChildSeatKindersitz, set: setEditChildSeatKindersitz },
                          { label: 'Sitzerhöhung', sub: '4–12 Jahre, bis 36 kg', val: editChildSeatSitzerhoehung, set: setEditChildSeatSitzerhoehung },
                        ].map(({ label, sub, val, set }) => (
                          <div key={label} className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{label}</p>
                              <p className="text-xs text-gray-400">{sub}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => { const n = Math.max(0, val - 1); set(n); setEditForm(p => ({ ...p, child_seat_details: buildChildSeatDetails(label === 'Babyschale' ? n : editChildSeatBabyschale, label === 'Kindersitz' ? n : editChildSeatKindersitz, label === 'Sitzerhöhung' ? n : editChildSeatSitzerhoehung) })); }} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">−</button>
                              <span className="w-5 text-center text-sm font-bold text-gray-800">{val}</span>
                              <button type="button" onClick={() => { const n = Math.min(3, val + 1); set(n); setEditForm(p => ({ ...p, child_seat_details: buildChildSeatDetails(label === 'Babyschale' ? n : editChildSeatBabyschale, label === 'Kindersitz' ? n : editChildSeatKindersitz, label === 'Sitzerhöhung' ? n : editChildSeatSitzerhoehung) })); }} className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 font-bold text-gray-600 flex items-center justify-center text-xs">+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="col-span-full">
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Zwischenstopp</label>
                    <AdminAddressField
                      placeholder="Zwischenstopp eingeben..."
                      value={editForm.zwischenstopp_address || ''}
                      onChange={(v) => {
                        setEditForm(p => ({ ...p, zwischenstopp_address: v }));
                        // Cleared by hand — fall back to the direct route and recalc.
                        if (!v.trim() && editZwischenstoppValid) { setEditZwischenstoppValid(null); setEditRecalcArmed(true); }
                      }}
                      onValidSelect={(v) => {
                        if (v) setEditForm(p => ({ ...p, zwischenstopp_address: v }));
                        setEditZwischenstoppValid(v || null);
                        setEditRecalcArmed(true);
                      }}
                    />
                  </div>
                  <div className="col-span-full">
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Notizen</label>
                    <textarea rows={2} value={editForm.notes || ''} onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>
              </div>

              {/* Preis & Zahlung */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Preis & Zahlung</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Preis (€)
                      {editPriceCalcLoading && <span className="ml-2 text-blue-500 font-normal normal-case">⟳ wird berechnet…</span>}
                      {!editPriceCalcLoading && editDistanceKm && <span className="ml-2 text-gray-400 font-normal normal-case">~{editDistanceKm.toFixed(1)} km · auto</span>}
                    </label>
                    <div className="flex gap-1">
                      <input type="number" step="0.5" min="0" value={editForm.price ?? ''} onChange={(e) => setEditForm(p => ({ ...p, price: parseFloat(e.target.value) }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      <button
                        type="button"
                        title="Auf 0,50 € aufrunden"
                        onClick={() => setEditForm(p => ({ ...p, price: Math.ceil((p.price ?? 0) * 2) / 2 }))}
                        className="px-2 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 text-xs font-bold transition-colors whitespace-nowrap"
                      >↑0,5</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Zahlung</label>
                    <select value={editForm.payment_method || 'cash'} onChange={(e) => setEditForm(p => ({ ...p, payment_method: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="cash">Bargeld</option>
                      <option value="card">Kreditkarte</option>
                      <option value="ueberweisung">Überweisung</option>
                      {/* Imported bookings can carry values this dropdown does not offer
                          ('transfer', 'invoice'). Without an option for them the browser
                          falls back to the first entry and saving would silently rewrite
                          the booking to Bargeld. */}
                      {!['cash', 'card', 'ueberweisung'].includes(editForm.payment_method || 'cash') && (
                        <option value={editForm.payment_method}>
                          {paymentLabel(editForm.payment_method)} (importiert)
                        </option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Anfahrtskosten (€)</label>
                    <input type="number" step="0.5" min="0" value={editForm.anfahrt_cost ?? ''} onChange={(e) => setEditForm(p => ({ ...p, anfahrt_cost: parseFloat(e.target.value) || undefined }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Rabatt (€)</label>
                    <input type="number" step="0.01" min="0" value={editForm.discount_amount ?? ''} onChange={(e) => setEditForm(p => ({ ...p, discount_amount: parseFloat(e.target.value) || undefined }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div className="col-span-full md:col-span-2">
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Promo-Code</label>
                    <input type="text" value={editForm.promo_code || ''} onChange={(e) => setEditForm(p => ({ ...p, promo_code: e.target.value.toUpperCase() }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>
              </div>

              {/* Sprache */}
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Sprache der E-Mail</label>
                <select value={editForm.language || 'de'} onChange={(e) => setEditForm(p => ({ ...p, language: e.target.value }))} className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 max-w-xs">
                  <option value="de">Deutsch (de)</option>
                  <option value="en">Englisch (en)</option>
                  <option value="tr">Türkisch (tr)</option>
                </select>
              </div>

              {/* Footer */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setEditingBooking(null); setIsCreatingBooking(false); }}
                  disabled={editSaving}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 py-2.5 rounded-xl font-medium transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={async () => {
                    setEditSaving(true);
                    setEditError('');
                    setEditSuccess(false);
                    try {
                      if (isCreatingBooking) {
                        const created = await adminApi.createBooking(editForm);
                        setBookings(prev => [created, ...prev]);
                        setEditingBooking(created);
                        setIsCreatingBooking(false);
                        setEditForm({ ...created });
                        setEditSuccess(true);
                      } else if (editingBooking) {
                        const updated = await adminApi.updateBooking(editingBooking.id, editForm);
                        setBookings(prev => prev.map(b => b.id === editingBooking.id ? updated : b));
                        setEditingBooking(updated);
                        // The detail drawer sits behind this dialog and drives what it offers
                        // (e.g. "Proforma senden" only shows for payment_method 'ueberweisung').
                        // Without this it keeps the pre-edit row, so switching a booking to
                        // Überweisung and saving left the drawer showing the old options.
                        setSelectedBooking(prev => prev && prev.id === updated.id ? updated : prev);
                        setEditForm({ ...updated });
                        setEditSuccess(true);
                      }
                    } catch (err: any) {
                      setEditError(err?.response?.data?.error || 'Fehler beim Speichern');
                    } finally {
                      setEditSaving(false);
                    }
                  }}
                  disabled={editSaving}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {editSaving
                    ? <><RefreshCw size={16} className="animate-spin" /> Speichern...</>
                    : <><Check size={16} /> Speichern</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rechnung / Proforma Modal — one dialog, two documents (see rechnungMode) */}
      {cancelTarget && (
        <CancelBookingDialog
          booking={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={async (p) => {
            await updateStatus(cancelTarget.id, 'cancelled', p);
            setCancelTarget(null);
          }}
        />
      )}
      {showRechnungModal && selectedBooking && (
        <div
          className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !rechnungSending) setShowRechnungModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className={`text-white p-5 flex items-center justify-between ${rechnungMode === 'proforma' ? 'bg-amber-600' : 'bg-primary-600'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${rechnungMode === 'proforma' ? 'bg-amber-500' : 'bg-primary-500'}`}>
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{rechnungMode === 'proforma' ? 'Proforma-Rechnung erstellen' : 'Rechnung erstellen'}</h3>
                  <p className={`text-xs ${rechnungMode === 'proforma' ? 'text-amber-100' : 'text-primary-200'}`}>{selectedBooking.booking_number}</p>
                </div>
              </div>
              {!rechnungSending && (
                <button onClick={() => setShowRechnungModal(false)} className={`p-2 rounded-lg ${rechnungMode === 'proforma' ? 'hover:bg-amber-500' : 'hover:bg-primary-500'}`}>
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Buchung</p>
                      <p className="font-semibold text-gray-900">{selectedBooking.booking_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Betrag</p>
                      <p className="font-bold text-primary-600">{formatPrice(selectedBooking.price)}</p>
                    </div>
                  </div>
                </div>
                {/* Empfängeradresse */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Rechnungsempfänger</p>
                    {!rechnungSuccess && (
                      <button
                        onClick={() => setEditingEmpfaenger(e => !e)}
                        className="p-1 rounded hover:bg-gray-200 transition-colors"
                        title="Adresse bearbeiten"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  {editingEmpfaenger ? (
                    <textarea
                      value={rechnungEmpfaenger}
                      onChange={(e) => setRechnungEmpfaenger(e.target.value)}
                      rows={7}
                      placeholder={'Vor- und Nachname\nFirma (optional)\nStraße und Hausnummer\nPLZ Ort\nLand\n\nKontakt: E-Mail / Telefon'}
                      className="w-full border border-primary-400 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white resize-none font-mono"
                    />
                  ) : (
                    <p className="text-gray-800 whitespace-pre-line text-sm leading-relaxed">
                      {rechnungEmpfaenger || '—'}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {rechnungMode === 'proforma' ? 'Proforma-Nummer' : 'Rechnungsnummer'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={rechnungsnummer}
                  onChange={(e) => setRechnungsnummer(e.target.value)}
                  placeholder={rechnungMode === 'proforma' ? 'z.B. PRO-20260911-001' : 'z.B. WEB-20260911-001'}
                  disabled={rechnungSending || rechnungSuccess}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sprache</label>
                  <select
                    value={rechnungSprache}
                    onChange={(e) => setRechnungSprache(e.target.value as 'de' | 'en')}
                    disabled={rechnungSending || rechnungSuccess}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                  >
                    <option value="de">🇩🇪 Deutsch</option>
                    <option value="en">🇬🇧 English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MwSt.-Satz</label>
                  <select
                    value={rechnungMwst}
                    onChange={(e) => setRechnungMwst(Number(e.target.value) as 0 | 7 | 19)}
                    disabled={rechnungSending || rechnungSuccess}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
                  >
                    <option value={7}>7%</option>
                    <option value={0}>0%</option>
                    <option value={19}>19%</option>
                  </select>
                </div>
              </div>
              {rechnungMode === 'proforma' ? (
                /* A proforma is by definition the bank-transfer document, so there is
                   nothing to pick — show the deadline the PDF will carry instead. */
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                  <p className="font-semibold text-amber-900 flex items-center gap-2">
                    🏦 Zahlungsart: Überweisung
                  </p>
                  <p className="text-amber-800 mt-1.5">
                    Zahlbar bis: <strong>{proformaDueDate(selectedBooking.pickup_datetime).toLocaleDateString('de-DE')}</strong>
                    <span className="text-amber-700"> (ein Tag vor Fahrtantritt)</span>
                  </p>
                  <p className="text-xs text-amber-700 mt-2 leading-relaxed">
                    Die Proforma enthält den Hinweis, dass die Zahlung vor Fahrtantritt eingegangen sein muss,
                    sowie die Bankverbindung. Sie ist keine Rechnung i.S.d. §14 UStG — die richtige Rechnung
                    geht nach der Fahrt automatisch raus.
                  </p>
                </div>
              ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zahlungsart</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { val: 'bar', label: '💵 Bar', de: 'Barzahlung', en: 'Cash' },
                    { val: 'kreditkarte', label: '💳 Kreditkarte', de: 'Kreditkarte', en: 'Credit Card' },
                    { val: 'ueberweisung', label: '🏦 Überweisung', de: 'Überweisung', en: 'Bank Transfer' },
                  ] as const).map(({ val, label }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRechnungZahlungsart(val)}
                      disabled={rechnungSending || rechnungSuccess}
                      className={`py-2.5 px-2 rounded-xl text-xs font-medium border-2 transition-colors disabled:opacity-50 ${
                        rechnungZahlungsart === val
                          ? 'border-primary-600 bg-primary-50 text-primary-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {rechnungZahlungsart !== 'ueberweisung' && (
                  <p className="text-xs text-green-700 mt-1.5 flex items-center gap-1">
                    <Check size={12} />
                    {rechnungZahlungsart === 'bar'
                      ? (rechnungSprache === 'en' ? 'Paid in Cash — no payment due date' : 'Bar bezahlt — kein Zahlungsziel')
                      : (rechnungSprache === 'en' ? 'Paid by Credit Card — no payment due date' : 'Kreditkarte bezahlt — kein Zahlungsziel')}
                  </p>
                )}
              </div>
              )}
              {rechnungSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <Check size={16} />{rechnungMode === 'proforma' ? 'Proforma-Rechnung erfolgreich gesendet!' : 'Rechnung erfolgreich gesendet!'}
                </div>
              )}
              {rechnungError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <X size={16} />{rechnungError}
                </div>
              )}
              {!rechnungSuccess ? (
                <button
                  onClick={async () => {
                    const isProforma = rechnungMode === 'proforma';
                    if (!rechnungsnummer.trim()) {
                      setRechnungError(isProforma ? 'Bitte Proforma-Nummer eingeben.' : 'Bitte Rechnungsnummer eingeben.');
                      return;
                    }
                    setRechnungError('');
                    setRechnungSending(true);
                    // Same dialog, two endpoints — the proforma has no zahlungsart to pass.
                    const send = (force?: boolean) => isProforma
                      ? adminApi.sendProforma(selectedBooking.id, rechnungsnummer.trim(), rechnungMwst, rechnungSprache, rechnungEmpfaenger.trim(), force)
                      : adminApi.sendRechnung(selectedBooking.id, rechnungsnummer.trim(), rechnungMwst, rechnungSprache, rechnungEmpfaenger.trim(), rechnungZahlungsart, force);
                    try {
                      await send();
                      setRechnungSuccess(true);
                      loadBookings();
                    } catch (err: any) {
                      if (err.response?.status === 409 && err.response?.data?.already_sent) {
                        // Bereits gesendet — nur nach ausdrücklicher Bestätigung erneut verschicken,
                        // sonst bekommt der Kunde zwei Rechnungsmails für dieselbe Fahrt.
                        const confirmed = window.confirm(isProforma
                          ? `${err.response.data.error}\n\nTrotzdem erneut per E-Mail senden?`
                          : `${err.response.data.error}\n\nDie bisherige Rechnung wird dabei per Stornorechnung (ST-…) aufgehoben – der Kunde erhält die Stornorechnung und danach die neue Rechnung ${rechnungsnummer.trim()}. Fortfahren?`);
                        if (confirmed) {
                          try {
                            await send(true);
                            setRechnungSuccess(true);
                            loadBookings();
                          } catch (err2: any) {
                            setRechnungError(err2.response?.data?.error || err2.message || 'Fehler beim Senden');
                          }
                        }
                      } else {
                        setRechnungError(err.response?.data?.error || err.message || 'Fehler beim Senden');
                      }
                    } finally { setRechnungSending(false); }
                  }}
                  disabled={rechnungSending || !rechnungsnummer.trim()}
                  className={`w-full disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${rechnungMode === 'proforma' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary-600 hover:bg-primary-700'}`}
                >
                  {rechnungSending
                    ? <><RefreshCw size={16} className="animate-spin" /> PDF wird erstellt...</>
                    : <><Send size={16} /> PDF erstellen &amp; per E-Mail senden</>}
                </button>
              ) : (
                <button
                  onClick={() => setShowRechnungModal(false)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-colors"
                >
                  Schließen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
