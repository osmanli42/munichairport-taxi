'use client';

// Rechnungskunden (Überweisung für freigeschaltete Privatkunden) — Admin-Bausteine.
// Backend: backend/src/routes/invoiceCustomers.ts
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, CheckCircle2, HelpCircle, Landmark, Loader2, Trash2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const authHeaders = (): Record<string, string> => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';
  return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
};

interface Customer {
  id: number;
  email: string;
  phone_e164: string;
  name: string | null;
  rechnung_adresse: string | null;
  max_open: number;
  active: number;
  created_at: string;
  open_transfers?: number;
  bookings_total?: number;
}

interface CheckResult {
  email: { domain: string; freemail: boolean; mx: boolean | null; company: string; company_match: boolean };
  address: { checked: boolean; reason?: string; found?: boolean; exact?: boolean; has_street_number?: boolean; plz_matches?: boolean; formatted?: string };
}

type Level = 'ok' | 'warn' | 'unknown';
function CheckRow({ level, children }: { level: Level; children: React.ReactNode }) {
  const Icon = level === 'ok' ? CheckCircle2 : level === 'warn' ? AlertTriangle : HelpCircle;
  const cls = level === 'ok' ? 'text-emerald-600' : level === 'warn' ? 'text-amber-600' : 'text-gray-400';
  return (
    <div className="flex items-start gap-1.5 text-xs text-gray-700">
      <Icon size={13} className={`${cls} mt-[1px] shrink-0`} />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/** Kostenlose Plausibilitätsprüfung: Firmen-E-Mail + existierende Rechnungsadresse. */
function PlausibilityChecks({ bookingId }: { bookingId: number }) {
  const [r, setR] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let off = false;
    fetch(`${API}/admin/invoice-customers/check/${bookingId}`, { headers: authHeaders() })
      .then(x => x.json()).then(d => { if (!off && d?.email) setR(d); })
      .catch(() => {}).finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, [bookingId]);

  if (loading) return <div className="text-xs text-gray-400 flex items-center gap-1 mt-2"><Loader2 size={12} className="animate-spin" /> Prüfe E-Mail und Adresse…</div>;
  if (!r) return null;
  const e = r.email;
  const a = r.address;

  let emailLevel: Level; let emailText: string;
  if (!e.domain) { emailLevel = 'warn'; emailText = 'Keine E-Mail-Adresse'; }
  else if (e.freemail) { emailLevel = 'warn'; emailText = `Private E-Mail (${e.domain}) — keine Firmenadresse`; }
  else if (e.mx === false) { emailLevel = 'warn'; emailText = `Domain ${e.domain} empfängt keine E-Mails`; }
  else if (e.company_match) { emailLevel = 'ok'; emailText = `Firmen-E-Mail @${e.domain} passt zu „${e.company}“`; }
  else if (e.company) { emailLevel = 'unknown'; emailText = `Firmen-Domain @${e.domain}${e.mx ? ' (empfängt Mails)' : ''} — Name „${e.company}“ nicht erkennbar in der Domain`; }
  else { emailLevel = 'ok'; emailText = `Firmen-Domain @${e.domain}${e.mx ? ' (empfängt Mails)' : ''}`; }

  let addrLevel: Level; let addrText: string;
  if (!a.checked) {
    addrLevel = a.reason === 'no_address' || a.reason === 'empty' ? 'warn' : 'unknown';
    addrText = a.reason === 'no_address' ? 'Keine Rechnungsadresse angegeben'
      : a.reason === 'empty' ? 'Rechnungsadresse unvollständig (keine Straße / PLZ)'
      : 'Adressprüfung nicht möglich';
  } else if (!a.found) { addrLevel = 'warn'; addrText = 'Rechnungsadresse bei Google nicht gefunden'; }
  else if (a.exact && a.has_street_number && a.plz_matches) { addrLevel = 'ok'; addrText = `Adresse existiert: ${a.formatted}`; }
  else { addrLevel = 'unknown'; addrText = `Nur ungefähr gefunden${a.plz_matches === false ? ' (PLZ weicht ab)' : ''}: ${a.formatted}`; }

  return (
    <div className="mt-2 space-y-1 border-t border-black/5 pt-2">
      <CheckRow level={emailLevel}>{emailText}</CheckRow>
      <CheckRow level={addrLevel}>{addrText}</CheckRow>
      <div className="text-[10px] text-gray-400 pl-5">Hinweis: prüft E-Mail und Anschrift, nicht den Handelsregistereintrag.</div>
    </div>
  );
}

/** Karte im Buchungsdetail: Kunde für Überweisung freischalten / Status anzeigen. */
export function InvoiceCustomerBookingCard({ bookingId, isCompany }: { bookingId: number; isCompany: boolean }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [open, setOpen] = useState(0);
  const [canApprove, setCanApprove] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/invoice-customers/by-booking/${bookingId}`, { headers: authHeaders() });
      const d = await r.json();
      setCustomer(d.customer || null);
      setOpen(Number(d.open_transfers || 0));
      setCanApprove(!!d.can_approve);
    } catch {
      setErr('Status konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  if (isCompany) return null;
  if (loading) return null;

  const approve = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${API}/admin/invoice-customers`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ booking_id: bookingId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Fehler');
      setCustomer(d.customer); setOpen(Number(d.open_transfers || 0));
    } catch (e: any) {
      setErr(e.message || 'Freischalten fehlgeschlagen');
    } finally { setBusy(false); }
  };

  const setActive = async (active: boolean) => {
    if (!customer) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${API}/admin/invoice-customers/${customer.id}`, {
        method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ active }),
      });
      const d = await r.json();
      setCustomer(d.customer);
    } catch { setErr('Speichern fehlgeschlagen'); } finally { setBusy(false); }
  };

  const active = !!customer && customer.active === 1;

  return (
    <div className={`mt-2 rounded-xl border px-3 py-2.5 text-sm ${active ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
      {active ? (
        <div className="flex items-start gap-2">
          <BadgeCheck size={16} className="text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-emerald-800">Rechnungskunde — Überweisung freigeschaltet</div>
            <div className="text-xs text-emerald-700 mt-0.5">
              Sieht bei der nächsten Buchung „Überweisung“ (E-Mail + Telefon müssen passen).
              Offene Überweisungen: <b>{open}</b> / max. {customer!.max_open}
              {customer!.rechnung_adresse ? ' · Rechnungsadresse hinterlegt' : ' · keine Rechnungsadresse'}
            </div>
          </div>
          <button onClick={() => setActive(false)} disabled={busy}
            className="text-xs text-gray-600 hover:text-red-600 border border-gray-300 bg-white rounded-lg px-2 py-1 shrink-0">
            Entziehen
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Landmark size={16} className="text-gray-500 shrink-0" />
          <div className="flex-1 min-w-0 text-xs text-gray-600">
            {customer
              ? 'Freischaltung für Überweisung ist pausiert.'
              : 'Zuverlässiger Kunde? Bei der nächsten Buchung „Überweisung“ anbieten.'}
            {!canApprove && ' (E-Mail und gültige Telefonnummer nötig)'}
          </div>
          <button
            onClick={customer ? () => setActive(true) : approve}
            disabled={busy || !canApprove}
            className="text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 shrink-0 flex items-center gap-1"
          >
            {busy && <Loader2 size={12} className="animate-spin" />}
            {customer ? 'Wieder freischalten' : 'Als Rechnungskunde freischalten'}
          </button>
        </div>
      )}
      <PlausibilityChecks bookingId={bookingId} />
      {err && <div className="text-xs text-red-600 mt-1">{err}</div>}
    </div>
  );
}

