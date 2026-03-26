'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi, pricesApi, settingsApi, Booking, Price } from '@/lib/api';
import { formatPrice, formatDateTime, cn } from '@/lib/utils';
import {
  LogIn, LogOut, BarChart3, List, Tag, RefreshCw, ChevronLeft, ChevronRight,
  TrendingUp, Calendar, Check, X, Search, Lock, Eye
} from 'lucide-react';

type Tab = 'dashboard' | 'bookings' | 'prices';

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

  useEffect(() => {
    if (isLoggedIn) {
      if (activeTab === 'dashboard') loadStats();
      if (activeTab === 'bookings') loadBookings();
      if (activeTab === 'prices') {
        loadPrices();
        settingsApi.getAll().then(s => setSettings(s)).catch(() => {});
      }
    }
  }, [isLoggedIn, activeTab, loadStats, loadBookings, loadPrices]);

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
                            <td className="py-3 px-4 font-bold text-primary-600">{formatPrice(booking.price)}</td>
                            <td className="py-3 px-4">
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[booking.status]}`}>
                                {STATUS_LABELS[booking.status]}
                              </span>
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
                                    onClick={() => updateStatus(booking.id, 'cancelled')}
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

              <div className="flex gap-3 pt-4">
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
