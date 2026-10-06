'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, Download, KeyRound, Link2, RefreshCw, Settings2, Tag, Trash2, Upload, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, Switch } from '@/components/dashboard/shared';
import { Empty } from '@/components/seo/common';
import { adsApi, API_BASE, token, eur0, eur2, num, CopyBox, readCsvFile } from './common';

const KIND: Record<string, string> = { campaigns: 'Kampagnen', search_terms: 'Suchbegriffe', keywords: 'Keywords' };
const fmt = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function DataTab({ onChanged }: { onChanged?: () => void }) {
  const [d, setD] = useState<any>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState<any>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [spend, setSpend] = useState({ from: '', to: '', total: '' });
  const [spendMsg, setSpendMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    adsApi('/imports').then((r) => {
      setD(r);
      setCfg(r.settings);
      setNames(Object.fromEntries(r.campaignNames.map((n: any) => [n.campaign_id, n.name])));
    }).catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMsg(null);
    const done: string[] = [];
    try {
      for (const f of Array.from(files)) {
        const csv = await readCsvFile(f);
        const r = await adsApi('/imports', { method: 'POST', body: JSON.stringify({ filename: f.name, csv }) });
        done.push(`${f.name}: ${KIND[r.kind]} · ${r.rows} satır${r.from ? ` (${r.from} – ${r.to})` : ''}`);
      }
      setMsg({ ok: true, text: `Yüklendi — ${done.join(' · ')}` });
      load();
      onChanged?.();
    } catch (e: any) {
      setMsg({ ok: false, text: `${done.length ? `${done.join(' · ')} — ` : ''}${e.message}` });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeImport(id: number) {
    if (!confirm('Bu yüklemeyi sil?')) return;
    await adsApi(`/imports/${id}`, { method: 'DELETE' });
    load();
    onChanged?.();
  }

  async function saveSettings(patch: Record<string, unknown>) {
    const r = await adsApi('/settings', { method: 'PUT', body: JSON.stringify(patch) });
    setCfg(r);
    onChanged?.();
  }

  async function saveName(id: string) {
    await adsApi(`/campaign-names/${id}`, { method: 'PUT', body: JSON.stringify({ name: names[id] || '' }) });
    load();
  }

  async function downloadOffline(all: boolean) {
    const res = await fetch(`${API_BASE}/admin/ads/v2/offline-export${all ? '?all=1&record=0' : ''}`, { headers: { Authorization: `Bearer ${token()}` } });
    if (!res.ok) { setMsg({ ok: false, text: 'Dosya oluşturulamadı' }); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `google-ads-offline-conversions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg({ ok: true, text: `${res.headers.get('X-Rows') || '?'} satırlık dosya indirildi. Google Ads → Ziele → Uploads → Hochladen.` });
    load();
    onChanged?.();
  }

  async function saveSpend() {
    setSpendMsg('');
    const res = await fetch(`${API_BASE}/admin/ads/spend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ from: spend.from, to: spend.to, total: parseFloat(spend.total.replace(',', '.')) }),
    });
    const j = await res.json().catch(() => ({}));
    setSpendMsg(res.ok ? `✓ ${j.days} güne dağıtıldı (günlük ${j.perDay} €)` : `✕ ${j.error || 'Kaydedilemedi'}`);
  }

  if (!d || !cfg) return <div className="h-64 bg-white rounded-2xl animate-pulse" />;
  const trk = d.tracking;
  const tagged = trk.tagged7d > 0;

  return (
    <div className="space-y-6">
      {d.reminder?.due && (
        <button onClick={() => fileRef.current?.click()} className="w-full text-left flex items-center gap-3 rounded-2xl bg-red-50 ring-1 ring-red-200 px-5 py-4 hover:bg-red-100">
          <AlertTriangle className="text-red-600 shrink-0" size={22} />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-red-800">Bu haftanın Google Ads raporları henüz yüklenmedi</div>
            <div className="text-red-700">Kampagnen (+ Suchbegriffe, Keywords) CSV'lerini yükle; menüdeki 1 ve Handlungsbedarf satırı kaybolur.{d.reminder.lastUpload && <> Son: {fmt(d.reminder.lastUpload)}.</>}</div>
          </div>
          <Upload size={18} className="text-red-700 shrink-0" />
        </button>
      )}

      {/* Reports */}
      <Card title="Google Ads raporları (CSV)" icon={Upload} right={
        <div className="flex items-center gap-4">
          <Switch on={cfg.reminder} onChange={() => saveSettings({ reminder: !cfg.reminder })} label="Haftalık hatırlatma" />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            <Upload size={13} /> {busy ? 'Yükleniyor…' : 'CSV yükle'}
          </button>
        </div>
      }>
        <input ref={fileRef} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        <div className="p-5 text-sm text-gray-600 space-y-3">
          <p>Haftada bir (ör. pazartesi) üç rapor — üçünü aynı anda seçip yükleyebilirsin; tür otomatik tanınır, aynı günler tekrar yüklenirse üzerine yazılır:</p>
          <ol className="list-decimal pl-5 space-y-1 text-gray-700">
            <li><b>Kampagnen</b>: Google Ads → Kampagnen → Zeitraum „Letzte 30 Tage“ → <b>Segment → Zeit → Tag</b> → Herunterladen ⬇ → CSV. (Spalten: Kosten, Klicks, Impr., Conversions, „Anteil an möglichen Impressionen“ ve „entgangenen … (Budget/Rang)“ ekliyse daha iyi; „Kampagnen-ID“ sütunu adları otomatik eşler.)</li>
            <li><b>Suchbegriffe</b>: Kampagnen → Keywords → Suchbegriffe → Herunterladen → CSV.</li>
            <li><b>Keywords</b>: Kampagnen → Keywords → Spalten: Qualitätsfaktor ekle → Herunterladen → CSV.</li>
          </ol>
          {msg && <div className={cn('rounded-lg px-3 py-2 text-xs', msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700')}>{msg.text}</div>}
          {d.imports.length > 0 && (
            <ul className="text-xs space-y-1 pt-1">
              {d.imports.map((i: any) => (
                <li key={i.id} className="flex items-center gap-2">
                  <span className="text-gray-400 tabular-nums w-28">{fmt(i.created_at)}</span>
                  <span className="rounded bg-gray-100 px-1.5 text-gray-600">{KIND[i.kind] || i.kind}</span>
                  <span className="truncate text-gray-700">{i.filename}</span>
                  <span className="text-gray-400">{num(i.rows_count)} satır{i.period_from ? ` · ${i.period_from} – ${i.period_to}` : ''}</span>
                  <button onClick={() => removeImport(i.id)} className="ml-auto text-gray-300 hover:text-red-500" aria-label="Sil"><Trash2 size={13} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <ScriptCard />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Final URL suffix */}
        <Card title="Kelime takibi (Final-URL-Suffix)" icon={Link2} right={tagged
          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14} /> aktif</span>
          : <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><AlertTriangle size={14} /> kurulmadı</span>}>
          <div className="p-5 text-sm text-gray-600 space-y-2">
            <p>Bir kez eklenir; her reklam tıklamasında hangi kelime/eşleme tipi/ağ olduğu kaydedilir → kelime başına <b>gerçek rezervasyon ve ciro</b>. Teklif stratejisini ve öğrenmeyi etkilemez.</p>
            <ol className="list-decimal pl-5 space-y-0.5 text-gray-700">
              <li>Google Ads → Verwaltung (🔧) → <b>Kontoeinstellungen</b></li>
              <li><b>Tracking</b> → „Final-URL-Suffix“ alanına yapıştır → Speichern</li>
            </ol>
            <CopyBox text={d.finalUrlSuffix} />
            <div className="text-xs text-gray-500">Son 7 gün: {trk.tagged7d}/{trk.clicks7d} reklam tıkı kelime bilgili{trk.lastTagged ? ` · son: ${fmt(trk.lastTagged)}` : ''}</div>
          </div>
        </Card>

        {/* Offline conversions */}
        <Card title="Gerçek ciroyu Google'a bildir (offline conversion)" icon={Download}>
          <div className="p-5 text-sm text-gray-600 space-y-3">
            <div className="flex items-baseline justify-between">
              <span><b className="text-2xl text-gray-900 tabular-nums">{d.offline.pending}</b> yeni rezervasyon</span>
              <span className="font-semibold text-emerald-700">{eur0(d.offline.pendingValue)}</span>
            </div>
            <p className="text-xs">Fahrt'ı gerçekleşmiş, iptal edilmemiş, reklam tıkından gelen rezervasyonlar (gclid ≤ 90 gün). Önceden indirilenler tekrar gelmez.{d.offline.last && <> Son dosya: {fmt(d.offline.last.created_at)} · {d.offline.last.rows_count} satır.</>}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => downloadOffline(false)} disabled={!d.offline.pending} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-40"><Download size={13} /> Yeni dosyayı indir</button>
              <button onClick={() => downloadOffline(true)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-600 ring-1 ring-primary-200 hover:bg-primary-50">Son 85 günün tamamı (kaydetmeden)</button>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-gray-700">İlk kurulum (bir kez, sekundär)</summary>
              <ol className="mt-1 list-decimal pl-5 space-y-0.5">
                <li>Google Ads → Ziele → Conversions → + Neue Conversion-Aktion → <b>Import</b></li>
                <li>„Andere Datenquellen oder CRMs“ → „Conversions aus Klicks verfolgen“</li>
                <li>Name: <b>{cfg.conversionName}</b> · Wert: „Für jede Conversion unterschiedliche Werte“ · Zählweise: „Eine“</li>
                <li>Aktionsoptimierung: <b>Sekundär</b> (teklifleri etkilemez) → Speichern</li>
                <li>Ziele → Uploads → + → dosyayı seç → Hochladen (haftada bir)</li>
              </ol>
            </details>
          </div>
        </Card>

        {/* Settings */}
        <Card title="Ayarlar" icon={Settings2}>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {([
              ['targetCpa', 'Hedef CPA (€)', 'Google Ads\'teki Ziel-CPA ile aynı'],
              ['monthlyBudget', 'Aylık bütçe (€)', 'Bütçe temposu için; 0 = yok'],
              ['marginPct', 'Brüt marj (%)', 'Cirodan sürücü/araç maliyeti sonrası kalan'],
            ] as const).map(([k, label, hint]) => (
              <label key={k} className="block">
                <span className="text-xs font-semibold text-gray-600">{label}</span>
                <input type="number" step="0.5" defaultValue={cfg[k]} onBlur={(e) => { if (e.target.value !== String(cfg[k])) saveSettings({ [k]: e.target.value }); }}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5" />
                <span className="text-[11px] text-gray-400">{hint}</span>
              </label>
            ))}
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Offline conversion adı</span>
              <input defaultValue={cfg.conversionName} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== cfg.conversionName) saveSettings({ conversionName: e.target.value }); }}
                className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5" />
              <span className="text-[11px] text-gray-400">Google Ads'teki aksiyon adıyla birebir aynı olmalı</span>
            </label>
          </div>
        </Card>

        {/* Campaign names */}
        <Card title="Kampanya adları" icon={Tag}>
          {d.seenCampaigns.length === 0 ? <Empty>Son 90 günde kampanya ID'li tık yok.</Empty> : (
            <ul className="divide-y divide-gray-100">
              {d.seenCampaigns.map((c: any) => (
                <li key={c.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 font-mono text-xs text-gray-500">{c.id}</span>
                  <input value={names[c.id] || ''} onChange={(e) => setNames({ ...names, [c.id]: e.target.value })} onBlur={() => saveName(c.id)} placeholder="Kampanya adı"
                    className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1" />
                  <span className="text-xs text-gray-400 whitespace-nowrap">{num(c.clicks)} tık</span>
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 py-2 text-[11px] text-gray-400 border-t border-gray-100">Raporda „Kampagnen-ID“ sütunu varsa otomatik dolar.</div>
        </Card>

        {/* Manual spend (old way) */}
        <Card title="Toplam harcamayı elle gir (rapor yoksa)" icon={Wallet}>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm items-end">
            <label className="block"><span className="text-xs text-gray-500">Başlangıç</span><input type="date" value={spend.from} onChange={(e) => setSpend({ ...spend, from: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5" /></label>
            <label className="block"><span className="text-xs text-gray-500">Bitiş</span><input type="date" value={spend.to} onChange={(e) => setSpend({ ...spend, to: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5" /></label>
            <label className="block"><span className="text-xs text-gray-500">Toplam €</span><input value={spend.total} onChange={(e) => setSpend({ ...spend, total: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5" /></label>
            <button onClick={saveSpend} className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800">Günlere dağıt</button>
            {spendMsg && <div className="col-span-full text-xs text-gray-600">{spendMsg}</div>}
            <div className="col-span-full text-[11px] text-gray-400">Kampagnen raporu yüklenen günlerde rapordaki harcama kullanılır; bu sadece boşlukları doldurur.</div>
          </div>
        </Card>

        {/* API */}
        <Card title="Google Ads API (otomatik veri)" icon={KeyRound}>
          <div className="p-5 text-sm text-gray-600 space-y-2">
            <p>API bağlanınca CSV yüklemeye gerek kalmaz. Başvuru ücretsiz, onay 5–14 iş günü:</p>
            <ol className="list-decimal pl-5 space-y-0.5 text-gray-700">
              <li>Google Ads (info@freising.taxi, Konto 412-911-8147) → Verwaltung → <b>API-Center</b></li>
              <li>Formu doldur (kullanım: „Reporting für das eigene Konto“) → Developer-Token (Basic Access) iste</li>
              <li>Token gelince bana yaz; bağlantıyı kurarım.</li>
            </ol>
          </div>
        </Card>
      </div>
    </div>
  );
}

// Weekly reports without uploads: a Google Ads Script posts them to /api/ads-script/import.
function ScriptCard() {
  const [d, setD] = useState<{ script: string; last: any } | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { adsApi('/script').then(setD).catch((e) => setErr(e.message)); }, []);
  async function rotate() {
    if (!confirm('Yeni anahtar oluşturulsun mu? Google Ads\'teki script, yeni kod yapıştırılana kadar çalışmaz.')) return;
    setD(await adsApi('/script/rotate', { method: 'POST' }));
    setOpen(true);
  }
  const last = d?.last;
  const ok = last?.results?.length && last.results.every((r: any) => r.ok);
  return (
    <Card title="Otomatik rapor (Google Ads Script)" icon={Bot} right={last
      ? <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', ok ? 'text-emerald-700' : 'text-red-600')}>
          {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} son gönderim {fmt(last.at)}
        </span>
      : <span className="text-xs text-gray-400">henüz kurulmadı</span>}>
      <div className="p-5 text-sm text-gray-600 space-y-3">
        <p>Kurulunca üç rapor (Kampanyalar günlük, Suchbegriffe, Keywords; son 30 gün) her pazartesi sabahı kendiliğinden gelir; CSV yüklemeye gerek kalmaz. Script sadece rapor okur, reklam hesabında hiçbir şeyi değiştirmez.</p>
        <ol className="list-decimal pl-5 space-y-1 text-gray-700">
          <li>Google Ads → <b>Tools</b> → Massenaktionen → <b>Scripts</b> → ➕ <b>Neues Script</b></li>
          <li>Editördeki her şeyi silip aşağıdaki kodu yapıştır, adı: „Admin Wochenbericht“</li>
          <li><b>Autorisieren</b> → hesabını seç → Zulassen; sonra <b>Vorschau</b> yerine doğrudan <b>Ausführen</b></li>
          <li>Script listesinde Häufigkeit: <b>Wöchentlich, Montag, 6–7 Uhr</b></li>
        </ol>
        {last?.results && (
          <ul className="text-xs space-y-0.5">
            {last.results.map((r: any) => (
              <li key={r.filename} className={r.ok ? 'text-gray-600' : 'text-red-600'}>
                {r.ok ? `✓ ${KIND[r.kind] || r.kind}: ${num(r.rows)} satır${r.from ? ` (${r.from} – ${r.to})` : ''}` : `✗ ${r.filename}: ${r.error}`}
              </li>
            ))}
          </ul>
        )}
        {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
        <div className="flex items-center gap-4">
          <button onClick={() => setOpen((v) => !v)} disabled={!d} className="text-xs font-semibold text-primary-600 hover:underline disabled:opacity-50">
            {open ? 'Kodu gizle' : 'Script kodunu göster'}
          </button>
          <button onClick={rotate} disabled={!d} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 disabled:opacity-50">
            <RefreshCw size={12} /> Anahtarı yenile
          </button>
        </div>
        {open && d && <CopyBox text={d.script} label="Kodu kopyala" />}
        <p className="text-xs text-gray-400">Kod gizli bir anahtar içerir; başkasıyla paylaşma. Sızdıysa „Anahtarı yenile“ ve yeni kodu yapıştır.</p>
      </div>
    </Card>
  );
}
