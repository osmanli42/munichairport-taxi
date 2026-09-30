'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, GraduationCap, ListChecks, Lock, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/dashboard/shared';
import { Empty } from '@/components/seo/common';
import { adsApi, eur0, Chip, CopyBox, PRIORITY, CATEGORY } from './common';

const CL_CAT: Record<string, string> = { bidding: 'Teklif stratejisi', budget: 'Bütçe', keywords: 'Kelimeler', ads: 'Reklam metni', targeting: 'Hedefleme', campaign: 'Kampanya', tracking: 'Tracking', other: 'Diğer' };

export default function Coach({ days, onChanged }: { days: number; onChanged?: () => void }) {
  const [d, setD] = useState<any>(null);
  const [log, setLog] = useState<any>(null);
  const [view, setView] = useState<'open' | 'done' | 'ignored'>('open');
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ day: new Date().toISOString().slice(0, 10), campaign: '', category: 'bidding', note: '', learning: true });

  const load = useCallback(() => {
    adsApi(`/coach?days=${days}`).then(setD).catch(() => setD({ tasks: [] }));
    adsApi('/changelog').then(setLog).catch(() => setLog({ entries: [] }));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  async function mark(t: any, status: string) {
    await adsApi(`/coach/${encodeURIComponent(t.key)}`, { method: 'PUT', body: JSON.stringify({ status, title: t.title }) });
    load();
    onChanged?.();
  }
  async function addLog() {
    if (!form.note.trim()) return;
    await adsApi('/changelog', { method: 'POST', body: JSON.stringify(form) });
    setForm({ ...form, note: '' });
    load();
  }
  async function delLog(id: number) {
    if (!confirm('Bu kaydı sil?')) return;
    await adsApi(`/changelog/${id}`, { method: 'DELETE' });
    load();
  }

  if (!d || !log) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;
  const list = d.tasks.filter((t: any) => t.status === view);
  const counts = { open: 0, done: 0, ignored: 0 } as Record<string, number>;
  for (const t of d.tasks) counts[t.status]++;
  const impact = d.tasks.filter((t: any) => t.status === 'open').reduce((a: number, t: any) => a + (t.impact || 0), 0);

  return (
    <div className="space-y-6">
      {d.guard && (
        <div className="flex items-start gap-3 rounded-2xl bg-sky-50 ring-1 ring-sky-200 px-5 py-4 text-sm text-sky-900">
          <GraduationCap className="text-sky-600 shrink-0 mt-0.5" size={20} />
          <div><b>Öğrenme dönemi {new Date(d.guard.until).toLocaleDateString('de-DE')}'a kadar.</b> Teklif ve bütçe görevleri <Lock size={12} className="inline" /> ile işaretli — o tarihe kadar bekle. Negatif kelime, arama terimi ve reklam metni işleri serbest.</div>
        </div>
      )}

      <Card title="Koç — yapılacaklar" icon={ListChecks} right={
        <div className="flex items-center gap-3">
          {impact > 0 && view === 'open' && <span className="text-xs font-semibold text-emerald-700">toplam etki ~{eur0(impact)}/ay</span>}
          <div className="flex rounded-lg bg-gray-50 ring-1 ring-gray-200 p-0.5 text-xs">
            {(['open', 'done', 'ignored'] as const).map((k) => (
              <button key={k} onClick={() => setView(k)} className={cn('px-2.5 py-1 rounded-md font-medium', view === k ? 'bg-primary-600 text-white' : 'text-gray-600')}>
                {k === 'open' ? 'Açık' : k === 'done' ? 'Yapıldı' : 'Yoksayıldı'} ({counts[k]})
              </button>
            ))}
          </div>
        </div>
      }>
        {list.length === 0 ? <Empty>{view === 'open' ? 'Açık görev yok ✓' : 'Yok'}</Empty> : (
          <ul className="divide-y divide-gray-100">
            {list.map((t: any) => (
              <li key={t.key} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <Chip className={PRIORITY[t.priority][1]}>{PRIORITY[t.priority][0]}</Chip>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => setOpen(open === t.key ? null : t.key)} className="text-left">
                      <div className="font-semibold text-gray-900">{t.blockedByLearning && <Lock size={13} className="inline mr-1 text-sky-600" />}{t.title}</div>
                      <div className="text-xs text-gray-500">{CATEGORY[t.category]}{t.impact ? ` · etki ~${eur0(t.impact)}/ay` : ''}</div>
                    </button>
                    {open === t.key && (
                      <div className="mt-2 text-sm text-gray-700 space-y-2">
                        <p>{t.detail}</p>
                        {t.steps?.length > 0 && (
                          <ol className="list-decimal pl-5 space-y-0.5 text-gray-600">{t.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>
                        )}
                        {t.copy && <CopyBox text={t.copy} />}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                    {t.status !== 'done' && <button onClick={() => mark(t, 'done')} className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"><CheckCircle2 size={13} /> Yapıldı</button>}
                    {t.status !== 'ignored' && <button onClick={() => mark(t, 'ignored')} className="text-gray-400 hover:underline">Yoksay</button>}
                    {t.status !== 'open' && <button onClick={() => mark(t, 'open')} className="text-primary-600 hover:underline">Geri al</button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Değişiklik günlüğü" icon={BookOpen} right={<span className="text-xs text-gray-400">Google Ads'te ne zaman ne değişti — öğrenme dönemi buradan sayılır</span>}>
        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-2 border-b border-gray-100">
          <input type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className="md:col-span-2 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
          <input value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} placeholder="Kampanya (ops.)" className="md:col-span-2 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, learning: ['bidding', 'budget'].includes(e.target.value) })} className="md:col-span-2 rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
            {Object.entries(CL_CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ne değişti? (ör. Tagesbudget 40 → 48 €)" className="md:col-span-4 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" onKeyDown={(e) => { if (e.key === 'Enter') addLog(); }} />
          <label className="md:col-span-1 inline-flex items-center gap-1.5 text-xs text-gray-600" title="14 gün öğrenme dönemi başlatır"><input type="checkbox" checked={form.learning} onChange={(e) => setForm({ ...form, learning: e.target.checked })} /> öğrenme</label>
          <button onClick={addLog} className="md:col-span-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"><Plus size={13} /> Ekle</button>
        </div>
        {log.entries.length === 0 ? <Empty>Henüz kayıt yok</Empty> : (
          <ul className="divide-y divide-gray-100">
            {log.entries.map((e: any) => (
              <li key={e.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-gray-500">{new Date(e.day).toLocaleDateString('de-DE')}</span>
                <Chip className="bg-gray-100 text-gray-600">{CL_CAT[e.category] || e.category}</Chip>
                <span className="flex-1 min-w-0 truncate text-gray-800">{e.campaign ? <b>{e.campaign}: </b> : null}{e.note}</span>
                {e.learning ? <Chip className="bg-sky-100 text-sky-700">öğrenme</Chip> : null}
                <button onClick={() => delLog(e.id)} className="text-gray-300 hover:text-red-500" aria-label="Sil"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
