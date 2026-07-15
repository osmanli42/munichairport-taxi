'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { portalApi, setToken } from '@/lib/portalApi';
import { Car, LogIn, ArrowRight } from 'lucide-react';

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c2d48] via-[#1a4a6e] to-[#0c2d48] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center">
              <Car size={28} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Firmenkundenportal</h1>
          <p className="text-blue-200 text-sm mt-1">Flughafen München Taxi</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Anmelden</h2>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">E-Mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="ihre@firma.de" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Passwort</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full mt-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-[#0c2d48] text-white py-3 rounded-xl font-semibold hover:bg-[#0a2540] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <><LogIn size={18} /> Anmelden</>}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">Noch kein Firmenkonto?</p>
            <button onClick={() => router.push('/portal/apply')}
              className="mt-2 text-primary-600 hover:text-primary-700 text-sm font-semibold flex items-center justify-center gap-1 mx-auto">
              Jetzt beantragen <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
