'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CalendarDays, Upload, RefreshCw, Settings, Check, AlertTriangle,
  FileText, Send, X, CloudDownload,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface Company {
  id: number;
  company_name: string;
}

interface Draft {
  uid: string;
  pickup_datetime: string | null;
  company_id: number | null;
  company_match: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  price: number | null;
  steuersatz: number | null;
  raw_summary: string;
  raw_description: string;
  parse_ok: boolean;
  already_imported: boolean;
}

interface Row extends Draft {
  include: boolean;
  save_alias: boolean;
  alias_text: string;
}

interface SrResult {
  company: string;
  status: 'created' | 'exists' | 'empty' | 'error';
  detail?: string;
}

interface Alias {
  id: number;
  alias: string;
  company_id: number;
  company_name: string | null;
}

async function api(path: string, token: string, opts?: RequestInit) {
  return fetch(`${API}/admin/calendar${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts?.headers },
  });
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// Vorschlag für Alias: erster Abschnitt des Titels (vor Trenner)
function suggestAlias(summary: string): string {
  return summary.split(/\s*(?:→|->|=>|-|,|;|\d{1,2}:\d{2})\s*/)[0].trim().slice(0, 60);
}

function rowValid(r: Row): boolean {
  return !!(
    r.company_id &&
    r.pickup_datetime &&
    Number(r.price) > 0 &&
    r.pickup_address?.trim() &&
    r.dropoff_address?.trim()
  );
}

export default function KalenderTab({ token }: { token: string }) {
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgError, setMsgError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calendarId, setCalendarId] = useState('');
  const [saConfigured, setSaConfigured] = useState(false);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sammelrechnung-Panel
  const [srMonth, setSrMonth] = useState(currentMonth());
  const [srMwst, setSrMwst] = useState(7);
  const [srSendEmail, setSrSendEmail] = useState(true);
  const [srRunning, setSrRunning] = useState(false);
  const [srResults, setSrResults] = useState<SrResult[]>([]);

  const flash = (m: string, isError = false) => {
    setMsg(m); setMsgError(isError);
    setTimeout(() => setMsg(''), 5000);
  };

  const loadSettings = useCallback(async () => {
    try {
      const res = await api('/settings', token);
      if (res.ok) {
        const d = await res.json();
        setCalendarId(d.calendar_id || '');
        setSaConfigured(!!d.service_account_configured);
      }
    } catch (e) { console.error(e); }
  }, [token]);

  const loadAliases = useCallback(async () => {
    try {
      const res = await api('/aliases', token);
      if (res.ok) setAliases(await res.json());
    } catch (e) { console.error(e); }
  }, [token]);

  useEffect(() => { loadSettings(); loadAliases(); }, [loadSettings, loadAliases]);

  const deleteAlias = async (id: number) => {
    const res = await api(`/aliases/${id}`, token, { method: 'DELETE' });
    if (res.ok) { flash('Alias gelöscht'); loadAliases(); }
  };

  const toRows = (drafts: Draft[]): Row[] =>
    drafts.map((d) => ({
      ...d,
      include: !d.already_imported && d.parse_ok,
      save_alias: false,
      alias_text: suggestAlias(d.raw_summary),
    }));

  const applyResponse = async (res: globalThis.Response) => {
    if (!res.ok) {
      const d = await res.json().catch(() => ({} as any));
      flash(d.error || 'Fehler beim Laden', true);
      return;
    }
    const d = await res.json();
    setCompanies(d.companies || []);
    setRows(toRows(d.drafts || []));
    if ((d.drafts || []).length === 0) flash('Keine Termine im gewählten Monat gefunden', true);
  };

  const loadFromGoogle = async () => {
    setLoading(true);
    try {
      await applyResponse(await api(`/events?month=${month}`, token));
    } catch (e: any) {
      flash(e.message || 'Fehler', true);
    }
    setLoading(false);
  };

  const handleIcsFile = async (file: File) => {
    setLoading(true);
    try {
      const icsContent = await file.text();
      await applyResponse(await api('/parse-ics', token, {
        method: 'POST',
        body: JSON.stringify({ icsContent, month }),
      }));
    } catch (e: any) {
      flash(e.message || 'Fehler', true);
    }
    setLoading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const saveSettings = async () => {
    const res = await api('/settings', token, { method: 'PUT', body: JSON.stringify({ calendar_id: calendarId }) });
    if (res.ok) { flash('Einstellungen gespeichert'); setSettingsOpen(false); }
    else flash('Speichern fehlgeschlagen', true);
  };

  const updateRow = (uid: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  };

  const included = rows.filter((r) => r.include && !r.already_imported);
  const invalidCount = included.filter((r) => !rowValid(r)).length;

  const handleImport = async () => {
    if (included.length === 0 || invalidCount > 0) return;
    setImporting(true);
    try {
      const res = await api('/import', token, {
        method: 'POST',
        body: JSON.stringify({
          rides: included.map((r) => ({
            uid: r.uid,
            pickup_datetime: r.pickup_datetime,
            company_id: r.company_id,
            pickup_address: r.pickup_address,
            dropoff_address: r.dropoff_address,
            price: Number(r.price),
            steuersatz: r.steuersatz ?? 7,
            notes: r.raw_summary || null,
            save_alias: r.save_alias,
            alias_text: r.alias_text,
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) { flash(d.error || 'Import fehlgeschlagen', true); }
      else {
        flash(`${d.imported} Fahrten importiert${d.skipped_duplicates ? `, ${d.skipped_duplicates} Duplikate übersprungen` : ''}${d.errors?.length ? `, ${d.errors.length} Fehler` : ''}`, !!d.errors?.length);
        const importedUids = new Set(included.map((r) => r.uid));
        setRows((prev) => prev.map((r) =>
          importedUids.has(r.uid) && !d.errors?.some((e: any) => e.uid === r.uid)
            ? { ...r, already_imported: true, include: false }
            : r
        ));
      }
    } catch (e: any) {
      flash(e.message || 'Import fehlgeschlagen', true);
    }
    setImporting(false);
  };

  // Alle Sammelrechnungen für einen Monat: bestehenden Endpoint je Firma aufrufen
  const runSammelrechnungen = async () => {
    if (companies.length === 0) {
      // Firmenliste ggf. nachladen (z.B. wenn noch nichts importiert wurde)
      const res = await fetch(`${API}/admin/companies`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const all = await res.json();
        const active = all.filter((c: any) => c.status === 'active');
        setCompanies(active.map((c: any) => ({ id: c.id, company_name: c.company_name })));
        if (active.length === 0) { flash('Keine aktiven Firmen gefunden', true); return; }
        await runForCompanies(active);
        return;
      }
      flash('Firmen konnten nicht geladen werden', true);
      return;
    }
    await runForCompanies(companies);
  };

  const runForCompanies = async (list: Company[]) => {
    setSrRunning(true);
    setSrResults([]);
    const results: SrResult[] = [];
    for (const c of list) {
      try {
        const res = await fetch(`${API}/admin/companies/${c.id}/sammelrechnung`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ month: srMonth, mwst_satz: srMwst, send_email: srSendEmail }),
        });
        if (res.ok) results.push({ company: c.company_name, status: 'created' });
        else if (res.status === 409) results.push({ company: c.company_name, status: 'exists' });
        else if (res.status === 400) results.push({ company: c.company_name, status: 'empty' });
        else {
          const d = await res.json().catch(() => ({} as any));
          results.push({ company: c.company_name, status: 'error', detail: d.error });
        }
      } catch (e: any) {
        results.push({ company: c.company_name, status: 'error', detail: e.message });
      }
      setSrResults([...results]);
    }
    setSrRunning(false);
    const created = results.filter((r) => r.status === 'created').length;
    flash(`${created} Sammelrechnung${created === 1 ? '' : 'en'} erstellt`);
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`fixed top-4 right-4 z-50 ${msgError ? 'bg-red-600' : 'bg-green-600'} text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium`}>
          {msg}
        </div>
      )}

      {/* Quelle: Google Calendar / ICS */}
      <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CalendarDays size={20} className="text-primary-600" />
            Kalender-Import
          </h2>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <Settings size={16} /> Einstellungen
          </button>
        </div>

        {settingsOpen && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Kalender-ID</label>
              <input
                type="text"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder="z.B. info@flughafen-muenchen.taxi oder abc123@group.calendar.google.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${saConfigured ? 'text-green-600' : 'text-amber-600'}`}>
                {saConfigured
                  ? '✓ Service-Account konfiguriert'
                  : '⚠ GOOGLE_SERVICE_ACCOUNT_JSON fehlt auf dem Server — nur ICS-Upload möglich'}
              </span>
              <button onClick={saveSettings} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium">
                Speichern
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <button
            onClick={loadFromGoogle}
            disabled={loading || !saConfigured}
            title={!saConfigured ? 'Service-Account nicht konfiguriert' : undefined}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium disabled:opacity-40"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <CloudDownload size={16} />}
            Von Google laden
          </button>
          <label className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
            <Upload size={16} />
            ICS-Datei hochladen
            <input
              ref={fileRef}
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleIcsFile(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      {/* Review-Tabelle */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-gray-900">
              {rows.length} Termine — {included.length} zum Import ausgewählt
              {invalidCount > 0 && (
                <span className="ml-2 text-amber-600 text-sm font-normal">
                  ({invalidCount} unvollständig)
                </span>
              )}
            </h3>
            <button
              onClick={handleImport}
              disabled={importing || included.length === 0 || invalidCount > 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium disabled:opacity-40"
            >
              {importing ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
              {included.length} Fahrten importieren
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-2 w-8"></th>
                  <th className="py-2 pr-3">Datum</th>
                  <th className="py-2 pr-3">Termin</th>
                  <th className="py-2 pr-3">Firma</th>
                  <th className="py-2 pr-3">Von</th>
                  <th className="py-2 pr-3">Nach</th>
                  <th className="py-2 pr-3 w-24">Preis €</th>
                  <th className="py-2 pr-3 w-20">MwSt</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const valid = rowValid(r);
                  const disabled = r.already_imported;
                  return (
                    <tr
                      key={r.uid}
                      className={`border-b border-gray-50 align-top ${disabled ? 'opacity-45' : ''} ${!disabled && r.include && !valid ? 'bg-amber-50' : ''}`}
                    >
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={r.include && !disabled}
                          disabled={disabled}
                          onChange={(e) => updateRow(r.uid, { include: e.target.checked })}
                        />
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <input
                          type="datetime-local"
                          value={r.pickup_datetime || ''}
                          disabled={disabled}
                          onChange={(e) => updateRow(r.uid, { pickup_datetime: e.target.value })}
                          className="px-2 py-1 border border-gray-200 rounded-lg text-xs w-[165px]"
                        />
                      </td>
                      <td className="py-2 pr-3 max-w-[180px]">
                        <span title={r.raw_description || r.raw_summary} className="block truncate text-gray-700">
                          {r.raw_summary || '—'}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={r.company_id ?? ''}
                          disabled={disabled}
                          onChange={(e) => updateRow(r.uid, { company_id: e.target.value ? Number(e.target.value) : null })}
                          className="px-2 py-1 border border-gray-200 rounded-lg text-xs max-w-[160px]"
                        >
                          <option value="">— wählen —</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>{c.company_name}</option>
                          ))}
                        </select>
                        {!disabled && r.company_id && !r.company_match && (
                          <label className="flex items-center gap-1 mt-1 text-[11px] text-gray-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={r.save_alias}
                              onChange={(e) => updateRow(r.uid, { save_alias: e.target.checked })}
                            />
                            Alias speichern
                            {r.save_alias && (
                              <input
                                type="text"
                                value={r.alias_text}
                                onChange={(e) => updateRow(r.uid, { alias_text: e.target.value })}
                                className="px-1.5 py-0.5 border border-gray-200 rounded text-[11px] w-24"
                              />
                            )}
                          </label>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="text"
                          value={r.pickup_address || ''}
                          disabled={disabled}
                          onChange={(e) => updateRow(r.uid, { pickup_address: e.target.value })}
                          className="px-2 py-1 border border-gray-200 rounded-lg text-xs w-[150px]"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="text"
                          value={r.dropoff_address || ''}
                          disabled={disabled}
                          onChange={(e) => updateRow(r.uid, { dropoff_address: e.target.value })}
                          className="px-2 py-1 border border-gray-200 rounded-lg text-xs w-[150px]"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={r.price ?? ''}
                          disabled={disabled}
                          onChange={(e) => updateRow(r.uid, { price: e.target.value === '' ? null : Number(e.target.value) })}
                          className="px-2 py-1 border border-gray-200 rounded-lg text-xs w-20"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={r.steuersatz ?? 7}
                          disabled={disabled}
                          onChange={(e) => updateRow(r.uid, { steuersatz: Number(e.target.value) })}
                          className="px-2 py-1 border border-gray-200 rounded-lg text-xs"
                        >
                          <option value={0}>0%</option>
                          <option value={7}>7%</option>
                          <option value={19}>19%</option>
                        </select>
                      </td>
                      <td className="py-2">
                        {disabled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[11px]">
                            <Check size={11} /> Bereits importiert
                          </span>
                        ) : valid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[11px]">
                            <Check size={11} /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[11px]">
                            <AlertTriangle size={11} /> Prüfen
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sammelrechnungen erstellen */}
      <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <FileText size={18} className="text-primary-600" />
          Sammelrechnungen erstellen
        </h3>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="month"
            value={srMonth}
            onChange={(e) => setSrMonth(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <select
            value={srMwst}
            onChange={(e) => setSrMwst(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value={0}>0% MwSt</option>
            <option value={7}>7% MwSt</option>
            <option value={19}>19% MwSt</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-700">
            <input type="checkbox" checked={srSendEmail} onChange={(e) => setSrSendEmail(e.target.checked)} />
            Per E-Mail senden
          </label>
          <button
            onClick={runSammelrechnungen}
            disabled={srRunning}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium disabled:opacity-40"
          >
            {srRunning ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            Alle Sammelrechnungen erstellen
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Erstellt für jede aktive Firma mit Fahrten im gewählten Monat eine Sammelrechnung.
          Bereits vorhandene Rechnungen werden übersprungen.
        </p>
        {srResults.length > 0 && (
          <ul className="space-y-1 text-sm">
            {srResults.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                {r.status === 'created' && <Check size={14} className="text-green-600" />}
                {r.status === 'exists' && <FileText size={14} className="text-gray-400" />}
                {r.status === 'empty' && <X size={14} className="text-gray-300" />}
                {r.status === 'error' && <AlertTriangle size={14} className="text-red-500" />}
                <span className="text-gray-800">{r.company}</span>
                <span className="text-gray-400 text-xs">
                  {r.status === 'created' && 'erstellt'}
                  {r.status === 'exists' && 'existiert bereits'}
                  {r.status === 'empty' && 'keine Fahrten'}
                  {r.status === 'error' && (r.detail || 'Fehler')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
