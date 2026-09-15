'use client';

import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tickt jede Sekunde bis endsAt (UTC ISO). onExpire feuert einmal beim Ablauf,
// damit die Seite den nicht mehr gültigen Rabatt ausblendet.
export function useCountdown(endsAt: string | null | undefined, onExpire?: () => void) {
  const target = endsAt ? new Date(endsAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= target) {
        clearInterval(id);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!target) return null;
  return Math.max(0, target - now);
}

const LABELS = {
  de: { left: 'Noch', day: 'Tag', days: 'Tage', hrs: 'Std.' },
  en: { left: 'Ends in', day: 'day', days: 'days', hrs: 'hrs' },
  tr: { left: 'Kalan', day: 'gün', days: 'gün', hrs: 'sa' },
} as const;

const pad = (n: number) => String(n).padStart(2, '0');

export function formatRemaining(ms: number, locale: string): string {
  const l = LABELS[(locale as keyof typeof LABELS)] ?? LABELS.de;
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days >= 1) return `${l.left} ${days} ${days === 1 ? l.day : l.days} ${hours} ${l.hrs}`;
  return `${l.left} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function Countdown({ endsAt, locale, onExpire, className }: {
  endsAt: string | null | undefined;
  locale: string;
  onExpire?: () => void;
  className?: string;
}) {
  const remaining = useCountdown(endsAt, onExpire);
  if (remaining == null || remaining <= 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', className)}>
      <Timer size={12} className="shrink-0" />
      {formatRemaining(remaining, locale)}
    </span>
  );
}
