'use client';

// Rahmen des Admin-Bereichs: dunkle Seitenleiste mit allen Bereichen, obere Leiste mit
// Buchungssuche (⌘K), Hinweis-Glocke (aus den Zählern der Seitenleiste) und Benutzer.

import { ReactNode, useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bell, ChevronRight, ExternalLink, LogOut, Menu, Plane, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ShellItem<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
  badge?: number | null;
  badgeTitle?: string;
};

export default function AdminShell<T extends string>({ items, active, onSelect, user, onLogout, onSearch, children }: {
  items: ShellItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  user: string;
  onLogout: () => void;
  onSearch: (q: string) => void;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // ⌘K / Strg+K springt in die Suche
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!bellOpen) return;
    const close = (e: MouseEvent) => { if (!bellRef.current?.contains(e.target as Node)) setBellOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [bellOpen]);

  const notices = items.filter((i) => i.badge);
  const noticeCount = notices.reduce((s, i) => s + (i.badge || 0), 0);
  const initials = user.replace(/[^A-Za-zÀ-ž\s]/g, ' ').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'A';
  const select = (id: T) => { onSelect(id); setNavOpen(false); };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Seitenleiste */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-primary-800 text-white transition-transform duration-200 lg:translate-x-0',
          navOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        )}
        aria-label="Admin-Navigation"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Plane size={22} className="shrink-0 -rotate-12 text-gold-400" aria-hidden />
            <span className="truncate text-sm font-bold tracking-tight">flughafen-muenchen<span className="text-gold-400">.TAXI</span></span>
          </div>
          <button onClick={() => setNavOpen(false)} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 lg:hidden" aria-label="Menü schließen"><X size={20} /></button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 pt-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.2)_transparent]">
          {items.map(({ id, label, icon: Icon, badge, badgeTitle }) => {
            const on = active === id;
            return (
              <button
                key={id}
                onClick={() => select(id)}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors',
                  on ? 'bg-gold-400 font-semibold text-primary-800 shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon size={19} className="shrink-0" aria-hidden />
                <span className="flex-1 truncate">{label}</span>
                {!!badge && (
                  <span title={badgeTitle} className="min-w-[20px] rounded-full bg-red-500 px-1.5 text-center text-[11px] font-bold leading-5 text-white">{badge}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="shrink-0 space-y-1 border-t border-white/10 p-3">
          <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">
            <ExternalLink size={18} aria-hidden /> Website öffnen
          </a>
          <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">
            <LogOut size={18} aria-hidden /> Abmelden
          </button>
        </div>
      </aside>
      {navOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden />}

      <div className="lg:pl-64">
        {/* Obere Leiste */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-primary-800 px-4 text-white shadow-sm lg:px-6">
          <button onClick={() => setNavOpen(true)} className="rounded-lg p-2 text-white/80 hover:bg-white/10 lg:hidden" aria-label="Menü öffnen"><Menu size={22} /></button>
          <form
            role="search"
            onSubmit={(e) => { e.preventDefault(); if (q.trim()) onSearch(q.trim()); }}
            className="mx-auto flex h-10 w-full max-w-2xl items-center gap-2.5 rounded-xl bg-white/10 px-3.5 ring-1 ring-inset ring-white/15 focus-within:bg-white/15 focus-within:ring-white/40"
          >
            <Search size={18} className="shrink-0 text-white/60" aria-hidden />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Suche nach Buchung, Kunde, Flugnummer, Adresse…"
              aria-label="Buchungen durchsuchen"
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/50 outline-none"
            />
            <kbd className="hidden shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 font-sans text-[11px] text-white/60 sm:block">⌘ K</kbd>
          </form>
          <div ref={bellRef} className="relative">
            <button onClick={() => setBellOpen((v) => !v)} aria-expanded={bellOpen} aria-label={`Hinweise${noticeCount ? ` (${noticeCount})` : ''}`} className="relative rounded-lg p-2 text-white/80 hover:bg-white/10">
              <Bell size={21} />
              {noticeCount > 0 && <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{noticeCount}</span>}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-xl bg-white py-1 text-gray-800 shadow-xl ring-1 ring-gray-200">
                {notices.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-500">Keine offenen Hinweise</p>
                ) : notices.map((n) => (
                  <button key={n.id} onClick={() => { select(n.id); setBellOpen(false); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50">
                    <n.icon size={16} className="shrink-0 text-gray-400" aria-hidden />
                    <span className="flex-1">{n.badgeTitle || n.label}</span>
                    <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-5 text-white">{n.badge}</span>
                    <ChevronRight size={14} className="text-gray-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="hidden items-center gap-2.5 sm:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-bold text-primary-800">{initials}</span>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{user}</div>
              <div className="text-[11px] text-white/60">Administrator</div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
