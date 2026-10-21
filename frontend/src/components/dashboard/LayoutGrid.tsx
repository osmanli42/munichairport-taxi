'use client';

// Frei anordnbares Dashboard: Reihenfolge, Breite (¼ … ganz) und "hoch" (2 Zeilen) je Bereich.
// Gespeichert pro Browser in localStorage. Ziehen per Maus (HTML5 Drag & Drop) oder ↑/↓.

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, EyeOff, GripVertical, Rows3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WidgetSize = 3 | 4 | 6 | 8 | 12;
export type LayoutEntry = { id: string; w: WidgetSize; tall?: boolean };

const STORE_KEY = 'dash_layout_v1';
const SIZES: Array<[WidgetSize, string, string]> = [
  [3, '¼', 'Viertel'], [4, '⅓', 'Drittel'], [6, '½', 'Halbe Breite'], [8, '⅔', 'Zwei Drittel'], [12, '1', 'Volle Breite'],
];
// Literale Klassen, damit Tailwind sie findet. Unter xl: kleine Bereiche halbe, große volle Breite.
const SPAN: Record<WidgetSize, string> = {
  3: 'col-span-12 md:col-span-6 xl:col-span-3',
  4: 'col-span-12 md:col-span-6 xl:col-span-4',
  6: 'col-span-12 xl:col-span-6',
  8: 'col-span-12 xl:col-span-8',
  12: 'col-span-12',
};

function merge(saved: LayoutEntry[] | null, defaults: LayoutEntry[]): LayoutEntry[] {
  if (!saved?.length) return defaults;
  const known = new Set(defaults.map((d) => d.id));
  const out = saved.filter((e) => known.has(e.id) && SPAN[e.w]);
  const have = new Set(out.map((e) => e.id));
  // Neue Bereiche (nach einem Update) an ihrer Standardposition einfügen
  defaults.forEach((d, i) => {
    if (have.has(d.id)) return;
    const prev = defaults.slice(0, i).reverse().find((p) => have.has(p.id));
    const at = prev ? out.findIndex((e) => e.id === prev.id) + 1 : 0;
    out.splice(at, 0, d);
    have.add(d.id);
  });
  return out;
}

