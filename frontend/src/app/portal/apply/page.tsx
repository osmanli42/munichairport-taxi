'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { portalApi } from '@/lib/portalApi';
import { Send, ArrowLeft, CheckCircle, XCircle, Building2, User, Phone, Mail, MapPin, FileText, MessageSquare, Lock, Star, ShieldCheck, Clock, BadgeCheck, MessageCircle } from 'lucide-react';
import { CONTACT_INFO } from '@/lib/utils';

export default function PortalApplyPage() {
  const router = useRouter();
  const [form, setForm] = useState({ company_name: '', contact_name: '', email: '', phone: '', address: '', ust_idnr: '', message: '' });
  const [honeypot, setHoneypot] = useState('');
  const mountedAtRef = useRef(Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [applicationsEnabled, setApplicationsEnabled] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    fetch(`${API}/settings`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setApplicationsEnabled(data.b2b_applications_enabled !== '0'); })
      .catch(() => {})
      .finally(() => setCheckingStatus(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await portalApi.apply({ ...form, website: honeypot, elapsed_ms: Date.now() - mountedAtRef.current });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Fehler'); setLoading(false); return; }
      setSuccess(true);
    } catch { setError('Verbindungsfehler'); }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="relative min-h-screen bg-[#0c2d48] flex items-center justify-center p-4">
        <img src="/images/business/apply-hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="relative bg-white rounded-3xl shadow-2xl p-8 sm:p-10 max-w-lg w-full">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 ring-8 ring-green-50/60">
            <CheckCircle size={36} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 text-center">Anfrage eingegangen!</h2>
          <p className="text-gray-600 text-sm mt-2 text-center">Wir prüfen Ihre Anfrage und senden Ihnen Ihre Zugangsdaten per E-Mail zu.</p>
          <ol className="mt-7 space-y-3">
            {['Antrag eingegangen', 'Prüfung Ihrer Firmendaten – in der Regel innerhalb eines Werktags', 'Zugangsdaten per E-Mail – danach direkt buchen'].map((t, i) => (
              <li key={t} className="flex items-start gap-3 text-sm">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{i === 0 ? '✓' : i + 1}</span>
                <span className={i === 0 ? 'font-semibold text-gray-900' : 'text-gray-600'}>{t}</span>
              </li>
            ))}
          </ol>
          <div className="mt-7 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
            Fragen? <a href={CONTACT_INFO.phoneHref} className="font-semibold text-[#0c2d48] hover:underline">{CONTACT_INFO.phone}</a> · <a href={`mailto:${CONTACT_INFO.email}`} className="font-semibold text-[#0c2d48] hover:underline">{CONTACT_INFO.email}</a>
          </div>
          <button onClick={() => router.push('/portal')} className="mt-6 w-full rounded-xl bg-[#0c2d48] py-3 text-sm font-semibold text-white hover:bg-[#0a2540]">
            Zurück zum Login
          </button>
        </div>
      </div>
    );
  }

  if (!checkingStatus && !applicationsEnabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0c2d48] via-[#1a4a6e] to-[#0c2d48] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <XCircle size={48} className="text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Anmeldungen derzeit geschlossen</h2>
          <p className="text-gray-600 text-sm mb-6">Wir nehmen aktuell keine neuen Firmenanmeldungen an. Bestehende Firmenkunden können sich wie gewohnt einloggen.</p>
          <button onClick={() => router.push('/portal')} className="text-primary-600 hover:text-primary-700 font-semibold text-sm">
            Zum Login
          </button>
        </div>
      </div>
    );
  }

  const inputBase = "w-full mt-1.5 border border-gray-200 bg-gray-50/60 rounded-xl pl-11 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#fbbf24]/60 focus:border-[#fbbf24] outline-none transition";
  const iconBase = "absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400";
  const groupTitle = "flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0c2d48]";

  const benefits = [
    { title: 'Sammelrechnung', desc: 'Monatliche Sammelrechnung statt Einzelabrechnung pro Fahrt.' },
    { title: 'Firmenrabatt', desc: 'Individuelle Konditionen ab dem ersten Fahrtvolumen.' },
    { title: 'Direktbuchung im Portal', desc: 'Buchen Sie Fahrten für Ihre Gäste ohne Wartezeit am Telefon.' },
    { title: 'Feste Ansprechpartner', desc: 'Persönlicher Support für alle Anliegen rund um Ihr Konto.' },
  ];
  const trust = [
    { icon: BadgeCheck, label: '20+ Jahre Erfahrung' },
    { icon: Star, label: '4,7 Ø Bewertung' },
    { icon: ShieldCheck, label: 'Behördlich konzessioniert' },
    { icon: Lock, label: 'SSL & DSGVO' },
  ];
  const steps = [
    { title: 'Antrag absenden', desc: 'Firmendaten in rund 2 Minuten übermitteln.' },
    { title: 'Prüfung', desc: 'Wir prüfen Ihre Anfrage in der Regel innerhalb eines Werktags.' },
    { title: 'Zugangsdaten erhalten', desc: 'Per E-Mail – danach buchen Sie direkt im Portal.' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0c2d48] text-white">
        <img src="/images/business/apply-hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[75%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c2d48] via-[#0c2d48]/85 to-[#0c2d48]/20" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-5">
            <a href="/" aria-label="Startseite"><img src="/images/logo-wide-400.webp" alt="flughafen-muenchen.TAXI" className="h-9 w-auto sm:h-11" /></a>
            <button onClick={() => router.push('/portal')} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-white/25 backdrop-blur hover:bg-white/20">
              Portal-Login
            </button>
          </div>
          <div className="max-w-xl pb-40 pt-8 sm:pt-12 lg:pb-48">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#fbbf24]">Business Portal</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight drop-shadow sm:text-5xl">Firmenkonto für Flughafen München Taxi</h1>
            <p className="mt-4 text-base text-white/85 drop-shadow sm:text-lg">Für Hotels, Reisebüros und Unternehmen, die regelmäßig Transfers zum und vom Flughafen München buchen.</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {trust.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25 backdrop-blur">
                  <Icon size={14} className="text-[#fbbf24]" /> {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="relative mx-auto -mt-32 grid max-w-6xl gap-8 px-4 pb-16 sm:px-6 lg:-mt-40 lg:grid-cols-[1.15fr_1fr]">
        {/* Form */}
        <div className="order-1 lg:order-2">
          <div className="rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/5 sm:p-8">
            <div className="mb-6 border-b border-gray-100 pb-5">
              <h2 className="text-xl font-extrabold text-gray-900">Firmenkonto beantragen</h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><Clock size={13} /> Wir prüfen Ihre Anfrage in der Regel innerhalb eines Werktags.</p>
            </div>

            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Honeypot — invisible to real users, bots that auto-fill every field trip this */}
              <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off"
                  value={honeypot} onChange={e => setHoneypot(e.target.value)} />
              </div>

              <fieldset className="space-y-4">
                <legend className={groupTitle}><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#fbbf24] text-[10px] text-[#0c2d48]">1</span> Unternehmen</legend>
                <div>
                  <label className="text-sm font-medium text-gray-700">Firmenname *</label>
                  <div className="relative">
                    <Building2 size={16} className={iconBase} />
                    <input type="text" required value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })}
                      className={inputBase} placeholder="z. B. Hotel Vier Jahreszeiten GmbH" autoComplete="organization" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Adresse</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-4 text-gray-400" />
                    <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2}
                      className={`${inputBase} resize-none`} placeholder="Straße, Hausnummer, PLZ, Ort" autoComplete="street-address" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">USt-IdNr. <span className="font-normal text-gray-400">(optional)</span></label>
                  <div className="relative">
                    <FileText size={16} className={iconBase} />
                    <input type="text" value={form.ust_idnr} onChange={e => setForm({ ...form, ust_idnr: e.target.value })}
                      className={inputBase} placeholder="DE123456789" />
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className={groupTitle}><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#fbbf24] text-[10px] text-[#0c2d48]">2</span> Ansprechpartner</legend>
                <div>
                  <label className="text-sm font-medium text-gray-700">Name *</label>
                  <div className="relative">
                    <User size={16} className={iconBase} />
                    <input type="text" required value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })}
                      className={inputBase} placeholder="Vor- und Nachname" autoComplete="name" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Telefon *</label>
                    <div className="relative">
                      <Phone size={16} className={iconBase} />
                      <input type="tel" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                        className={inputBase} placeholder="+49 …" autoComplete="tel" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">E-Mail *</label>
                    <div className="relative">
                      <Mail size={16} className={iconBase} />
                      <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                        className={inputBase} placeholder="name@firma.de" autoComplete="email" />
                    </div>
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className={groupTitle}><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#fbbf24] text-[10px] text-[#0c2d48]">3</span> Ihr Bedarf</legend>
                <div>
                  <label className="text-sm font-medium text-gray-700">Nachricht <span className="font-normal text-gray-400">(optional)</span></label>
                  <div className="relative">
                    <MessageSquare size={16} className="absolute left-3.5 top-4 text-gray-400" />
                    <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={3}
                      className={`${inputBase} resize-none`} placeholder="z. B. ca. 10 Fahrten im Monat, überwiegend Flughafen ↔ Hotel" />
                  </div>
                </div>
              </fieldset>

              <div>
                <button type="submit" disabled={loading}
                  className="w-full bg-[#fbbf24] text-[#0c2d48] py-3.5 rounded-xl font-bold text-base hover:bg-[#f5b30f] transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#fbbf24]/30">
                  {loading ? <div className="animate-spin w-5 h-5 border-2 border-[#0c2d48] border-t-transparent rounded-full" /> : <><Send size={18} /> Antrag absenden</>}
                </button>
                <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-gray-500">
                  <Lock size={13} className="mt-0.5 shrink-0" />
                  <span>SSL-verschlüsselt. Ihre Angaben verwenden wir nur zur Prüfung und Einrichtung Ihres Firmenkontos – siehe <a href="/datenschutz" className="underline hover:text-gray-700">Datenschutzerklärung</a>. Der Antrag ist unverbindlich und kostenlos.</span>
                </p>
              </div>
            </form>

            <button onClick={() => router.push('/portal')} className="mt-5 text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 mx-auto">
              <ArrowLeft size={14} /> Bereits Kunde? Zum Login
            </button>
          </div>
        </div>

        {/* Info column */}
        <div className="order-2 space-y-6 lg:order-1 lg:pt-48">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
            <h2 className="text-lg font-extrabold text-gray-900">Ihre Vorteile als Firmenkunde</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {benefits.map(b => (
                <div key={b.title} className="flex gap-3 items-start">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fbbf24]/15"><CheckCircle size={18} className="text-[#d99a00]" /></span>
                  <div>
                    <p className="text-gray-900 font-semibold text-sm">{b.title}</p>
                    <p className="text-gray-500 text-sm mt-0.5">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl bg-[#0c2d48] text-white shadow-sm sm:grid sm:grid-cols-[1fr_1.2fr]">
            <img src="/images/business/apply-panel.webp" alt="" loading="lazy" className="h-56 w-full object-cover object-top sm:h-full" />
            <div className="p-6 sm:p-7">
              <h2 className="text-lg font-extrabold">So geht&apos;s weiter</h2>
              <ol className="mt-4 space-y-4">
                {steps.map((st, i) => (
                  <li key={st.title} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fbbf24] text-xs font-extrabold text-[#0c2d48]">{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold">{st.title}</p>
                      <p className="text-xs text-white/70 mt-0.5">{st.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-semibold text-gray-900">Fragen zum Firmenkonto?</p>
            <p className="text-sm text-gray-500 mt-0.5">Wir sind rund um die Uhr für Sie erreichbar.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center gap-2 rounded-xl bg-[#0c2d48] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a2540]"><Phone size={16} /> {CONTACT_INFO.phone}</a>
              <a href={CONTACT_INFO.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600"><MessageCircle size={16} /> WhatsApp</a>
              <a href={`mailto:${CONTACT_INFO.email}`} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#0c2d48] ring-1 ring-gray-300 hover:bg-gray-50"><Mail size={16} /> E-Mail</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