/** Liste in den Einstellungen: alle freigeschalteten Rechnungskunden verwalten. */
export function InvoiceCustomersList() {
  const [rows, setRows] = useState<Customer[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/admin/invoice-customers`, { headers: authHeaders() });
      const d = await r.json();
      setRows(d.customers || []);
    } catch { setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = async (id: number, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      await fetch(`${API}/admin/invoice-customers/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) });
      await load();
    } finally { setBusyId(null); }
  };
  const remove = async (id: number) => {
    if (!confirm('Freischaltung endgültig löschen?')) return;
    setBusyId(id);
    try {
      await fetch(`${API}/admin/invoice-customers/${id}`, { method: 'DELETE', headers: authHeaders() });
      await load();
    } finally { setBusyId(null); }
  };

  if (rows === null) return <div className="text-xs text-gray-400 mt-2">Lade Rechnungskunden…</div>;
  if (rows.length === 0) {
    return <div className="text-xs text-gray-500 mt-2">Noch keine Rechnungskunden. Freischalten geht im Buchungsdetail („Als Rechnungskunde freischalten“).</div>;
  }
  return (
    <div className="mt-3 rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-72 overflow-y-auto">
      {rows.map(c => (
        <div key={c.id} className={`px-3 py-2 flex items-center gap-3 text-sm ${c.active ? '' : 'opacity-50'}`}>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-800 truncate">{c.name || c.email}</div>
            <div className="text-xs text-gray-500 truncate">{c.email} · {c.phone_e164}</div>
            {c.rechnung_adresse && <div className="text-[11px] text-gray-400 truncate">{c.rechnung_adresse.split('\n')[0]}</div>}
          </div>
          <div className="text-xs text-gray-600 text-right shrink-0">
            offen <b>{c.open_transfers ?? 0}</b>/
            <select
              value={c.max_open}
              onChange={(e) => patch(c.id, { max_open: Number(e.target.value) })}
              className="border border-gray-200 rounded px-1 py-0.5 text-xs"
              disabled={busyId === c.id}
            >
              {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="text-[11px] text-gray-400">{c.bookings_total ?? 0} Buchungen</div>
          </div>
          <button
            onClick={() => patch(c.id, { active: !c.active })}
            disabled={busyId === c.id}
            className={`text-xs rounded-lg px-2 py-1 border shrink-0 ${c.active ? 'border-gray-300 text-gray-600 hover:text-red-600' : 'border-emerald-300 text-emerald-700'}`}
          >
            {c.active ? 'Pausieren' : 'Aktivieren'}
          </button>
          <button onClick={() => remove(c.id)} disabled={busyId === c.id} className="p-1 text-gray-300 hover:text-red-600 shrink-0" title="Löschen">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
