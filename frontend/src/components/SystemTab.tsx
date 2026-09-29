'use client';

import { useEffect, useState, useCallback } from 'react';
import PasswordChangeCard from './PasswordChangeCard';

// Mirrors backend services/alertCenter.ts
type AlertCategory = 'site_down' | 'site_recovered' | 'server' | 'pm2' | 'business' | 'ads' | 'daily_summary';
interface AlertCfg {
  enabled: boolean;
  categories: Record<AlertCategory, boolean>;
  down_after_minutes: number;
  reminder_hours: number;
  server_cooldown_hours: number;
  business_cooldown_hours: number;
  email_to?: string;
}
import {
  Server, Cpu, HardDrive, MemoryStick, RefreshCw, Mail,
  CheckCircle2, AlertTriangle, XCircle, Clock, Activity,
  HeartPulse, Zap,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

interface HealthCheck {
  check_name: string;
  label: string;
  status: 'ok' | 'warn' | 'fail';
  latency_ms: number;
  message: string;
}
interface HealthData {
  latest: HealthCheck[];
  trend: Record<string, Array<{ status: string; latency_ms: number; checked_at: string; message: string }>>;
}

interface SystemStats {
  timestamp: string;
  hostname: string;
  uptime_sec: number;
  ram: { total: number; used: number; free: number; pct: number };
  swap: { total: number; used: number; free: number; pct: number };
  disk: { total: number; used: number; free: number; pct: number };
  cpu: { cores: number; load1: number; load5: number; load15: number; load1_pct: number };
  pm2: Array<{
    name: string; pm_id: number; status: string;
    cpu: number; memory: number; uptime: number; restarts: number;
  }>;
}

function fmtGB(bytes: number): string {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
function fmtMB(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}
function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return fmtGB(bytes);
  return fmtMB(bytes);
}
function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} gün ${h} saat`;
  if (h > 0) return `${h} saat ${m} dk`;
  return `${m} dakika`;
}
function fmtUptimeMs(ms: number): string {
  return fmtUptime(ms / 1000);
}

function statusColor(pct: number, danger = 85, warn = 70) {
  if (pct >= danger) return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', icon: '🔴' };
  if (pct >= warn) return { bar: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50', icon: '🟡' };
  return { bar: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', icon: '🟢' };
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full transition-all ${color}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

export default function SystemTab({ token }: { token: string }) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [testEmailStatus, setTestEmailStatus] = useState<string>('');
  const [healthRunning, setHealthRunning] = useState(false);
  const [alertSettings, setAlertSettings] = useState<AlertCfg | null>(null);
  const [alertSaving, setAlertSaving] = useState(false);
  const [dismissingStuck, setDismissingStuck] = useState(false);

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statsR, healthR, alertR] = await Promise.all([
        fetch(`${API_BASE}/admin/system-stats`, { headers }),
        fetch(`${API_BASE}/admin/health`, { headers }),
        fetch(`${API_BASE}/admin/system-stats/alert-settings`, { headers }),
      ]);
      if (statsR.status === 401 || healthR.status === 401) {
        localStorage.removeItem('admin_token');
        window.location.reload();
        return;
      }
      if (!statsR.ok) throw new Error('stats failed');
      const sd = await statsR.json();
      setStats(sd);
      if (healthR.ok) {
        const hd = await healthR.json();
        setHealth(hd);
      }
      if (alertR.ok) {
        const ad = await alertR.json();
        setAlertSettings({
          enabled: ad.enabled, categories: ad.categories, down_after_minutes: ad.down_after_minutes,
          reminder_hours: ad.reminder_hours, server_cooldown_hours: ad.server_cooldown_hours,
          business_cooldown_hours: ad.business_cooldown_hours, email_to: ad.email_to,
        });
      }
      setLastUpdated(new Date());
      setError('');
    } catch {
      setError('Sistem verisi alınamadı');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const saveAlertSettings = async (patch: Partial<AlertCfg>) => {
    if (!alertSettings) return;
    const updated = { ...alertSettings, ...patch, categories: { ...alertSettings.categories, ...(patch.categories || {}) } };
    setAlertSettings(updated);
    setAlertSaving(true);
    try {
      await fetch(`${API_BASE}/admin/system-stats/alert-settings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {}
    setAlertSaving(false);
  };

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 10_000); // refresh every 10s
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const runHealthCheck = async () => {
    setHealthRunning(true);
    try {
      await fetch(`${API_BASE}/admin/health/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch {
      // ignore
    }
    setHealthRunning(false);
  };

  const dismissStuckInquiries = async () => {
    if (!confirm('Bilerek yanıtlanmamış FMT taleplerini uyarıdan kaldır?')) return;
    setDismissingStuck(true);
    try {
      await fetch(`${API_BASE}/admin/health/fmtde/dismiss-stuck`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await runHealthCheck();
    } catch {
      // ignore
    }
    setDismissingStuck(false);
  };

  const sendTestAlert = async () => {
    setTestEmailStatus('Gönderiliyor...');
    try {
      const r = await fetch(`${API_BASE}/admin/system-stats/test-alert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.ok) setTestEmailStatus(`✅ Test e-postası gönderildi: ${d.sent_to}`);
      else setTestEmailStatus('🔕 Gönderilmedi — e-posta uyarıları kapalı (ana anahtar veya „Sunucu kaynakları“)');
    } catch {
      setTestEmailStatus('❌ Gönderilemedi');
    }
    setTimeout(() => setTestEmailStatus(''), 6000);
  };

  if (loading && !stats) {
    return <div className="text-center py-12 text-gray-500">Yükleniyor…</div>;
  }
  if (!stats) {
    return <div className="text-center py-12 text-red-600">{error || 'Veri yok'}</div>;
  }

  const ramC = statusColor(stats.ram.pct);
  const swapUsedMB = stats.swap.used / 1024 / 1024;
  // Swap: 1500 MB+ kırmızı, 1000 MB+ sarı (2 GB swap)
  const swapC = statusColor(swapUsedMB, 1500, 1000);
  const diskC = statusColor(stats.disk.pct);
  const cpuC = statusColor(stats.cpu.load1_pct, 150, 100);

  const overallWarnings: string[] = [];
  if (stats.ram.pct >= 85) overallWarnings.push(`RAM kritik: %${stats.ram.pct}`);
  if (swapUsedMB >= 1500) overallWarnings.push(`Swap çok kullanılıyor: ${Math.round(swapUsedMB)} MB`);
  if (stats.disk.pct >= 85) overallWarnings.push(`Disk doluyor: %${stats.disk.pct}`);
  if (stats.cpu.load1_pct >= 150) overallWarnings.push(`CPU yükü yüksek: ${stats.cpu.load1.toFixed(2)}`);
  const offlinePm2 = stats.pm2.filter((p) => p.status !== 'online');
  if (offlinePm2.length > 0) overallWarnings.push(`${offlinePm2.length} servis çalışmıyor`);
  const failedHealth = (health?.latest || []).filter((h) => h.status === 'fail');
  for (const h of failedHealth) overallWarnings.push(`${h.label}: ${h.message}`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`rounded-2xl p-6 shadow-lg ${overallWarnings.length > 0 ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'} text-white`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Server size={28} />
            <div>
              <h2 className="text-2xl font-bold">Sistem Durumu</h2>
              <div className="text-sm opacity-90">
                {stats.hostname} · {fmtUptime(stats.uptime_sec)} açık
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
              Otomatik yenile (10sn)
            </label>
            <button onClick={load} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg">
              <RefreshCw size={14} /> Yenile
            </button>
            {lastUpdated && (
              <span className="text-xs opacity-75">{lastUpdated.toLocaleTimeString('de-DE')}</span>
            )}
          </div>
        </div>
        {overallWarnings.length > 0 && (
          <div className="mt-4 bg-white/20 rounded-lg p-3">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <AlertTriangle size={18} /> {overallWarnings.length} uyarı:
            </div>
            <ul className="text-sm space-y-1 list-disc list-inside opacity-95">
              {overallWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Site Health */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2 flex-wrap">
          <HeartPulse size={18} className="text-rose-500" />
          <h3 className="font-semibold">Site Sağlığı</h3>
          <span className="text-xs text-gray-500">her 2 dakikada otomatik kontrol</span>
          <button
            onClick={runHealthCheck}
            disabled={healthRunning}
            className="ml-auto bg-gray-100 hover:bg-gray-200 disabled:opacity-50 px-3 py-1 rounded-lg text-sm flex items-center gap-1"
          >
            <Zap size={14} />
            {healthRunning ? 'Kontrol ediliyor…' : 'Hemen kontrol et'}
          </button>
        </div>
        {!health || health.latest.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            Henüz kontrol yapılmamış. "Hemen kontrol et" butonuna basabilirsin.
          </div>
        ) : (
          <div className="divide-y">
            {health.latest.map((h) => {
              const isOk = h.status === 'ok';
              const isWarn = h.status === 'warn';
              const isFail = h.status === 'fail';
              const trend = health.trend[h.check_name] || [];
              return (
                <div key={h.check_name} className="px-6 py-4">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    {isOk && <CheckCircle2 size={20} className="text-green-500" />}
                    {isWarn && <AlertTriangle size={20} className="text-yellow-500" />}
                    {isFail && <XCircle size={20} className="text-red-500" />}
                    <span className="font-medium text-gray-900 min-w-[180px]">{h.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isOk ? 'bg-green-100 text-green-700' :
                      isWarn ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {h.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {h.latency_ms != null ? `${h.latency_ms}ms` : ''}
                    </span>
                    {h.check_name === 'fmtde:api' && isWarn && (
                      <button
                        onClick={dismissStuckInquiries}
                        disabled={dismissingStuck}
                        className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium disabled:opacity-50"
                        title="Bu talepleri bilerek yanıtlamadım, uyarıdan kaldır"
                      >
                        {dismissingStuck ? 'Sıfırlanıyor…' : 'Sıfırla'}
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 ml-7">{h.message}</div>
                  {trend.length > 1 && (
                    <div className="ml-7 mt-2 flex items-center gap-0.5" title="Son 24 saat">
                      {trend.slice(-60).map((t, i) => (
                        <div
                          key={i}
                          title={`${new Date(t.checked_at).toLocaleTimeString('de-DE')}: ${t.status} - ${t.message}`}
                          className={`w-1.5 h-4 rounded-sm ${
                            t.status === 'ok' ? 'bg-green-400' :
                            t.status === 'warn' ? 'bg-yellow-400' :
                            'bg-red-500'
                          }`}
                        />
                      ))}
                      <span className="text-[10px] text-gray-400 ml-2">son {Math.min(60, trend.length)} kontrol</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main metrics grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* RAM */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><MemoryStick size={18} /> <span className="font-semibold">RAM</span></div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${ramC.bg} ${ramC.text}`}>{ramC.icon} %{stats.ram.pct}</span>
          </div>
          <ProgressBar pct={stats.ram.pct} color={ramC.bar} />
          <div className="text-sm text-gray-600 mt-2">
            {fmtGB(stats.ram.used)} / {fmtGB(stats.ram.total)} · {fmtGB(stats.ram.free)} boş
          </div>
        </div>

        {/* Swap */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><MemoryStick size={18} /> <span className="font-semibold">Swap</span></div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${swapC.bg} ${swapC.text}`}>
              {swapC.icon} {fmtBytes(stats.swap.used)}
            </span>
          </div>
          <ProgressBar pct={stats.swap.pct} color={swapC.bar} />
          <div className="text-sm text-gray-600 mt-2">
            {fmtBytes(stats.swap.used)} / {fmtGB(stats.swap.total)}
            {swapUsedMB >= 1000 && <span className="ml-2 text-yellow-600">⚠ RAM dolup swap kullanılıyor</span>}
          </div>
        </div>

        {/* Disk */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><HardDrive size={18} /> <span className="font-semibold">Disk</span></div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${diskC.bg} ${diskC.text}`}>{diskC.icon} %{stats.disk.pct}</span>
          </div>
          <ProgressBar pct={stats.disk.pct} color={diskC.bar} />
          <div className="text-sm text-gray-600 mt-2">
            {fmtGB(stats.disk.used)} / {fmtGB(stats.disk.total)} · {fmtGB(stats.disk.free)} boş
          </div>
        </div>

        {/* CPU */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Cpu size={18} /> <span className="font-semibold">CPU Yükü</span></div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${cpuC.bg} ${cpuC.text}`}>
              {cpuC.icon} {stats.cpu.load1.toFixed(2)}
            </span>
          </div>
          <ProgressBar pct={stats.cpu.load1_pct} color={cpuC.bar} />
          <div className="text-sm text-gray-600 mt-2">
            {stats.cpu.cores} core · Load: {stats.cpu.load1.toFixed(2)} / {stats.cpu.load5.toFixed(2)} / {stats.cpu.load15.toFixed(2)} (1m/5m/15m)
          </div>
        </div>
      </div>

      {/* PM2 services */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Activity size={18} /> <h3 className="font-semibold">PM2 Servisleri</h3>
          <span className="text-xs text-gray-500 ml-auto">{stats.pm2.length} servis</span>
        </div>
        <div className="divide-y">
          {stats.pm2.map((p) => {
            const isOn = p.status === 'online';
            return (
              <div key={p.pm_id} className="px-6 py-3 flex items-center gap-3 flex-wrap">
                {isOn ? <CheckCircle2 size={18} className="text-green-500" /> : <XCircle size={18} className="text-red-500" />}
                <span className="font-medium text-gray-900 min-w-[180px]">{p.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${isOn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {p.status}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock size={12} /> {fmtUptimeMs(p.uptime)}
                </span>
                <span className="text-xs text-gray-500">CPU: {p.cpu}%</span>
                <span className="text-xs text-gray-500">RAM: {fmtMB(p.memory)}</span>
                {p.restarts > 5 && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded ml-auto">
                    {p.restarts} restart
                  </span>
                )}
              </div>
            );
          })}
          {stats.pm2.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">PM2 verisi alınamadı</div>
          )}
        </div>
      </div>

      {/* Email alert section — which server mails go out and how often (backend: alertCenter.ts) */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Mail size={18} /> <h3 className="font-semibold">E-posta Uyarıları</h3>
          </div>
          {alertSettings && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-sm text-gray-600">{alertSettings.enabled ? '✅ Aktif' : '🔕 Hepsi kapalı'}</span>
              <button
                onClick={() => saveAlertSettings({ enabled: !alertSettings.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${alertSettings.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${alertSettings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </label>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Sunucunun kendi uyarıları <strong>{alertSettings?.email_to || 'info@flughafen-muenchen.taxi'}</strong> adresine gider.
          Yeni rezervasyon, talep ve chat e-postaları bu ayarlardan <strong>etkilenmez</strong>.
        </p>

        {alertSettings && (
          <>
            <div className={`divide-y divide-gray-100 rounded-xl border border-gray-100 ${alertSettings.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
              {([
                ['site_down', '🚨 Site / API kesintisi', `Bir kontrol ${alertSettings.down_after_minutes} dakikadan uzun başarısız olursa tek e-posta — tüm sorunlar birlikte. Deploy sırasında gönderilmez.`],
                ['site_recovered', '✅ „Düzeldi“ bildirimi', 'Yalnızca kesinti e-postası gitmişse, düzelince tek e-posta (ne kadar sürdüğüyle).'],
                ['server', '🖥️ Sunucu kaynakları (RAM, Swap, Disk, CPU)', `Eşik 15 dakika boyunca aşılırsa; en fazla ${alertSettings.server_cooldown_hours} saatte bir.`],
                ['pm2', '⚙️ Çöken PM2 servisi', 'Bilerek durdurulan servisler (pm2 stop, ör. haber-app) uyarı üretmez.'],
                ['business', '📉 Satış / hata uyarıları', `Trafik var ama rezervasyon yok, hata patlaması, yavaş rezervasyon sayfası — en fazla ${alertSettings.business_cooldown_hours} saatte bir.`],
                ['ads', '📊 Google Ads kritik uyarı', 'Aynı sorun için günde en fazla bir e-posta.'],
                ['daily_summary', '📅 Günlük özet', 'Her sabah 08:00’den sonra tek e-posta.'],
              ] as [AlertCategory, string, string][]).map(([key, label, hint]) => (
                <div key={key} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{hint}</div>
                  </div>
                  <button
                    onClick={() => saveAlertSettings({ categories: { ...alertSettings.categories, [key]: !alertSettings.categories[key] } })}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${alertSettings.categories[key] ? 'bg-green-500' : 'bg-gray-300'}`}
                    aria-label={label}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${alertSettings.categories[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>

            <div className={`grid sm:grid-cols-2 gap-3 mt-4 ${alertSettings.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
              {([
                ['down_after_minutes', 'Kesinti e-postası için süre', [4, 6, 10, 15, 30], 'dk'],
                ['reminder_hours', 'Sürerse hatırlatma', [6, 12, 24, 48], 'saatte bir'],
                ['server_cooldown_hours', 'Sunucu kaynak uyarısı', [12, 24, 48, 168], 'saatte en fazla bir'],
                ['business_cooldown_hours', 'Satış / hata / PM2 uyarısı', [2, 4, 6, 12, 24], 'saatte en fazla bir'],
              ] as [keyof AlertCfg, string, number[], string][]).map(([key, label, options, unit]) => (
                <label key={key} className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100 text-sm text-gray-700">
                  <Clock size={15} className="text-blue-500 shrink-0" />
                  <span className="flex-1">{label}</span>
                  <select
                    value={alertSettings[key] as number}
                    onChange={(e) => saveAlertSettings({ [key]: Number(e.target.value) } as Partial<AlertCfg>)}
                    disabled={alertSaving}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm font-semibold bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                  >
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <span className="text-xs text-gray-500 w-20">{unit}</span>
                </label>
              ))}
            </div>
            {alertSaving && <div className="text-xs text-gray-400 mt-2">kaydediliyor…</div>}
          </>
        )}

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={sendTestAlert}
            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            <Mail size={14} /> Test e-postası gönder
          </button>
          {testEmailStatus && <div className="text-sm text-gray-700">{testEmailStatus}</div>}
        </div>
      </div>

      <PasswordChangeCard />
    </div>
  );
}
