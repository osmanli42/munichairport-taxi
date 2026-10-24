'use client';

// Marketing → Kampagnenkalender: Anlässe der nächsten 12 Monate als Karten (fällige zuerst),
// „Hazırla“ füllt den Editor, „Atla“ beendet die Erinnerung, ⚙️ speichert eigene Vorgaben.

import { useState } from 'react';
import { CalendarDays, Settings2, Plus, X, Check, RotateCcw, Bell, BellOff, Trash2 } from 'lucide-react';
import { marketingApi, MkOccasion, MkMode, MkSegment } from '@/lib/api';
import { cn } from '@/lib/utils';
import { dmy, dm, SEGMENTS, SEGMENT_LABEL } from './helpers';

const STATUS: Record<MkOccasion['status'], { label: string; cls: string }> = {
  due: { label: 'Şimdi gönder', cls: 'bg-amber-100 text-amber-800' },
  upcoming: { label: 'Yakında', cls: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Gönderildi', cls: 'bg-green-100 text-green-700' },
  skipped: { label: 'Atlandı', cls: 'bg-gray-100 text-gray-500' },
  missed: { label: 'Kaçtı', cls: 'bg-gray-100 text-gray-500' },
};
const GROUP: Record<MkOccasion['group'], string> = { ferien: 'Okul tatili', fest: 'Bayram / tebrik', business: 'Firma · Messe', season: 'Sezon', custom: 'Kendi anlasın' };
const errOf = (e: any, fb: string) => e?.response?.data?.error || e?.message || fb;

export default function CampaignCalendar({ occasions, remindersEnabled, selectedId, onPrepare, onChanged, sourceErrors }: {
  occasions: MkOccasion[];
  remindersEnabled: boolean;
  selectedId: string | null;
  onPrepare: (o: MkOccasion) => void;
  onChanged: () => void;
  sourceErrors: string[];
}) {
  const [settings, setSettings] = useState<MkOccasion | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const order = { due: 0, upcoming: 1, sent: 2, skipped: 3, missed: 4 } as const;
  const list = [...occasions].sort((a, b) => (order[a.status] - order[b.status]) || a.remindFrom.localeCompare(b.remindFrom));
  const dueCount = occasions.filter(o => o.enabled && o.status === 'due').length;

  const act = async (o: MkOccasion, fn: () => Promise<unknown>) => {
    setBusy(o.key); setErr('');
    try { await fn(); onChanged(); } catch (e) { setErr(errOf(e, 'İşlem başarısız')); }
    setBusy(null);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center"><CalendarDays size={17} className="text-amber-600" /></div>
          <div>
            <p className="font-bold text-gray-900">Kampanya takvimi {dueCount > 0 && <span className="ml-1 text-xs font-bold bg-amber-500 text-white rounded-full px-2 py-0.5 align-middle">{dueCount} bekliyor</span>}</p>
            <p className="text-xs text-gray-500">Okul tatilleri, bayramlar, Black Week, Oktoberfest ve büyük fuarlar · zamanı gelince Dashboard'da hatırlatılır</p>
          </div>
        </div>
        <button onClick={async () => {
          try { await marketingApi.setReminders(!remindersEnabled); onChanged(); } catch (e) { setErr(errOf(e, 'Kaydedilemedi')); }
        }}
          className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border', remindersEnabled ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500')}>
          {remindersEnabled ? <Bell size={14} /> : <BellOff size={14} />} Hatırlatmalar {remindersEnabled ? 'açık' : 'kapalı'}
        </button>
      </div>
      {err && <div className="mx-5 mb-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{err}</div>}
      {sourceErrors.length > 0 && <div className="mx-5 mb-2 text-xs text-amber-700">Bazı tarih kaynakları yüklenemedi (okul tatili / fuar): {sourceErrors.join(' · ')}</div>}

      <div className="flex gap-3 overflow-x-auto px-5 pb-4 snap-x">
        {list.map(o => {
          const st = STATUS[o.status];
          const selected = selectedId === o.key;
          return (
            <div key={o.key} className={cn('snap-start shrink-0 w-[230px] rounded-xl border p-3 flex flex-col gap-2 transition',
              selected ? 'border-primary-500 ring-2 ring-primary-200' : o.status === 'due' && o.enabled ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200',
              !o.enabled && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{GROUP[o.group]}</span>
                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap', !o.enabled ? 'bg-gray-100 text-gray-500' : st.cls)}>
                  {!o.enabled ? 'kapalı' : o.status === 'sent' && o.sentAt ? `✓ ${dm(o.sentAt.slice(0, 10))}` : st.label}
                </span>
              </div>
              <div>
                <p className="font-bold text-gray-900 leading-snug">{o.texts.de.badge.split(' ')[0]} {o.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {dmy(o.date)}{o.end && o.end !== o.date ? `–${dm(o.end)}` : ''} · {o.daysLeft > 0 ? `${o.daysLeft} gün kaldı` : o.daysLeft === 0 ? 'bugün' : 'devam ediyor'}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded', o.mode === 'discount' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700')}>
                  {o.mode === 'discount' ? `−%${o.percent}${o.maxAmount ? ` (max ${o.maxAmount} €)` : ''}` : 'Sadece tebrik'}
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{SEGMENT_LABEL[o.segment]}</span>
              </div>
              <p className="text-[11px] text-gray-400">Hatırlatma {dm(o.remindFrom)} – {dm(o.remindUntil)}</p>
              <div className="mt-auto flex items-center gap-1.5">
                <button onClick={() => onPrepare(o)}
                  className={cn('flex-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg',
                    o.status === 'due' && o.enabled ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50')}>
                  {o.status === 'sent' ? 'Tekrar hazırla' : 'Hazırla'}
                </button>
                {(o.status === 'due' || o.status === 'upcoming') && (
                  <button title="Bu yıl atla" disabled={busy === o.key} onClick={() => act(o, () => marketingApi.skip(o.id, o.year))}
                    className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">Atla</button>
                )}
                {o.status === 'skipped' && (
                  <button title="Atlamayı geri al" disabled={busy === o.key} onClick={() => act(o, () => marketingApi.unskip(o.id, o.year))}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><RotateCcw size={13} /></button>
                )}
                <button title="Ayarlar" onClick={() => setSettings(o)} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><Settings2 size={13} /></button>
              </div>
            </div>
          );
        })}
        <button onClick={() => setAdding(true)}
          className="snap-start shrink-0 w-[170px] rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-primary-300 hover:text-primary-700 flex flex-col items-center justify-center gap-1.5 text-sm font-semibold">
          <Plus size={18} /> Kendi anlasını ekle
          <span className="text-[11px] font-normal text-gray-400 px-3 text-center">ör. firma yıl dönümü</span>
        </button>
      </div>

      {settings && <SettingsModal o={settings} onClose={() => setSettings(null)} onSaved={() => { setSettings(null); onChanged(); }} />}
      {adding && <CustomModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChanged(); }} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-10 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-gray-900">{title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const input = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500';
const label = 'block text-xs font-semibold text-gray-600 mb-1';

function SettingsModal({ o, onClose, onSaved }: { o: MkOccasion; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ enabled: o.enabled, leadDays: o.leadDays, segment: o.segment, mode: o.mode, percent: o.percent, validDays: o.validDays, maxAmount: o.maxAmount });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('');
    try { await fn(); onSaved(); } catch (e) { setErr(errOf(e, 'Kaydedilemedi')); }
    setBusy(false);
  };
  return (
    <Modal title={`Ayarlar · ${o.name}`} onClose={onClose}>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input type="checkbox" checked={f.enabled} onChange={e => setF({ ...f, enabled: e.target.checked })} /> Bu anlası takvimde hatırlat
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Kaç gün önce hatırlat</label>
            <input type="number" min={0} max={90} className={input} value={f.leadDays} onChange={e => setF({ ...f, leadDays: Number(e.target.value) })} />
          </div>
          <div>
            <label className={label}>Hedef</label>
            <select className={input} value={f.segment} onChange={e => setF({ ...f, segment: e.target.value as MkSegment })}>
              {SEGMENTS.filter(s => s.key !== 'recent' && s.key !== 'lapsed' && s.key !== 'none').map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={label}>Varsayılan içerik</label>
          <div className="grid grid-cols-2 gap-2">
            {(['greeting', 'discount'] as MkMode[]).map(m => (
              <button key={m} onClick={() => setF({ ...f, mode: m })}
                className={cn('text-sm px-3 py-2 rounded-lg border font-semibold', f.mode === m ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-700')}>
                {m === 'greeting' ? 'Sadece tebrik' : 'Tebrik + indirim'}
              </button>
            ))}
          </div>
        </div>
        {f.mode === 'discount' && (
          <div className="grid grid-cols-3 gap-3">
            <div><label className={label}>İndirim %</label><input type="number" min={1} max={30} className={input} value={f.percent} onChange={e => setF({ ...f, percent: Number(e.target.value) })} /></div>
            <div><label className={label}>Geçerlilik (gün)</label><input type="number" min={1} max={365} className={input} value={f.validDays} onChange={e => setF({ ...f, validDays: Number(e.target.value) })} /></div>
            <div><label className={label}>En fazla €</label><input type="number" min={0} className={input} value={f.maxAmount ?? ''} placeholder="sınırsız" onChange={e => setF({ ...f, maxAmount: e.target.value ? Number(e.target.value) : null })} /></div>
          </div>
        )}
        {err && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{err}</div>}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button disabled={busy} onClick={() => run(() => marketingApi.saveOccasion(o.id, f))}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg disabled:opacity-50"><Check size={15} /> Kaydet</button>
          {!o.isDefault && o.group !== 'custom' && (
            <button disabled={busy} onClick={() => run(() => marketingApi.resetOccasion(o.id))} className="text-sm font-semibold text-gray-600 px-3 py-2">Önerilene dön</button>
          )}
          {o.group === 'custom' && (
            <button disabled={busy} onClick={() => run(() => marketingApi.deleteCustom(o.id))} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-red-600 px-3 py-2"><Trash2 size={14} /> Anlası sil</button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CustomModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: '', date: '', leadDays: 7, segment: 'all' as MkSegment, mode: 'greeting' as MkMode, percent: 10, subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try {
      await marketingApi.addCustom({ ...f, monthDay: f.date.slice(5, 10) });
      onSaved();
    } catch (e) { setErr(errOf(e, 'Kaydedilemedi')); }
    setBusy(false);
  };
  return (
    <Modal title="Kendi anlasını ekle (her yıl tekrarlanır)" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Ad</label><input className={input} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="ör. 10 Jahre Flughafen-Taxi" /></div>
          <div><label className={label}>Tarih (her yıl)</label><input type="date" className={input} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={label}>Kaç gün önce</label><input type="number" min={0} max={60} className={input} value={f.leadDays} onChange={e => setF({ ...f, leadDays: Number(e.target.value) })} /></div>
          <div><label className={label}>Hedef</label>
            <select className={input} value={f.segment} onChange={e => setF({ ...f, segment: e.target.value as MkSegment })}>
              {SEGMENTS.filter(s => s.key !== 'recent' && s.key !== 'lapsed' && s.key !== 'none').map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div><label className={label}>İçerik</label>
            <select className={input} value={f.mode} onChange={e => setF({ ...f, mode: e.target.value as MkMode })}>
              <option value="greeting">Sadece tebrik</option><option value="discount">Tebrik + indirim</option>
            </select>
          </div>
        </div>
        <div><label className={label}>E-posta konusu (Almanca)</label><input className={input} value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} /></div>
        <div><label className={label}>Mesaj (Almanca; EN/TR gönderirken düzenlenebilir)</label><textarea rows={4} className={input} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} /></div>
        {err && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{err}</div>}
        <button disabled={busy || !f.name.trim() || !f.date} onClick={save}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg disabled:opacity-50"><Check size={15} /> Ekle</button>
      </div>
    </Modal>
  );
}
