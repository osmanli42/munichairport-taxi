'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi, pricesApi, settingsApi, plzSurchargesApi, fixedRoutesApi, Booking, Price, PlzSurcharge, FixedRoute } from '@/lib/api';
import { formatPrice, formatDateTime, cn } from '@/lib/utils';
import { waNumber, parsePhone } from '@/lib/phone';
import {
  LogIn, LogOut, BarChart3, List, Tag, RefreshCw, ChevronLeft, ChevronRight,
  TrendingUp, Calendar, Check, X, Search, Lock, Eye, PieChart, FileText, Building2, Send,
  Mail, Upload, Users, BadgePercent, Activity, Flame, Server, Play, MousePointerClick, MapPin, Pencil, Plus,
  Zap, CheckCircle2, AlertCircle, CalendarDays,
} from 'lucide-react';
import LiveVisitorsTab from '@/components/LiveVisitorsTab';
import HeatmapTab from '@/components/HeatmapTab';
import SystemTab from '@/components/SystemTab';
import ReplayTab from '@/components/ReplayTab';
import SeoTab from '@/components/SeoTab';
import AdsTab from '@/components/AdsTab';
import PflichtgebietTab from '@/components/PflichtgebietTab';
import B2BTab from '@/components/B2BTab';
import KalenderTab from '@/components/KalenderTab';
import AdminAddressField from '@/components/AdminAddressField';

type Tab = 'dashboard' | 'bookings' | 'prices' | 'pflichtgebiet' | 'statistics' | 'rechnung' | 'marketing' | 'promotions' | 'live' | 'heatmap' | 'replay' | 'system' | 'seo' | 'ads' | 'b2b' | 'kalender';

