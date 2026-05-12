'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Server, Cpu, HardDrive, MemoryStick, RefreshCw, Mail,
  CheckCircle2, AlertTriangle, XCircle, Clock, Activity,
} from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [testEmailStatus, setTestEmailStatus] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/system-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('failed');
      const d = await r.json();
      setStats(d);
      setLastUpdated(new Date());
      setError('');
    } catch {
      setError('Sistem verisi alınamadı');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 10_000); // refresh every 10s
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const sendTestAlert = async () => {
    setTestEmailStatus('Gönderiliyor...');
    try {
      const r = await fetch(`${API_BASE}/admin/system-stats/test-alert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.ok) setTestEmailStatus(`✅ Test e-postası gönderildi: ${d.sent_to}`);
      else setTestEmailStatus(`⏱️ Cooldown aktif (1 saat içinde bir kez gönderildi)`);
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
  const swapC = swapUsedMB >= 500 ? statusColor(100) : swapUsedMB >= 100 ? statusColor(75) : statusColor(0);
  const diskC = statusColor(stats.disk.pct);
  const cpuC = statusColor(stats.cpu.load1_pct, 150, 100);

  const overallWarnings: string[] = [];
  if (stats.ram.pct >= 85) overallWarnings.push(`RAM kritik: %${stats.ram.pct}`);
  if (swapUsedMB >= 500) overallWarnings.push(`Swap çok kullanılıyor: ${Math.round(swapUsedMB)} MB`);
  if (stats.disk.pct >= 85) overallWarnings.push(`Disk doluyor: %${stats.disk.pct}`);
  if (stats.cpu.load1_pct >= 150) overallWarnings.push(`CPU yükü yüksek: ${stats.cpu.load1.toFixed(2)}`);
  const offlinePm2 = stats.pm2.filter((p) => p.status !== 'online');
  if (offlinePm2.length > 0) overallWarnings.push(`${offlinePm2.length} servis çalışmıyor`);

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
            {swapUsedMB > 100 && <span className="ml-2 text-yellow-600">⚠ RAM dolup swap kullanılıyor</span>}
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

      {/* Email alert section */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-3">
          <Mail size={18} /> <h3 className="font-semibold">E-posta Uyarıları</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Sistem her 5 dakikada bir otomatik kontrol edilir. Aşağıdaki eşikler aşılırsa
          <strong> info@flughafen-muenchen.taxi</strong> adresine e-posta gönderilir.
          Aynı uyarı 1 saat içinde tekrar gönderilmez.
        </p>
        <div className="grid sm:grid-cols-2 gap-2 text-sm mb-4">
          <div className="bg-gray-50 rounded-lg px-3 py-2">🔴 RAM kullanımı &gt; %85</div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">🔴 Swap &gt; 500 MB</div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">🔴 Disk &gt; %85</div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">🔴 CPU load &gt; 1.5× core</div>
          <div className="bg-gray-50 rounded-lg px-3 py-2 sm:col-span-2">🔴 Bir PM2 servisi çökerse</div>
        </div>
        <button
          onClick={sendTestAlert}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
        >
          <Mail size={14} /> Test e-postası gönder
        </button>
        {testEmailStatus && (
          <div className="mt-3 text-sm text-gray-700">{testEmailStatus}</div>
        )}
      </div>
    </div>
  );
}
