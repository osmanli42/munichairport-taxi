'use client';

// System tab: Hero-Kalender — saisonale Hero-Bilder der Startseite (Desktop + Handy).
// Jeder Zeitraum zeigt sein Bild von 00:00 Uhr (deutsche Zeit) am Starttag bis Ende des Endtages;
// außerhalb der Zeiträume erscheint das Standard-Hero.
import { useEffect, useMemo, useState } from 'react';
import { Images, Trash2, Plus, ExternalLink } from 'lucide-react';
import { adminApi, settingsApi } from '@/lib/api';
import { HERO_IMAGE_SETS, HeroSeason, activeHeroSeason, berlinToday, heroSetReady, parseHeroSeasons } from '@/lib/heroSeasons';

const DIR = '/images/hero-seasons';

export default function HeroSeasonsCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [rows, setRows] = useState<HeroSeason[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    settingsApi.getAll().then((s) => {
      setEnabled(s.hero_seasons_enabled === '1');
      setRows(parseHeroSeasons(s.hero_seasons));
    }).catch(() => setEnabled(false));
  }, []);

  const today = berlinToday();
  const activeRow = enabled ? activeHeroSeason(rows, today) : null;
  const active = activeRow && heroSetReady(activeRow.img) ? activeRow : null;

  // Überschneidungen: der später beginnende Zeitraum gewinnt — trotzdem anzeigen
  const overlaps = useMemo(() => {
    const ids = new Set<string>();
    const on = rows.filter((r) => r.enabled);
    for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
      if (on[i].start <= on[j].end && on[j].start <= on[i].end) { ids.add(on[i].id); ids.add(on[j].id); }
    }
    return ids;
  }, [rows]);
  const invalid = rows.some((r) => !r.start || !r.end || r.start > r.end || !r.name.trim());

  function patch(id: string, p: Partial<HeroSeason>) {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...p } : r)));
    setDirty(true); setMsg(null);
  }
  function remove(id: string) {
    setRows((list) => list.filter((r) => r.id !== id));
    setDirty(true); setMsg(null);
  }
  function add(img: string) {
    const set = HERO_IMAGE_SETS.find((s) => s.img === img);
    if (!set) return;
    setRows((list) => [...list, { id: `${img}-${Date.now().toString(36)}`, name: set.label, start: today, end: today, enabled: false, img }]);
    setDirty(true); setMsg(null);
  }

  async function toggleMaster() {
    if (enabled == null) return;
    setSaving(true);
    try {
      const updated = await adminApi.updateSettings({ hero_seasons_enabled: enabled ? '0' : '1' });
      setEnabled(updated?.hero_seasons_enabled === '1');
    } catch { /* keep state */ }
    setSaving(false);
  }

  async function save() {
    if (invalid) { setMsg({ ok: false, text: 'Bitte Name und Datum prüfen (Start darf nicht nach dem Ende liegen).' }); return; }
    setSaving(true);
    try {
      const sorted = [...rows].sort((a, b) => a.start.localeCompare(b.start));
      const updated = await adminApi.updateSettings({ hero_seasons: JSON.stringify(sorted) });
      setRows(parseHeroSeasons(updated?.hero_seasons));
      setDirty(false);
      setMsg({ ok: true, text: 'Gespeichert — die Startseite übernimmt es innerhalb von 1 Minute.' });
    } catch {
      setMsg({ ok: false, text: 'Speichern fehlgeschlagen.' });
    }
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Images size={18} className="text-gray-700" />
            <h3 className="font-bold text-gray-900 text-lg">Hero-Kalender</h3>
          </div>
          <p className="text-sm text-gray-600 max-w-2xl">
            Saisonale Hero-Bilder der Startseite. Jedes Bild erscheint am Starttag um <b>00:00 Uhr deutscher Zeit</b> —
            am Computer und am Handy gleichzeitig — und bleibt bis zum Ende des Endtages. An Tagen ohne Zeitraum erscheint das Standard-Hero.
          </p>
          <p className="text-sm mt-1.5">
            Heute ({today.split('-').reverse().join('.')}):{' '}
            <b className={active ? 'text-green-700' : 'text-gray-700'}>{active ? active.name : 'Standard-Hero'}</b>
          </p>
        </div>
        <button type="button" role="switch" aria-checked={!!enabled} aria-label="Saisonale Hero-Bilder" disabled={saving || enabled == null} onClick={toggleMaster}
          className={`relative w-12 h-7 rounded-full transition ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      <div className={`mt-4 space-y-2 ${enabled ? '' : 'opacity-60'}`}>
        {rows.map((r) => {
          const isActive = active?.id === r.id;
          const bad = !r.start || !r.end || r.start > r.end;
          return (
            <div key={r.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-2.5 ${isActive ? 'border-green-400 bg-green-50/50' : 'border-gray-200'}`}>
              <div className="flex items-end gap-1.5 shrink-0">
                {heroSetReady(r.img) ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${DIR}/${r.img}-web-1200.webp`} alt="" loading="lazy" className="h-12 w-28 rounded-md object-cover object-right bg-gray-100" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${DIR}/${r.img}-mobile.webp`} alt="" loading="lazy" className="h-12 w-9 rounded-md object-cover bg-gray-100" />
                  </>
                ) : (
                  <div className="h-12 w-[154px] rounded-md bg-gray-100 text-[11px] text-gray-400 flex items-center justify-center">kein Bild</div>
                )}
              </div>
              <input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value.slice(0, 60) })} aria-label="Name"
                className="flex-1 min-w-[140px] text-sm font-semibold border rounded-lg px-2 py-1.5" />
              <label className="text-xs text-gray-500 flex items-center gap-1.5">von
                <input type="date" value={r.start} onChange={(e) => patch(r.id, { start: e.target.value })}
                  className={`text-sm text-gray-900 border rounded-lg px-2 py-1.5 ${bad ? 'border-red-400' : ''}`} />
              </label>
              <label className="text-xs text-gray-500 flex items-center gap-1.5">bis
                <input type="date" value={r.end} onChange={(e) => patch(r.id, { end: e.target.value })}
                  className={`text-sm text-gray-900 border rounded-lg px-2 py-1.5 ${bad ? 'border-red-400' : ''}`} />
              </label>
              {!heroSetReady(r.img) && <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 rounded-full px-2 py-0.5" title="Für diesen Zeitraum gibt es noch kein fertiges Bild — es erscheint das Standard-Hero">Bild fehlt</span>}
              {isActive && <span className="text-[11px] font-bold text-green-700 bg-green-100 rounded-full px-2 py-0.5">Heute aktiv</span>}
              {overlaps.has(r.id) && <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5" title="Überschneidet sich mit einem anderen Zeitraum — der später beginnende gewinnt (z. B. Halloween in den Herbstferien)">Überschneidung</span>}
              <div className="flex items-center gap-2 ml-auto">
                {heroSetReady(r.img) && <a href={`/?heroPreview=${r.img}`} target="_blank" rel="noreferrer" className="text-xs text-primary-700 hover:underline inline-flex items-center gap-1">
                  Vorschau <ExternalLink size={12} />
                </a>}
                <button type="button" role="switch" aria-checked={r.enabled} aria-label={`${r.name} aktiv`} onClick={() => patch(r.id, { enabled: !r.enabled })}
                  className={`relative w-10 h-6 rounded-full transition ${r.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${r.enabled ? 'translate-x-4' : ''}`} />
                </button>
                <button type="button" aria-label={`${r.name} löschen`} onClick={() => { if (window.confirm(`„${r.name}“ aus dem Kalender entfernen?`)) remove(r.id); }}
                  className="p-1.5 text-gray-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
        {enabled != null && rows.length === 0 && <p className="text-sm text-gray-500">Noch kein Zeitraum angelegt.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600 inline-flex items-center gap-2">
          <Plus size={16} />
          <select value="" onChange={(e) => add(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5 bg-white">
            <option value="">Zeitraum hinzufügen (Bild wählen)…</option>
            {HERO_IMAGE_SETS.filter((s) => s.text).map((s) => <option key={s.img} value={s.img}>{s.label}</option>)}
          </select>
        </label>
        <button type="button" disabled={!dirty || saving} onClick={save}
          className="ml-auto px-4 py-2 text-sm font-semibold rounded-lg bg-primary-900 text-white disabled:opacity-40">
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
      {msg && <p className={`text-sm mt-2 ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}