export function useDashLayout(defaults: LayoutEntry[]) {
  const [layout, setLayout] = useState<LayoutEntry[]>(defaults);
  useEffect(() => {
    try { setLayout(merge(JSON.parse(localStorage.getItem(STORE_KEY) || 'null'), defaults)); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const save = useCallback((next: LayoutEntry[]) => {
    setLayout(next);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);
  const move = (id: string, targetId: string, before: boolean) => {
    if (id === targetId) return;
    const item = layout.find((e) => e.id === id);
    if (!item) return;
    const rest = layout.filter((e) => e.id !== id);
    const t = rest.findIndex((e) => e.id === targetId);
    rest.splice(before ? t : t + 1, 0, item);
    save(rest);
  };
  const step = (id: string, dir: -1 | 1, visible: string[]) => {
    const vi = visible.indexOf(id);
    const target = visible[vi + dir];
    if (target) move(id, target, dir === -1);
  };
  const update = (id: string, patch: Partial<LayoutEntry>) => save(layout.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const reset = () => {
    setLayout(defaults);
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
  };
  return { layout, move, step, update, reset };
}

export type DashLayout = ReturnType<typeof useDashLayout>;

export function DashGrid({ lay, editing, blocks, labels, fixed, onHide }: {
  lay: DashLayout;
  editing: boolean;
  /** Inhalt je Bereich; null/undefined = ausgeblendet oder ohne Daten */
  blocks: Record<string, ReactNode>;
  labels: Record<string, string>;
  /** Bereiche ohne „Ausblenden“ (immer sichtbar) */
  fixed: string[];
  onHide: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; before: boolean } | null>(null);
  const visible = lay.layout.filter((e) => blocks[e.id] != null).map((e) => e.id);

  return (
    <div className="grid grid-cols-12 items-start gap-5 [grid-auto-flow:dense]">
      {lay.layout.map((e) => {
        const node = blocks[e.id];
        if (node == null) return null;
        const isTarget = drop?.id === e.id && dragId && dragId !== e.id;
        return (
          <div
            key={e.id}
            draggable={editing}
            onDragStart={(ev) => { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', e.id); setDragId(e.id); }}
            onDragEnd={() => { setDragId(null); setDrop(null); }}
            onDragOver={(ev) => {
              if (!editing || !dragId) return;
              ev.preventDefault();
              const r = ev.currentTarget.getBoundingClientRect();
              // Breite Bereiche: oben/unten, schmale: links/rechts
              const before = e.w === 12 || r.width > window.innerWidth * 0.6
                ? ev.clientY < r.top + r.height / 2
                : ev.clientX < r.left + r.width / 2;
              if (drop?.id !== e.id || drop.before !== before) setDrop({ id: e.id, before });
            }}
            onDrop={(ev) => {
              ev.preventDefault();
              const id = ev.dataTransfer.getData('text/plain') || dragId;
              if (id && drop) lay.move(id, e.id, drop.before);
              setDragId(null); setDrop(null);
            }}
            className={cn(
              SPAN[e.w], e.tall && 'xl:row-span-2', 'relative min-w-0', !editing && '[&:has(>div:empty)]:hidden',
              editing && 'rounded-2xl outline-dashed outline-2 outline-offset-4 outline-blue-300',
              editing && dragId === e.id && 'opacity-40',
              isTarget && 'outline-blue-600',
            )}
          >
            {isTarget && (
              <span className={cn('pointer-events-none absolute z-20 rounded-full bg-blue-600',
                e.w === 12 ? 'inset-x-0 h-1' : 'inset-y-0 w-1',
                e.w === 12 ? (drop!.before ? '-top-3' : '-bottom-3') : (drop!.before ? '-left-3' : '-right-3'))} />
            )}
            {editing && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-blue-600 px-2 py-1.5 text-white shadow-sm">
                <span className="flex cursor-grab items-center gap-1 pr-1 text-sm font-semibold active:cursor-grabbing" title="Ziehen zum Verschieben">
                  <GripVertical size={16} aria-hidden /> {labels[e.id] || e.id}
                </span>
                <span className="ml-auto flex items-center gap-0.5 rounded-lg bg-white/15 p-0.5" role="group" aria-label="Breite">
                  {SIZES.map(([w, sym, title]) => (
                    <button key={w} type="button" title={title} aria-pressed={e.w === w} onClick={() => lay.update(e.id, { w })}
                      className={cn('h-7 min-w-[28px] rounded-md px-1.5 text-xs font-bold', e.w === w ? 'bg-white text-blue-700' : 'hover:bg-white/20')}>
                      {sym}
                    </button>
                  ))}
                </span>
                <button type="button" title={e.tall ? 'Normale Höhe' : 'Hoch (zwei Bereiche daneben)'} aria-pressed={!!e.tall} onClick={() => lay.update(e.id, { tall: !e.tall })}
                  className={cn('hidden h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold xl:inline-flex', e.tall ? 'bg-white text-blue-700' : 'bg-white/15 hover:bg-white/25')}>
                  <Rows3 size={13} aria-hidden /> Hoch
                </button>
                <button type="button" title="Nach vorne" aria-label="Nach vorne" onClick={() => lay.step(e.id, -1, visible)} className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 hover:bg-white/25"><ArrowUp size={14} /></button>
                <button type="button" title="Nach hinten" aria-label="Nach hinten" onClick={() => lay.step(e.id, 1, visible)} className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 hover:bg-white/25"><ArrowDown size={14} /></button>
                {!fixed.includes(e.id) && (
                  <button type="button" title="Ausblenden" aria-label="Ausblenden" onClick={() => onHide(e.id)} className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 hover:bg-red-500"><EyeOff size={14} /></button>
                )}
              </div>
            )}
            <div className={cn(editing && 'pointer-events-none select-none')}>{node}</div>
          </div>
        );
      })}
    </div>
  );
}
