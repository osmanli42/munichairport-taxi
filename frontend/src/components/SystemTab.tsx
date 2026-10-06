'use client';

import { useEffect, useState, useCallback } from 'react';
import PasswordChangeCard from './PasswordChangeCard';

// What each PM2 process is, in plain words (checked against the VPS: pm2 cwd/script and
// the nginx site that routes to its port), what happens if it is stopped, and why some
// can only be restarted. Keep in sync with PM2_PROTECTED in backend routes/system.ts.
const PM2_INFO: Record<string, { label: string; what: string; ifStopped: string; customer?: boolean; protectedWhy?: string }> = {
  'munichairport-taxi': {
    label: 'flughafen-muenchen.taxi — Backend / API',
    what: 'Sitenin beyni: rezervasyon, fiyat hesaplama, fatura, e-postalar, şoför takibi, bu admin paneli ve tüm otomatik işler (fatura gönderimi, hatırlatmalar, site kontrolleri, uyarı mailleri).',
    ifStopped: 'Rezervasyon alınamaz, e-posta ve fatura gitmez, admin paneli çalışmaz.',
    customer: true,
    protectedWhy: 'Bu admin panelini çalıştıran servis. Durdurursan panel de kapanır ve buradan tekrar başlatamazsın.',
  },
  'munichairport-frontend': {
    label: 'flughafen-muenchen.taxi — Website + Admin',
    what: 'Müşterinin gördüğü web sitesi (sayfalar, rezervasyon formu) ve /admin sayfası.',
    ifStopped: 'flughafen-muenchen.taxi hiç açılmaz.',
    customer: true,
    protectedWhy: 'Admin sayfasını da bu servis gösteriyor. Durdurursan admine giremez, buradan tekrar başlatamazsın.',
  },
  'fmt-webhook': {
    label: 'Otomatik deploy (her iki site)',
    what: 'GitHub’a değişiklik gönderilince flughafen-muenchen.taxi ve flughafen-muenchen-taxi.de’yi otomatik günceller.',
    ifStopped: 'Siteler çalışmaya devam eder ama yeni değişiklikler sessizce canlıya çıkmaz.',
    protectedWhy: 'Durursa fark edilmez ama bütün güncellemeler takılır. Sadece yeniden başlatılabilir.',
  },
  'fmt-backend': {
    label: 'flughafen-muenchen-taxi.de — Backend / API',
    what: 'api.flughafen-muenchen-taxi.de: fiyat hesaplama, talep formu, müşteri ve admin e-postaları.',
    ifStopped: 'Site açılır ama fiyat gösteremez, talepler gönderilemez.',
    customer: true,
  },
  'fmt-de-frontend': {
    label: 'flughafen-muenchen-taxi.de — Website',
    what: 'flughafen-muenchen-taxi.de sitesinin sayfaları.',
    ifStopped: 'flughafen-muenchen-taxi.de hiç açılmaz.',
    customer: true,
  },
  'taxifreising': {
    label: 'taxifreising.de — Backend / API',
    what: 'Talep formu, fiyat teklifi ve e-postalar. (Sayfaların kendisi ayrıca doğrudan nginx’ten sunulur.)',
    ifStopped: 'Site açılır ama talepler gönderilemez.',
    customer: true,
  },
  'trading-backend': {
    label: 'muc-line.de — Trading veri servisi (Python)',
    what: 'Hisse tarayıcıları ve piyasa verileri. Sunucudaki en büyük RAM tüketicisi (~600 MB+).',
    ifStopped: 'muc-line.de trading sayfası veri gösteremez; taksi sitelerini etkilemez.',
  },
  'trading-frontend': {
    label: 'muc-line.de — Trading arayüzü',
    what: 'muc-line.de’deki trading uygulamasının sayfaları.',
    ifStopped: 'muc-line.de trading sayfası açılmaz; taksi sitelerini etkilemez.',
  },
  'transcript-proxy': {
    label: 'YouTube altyazı ve çeviri servisi',
    what: 'muc-line.de’deki dil öğrenme (Lernkarte) uygulaması için YouTube altyazısı ve kelime çevirisi getirir.',
    ifStopped: 'O uygulamada altyazı/çeviri çalışmaz; taksi sitelerini etkilemez.',
  },
  'haber-app': {
    label: 'Haber uygulaması',
    what: 'Next.js haber uygulaması (port 3010). Hiçbir alan adına bağlı değil — internetten erişilemiyor.',
    ifStopped: 'Hiçbir siteyi etkilemez.',
  },
};

// Mirrors backend services/alertCenter.ts
type AlertCategory = 'site_down' | 'site_recovered' | 'server' | 'pm2' | 'business' | 'ads' | 'daily_summary' | 'card_charge' | 'seo'
  | 'calendar_new';
