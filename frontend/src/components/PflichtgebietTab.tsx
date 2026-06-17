'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapPin, Plane, Building2, Save, Trash2, Plus } from 'lucide-react';
import { pflichtgebietApi, PflichtgebietConfig, PflichtgebietTarif, PflichtgebietExclusion } from '@/lib/api';
import { cn } from '@/lib/utils';

const VEHICLE_LABELS: Record<string, string> = {
  kombi: 'Kombi',
  van: 'Van',
  grossraumtaxi: 'Großraumtaxi',
};

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn('relative w-14 h-7 rounded-full transition-colors flex-shrink-0', on ? 'bg-green-500' : 'bg-gray-300')}
    >
      <div className={cn('absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform', on ? 'translate-x-7' : 'translate-x-0.5')} />
    </button>
  );
}

export default function PflichtgebietTab({ token }: { token: string }) {
  void token; // auth handled by axios interceptor (localStorage admin_token)
  const [config, setConfig] = useState<PflichtgebietConfig | null>(null);
  const [tarife, setTarife] = useState<PflichtgebietTarif[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const load = useCallback(async () => {
    try {
      const data = await pflichtgebietApi.get();
      setConfig(data.config);
      setTarife(data.tarife);
      setErr('');
    } catch {
      setErr('Konfiguration konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = (p: Partial<PflichtgebietConfig>) => setConfig((c) => (c ? { ...c, ...p } : c));

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const updated = await pflichtgebietApi.updateConfig({
        enabled: config.enabled,
        mode: config.mode,
        radius_km: config.radius_km,
        roundtrip_discount_enabled: config.roundtrip_discount_enabled,
        airport_enabled: config.airport_enabled,
        airport_lat: config.airport_lat,
        airport_lng: config.airport_lng,
        betriebssitz_enabled: config.betriebssitz_enabled,
        betriebssitz_lat: config.betriebssitz_lat,
        betriebssitz_lng: config.betriebssitz_lng,
      });
      setConfig(updated);
      flash('Einstellungen gespeichert ✓');
    } catch {
      setErr('Speichern fehlgeschlagen');
    }
    setSaving(false);
  };

  const saveTarif = async (t: PflichtgebietTarif) => {
    setSaving(true);
    try {
      const updated = await pflichtgebietApi.updateTarif(t.vehicle_type, Number(t.grundgebuehr), Number(t.min_per_km));
      setTarife((arr) => arr.map((x) => (x.vehicle_type === t.vehicle_type ? updated : x)));
      flash(`${VEHICLE_LABELS[t.vehicle_type] || t.vehicle_type} Tarif gespeichert ✓`);
    } catch {
      setErr('Tarif konnte nicht gespeichert werden');
    }
    setSaving(false);
  };

  const setTarif = (vt: string, field: 'grundgebuehr' | 'min_per_km', value: string) =>
    setTarife((arr) => arr.map((x) => (x.vehicle_type === vt ? { ...x, [field]: value === '' ? 0 : parseFloat(value) } : x)));

  if (loading) return <div className="text-center py-12 text-gray-500">Laden…</div>;
  if (!config) return <div className="text-center py-12 text-red-600">{err || 'Keine Konfiguration'}</div>;

  const enabled = config.enabled === 1;

  return (
    <div className="space-y-4">
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{msg}</div>}
      {err && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{err}</div>}

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 flex gap-3">
        <MapPin size={18} className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Pflichtfahrgebiet – gesetzlicher Mindesttarif</p>
          <p className="mt-1 text-amber-700">
            Innerhalb des Umkreises (Flughafen + Betriebssitz) darf der Preis den amtlichen Taxitarif nicht unterschreiten.
            Außerhalb gilt unverändert die normale Preisberechnung.
          </p>
        </div>
      </div>

      {/* Global config */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <label className="font-bold text-gray-900 text-lg">Pflichtfahrgebiet aktiv</label>
            <p className="text-xs text-gray-500 mt-0.5">An/aus für die gesamte Mindesttarif-Logik</p>
          </div>
          <Toggle on={enabled} onClick={() => patch({ enabled: enabled ? 0 : 1 })} />
        </div>

        <div className={cn('space-y-5 transition-opacity', enabled ? '' : 'opacity-50 pointer-events-none')}>
          {/* Mode segmented */}
          <div>
            <label className="block font-semibold text-gray-700 mb-2">Berechnungsmodus</label>
            <div className="inline-flex rounded-xl border border-gray-200 p-1 bg-gray-50">
              {([
                { v: 'floor', label: 'Untergrenze', desc: 'höherer Preis gewinnt' },
                { v: 'replace', label: 'Festtarif', desc: 'immer Tarifpreis' },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => patch({ mode: opt.v })}
                  className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    config.mode === opt.v ? 'bg-primary-600 text-white shadow' : 'text-gray-600 hover:bg-white')}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {config.mode === 'replace'
                ? 'Im Gebiet wird ausschließlich der amtliche Tarif angezeigt.'
                : 'Im Gebiet: max(normaler Preis, amtlicher Tarif) – der Tarif ist die Untergrenze.'}
            </p>
          </div>

          {/* Radius + roundtrip toggle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Umkreis (Radius)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" step="1" min="1"
                  value={config.radius_km}
                  onChange={(e) => patch({ radius_km: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                  className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <span className="text-gray-500 text-sm">km</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="font-semibold text-gray-700">Hin- &amp; Rückfahrt Rabatt</label>
                <p className="text-xs text-gray-500 mt-0.5">Im Gebiet Rabatt anwenden?</p>
              </div>
              <Toggle on={config.roundtrip_discount_enabled === 1} onClick={() => patch({ roundtrip_discount_enabled: config.roundtrip_discount_enabled ? 0 : 1 })} />
            </div>
          </div>

          {/* Centers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Airport */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-gray-800"><Plane size={16} /> Flughafen München</span>
                <Toggle on={config.airport_enabled === 1} onClick={() => patch({ airport_enabled: config.airport_enabled ? 0 : 1 })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500">Breite (lat)
                  <input type="number" step="0.0001" value={config.airport_lat}
                    onChange={(e) => patch({ airport_lat: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </label>
                <label className="text-xs text-gray-500">Länge (lng)
                  <input type="number" step="0.0001" value={config.airport_lng}
                    onChange={(e) => patch({ airport_lng: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </label>
              </div>
            </div>
            {/* Betriebssitz */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-gray-800"><Building2 size={16} /> Betriebssitz (Freising)</span>
                <Toggle on={config.betriebssitz_enabled === 1} onClick={() => patch({ betriebssitz_enabled: config.betriebssitz_enabled ? 0 : 1 })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-500">Breite (lat)
                  <input type="number" step="0.0001" value={config.betriebssitz_lat}
                    onChange={(e) => patch({ betriebssitz_lat: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </label>
                <label className="text-xs text-gray-500">Länge (lng)
                  <input type="number" step="0.0001" value={config.betriebssitz_lng}
                    onChange={(e) => patch({ betriebssitz_lng: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={saveConfig} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
            <Save size={16} /> {saving ? '…' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Per-vehicle tariffs */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="font-bold text-gray-900 text-lg mb-4">Amtlicher Tarif pro Fahrzeug</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tarife.map((t) => (
            <div key={t.vehicle_type} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="font-semibold text-gray-800">{VEHICLE_LABELS[t.vehicle_type] || t.vehicle_type}</div>
              <label className="block text-xs text-gray-500">Grundgebühr (€)
                <input type="number" step="0.10" min="0" value={t.grundgebuehr}
                  onChange={(e) => setTarif(t.vehicle_type, 'grundgebuehr', e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </label>
              <label className="block text-xs text-gray-500">Min. Preis pro km (€)
                <input type="number" step="0.10" min="0" value={t.min_per_km}
                  onChange={(e) => setTarif(t.vehicle_type, 'min_per_km', e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </label>
              <button onClick={() => saveTarif(t)} disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
                <Save size={14} /> Speichern
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
