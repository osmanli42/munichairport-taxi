'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { portalApi, setToken } from '@/lib/portalApi';
import { LogIn, ArrowRight, Mail, Lock, Eye, EyeOff, Phone, CalendarCheck, Receipt, FileDown, Users, ShieldCheck, Star } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await portalApi.login(email, password);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login fehlgeschlagen'); setLoading(false); return; }

      setToken(data.token);
      if (data.user.must_change_password) {
        router.push('/portal/settings');
      } else {
        router.push('/portal/dashboard');
      }
    } catch {
      setError('Verbindungsfehler');
    }
    setLoading(false);
  };

  const inputCls = "w-full mt-1.5 border border-gray-200 bg-gray-50/60 rounded-xl pl-11 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#fbbf24]/60 focus:border-[#fbbf24] outline-none transition";
  const features = [
    { icon: CalendarCheck, title: 'Fahrten in Sekunden buchen', desc: 'Für Gäste, Kunden und Mitarbeiter – mit Flugüberwachung.' },
    { icon: Receipt, title: 'Monatliche Sammelrechnung', desc: 'Alle Fahrten auf einer Rechnung, jede Fahrt als PDF.' },
    { icon: Users, title: 'Mehrere Nutzer & Kostenstellen', desc: 'Rezeption, Assistenz und Kollegen mit eigenem Zugang.' },
    { icon: FileDown, title: 'CSV-Export & Statistik', desc: 'Monatliche Auswertungen für Ihre Buchhaltung.' },
  ];

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Photo side */}
      <aside className="relative hidden overflow-hidden bg-[#0c2d48] text-white lg:block">
        <img src="/images/business/login-panel.webp" alt="" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c2d48] via-[#0c2d48]/70 to-[#0c2d48]/30" />
        <div className="relative flex h-full min-h-screen flex-col justify-between p-10 xl:p-14">
          <a href="/" aria-label="Startseite"><img src="/images/logo-wide-400.webp" alt="flughafen-muenchen.TAXI" className="h-11 w-auto" /></a>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#fbbf24]">Business Portal</p>
            <h2 className="mt-2 max-w-md text-4xl font-extrabold leading-tight tracking-tight">Ihre Firmenfahrten. An einem Ort.</h2>
            <ul className="mt-8 grid max-w-xl gap-5 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur"><Icon size={19} className="text-[#fbbf24]" /></span>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-0.5 text-xs text-white/70">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 pt-6 text-xs text-white/75">
              <span className="inline-flex items-center gap-1.5"><Star size={14} className="text-[#fbbf24]" fill="currentColor" /> 4,7 Ø Bewertung</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-[#fbbf24]" /> Behördlich konzessioniert</span>
              <span className="inline-flex items-center gap-1.5"><Lock size={14} className="text-[#fbbf24]" /> SSL & DSGVO</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Form side */}
      <main className="flex min-h-screen flex-col bg-gray-50 lg:bg-white">
        {/* Mobile header with photo */}
        <div className="relative overflow-hidden bg-[#0c2d48] px-5 pb-20 pt-5 text-white lg:hidden">
          <img src="/images/business/login-panel.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_60%] opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0c2d48]/60 to-[#0c2d48]" />
          <div className="relative">
            <a href="/" aria-label="Startseite"><img src="/images/logo-wide-400.webp" alt="flughafen-muenchen.TAXI" className="h-9 w-auto" /></a>
            <p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-[#fbbf24]">Business Portal</p>
            <h1 className="mt-1 text-2xl font-extrabold">Firmenkundenportal</h1>
          </div>
        </div>

        <div className="flex flex-1 items-start justify-center px-4 lg:items-center lg:px-10">
          <div className="relative z-10 -mt-14 w-full max-w-md pb-10 lg:mt-0 lg:py-12">
            <div className="rounded-3xl bg-white p-7 shadow-2xl ring-1 ring-black/5 sm:p-9 lg:p-0 lg:shadow-none lg:ring-0">
              <h1 className="hidden text-xs font-bold uppercase tracking-[.2em] text-[#d99a00] lg:block">Firmenkundenportal</h1>
              <h2 className="text-2xl font-extrabold text-gray-900 lg:mt-2 lg:text-3xl">Willkommen zurück</h2>
              <p className="mt-1 text-sm text-gray-500">Melden Sie sich mit Ihren Zugangsdaten an.</p>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mt-6">{error}</div>
              )}

              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="portal-email" className="text-sm font-medium text-gray-700">E-Mail</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-gray-400" />
                    <input id="portal-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
                      className={inputCls} placeholder="ihre@firma.de" />
                  </div>
                </div>
                <div>
                  <label htmlFor="portal-password" className="text-sm font-medium text-gray-700">Passwort</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-gray-400" />
                    <input id="portal-password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                      className={`${inputCls} pr-11`} placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
                      className="absolute right-3 top-1/2 mt-[3px] -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-700">
                      {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-[#0c2d48] text-white py-3.5 rounded-xl font-bold hover:bg-[#0a2540] transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#0c2d48]/20">
                  {loading ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><LogIn size={18} /> Anmelden</>}
                </button>
              </form>

              <p className="mt-4 text-xs leading-relaxed text-gray-500">
                Passwort vergessen? Rufen Sie uns an unter <a href={CONTACT_INFO.phoneHref} className="font-semibold text-[#0c2d48] hover:underline">{CONTACT_INFO.phone}</a> oder schreiben Sie an <a href={`mailto:${CONTACT_INFO.email}`} className="font-semibold text-[#0c2d48] hover:underline">{CONTACT_INFO.email}</a>.
              </p>

              <div className="mt-8 rounded-2xl bg-[#fbbf24]/10 p-5 ring-1 ring-[#fbbf24]/30">
                <p className="text-sm font-bold text-gray-900">Noch kein Firmenkonto?</p>
                <p className="mt-1 text-sm text-gray-600">Sammelrechnung, Direktbuchung und persönlicher Ansprechpartner – der Antrag dauert rund 2 Minuten.</p>
                <button onClick={() => router.push('/portal/apply')}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#fbbf24] px-4 py-2.5 text-sm font-bold text-[#0c2d48] hover:bg-[#f5b30f]">
                  Jetzt beantragen <ArrowRight size={15} />
                </button>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1.5"><Lock size={12} /> SSL-verschlüsselte Verbindung</span>
                <span className="inline-flex items-center gap-1.5"><Phone size={12} /> 24/7 erreichbar</span>
                <a href="/business" className="hover:text-gray-600 hover:underline">Mehr über das Portal</a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