interface MarketingCustomer {
  email: string;
  name: string;
  lastBooking?: string;
  bookingCount?: number;
  source?: 'db' | 'ics';
}

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

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [prices, setPrices] = useState<Price[]>([]);
  const [filters, setFilters] = useState({ status: '', vehicle_type: '', search: '', date_from: '', date_to: '' });
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
  const [editDistanceKm, setEditDistanceKm] = useState<number | null>(null);
  const [editPriceCalcLoading, setEditPriceCalcLoading] = useState(false);
  const [editBaseTripPrice, setEditBaseTripPrice] = useState<number | null>(null);
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
  const [settings, setSettings] = useState<Record<string, string>>({ stadtfahrt_enabled: '0', anfahrt_price_per_km: '1.70', zwischenstopp_enabled: '0', plz_surcharge_enabled: '0', min_advance_hours: '1.5', night_confirm_enabled: '1', night_confirm_start: '22', night_confirm_end: '7', flight_validation_enabled: '1', phone_validation_enabled: '1', auto_status_enabled: '0', auto_confirm_hours: '1', auto_complete_buffer_minutes: '0', auto_complete_include_company_charge: '0', experiment_checkout_v2: 'off' });
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
  const [drivers, setDrivers] = useState<Array<{ id: number; name: string; phone: string; vehicle_plate: string; vehicle_model: string; active: number }>>([]);
  const [trackingLinks, setTrackingLinks] = useState<{ customer_link: string; driver_link: string } | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [copied, setCopied] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
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
  // Marketing
  const [marketingCustomers, setMarketingCustomers] = useState<MarketingCustomer[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('marketing_ics_contacts');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [marketingSelected, setMarketingSelected] = useState<Set<string>>(new Set());
  const [marketingSearch, setMarketingSearch] = useState('');
  const [marketingSourceFilter, setMarketingSourceFilter] = useState<'all' | 'db' | 'ics'>('all');
  const [marketingSubject, setMarketingSubject] = useState('');
  const [marketingContent, setMarketingContent] = useState('');
  const [marketingButtonText, setMarketingButtonText] = useState('');
  const [marketingButtonUrl, setMarketingButtonUrl] = useState('');
  const [marketingPreviewHtml, setMarketingPreviewHtml] = useState('');
  const [marketingShowPreview, setMarketingShowPreview] = useState(false);
  const [marketingSending, setMarketingSending] = useState(false);
  const [marketingResult, setMarketingResult] = useState<{ sent: number; failed: number; errors: Array<{ email: string; error: string }> } | null>(null);
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [marketingIcsLoading, setMarketingIcsLoading] = useState(false);
  const [marketingShowConfirm, setMarketingShowConfirm] = useState(false);
  const [marketingEditorMode, setMarketingEditorMode] = useState<'text' | 'html'>('text');
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [stripeSyncing, setStripeSyncing] = useState(false);
  const [stripeSyncResult, setStripeSyncResult] = useState<{ matched: number; unmatched: number; total: number } | null>(null);
  const [tomorrowCards, setTomorrowCards] = useState<Booking[]>([]);
  const [chargingId, setChargingId] = useState<number | null>(null);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [detailedStats, setDetailedStats] = useState<Record<string, unknown> | null>(null);
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
    if (selectedBooking) { loadDrivers(); setTrackingLinks(null); }
  }, [selectedBooking?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const icsContacts = marketingCustomers.filter(c => c.source === 'ics');
    localStorage.setItem('marketing_ics_contacts', JSON.stringify(icsContacts));
  }, [marketingCustomers]);

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    try {
      const data = await adminApi.login(loginForm.username, loginForm.password);
      localStorage.setItem('admin_token', data.token);
      setToken(data.token);
      setIsLoggedIn(true);
    } catch {
      setLoginError('Ungültige Anmeldedaten');
    }
  }

  function handleLogout() {
    localStorage.removeItem('admin_token');
    setIsLoggedIn(false);
    setToken('');
  }

  const loadDrivers = useCallback(async () => {
    try { setDrivers(await adminApi.getDrivers()); } catch { /* ignore */ }
  }, []);

  async function handleAssignDriver(driverId: number | null) {
    if (!selectedBooking) return;
    setAssigning(true);
    try {
      const r = await adminApi.assignDriver(selectedBooking.id, driverId);
      if (r.assigned && r.customer_link && r.driver_link) {
        setTrackingLinks({ customer_link: r.customer_link, driver_link: r.driver_link });
      } else {
        setTrackingLinks(null);
      }
    } catch { /* ignore */ }
    finally { setAssigning(false); }
  }

  async function handleCreateDriver() {
    if (!newDriverName.trim()) return;
    try {
      await adminApi.createDriver({ name: newDriverName.trim() });
      setNewDriverName('');
      loadDrivers();
    } catch { /* ignore */ }
  }

  function copyLink(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 2000); });
  }

  const loadStats = useCallback(async () => {
    try {
      const data = await adminApi.getStats();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadDetailedStats = useCallback(async () => {
    try {
      const data = await adminApi.getStatistics();
      setDetailedStats(data);
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
      const data = await adminApi.getBookings({ ...filters, page, limit: 15 });
      setBookings(data.bookings);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

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

  // ─── Marketing ───
  const loadMarketingCustomers = useCallback(async () => {
    setMarketingLoading(true);
    try {
      const data = await adminApi.getMarketingCustomers();
      setMarketingCustomers(prev => {
        const icsOnly = prev.filter(c => c.source === 'ics' && !data.some(d => d.email.toLowerCase() === c.email.toLowerCase()));
        const dbCustomers = data.map(c => ({ ...c, source: 'db' as const }));
        return [...dbCustomers, ...icsOnly];
      });
    } catch (err) {
      console.error('Failed to load marketing customers', err);
      alert('Müşteriler yüklenemedi.');
    } finally {
      setMarketingLoading(false);
    }
  }, []);

  function parseIcsLocally(text: string): Array<{ email: string; name?: string }> {
    const unfolded = text.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    const emailRegex = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;
    const contactMap = new Map<string, { email: string; name?: string }>();

    const addContact = (email: string, name?: string) => {
      const key = email.trim().toLowerCase();
      if (!key || !key.includes('@') || key.includes('example.')) return;
      const existing = contactMap.get(key);
      if (!existing || (!existing.name && name)) {
        contactMap.set(key, { email: key, name: name?.trim() || existing?.name });
      }
    };

    let inEvent = false;
    let currentDescription = '';

    for (const line of lines) {
      if (line.startsWith('BEGIN:VEVENT')) {
        inEvent = true;
        currentDescription = '';
      } else if (line.startsWith('END:VEVENT')) {
        // Extract all emails from DESCRIPTION (no keyword filter — all events are taxi bookings)
        const descMatches = currentDescription.match(emailRegex);
        if (descMatches) for (const e of descMatches) addContact(e);
        inEvent = false;
      } else if (inEvent) {
        if (line.startsWith('ATTENDEE')) {
          const mailto = line.match(/mailto:([^\r\n;>\s]+)/i);
          const cn = line.match(/CN=([^;:]+)/i);
          if (mailto) addContact(mailto[1], cn ? cn[1] : undefined);
        } else if (line.startsWith('ORGANIZER')) {
          const mailto = line.match(/mailto:([^\r\n;>\s]+)/i);
          const cn = line.match(/CN=([^;:]+)/i);
          if (mailto) addContact(mailto[1], cn ? cn[1] : undefined);
        } else if (line.startsWith('DESCRIPTION')) {
          const idx = line.indexOf(':');
          if (idx > -1) currentDescription = line.slice(idx + 1).replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';');
        }
      }
    }

    const blocklist = new Set([
      'info@flughafen-muenchen.taxi',
      'info@flughafen-muenchen-taxi.de',
      'freisingtaxi@gmail.com',
    ]);
    return Array.from(contactMap.values()).filter(
      c => !c.email.startsWith('noreply') && !c.email.startsWith('no-reply') && !blocklist.has(c.email)
    );
  }

  async function handleIcsUpload(file: File) {
    setMarketingIcsLoading(true);
    try {
      const text = await file.text();
      if (!text.includes('BEGIN:VCALENDAR') && !text.includes('BEGIN:VEVENT')) {
        alert('Takvim dosyası işlenemedi. .ics formatında olduğundan emin olun.');
        return;
      }
      const parsed = parseIcsLocally(text);
      setMarketingCustomers(prev => {
        const existing = new Map(prev.map(c => [c.email.toLowerCase(), c]));
        for (const p of parsed) {
          const key = p.email.toLowerCase();
          if (!existing.has(key)) {
            existing.set(key, { email: p.email, name: p.name || '', source: 'ics' });
          } else {
            const ex = existing.get(key)!;
            if (!ex.name && p.name) existing.set(key, { ...ex, name: p.name });
          }
        }
        return Array.from(existing.values());
      });
      alert(`${parsed.length} email takvimden yüklendi.`);
    } catch (err) {
      console.error('Failed to parse ics', err);
      alert('Takvim dosyası işlenemedi. .ics formatında olduğundan emin olun.');
    } finally {
      setMarketingIcsLoading(false);
    }
  }

  function toggleMarketingSelect(email: string) {
    setMarketingSelected(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  // Fix MacRoman corruption: UTF-8 bytes read as MacRoman → reverse to correct UTF-8
  // e.g. ü (C3 BC in UTF-8) pasted as MacRoman gives √º → this fixes it back to ü
  function fixMacRomanCorruption(text: string): string {
    if (typeof window === 'undefined') return text;
    try {
      const macRomanMap = new Map<string, number>();
      const allBytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) allBytes[i] = i;
      const macStr = new TextDecoder('macintosh').decode(allBytes);
      for (let i = 128; i < 256; i++) macRomanMap.set(macStr[i], i);
      const bytes: number[] = [];
      for (const char of Array.from(text)) {
        const cp = char.codePointAt(0) ?? 0;
        if (cp < 128) { bytes.push(cp); }
        else if (macRomanMap.has(char)) { bytes.push(macRomanMap.get(char)!); }
        else { const utf8 = new TextEncoder().encode(char); Array.from(utf8).forEach(b => bytes.push(b)); }
      }
      const fixed = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
      // Only apply if: fewer MacRoman-specific chars AND no new replacement chars
      const suspicious = /[√∂∫≈Ω∞±≤÷∑∏πƒ∆◊™®©≠µ˚¬]/g;
      const origS = (text.match(suspicious) || []).length;
      const fixedS = (fixed.match(suspicious) || []).length;
      const origR = (text.match(/�/g) || []).length;
      const fixedR = (fixed.match(/�/g) || []).length;
      return (fixedS < origS && fixedR <= origR) ? fixed : text;
    } catch { return text; }
  }

  function filterMarketingCustomers(): MarketingCustomer[] {
    const q = marketingSearch.trim().toLowerCase();
    return marketingCustomers.filter(c => {
      if (marketingSourceFilter !== 'all' && c.source !== marketingSourceFilter) return false;
      if (!q) return true;
      return c.email.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q);
    });
  }

  function toggleMarketingSelectAll() {
    const filtered = filterMarketingCustomers();
    if (marketingSelected.size === filtered.length && filtered.length > 0) {
      setMarketingSelected(new Set());
    } else {
      setMarketingSelected(new Set(filtered.map(c => c.email)));
    }
  }

  async function previewMarketingEmail() {
    if (!marketingContent.trim()) {
      alert('Lütfen önce içerik yazın.');
      return;
    }
    try {
      const { html } = await adminApi.previewMarketingEmail({
        subject: marketingSubject || 'Vorschau',
        content: marketingContent,
        buttonText: marketingButtonText || undefined,
        buttonUrl: marketingButtonUrl || undefined,
        isHtml: marketingEditorMode === 'html',
      });
      setMarketingPreviewHtml(html);
      // Open preview in a new tab — avoids all iframe encoding issues
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Preview failed', err);
      alert('Önizleme oluşturulamadı.');
    }
  }

  async function sendMarketingEmails() {
    if (marketingSelected.size === 0) { alert('En az bir alıcı seçin.'); return; }
    if (!marketingSubject.trim() || !marketingContent.trim()) { alert('Konu ve içerik gerekli.'); return; }
    const recipients = marketingCustomers
      .filter(c => marketingSelected.has(c.email))
      .map(c => ({ email: c.email, name: c.name || undefined }));
    setMarketingSending(true);
    setMarketingResult(null);
    setMarketingShowConfirm(false);
    try {
      const result = await adminApi.sendMarketingEmail({
        recipients,
        subject: marketingSubject,
        content: marketingContent,
        buttonText: marketingButtonText || undefined,
        buttonUrl: marketingButtonUrl || undefined,
        isHtml: marketingEditorMode === 'html',
      });
      setMarketingResult(result);
    } catch (err: any) {
      console.error('Send failed', err);
      alert('Gönderim başarısız: ' + (err?.response?.data?.error || err.message));
    } finally {
      setMarketingSending(false);
    }
  }

  async function handleChargeSavedCard(bookingId: number) {
    setChargingId(bookingId);
    try {
      await adminApi.chargeSavedCard(bookingId);
    } catch { /* result reflected via charge_status on reload regardless of outcome */ }
    adminApi.getTomorrowCards().then(setTomorrowCards).catch(() => {});
    setChargingId(null);
  }

  useEffect(() => {
    if (isLoggedIn) {
      if (activeTab === 'dashboard') {
        loadStats();
        adminApi.getTomorrowCards().then(setTomorrowCards).catch(() => {});
        adminApi.getTodayBookings().then(setTodayBookings).catch(() => {});
      }
      if (activeTab === 'bookings') { loadBookings(); if (prices.length === 0) loadPrices(); }
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
      }
      if (activeTab === 'marketing') {
        loadMarketingCustomers();
      }
      if (activeTab === 'promotions') {
        const promoBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
        fetch(`${promoBase}/api/promotions/admin/list`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(setPromotions).catch(() => {});
      }
    }
  }, [isLoggedIn, activeTab, token, loadStats, loadBookings, loadPrices, loadDetailedStats, loadGeoStats, loadMarketingCustomers, marketingCustomers.length]);

  async function updateStatus(id: number, status: string) {
    try {
      await adminApi.updateStatus(id, status);
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
    setEditDistanceKm(booking.distance_km ?? null);
    setEditBaseTripPrice(null);
    const counts = parseChildSeatCounts(booking.child_seat_details);
    setEditChildSeatBabyschale(counts.babyschale);
    setEditChildSeatKindersitz(counts.kindersitz);
    setEditChildSeatSitzerhoehung(counts.sitzerhoehung);
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
    setEditDistanceKm(null);
    setEditBaseTripPrice(null);
    setEditChildSeatBabyschale(0);
    setEditChildSeatKindersitz(0);
    setEditChildSeatSitzerhoehung(0);
  }

  // Auto-calculate price when both addresses are confirmed in edit/create modal
  useEffect(() => {
    if (!editPickupValid || !editDropoffValid) return;
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api');
    const vehicleType = editForm.vehicle_type || 'kombi';
    setEditPriceCalcLoading(true);
    fetch(`${apiBase}/maps/distance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin: editPickupValid, destination: editDropoffValid }),
    })
      .then(r => r.json())
      .then(async distData => {
        if (distData.distance_km) {
          const km: number = distData.distance_km;
          setEditDistanceKm(km);
          setEditForm(prev => ({ ...prev, distance_km: km, duration_minutes: distData.duration_minutes || prev.duration_minutes }));
          // Use backend calculate-price so Pflichtfahrgebiet & fixed routes are included
          const body: Record<string, unknown> = {
            vehicle_type: vehicleType,
            distance_km: km,
            pickup_address: editPickupValid,
            dropoff_address: editDropoffValid,
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
            const total = parseFloat((priceData.total_price + fahrradAddon + childSeatAddon).toFixed(2));
            setEditBaseTripPrice(priceData.total_price);
            setEditForm(prev => ({ ...prev, price: total }));
          }
        }
      })
      .catch(() => {})
      .finally(() => setEditPriceCalcLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPickupValid, editDropoffValid, editForm.vehicle_type]);

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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Admin Header */}
      <header className="bg-primary-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gold-400 rounded-full flex items-center justify-center">
            <span className="text-primary-600 font-bold text-sm">M</span>
          </div>
          <span className="font-bold">Munich Airport Taxi – Admin</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-primary-700 hover:bg-primary-800 px-3 py-2 rounded-lg text-sm transition-colors"
        >
          <LogOut size={16} />
          Abmelden
        </button>
      </header>

      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'dashboard' as Tab, icon: BarChart3, label: 'Dashboard' },
            { id: 'live' as Tab, icon: Activity, label: 'Live' },
            { id: 'heatmap' as Tab, icon: Flame, label: 'Heatmap' },
            { id: 'replay' as Tab, icon: Play, label: 'Replay' },
            { id: 'system' as Tab, icon: Server, label: 'System' },
            { id: 'bookings' as Tab, icon: List, label: 'Buchungen' },
            { id: 'prices' as Tab, icon: Tag, label: 'Preise' },
            { id: 'pflichtgebiet' as Tab, icon: MapPin, label: 'Pflichtfahrgebiet' },
            { id: 'statistics' as Tab, icon: PieChart, label: 'Statistik' },
            { id: 'rechnung' as Tab, icon: FileText, label: 'Rechnung' },
            { id: 'marketing' as Tab, icon: Mail, label: 'Marketing' },
            { id: 'promotions' as Tab, icon: BadgePercent, label: 'Aktionen' },
            { id: 'seo' as Tab, icon: TrendingUp, label: 'SEO' },
            { id: 'ads' as Tab, icon: MousePointerClick, label: 'Google Ads' },
            { id: 'b2b' as Tab, icon: Building2, label: 'B2B Business' },
            { id: 'kalender' as Tab, icon: CalendarDays, label: 'Kalender' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              title={label}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                activeTab === id ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
              )}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Live Visitors */}
        {activeTab === 'live' && <LiveVisitorsTab token={token} />}

        {/* Heatmap */}
        {activeTab === 'heatmap' && <HeatmapTab token={token} />}

        {/* Replay */}
        {activeTab === 'replay' && <ReplayTab token={token} />}

        {/* System */}
        {activeTab === 'system' && <SystemTab token={token} />}

        {/* SEO */}
        {activeTab === 'seo' && <SeoTab token={token} />}

        {/* Google Ads */}
        {activeTab === 'ads' && <AdsTab token={token} />}

        {/* Pflichtfahrgebiet */}
        {activeTab === 'pflichtgebiet' && <PflichtgebietTab token={token} />}

        {/* B2B Business */}
        {activeTab === 'b2b' && <B2BTab token={token} />}

        {/* Kalender-Import (Sammelrechnung für Telefon/E-Mail-Fahrten) */}
        {activeTab === 'kalender' && <KalenderTab token={token} />}

        {/* Dashboard */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Heute', data: (stats.today as { count: number; revenue: number }), icon: Calendar, color: 'bg-blue-500' },
                { label: 'Diese Woche', data: (stats.week as { count: number; revenue: number }), icon: TrendingUp, color: 'bg-green-500' },
                { label: 'Dieser Monat', data: (stats.month as { count: number; revenue: number }), icon: BarChart3, color: 'bg-purple-500' },
                { label: 'Gesamt', data: (stats.total as { count: number; revenue: number }), icon: Tag, color: 'bg-orange-500' },
              ].map(({ label, data, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">{label}</span>
                    <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center`}>
                      <Icon size={16} className="text-white" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{formatPrice(data?.revenue ?? 0)}</div>
                  <div className="text-sm text-gray-500">{data?.count ?? 0} Fahrten</div>
                </div>
              ))}
            </div>

            {/* Heutige Fahrten */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚗</span>
                  <div>
                    <h3 className="font-bold text-gray-900">Heutige Fahrten</h3>
                    <p className="text-xs text-gray-500">
                      {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                {todayBookings.length > 0 && (
                  <span className="bg-primary-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    {todayBookings.length} Fahrt{todayBookings.length > 1 ? 'en' : ''}
                  </span>
                )}
              </div>

              {todayBookings.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">Keine Fahrten heute</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Zeit</th>
                        <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Buchung</th>
                        <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Kunde</th>
                        <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Von → Nach</th>
                        <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Fahrzeug</th>
                        <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Preis</th>
                        <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Zahlung</th>
                        <th className="text-left py-2 px-4 text-gray-500 font-medium text-xs">Status</th>
                        <th className="py-2 px-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {todayBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 font-bold text-primary-700 whitespace-nowrap">
                            {b.pickup_datetime ? new Date(b.pickup_datetime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'} Uhr
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-primary-600">{b.booking_number}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium">{b.name}</div>
                            <div className="text-xs text-gray-500">{b.phone}</div>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-600 max-w-[200px]">
                            <div className="truncate">{b.pickup_address}</div>
                            <div className="truncate text-gray-400">→ {b.dropoff_address}</div>
                          </td>
                          <td className="py-3 px-4 capitalize text-xs">{b.vehicle_type}</td>
                          <td className="py-3 px-4 font-bold text-primary-600 whitespace-nowrap">{formatPrice(b.price)}</td>
                          <td className="py-3 px-4">
                            {b.payment_method === 'card' ? (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">💳 Karte</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">💵 Bar</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[b.status]}`}>
                              {STATUS_LABELS[b.status]}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => { setSelectedBooking(b); setShowCardPopup(false); }}
                              className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                              title="Details"
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                    <span className="text-xs text-gray-500">
                      {todayBookings.filter(b => b.payment_method === 'card').length} Karte · {todayBookings.filter(b => b.payment_method === 'cash').length} Bar
                    </span>
                    <span className="font-bold text-primary-600">
                      Gesamt: {formatPrice(todayBookings.reduce((s, b) => s + b.price, 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Status Distribution */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Buchungsstatus</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {((stats.statusCounts as Array<{ status: string; count: number }>) || []).map(({ status, count }) => (
                  <div key={status} className={`rounded-xl p-4 text-center ${STATUS_COLORS[status]}`}>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm">{STATUS_LABELS[status] || status}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Morgen zu belasten */}
            {(() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowLabel = tomorrow.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
              return (
                <div className={cn(
                  'rounded-2xl p-6 shadow-sm',
                  tomorrowCards.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-white'
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💳</span>
                      <div>
                        <h3 className="font-bold text-gray-900">Morgen zu belasten</h3>
                        <p className="text-xs text-gray-500">{tomorrowLabel}</p>
                      </div>
                    </div>
                    {tomorrowCards.length > 0 && (
                      <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        {tomorrowCards.length} Karte{tomorrowCards.length > 1 ? 'n' : ''}
                      </span>
                    )}
                  </div>

                  {tomorrowCards.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">✓ Keine Kreditkartenzahlungen für morgen</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-amber-200">
                            <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Buchung</th>
                            <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Uhrzeit</th>
                            <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Kunde</th>
                            <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Strecke</th>
                            <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Preis</th>
                            <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs" colSpan={2}>Karte</th>
                            <th className="py-2 px-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {tomorrowCards.map((b) => (
                            <tr key={b.id} className="hover:bg-amber-100/50">
                              <td className="py-2 px-2 font-mono text-xs text-primary-600">{b.booking_number}</td>
                              <td className="py-2 px-2 font-medium text-xs whitespace-nowrap">
                                {b.pickup_datetime ? new Date(b.pickup_datetime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'} Uhr
                              </td>
                              <td className="py-2 px-2">
                                <div className="font-medium">{b.name}</div>
                                <div className="text-xs text-gray-500">{b.phone}</div>
                              </td>
                              <td className="py-2 px-2 text-xs text-gray-600 max-w-[180px]">
                                <div className="truncate">{b.pickup_address}</div>
                                <div className="truncate text-gray-400">→ {b.dropoff_address}</div>
                              </td>
                              <td className="py-2 px-2 font-bold text-primary-600 whitespace-nowrap">{formatPrice(b.price)}</td>
                              <td className="py-2 px-2 text-xs" colSpan={2}>
                                {b.company_id ? (
                                  <span className="inline-flex items-center gap-1 text-gray-500">
                                    🏢 Firmenkunde — hinterlegte Karte
                                    {b.charge_status === 'succeeded' && <CheckCircle2 size={13} className="text-green-500" />}
                                    {b.charge_status === 'failed' && (
                                      <span title={b.charge_error || undefined}><AlertCircle size={13} className="text-red-500" /></span>
                                    )}
                                  </span>
                                ) : b.stripe_payment_method_id ? (
                                  <span className="text-gray-600 font-mono">
                                    {(b.card_brand || 'Karte').toUpperCase()} •••• {b.card_last4}
                                  </span>
                                ) : b.card_number ? (
                                  <span className="text-amber-700 font-mono" title="Alte Buchung — noch keine Stripe-Karte">
                                    {b.card_holder || '—'} · •••• {b.card_number.slice(-4)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="py-2 px-2">
                                {(b.company_id || b.stripe_payment_method_id) ? (
                                  b.charge_status === 'succeeded' ? (
                                    <span className="text-xs text-green-600 font-medium">Abgebucht</span>
                                  ) : (
                                    <button
                                      onClick={() => handleChargeSavedCard(b.id)}
                                      disabled={chargingId === b.id}
                                      className="flex items-center gap-1 text-xs bg-primary-600 hover:bg-primary-700 text-white px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors disabled:opacity-50"
                                    >
                                      <Zap size={12} />
                                      {chargingId === b.id ? 'Wird abgebucht...' : (b.charge_status === 'failed' ? 'Erneut versuchen' : 'Stripe: Abbuchen')}
                                    </button>
                                  )
                                ) : b.card_number ? (
                                  <button
                                    onClick={() => { setSelectedBooking(b); setShowCardPopup(true); setCardVisible(false); }}
                                    className="flex items-center gap-1 text-xs bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors"
                                  >
                                    <Eye size={12} />
                                    Karte
                                  </button>
                                ) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-3 pt-3 border-t border-amber-200 flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          Gesamt zu belasten:
                        </span>
                        <span className="text-lg font-bold text-primary-600">
                          {formatPrice(tomorrowCards.reduce((sum, b) => sum + b.price, 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Finanzamt Report */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Finanzamt — Kreditkartenbericht</h3>
              <div className="flex items-end gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Monat</label>
                  <select
                    value={reportMonth}
                    onChange={(e) => setReportMonth(parseInt(e.target.value))}
                    className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'].map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Jahr</label>
                  <select
                    value={reportYear}
                    onChange={(e) => setReportYear(parseInt(e.target.value))}
                    className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {[2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <a
                  href={adminApi.getFinanzamtReport(reportMonth, reportYear)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  PDF herunterladen
                </a>
                <button
                  onClick={async () => {
                    setStripeSyncing(true);
                    setStripeSyncResult(null);
                    try {
                      const result = await adminApi.autoSyncStripe(reportMonth, reportYear);
                      setStripeSyncResult(result);
                      loadBookings();
                    } catch (err: any) {
                      alert('Stripe Sync Fehler: ' + (err.response?.data?.error || err.message));
                    } finally {
                      setStripeSyncing(false);
                    }
                  }}
                  disabled={stripeSyncing}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  {stripeSyncing ? 'Synchronisiere...' : '⚡ Stripe Sync'}
                </button>
              </div>
              {stripeSyncResult && (
                <div className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-2">
                  ✅ <strong>{stripeSyncResult.matched}</strong> Zahlungen zugeordnet
                  {stripeSyncResult.unmatched > 0 && <> · <span className="text-orange-600">⚠ {stripeSyncResult.unmatched} nicht zugeordnet</span></>}
                  {' '}(von {stripeSyncResult.total} Stripe-Zahlungen)
                </div>
              )}
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">Letzte Buchungen</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Buchung</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Gebucht am</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Kunde</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Von → Nach</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Preis</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((stats.recentBookings as Booking[]) || []).map((b: Booking) => (
                      <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-2 font-mono text-xs">{b.booking_number}</td>
                        <td className="py-2 px-2 text-xs text-gray-500">{formatDateTime(b.created_at)}</td>
                        <td className="py-2 px-2">{b.name}</td>
                        <td className="py-2 px-2 text-xs text-gray-600 max-w-xs truncate">
                          {b.pickup_address.substring(0, 25)}... → {b.dropoff_address.substring(0, 25)}...
                        </td>
                        <td className="py-2 px-2 font-bold text-primary-600">{formatPrice(b.price)}</td>
                        <td className="py-2 px-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[b.status]}`}>
                            {STATUS_LABELS[b.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
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
                    onClick={() => { setFilters({ status: '', vehicle_type: '', search: '', date_from: '', date_to: '' }); }}
                    className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm transition-colors"
                    title="Filter zurücksetzen"
                  >
                    <X size={16} />
                  </button>
                </div>
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
                              <div className="font-medium text-gray-900">{booking.name}</div>
                              <div className="text-xs text-gray-500">{booking.phone}</div>
                              {booking.company_id && (
                                <span className="inline-flex items-center gap-1 mt-1 bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                                  🏢 {booking.company_name || 'Kurumsal'}
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
                              ) : booking.rechnung_required ? (
                                <span
                                  className="inline-flex items-center gap-1 mt-1 ml-1 bg-gray-100 text-gray-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                  title="Kunde hat eine Rechnung angefordert — wird nach der Fahrt automatisch versendet"
                                >
                                  🧾 ausstehend
                                </span>
                              ) : null}
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
                                    onClick={() => { if (confirm(`Buchung ${booking.booking_number} wirklich stornieren?`)) updateStatus(booking.id, 'cancelled'); }}
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
        {activeTab === 'prices' && (
          <div className="space-y-4">
            {priceSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
                {priceSuccess}
              </div>
            )}

            {/* Global Settings */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
              <h3 className="font-bold text-gray-900 text-lg mb-4">⚙️ Allgemeine Einstellungen</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stadtfahrt toggle */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-semibold text-gray-700">Stadtfahrt erlauben</label>
                      <p className="text-xs text-gray-500 mt-0.5">Nicht-Flughafen-Fahrten erlauben (Anfahrtskosten werden berechnet)</p>
                    </div>
                    <button
                      onClick={async () => {
                        const newVal = settings.stadtfahrt_enabled === '1' ? '0' : '1';
                        setSettingsSaving(true);
                        try {
                          const updated = await adminApi.updateSettings({ stadtfahrt_enabled: newVal });
                          setSettings(updated);
                          setPriceSuccess(newVal === '1' ? 'Stadtfahrt aktiviert' : 'Stadtfahrt deaktiviert');
                          setTimeout(() => setPriceSuccess(''), 3000);
                        } catch { }
                        setSettingsSaving(false);
                      }}
                      className={cn(
                        'relative w-14 h-7 rounded-full transition-colors',
                        settings.stadtfahrt_enabled === '1' ? 'bg-green-500' : 'bg-gray-300'
                      )}
                      disabled={settingsSaving}
                    >
                      <div className={cn(
                        'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
                        settings.stadtfahrt_enabled === '1' ? 'translate-x-7' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>
                </div>
                {/* Anfahrt price per km */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Anfahrtskosten pro km (€)</label>
                  <p className="text-xs text-gray-500 mb-2">Preis pro km für Anfahrt von Freising zum Abholort (nur bei Nicht-Flughafen-Fahrten)</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.10"
                      min="0"
                      value={settings.anfahrt_price_per_km || '1.70'}
                      onChange={(e) => setSettings(prev => ({ ...prev, anfahrt_price_per_km: e.target.value }))}
                      className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <span className="text-gray-500 text-sm">€/km</span>
                    <button
                      onClick={async () => {
                        setSettingsSaving(true);
                        try {
                          const updated = await adminApi.updateSettings({ anfahrt_price_per_km: settings.anfahrt_price_per_km });
                          setSettings(updated);
                          setPriceSuccess('Anfahrtskosten aktualisiert');
                          setTimeout(() => setPriceSuccess(''), 3000);
                        } catch { }
                        setSettingsSaving(false);
                      }}
                      disabled={settingsSaving}
                      className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
                    >
                      {settingsSaving ? '...' : 'Speichern'}
                    </button>
                  </div>
                </div>
                {/* Min advance booking hours */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Minimum Vorlaufzeit (Stunden)</label>
                  <p className="text-xs text-gray-500 mb-2">Buchungen müssen mindestens diese Anzahl Stunden vor der Fahrt erfolgen. Standard: 1,5 Std.</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={settings.min_advance_hours || '1.5'}
                      onChange={(e) => setSettings(prev => ({ ...prev, min_advance_hours: e.target.value }))}
                      className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <span className="text-gray-500 text-sm">Std.</span>
                    <button
                      onClick={async () => {
                        setSettingsSaving(true);
                        try {
                          const updated = await adminApi.updateSettings({ min_advance_hours: settings.min_advance_hours });
                          setSettings(updated);
                          setPriceSuccess('Vorlaufzeit aktualisiert');
                          setTimeout(() => setPriceSuccess(''), 3000);
                        } catch { }
                        setSettingsSaving(false);
                      }}
                      disabled={settingsSaving}
                      className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
                    >
                      {settingsSaving ? '...' : 'Speichern'}
                    </button>
                  </div>
                </div>
                {/* Checkout A/B test (variant B: mobile sticky price bar on /buchen) */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Checkout-Test (Mobile Preis-Leiste)</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Prozentsatz der Besucher, die auf /buchen die neue mobile Preis-Leiste (Variante B) statt der
                    normalen Ansicht sehen. "off" = niemand (0 %). Zuteilung ist pro Besucher dauerhaft (gleiche
                    Person sieht immer dieselbe Variante).
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="10"
                      min="0"
                      max="100"
                      value={settings.experiment_checkout_v2 === 'off' ? '0' : (settings.experiment_checkout_v2 || '0')}
                      onChange={(e) => {
                        const n = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                        setSettings(prev => ({ ...prev, experiment_checkout_v2: String(n) }));
                      }}
                      className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <span className="text-gray-500 text-sm">% der Besucher</span>
                    <button
                      onClick={async () => {
                        setSettingsSaving(true);
                        try {
                          const value = settings.experiment_checkout_v2 === '0' ? 'off' : settings.experiment_checkout_v2;
                          const updated = await adminApi.updateSettings({ experiment_checkout_v2: value });
                          setSettings(updated);
                          setPriceSuccess('Checkout-Test aktualisiert');
                          setTimeout(() => setPriceSuccess(''), 3000);
                        } catch { }
                        setSettingsSaving(false);
                      }}
                      disabled={settingsSaving}
                      className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
                    >
                      {settingsSaving ? '...' : 'Speichern'}
                    </button>
                  </div>
                </div>
                {/* Night confirmation */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="font-semibold text-gray-700">🌙 Nacht-Bestätigung</label>
                      <p className="text-xs text-gray-500 mt-0.5">Der Hinweis erscheint nur, wenn die Buchung in diesem Zeitfenster (Münchner Zeit) eingeht UND die Fahrt in diesem Zeitfenster startet. Dann wird der Kunde gebeten, sicherheitshalber zusätzlich telefonisch zu bestätigen (Bestätigungsseite + E-Mail). Wir sind zwar rund um die Uhr erreichbar, möchten genuin nächtliche Fahrten aber garantiert einplanen. Standard: 22–07 Uhr.</p>
                    </div>
                    <button
                      onClick={async () => {
                        const newVal = settings.night_confirm_enabled === '1' ? '0' : '1';
                        setSettingsSaving(true);
                        try {
                          const updated = await adminApi.updateSettings({ night_confirm_enabled: newVal });
                          setSettings(updated);
                          setPriceSuccess(newVal === '1' ? 'Nacht-Bestätigung aktiviert' : 'Nacht-Bestätigung deaktiviert');
                          setTimeout(() => setPriceSuccess(''), 3000);
                        } catch { }
                        setSettingsSaving(false);
                      }}
                      className={cn(
                        'relative w-14 h-7 rounded-full transition-colors shrink-0',
                        settings.night_confirm_enabled === '1' ? 'bg-green-500' : 'bg-gray-300'
                      )}
                      disabled={settingsSaving}
                    >
                      <div className={cn(
                        'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
                        settings.night_confirm_enabled === '1' ? 'translate-x-7' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>
                  {settings.night_confirm_enabled === '1' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-600">Von</span>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={settings.night_confirm_start || '22'}
                        onChange={(e) => setSettings(prev => ({ ...prev, night_confirm_start: e.target.value }))}
                        className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                      <span className="text-sm text-gray-600">Uhr bis</span>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={settings.night_confirm_end || '7'}
                        onChange={(e) => setSettings(prev => ({ ...prev, night_confirm_end: e.target.value }))}
                        className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                      <span className="text-sm text-gray-600">Uhr</span>
                      <button
                        onClick={async () => {
                          setSettingsSaving(true);
                          try {
                            const updated = await adminApi.updateSettings({ night_confirm_start: settings.night_confirm_start, night_confirm_end: settings.night_confirm_end });
                            setSettings(updated);
                            setPriceSuccess('Nachtzeitraum aktualisiert');
                            setTimeout(() => setPriceSuccess(''), 3000);
                          } catch { }
                          setSettingsSaving(false);
                        }}
                        disabled={settingsSaving}
                        className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
                      >
                        {settingsSaving ? '...' : 'Speichern'}
                      </button>
                    </div>
                  )}
                </div>
                {/* Flight number validation toggle */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-semibold text-gray-700">✈️ Flugnummer-Validierung</label>
                      <p className="text-xs text-gray-500 mt-0.5">Prüft eingegebene Flugnummern bei Flughafen-Abholungen live gegen eine Flugdaten-API und zeigt dem Kunden eine Bestätigung oder Warnung. Blockiert die Buchung nie.</p>
                    </div>
                    <button
                      onClick={async () => {
                        const newVal = settings.flight_validation_enabled === '1' ? '0' : '1';
                        setSettingsSaving(true);
                        try {
                          const updated = await adminApi.updateSettings({ flight_validation_enabled: newVal });
                          setSettings(updated);
                          setPriceSuccess(newVal === '1' ? 'Flugnummer-Validierung aktiviert' : 'Flugnummer-Validierung deaktiviert');
                          setTimeout(() => setPriceSuccess(''), 3000);
                        } catch { }
                        setSettingsSaving(false);
                      }}
                      className={cn(
                        'relative w-14 h-7 rounded-full transition-colors shrink-0',
                        settings.flight_validation_enabled === '1' ? 'bg-green-500' : 'bg-gray-300'
                      )}
                      disabled={settingsSaving}
                    >
                      <div className={cn(
                        'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
                        settings.flight_validation_enabled === '1' ? 'translate-x-7' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>
                </div>
                {/* Phone number validation toggle */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-semibold text-gray-700">📱 Telefonnummer-Prüfung</label>
                      <p className="text-xs text-gray-500 mt-0.5">Prüft eingegebene Handynummern beim Tippen auf fehlende Ziffern und falsche Ländervorwahl und weist auf Festnetznummern hin. Blockiert die Buchung nie — der Kunde kann immer absenden.</p>
                    </div>
                    <button
                      onClick={async () => {
                        const newVal = settings.phone_validation_enabled === '1' ? '0' : '1';
                        setSettingsSaving(true);
                        try {
                          const updated = await adminApi.updateSettings({ phone_validation_enabled: newVal });
                          setSettings(updated);
                          setPriceSuccess(newVal === '1' ? 'Telefonnummer-Prüfung aktiviert' : 'Telefonnummer-Prüfung deaktiviert');
                          setTimeout(() => setPriceSuccess(''), 3000);
                        } catch { }
                        setSettingsSaving(false);
                      }}
                      className={cn(
                        'relative w-14 h-7 rounded-full transition-colors shrink-0',
                        settings.phone_validation_enabled === '1' ? 'bg-green-500' : 'bg-gray-300'
                      )}
                      disabled={settingsSaving}
                    >
                      <div className={cn(
                        'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
                        settings.phone_validation_enabled === '1' ? 'translate-x-7' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>
                </div>
                {/* Automatic booking status transitions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="font-semibold text-gray-700">Automatischer Buchungsstatus</label>
                      <p className="text-xs text-gray-500 mt-0.5">Neue Buchungen werden nach einer festgelegten Zeit automatisch bestätigt, und bestätigte Buchungen automatisch abgeschlossen, sobald die Abholzeit vorbei ist — ohne manuelles Klicken. Beim Aktivieren werden bereits fällige Buchungen sofort umgestellt, daher vorher die Liste kurz prüfen.</p>
                    </div>
                    <button
                      onClick={async () => {
                        const newVal = settings.auto_status_enabled === '1' ? '0' : '1';
                        setSettingsSaving(true);
                        try {
                          const updated = await adminApi.updateSettings({ auto_status_enabled: newVal });
                          setSettings(updated);
                          setPriceSuccess(newVal === '1' ? 'Automatischer Status aktiviert' : 'Automatischer Status deaktiviert');
                          setTimeout(() => setPriceSuccess(''), 3000);
                        } catch { }
                        setSettingsSaving(false);
                      }}
                      className={cn(
                        'relative w-14 h-7 rounded-full transition-colors shrink-0',
                        settings.auto_status_enabled === '1' ? 'bg-green-500' : 'bg-gray-300'
                      )}
                      disabled={settingsSaving}
                    >
                      <div className={cn(
                        'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
                        settings.auto_status_enabled === '1' ? 'translate-x-7' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>
                  {settings.auto_status_enabled === '1' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-600">Neu → Bestätigt nach</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={settings.auto_confirm_hours || '1'}
                          onChange={(e) => setSettings(prev => ({ ...prev, auto_confirm_hours: e.target.value }))}
                          className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <span className="text-sm text-gray-600">Std.</span>
                        <span className="text-sm text-gray-600 ml-3">Bestätigt → Abgeschlossen</span>
                        <input
                          type="number"
                          min="0"
                          value={settings.auto_complete_buffer_minutes || '0'}
                          onChange={(e) => setSettings(prev => ({ ...prev, auto_complete_buffer_minutes: e.target.value }))}
                          className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <span className="text-sm text-gray-600">Min. nach Abholzeit</span>
                        <button
                          onClick={async () => {
                            setSettingsSaving(true);
                            try {
                              const updated = await adminApi.updateSettings({ auto_confirm_hours: settings.auto_confirm_hours, auto_complete_buffer_minutes: settings.auto_complete_buffer_minutes });
                              setSettings(updated);
                              setPriceSuccess('Zeiten aktualisiert');
                              setTimeout(() => setPriceSuccess(''), 3000);
                            } catch { }
                            setSettingsSaving(false);
                          }}
                          disabled={settingsSaving}
                          className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"
                        >
                          {settingsSaving ? '...' : 'Speichern'}
                        </button>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">Firmenkunden mit hinterlegter Karte, die bei Fahrtabschluss automatisch belastet werden ("bei Abschluss zahlen")</p>
                        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                          <button
                            onClick={async () => {
                              setSettingsSaving(true);
                              try {
                                const updated = await adminApi.updateSettings({ auto_complete_include_company_charge: '0' });
                                setSettings(updated);
                                setPriceSuccess('Firmenkunden werden von der Automatik ausgeschlossen');
                                setTimeout(() => setPriceSuccess(''), 3000);
                              } catch { }
                              setSettingsSaving(false);
                            }}
                            disabled={settingsSaving}
                            className={cn(
                              'px-3 py-2 text-sm font-medium transition-colors',
                              settings.auto_complete_include_company_charge !== '1' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                            )}
                          >
                            Firmenkunden ausschließen
                          </button>
                          <button
                            onClick={async () => {
                              setSettingsSaving(true);
                              try {
                                const updated = await adminApi.updateSettings({ auto_complete_include_company_charge: '1' });
                                setSettings(updated);
                                setPriceSuccess('Alle Fahrten werden automatisch abgeschlossen — inkl. automatischer Kartenbelastung');
                                setTimeout(() => setPriceSuccess(''), 3000);
                              } catch { }
                              setSettingsSaving(false);
                            }}
                            disabled={settingsSaving}
                            className={cn(
                              'px-3 py-2 text-sm font-medium transition-colors border-l border-gray-200',
                              settings.auto_complete_include_company_charge === '1' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                            )}
                          >
                            Alle Fahrten
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {/* Zwischenstopp toggle */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-semibold text-gray-700">Zwischenstopp erlauben</label>
                      <p className="text-xs text-gray-500 mt-0.5">Kunden können einen Zwischenstopp zur Fahrt hinzufügen</p>
                    </div>
                    <button
                      onClick={async () => {
                        const newVal = settings.zwischenstopp_enabled === '1' ? '0' : '1';
                        setSettingsSaving(true);
                        try {
                          const updated = await adminApi.updateSettings({ zwischenstopp_enabled: newVal });
                          setSettings(updated);
                          setPriceSuccess(newVal === '1' ? 'Zwischenstopp aktiviert' : 'Zwischenstopp deaktiviert');
                          setTimeout(() => setPriceSuccess(''), 3000);
                        } catch { }
                        setSettingsSaving(false);
                      }}
                      className={cn(
                        'relative w-14 h-7 rounded-full transition-colors',
                        settings.zwischenstopp_enabled === '1' ? 'bg-green-500' : 'bg-gray-300'
                      )}
                      disabled={settingsSaving}
                    >
                      <div className={cn(
                        'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
                        settings.zwischenstopp_enabled === '1' ? 'translate-x-7' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Günlük Fahrt Hatırlatması */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">🔔 Günlük Fahrt Hatırlatması</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Otomatik Hatırlatma E-postası</p>
                    <p className="text-xs text-gray-500">Ayarlanan saatte yarınki fahrtlar müşterilere gönderilir (DE/EN/TR)</p>
                  </div>
                  <button
                    onClick={async () => {
                      const newVal = !reminderEnabled;
                      setReminderSaving(true);
                      try {
                        await adminApi.saveReminderSettings({ enabled: newVal });
                        setReminderEnabled(newVal);
                      } catch {}
                      setReminderSaving(false);
                    }}
                    className={cn(
                      'relative w-14 h-7 rounded-full transition-colors',
                      reminderEnabled ? 'bg-green-500' : 'bg-gray-300'
                    )}
                    disabled={reminderSaving}
                  >
                    <div className={cn(
                      'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
                      reminderEnabled ? 'translate-x-7' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Gönderim Saati</label>
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      disabled={!reminderEnabled || reminderSaving}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      setReminderSaving(true);
                      try {
                        await adminApi.saveReminderSettings({ time: reminderTime });
                      } catch {}
                      setReminderSaving(false);
                    }}
                    disabled={!reminderEnabled || reminderSaving}
                    className="mt-5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {reminderSaving ? '...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            </div>

            {/* PLZ-Zuschläge */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">🗺️ PLZ-Zuschläge</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Bestimmte PLZ-Gebiete erhalten einen Aufschlag auf den Fahrpreis. Der Zuschlag wird unsichtbar zum Gesamtpreis addiert.</p>
                </div>
                <button
                  onClick={async () => {
                    const newVal = settings.plz_surcharge_enabled === '1' ? '0' : '1';
                    setSettingsSaving(true);
                    try {
                      const updated = await adminApi.updateSettings({ plz_surcharge_enabled: newVal });
                      setSettings(updated);
                    } catch {}
                    setSettingsSaving(false);
                  }}
                  className={cn(
                    'relative w-14 h-7 rounded-full transition-colors shrink-0 ml-4',
                    settings.plz_surcharge_enabled === '1' ? 'bg-green-500' : 'bg-gray-300'
                  )}
                  disabled={settingsSaving}
                >
                  <div className={cn(
                    'absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform',
                    settings.plz_surcharge_enabled === '1' ? 'translate-x-7' : 'translate-x-0.5'
                  )} />
                </button>
              </div>
              {plzSurcharges.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">PLZ</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Stadt</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-600">Zuschlag (€)</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {plzSurcharges.map(s => (
                        <tr key={s.id} className="border-t border-gray-100">
                          <td className="px-4 py-2 font-mono">{s.plz}</td>
                          <td className="px-4 py-2">{s.stadt}</td>
                          <td className="px-4 py-2 text-right font-semibold">{s.surcharge.toFixed(2)} €</td>
                          <td className="px-2 py-2">
                            <button
                              onClick={async () => {
                                setPlzSaving(true);
                                try {
                                  const rows = await plzSurchargesApi.remove(s.id);
                                  setPlzSurcharges(rows);
                                } catch {}
                                setPlzSaving(false);
                              }}
                              disabled={plzSaving}
                              className="text-red-400 hover:text-red-600 transition-colors"
                              title="Löschen"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex gap-2 items-end flex-wrap">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">PLZ</label>
                  <input
                    type="text"
                    value={newPlz}
                    onChange={e => setNewPlz(e.target.value)}
                    placeholder="85435"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Stadt</label>
                  <input
                    type="text"
                    value={newPlzStadt}
                    onChange={e => setNewPlzStadt(e.target.value)}
                    placeholder="Erding"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Zuschlag (€)</label>
                  <input
                    type="number"
                    value={newPlzSurcharge}
                    onChange={e => setNewPlzSurcharge(e.target.value)}
                    placeholder="10"
                    step="0.50"
                    min="0"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
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
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {plzSaving ? '...' : '+ Hinzufügen'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {prices.map((price) => (
                <div key={price.vehicle_type} className="bg-white rounded-2xl shadow-sm p-6">
                  <div className="text-center mb-4">
                    <div className="text-3xl mb-2">
                      {price.vehicle_type === 'kombi' ? '🚗' : price.vehicle_type === 'van' ? '🚐' : '🚌'}
                    </div>
                    <h3 className="font-bold text-gray-900 capitalize text-lg">{price.vehicle_type}</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Grundpreis (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={priceEdits[price.vehicle_type]?.base_price || ''}
                        onChange={(e) => setPriceEdits(prev => ({
                          ...prev,
                          [price.vehicle_type]: { ...prev[price.vehicle_type], base_price: e.target.value }
                        }))}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Preis pro km (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={priceEdits[price.vehicle_type]?.price_per_km || ''}
                        onChange={(e) => setPriceEdits(prev => ({
                          ...prev,
                          [price.vehicle_type]: { ...prev[price.vehicle_type], price_per_km: e.target.value }
                        }))}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">⇄ Hin- & Rückfahrt Rabatt (%)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="50"
                        value={priceEdits[price.vehicle_type]?.roundtrip_discount || ''}
                        onChange={(e) => setPriceEdits(prev => ({
                          ...prev,
                          [price.vehicle_type]: { ...prev[price.vehicle_type], roundtrip_discount: e.target.value }
                        }))}
                        className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Rabatt bei Hin- & Rückfahrt (z.B. 5 = 5%)</p>
                    </div>
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">📍 Mindestgebühr</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Mindestpreis (€)</label>
                          <input
                            type="number"
                            step="0.50"
                            min="0"
                            value={priceEdits[price.vehicle_type]?.min_price ?? ''}
                            onChange={(e) => setPriceEdits(prev => ({
                              ...prev,
                              [price.vehicle_type]: { ...prev[price.vehicle_type], min_price: e.target.value }
                            }))}
                            className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Gültig bis (km)</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={priceEdits[price.vehicle_type]?.min_price_km ?? ''}
                            onChange={(e) => setPriceEdits(prev => ({
                              ...prev,
                              [price.vehicle_type]: { ...prev[price.vehicle_type], min_price_km: e.target.value }
                            }))}
                            className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Bis zu diesem km-Wert wird die Mindestgebühr angewendet (0 = deaktiviert)</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs text-gray-500 uppercase tracking-wide">🚲 Fahrrad</label>
                        <button
                          type="button"
                          onClick={() => setPriceEdits(prev => ({
                            ...prev,
                            [price.vehicle_type]: { ...prev[price.vehicle_type], fahrrad_enabled: !prev[price.vehicle_type]?.fahrrad_enabled }
                          }))}
                          className={cn(
                            'w-10 h-6 rounded-full transition-colors relative',
                            priceEdits[price.vehicle_type]?.fahrrad_enabled ? 'bg-green-500' : 'bg-gray-300'
                          )}
                        >
                          <span className={cn(
                            'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                            priceEdits[price.vehicle_type]?.fahrrad_enabled ? 'translate-x-4' : 'translate-x-0.5'
                          )} />
                        </button>
                      </div>
                      {priceEdits[price.vehicle_type]?.fahrrad_enabled && (
                        <>
                          <input
                            type="number"
                            step="0.50"
                            min="0"
                            value={priceEdits[price.vehicle_type]?.fahrrad_price || ''}
                            onChange={(e) => setPriceEdits(prev => ({
                              ...prev,
                              [price.vehicle_type]: { ...prev[price.vehicle_type], fahrrad_price: e.target.value }
                            }))}
                            className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <p className="text-xs text-gray-400 mt-1">Preis pro Fahrrad (€/Stk.)</p>
                        </>
                      )}
                      {!priceEdits[price.vehicle_type]?.fahrrad_enabled && (
                        <p className="text-xs text-gray-400 mt-1">Fahrrad für dieses Fahrzeug deaktiviert</p>
                      )}
                    </div>
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">👥 Kapazität</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Max. Personen</label>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            max="20"
                            value={priceEdits[price.vehicle_type]?.max_passengers || ''}
                            onChange={(e) => setPriceEdits(prev => ({
                              ...prev,
                              [price.vehicle_type]: { ...prev[price.vehicle_type], max_passengers: e.target.value }
                            }))}
                            className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Max. Koffer</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="30"
                            value={priceEdits[price.vehicle_type]?.max_luggage || ''}
                            onChange={(e) => setPriceEdits(prev => ({
                              ...prev,
                              [price.vehicle_type]: { ...prev[price.vehicle_type], max_luggage: e.target.value }
                            }))}
                            className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">System lässt keine Buchung über diesem Limit zu</p>
                    </div>
                    <button
                      onClick={() => savePrice(price.vehicle_type)}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm font-medium transition-colors"
                    >
                      Speichern
                    </button>
                    <p className="text-xs text-gray-400 text-center">
                      Zuletzt geändert: {new Date(price.updated_at).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Festpreisrouten (Fixed-Price Routes) */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">🛣️ Festpreisrouten</h3>
                <button
                  onClick={() => setEditingRoute({ name: '', pickup_keywords: '', dropoff_keywords: '', price_kombi: 0, price_van: 0, price_grossraumtaxi: 0, bidirectional: 1, enabled: 1 })}
                  className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-700"
                >+ Neue Route</button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Gesetzlich vorgeschriebene Festpreise für bestimmte Strecken. Überschreibt alle anderen Preisberechnungen.</p>

              {editingRoute && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3 border border-gray-200">
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Name (z.B. Flughafen ↔ Messe)"
                    value={editingRoute.name || ''} onChange={e => setEditingRoute(r => ({ ...r!, name: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Abholort-Schlüsselwörter (kommagetrennt)</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="flughafen münchen,munich airport"
                        value={editingRoute.pickup_keywords || ''} onChange={e => setEditingRoute(r => ({ ...r!, pickup_keywords: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Zielort-Schlüsselwörter (kommagetrennt)</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="neue messe,81829"
                        value={editingRoute.dropoff_keywords || ''} onChange={e => setEditingRoute(r => ({ ...r!, dropoff_keywords: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Kombi (€)</label>
                      <input type="number" step="0.50" className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={editingRoute.price_kombi || ''} onChange={e => setEditingRoute(r => ({ ...r!, price_kombi: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Van (€)</label>
                      <input type="number" step="0.50" className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={editingRoute.price_van || ''} onChange={e => setEditingRoute(r => ({ ...r!, price_van: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Großraumtaxi (€)</label>
                      <input type="number" step="0.50" className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={editingRoute.price_grossraumtaxi || ''} onChange={e => setEditingRoute(r => ({ ...r!, price_grossraumtaxi: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!editingRoute.bidirectional}
                        onChange={e => setEditingRoute(r => ({ ...r!, bidirectional: e.target.checked ? 1 : 0 }))} />
                      Beide Richtungen (↔)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={editingRoute.enabled !== 0}
                        onChange={e => setEditingRoute(r => ({ ...r!, enabled: e.target.checked ? 1 : 0 }))} />
                      Aktiv
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
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
                    <button className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-100" onClick={() => setEditingRoute(null)}>Abbrechen</button>
                  </div>
                </div>
              )}

              {fixedRoutes.length === 0 && !editingRoute && (
                <p className="text-sm text-gray-400 text-center py-4">Keine Festpreisrouten definiert.</p>
              )}
              {fixedRoutes.map(r => (
                <div key={r.id} className={cn('flex items-center justify-between border rounded-xl px-4 py-3 mb-2', r.enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60')}>
                  <div>
                    <div className="font-medium text-sm">{r.name} {r.bidirectional ? '↔' : '→'}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Kombi: {r.price_kombi}€ · Van: {r.price_van}€ · Großraum: {r.price_grossraumtaxi}€
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-blue-600 hover:text-blue-800 text-sm" onClick={() => setEditingRoute({ ...r })}>Bearbeiten</button>
                    <button className="text-red-500 hover:text-red-700 text-sm" onClick={async () => {
                      if (confirm('Route löschen?')) {
                        await fixedRoutesApi.remove(r.id);
                        fixedRoutesApi.getAll().then(setFixedRoutes);
                      }
                    }}>Löschen</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700 space-y-1">
              <p><strong>Preisformel (Einfach):</strong> Gesamtpreis = Grundpreis + (Distanz in km × Preis/km)</p>
              <p><strong>Preisformel (Hin- & Rückfahrt):</strong> Gesamtpreis = (Einfach × 2) − Rabatt %</p>
              <p><strong>Mindestgebühr:</strong> Wenn Distanz ≤ km-Limit und berechneter Preis &lt; Mindestpreis → Mindestpreis wird angewendet</p>
            </div>
          </div>
        )}

        {/* Statistik Tab */}
        {activeTab === 'statistics' && (
          <div className="space-y-6">
            {!detailedStats ? (
              <div className="text-center py-12 text-gray-400">Statistiken werden geladen...</div>
            ) : (
              <>
                {/* KPI Summary Row */}
                {(() => {
                  const avg = detailedStats.avgStats as { avg_price: number; avg_distance: number; avg_passengers: number; max_price: number; min_price: number };
                  const monthly = detailedStats.monthlyRevenue as Array<{ month: string; count: number; revenue: number }>;
                  const now = new Date();
                  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  const currentMonthData = monthly.find(m => m.month === currentMonth);
                  const lastMonth = currentMonthData;
                  // MTD karşılaştırma: bu ayın 1→bugün vs geçen ayın 1→aynı gün
                  const mtd = detailedStats.mtdComparison as Array<{ period: string; revenue: number; count: number }> | undefined;
                  const mtdCurrent = mtd?.find(r => r.period === 'current');
                  const mtdPrevious = mtd?.find(r => r.period === 'previous');
                  const growth = mtdCurrent && mtdPrevious && Number(mtdPrevious.revenue) > 0
                    ? (((Number(mtdCurrent.revenue) - Number(mtdPrevious.revenue)) / Number(mtdPrevious.revenue)) * 100).toFixed(1)
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
                        <div className="text-2xl font-bold text-gray-900">{lastMonth ? formatPrice(lastMonth.revenue) : '—'}</div>
                        <div className="text-xs text-gray-400 mt-1">{lastMonth?.count ?? 0} Fahrten</div>
                      </div>
                      <div className="bg-white rounded-2xl p-5 shadow-sm">
                        <div className="text-xs text-gray-500 mb-1">Wachstum (1–{now.getDate()}. {now.toLocaleString('de-DE', { month: 'short' })})</div>
                        <div className={`text-2xl font-bold ${growth !== null ? (parseFloat(growth) >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                          {growth !== null ? `${parseFloat(growth) >= 0 ? '+' : ''}${growth}%` : '—'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          vs. {mtdPrevious ? formatPrice(Number(mtdPrevious.revenue)) : '—'} (Vormonat gleicher Zeitraum)
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Monthly Revenue Chart */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-2">Monatlicher Umsatz (letzte 12 Monate)</h3>
                  <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary-600 inline-block" />Kreditkarte</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Barzahlung</span>
                  </div>
                  {(() => {
                    const data = detailedStats.monthlyRevenue as Array<{ month: string; count: number; revenue: number; cash_revenue: number; card_revenue: number; cash_count: number; card_count: number }>;
                    const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
                    return (
                      <div className="space-y-2">
                        {data.map(d => {
                          const [year, month] = d.month.split('-');
                          const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
                          const totalPct = (d.revenue / maxRevenue) * 100;
                          const cardPct = d.revenue > 0 ? (d.card_revenue / d.revenue) * totalPct : 0;
                          const cashPct = d.revenue > 0 ? (d.cash_revenue / d.revenue) * totalPct : 0;
                          return (
                            <div key={d.month}>
                              <div className="flex items-center gap-3">
                                <div className="w-14 text-xs text-gray-500 text-right shrink-0">{label}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden flex">
                                  <div className="h-full bg-primary-600 transition-all" style={{ width: `${cardPct}%` }} />
                                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${cashPct}%` }} />
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
                            const isCard = d.payment_method === 'card';
                            return (
                              <div key={d.payment_method}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="font-medium">{isCard ? '💳 Kreditkarte' : '💵 Barzahlung'}</span>
                                  <span className="text-gray-500">{d.count} Fahrten</span>
                                </div>
                                <div className="bg-gray-100 rounded-full h-7 relative overflow-hidden">
                                  <div className={`h-full ${isCard ? 'bg-blue-500' : 'bg-emerald-500'} rounded-full`} style={{ width: `${pct}%` }} />
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
      </div>

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
              {/* Fahrer & Live-Tracking — top of modal */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-blue-900 text-sm">🚕 Fahrer & Live-Tracking</h3>
                <div className="flex gap-2">
                  <select
                    className="flex-1 border rounded-lg px-2 py-1 text-sm"
                    defaultValue=""
                    onChange={(e) => handleAssignDriver(e.target.value ? Number(e.target.value) : null)}
                    disabled={assigning}
                  >
                    <option value="">— Kein Fahrer —</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}{d.vehicle_plate ? ` · ${d.vehicle_plate}` : ''}</option>
                    ))}
                  </select>
                  {assigning && <span className="text-xs text-gray-400 self-center">...</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Neuer Fahrer Name"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    className="flex-1 border rounded-lg px-2 py-1 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateDriver()}
                  />
                  <button onClick={handleCreateDriver} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">+ Hinzufügen</button>
                </div>
                {trackingLinks && (
                  <div className="space-y-2">
                    {[
                      { label: '🔗 Kundenlink', key: 'cust', url: trackingLinks.customer_link },
                      { label: '📍 Fahrerlink', key: 'drv', url: trackingLinks.driver_link },
                    ].map(({ label, key, url }) => (
                      <div key={key} className="flex gap-2 items-center">
                        <span className="text-xs text-gray-600 flex-1 truncate">{label}: <span className="font-mono text-gray-800">{url.split('?')[0].split('/').slice(-1)[0]}</span></span>
                        <button onClick={() => copyLink(url, key)} className="text-xs bg-white border rounded px-2 py-0.5 hover:bg-gray-50">
                          {copied === key ? '✓' : 'Kopieren'}
                        </button>
                        <a href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="text-xs bg-green-500 text-white rounded px-2 py-0.5">WA</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                    <p className="font-semibold capitalize">{selectedBooking.payment_method === 'cash' ? 'Bargeld' : 'Karte'}</p>
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
                    setRechnungSprache('de');
                    // Prefer the billing address the customer supplied when booking;
                    // fall back to name + email for older bookings.
                    setRechnungEmpfaenger(
                      selectedBooking.rechnung_adresse
                        || selectedBooking.name + (selectedBooking.email ? '\n' + selectedBooking.email : '')
                    );
                    setEditingEmpfaenger(false);
                    setRechnungZahlungsart(selectedBooking.payment_method === 'card' ? 'kreditkarte' : 'bar');
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
              {/* Re-open the invoice that was actually sent (rebuilt from the stored
                  render params, so date and number match the customer's copy). */}
              {selectedBooking.rechnung_number && (
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/admin/bookings/${selectedBooking.id}/rechnung.pdf?token=${typeof window !== 'undefined' ? localStorage.getItem('admin_token') : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  <FileText size={15} />
                  Gesendete Rechnung ansehen ({selectedBooking.rechnung_number})
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rechnung Tab */}
      {activeTab === 'rechnung' && (
        <div className="space-y-6">
          {bankSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <Check size={16} />{bankSuccess}
            </div>
          )}
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

      {/* Marketing */}
      {activeTab === 'marketing' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Users size={18} /> Müşteri Listesi
                <span className="text-xs font-normal text-gray-500">
                  ({marketingCustomers.length} kişi, {marketingSelected.size} seçili)
                </span>
              </h3>
            </div>
            <div className="flex gap-2 mb-3 flex-wrap">
              <button
                onClick={loadMarketingCustomers}
                disabled={marketingLoading}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium"
              >
                <RefreshCw size={14} className={marketingLoading ? 'animate-spin' : ''} />
                DB&apos;den Yükle
              </button>
              <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer">
                <Upload size={14} />
                {marketingIcsLoading ? 'Yükleniyor...' : '.ics Yükle'}
                <input
                  type="file"
                  accept=".ics,text/calendar"
                  className="hidden"
                  disabled={marketingIcsLoading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleIcsUpload(f); e.target.value = ''; }}
                />
              </label>
              <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer">
                <Upload size={14} />
                CSV Yükle
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    f.text().then(text => {
                      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                      const emails = lines.filter(l => l.includes('@') && !l.toLowerCase().startsWith('email'));
                      setMarketingCustomers(prev => {
                        const existing = new Map(prev.map(c => [c.email.toLowerCase(), c]));
                        for (const email of emails) {
                          const key = email.toLowerCase();
                          if (!existing.has(key)) existing.set(key, { email: key, name: '', source: 'ics' });
                        }
                        return Array.from(existing.values());
                      });
                      alert(`${emails.length} email CSV'den yüklendi.`);
                    }).catch(() => alert('CSV dosyası okunamadı.'));
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                onClick={toggleMarketingSelectAll}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium"
              >
                <Check size={14} />
                {marketingSelected.size > 0 ? 'Seçimi Temizle' : 'Tümünü Seç'}
              </button>
            </div>
            <div className="flex gap-1 mb-2">
              {(['all', 'db', 'ics'] as const).map(f => {
                const count = f === 'all' ? marketingCustomers.length : marketingCustomers.filter(c => c.source === f).length;
                const label = f === 'all' ? 'Tümü' : f === 'db' ? 'DB' : 'Takvim';
                return (
                  <button
                    key={f}
                    onClick={() => { setMarketingSourceFilter(f); setMarketingSelected(new Set()); }}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                      marketingSourceFilter === f
                        ? f === 'ics' ? 'bg-purple-600 text-white border-purple-600' : 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="İsim veya email ara..."
                value={marketingSearch}
                onChange={(e) => setMarketingSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="border border-gray-100 rounded-lg max-h-[500px] overflow-y-auto">
              {marketingCustomers.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  Henüz müşteri yüklenmedi.<br />
                  &quot;DB&apos;den Yükle&quot; veya &quot;.ics Yükle&quot; ile başlayın.
                </div>
              ) : filterMarketingCustomers().length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">Aramanızla eşleşen müşteri yok.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-2 w-8"></th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">İsim</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Email</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-medium w-16">Kaynak</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterMarketingCustomers().map((c) => (
                      <tr key={c.email} className="border-t border-gray-50 hover:bg-gray-50 group">
                        <td className="py-2 px-2">
                          <input
                            type="checkbox"
                            checked={marketingSelected.has(c.email)}
                            onChange={() => toggleMarketingSelect(c.email)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-2 text-gray-900">{c.name || <span className="text-gray-400 italic">—</span>}</td>
                        <td className="py-2 px-2 text-gray-600 text-xs">{c.email}</td>
                        <td className="py-2 px-2">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            c.source === 'ics' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          )}>
                            {c.source === 'ics' ? 'Takvim' : 'DB'}
                          </span>
                        </td>
                        <td className="py-2 px-1">
                          <button
                            onClick={() => {
                              setMarketingCustomers(prev => prev.filter(x => x.email !== c.email));
                              setMarketingSelected(prev => { const n = new Set(prev); n.delete(c.email); return n; });
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Mail size={18} /> Email Oluştur
              </h3>
              {/* Editor mode toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setMarketingEditorMode('text')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    marketingEditorMode === 'text'
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Metin
                </button>
                <button
                  onClick={() => setMarketingEditorMode('html')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    marketingEditorMode === 'html'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {'</> HTML'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Konu (Subject)</label>
              <input
                type="text"
                value={marketingSubject}
                onChange={(e) => setMarketingSubject(e.target.value)}
                placeholder="Örn: Yaz sezonu özel indirimi"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {marketingEditorMode === 'text' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  İçerik
                  <span className="text-xs text-gray-500 ml-2">
                    ({'{isim}'} ile kişiselleştir · <strong>**kalın**</strong> · # başlık · - madde)
                  </span>
                </label>
                <textarea
                  value={marketingContent}
                  onChange={(e) => setMarketingContent(e.target.value)}
                  rows={14}
                  placeholder={`Merhaba {isim},\n\n# Yaz sezonu indirimi başladı!\n\nHavalimanı transferinizde **%10 indirim** kazanın.\n\n- Tüm araç tipleri dahil\n- Erken rezervasyon avantajı\n- 7/24 müşteri hizmetleri\n\nGörüşmek üzere!\nFlughafen-muenchen.TAXI`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono resize-y"
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    HTML Kaynak Kodu
                    <span className="text-xs text-gray-500 ml-2">({'{isim}'} ile kişiselleştir)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const fixed = fixMacRomanCorruption(marketingContent);
                        if (fixed !== marketingContent) {
                          setMarketingContent(fixed);
                          alert('Kodlama düzeltildi! ✓');
                        } else {
                          alert('Kodlama sorunu tespit edilmedi.');
                        }
                      }}
                      className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-2 py-0.5 rounded-full font-medium"
                    >
                      🔧 Düzelt
                    </button>
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Raw HTML</span>
                  </div>
                </div>
                <div className="relative">
                  <textarea
                    value={marketingContent}
                    onChange={(e) => setMarketingContent(e.target.value)}
                    onPaste={(e) => {
                      const pasted = e.clipboardData?.getData('text/plain');
                      if (pasted) {
                        const fixed = fixMacRomanCorruption(pasted);
                        if (fixed !== pasted) {
                          e.preventDefault();
                          const ta = e.currentTarget;
                          const start = ta.selectionStart ?? 0;
                          const end = ta.selectionEnd ?? marketingContent.length;
                          setMarketingContent(marketingContent.slice(0, start) + fixed + marketingContent.slice(end));
                        }
                      }
                    }}
                    rows={18}
                    spellCheck={false}
                    placeholder={`<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <style>\n    body { font-family: Arial, sans-serif; background: #f4f4f4; }\n    .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 8px; }\n    h1 { color: #1a365d; }\n    .btn { display: inline-block; background: #f6c644; color: #1a365d; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; }\n  </style>\n</head>\n<body>\n  <div class="container">\n    <h1>Merhaba {isim}!</h1>\n    <p>Email içeriğinizi buraya yazın.</p>\n    <a href="https://flughafen-muenchen.taxi" class="btn">Jetzt buchen</a>\n  </div>\n</body>\n</html>`}
                    className="w-full border border-purple-200 bg-gray-950 text-green-400 rounded-lg px-3 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono resize-y leading-relaxed"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  💡 Yapıştırırken encoding otomatik düzeltilir. Sorun devam ederse <strong>🔧 Düzelt</strong> butonuna basın.
                </p>
              </div>
            )}

            {marketingEditorMode === 'text' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buton Metni (opsiyonel)</label>
                  <input
                    type="text"
                    value={marketingButtonText}
                    onChange={(e) => setMarketingButtonText(e.target.value)}
                    placeholder="Hemen Rezervasyon"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buton URL (opsiyonel)</label>
                  <input
                    type="url"
                    value={marketingButtonUrl}
                    onChange={(e) => setMarketingButtonUrl(e.target.value)}
                    placeholder="https://flughafen-muenchen.taxi"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={previewMarketingEmail}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-medium flex-1 justify-center"
              >
                <Eye size={16} /> Önizleme
              </button>
              <button
                onClick={() => setMarketingShowConfirm(true)}
                disabled={marketingSelected.size === 0 || !marketingSubject.trim() || !marketingContent.trim() || marketingSending}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-sm font-semibold flex-1 justify-center"
              >
                <Send size={16} />
                {marketingSending ? 'Gönderiliyor...' : `${marketingSelected.size} Kişiye Gönder`}
              </button>
            </div>
            {marketingResult && (
              <div className={cn(
                'p-4 rounded-xl text-sm',
                marketingResult.failed === 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              )}>
                <strong>Sonuç:</strong> {marketingResult.sent} başarılı, {marketingResult.failed} başarısız.
                {marketingResult.errors.length > 0 && (
                  <ul className="mt-2 text-xs list-disc list-inside">
                    {marketingResult.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>{e.email}: {e.error}</li>
                    ))}
                    {marketingResult.errors.length > 5 && <li>...ve {marketingResult.errors.length - 5} hata daha</li>}
                  </ul>
                )}
              </div>
            )}
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

      {/* Marketing Preview Modal removed — preview opens in new tab */}

      {/* Marketing Confirm Send Modal */}
      {marketingShowConfirm && (
        <div
          className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !marketingSending) setMarketingShowConfirm(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Toplu Email Gönderimi</h3>
            <p className="text-gray-600 text-sm mb-4">
              <strong>{marketingSelected.size} kişiye</strong> aynı email gönderilecek.
              Bu işlem geri alınamaz. Emin misiniz?
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <div><span className="text-gray-500">Konu:</span> <strong>{marketingSubject}</strong></div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setMarketingShowConfirm(false)}
                disabled={marketingSending}
                className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 py-2.5 rounded-xl font-medium"
              >
                İptal
              </button>
              <button
                onClick={sendMarketingEmails}
                disabled={marketingSending}
                className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                {marketingSending ? <><RefreshCw size={16} className="animate-spin" /> Gönderiliyor...</> : <><Send size={16} /> Gönder</>}
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <select value={editForm.vehicle_type || 'kombi'} onChange={(e) => setEditForm(p => ({ ...p, vehicle_type: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
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
                      <select value={editForm.trip_type || 'oneway'} onChange={(e) => setEditForm(p => ({ ...p, trip_type: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
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
                    <input type="text" value={editForm.zwischenstopp_address || ''} onChange={(e) => setEditForm(p => ({ ...p, zwischenstopp_address: e.target.value }))} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
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

      {/* Rechnung Modal */}
      {showRechnungModal && selectedBooking && (
        <div
          className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !rechnungSending) setShowRechnungModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-primary-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Rechnung erstellen</h3>
                  <p className="text-primary-200 text-xs">{selectedBooking.booking_number}</p>
                </div>
              </div>
              {!rechnungSending && (
                <button onClick={() => setShowRechnungModal(false)} className="p-2 hover:bg-primary-500 rounded-lg">
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
                  Rechnungsnummer <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={rechnungsnummer}
                  onChange={(e) => setRechnungsnummer(e.target.value)}
                  placeholder="z.B. 2026-001"
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
              {rechnungSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <Check size={16} />Rechnung erfolgreich gesendet!
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
                    if (!rechnungsnummer.trim()) { setRechnungError('Bitte Rechnungsnummer eingeben.'); return; }
                    setRechnungError('');
                    setRechnungSending(true);
                    try {
                      await adminApi.sendRechnung(selectedBooking.id, rechnungsnummer.trim(), rechnungMwst, rechnungSprache, rechnungEmpfaenger.trim(), rechnungZahlungsart);
                      setRechnungSuccess(true);
                    } catch (err: unknown) {
                      setRechnungError(err instanceof Error ? err.message : 'Fehler beim Senden');
                    } finally { setRechnungSending(false); }
                  }}
                  disabled={rechnungSending || !rechnungsnummer.trim()}
                  className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
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
