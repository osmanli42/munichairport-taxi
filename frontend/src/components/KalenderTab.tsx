'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarDays, RefreshCw, Settings, Check, AlertTriangle, FileText, Send, X,
  ExternalLink, Eye, ChevronDown, ChevronUp, Pencil, EyeOff, Undo2, UserPlus,
  Download, Info, Building2, Inbox as InboxIcon,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ─── Typen: Antwort von GET /admin/calendar/inbox ────────────────────────────

interface Billing {
  name: string;
  address: string;
  email: string | null;
  ust_idnr: string | null;
  project: string | null;
}

interface Ride {
  key: string;
  kind: 'calendar' | 'booking';
  uid: string | null;
  booking_id: number | null;
  booking_number: string | null;
  html_link: string | null;
  pickup_datetime: string;
  month: string;
  summary: string;
  location: string;
  description: string;
  tag: string | null;
  company_id: number | null;
  company_via: string | null;
  billing: Billing | null;
  email_candidates: string[];
  pickup_address: string | null;
  dropoff_address: string | null;
  guest_name: string | null;
  price: number | null;
  price_source: string | null;
  price_conflict: number | null;
  stopover: string | null;
  steuersatz: number;
  distance_km: number | null;
  mwst_source: 'distance' | 'default' | 'booking';
  price_note: string | null;
  warnings: string[];
}

interface Company {
  id: number;
  company_name: string;
  contact_name: string;
  address: string;
  ust_idnr: string | null;
  invoice_email: string | null;
  payment_term_days: number;
}

interface InvoiceRow {
  id: number;
  company_id: number;
  invoice_number: string;
  period_month: string;
  total: number;
  status: string;
  manual_sent_at: string | null;
}

interface DoneRide {
  booking_id: number;
  booking_number: string;
  pickup_datetime: string;
  pickup_address: string;
  dropoff_address: string;
  guest_name: string;
  price: number;
  company_id: number | null;
  invoice: { invoice_id: number; invoice_number: string } | null;
}

interface IgnoredRide {
  uid: string;
  note: string | null;
  pickup_datetime: string | null;
  summary: string;
  location: string;
  html_link: string | null;
}

interface Inbox {
  window: { from: string; to: string; months: number };
  fetched_at: string;
  calendar_events: number;
  open: Ride[];
  done: DoneRide[];
  ignored: IgnoredRide[];
  companies: Company[];
  invoices: InvoiceRow[];
}

interface Alias {
  id: number;
  alias: string;
  company_id: number;
  company_name: string | null;
}

type RideEdit = Partial<Pick<Ride, 'pickup_datetime' | 'pickup_address' | 'dropoff_address' | 'guest_name' | 'price' | 'steuersatz'>> & {
  // null = "Yeni müşteri (fatura adresinden)", Zahl = bestehende Firma
  customer?: number | 'new' | null;
};

interface NewCustomerForm {
  company_name: string;
  address: string;
  ust_idnr: string;
  contact_name: string;
}

interface Group {
  key: string; // customerKey|month
  customerKey: string; // c:<id> | n:<name> | u
  companyId: number | null;
  month: string;
  rides: Ride[];
  billing: Billing | null;
  tag: string | null;
}

interface CreatedInvoice {
  title: string;
  month: string;
  rideCount: number;
  invoice: { id: number; invoice_number: string; total: number; due_date: string };
  company: { id: number; company_name: string; created: boolean };
  emailDefault: string;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const fmtEur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

function fmtDateTime(v: string | null): string {
  if (!v) return '—';
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : v;
}

function fmtDate(v: string | null): string {
  if (!v) return '—';
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : v;
}

function monthLabel(month: string): string {
  const s = new Date(`${month}-15T12:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function currentMonth(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
}

const normName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function rideValid(r: Ride): boolean {
  return !!(r.pickup_datetime && r.pickup_address?.trim() && r.dropoff_address?.trim() && Number(r.price) > 0 && [0, 7, 19].includes(Number(r.steuersatz)));
}

const WARNING_TEXT: Record<string, (r: Ride) => string> = {
  price_missing: () => 'Fiyat bulunamadı — lütfen gir',
  route_missing: () => 'Nereden / Nereye eksik',
  price_conflict: (r) => `Ort'taki fiyat ile açıklamadaki fiyat farklı (açıklama: ${fmtEur(r.price_conflict || 0)})`,
  stopover: (r) => `Ara durak: ${r.stopover}`,
  stopover_mwst: (r) => `Ara durak (${r.stopover}) ile yol 50 km'yi geçebilir — MwSt'yi kontrol et`,
  no_distance: () => 'Mesafe hesaplanamadı — MwSt varsayılan değer, kontrol et',
  mwst_borderline: (r) => `Mesafe 50 km sınırında (${String(r.distance_km).replace('.', ',')} km, Google en hızlı rota) — MwSt'yi kontrol et`,
  new_customer: () => 'Yeni müşteri — fatura adresi açıklamadan alındı',
  customer_missing: () => 'Müşteri bulunamadı — aşağıdan seç veya yeni müşteri ekle',
  hr_split: (r) => `Gidiş+dönüş fiyatı iki fahrt'a bölündü: ${r.price_note}`,
  hr: () => '"(H+R)" yazıyor — fiyat gidiş+dönüş için olabilir, kontrol et',
  unbilled_booking: () => 'Sistemde kayıtlı ama henüz faturası yok',
};

// Warnungen, die nach einer manuellen Korrektur nicht mehr zutreffen
function activeWarnings(r: Ride, edit: RideEdit | undefined): string[] {
  return r.warnings.filter((w) => {
    if (w === 'price_missing') return !(Number(r.price) > 0);
    if (w === 'route_missing') return !(r.pickup_address?.trim() && r.dropoff_address?.trim());
    if ((w === 'customer_missing' || w === 'new_customer') && edit?.customer !== undefined) return false;
    return true;
  });
}

async function api(path: string, token: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts?.headers },
  });
}

