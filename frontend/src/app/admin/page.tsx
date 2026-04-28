'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi, pricesApi, settingsApi, Booking, Price } from '@/lib/api';
import { formatPrice, formatDateTime, cn } from '@/lib/utils';
import {
  LogIn, LogOut, BarChart3, List, Tag, RefreshCw, ChevronLeft, ChevronRight,
  TrendingUp, Calendar, Check, X, Search, Lock, Eye, PieChart, FileText, Building2, Send,
  Mail, Upload, Users, BadgePercent
} from 'lucide-react';

type Tab = 'dashboard' | 'bookings' | 'prices' | 'statistics' | 'rechnung' | 'marketing' | 'promotions';

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
  const [priceEdits, setPriceEdits] = useState<Record<string, { base_price: string; price_per_km: string; roundtrip_discount: string; fahrrad_price: string; fahrrad_enabled: boolean; max_passengers: string; max_luggage: string; min_price: string; min_price_km: string }>>({});
  const [priceSuccess, setPriceSuccess] = useState('');
  const [showCardPopup, setShowCardPopup] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({ stadtfahrt_enabled: '0', anfahrt_price_per_km: '1.70', zwischenstopp_enabled: '0' });
  const [settingsSaving, setSettingsSaving] = useState(false);
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
  const [tomorrowCardBooking, setTomorrowCardBooking] = useState<Booking | null>(null);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [detailedStats, setDetailedStats] = useState<Record<string, unknown> | null>(null);

  // Promotions state
  interface Promotion {
    id: number; code: string; type: 'fixed' | 'percent'; value: number;
    start_date: string; end_date: string; max_uses: number | null;
    used_count: number; active: number; description: string | null; kombinierbar: number;
  }
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promoForm, setPromoForm] = useState({ code: '', type: 'fixed', value: '', start_date: '', end_date: '', max_uses: '', description: '', kombinierbar: false });
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoMsg, setPromoMsg] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
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

  useEffect(() => {
    if (isLoggedIn) {
      if (activeTab === 'dashboard') {
        loadStats();
        adminApi.getTomorrowCards().then(setTomorrowCards).catch(() => {});
        adminApi.getTodayBookings().then(setTodayBookings).catch(() => {});
      }
      if (activeTab === 'bookings') loadBookings();
      if (activeTab === 'statistics') loadDetailedStats();
      if (activeTab === 'prices') {
        loadPrices();
        settingsApi.getAll().then(s => setSettings(s)).catch(() => {});
      }
      if (activeTab === 'rechnung') {
        adminApi.getBankSettings().then(d => setBankSettings(d)).catch(() => {});
      }
      if (activeTab === 'marketing' && marketingCustomers.length === 0) {
        loadMarketingCustomers();
      }
      if (activeTab === 'promotions') {
        const promoBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');
        fetch(`${promoBase}/api/promotions/admin/list`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json()).then(setPromotions).catch(() => {});
      }
    }
  }, [isLoggedIn, activeTab, token, loadStats, loadBookings, loadPrices, loadDetailedStats, loadMarketingCustomers, marketingCustomers.length]);

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
        <div className="flex gap-2 mb-6">
          {[
            { id: 'dashboard' as Tab, icon: BarChart3, label: 'Dashboard' },
            { id: 'bookings' as Tab, icon: List, label: 'Buchungen' },
            { id: 'prices' as Tab, icon: Tag, label: 'Preise' },
            { id: 'statistics' as Tab, icon: PieChart, label: 'Statistik' },
            { id: 'rechnung' as Tab, icon: FileText, label: 'Rechnung' },
            { id: 'marketing' as Tab, icon: Mail, label: 'Marketing' },
            { id: 'promotions' as Tab, icon: BadgePercent, label: 'Aktionen' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                activeTab === id ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

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
                            <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Karteninhaber</th>
                            <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Kartennr.</th>
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
                              <td className="py-2 px-2 text-xs">{b.card_holder || '—'}</td>
                              <td className="py-2 px-2 font-mono text-xs">
                                {b.card_number ? `•••• •••• •••• ${b.card_number.slice(-4)}` : '—'}
                              </td>
                              <td className="py-2 px-2">
                                <button
                                  onClick={() => {
                                    setTomorrowCardBooking(b);
                                    setSelectedBooking(b);
                                    setShowCardPopup(true);
                                    setCardVisible(false);
                                  }}
                                  className="flex items-center gap-1 text-xs bg-primary-600 hover:bg-primary-700 text-white px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-colors"
                                >
                                  <Eye size={12} />
                                  Karte
                                </button>
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
                    placeholder="Name, Telefon, E-Mail, Buchungsnr..."
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
                  onChange={(e) => setFilters(p => ({ ...p, date_from: e.target.value }))}
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
                            </td>
                            <td className="py-3 px-4 capitalize">{booking.vehicle_type}</td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-primary-600">{formatPrice(booking.price)}</span>
                              {booking.payment_method === 'card' && (
                                <span className={cn(
                                  'ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                  booking.steuersatz === 7 ? 'bg-green-100 text-green-700'
                                    : booking.steuersatz === 19 ? 'bg-blue-100 text-blue-700'
                                    : 'bg-red-100 text-red-600'
                                )}>
                                  {booking.steuersatz ? `${booking.steuersatz}%` : 'MwSt?'}
                                </span>
                              )}
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
                  // Bu ay ve geçen ay — takvim bazlı karşılaştırma
                  const now = new Date();
                  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
                  const currentMonthData = monthly.find(m => m.month === currentMonth);
                  const lastMonth = currentMonthData; // Bu ay = "son ay"
                  const prevMonth = monthly.find(m => m.month === prevMonthKey);
                  const growth = lastMonth && prevMonth && prevMonth.revenue > 0
                    ? (((lastMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100).toFixed(1)
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
                        <div className="text-xs text-gray-500 mb-1">Wachstum (Monat)</div>
                        <div className={`text-2xl font-bold ${growth !== null ? (parseFloat(growth) >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-400'}`}>
                          {growth !== null ? `${parseFloat(growth) >= 0 ? '+' : ''}${growth}%` : '—'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          vs. {prevMonth ? formatPrice(prevMonth.revenue) : 'Vormonat'}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Monthly Revenue Chart */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-5">Monatlicher Umsatz (letzte 12 Monate)</h3>
                  {(() => {
                    const data = detailedStats.monthlyRevenue as Array<{ month: string; count: number; revenue: number }>;
                    const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
                    return (
                      <div className="space-y-2">
                        {data.map(d => {
                          const [year, month] = d.month.split('-');
                          const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
                          const pct = (d.revenue / maxRevenue) * 100;
                          return (
                            <div key={d.month} className="flex items-center gap-3">
                              <div className="w-14 text-xs text-gray-500 text-right shrink-0">{label}</div>
                              <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                                <div
                                  className="h-full bg-primary-600 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="absolute inset-0 flex items-center px-3">
                                  <span className="text-xs font-medium text-white drop-shadow">{formatPrice(d.revenue)}</span>
                                </div>
                              </div>
                              <div className="w-14 text-xs text-gray-400 shrink-0">{d.count} Fhrt.</div>
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
                  {/* Day of week */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4">Buchungen nach Wochentag</h3>
                    {(() => {
                      const data = detailedStats.dayOfWeekStats as Array<{ dow: number; count: number; revenue: number }>;
                      const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
                      const maxCount = Math.max(...data.map(d => d.count), 1);
                      return (
                        <div className="space-y-2">
                          {days.map((day, i) => {
                            const d = data.find(x => x.dow === i);
                            const count = d?.count ?? 0;
                            const pct = (count / maxCount) * 100;
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <div className="w-6 text-xs text-gray-500 text-center shrink-0">{day}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                                  <div className="h-full bg-primary-400 rounded-full" style={{ width: `${pct}%` }} />
                                  {count > 0 && (
                                    <div className="absolute inset-0 flex items-center px-2">
                                      <span className="text-xs text-white drop-shadow font-medium">{count}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="w-20 text-xs text-gray-400 shrink-0 text-right">{formatPrice(d?.revenue ?? 0)}</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Hour heatmap */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4">Buchungen nach Uhrzeit</h3>
                    {(() => {
                      const data = detailedStats.hourStats as Array<{ hour: number; count: number }>;
                      const maxCount = Math.max(...data.map(d => d.count), 1);
                      const hours = Array.from({ length: 24 }, (_, i) => i);
                      return (
                        <div className="grid grid-cols-12 gap-1">
                          {hours.map(h => {
                            const d = data.find(x => x.hour === h);
                            const count = d?.count ?? 0;
                            const intensity = Math.round((count / maxCount) * 5);
                            const bg = ['bg-gray-100', 'bg-primary-100', 'bg-primary-200', 'bg-primary-400', 'bg-primary-600', 'bg-primary-800'][intensity];
                            return (
                              <div key={h} title={`${h}:00 — ${count} Fahrten`} className={`${bg} rounded aspect-square flex items-center justify-center cursor-default`}>
                                <span className="text-[9px] text-gray-600 font-medium">{h}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                      <span>Wenig</span>
                      {['bg-gray-100','bg-primary-100','bg-primary-200','bg-primary-400','bg-primary-600','bg-primary-800'].map((c,i) => (
                        <div key={i} className={`${c} w-4 h-4 rounded`} />
                      ))}
                      <span>Viel</span>
                    </div>
                  </div>
                </div>

                {/* Top Routes */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-4">Top 10 Strecken</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">#</th>
                          <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Von</th>
                          <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">Nach</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs">Fahrten</th>
                          <th className="text-right py-2 px-2 text-gray-500 font-medium text-xs">Umsatz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {((detailedStats.topRoutes as Array<{ pickup_address: string; dropoff_address: string; count: number; revenue: number }>) || []).map((r, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-2 text-gray-400 font-bold text-xs">{i + 1}</td>
                            <td className="py-2 px-2 text-xs text-gray-700 max-w-[180px] truncate">{r.pickup_address}</td>
                            <td className="py-2 px-2 text-xs text-gray-500 max-w-[180px] truncate">→ {r.dropoff_address}</td>
                            <td className="py-2 px-2 text-right font-bold text-primary-600">{r.count}×</td>
                            <td className="py-2 px-2 text-right text-gray-700">{formatPrice(r.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Booking Detail Modal */}
      {/* Card Info Popup */}
      {showCardPopup && selectedBooking && (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCardPopup(false); setCardVisible(false); } }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-primary-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💳</span>
                <div>
                  <h3 className="font-bold text-lg">Kartendaten</h3>
                  <p className="text-primary-200 text-xs">{selectedBooking.booking_number}</p>
                </div>
              </div>
              <button onClick={() => { setShowCardPopup(false); setCardVisible(false); }} className="p-2 hover:bg-primary-600 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gradient-to-br from-primary-700 to-primary-900 rounded-xl p-5 text-white space-y-3 shadow-lg">
                <div>
                  <p className="text-primary-300 text-xs mb-1">Karteninhaber</p>
                  <p className="font-bold text-lg tracking-wide">{selectedBooking.card_holder || '—'}</p>
                </div>
                <div>
                  <p className="text-primary-300 text-xs mb-1">Kartennummer</p>
                  <p className="font-mono text-xl tracking-widest">
                    {cardVisible
                      ? (selectedBooking.card_number || '').replace(/(.{4})/g, '$1 ').trim()
                      : '•••• •••• •••• ' + (selectedBooking.card_number?.slice(-4) || '????')}
                  </p>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="text-primary-300 text-xs mb-1">Gültig bis</p>
                    <p className="font-mono font-bold">{selectedBooking.card_expiry || '—'}</p>
                  </div>
                  <div>
                    <p className="text-primary-300 text-xs mb-1">CVV</p>
                    <p className="font-mono font-bold">{cardVisible ? selectedBooking.card_cvv : '•••'}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setCardVisible(!cardVisible)}
                className="w-full flex items-center justify-center gap-2 border-2 border-primary-600 text-primary-600 hover:bg-primary-50 rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                <Eye size={16} />
                {cardVisible ? 'Verbergen' : 'Vollständig anzeigen'}
              </button>
              <p className="text-xs text-gray-400 text-center">🔒 Diese Daten sind nur für Administratoren sichtbar</p>
            </div>
          </div>
        </div>
      )}

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
                  {selectedBooking.payment_method === 'card' && selectedBooking.card_number ? (
                    <button
                      onClick={() => { setShowCardPopup(true); setCardVisible(false); }}
                      className="font-semibold text-primary-600 underline underline-offset-2 flex items-center gap-1 hover:text-primary-800 transition-colors"
                    >
                      💳 Karte — Details anzeigen
                    </button>
                  ) : (
                    <p className="font-semibold capitalize">{selectedBooking.payment_method === 'cash' ? 'Bargeld' : 'Karte'}</p>
                  )}
                </div>
              </div>

              {/* Steuersatz - only for card payments */}
              {selectedBooking.payment_method === 'card' && (
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
              )}

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

              <div className="flex gap-3 pt-4 flex-wrap">
                <a
                  href={`tel:${selectedBooking.phone}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  Anrufen
                </a>
                <a
                  href={`https://wa.me/${selectedBooking.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  WhatsApp
                </a>
                <button
                  onClick={() => {
                    setRechnungsnummer('');
                    setRechnungMwst(7);
                    setRechnungSprache('de');
                    setRechnungEmpfaenger(selectedBooking.name + (selectedBooking.email ? '\n' + selectedBooking.email : ''));
                    setEditingEmpfaenger(false);
                    setRechnungZahlungsart(selectedBooking.payment_method === 'card' ? 'kreditkarte' : 'bar');
                    setRechnungSuccess(false);
                    setRechnungError('');
                    setShowRechnungModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  <FileText size={15} />
                  Rechnung senden
                </button>
              </div>
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
              setPromoForm({ code: '', type: 'fixed', value: '', start_date: '', end_date: '', max_uses: '', description: '', kombinierbar: false });
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
