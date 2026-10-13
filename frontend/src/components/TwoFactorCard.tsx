'use client';

// System tab → İki adımlı doğrulama (TOTP). Opt-in per admin account; once on, login asks
// for the authenticator code after the password (or a one-time recovery code).

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, KeyRound, Copy, Download, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/api';

type Status = { enabled: boolean; enabled_at: string | null; recovery_codes_left: number; username: string };

function errText(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } } };
  return e?.response?.data?.error || fallback;
}

function CodeInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      placeholder="123456"
      className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-center font-mono text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function RecoveryCodes({ codes, username, onDone }: { codes: string[]; username: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  function download() {
    const blob = new Blob(
      [`Flughafen-München.TAXI Admin – Wiederherstellungscodes (${username})\nJeder Code gilt nur einmal.\n\n${text}\n`],
      { type: 'text/plain' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'admin-2fa-yedek-kodlar.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2 text-sm text-amber-900">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          Bu 10 yedek kodu şimdi kaydedin; bir daha gösterilmeyecek. Telefonunuz yanınızda değilse
          girişte bunlardan biriyle girersiniz. Her kod yalnızca bir kez çalışır.
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-white rounded-lg p-3 border border-amber-100 max-w-xs">
        {codes.map((c) => <span key={c}>{c}</span>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={download} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm flex items-center gap-1.5 hover:bg-gray-50">
          <Download size={14} /> İndir (.txt)
        </button>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm flex items-center gap-1.5 hover:bg-gray-50"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
        <button type="button" onClick={onDone} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          Kaydettim
        </button>
      </div>
    </div>
  );
}

export default function TwoFactorCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'idle' | 'disable' | 'regen'>('idle');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function load() {
    try { setStatus(await adminApi.twoFactorStatus()); }
    catch (err) { setError(errText(err, 'Durum okunamadı.')); }
  }
  useEffect(() => { load(); }, []);

  function reset() { setCode(''); setPassword(''); setMode('idle'); setError(''); }

  async function startSetup() {
    setBusy(true); setError(''); setDone('');
    try { setSetup(await adminApi.twoFactorSetup()); setCode(''); }
    catch (err) { setError(errText(err, 'QR kod oluşturulamadı.')); }
    finally { setBusy(false); }
  }

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await adminApi.twoFactorEnable(code);
      setCodes(r.recovery_codes);
      setSetup(null); setCode('');
      setDone('İki adımlı doğrulama açıldı. Bir sonraki girişte uygulamadaki kod sorulacak.');
      await load();
    } catch (err) { setError(errText(err, 'Kod doğrulanamadı.')); }
    finally { setBusy(false); }
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await adminApi.twoFactorDisable(password, code);
      if (r.token) localStorage.setItem('admin_token', r.token);
      try { localStorage.removeItem('admin_trusted_device'); } catch { /* ignore */ }
      reset();
      setDone('İki adımlı doğrulama kapatıldı. Diğer tüm oturumlar ve hatırlanan cihazlar çıkış yaptı.');
      await load();
    } catch (err) { setError(errText(err, 'Kapatılamadı.')); }
    finally { setBusy(false); }
  }

  async function regenerate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await adminApi.twoFactorNewRecoveryCodes(code);
      setCodes(r.recovery_codes);
      reset();
      await load();
    } catch (err) { setError(errText(err, 'Yeni kodlar oluşturulamadı.')); }
    finally { setBusy(false); }
  }

  const enabledAt = status?.enabled_at ? new Date(status.enabled_at).toLocaleDateString('de-DE') : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={18} className="text-gray-700" />
        <h3 className="font-bold text-gray-900 text-lg">İki adımlı doğrulama (2FA)</h3>
        {status && (
          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${status.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {status.enabled ? 'Açık' : 'Kapalı'}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Şifreye ek olarak telefondaki doğrulama uygulamasının (Google Authenticator, Authy, 1Password…)
        6 haneli kodu istenir. Şifre çalınsa bile kod olmadan admin paneline girilemez.
        &quot;Bu cihaza 30 gün güven&quot; seçilen tarayıcıda kod 30 günde bir sorulur.
      </p>

      {codes && status && (
        <div className="mb-4">
          <RecoveryCodes codes={codes} username={status.username} onDone={() => setCodes(null)} />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 max-w-md">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}
      {done && !error && (
        <div className="flex items-start gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3 max-w-md">
          <Check size={16} className="mt-0.5 shrink-0" /><span>{done}</span>
        </div>
      )}

      {!status ? null : !status.enabled ? (
        setup ? (
          <form onSubmit={enable} className="space-y-4">
            <ol className="text-sm text-gray-700 list-decimal pl-5 space-y-1">
              <li>Telefonda doğrulama uygulamasını açın ve &quot;+&quot; ile QR kodu okutun.</li>
              <li>Uygulamada görünen 6 haneli kodu aşağıya yazın.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qr} alt="2FA QR kodu" width={180} height={180} className="border border-gray-100 rounded-lg" />
              <div className="text-xs text-gray-500 space-y-1">
                <div>QR okutulamıyorsa anahtarı elle girin:</div>
                <code className="block font-mono text-sm text-gray-800 bg-gray-50 rounded px-2 py-1 break-all max-w-[16rem]">
                  {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
                </code>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CodeInput value={code} onChange={setCode} autoFocus />
              <button type="submit" disabled={busy || code.length !== 6} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                <ShieldCheck size={15} /> Doğrula ve aç
              </button>
              <button type="button" onClick={() => { setSetup(null); setCode(''); setError(''); }} className="text-sm text-gray-500 hover:underline">
                Vazgeç
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={startSetup} disabled={busy} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            <ShieldCheck size={15} /> 2FA'yı kur
          </button>
        )
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            {enabledAt && <>Açılış: {enabledAt} · </>}
            Kalan yedek kod: <b className={status.recovery_codes_left <= 3 ? 'text-red-600' : ''}>{status.recovery_codes_left}</b>
          </div>

          {mode === 'idle' && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { reset(); setDone(''); setMode('regen'); }} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm flex items-center gap-1.5 hover:bg-gray-50">
                <RefreshCw size={14} /> Yeni yedek kodlar
              </button>
              <button type="button" onClick={() => { reset(); setDone(''); setMode('disable'); }} className="px-3 py-2 bg-white border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-1.5 hover:bg-red-50">
                <ShieldOff size={14} /> 2FA'yı kapat
              </button>
            </div>
          )}

          {mode === 'regen' && (
            <form onSubmit={regenerate} className="space-y-2">
              <p className="text-xs text-gray-500">Eski yedek kodların hepsi geçersiz olur. Uygulamadaki güncel kodu girin.</p>
              <div className="flex items-center gap-3">
                <CodeInput value={code} onChange={setCode} autoFocus />
                <button type="submit" disabled={busy || code.length !== 6} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">Oluştur</button>
                <button type="button" onClick={reset} className="text-sm text-gray-500 hover:underline">Vazgeç</button>
              </div>
            </form>
          )}

          {mode === 'disable' && (
            <form onSubmit={disable} className="space-y-2 max-w-md">
              <p className="text-xs text-gray-500">Kapatmak için şifre ve uygulamadaki güncel kod gerekir. Diğer tüm oturumlar çıkış yapar.</p>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifre"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-3">
                <CodeInput value={code} onChange={setCode} />
                <button type="submit" disabled={busy || !password || code.length !== 6} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">Kapat</button>
                <button type="button" onClick={reset} className="text-sm text-gray-500 hover:underline">Vazgeç</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
