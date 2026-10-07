'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Zap, KeyRound, LogIn, ChevronDown, ChevronUp,
} from 'lucide-react';

// Server security card (System tab). Data comes from the root watchdog sec-watch on the
// VPS via backend routes/security.ts — the card never runs anything itself.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '/api');

interface Finding { key: string; severity: string; title: string; detail: string }
interface Login { at: string; method: string; user: string; ip: string; key: string; count: number }
interface SecStatus {
  available: boolean;
  stale?: boolean;
  age_sec?: number;
  checked_at?: number;
  ok?: boolean;
  findings?: Finding[];
  summary?: {
    ufw_active: boolean;
    open_ports: string[];
    fail2ban_active: boolean;
    auditd_active: boolean;
    fail2ban: Record<string, { banned_now: number; banned_total: number; failed_total: number }>;
    ssh_password_login: boolean;
    ssh_keys: string[];
    recent_logins: Login[];
    baseline_at: number | null;
  };
}

// What sec-watch checks, grouped the way a person thinks about it. Keys = finding keys in sec-watch.
const CHECKS: { label: string; bad: string; keys: string[] }[] = [
  { label: 'Gizli / kılık değiştirmiş program yok', bad: 'Gizli / kılık değiştirmiş program bulundu', keys: ['proc', 'cpu'] },
  { label: 'Kripto madenci bağlantısı yok', bad: 'Kripto madenci bağlantısı var', keys: ['pool'] },
  { label: 'Rootkit yok, sistem programları sağlam', bad: 'Rootkit izi / değiştirilmiş sistem programı', keys: ['preload', 'dpkg'] },
  { label: 'SSH anahtarları değişmedi', bad: 'SSH anahtarları değişti', keys: ['ssh_keys', 'uid0'] },
  { label: 'Şüpheli SSH girişi yok', bad: 'Şüpheli SSH girişi var', keys: ['login'] },
  { label: 'Cron, servis ve sistem dosyaları değişmedi', bad: 'Cron / servis / sistem dosyası değişti', keys: ['cron', 'units', 'profile'] },
  { label: 'Beklenmeyen açık port yok', bad: 'Beklenmeyen açık port var', keys: ['listen'] },
  { label: 'Korumalar açık: şifresiz SSH, firewall, fail2ban, auditd', bad: 'Bir koruma kapalı (SSH şifresi, firewall, fail2ban veya auditd)', keys: ['sshd', 'svc_ufw', 'svc_fail2ban', 'svc_auditd'] },
];
// Must match ACCEPTABLE in backend routes/security.ts.
const ACCEPTABLE = new Set(['ssh_keys', 'cron', 'units', 'profile', 'uid0']);

