'use client';

import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Bausteine für die Einstellungs-Karten im Admin (Preise → Allgemeine Einstellungen).
// Rein darstellend: Speichern/Umschalten bleibt im Aufrufer.

export function Toggle({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60',
        on ? 'bg-emerald-500' : 'bg-gray-300'
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200',
          on ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

export function SettingsGroup({ icon: Icon, title, subtitle, children, className }: {
  icon: LucideIcon; title: string; subtitle?: string; children: ReactNode; className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-gray-200 bg-white', className)}>
      <header className="flex items-center gap-3 border-b border-gray-100 px-5 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </header>
      <div className="divide-y divide-gray-100">{children}</div>
    </section>
  );
}

export function SettingRow({ icon: Icon, title, summary, details, on, control, children }: {
  icon: LucideIcon;
  title: string;
  summary: ReactNode;
  details?: ReactNode;
  /** Status für die Icon-Farbe; undefined = Einstellung ohne Schalter */
  on?: boolean;
  control?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
            on === false ? 'bg-gray-100 text-gray-400' : 'bg-primary-50 text-primary-600'
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn('text-sm font-semibold', on === false ? 'text-gray-500' : 'text-gray-900')}>{title}</p>
            {on !== undefined && (
              <span className={cn(
                'rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide',
                on ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
              )}>
                {on ? 'Aktiv' : 'Aus'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-gray-500">{summary}</p>
          {details && (
            <details className="group mt-1">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600 [&::-webkit-details-marker]:hidden">
                Details
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600">{details}</div>
            </details>
          )}
        </div>
        {control && <div className="shrink-0 pt-1">{control}</div>}
      </div>
      {children && <div className="mt-3 sm:pl-11">{children}</div>}
    </div>
  );
}

/** Graue Fläche für Zusatzfelder einer Einstellung */
export function FieldPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3', className)}>
      {children}
    </div>
  );
}

/** Eingabefeld mit Beschriftung oben und Einheit rechts im Feld */
export function UnitField({ label, unit, widthClass = 'w-20', ...input }: {
  label: string; unit?: string; widthClass?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <span className="flex h-9 items-center rounded-lg border border-gray-200 bg-white focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
        <input
          {...input}
          className={cn('h-full rounded-lg bg-transparent px-2.5 text-sm tabular-nums text-gray-900 outline-none', widthClass)}
        />
        {unit && <span className="whitespace-nowrap pr-2.5 text-xs text-gray-400">{unit}</span>}
      </span>
    </label>
  );
}

export function SaveButton({ onClick, saving }: { onClick: () => void; saving?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="h-9 rounded-lg bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50"
    >
      {saving ? 'Speichert…' : 'Speichern'}
    </button>
  );
}
