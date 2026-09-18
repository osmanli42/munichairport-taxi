'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { adminApi } from '@/lib/api';

const MIN_LENGTH = 12;

function classCount(pw: string): number {
  return [/[a-zß-ÿ]/.test(pw), /[A-ZÀ-Þ]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)]
    .filter(Boolean).length;
}

// Mirrors backend/src/utils/passwordPolicy.ts so the meter matches the server.
const CONTEXT_WORDS = ['munich', 'münchen', 'muenchen', 'taxi', 'flughafen', 'airport',
  'freising', 'admin', 'passwort', 'password', 'qwertz', 'qwerty', 'letmein', '123456',
  'willkommen', 'welcome'];

function score(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= MIN_LENGTH) s++;
  if (pw.length >= 16) s++;
  if (classCount(pw) >= 3) s++;
  if (classCount(pw) === 4 && pw.length >= 14) s++;
  if (CONTEXT_WORDS.some(w => pw.toLowerCase().includes(w))) s = Math.min(s, 1);
  if (/^(.)\1+$/.test(pw)) s = 0;
  return Math.min(s, 4);
}

const METER = [
  { label: 'Sehr schwach', bar: 'bg-red-500', text: 'text-red-600', w: 'w-1/12' },
  { label: 'Schwach', bar: 'bg-red-500', text: 'text-red-600', w: 'w-1/4' },
  { label: 'Mittel', bar: 'bg-amber-500', text: 'text-amber-600', w: 'w-2/4' },
  { label: 'Gut', bar: 'bg-lime-500', text: 'text-lime-600', w: 'w-3/4' },
  { label: 'Stark', bar: 'bg-green-600', text: 'text-green-700', w: 'w-full' },
];

function Field({ label, value, onChange, show, onToggle, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; autoComplete: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function PasswordChangeCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const s = score(next);
  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const tooFewClasses = next.length >= MIN_LENGTH && classCount(next) < 3;
  const canSubmit = !!current && next.length >= MIN_LENGTH && next === confirm
    && classCount(next) >= 3 && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setDone(''); setSaving(true);
    try {
      const res = await adminApi.changePassword(current, next);
      // Server rotates the token: every other session is now signed out.
      if (res?.token) localStorage.setItem('admin_token', res.token);
      setDone(res?.message || 'Passwort geändert.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2?.response?.data?.error || 'Passwort konnte nicht geändert werden.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Lock size={18} className="text-gray-700" />
        <h3 className="font-bold text-gray-900 text-lg">Passwort ändern</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Mindestens {MIN_LENGTH} Zeichen aus drei der vier Zeichenarten (Klein-, Großbuchstaben,
        Ziffern, Sonderzeichen). Nach der Änderung werden alle anderen Sitzungen abgemeldet.
      </p>

      <form onSubmit={submit} className="space-y-4 max-w-md">
        <Field label="Aktuelles Passwort" value={current} onChange={setCurrent}
          show={showCur} onToggle={() => setShowCur(v => !v)} autoComplete="current-password" />
        <Field label="Neues Passwort" value={next} onChange={setNext}
          show={showNew} onToggle={() => setShowNew(v => !v)} autoComplete="new-password" />

        {next.length > 0 && (
          <div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${METER[s].bar} ${METER[s].w}`} />
            </div>
            <p className={`text-xs mt-1 ${METER[s].text}`}>Stärke: {METER[s].label}</p>
          </div>
        )}

        <Field label="Neues Passwort bestätigen" value={confirm} onChange={setConfirm}
          show={showNew} onToggle={() => setShowNew(v => !v)} autoComplete="new-password" />

        {tooShort && <p className="text-xs text-amber-600">Noch {MIN_LENGTH - next.length} Zeichen bis zur Mindestlänge.</p>}
        {tooFewClasses && <p className="text-xs text-amber-600">Bitte mindestens drei verschiedene Zeichenarten verwenden.</p>}
        {mismatch && <p className="text-xs text-red-600">Die Passwörter stimmen nicht überein.</p>}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}
        {done && (
          <div className="flex items-start gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <Check size={16} className="mt-0.5 shrink-0" /><span>{done}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <ShieldCheck size={15} /> {saving ? 'Wird gespeichert…' : 'Passwort ändern'}
        </button>
      </form>
    </div>
  );
}