// ═════════════════════════════════════════════════════════════════════════════

export default function KalenderTab({ token }: { token: string }) {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [months, setMonths] = useState(4);
  const [edits, setEdits] = useState<Record<string, RideEdit>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newForms, setNewForms] = useState<Record<string, NewCustomerForm>>({});
  const [aliasChoice, setAliasChoice] = useState<Record<string, { save: boolean; text: string; offer: boolean }>>({});
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, 'create' | 'preview' | 'send' | undefined>>({});
  const [groupError, setGroupError] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<Record<string, CreatedInvoice>>({});
  const [sendTo, setSendTo] = useState<Record<string, string>>({});
  const [sentTo, setSentTo] = useState<Record<string, string>>({});
  const [showDone, setShowDone] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  // Einstellungen (Kalender-ID, Aliasse)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calendarId, setCalendarId] = useState('');
  const [saConfigured, setSaConfigured] = useState(true);
  const [aliases, setAliases] = useState<Alias[]>([]);

  const flash = (text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), error ? 7000 : 4000);
  };

  const loadInbox = useCallback(async (m: number) => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api(`/admin/calendar/inbox?months=${m}`, token);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setLoadError(d.error || 'Takvim yüklenemedi'); }
      else {
        setInbox(d as Inbox);
        setEdits({});
        setExcluded(new Set());
        setGroupError({});
      }
    } catch (e: any) {
      setLoadError(e.message || 'Ağ hatası');
    }
    setLoading(false);
  }, [token]);

  const loadSettings = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([api('/admin/calendar/settings', token), api('/admin/calendar/aliases', token)]);
      if (s.ok) {
        const d = await s.json();
        setCalendarId(d.calendar_id || '');
        setSaConfigured(!!d.service_account_configured);
      }
      if (a.ok) setAliases(await a.json());
    } catch { /* Einstellungen sind optional */ }
  }, [token]);

  useEffect(() => { loadInbox(months); }, [loadInbox, months]);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  const companiesById = useMemo(() => new Map((inbox?.companies || []).map((c) => [c.id, c])), [inbox]);

  // Fahrten mit manuellen Korrekturen
  const rides: Ride[] = useMemo(() => (inbox?.open || []).map((r) => {
    const e = edits[r.key];
    if (!e) return r;
    const { customer, ...fields } = e;
    const merged = { ...r, ...fields } as Ride;
    if (customer !== undefined) merged.company_id = typeof customer === 'number' ? customer : null;
    return merged;
  }), [inbox, edits]);

  // Gruppen: Kunde + Monat → je eine Rechnung
  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const r of rides) {
      const e = edits[r.key];
      let customerKey: string;
      if (r.company_id) customerKey = `c:${r.company_id}`;
      else if (e?.customer === 'new' || (e?.customer === undefined && r.billing)) customerKey = r.billing ? `n:${normName(r.billing.name)}` : `n:${r.key}`;
      else customerKey = 'u';
      const key = `${customerKey}|${r.month}`;
      if (!map.has(key)) map.set(key, { key, customerKey, companyId: r.company_id, month: r.month, rides: [], billing: null, tag: null });
      const g = map.get(key)!;
      g.rides.push(r);
      if (!g.billing && r.billing) g.billing = r.billing;
      if (!g.tag && r.tag) g.tag = r.tag;
    }
    const name = (g: Group) => (g.companyId ? companiesById.get(g.companyId)?.company_name : g.billing?.name) || 'zzz';
    return Array.from(map.values()).sort((a, b) => (a.month === b.month ? name(a).localeCompare(name(b)) : a.month < b.month ? -1 : 1));
  }, [rides, edits, companiesById]);

  // Formulare für neue Kunden aus der erkannten Rechnungsadresse vorbelegen
  useEffect(() => {
    setNewForms((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (g.companyId || next[g.customerKey]) continue;
        next[g.customerKey] = {
          company_name: g.billing?.name || '',
          address: g.billing?.address || '',
          ust_idnr: g.billing?.ust_idnr || '',
          contact_name: '',
        };
      }
      return next;
    });
    setAliasChoice((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (next[g.key] || !g.tag) continue;
        // Kürzel merken, wenn die Zuordnung nicht schon über genau dieses Kürzel kam
        const viaTag = g.rides.every((r) => r.company_via === 'kuerzel' || r.company_via === 'alias') && !g.rides.some((r) => edits[r.key]?.customer !== undefined);
        next[g.key] = { save: !viaTag, text: g.tag, offer: !viaTag };
      }
      return next;
    });
    setProjects((prev) => {
      const next = { ...prev };
      for (const g of groups) if (next[g.key] === undefined && g.billing?.project) next[g.key] = g.billing.project;
      return next;
    });
  }, [groups, edits]);

  const updateRide = (key: string, patch: RideEdit) => setEdits((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  const toggle = (set: Set<string>, key: string) => { const n = new Set(set); if (n.has(key)) n.delete(key); else n.add(key); return n; };

  const groupTitle = (g: Group) => {
    if (g.companyId) return companiesById.get(g.companyId)?.company_name || `Firma #${g.companyId}`;
    if (g.customerKey.startsWith('n:')) return newForms[g.customerKey]?.company_name || g.billing?.name || 'Yeni müşteri';
    return 'Müşteri seçilmedi';
  };

  const includedRides = (g: Group) => g.rides.filter((r) => !excluded.has(r.key));

  const groupProblems = (g: Group): string[] => {
    const inc = includedRides(g);
    const problems: string[] = [];
    if (inc.length === 0) problems.push('En az bir fahrt seç');
    const invalid = inc.filter((r) => !rideValid(r)).length;
    if (invalid) problems.push(`${invalid} fahrt eksik (fiyat/adres)`);
    if (!g.companyId && !(g.customerKey.startsWith('n:') && newForms[g.customerKey]?.company_name.trim())) problems.push('Müşteri seç veya yeni müşteri adı gir');
    return problems;
  };

  const buildBody = (g: Group) => {
    const inc = includedRides(g);
    const alias = aliasChoice[g.key];
    const nf = newForms[g.customerKey];
    return {
      company_id: g.companyId || undefined,
      new_company: g.companyId ? undefined : nf && {
        company_name: nf.company_name.trim(),
        address: nf.address.trim(),
        ust_idnr: nf.ust_idnr.trim() || undefined,
        contact_name: nf.contact_name.trim() || undefined,
      },
      alias: alias?.save && alias.text.trim() ? alias.text.trim() : undefined,
      project_name: projects[g.key]?.trim() || undefined,
      rides: inc.filter((r) => r.kind === 'calendar').map((r) => ({
        uid: r.uid,
        pickup_datetime: r.pickup_datetime,
        pickup_address: r.pickup_address,
        dropoff_address: r.dropoff_address,
        guest_name: r.guest_name || '',
        price: Number(r.price),
        steuersatz: Number(r.steuersatz),
        notes: [r.summary, r.location].filter(Boolean).join(' · '),
      })),
      booking_ids: inc.filter((r) => r.kind === 'booking').map((r) => r.booking_id),
    };
  };

  const preview = async (g: Group) => {
    // Fenster synchron öffnen, sonst blockiert der Popup-Blocker nach dem await
    const win = window.open('', '_blank');
    setBusy((b) => ({ ...b, [g.key]: 'preview' }));
    try {
      const res = await api('/admin/calendar/invoice-preview', token, { method: 'POST', body: JSON.stringify(buildBody(g)) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        win?.close();
        flash(d.error || 'Önizleme oluşturulamadı', true);
      } else {
        const url = URL.createObjectURL(await res.blob());
        if (win) win.location.href = url; else window.open(url, '_blank');
      }
    } catch (e: any) {
      win?.close();
      flash(e.message || 'Önizleme oluşturulamadı', true);
    }
    setBusy((b) => ({ ...b, [g.key]: undefined }));
  };

  const createInvoice = async (g: Group) => {
    setBusy((b) => ({ ...b, [g.key]: 'create' }));
    setGroupError((e) => ({ ...e, [g.key]: '' }));
    try {
      const res = await api('/admin/calendar/invoice', token, { method: 'POST', body: JSON.stringify(buildBody(g)) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGroupError((e) => ({ ...e, [g.key]: d.error || 'Fatura oluşturulamadı' }));
      } else {
        const inc = includedRides(g);
        const company = companiesById.get(d.company.id);
        const emailDefault = company?.invoice_email || inc.flatMap((r) => r.email_candidates)[0] || '';
        setCreated((c) => ({
          ...c,
          [d.invoice.invoice_number]: {
            title: d.company.company_name,
            month: g.month,
            rideCount: inc.length,
            invoice: d.invoice,
            company: d.company,
            emailDefault,
          },
        }));
        setSendTo((s) => ({ ...s, [d.invoice.invoice_number]: emailDefault }));
        // Übernommene Fahrten aus dem Korb nehmen
        const doneKeys = new Set(inc.map((r) => r.key));
        setInbox((prev) => prev && {
          ...prev,
          open: prev.open.filter((r) => !doneKeys.has(r.key)),
          invoices: [...prev.invoices, { id: d.invoice.id, company_id: d.company.id, invoice_number: d.invoice.invoice_number, period_month: g.month, total: d.invoice.total, status: 'sent', manual_sent_at: null }],
          companies: prev.companies.some((c) => c.id === d.company.id) ? prev.companies : [...prev.companies, {
            id: d.company.id, company_name: d.company.company_name, contact_name: '', address: newForms[g.customerKey]?.address || '',
            ust_idnr: null, invoice_email: null, payment_term_days: 7,
          }],
        });
        flash(`${d.invoice.invoice_number} oluşturuldu ✓`);
      }
    } catch (e: any) {
      setGroupError((err) => ({ ...err, [g.key]: e.message || 'Ağ hatası' }));
    }
    setBusy((b) => ({ ...b, [g.key]: undefined }));
  };

  const sendInvoice = async (number: string) => {
    const c = created[number];
    const email = (sendTo[number] || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { flash('Geçerli bir e-posta adresi gir', true); return; }
    setBusy((b) => ({ ...b, [number]: 'send' }));
    try {
      const res = await api(`/admin/companies/invoices/${c.invoice.id}/send`, token, { method: 'POST', body: JSON.stringify({ email }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) flash(d.error || 'Gönderilemedi', true);
      else {
        setSentTo((s) => ({ ...s, [number]: email }));
        flash(`${number} → ${email} gönderildi ✓`);
        // Adresse für die nächste Rechnung dieses Kunden merken
        api(`/admin/calendar/companies/${c.company.id}/invoice-email`, token, { method: 'PUT', body: JSON.stringify({ email }) }).catch(() => {});
        setInbox((prev) => prev && { ...prev, companies: prev.companies.map((x) => (x.id === c.company.id ? { ...x, invoice_email: email } : x)) });
      }
    } catch (e: any) {
      flash(e.message || 'Gönderilemedi', true);
    }
    setBusy((b) => ({ ...b, [number]: undefined }));
  };

  const ignoreRide = async (r: Ride) => {
    if (!r.uid) return;
    const res = await api('/admin/calendar/ignore', token, { method: 'POST', body: JSON.stringify({ uid: r.uid }) });
    if (!res.ok) { flash('Gizlenemedi', true); return; }
    setInbox((prev) => prev && {
      ...prev,
      open: prev.open.filter((x) => x.key !== r.key),
      ignored: [...prev.ignored, { uid: r.uid!, note: null, pickup_datetime: r.pickup_datetime, summary: r.summary, location: r.location, html_link: r.html_link }],
    });
    flash('Fahrt listeden çıkarıldı');
  };

  const restoreRide = async (uid: string) => {
    const res = await api(`/admin/calendar/ignore/${encodeURIComponent(uid)}`, token, { method: 'DELETE' });
    if (res.ok) { flash('Geri alındı — listeyi yeniliyorum'); loadInbox(months); }
  };

  const saveSettings = async () => {
    const res = await api('/admin/calendar/settings', token, { method: 'PUT', body: JSON.stringify({ calendar_id: calendarId }) });
    if (res.ok) { flash('Ayarlar kaydedildi'); setSettingsOpen(false); loadInbox(months); }
    else flash('Kaydedilemedi', true);
  };

  const deleteAlias = async (id: number) => {
    const res = await api(`/admin/calendar/aliases/${id}`, token, { method: 'DELETE' });
    if (res.ok) { setAliases((a) => a.filter((x) => x.id !== id)); flash('Kısaltma silindi'); }
  };

  const openTotal = rides.reduce((s, r) => s + (Number(r.price) || 0), 0);
  const createdList = Object.entries(created);
  const thisMonth = currentMonth();

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 ${toast.error ? 'bg-red-600' : 'bg-green-600'} text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium max-w-sm`}>
          {toast.text}
        </div>
      )}

      {/* ── Kopf: Zusammenfassung ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CalendarDays size={20} className="text-primary-600" />
              Takvimden Rechnung
            </h2>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Google Takvim&apos;de <b>Ort</b> alanında <span className="font-mono text-gray-700">Rechnung</span> yazan ve henüz faturası kesilmemiş fahrt&apos;lar.
              {' '}<span className="font-mono text-gray-700">gön</span>, <span className="font-mono text-gray-700">ödendi</span>, <span className="font-mono text-gray-700">iptal</span> yazanlar gösterilmez.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
              title="Takvimde ne kadar geriye bakılsın"
            >
              {[2, 3, 4, 6, 12].map((m) => <option key={m} value={m}>Son {m} ay</option>)}
            </select>
            <button
              onClick={() => loadInbox(months)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Yenile
            </button>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-xl"
              title="Ayarlar"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {inbox && !loading && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Açık fahrt" value={String(rides.length)} tone={rides.length ? 'amber' : 'green'} />
            <Stat label="Faturalanacak" value={fmtEur(openTotal)} tone={rides.length ? 'amber' : 'green'} />
            <Stat label="Hazırlanacak fatura" value={String(groups.length)} />
            <Stat
              label="Taranan takvim"
              value={`${inbox.calendar_events} termin`}
              sub={`${monthLabel(inbox.window.from)} – ${monthLabel(inbox.window.to)} · ${new Date(inbox.fetched_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`}
            />
          </div>
        )}

        {settingsOpen && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Takvim ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  placeholder="ör. freisingtaxi@gmail.com"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                />
                <button onClick={saveSettings} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium">Kaydet</button>
              </div>
              {!saConfigured && (
                <p className="text-xs text-amber-700 mt-1">⚠ Sunucuda GOOGLE_SERVICE_ACCOUNT_JSON tanımlı değil — takvim okunamaz.</p>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Kayıtlı kısaltmalar (takvimde yazan → müşteri)</div>
              {aliases.length === 0 ? (
                <p className="text-xs text-gray-500">Henüz kısaltma yok.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {aliases.map((a) => (
                    <li key={a.id} className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 rounded-lg pl-2 pr-1 py-1">
                      <span className="font-mono font-medium text-gray-800">{a.alias}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-gray-600">{a.company_name || `Firma ${a.company_id}`}</span>
                      <button onClick={() => deleteAlias(a.id)} title="Sil" className="p-0.5 text-gray-400 hover:text-red-600"><X size={12} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {loading && !inbox && (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-sm text-gray-500">
          <RefreshCw size={22} className="animate-spin mx-auto mb-3 text-primary-600" />
          Google Takvim okunuyor…
        </div>
      )}

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>{loadError}</div>
        </div>
      )}

      {/* ── Eben erstellte Rechnungen: PDF + Versand ───────────────────── */}
      {createdList.map(([number, c]) => (
        <div key={number} className="bg-green-50 border border-green-200 rounded-2xl p-4 lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-green-600 text-white flex items-center justify-center shrink-0"><Check size={18} /></div>
              <div className="min-w-0">
                <div className="font-semibold text-gray-900">{number} oluşturuldu — {c.title}</div>
                <div className="text-sm text-gray-600">
                  {monthLabel(c.month)} · {c.rideCount} fahrt · <b>{fmtEur(Number(c.invoice.total))}</b> · Son ödeme {fmtDate(c.invoice.due_date)}
                  {c.company.created && <span className="ml-1 text-green-700">· yeni müşteri kaydedildi</span>}
                </div>
              </div>
            </div>
            <a
              href={`${API}/admin/companies/invoices/${c.invoice.id}/pdf?token=${token}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-green-200 text-green-800 rounded-xl text-sm font-medium hover:bg-green-100"
            >
              <Download size={15} /> PDF aç
            </a>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {sentTo[number] ? (
              <span className="flex items-center gap-1.5 text-sm text-green-800"><Send size={14} /> {sentTo[number]} adresine gönderildi</span>
            ) : (
              <>
                <input
                  type="email"
                  value={sendTo[number] || ''}
                  onChange={(e) => setSendTo((s) => ({ ...s, [number]: e.target.value }))}
                  placeholder="Müşterinin fatura e-postası"
                  className="flex-1 min-w-[220px] max-w-sm px-3 py-2 border border-green-200 rounded-xl text-sm bg-white"
                />
                <button
                  onClick={() => sendInvoice(number)}
                  disabled={busy[number] === 'send'}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  {busy[number] === 'send' ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />} E-posta ile gönder
                </button>
                <span className="text-xs text-gray-500">veya PDF&apos;i indirip kendin gönder — sonra B2B → Rechnungen&apos;de de duruyor.</span>
              </>
            )}
          </div>
        </div>
      ))}

      {/* ── Leerer Korb ─────────────────────────────────────────────────── */}
      {inbox && !loading && groups.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-3"><InboxIcon size={22} /></div>
          <div className="font-semibold text-gray-900">Açık fatura yok</div>
          <p className="text-sm text-gray-500 mt-1">
            Takvimde faturalanmamış &quot;Rechnung&quot; fahrt&apos;ı bulunamadı. Bir fahrt eksikse Google Takvim&apos;de Ort alanına <span className="font-mono">Rechnung</span> yazıp Yenile&apos;ye bas.
          </p>
        </div>
      )}

      {/* ── Gruppen: je Kunde + Monat eine Rechnung ─────────────────────── */}
      {groups.map((g) => {
        const inc = includedRides(g);
        const total = inc.reduce((s, r) => s + (Number(r.price) || 0), 0);
        const problems = groupProblems(g);
        const existing = g.companyId ? (inbox?.invoices || []).filter((i) => i.company_id === g.companyId && i.period_month === g.month) : [];
        const isNew = !g.companyId && g.customerKey.startsWith('n:');
        const isUnknown = g.customerKey === 'u';
        const nf = newForms[g.customerKey];
        const alias = aliasChoice[g.key];
        const b = busy[g.key];
        const company = g.companyId ? companiesById.get(g.companyId) : null;

        return (
          <div key={g.key} className={`bg-white rounded-2xl shadow-sm overflow-hidden border ${isUnknown ? 'border-amber-300' : isNew ? 'border-blue-200' : 'border-transparent'}`}>
            {/* Kopf */}
            <div className="px-4 lg:px-6 py-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {isNew ? <UserPlus size={18} className="text-blue-600" /> : isUnknown ? <AlertTriangle size={18} className="text-amber-600" /> : <Building2 size={18} className="text-primary-600" />}
                  <h3 className="font-semibold text-gray-900 text-base">{groupTitle(g)}</h3>
                  <span className="text-sm text-gray-500">· {monthLabel(g.month)}</span>
                  {isNew && <span className="text-[11px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Yeni müşteri</span>}
                  {g.month === thisMonth && <span className="text-[11px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Ay devam ediyor</span>}
                </div>
                {company && (company.address || company.invoice_email) && (
                  <div className="text-xs text-gray-500 mt-1">{[company.address, company.invoice_email && `✉ ${company.invoice_email}`].filter(Boolean).join(' · ')}</div>
                )}
                {existing.length > 0 && (
                  <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 inline-flex items-start gap-1.5">
                    <Info size={13} className="mt-px shrink-0" />
                    <span>Bu ay için {existing.map((i) => i.invoice_number).join(', ')} zaten kesilmiş — bu fahrt&apos;lar ek fatura (Nachtrag) olarak ayrı numarayla kesilir.</span>
                  </div>
                )}
              </div>
              <div className="text-right ml-auto">
                <div className="text-xl font-bold text-gray-900">{fmtEur(total)}</div>
                <div className="text-xs text-gray-500">{inc.length} / {g.rides.length} fahrt seçili</div>
              </div>
            </div>

            {/* Neuer / unbekannter Kunde */}
            {(isNew || isUnknown) && (
              <div className={`px-4 lg:px-6 py-4 ${isUnknown ? 'bg-amber-50/60' : 'bg-blue-50/50'} border-b border-gray-100 space-y-3`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-gray-700">Mevcut müşteriye ata:</span>
                  <select
                    value=""
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      if (id) g.rides.forEach((r) => updateRide(r.key, { customer: id }));
                    }}
                    className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">— seç —</option>
                    {(inbox?.companies || []).map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                  {isUnknown && (
                    <button
                      onClick={() => g.rides.forEach((r) => updateRide(r.key, { customer: 'new' }))}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <UserPlus size={14} /> Yeni müşteri
                    </button>
                  )}
                </div>
                {isNew && nf && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <Field label="Müşteri / Firma adı (faturada)">
                      <input value={nf.company_name} onChange={(e) => setNewForms((f) => ({ ...f, [g.customerKey]: { ...nf, company_name: e.target.value } }))} className={inputCls} />
                    </Field>
                    <Field label="Fatura adresi">
                      <input value={nf.address} onChange={(e) => setNewForms((f) => ({ ...f, [g.customerKey]: { ...nf, address: e.target.value } }))} placeholder="Sokak No, PLZ Şehir" className={inputCls} />
                    </Field>
                    <Field label="Yetkili kişi (opsiyonel)">
                      <input value={nf.contact_name} onChange={(e) => setNewForms((f) => ({ ...f, [g.customerKey]: { ...nf, contact_name: e.target.value } }))} className={inputCls} />
                    </Field>
                    <Field label="USt-IdNr. (opsiyonel)">
                      <input value={nf.ust_idnr} onChange={(e) => setNewForms((f) => ({ ...f, [g.customerKey]: { ...nf, ust_idnr: e.target.value } }))} className={inputCls} />
                    </Field>
                  </div>
                )}
              </div>
            )}

            {/* Fahrten */}
            <ul className="divide-y divide-gray-50">
              {g.rides.map((r) => (
                <RideRow
                  key={r.key}
                  ride={r}
                  edit={edits[r.key]}
                  included={!excluded.has(r.key)}
                  expanded={expanded.has(r.key) || (!excluded.has(r.key) && !rideValid(r))}
                  companies={inbox?.companies || []}
                  onToggleInclude={() => setExcluded((s) => toggle(s, r.key))}
                  onToggleExpand={() => setExpanded((s) => toggle(s, r.key))}
                  onChange={(patch) => updateRide(r.key, patch)}
                  onIgnore={() => ignoreRide(r)}
                />
              ))}
            </ul>

            {/* Fuß: Optionen + Aktionen */}
            <div className="px-4 lg:px-6 py-4 bg-gray-50/70 border-t border-gray-100 space-y-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                {alias?.offer && (
                  <label className="flex items-center gap-2 text-gray-700">
                    <input type="checkbox" checked={alias.save} onChange={(e) => setAliasChoice((a) => ({ ...a, [g.key]: { ...alias, save: e.target.checked } }))} />
                    Takvimde
                    <input
                      value={alias.text}
                      onChange={(e) => setAliasChoice((a) => ({ ...a, [g.key]: { ...alias, text: e.target.value } }))}
                      className="w-28 px-2 py-1 border border-gray-200 rounded-lg text-xs font-mono bg-white"
                    />
                    yazınca bu müşteriyi otomatik tanı
                  </label>
                )}
                <label className="flex items-center gap-2 text-gray-700">
                  Proje (opsiyonel):
                  <input
                    value={projects[g.key] || ''}
                    onChange={(e) => setProjects((p) => ({ ...p, [g.key]: e.target.value }))}
                    placeholder="faturada adresin altında"
                    className="w-44 px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white"
                  />
                </label>
              </div>

              {groupError[g.key] && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{groupError[g.key]}</div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                {problems.length > 0 && <span className="text-xs text-amber-700 mr-auto">⚠ {problems.join(' · ')}</span>}
                {problems.length === 0 && g.month === thisMonth && (
                  <span className="text-xs text-gray-500 mr-auto">Ay henüz bitmedi — aylık toplu fatura istiyorsan ay sonunu bekleyebilirsin.</span>
                )}
                <button
                  onClick={() => preview(g)}
                  disabled={!!b || problems.length > 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
                >
                  {b === 'preview' ? <RefreshCw size={15} className="animate-spin" /> : <Eye size={15} />} Önizleme
                </button>
                <button
                  onClick={() => createInvoice(g)}
                  disabled={!!b || problems.length > 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40"
                >
                  {b === 'create' ? <RefreshCw size={15} className="animate-spin" /> : <FileText size={15} />}
                  Rechnung oluştur · {fmtEur(total)}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Erledigt / ausgeblendet ─────────────────────────────────────── */}
      {inbox && (inbox.done.length > 0 || inbox.ignored.length > 0) && (
        <div className="bg-white rounded-2xl shadow-sm">
          <button onClick={() => setShowDone(!showDone)} className="w-full px-4 lg:px-6 py-3.5 flex items-center justify-between text-sm font-medium text-gray-700">
            <span className="flex items-center gap-2">
              <Check size={16} className="text-green-600" />
              Faturalanmış fahrt&apos;lar ({inbox.done.length}){inbox.ignored.length > 0 && ` · gizlenen (${inbox.ignored.length})`}
            </span>
            {showDone ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showDone && (
            <div className="px-4 lg:px-6 pb-5 space-y-4">
              {inbox.done.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="py-2 pr-3 font-medium">Tarih</th>
                        <th className="py-2 pr-3 font-medium">Müşteri</th>
                        <th className="py-2 pr-3 font-medium">Güzergah</th>
                        <th className="py-2 pr-3 font-medium text-right">Fiyat</th>
                        <th className="py-2 font-medium">Fatura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inbox.done.map((d) => (
                        <tr key={d.booking_id} className="border-b border-gray-50">
                          <td className="py-2 pr-3 whitespace-nowrap text-gray-600">{fmtDateTime(d.pickup_datetime)}</td>
                          <td className="py-2 pr-3 text-gray-800">{(d.company_id && companiesById.get(d.company_id)?.company_name) || '—'}</td>
                          <td className="py-2 pr-3 text-gray-600 max-w-[340px] truncate" title={`${d.pickup_address} → ${d.dropoff_address}`}>{d.pickup_address} → {d.dropoff_address}</td>
                          <td className="py-2 pr-3 text-right whitespace-nowrap">{fmtEur(d.price)}</td>
                          <td className="py-2 whitespace-nowrap">
                            {d.invoice ? (
                              <a href={`${API}/admin/companies/invoices/${d.invoice.invoice_id}/pdf?token=${token}`} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                                {d.invoice.invoice_number}
                              </a>
                            ) : <span className="text-amber-700">faturasız</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {inbox.ignored.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1.5">Gizlenenler (sistem üzerinden faturalanmayacak)</div>
                  <ul className="space-y-1">
                    {inbox.ignored.map((i) => (
                      <li key={i.uid} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="whitespace-nowrap">{fmtDateTime(i.pickup_datetime)}</span>
                        <span className="truncate">{i.summary} · <span className="font-mono text-xs">{i.location}</span></span>
                        <button onClick={() => restoreRide(i.uid)} className="ml-auto flex items-center gap-1 text-xs text-primary-600 hover:underline shrink-0"><Undo2 size={12} /> geri al</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Einzelne Fahrt ──────────────────────────────────────────────────────────

const inputCls = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'amber' | 'green' }) {
  const color = tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-green-700' : 'text-gray-900';
  return (
    <div className="bg-gray-50 rounded-xl px-3.5 py-2.5">
      <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 truncate">{sub}</div>}
    </div>
  );
}

function RideRow({
  ride: r, edit, included, expanded, companies, onToggleInclude, onToggleExpand, onChange, onIgnore,
}: {
  ride: Ride;
  edit: RideEdit | undefined;
  included: boolean;
  expanded: boolean;
  companies: Company[];
  onToggleInclude: () => void;
  onToggleExpand: () => void;
  onChange: (patch: RideEdit) => void;
  onIgnore: () => void;
}) {
  const valid = rideValid(r);
  const warnings = activeWarnings(r, edit);
  const readOnly = r.kind === 'booking';
  const customerValue = edit?.customer !== undefined
    ? String(edit.customer ?? '')
    : r.company_id ? String(r.company_id) : r.billing ? 'new' : '';

  return (
    <li className={`px-4 lg:px-6 py-3 ${included ? '' : 'opacity-50'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={included} onChange={onToggleInclude} className="mt-1.5 shrink-0" title="Bu faturaya dahil et" />
        <button onClick={onToggleExpand} className="flex-1 min-w-0 text-left">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-sm font-medium text-gray-900 whitespace-nowrap">{fmtDateTime(r.pickup_datetime)}</span>
            <span className="text-sm text-gray-700 min-w-0">
              {r.pickup_address || <span className="text-amber-700">Nereden?</span>}
              <span className="text-gray-400 mx-1.5">→</span>
              {r.dropoff_address || <span className="text-amber-700">Nereye?</span>}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
            {r.guest_name && <span>Yolcu: <span className="text-gray-700">{r.guest_name}</span></span>}
            {r.kind === 'booking' && r.booking_number && <span className="font-mono">{r.booking_number}</span>}
            {r.kind === 'calendar' && <span className="font-mono text-gray-400 truncate max-w-[260px]" title={r.location}>Ort: {r.location}</span>}
          </div>
          {warnings.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {warnings.map((w) => (
                <span key={w} className={`text-[11px] leading-snug px-2 py-0.5 rounded-md ${['price_missing', 'route_missing', 'customer_missing', 'price_conflict', 'hr', 'stopover_mwst', 'no_distance', 'mwst_borderline'].includes(w) ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>
                  {(WARNING_TEXT[w] || (() => w))(r)}
                </span>
              ))}
            </div>
          )}
        </button>
        <div className="text-right shrink-0">
          <div className={`text-sm font-semibold ${Number(r.price) > 0 ? 'text-gray-900' : 'text-amber-700'}`}>{Number(r.price) > 0 ? fmtEur(Number(r.price)) : '— €'}</div>
          <div className="text-[11px] text-gray-500" title={r.mwst_source === 'distance' ? 'Mesafeye göre: 50 km\'ye kadar %7, üstü %19' : undefined}>
            MwSt {r.steuersatz}%{r.mwst_source === 'distance' && r.distance_km !== null ? ` · ${String(r.distance_km).replace('.', ',')} km` : r.mwst_source === 'default' ? ' · varsayılan' : ''}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={onToggleExpand} className={`p-1.5 rounded-lg ${expanded ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`} title="Düzenle / takvim metnini gör">
            {valid ? <Pencil size={14} /> : <AlertTriangle size={14} className="text-amber-600" />}
          </button>
          {r.kind === 'calendar' && (
            <button onClick={onIgnore} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Listeden çıkar (bu fahrt sistem üzerinden faturalanmayacak)">
              <EyeOff size={14} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 ml-7 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-2.5 content-start">
            <Field label="Tarih / saat">
              <input type="datetime-local" value={r.pickup_datetime || ''} disabled={readOnly} onChange={(e) => onChange({ pickup_datetime: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Yolcu (faturada Gast)">
              <input value={r.guest_name || ''} disabled={readOnly} onChange={(e) => onChange({ guest_name: e.target.value })} className={inputCls} />
            </Field>
            <div className="col-span-2">
              <Field label="Nereden">
                <input value={r.pickup_address || ''} disabled={readOnly} onChange={(e) => onChange({ pickup_address: e.target.value })} className={`${inputCls} ${!r.pickup_address?.trim() ? 'border-amber-400' : ''}`} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Nereye">
                <input value={r.dropoff_address || ''} disabled={readOnly} onChange={(e) => onChange({ dropoff_address: e.target.value })} className={`${inputCls} ${!r.dropoff_address?.trim() ? 'border-amber-400' : ''}`} />
              </Field>
            </div>
            <Field label="Fiyat € (brüt)">
              <input
                type="number" step="0.01" min="0"
                value={r.price ?? ''}
                disabled={readOnly}
                onChange={(e) => onChange({ price: e.target.value === '' ? null : Number(e.target.value) })}
                className={`${inputCls} ${!(Number(r.price) > 0) ? 'border-amber-400' : ''}`}
              />
            </Field>
            <Field label="MwSt">
              <select value={r.steuersatz} disabled={readOnly} onChange={(e) => onChange({ steuersatz: Number(e.target.value) })} className={inputCls}>
                <option value={7}>7% (≤ 50 km)</option>
                <option value={19}>19% (&gt; 50 km)</option>
                <option value={0}>0%</option>
              </select>
            </Field>
            {!readOnly && (
              <div className="col-span-2">
                <Field label="Müşteri">
                  <select
                    value={customerValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      onChange({ customer: v === 'new' ? 'new' : v ? Number(v) : null });
                    }}
                    className={inputCls}
                  >
                    <option value="">— seçilmedi —</option>
                    {r.billing && <option value="new">Yeni müşteri: {r.billing.name}</option>}
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </Field>
              </div>
            )}
            {r.price_source && <p className="col-span-2 text-[11px] text-gray-500">Fiyat kaynağı: {r.price_source}{r.price_note ? ` · ${r.price_note}` : ''}</p>}
          </div>

          {r.kind === 'calendar' ? (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-500 uppercase tracking-wide text-[11px]">Takvim kaydı</span>
                {r.html_link && (
                  <a href={r.html_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline">
                    Google Takvim&apos;de aç <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <div className="space-y-1">
                <div><span className="text-gray-400">Başlık:</span> {r.summary || '—'}</div>
                <div><span className="text-gray-400">Ort:</span> <span className="font-mono">{r.location || '—'}</span></div>
              </div>
              {r.description && (
                <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[11.5px] leading-relaxed max-h-64 overflow-y-auto bg-white border border-gray-100 rounded-lg p-2.5">{r.description}</pre>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-600">
              Bu fahrt sistemde kayıtlı ({r.booking_number}) ama henüz bir faturaya eklenmemiş. Değiştirmek için Buchungen sekmesini kullan.
            </div>
          )}
        </div>
      )}
    </li>
  );
}