function berlin(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function ago(sec: number): string {
  if (sec < 90) return 'az önce';
  if (sec < 3600) return `${Math.round(sec / 60)} dk önce`;
  return `${Math.round(sec / 3600)} saat önce`;
}

export default function SecurityCard({ token, onWarnings }: { token: string; onWarnings?: (w: string[]) => void }) {
  const [data, setData] = useState<SecStatus | null>(null);
  const [busy, setBusy] = useState<'' | 'run' | 'accept'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showLogins, setShowLogins] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/security`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setData(await r.json());
    } catch {}
  }, [token]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const findings = data?.findings || [];
  const problem = !!data?.available && (findings.length > 0 || !!data.stale);
  const warnKey = !data?.available ? '' : [
    ...(data.stale ? ['Güvenlik bekçisi 15 dakikadır çalışmadı'] : []),
    ...findings.map((f) => `Güvenlik: ${f.title}`),
  ].join('|');
  useEffect(() => { onWarnings?.(warnKey ? warnKey.split('|') : []); }, [warnKey, onWarnings]);

  const act = async (kind: 'run' | 'accept') => {
    if (kind === 'accept') {
      const what = findings.filter((f) => ACCEPTABLE.has(f.key)).map((f) => `• ${f.title}\n  ${f.detail.slice(0, 300)}`).join('\n');
      if (!confirm(`Bu değişikliği SİZ mi yaptınız?\n\n${what}\n\n„Tamam“ derseniz bekçi bunu yeni normal kabul eder ve uyarıyı keser.\n\nSiz yapmadıysanız İPTAL'e basın — biri sunucuya girmeye çalışıyor olabilir.`)) return;
    }
    setBusy(kind);
    setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/admin/security/${kind}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setData(d);
      setMsg({ ok: true, text: kind === 'run' ? 'Kontrol tamamlandı' : 'Onaylandı — yeni durum kaydedildi' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'İşlem başarısız' });
    } finally {
      setBusy('');
      setTimeout(() => setMsg(null), 8000);
    }
  };

  if (!data) return null;

  const s = data.summary;
  const failedKeys = new Set(findings.map((f) => f.key));
  const canAccept = findings.some((f) => ACCEPTABLE.has(f.key));
  const f2b = s?.fail2ban?.sshd;
  const recidive = s?.fail2ban?.recidive;

  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${problem ? 'ring-2 ring-red-400' : ''}`}>
      <div className="px-6 py-4 border-b flex items-center gap-2 flex-wrap">
        {problem ? <ShieldAlert size={18} className="text-red-500" /> : <ShieldCheck size={18} className="text-green-600" />}
        <h3 className="font-semibold">Sunucu Güvenliği</h3>
        {data.available && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${problem ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {data.stale ? 'bekçi çalışmıyor' : findings.length ? `${findings.length} sorun` : 'güvende'}
          </span>
        )}
        {data.available && data.age_sec != null && (
          <span className="text-xs text-gray-500">her 5 dakikada kontrol · son: {ago(data.age_sec)}</span>
        )}
        {msg && (
          <span className={`text-xs px-2.5 py-1 rounded-lg ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</span>
        )}
        {data.available && (
          <button
            onClick={() => act('run')}
            disabled={!!busy}
            className="ml-auto bg-gray-100 hover:bg-gray-200 disabled:opacity-50 px-3 py-1 rounded-lg text-sm flex items-center gap-1"
          >
            <Zap size={14} /> {busy === 'run' ? 'Kontrol ediliyor…' : 'Hemen kontrol et'}
          </button>
        )}
      </div>

      {!data.available ? (
        <div className="px-6 py-6 text-sm text-gray-500">Güvenlik bekçisinin verisi bulunamadı (bu sunucuda sec-watch kurulu değil).</div>
      ) : (
        <div className="p-6 space-y-5">
          {data.stale && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
              <strong>Bekçi {ago(data.age_sec || 0)} son kez çalıştı.</strong> Normalde 5 dakikada bir çalışır — biri kapatmış olabilir.
              „Hemen kontrol et“ ile deneyin; düzelmezse sunucuya bakılmalı.
            </div>
          )}

          {findings.length > 0 && (
            <div className="space-y-2">
              {findings.map((f) => (
                <div key={f.key} className="rounded-xl border border-red-200 bg-red-50">
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [f.key]: !o[f.key] }))}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left"
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${f.severity === 'KRİTİK' ? 'bg-red-600 text-white' : 'bg-amber-400 text-amber-950'}`}>
                      {f.severity === 'KRİTİK' ? 'kritik' : 'uyarı'}
                    </span>
                    <span className="text-sm font-medium text-red-900 flex-1">{f.title}</span>
                    {open[f.key] ? <ChevronUp size={16} className="text-red-400" /> : <ChevronDown size={16} className="text-red-400" />}
                  </button>
                  {open[f.key] && (
                    <pre className="mx-4 mb-3 p-3 rounded-lg bg-white text-xs text-gray-800 whitespace-pre-wrap break-all font-mono">{f.detail}</pre>
                  )}
                </div>
              ))}
              {canAccept && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                  <div className="font-semibold mb-1">Bu değişikliği siz mi yaptınız?</div>
                  <p className="text-amber-800 mb-3">
                    Örneğin sunucuya yeni bir SSH anahtarı ya da zamanlanmış görev eklediyseniz onaylayın — bekçi bunu yeni normal kabul eder.
                    <strong> Siz yapmadıysanız basmayın</strong>, uyarı e-postasını iletin.
                  </p>
                  <button
                    onClick={() => act('accept')}
                    disabled={!!busy}
                    className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-semibold"
                  >
                    {busy === 'accept' ? 'Onaylanıyor…' : 'Evet, bu değişikliği ben yaptım'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {CHECKS.map((c) => {
              const bad = c.keys.some((k) => failedKeys.has(k));
              return (
                <div key={c.label} className="flex items-center gap-2 text-sm">
                  {bad ? <XCircle size={16} className="text-red-500 shrink-0" /> : <CheckCircle2 size={16} className="text-green-500 shrink-0" />}
                  <span className={bad ? 'text-red-700 font-medium' : 'text-gray-700'}>{bad ? c.bad : c.label}</span>
                </div>
              );
            })}
          </div>

          {s && (
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-gray-50 p-3">
                <div className="text-xs text-gray-500 mb-1">Firewall</div>
                <div className={s.ufw_active ? 'text-gray-800' : 'text-red-700 font-medium'}>
                  {s.ufw_active ? `Açık · sadece ${s.open_ports.join(', ')} portları` : 'KAPALI'}
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <div className="text-xs text-gray-500 mb-1">fail2ban (deneme yapan IP'leri engeller)</div>
                <div className={s.fail2ban_active ? 'text-gray-800' : 'text-red-700 font-medium'}>
                  {s.fail2ban_active
                    ? `Şu an ${(f2b?.banned_now || 0) + (recidive?.banned_now || 0)} IP engelli · toplam ${f2b?.banned_total || 0}`
                    : 'KAPALI'}
                </div>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><KeyRound size={12} /> SSH girişi</div>
                <div className={s.ssh_password_login ? 'text-red-700 font-medium' : 'text-gray-800'}>
                  {s.ssh_password_login ? 'Şifreyle giriş AÇIK' : `Sadece anahtarla · ${s.ssh_keys.length} anahtar`}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate" title={s.ssh_keys.join(', ')}>{s.ssh_keys.join(', ')}</div>
              </div>
            </div>
          )}

          {s && s.recent_logins.length > 0 && (
            <div>
              <button onClick={() => setShowLogins((v) => !v)} className="text-sm font-medium text-gray-700 flex items-center gap-1.5 hover:text-gray-900">
                <LogIn size={14} /> Son 7 günün SSH girişleri ({s.recent_logins.length})
                {showLogins ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showLogins && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-1.5 pr-3 font-medium">Son giriş</th>
                        <th className="py-1.5 pr-3 font-medium">IP</th>
                        <th className="py-1.5 pr-3 font-medium">Nasıl</th>
                        <th className="py-1.5 font-medium text-right">Kaç kez</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {s.recent_logins.map((l, i) => {
                        const pw = l.method !== 'publickey';
                        return (
                          <tr key={i} className={pw ? 'bg-red-50 text-red-800' : 'text-gray-700'}>
                            <td className="py-1.5 pr-3 whitespace-nowrap">{berlin(l.at)}</td>
                            <td className="py-1.5 pr-3 font-mono">{l.ip}</td>
                            <td className="py-1.5 pr-3">{pw ? <strong>şifreyle (artık kapalı)</strong> : <>anahtar: {l.key || '?'}</>}</td>
                            <td className="py-1.5 text-right">{l.count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {s?.baseline_at && (
            <div className="text-xs text-gray-400">„Normal durum“ kaydı: {berlin(s.baseline_at)} · uyarılar admin e-postasına gider (aşağıda „🛡️ Güvenlik bekçisi“ ile açılıp kapanır)</div>
          )}
        </div>
      )}
    </div>
  );
}
