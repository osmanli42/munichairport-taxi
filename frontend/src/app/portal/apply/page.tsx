'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { portalApi } from '@/lib/portalApi';
import { Car, Send, ArrowLeft, CheckCircle, XCircle, Building2, User, Phone, Mail, MapPin, FileText, MessageSquare } from 'lucide-react';

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
      const res = await portalApi.apply(form);
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Fehler'); setLoading(false); return; }
      setSuccess(true);
    } catch { setError('Verbindungsfehler'); }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0c2d48] via-[#1a4a6e] to-[#0c2d48] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Anfrage eingegangen!</h2>
          <p className="text-gray-600 text-sm mb-6">Wir prüfen Ihre Anfrage und senden Ihnen Ihre Zugangsdaten per E-Mail zu.</p>
          <button onClick={() => router.push('/portal')} className="text-primary-600 hover:text-primary-700 font-semibold text-sm">
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

  const inputBase = "w-full mt-1.5 border border-gray-300 rounded-xl pl-11 pr-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow";
  const iconBase = "absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400";

  const benefits = [
    { title: 'Sammelrechnung', desc: 'Monatliche Sammelrechnung statt Einzelabrechnung pro Fahrt.' },
    { title: 'Firmenrabatt', desc: 'Individuelle Konditionen ab dem ersten Fahrtvolumen.' },
    { title: 'Direktbuchung im Portal', desc: 'Buchen Sie Fahrten für Ihre Gäste ohne Wartezeit am Telefon.' },
    { title: 'Feste Ansprechpartner', desc: 'Persönlicher Support für alle Anliegen rund um Ihr Konto.' },
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#0c2d48] via-[#1a4a6e] to-[#0c2d48] flex items-center justify-center p-4 py-10">
      <div className="absolute top-6 left-6 bg-white rounded-xl px-4 py-2 shadow-lg">
        <p className="text-base font-bold tracking-tight">
          <span className="text-[#0c2d48]">Flughafen-muenchen.</span><span className="text-[#fbbf24]">TAXI</span>
        </p>
      </div>
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-12 items-center">
        <div className="hidden lg:block">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm mb-6">
            <Car size={30} className="text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">Firmenkonto für<br />Flughafen München Taxi</h1>
          <p className="text-blue-200 text-base mt-3 max-w-md">Für Hotels, Reisebüros und Unternehmen, die regelmäßig Transfers zum und vom Flughafen München buchen.</p>

          <div className="mt-10 space-y-5">
            {benefits.map(b => (
              <div key={b.title} className="flex gap-3 items-start">
                <CheckCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-semibold text-sm">{b.title}</p>
                  <p className="text-blue-200/80 text-sm mt-0.5">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-lg mx-auto">
        <div className="text-center mb-7 lg:hidden">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm mb-4">
            <Car size={30} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Firmenkonto beantragen</h1>
          <p className="text-blue-200 text-sm mt-1">Flughafen München Taxi &middot; Business Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 p-8">
          <div className="mb-6 pb-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Ihre Firmendaten</h2>
            <p className="text-xs text-gray-500 mt-1">Wir prüfen Ihre Anfrage in der Regel innerhalb eines Werktags.</p>
          </div>

          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Firmenname *</label>
              <div className="relative">
                <Building2 size={16} className={iconBase} />
                <input type="text" required value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })}
                  className={inputBase} placeholder="z. B. Hotel Vier Jahreszeiten GmbH" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Ansprechpartner *</label>
                <div className="relative">
                  <User size={16} className={iconBase} />
                  <input type="text" required value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })}
                    className={inputBase} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Telefon *</label>
                <div className="relative">
                  <Phone size={16} className={iconBase} />
                  <input type="tel" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className={inputBase} />
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">E-Mail *</label>
              <div className="relative">
                <Mail size={16} className={iconBase} />
                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className={inputBase} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Adresse</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={4}
                  className={`${inputBase} resize-none pt-3`} placeholder="Straße, Hausnummer, PLZ, Ort" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">USt-IdNr.</label>
              <div className="relative">
                <FileText size={16} className={iconBase} />
                <input type="text" value={form.ust_idnr} onChange={e => setForm({ ...form, ust_idnr: e.target.value })}
                  className={inputBase} placeholder="DE123456789" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Nachricht</label>
              <div className="relative">
                <MessageSquare size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={3}
                  className={`${inputBase} resize-none pt-3`} placeholder="Optional: weitere Angaben zu Ihrem Bedarf" />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-[#0c2d48] text-white py-3 rounded-xl font-semibold hover:bg-[#0a2540] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#0c2d48]/20">
              {loading ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><Send size={18} /> Antrag absenden</>}
            </button>
          </form>

          <button onClick={() => router.push('/portal')} className="mt-5 text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1 mx-auto">
            <ArrowLeft size={14} /> Zurück zum Login
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
