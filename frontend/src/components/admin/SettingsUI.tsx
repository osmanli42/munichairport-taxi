'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// Bausteine für den Admin-Tab „Preise & Einstellungen“.
// Rein darstellend: Speichern/Umschalten bleibt im Aufrufer.

export function Toggle({ on, onClick, disabled, label, size = 'md' }: {
  on: boolean; onClick: () => void; disabled?: boolean; label: string; size?: 'sm' | 'md';
}) {
  const sm = size === 'sm';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60',
        sm ? 'h-6 w-11' : 'h-7 w-[52px]',
        on ? 'bg-emerald-500' : 'bg-gray-300'
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white shadow ring-1 ring-black/5 transition-transform duration-200',
          sm ? 'h-5 w-5' : 'h-6 w-6',
          on ? (sm ? 'translate-x-[22px]' : 'translate-x-[26px]') : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

/** Weiße Bereichskarte mit Kopfzeile; id dient als Sprungziel der Sektionsnavigation */
export function SectionCard({ id, icon: Icon, title, subtitle, action, children }: {
  id: string; icon: LucideIcon; title: string; subtitle?: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-6 w-6 shrink-0 text-primary-600" aria-hidden />
          <div>
            <h3 className="text-lg font-bold leading-tight text-gray-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const TONES = {
  navy: 'bg-slate-100 text-primary-600',
  amber: 'bg-amber-50 text-amber-500',
  off: 'bg-gray-100 text-gray-400',
} as const;

/** Kachel für eine einzelne Einstellung: Icon, Titel, Kurzbeschreibung, Schalter oben rechts, Felder darunter */
export function SettingCard({ icon: Icon, tone = 'navy', badge, title, description, info, on, control, children, className, indent = true }: {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  /** kleines Zusatzsymbol unten rechts am Icon (z. B. Verbot) */
  badge?: ReactNode;
  title: string;
  description: ReactNode;
  info?: ReactNode;
  /** false = ausgeschaltet → Icon wird grau */
  on?: boolean;
  control?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Zusatzfelder unter dem Text einrücken (false = volle Kartenbreite) */
  indent?: boolean;
}) {
  return (
    <div className={cn('flex flex-col rounded-xl border border-gray-200/80 bg-gray-50/60 p-4 transition-colors hover:border-gray-300', className)}>
      <div className="flex items-start gap-3">
        <span className={cn('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', on === false ? TONES.off : TONES[tone])}>
          <Icon className="h-[22px] w-[22px]" aria-hidden />
          {badge && <span className="absolute -bottom-0.5 -right-0.5">{badge}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[15px] font-semibold leading-snug text-gray-900">{title}</p>
            {info && <InfoTip title={title}>{info}</InfoTip>}
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-gray-500">{description}</p>
        </div>
        {control && <div className="shrink-0 pl-1">{control}</div>}
      </div>
      {children && <div className={cn('mt-3.5', indent && 'sm:pl-14')}>{children}</div>}
    </div>
  );
}

/** „i“-Knopf mit ausführlicher Erklärung als Popover (kein Layoutsprung im Kachelraster) */
export function InfoTip({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`${title}: Details`}
        aria-expanded={open}
        className={cn('rounded-full p-0.5 transition-colors hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400', open ? 'text-primary-600' : 'text-gray-400')}
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <span role="tooltip" className="absolute left-1/2 top-full z-30 mt-2 w-72 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 text-xs font-normal leading-relaxed text-gray-600 shadow-lg sm:left-0 sm:translate-x-0">
          {children}
        </span>
      )}
    </span>
  );
}

/** Zahlen-/Zeitfeld mit Einheit rechts daneben */
export function Field({ label, unit, widthClass = 'w-28', inline, ...input }: {
  label?: string; unit?: string; widthClass?: string; inline?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const control = (
    <span className="flex items-center gap-2">
      <input
        {...input}
        className={cn(
          'h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm tabular-nums text-gray-900 outline-none transition',
          'focus:border-primary-400 focus:ring-2 focus:ring-primary-100',
          widthClass
        )}
      />
      {unit && <span className="whitespace-nowrap text-sm text-gray-600">{unit}</span>}
    </span>
  );
  if (!label) return control;
  return (
    <label className={cn('flex gap-1.5', inline ? 'items-center gap-2.5' : 'flex-col')}>
      <span className={cn('text-gray-600', inline ? 'text-sm' : 'text-xs font-medium')}>{label}</span>
      {control}
    </label>
  );
}

/** Volle Breite, Beschriftung oben, Einheit im Feld rechts (Fahrzeugkarten, Formulare) */
export function BlockField({ label, unit, className, ...input }: {
  label: string; unit?: string; className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="truncate text-xs font-medium text-gray-600" title={label}>{label}</span>
      <span className="flex h-10 items-center rounded-lg border border-gray-200 bg-white transition focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
        <input {...input} className="h-full w-full min-w-0 rounded-lg bg-transparent px-3 text-sm tabular-nums text-gray-900 outline-none" />
        {unit && <span className="whitespace-nowrap pr-3 text-xs text-gray-400">{unit}</span>}
      </span>
    </label>
  );
}

/** Stunden-Auswahl 00:00 … 24:00; gespeichert wird die ganze Stunde als String ("22") */
export function HourSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2.5">
      <span className="text-sm text-gray-600">{label}</span>
      <select
        value={String(parseInt(value, 10) || 0)}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm tabular-nums text-gray-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
      >
        {Array.from({ length: 25 }, (_, h) => (
          <option key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</option>
        ))}
      </select>
    </label>
  );
}

/** Sticky Sektionsnavigation mit Scroll-Spy */
export function SectionNav({ items }: { items: { id: string; label: string; icon: LucideIcon }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map(i => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );
    els.forEach(el => obs.observe(el));
    // ganz unten erreicht der letzte (kurze) Bereich die Markierungszone nie
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) setActive(els[els.length - 1].id);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { obs.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, [items]);
  return (
    <nav aria-label="Bereiche" className="sticky top-0 z-20 -mx-1 rounded-xl border border-gray-200/70 bg-white/95 px-1 shadow-sm backdrop-blur">
      <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={(e) => {
              e.preventDefault();
              setActive(id);
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            aria-current={active === id ? 'true' : undefined}
            className={cn(
              'relative flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3.5 text-sm font-medium transition-colors',
              active === id ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'
            )}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
            {label}
            <span className={cn('absolute inset-x-3 bottom-0 h-[3px] rounded-full transition-colors', active === id ? 'bg-gold-400' : 'bg-transparent')} />
          </a>
        ))}
      </div>
    </nav>
  );
}
