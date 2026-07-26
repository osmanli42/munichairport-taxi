'use client';

import { useEffect, useState, useCallback } from 'react';
import { Percent, Trash2, Plus, Pencil, X, AlertTriangle } from 'lucide-react';
import { autoDiscountsApi, AutoDiscount, settingsApi, adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const WEEKDAYS = [
  { v: 1, label: 'Mo' }, { v: 2, label: 'Di' }, { v: 3, label: 'Mi' }, { v: 4, label: 'Do' },
  { v: 5, label: 'Fr' }, { v: 6, label: 'Sa' }, { v: 7, label: 'So' },
];

const VEHICLES = [
  { v: 'kombi', label: 'Kombi' }, { v: 'van', label: 'Van' }, { v: 'grossraumtaxi', label: 'Großraumtaxi' },
];

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn('relative w-14 h-7 rounded-full transition-colors flex-shrink-0', on ? 'bg-green-500' : 'bg-gray-300', disabled && 'opacity-50 cursor-not-allowed')}
    >
      <div className={cn('absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform', on ? 'translate-x-7' : 'translate-x-0.5')} />
    </button>
  );
}

type FormState = Partial<AutoDiscount>;

const emptyForm = (): FormState => ({
  name: '', discount_type: 'percent', discount_value: 10, zone_scope: 'outside', min_km: null, max_km: null,
  hour_from: null, hour_to: null, weekday_mask: null, booking_index_max: null,
  max_uses: null, max_discount_amount: null, vehicle_types: null, trip_types: null,
  start_date: null, end_date: null, booking_start_date: null, booking_end_date: null,
  priority: 0, stackable_with_promo: 0,
});

