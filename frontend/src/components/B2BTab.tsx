'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, FileText, Settings, Check, X, Send, Download, ChevronDown, ChevronUp, Users, RefreshCw, AlertTriangle, Clock, CreditCard, Banknote, Receipt, Mail, Pencil, Trash2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface Company {
  id: number; company_name: string; contact_name: string; email: string; phone: string;
  address: string; ust_idnr: string; message: string; discount_percent: number;
  allowed_payment_methods: string; pg_discount_override: number; discount_kombinierbar: number;
  payment_term_days: number; status: string; created_at: string;
  charge_mode?: 'manual' | 'on_confirm' | 'on_completion';
  card_brand?: string; card_last4?: string;
  user_count?: number; booking_count?: number; users?: any[];
}

interface Invoice {
  id: number; company_id: number; invoice_number: string; period_month: string;
  mwst_satz: number; total: number; due_date: string; status: string;
  reminder_level: number; reminder_sent_at: string; mahngebuehr: number;
  company_name?: string; created_at: string; manual_sent_at?: string | null;
}

interface InvoiceBookingRow {
  id: number; pickup_datetime: string; pickup_address: string; dropoff_address: string;
  name: string; price: number; steuersatz: number; source: string | null;
}

async function api(path: string, token: string, opts?: RequestInit) {
  const res = await fetch(`${API}/admin/companies${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  return res;
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date(new Date().toISOString().split('T')[0]);
}

export default function B2BTab({ token }: { token: string }) {
  const [section, setSection] = useState<'firmen' | 'rechnungen' | 'einstellungen'>('firmen');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedCompany, setExpandedCompany] = useState<number | null>(null);
  const [approveModal, setApproveModal] = useState<Company | null>(null);
  const [editModal, setEditModal] = useState<Company | null>(null);
  const [srModal, setSrModal] = useState<{ companyId: number; companyName: string } | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'open' | 'overdue' | 'paid'>('all');
  const [mahnModal, setMahnModal] = useState<{ invoice: Invoice; mahngebuehr: string } | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [applicationsEnabled, setApplicationsEnabled] = useState(true);
  const [msg, setMsg] = useState('');
  const [newFirmaModal, setNewFirmaModal] = useState(false);
  const [newFirma, setNewFirma] = useState({ company_name: '', contact_name: '', email: '', phone: '', address: '', city: '', zip: '' });
  const [newFirmaLoading, setNewFirmaLoading] = useState(false);
  const [sendModal, setSendModal] = useState<Invoice | null>(null);
  const [invoiceEditModal, setInvoiceEditModal] = useState<Invoice | null>(null);
  const [invoiceEditRows, setInvoiceEditRows] = useState<InvoiceBookingRow[]>([]);
  const [invoiceEditDueDate, setInvoiceEditDueDate] = useState('');
  const [invoiceEditProjectName, setInvoiceEditProjectName] = useState('');
  const [invoiceEditLoading, setInvoiceEditLoading] = useState(false);
  const [invoiceEditSaving, setInvoiceEditSaving] = useState(false);
  const [sendEmailAddr, setSendEmailAddr] = useState('');
  const [sendLoading, setSendLoading] = useState(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('', token);
      if (res.ok) setCompanies(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token]);

  const loadInvoices = useCallback(async () => {
    try {
      const q = invoiceFilter !== 'all' ? `?status=${invoiceFilter}` : '';
      const res = await api(`/invoices/all${q}`, token);
      if (res.ok) setInvoices(await res.json());
    } catch (e) { console.error(e); }
  }, [token, invoiceFilter]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API}/settings`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setTrackingEnabled(d.portal_tracking_enabled !== '0');
        setApplicationsEnabled(d.b2b_applications_enabled !== '0');
      }
    } catch (e) { console.error(e); }
  }, [token]);

  async function openInvoiceEdit(inv: Invoice) {
    setInvoiceEditModal(inv);
    setInvoiceEditLoading(true);
    try {
      const res = await api(`/invoices/${inv.id}/bookings`, token);
      if (res.ok) {
        const d = await res.json();
        setInvoiceEditRows(d.bookings.map((b: InvoiceBookingRow) => ({ ...b, pickup_datetime: b.pickup_datetime?.slice(0, 16) || '' })));
        setInvoiceEditDueDate(d.due_date ? String(d.due_date).slice(0, 10) : '');
        setInvoiceEditProjectName(d.project_name || '');
      } else {
        alert('Positionen konnten nicht geladen werden');
        setInvoiceEditModal(null);
      }
    } catch (e) { alert('Netzwerkfehler'); setInvoiceEditModal(null); }
    setInvoiceEditLoading(false);
  }

  function updateInvoiceEditRow(id: number, patch: Partial<InvoiceBookingRow>) {
    setInvoiceEditRows(rows => rows.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function removeInvoiceEditRow(id: number) {
    setInvoiceEditRows(rows => rows.filter(r => r.id !== id));
  }

  async function saveInvoiceEdit() {
    if (!invoiceEditModal) return;
    setInvoiceEditSaving(true);
    try {
      const res = await api(`/invoices/${invoiceEditModal.id}/details`, token, {
        method: 'PUT',
        body: JSON.stringify({ due_date: invoiceEditDueDate, project_name: invoiceEditProjectName, bookings: invoiceEditRows }),
      });
      const d = await res.json();
      if (res.ok) {
        setInvoices(list => list.map(i => i.id === invoiceEditModal.id ? { ...i, total: d.total, due_date: invoiceEditDueDate } : i));
        setInvoiceEditModal(null);
        flash('Rechnung aktualisiert');
      } else {
        alert(d.error || 'Fehler beim Speichern');
      }
    } catch (e) { alert('Netzwerkfehler'); }
    setInvoiceEditSaving(false);
  }

  async function handleSendInvoice() {
    if (!sendModal || !sendEmailAddr.trim()) return;
    setSendLoading(true);
    try {
      const res = await api(`/invoices/${sendModal.id}/send`, token, {
        method: 'POST', body: JSON.stringify({ email: sendEmailAddr.trim() }),
      });
      const d = await res.json();
      if (res.ok) {
        setInvoices(list => list.map(i => i.id === sendModal.id ? { ...i, manual_sent_at: new Date().toISOString() } : i));
        setSendModal(null);
        setSendEmailAddr('');
        flash('Rechnung per E-Mail gesendet');
      } else {
        alert(d.error || 'Fehler beim Senden');
      }
    } catch (e) { alert('Netzwerkfehler'); }
    setSendLoading(false);
  }

  async function handleCreateFirma() {
    if (!newFirma.company_name.trim()) return;
    setNewFirmaLoading(true);
    try {
      const res = await api('/direct', token, { method: 'POST', body: JSON.stringify(newFirma) });
      if (res.ok) {
        setNewFirmaModal(false);
        setNewFirma({ company_name: '', contact_name: '', email: '', phone: '', address: '', city: '', zip: '' });
        setMsg('Firma angelegt.');
        setTimeout(() => setMsg(''), 3000);
        loadCompanies();
      } else {
        const d = await res.json();
        alert(d.error || 'Fehler');
      }
    } catch (e) { alert('Netzwerkfehler'); }
    setNewFirmaLoading(false);
  }

  useEffect(() => {
    loadCompanies();
    loadInvoices();
    loadSettings();
  }, [loadCompanies, loadInvoices, loadSettings]);

  useEffect(() => { loadInvoices(); }, [invoiceFilter, loadInvoices]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleApprove = async (c: Company, payMethods: string, discount: number) => {
    const res = await api(`/${c.id}/approve`, token, {
      method: 'POST', body: JSON.stringify({ allowed_payment_methods: payMethods, discount_percent: discount }),
    });
    if (res.ok) { flash(`${c.company_name} freigeschaltet`); setApproveModal(null); loadCompanies(); }
    else { const data = await res.json().catch(() => ({})); flash(data.error || 'Freischalten fehlgeschlagen'); }
  };

  const handleReject = async (id: number) => {
    await api(`/${id}/reject`, token, { method: 'POST' });
    flash('Anfrage abgelehnt'); loadCompanies();
  };

  const handleUpdateCompany = async (c: Company) => {
    const res = await api(`/${c.id}`, token, { method: 'PUT', body: JSON.stringify(c) });
    if (res.ok) { flash('Gespeichert'); setEditModal(null); loadCompanies(); }
  };

  const handleCreateSR = async (companyId: number, month: string, mwst: number, sendEmail: boolean, projectName: string) => {
    const res = await api(`/${companyId}/sammelrechnung`, token, {
      method: 'POST', body: JSON.stringify({ month, mwst_satz: mwst, send_email: sendEmail, project_name: projectName }),
    });
    if (res.ok) { flash('Sammelrechnung erstellt'); setSrModal(null); loadInvoices(); }
    else { const d = await res.json(); flash(d.error || 'Fehler'); }
  };

  const handleRemind = async (invoiceId: number, mahngebuehr?: number) => {
    const res = await api(`/invoices/${invoiceId}/remind`, token, {
      method: 'POST', body: JSON.stringify({ mahngebuehr }),
    });
    if (res.ok) { flash('Erinnerung gesendet'); setMahnModal(null); loadInvoices(); }
    else { const d = await res.json(); flash(d.error || 'Fehler'); }
  };

  const handleMarkPaid = async (invoiceId: number) => {
    await api(`/invoices/${invoiceId}`, token, { method: 'PUT', body: JSON.stringify({ status: 'paid' }) });
    flash('Als bezahlt markiert'); loadInvoices();
  };

  const handleDeleteInvoice = async (invoiceId: number) => {
    if (!confirm('Rechnung wirklich löschen?')) return;
    await api(`/invoices/${invoiceId}`, token, { method: 'DELETE' });
    flash('Rechnung gelöscht'); loadInvoices();
  };

  const toggleTracking = async () => {
    const newVal = trackingEnabled ? '0' : '1';
    await fetch(`${API}/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ portal_tracking_enabled: newVal }),
    });
    setTrackingEnabled(!trackingEnabled);
    flash(`Tracking ${newVal === '1' ? 'aktiviert' : 'deaktiviert'}`);
  };

  const toggleApplications = async () => {
    const newVal = applicationsEnabled ? '0' : '1';
    await fetch(`${API}/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ b2b_applications_enabled: newVal }),
    });
    setApplicationsEnabled(!applicationsEnabled);
    flash(`Neue Firmenanmeldungen ${newVal === '1' ? 'aktiviert' : 'deaktiviert'}`);
  };

  const pending = companies.filter(c => c.status === 'pending');
  const active = companies.filter(c => c.status === 'active');
  const other = companies.filter(c => !['pending', 'active'].includes(c.status));

  return (
    <div className="space-y-6">
      {msg && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium animate-in fade-in">
          {msg}
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-2">
        {[
          { id: 'firmen' as const, icon: Building2, label: 'Firmen' },
          { id: 'rechnungen' as const, icon: FileText, label: 'Rechnungen' },
          { id: 'einstellungen' as const, icon: Settings, label: 'Einstellungen' },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setSection(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${section === id ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* ═══ FIRMEN ═══ */}
      {section === 'firmen' && (
        <div className="space-y-6">
          {/* Pending */}
          {pending.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                <AlertTriangle size={16} /> {pending.length} Ausstehende Anfrage{pending.length > 1 ? 'n' : ''}
              </h3>
              <div className="space-y-3">
                {pending.map(c => (
                  <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{c.company_name}</p>
                      <p className="text-sm text-gray-500">{c.contact_name} · {c.email} · {c.phone}</p>
                      {c.message && <p className="text-xs text-gray-400 mt-1">{c.message}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setApproveModal(c)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-1">
                        <Check size={14} /> Freischalten
                      </button>
                      <button onClick={() => handleReject(c.id)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 flex items-center gap-1">
                        <X size={14} /> Ablehnen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active companies */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700">{active.length} Aktive Firmen</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setNewFirmaModal(true)} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center gap-1">
                  <span>+</span> Neue Firma
                </button>
                <button onClick={loadCompanies} className="text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
              </div>
            </div>
            {active.map(c => (
              <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedCompany(expandedCompany === c.id ? null : c.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary-700 font-bold text-sm">
                      {c.company_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{c.company_name}</p>
                      <p className="text-xs text-gray-500">{c.contact_name} · {c.user_count || 0} Nutzer · {c.booking_count || 0} Fahrten</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.discount_percent > 0 && (
                      <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-lg">{c.discount_percent}% Rabatt</span>
                    )}
                    {c.allowed_payment_methods?.includes('rechnung') && (
                      <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-lg">Rechnung</span>
                    )}
                    {/* Open invoices badge */}
                    {invoices.filter(i => i.company_id === c.id && i.status === 'sent').map(i => (
                      <span key={i.id} className={`text-xs font-medium px-2 py-1 rounded-lg ${isOverdue(i.due_date) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        fällig {fmtDate(i.due_date)}
                      </span>
                    ))}
                    {expandedCompany === c.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {expandedCompany === c.id && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div><span className="text-gray-500">E-Mail:</span> <span className="font-medium">{c.email}</span></div>
                      <div><span className="text-gray-500">Telefon:</span> <span className="font-medium">{c.phone}</span></div>
                      <div><span className="text-gray-500">Adresse:</span> <span className="font-medium">{c.address || '—'}</span></div>
                      <div><span className="text-gray-500">USt-IdNr.:</span> <span className="font-medium">{c.ust_idnr || '—'}</span></div>
                      <div><span className="text-gray-500">Rabatt:</span> <span className="font-medium">{c.discount_percent}%</span></div>
                      <div><span className="text-gray-500">Zahlungsziel:</span> <span className="font-medium">{c.payment_term_days || 14} Tage</span></div>
                      <div><span className="text-gray-500">Zahlung:</span> <span className="font-medium">{c.allowed_payment_methods || 'cash,card'}</span></div>
                      {(c.allowed_payment_methods || 'cash,card').includes('card') && (
                        <div><span className="text-gray-500">Abrechnung:</span> <span className="font-medium">
                          {c.charge_mode === 'on_confirm' ? 'Bei Buchung' : c.charge_mode === 'on_completion' ? 'Bei Fahrtende' : 'Manuell'}
                        </span></div>
                      )}
                      <div><span className="text-gray-500">Mitglied seit:</span> <span className="font-medium">{fmtDate(c.created_at)}</span></div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {c.pg_discount_override ? (
                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">Rabatt trotz Pflichtgebiet</span>
                      ) : null}
                      {c.discount_kombinierbar ? (
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Rückfahrt-Rabatt kombinierbar</span>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditModal({ ...c })} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                        Bearbeiten
                      </button>
                      <button onClick={() => setSrModal({ companyId: c.id, companyName: c.company_name })}
                        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 flex items-center gap-1">
                        <FileText size={14} /> Sammelrechnung
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Suspended/rejected */}
          {other.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-400">{other.length} Gesperrt/Abgelehnt</h3>
              {other.map(c => (
                <div key={c.id} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between opacity-60">
                  <span className="text-sm">{c.company_name} — <span className="text-xs text-gray-400">{c.status}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ RECHNUNGEN ═══ */}
      {section === 'rechnungen' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['all', 'open', 'overdue', 'paid'] as const).map(f => (
              <button key={f} onClick={() => setInvoiceFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${invoiceFilter === f ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'}`}>
                {f === 'all' ? 'Alle' : f === 'open' ? 'Offen' : f === 'overdue' ? 'Überfällig' : 'Bezahlt'}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Firma</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Nr.</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Zeitraum</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Betrag</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Fällig bis</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map(inv => {
                  const overdue = inv.status === 'sent' && isOverdue(inv.due_date);
                  const levelLabels = ['—', '1. Erinnerung', '2. Erinnerung', 'Mahnung'];
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{inv.company_name}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.period_month}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {Number(inv.total).toFixed(2).replace('.', ',')} €
                        {Number(inv.mahngebuehr) > 0 && <span className="text-xs text-red-500 ml-1">(davon {Number(inv.mahngebuehr).toFixed(2).replace('.', ',')} Mahngebühr)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${overdue ? 'bg-red-100 text-red-700' : inv.status === 'paid' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                          {overdue && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}
                          {fmtDate(inv.due_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {inv.status === 'paid' ? (
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">Bezahlt</span>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {inv.reminder_level > 0 && <>{levelLabels[inv.reminder_level] || '?'} · {fmtDate(inv.reminder_sent_at)}</>}
                            {inv.reminder_level === 0 && 'Offen'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openInvoiceEdit(inv)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="Bearbeiten">
                            <Pencil size={14} />
                          </button>
                          <a href={`${API}/admin/companies/invoices/${inv.id}/pdf?token=${token}`} target="_blank" rel="noreferrer"
                            className="p-1.5 hover:bg-gray-100 rounded-lg" title="PDF">
                            <Download size={14} />
                          </a>
                          <button onClick={() => { setSendModal(inv); setSendEmailAddr(''); }}
                            className={`p-1.5 rounded-lg ${inv.manual_sent_at ? 'text-green-600 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'}`}
                            title={inv.manual_sent_at ? `Gesendet am ${fmtDate(inv.manual_sent_at)}` : 'Noch nicht gesendet — per E-Mail senden'}>
                            <Mail size={14} />
                          </button>
                          {inv.status === 'sent' && inv.reminder_level < 3 && (
                            <button onClick={() => {
                              if (inv.reminder_level === 2) {
                                setMahnModal({ invoice: inv, mahngebuehr: '10' });
                              } else {
                                handleRemind(inv.id);
                              }
                            }} className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600" title="Erinnerung senden">
                              <Send size={14} />
                            </button>
                          )}
                          <button onClick={() => inv.status !== 'paid' && handleMarkPaid(inv.id)}
                            disabled={inv.status === 'paid'}
                            className={`p-1.5 rounded-lg ${inv.status === 'paid' ? 'text-green-600 cursor-default' : 'text-red-500 hover:bg-red-50'}`}
                            title={inv.status === 'paid' ? 'Bezahlt' : 'Noch nicht bezahlt — als bezahlt markieren'}>
                            <Check size={14} />
                          </button>
                          <button onClick={() => handleDeleteInvoice(inv.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Löschen">
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {invoices.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Keine Rechnungen gefunden</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ EINSTELLUNGEN ═══ */}
      {section === 'einstellungen' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Portal-Einstellungen</h3>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Live Fahrer-Tracking im Portal</p>
              <p className="text-sm text-gray-500">Firmenkunden können den Fahrer-Standort in Echtzeit sehen</p>
            </div>
            <button onClick={toggleTracking}
              className={`relative w-12 h-6 rounded-full transition-colors ${trackingEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${trackingEnabled ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-900">Neue Firmenanmeldungen annehmen</p>
              <p className="text-sm text-gray-500">Deaktiviert die Bewerbung auf der Business-Seite und im Portal — bestehende Firmenkunden sind nicht betroffen</p>
            </div>
            <button onClick={toggleApplications}
              className={`relative w-12 h-6 rounded-full transition-colors ${applicationsEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${applicationsEnabled ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      )}

      {/* ═══ APPROVE MODAL ═══ */}
      {approveModal && <ApproveModal company={approveModal} onApprove={handleApprove} onClose={() => setApproveModal(null)} />}

      {/* ═══ EDIT MODAL ═══ */}
      {editModal && <EditModal company={editModal} onSave={handleUpdateCompany} onClose={() => setEditModal(null)} />}

      {/* ═══ SAMMELRECHNUNG MODAL ═══ */}
      {srModal && <SammelrechnungModal companyId={srModal.companyId} companyName={srModal.companyName} onCreate={handleCreateSR} onClose={() => setSrModal(null)} />}

      {/* ═══ MAHNUNG MODAL ═══ */}
      {mahnModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setMahnModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-red-700 flex items-center gap-2"><AlertTriangle size={18} /> Mahnung senden</h3>
            <p className="text-sm text-gray-600">Rechnung {mahnModal.invoice.invoice_number}</p>
            <div>
              <label className="text-sm font-medium text-gray-700">Mahngebühr (€)</label>
              <input type="number" step="0.01" value={mahnModal.mahngebuehr}
                onChange={e => setMahnModal({ ...mahnModal, mahngebuehr: e.target.value })}
                className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleRemind(mahnModal.invoice.id, parseFloat(mahnModal.mahngebuehr) || 0)}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700">
                Mahnung senden
              </button>
              <button onClick={() => setMahnModal(null)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {/* Rechnung bearbeiten Modal */}
      {invoiceEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setInvoiceEditModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-3xl w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Rechnung bearbeiten — {invoiceEditModal.invoice_number}</h3>
              <button onClick={() => setInvoiceEditModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-600">{invoiceEditModal.company_name}</p>

            {invoiceEditLoading ? (
              <div className="py-12 text-center text-gray-400 text-sm">Lädt…</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Fällig bis</label>
                    <input type="date" value={invoiceEditDueDate} onChange={e => setInvoiceEditDueDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Projekt (optional)</label>
                    <input value={invoiceEditProjectName} onChange={e => setInvoiceEditProjectName(e.target.value)}
                      placeholder="z.B. Herzklang 2"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
                  </div>
                </div>

                <div className="space-y-2">
                  {invoiceEditRows.map(row => (
                    <div key={row.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-gray-500">Datum/Zeit</label>
                          <input type="datetime-local" value={row.pickup_datetime}
                            onChange={e => updateInvoiceEditRow(row.id, { pickup_datetime: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Gast</label>
                          <input value={row.name} onChange={e => updateInvoiceEditRow(row.id, { name: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-gray-500">Von</label>
                          <input value={row.pickup_address} onChange={e => updateInvoiceEditRow(row.id, { pickup_address: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Nach</label>
                          <input value={row.dropoff_address} onChange={e => updateInvoiceEditRow(row.id, { dropoff_address: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1" />
                        </div>
                      </div>
                      <div className="flex items-end gap-2">
                        <div>
                          <label className="text-xs font-medium text-gray-500">Preis (brutto)</label>
                          <input type="number" step="0.01" value={row.price}
                            onChange={e => updateInvoiceEditRow(row.id, { price: parseFloat(e.target.value) || 0 })}
                            className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">MwSt.</label>
                          <select value={row.steuersatz} onChange={e => updateInvoiceEditRow(row.id, { steuersatz: Number(e.target.value) })}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1">
                            <option value={7}>7%</option>
                            <option value={19}>19%</option>
                            <option value={0}>0%</option>
                          </select>
                        </div>
                        <button onClick={() => removeInvoiceEditRow(row.id)}
                          className="ml-auto p-2 hover:bg-red-50 rounded-lg text-red-400" title="Aus Rechnung entfernen">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {invoiceEditRows.length === 0 && (
                    <div className="text-center text-gray-400 text-sm py-6">Keine Positionen mehr in dieser Rechnung.</div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-sm text-gray-500">
                    Neuer Gesamtbetrag: <span className="font-semibold text-gray-900">
                      {invoiceEditRows.reduce((s, r) => s + (Number(r.price) || 0), 0).toFixed(2).replace('.', ',')} €
                    </span>
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => setInvoiceEditModal(null)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Abbrechen</button>
                    <button onClick={saveInvoiceEdit} disabled={invoiceEditSaving}
                      className="bg-primary-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                      {invoiceEditSaving ? 'Speichert…' : 'Speichern'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Rechnung per E-Mail senden Modal */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSendModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">Rechnung per E-Mail senden</h3>
            <p className="text-sm text-gray-600">{sendModal.invoice_number} · {sendModal.company_name}</p>
            <div>
              <label className="text-xs font-medium text-gray-500">Empfänger-E-Mail</label>
              <input autoFocus type="email" value={sendEmailAddr} onChange={e => setSendEmailAddr(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && sendEmailAddr.trim()) handleSendInvoice(); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" placeholder="empfang@firma.de" />
            </div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Versendet die Rechnung als HTML-E-Mail mit PDF-Anhang an die eingegebene Adresse.
            </p>
            <div className="flex gap-2">
              <button onClick={handleSendInvoice} disabled={!sendEmailAddr.trim() || sendLoading}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {sendLoading ? 'Wird gesendet…' : 'Senden'}
              </button>
              <button onClick={() => setSendModal(null)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {/* Neue Firma Modal */}
      {newFirmaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setNewFirmaModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">Neue Firma anlegen</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Firmenname *</label>
                <input autoFocus value={newFirma.company_name} onChange={e => setNewFirma(f => ({ ...f, company_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" placeholder="z.B. Müller GmbH" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Ansprechpartner</label>
                <input value={newFirma.contact_name} onChange={e => setNewFirma(f => ({ ...f, contact_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" placeholder="Max Mustermann" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-500">E-Mail</label>
                  <input type="email" value={newFirma.email} onChange={e => setNewFirma(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" placeholder="optional" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Telefon</label>
                  <input value={newFirma.phone} onChange={e => setNewFirma(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" placeholder="optional" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Adresse</label>
                <input value={newFirma.address} onChange={e => setNewFirma(f => ({ ...f, address: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" placeholder="Straße + Hausnummer" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-500">PLZ</label>
                  <input value={newFirma.zip} onChange={e => setNewFirma(f => ({ ...f, zip: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" placeholder="85356" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Stadt</label>
                  <input value={newFirma.city} onChange={e => setNewFirma(f => ({ ...f, city: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" placeholder="Freising" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleCreateFirma} disabled={!newFirma.company_name.trim() || newFirmaLoading}
                className="flex-1 bg-primary-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                {newFirmaLoading ? 'Speichern…' : 'Firma anlegen'}
              </button>
              <button onClick={() => setNewFirmaModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function ApproveModal({ company, onApprove, onClose }: { company: Company; onApprove: (c: Company, pm: string, d: number) => void; onClose: () => void }) {
  const [payMethods, setPayMethods] = useState({ cash: true, card: true, rechnung: false });
  const [discount, setDiscount] = useState(0);

  const methods = [payMethods.cash && 'cash', payMethods.card && 'card', payMethods.rechnung && 'rechnung'].filter(Boolean).join(',');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900">Firma freischalten</h3>
        <p className="text-sm text-gray-600">{company.company_name} · {company.contact_name}</p>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Erlaubte Zahlungsarten</label>
          <div className="flex gap-3">
            {[
              { key: 'cash' as const, icon: Banknote, label: 'Barzahlung' },
              { key: 'card' as const, icon: CreditCard, label: 'Kreditkarte' },
              { key: 'rechnung' as const, icon: Receipt, label: 'Auf Rechnung' },
            ].map(({ key, icon: Icon, label }) => (
              <label key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${payMethods[key] ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
                <input type="checkbox" checked={payMethods[key]} onChange={() => setPayMethods({ ...payMethods, [key]: !payMethods[key] })} className="sr-only" />
                <Icon size={14} /> {label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Firmenrabatt (%)</label>
          <input type="number" min={0} max={50} value={discount} onChange={e => setDiscount(Number(e.target.value))}
            className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="flex gap-2">
          <button onClick={() => onApprove(company, methods, discount)}
            className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700">
            Freischalten & E-Mail senden
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ company, onSave, onClose }: { company: Company; onSave: (c: Company) => void; onClose: () => void }) {
  const [c, setC] = useState(company);
  const payArr = (c.allowed_payment_methods || 'cash,card').split(',');

  const togglePay = (m: string) => {
    const arr = payArr.includes(m) ? payArr.filter(x => x !== m) : [...payArr, m];
    setC({ ...c, allowed_payment_methods: arr.filter(Boolean).join(',') });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900">{c.company_name} bearbeiten</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Rabatt (%)</label>
            <input type="number" min={0} max={50} value={c.discount_percent}
              onChange={e => setC({ ...c, discount_percent: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Zahlungsziel (Tage)</label>
            <input type="number" min={1} max={90} value={c.payment_term_days || 14}
              onChange={e => setC({ ...c, payment_term_days: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 block mb-2">Zahlungsarten</label>
          <div className="flex gap-2">
            {['cash', 'card', 'rechnung'].map(m => (
              <button key={m} onClick={() => togglePay(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${payArr.includes(m) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-400'}`}>
                {m === 'cash' ? 'Barzahlung' : m === 'card' ? 'Kreditkarte' : 'Auf Rechnung'}
              </button>
            ))}
          </div>
        </div>

        {payArr.includes('card') && (
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Abrechnungsart bei Kreditkarte</label>
            <select value={c.charge_mode || 'manual'} onChange={e => setC({ ...c, charge_mode: e.target.value as Company['charge_mode'] })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="manual">Manuell (unser Team zieht per Klick ab)</option>
              <option value="on_confirm">Automatisch bei Buchungsbestätigung</option>
              <option value="on_completion">Automatisch nach Fahrtende</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {c.card_last4 ? `Hinterlegte Karte: ${(c.card_brand || '').toUpperCase()} •••• ${c.card_last4}` : 'Firma hat noch keine Karte hinterlegt.'}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!c.pg_discount_override}
              onChange={() => setC({ ...c, pg_discount_override: c.pg_discount_override ? 0 : 1 })}
              className="rounded border-gray-300" />
            Rabatt trotz Pflichtfahrgebiet
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!c.discount_kombinierbar}
              onChange={() => setC({ ...c, discount_kombinierbar: c.discount_kombinierbar ? 0 : 1 })}
              className="rounded border-gray-300" />
            Mit Rückfahrt-Rabatt kombinierbar
          </label>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select value={c.status} onChange={e => setC({ ...c, status: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1">
            <option value="active">Aktiv</option>
            <option value="suspended">Gesperrt</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button onClick={() => onSave(c)} className="flex-1 bg-primary-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-700">
            Speichern
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function SammelrechnungModal({ companyId, companyName, onCreate, onClose }: {
  companyId: number; companyName: string;
  onCreate: (id: number, month: string, mwst: number, email: boolean, projectName: string) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const lastMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
  const [month, setMonth] = useState(lastMonth);
  const [sendEmail, setSendEmail] = useState(true);
  const [projectName, setProjectName] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900">Sammelrechnung erstellen</h3>
        <p className="text-sm text-gray-600">{companyName}</p>

        <div>
          <label className="text-xs font-medium text-gray-500">Monat</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500">Projekt (optional)</label>
          <input value={projectName} onChange={e => setProjectName(e.target.value)}
            placeholder="z.B. Herzklang 2"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
        </div>

        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          Die MwSt. wird automatisch pro Fahrt berechnet (je nach hinterlegtem Steuersatz). Bei gemischten Sätzen zeigt die Rechnung getrennte Summen für 7% und 19%.
        </p>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={sendEmail} onChange={() => setSendEmail(!sendEmail)} className="rounded border-gray-300" />
          Rechnung per E-Mail senden
        </label>

        <div className="flex gap-2">
          <button onClick={() => onCreate(companyId, month, 19, sendEmail, projectName)}
            className="flex-1 bg-amber-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-amber-700">
            Erstellen
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