interface AlertCfg {
  enabled: boolean;
  categories: Record<AlertCategory, boolean>;
  down_after_minutes: number;
  reminder_hours: number;
  server_cooldown_hours: number;
  business_cooldown_hours: number;
  card_charge_deadline?: string;
  calendar_new_mode?: 'instant' | 'daily';
  calendar_new_time?: string;
  email_to?: string;
}
const CARD_DEADLINE_OPTIONS = ['20:15', '20:30', '20:45', '21:00', '21:30', '22:00', '22:30', '23:00'];
// 00:00 is shown as 24:00 — the mail at midnight closes the day.
const CALENDAR_NEW_TIMES = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
const timeLabel = (t: string) => (t === '00:00' ? '24:00' : t);
import {
  Server, Cpu, HardDrive, MemoryStick, RefreshCw, Mail,
  CheckCircle2, AlertTriangle, XCircle, Clock, Activity,
  HeartPulse, Zap, Play, Square, RotateCw, PauseCircle,
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
  const [dismissingStuck, setDismissingStuck] = useState<string>('');
  const [pm2Busy, setPm2Busy] = useState<string>('');
  const [pm2Msg, setPm2Msg] = useState<{ ok: boolean; text: string } | null>(null);
  const [calPreview, setCalPreview] = useState<{ subject: string; html: string; empty: boolean; error?: string } | null>(null);

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
          business_cooldown_hours: ad.business_cooldown_hours, card_charge_deadline: ad.card_charge_deadline,
          calendar_new_mode: ad.calendar_new_mode, calendar_new_time: ad.calendar_new_time, email_to: ad.email_to,
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

  const previewCalendarMail = async () => {
    setCalPreview({ subject: '…', html: '', empty: false });
    try {
      const r = await fetch(`${API_BASE}/admin/system-stats/calendar-alert-preview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setCalPreview(r.ok ? d : { subject: '', html: '', empty: true, error: d.error || 'Önizleme alınamadı' });
    } catch {
      setCalPreview({ subject: '', html: '', empty: true, error: 'Önizleme alınamadı' });
    }
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

  // Secondary sites whose "API + DB" warning counts unanswered inquiries — "Sıfırla" hides
  // the ones left unanswered on purpose (they are not deleted).
  const DISMISSABLE: Record<string, { site: string; name: string }> = {
    'fmtde:api': { site: 'fmtde', name: 'Flughafen Taxi .de' },
    'tf:api': { site: 'tf', name: 'Taxi Freising' },
  };
  const dismissStuckInquiries = async (checkName: string) => {
    const target = DISMISSABLE[checkName];
    if (!target || !confirm(`Bilerek yanıtlanmamış ${target.name} taleplerini uyarıdan kaldır?`)) return;
    setDismissingStuck(checkName);
    try {
      const r = await fetch(`${API_BASE}/admin/health/${target.site}/dismiss-stuck`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(`Sıfırlanamadı: ${d.error || `HTTP ${r.status}`}`);
      }
      await runHealthCheck();
    } catch {
      alert('Sıfırlanamadı: bağlantı hatası');
    }
    setDismissingStuck('');
  };

  const pm2Action = async (name: string, action: 'start' | 'stop' | 'restart') => {
    const info = PM2_INFO[name];
    const label = info?.label || name;
    const verb = action === 'start' ? 'başlatılsın' : action === 'stop' ? 'durdurulsun' : 'yeniden başlatılsın';
    const warn = action === 'stop' && info
      ? `\n\n${info.customer ? '⚠️ MÜŞTERİ SİTESİ! ' : ''}Durdurulursa: ${info.ifStopped}`
      : action === 'start' && stats && stats.ram.pct >= 80
        ? `\n\n⚠️ RAM şu an %${stats.ram.pct} dolu — yeni servis sunucuyu yavaşlatabilir.`
        : action === 'restart' && name === 'munichairport-taxi'
          ? '\n\nAdmin paneli birkaç saniye yanıt vermeyecek.'
          : '';
    if (!confirm(`${label}\n\n„${name}“ ${verb}?${warn}`)) return;
    setPm2Busy(`${name}:${action}`);
    setPm2Msg(null);
    try {
      const r = await fetch(`${API_BASE}/admin/system-stats/pm2/${encodeURIComponent(name)}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setPm2Msg({ ok: true, text: d.self_restart ? `${name} yeniden başlatılıyor — birkaç saniye sonra sayfa kendini yeniler.` : `${name}: ${action === 'start' ? 'başlatıldı' : action === 'stop' ? 'durduruldu' : 'yeniden başlatıldı'}` });
      if (d.self_restart) setTimeout(() => load(), 8000);
      else load();
    } catch (e: any) {
      setPm2Msg({ ok: false, text: `${name}: ${e.message || 'işlem başarısız'}` });
    } finally {
      setPm2Busy('');
      setTimeout(() => setPm2Msg(null), 8000);
    }
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
  // "stopped" = switched off on purpose (here or via pm2 stop) — not a warning.
  const offlinePm2 = stats.pm2.filter((p) => !['online', 'stopped', 'stopping'].includes(p.status));
  if (offlinePm2.length > 0) overallWarnings.push(`${offlinePm2.length} servis çöktü`);
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
                    {DISMISSABLE[h.check_name] && isWarn && (
                      <button
                        onClick={() => dismissStuckInquiries(h.check_name)}
                        disabled={!!dismissingStuck}
                        className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium disabled:opacity-50"
                        title="Bu talepleri bilerek yanıtlamadım, uyarıdan kaldır"
                      >
                        {dismissingStuck === h.check_name ? 'Sıfırlanıyor…' : 'Sıfırla'}
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

      {/* PM2 services — status + start / stop / restart (backend: POST /admin/system-stats/pm2/:name/:action) */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2 flex-wrap">
          <Activity size={18} /> <h3 className="font-semibold">PM2 Servisleri</h3>
          <span className="text-xs text-gray-500">
            {stats.pm2.filter((p) => p.status === 'online').length} çalışıyor · {stats.pm2.filter((p) => p.status !== 'online').length} kapalı
          </span>
          {pm2Msg && (
            <span className={`ml-auto text-xs px-2.5 py-1 rounded-lg ${pm2Msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{pm2Msg.text}</span>
          )}
        </div>
        <div className="divide-y">
          {stats.pm2.map((p) => {
            const isOn = p.status === 'online';
            const isStopped = p.status === 'stopped' || p.status === 'stopping';
            const info = PM2_INFO[p.name];
            const busy = pm2Busy.startsWith(`${p.name}:`);
            return (
              <div key={p.pm_id} className="px-6 py-3 flex items-center gap-3 flex-wrap">
                {isOn ? <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                  : isStopped ? <PauseCircle size={18} className="text-gray-400 shrink-0" />
                  : <XCircle size={18} className="text-red-500 shrink-0" />}
                <div className="min-w-[260px] flex-1">
                  <div className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                    {p.name}
                    {info && <span className="text-xs font-normal text-gray-500">· {info.label}</span>}
                    {info?.protectedWhy && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">🔒 korumalı</span>
                    )}
                  </div>
                  {info && (
                    <div className="mt-1 text-xs text-gray-500 leading-relaxed max-w-2xl">
                      <div>{info.what}</div>
                      <div className={info.customer ? 'text-red-600/80' : 'text-gray-400'}>Durdurulursa: {info.ifStopped}</div>
                      {info.protectedWhy && <div className="text-amber-700">Neden korumalı: {info.protectedWhy}</div>}
                    </div>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${isOn ? 'bg-green-100 text-green-700' : isStopped ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'}`}>
                  {isOn ? 'çalışıyor' : isStopped ? 'durduruldu' : p.status}
                </span>
                {isOn && (
                  <>
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12} /> {fmtUptimeMs(p.uptime)}</span>
                    <span className="text-xs text-gray-500">CPU: {p.cpu}%</span>
                    <span className="text-xs text-gray-500">RAM: {fmtMB(p.memory)}</span>
                  </>
                )}
                {p.restarts > 5 && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">{p.restarts} restart</span>
                )}
                <div className="flex gap-1.5 ml-auto">
                  {!isOn && (
                    <button
                      onClick={() => pm2Action(p.name, 'start')}
                      disabled={!!pm2Busy}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <Play size={12} /> {busy ? '…' : 'Başlat'}
                    </button>
                  )}
                  {isOn && (
                    <button
                      onClick={() => pm2Action(p.name, 'restart')}
                      disabled={!!pm2Busy}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <RotateCw size={12} /> {busy ? '…' : 'Yeniden başlat'}
                    </button>
                  )}
                  {isOn && !info?.protectedWhy && (
                    <button
                      onClick={() => pm2Action(p.name, 'stop')}
                      disabled={!!pm2Busy}
                      className={`inline-flex items-center gap-1 rounded-lg border disabled:opacity-50 px-2.5 py-1.5 text-xs font-semibold ${info?.customer ? 'border-red-300 text-red-700 hover:bg-red-50' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      <Square size={11} /> Durdur
                    </button>
                  )}
                </div>
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
                ['pm2', '⚙️ Çöken PM2 servisi', 'Durdurulan servisler (aşağıdaki listeden veya pm2 stop ile) uyarı üretmez.'],
                ['business', '📉 Satış / hata uyarıları', `Trafik var ama rezervasyon yok, hata patlaması, yavaş rezervasyon sayfası — en fazla ${alertSettings.business_cooldown_hours} saatte bir.`],
                ['ads', '📊 Google Ads kritik uyarı', 'Aynı sorun için günde en fazla bir e-posta.'],
                ['daily_summary', '📅 Günlük özet', 'Her sabah 08:00’den sonra tek e-posta.'],
                ['seo', '🔎 SEO', 'Takip edilen kelime 5+ sıra düşerse veya organik tıklama haftalık %30+ düşerse; site taramasında yeni kritik hata (sayfa hatası, noindex, kırık link) çıkarsa. Günde en fazla bir e-posta.'],
                ['calendar_new', '📅 Yeni Kalender-Fahrt', alertSettings.calendar_new_mode === 'daily'
                  ? `Google Takvim’e eklenen fahrt’lar toplanır, her gün saat ${timeLabel(alertSettings.calendar_new_time || '00:00')}’de tek e-postada gelir: tarih, saat, adres, fiyat, not, takvim linki. O gün yeni fahrt yoksa e-posta gitmez.`
                  : 'Google Takvim’e her yeni fahrt eklendiğinde 5–10 dakika içinde e-posta: tarih, saat, adres, fiyat, not, takvim linki. Web rezervasyonları zaten kendi e-postasını gönderdiği için dahil değil.'],
                ['card_charge', '💳 Kart çekilmedi', `Saat ${alertSettings.card_charge_deadline || '20:15'}’te yarının kartlı fahrt’larından çekilmemiş olan varsa tek e-posta (listeyle); dashboard’da da o saatten sonra kırmızı uyarı. Müşteri hatırlatmaları 20:00’de gider.`],
              ] as [AlertCategory, string, string][]).map(([key, label, hint]) => (
                <div key={key} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{hint}</div>
                    {key === 'calendar_new' && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-700">
                        <label className="inline-flex items-center gap-2">
                          <Mail size={13} className="text-blue-500" /> Gönderim
                          <select
                            value={alertSettings.calendar_new_mode || 'instant'}
                            onChange={(e) => saveAlertSettings({ calendar_new_mode: e.target.value as 'instant' | 'daily' })}
                            disabled={alertSaving}
                            className="border border-gray-300 rounded-lg px-2 py-0.5 text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                          >
                            <option value="instant">Her yeni fahrt’ta hemen</option>
                            <option value="daily">Günde bir kez (toplu)</option>
                          </select>
                        </label>
                        {alertSettings.calendar_new_mode === 'daily' && (
                          <label className="inline-flex items-center gap-2">
                            <Clock size={13} className="text-blue-500" /> Saat
                            <select
                              value={alertSettings.calendar_new_time || '00:00'}
                              onChange={(e) => saveAlertSettings({ calendar_new_time: e.target.value })}
                              disabled={alertSaving}
                              className="border border-gray-300 rounded-lg px-2 py-0.5 text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                            >
                              {[...CALENDAR_NEW_TIMES.slice(1), '00:00'].map((o) => <option key={o} value={o}>{timeLabel(o)}</option>)}
                            </select>
                          </label>
                        )}
                        <button onClick={previewCalendarMail} className="font-semibold text-blue-600 hover:underline">
                          E-postayı önizle
                        </button>
                      </div>
                    )}
                    {key === 'card_charge' && (
                      <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-gray-700">
                        <Clock size={13} className="text-blue-500" /> Kontrol saati
                        <select
                          value={alertSettings.card_charge_deadline || '20:15'}
                          onChange={(e) => saveAlertSettings({ card_charge_deadline: e.target.value })}
                          disabled={alertSaving}
                          className="border border-gray-300 rounded-lg px-2 py-0.5 text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                        >
                          {CARD_DEADLINE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </label>
                    )}
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
            {calPreview && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCalPreview(null)}>
                <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500">Önizleme — gönderilmedi · alıcı {alertSettings.email_to || 'info@flughafen-muenchen.taxi'}</div>
                      <div className="text-sm font-semibold text-gray-800 break-words">{calPreview.subject}</div>
                    </div>
                    <button onClick={() => setCalPreview(null)} className="text-gray-400 hover:text-gray-700" aria-label="Kapat"><XCircle size={20} /></button>
                  </div>
                  {calPreview.html
                    ? <iframe title="E-posta önizleme" srcDoc={calPreview.html} className="w-full flex-1 min-h-[60vh] border-0" />
                    : <div className="p-6 text-sm text-gray-600">{calPreview.error || (calPreview.subject === '…' ? 'yükleniyor…' : 'Takvimde şu an bu e-postaya girecek fahrt yok — bu durumda e-posta gönderilmez.')}</div>}
                </div>
              </div>
            )}
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