export default function RabatteTab({ token }: { token: string }) {
  void token;
  const [rules, setRules] = useState<AutoDiscount[]>([]);
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const load = useCallback(async () => {
    try {
      const [list, settings] = await Promise.all([autoDiscountsApi.getAll(), settingsApi.getAll()]);
      setRules(list);
      setMasterEnabled((settings.auto_discounts_enabled ?? '1') === '1');
      setErr('');
    } catch {
      setErr('Regeln konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleMaster = async () => {
    const next = !masterEnabled;
    setMasterEnabled(next);
    setSaving(true);
    try {
      await adminApi.updateSettings({ auto_discounts_enabled: next ? '1' : '0' });
      flash(next ? 'Rabatte aktiviert ✓' : 'Rabatte deaktiviert — alle Regeln pausiert ✓');
    } catch {
      setMasterEnabled(!next);
      setErr('Konnte nicht gespeichert werden');
    }
    setSaving(false);
  };

  const toggleRule = async (r: AutoDiscount) => {
    setRules(arr => arr.map(x => x.id === r.id ? { ...x, active: r.active ? 0 : 1 } : x));
    try {
      await autoDiscountsApi.toggle(r.id, !r.active);
    } catch {
      setRules(arr => arr.map(x => x.id === r.id ? { ...x, active: r.active } : x));
      setErr('Umschalten fehlgeschlagen');
    }
  };

  const removeRule = async (id: number) => {
    if (!confirm('Diese Regel wirklich löschen?')) return;
    try {
      await autoDiscountsApi.remove(id);
      setRules(arr => arr.filter(x => x.id !== id));
      flash('Regel gelöscht ✓');
    } catch {
      setErr('Löschen fehlgeschlagen');
    }
  };

  const startCreate = () => { setEditing(emptyForm()); setEditingId(null); };
  const startEdit = (r: AutoDiscount) => { setEditing({ ...r }); setEditingId(r.id); };
  const cancelEdit = () => { setEditing(null); setEditingId(null); };

  const saveForm = async () => {
    if (!editing) return;
    if (!editing.name || !editing.discount_value) { setErr('Name und Rabattwert sind erforderlich'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await autoDiscountsApi.update(editingId, editing);
      } else {
        await autoDiscountsApi.create(editing);
      }
      await load();
      cancelEdit();
      flash('Gespeichert ✓');
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Speichern fehlgeschlagen');
    }
    setSaving(false);
  };

  const patch = (p: FormState) => setEditing(f => (f ? { ...f, ...p } : f));

  const toggleWeekday = (d: number) => {
    if (!editing) return;
    const current = (editing.weekday_mask || '').split(',').map(s => s.trim()).filter(Boolean).map(Number);
    const next = current.includes(d) ? current.filter(x => x !== d) : [...current, d];
    patch({ weekday_mask: next.length === 0 ? null : next.sort().join(',') });
  };

  const toggleVehicle = (v: string) => {
    if (!editing) return;
    const current = (editing.vehicle_types || '').split(',').map(s => s.trim()).filter(Boolean);
    const next = current.includes(v) ? current.filter(x => x !== v) : [...current, v];
    patch({ vehicle_types: next.length === 0 ? null : next.join(',') });
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Laden…</div>;

  const zoneLabel = (z: string) => z === 'inside' ? 'INNERHALB' : z === 'outside' ? 'AUSSERHALB' : 'BEIDE';
  const zoneColor = (z: string) => z === 'inside' ? 'bg-amber-100 text-amber-800 border-amber-300' : z === 'outside' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-gray-100 text-gray-700 border-gray-300';

  return (
    <div className="space-y-4">
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{msg}</div>}
      {err && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{err}</div>}

      {/* Ana şalter */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center">
            <Percent size={18} className="text-green-700" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Automatische Rabatte</p>
            <p className="text-sm text-gray-500">Hauptschalter — deaktiviert sofort alle Regeln, ohne sie zu löschen.</p>
          </div>
        </div>
        <Toggle on={masterEnabled} onClick={toggleMaster} disabled={saving} />
      </div>

      {/* Kural listesi */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="font-bold text-gray-900">Regeln</p>
          <button onClick={startCreate} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg">
            <Plus size={15} /> Neue Regel
          </button>
        </div>
        {rules.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Noch keine Regeln angelegt.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rules.map(r => (
              <div key={r.id} className="px-5 py-4 flex items-center gap-4">
                <Toggle on={!!r.active} onClick={() => toggleRule(r)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{r.name}</span>
                    <span className="text-sm font-bold text-green-700">
                      {r.discount_type === 'fixed' ? `−${r.discount_value}€` : `%${r.discount_value}`}
                    </span>
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', zoneColor(r.zone_scope))}>{zoneLabel(r.zone_scope)}</span>
                    {r.zone_scope === 'inside' && <AlertTriangle size={14} className="text-amber-500" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {r.min_km != null || r.max_km != null ? `${r.min_km ?? 0}–${r.max_km ?? '∞'} km · ` : ''}
                    {r.hour_from != null && r.hour_to != null ? `${r.hour_from}:00–${r.hour_to}:00 Uhr · ` : ''}
                    {r.booking_index_max != null ? `erste ${r.booking_index_max} Buchungen · ` : ''}
                    {(r.start_date || r.end_date) ? `Fahrt: ${r.start_date ?? '…'}–${r.end_date ?? '…'} · ` : ''}
                    {(r.booking_start_date || r.booking_end_date) ? `Buchung: ${r.booking_start_date ?? '…'}–${r.booking_end_date ?? '…'} · ` : ''}
                    Genutzt: {r.used_count}{r.max_uses != null ? `/${r.max_uses}` : ''}
                  </p>
                </div>
                <button onClick={() => startEdit(r)} className="p-2 text-gray-400 hover:text-primary-600"><Pencil size={16} /></button>
                <button onClick={() => removeRule(r.id)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kural formu */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={cancelEdit}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900">{editingId ? 'Regel bearbeiten' : 'Neue Regel'}</h3>
              <button onClick={cancelEdit}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Name</label>
                <input value={editing.name || ''} onChange={e => patch({ name: e.target.value })}
                  placeholder="z.B. Fernstrecken-Rabatt"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Rabatt-Art</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => patch({ discount_type: 'percent' })}
                    className={cn('py-2 rounded-lg text-sm font-bold border', editing.discount_type === 'percent' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200')}>
                    Prozent %
                  </button>
                  <button type="button" onClick={() => patch({ discount_type: 'fixed' })}
                    className={cn('py-2 rounded-lg text-sm font-bold border', editing.discount_type === 'fixed' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200')}>
                    Fester Betrag €
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {editing.discount_type === 'fixed' ? 'Rabatt €' : 'Rabatt %'}
                  </label>
                  <input type="number" min={0} max={editing.discount_type === 'fixed' ? undefined : 100} step={0.5}
                    value={editing.discount_value ?? ''}
                    onChange={e => patch({ discount_value: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Max. Rabatt €</label>
                  <input type="number" min={0} step={0.5} value={editing.max_discount_amount ?? ''}
                    onChange={e => patch({ max_discount_amount: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    placeholder="unbegrenzt"
                    disabled={editing.discount_type === 'fixed'}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Geltungsbereich</label>
                <div className="mt-1 grid grid-cols-1 gap-2">
                  <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer">
                    <input type="radio" checked={editing.zone_scope === 'outside'} onChange={() => patch({ zone_scope: 'outside' })} />
                    Außerhalb Pflichtfahrgebiet (empfohlen)
                  </label>
                  <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer">
                    <input type="radio" checked={editing.zone_scope === 'inside'} onChange={() => patch({ zone_scope: 'inside' })} />
                    Innerhalb Pflichtfahrgebiet
                  </label>
                  <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer">
                    <input type="radio" checked={editing.zone_scope === 'any'} onChange={() => patch({ zone_scope: 'any' })} />
                    Beide
                  </label>
                </div>
                {(editing.zone_scope === 'inside' || editing.zone_scope === 'any') && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>§ 51 Abs. 5 PBefG: Der amtliche Tarif darf innerhalb des Pflichtfahrgebiets nicht unterschritten werden und muss gleichmäßig angewendet werden. Der Rabatt wird automatisch auf den Pflichttarif begrenzt.</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Min. km</label>
                  <input type="number" min={0} value={editing.min_km ?? ''}
                    onChange={e => patch({ min_km: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    placeholder="z.B. 50"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Max. km</label>
                  <input type="number" min={0} value={editing.max_km ?? ''}
                    onChange={e => patch({ max_km: e.target.value === '' ? null : parseFloat(e.target.value) })}
                    placeholder="unbegrenzt"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Uhrzeit von</label>
                  <input type="number" min={0} max={23} value={editing.hour_from ?? ''}
                    onChange={e => patch({ hour_from: e.target.value === '' ? null : parseInt(e.target.value) })}
                    placeholder="jederzeit"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Uhrzeit bis</label>
                  <input type="number" min={0} max={23} value={editing.hour_to ?? ''}
                    onChange={e => patch({ hour_to: e.target.value === '' ? null : parseInt(e.target.value) })}
                    placeholder="jederzeit"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Wochentage (leer = alle)</label>
                <div className="mt-1 flex gap-1.5">
                  {WEEKDAYS.map(d => {
                    const active = (editing.weekday_mask || '').split(',').map(Number).includes(d.v);
                    return (
                      <button key={d.v} onClick={() => toggleWeekday(d.v)}
                        className={cn('flex-1 py-2 rounded-lg text-xs font-bold border', active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200')}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fahrzeuge (leer = alle)</label>
                <div className="mt-1 flex gap-1.5">
                  {VEHICLES.map(v => {
                    const active = (editing.vehicle_types || '').split(',').includes(v.v);
                    return (
                      <button key={v.v} onClick={() => toggleVehicle(v.v)}
                        className={cn('flex-1 py-2 rounded-lg text-xs font-bold border', active ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-500 border-gray-200')}>
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Erste [N] Buchungen des Kunden</label>
                  <input type="number" min={1} value={editing.booking_index_max ?? ''}
                    onChange={e => patch({ booking_index_max: e.target.value === '' ? null : parseInt(e.target.value) })}
                    placeholder="alle Kunden"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Max. Nutzungen gesamt</label>
                  <input type="number" min={1} value={editing.max_uses ?? ''}
                    onChange={e => patch({ max_uses: e.target.value === '' ? null : parseInt(e.target.value) })}
                    placeholder="unbegrenzt"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Trip-Typ</label>
                  <select value={editing.trip_types || ''} onChange={e => patch({ trip_types: e.target.value || null })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Beide</option>
                    <option value="oneway">Nur einfache Fahrt</option>
                    <option value="roundtrip">Nur Hin- & Rückfahrt</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Priorität</label>
                  <input type="number" value={editing.priority ?? 0}
                    onChange={e => patch({ priority: parseInt(e.target.value) || 0 })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fahrtdatum</label>
                <p className="text-xs text-gray-400 mb-1">Datum der Fahrt selbst. Für einen einzelnen Tag (z.B. 30.07.2026) beide Felder auf dasselbe Datum setzen.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Gültig ab</label>
                    <input type="date" value={editing.start_date || ''} onChange={e => patch({ start_date: e.target.value || null })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Gültig bis</label>
                    <input type="date" value={editing.end_date || ''} onChange={e => patch({ end_date: e.target.value || null })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Buchungsdatum</label>
                <p className="text-xs text-gray-400 mb-1">Datum, an dem gebucht wird (unabhängig vom Fahrtdatum oben — beide Bereiche können gleichzeitig aktiv sein).</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Gültig ab</label>
                    <input type="date" value={editing.booking_start_date || ''} onChange={e => patch({ booking_start_date: e.target.value || null })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Gültig bis</label>
                    <input type="date" value={editing.booking_end_date || ''} onChange={e => patch({ booking_end_date: e.target.value || null })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!editing.stackable_with_promo}
                  onChange={e => patch({ stackable_with_promo: e.target.checked ? 1 : 0 })} />
                Kombinierbar mit Aktionscode
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={cancelEdit} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm">Abbrechen</button>
              <button onClick={saveForm} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm disabled:opacity-50">
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
