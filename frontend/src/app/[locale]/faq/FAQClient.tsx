'use client';

import { useMemo, useState } from 'react';
import { Phone, MessageCircle, Search, X, ChevronDown, Mail } from 'lucide-react';
import { useLocale } from 'next-intl';
import { CONTACT_INFO } from '@/lib/utils';
import { faqData } from './faqData';
import { faqDesign, categoryIcons, trustIcons } from './faqDesign';

type Item = { question: string; answer: string };

const UI = {
  de: { search: 'Frage suchen, z. B. Kindersitz, Stornierung, Wartezeit …', results: (n: number) => `${n} Treffer`, none: 'Keine passende Frage gefunden – rufen Sie uns an oder schreiben Sie uns per WhatsApp.', topics: 'Themen', questions: 'Fragen', contact: 'Kontakt', clear: 'Suche löschen' },
  en: { search: 'Search a question, e.g. child seat, cancellation, waiting time …', results: (n: number) => `${n} results`, none: 'No matching question – call us or message us on WhatsApp.', topics: 'Topics', questions: 'questions', contact: 'Contact', clear: 'Clear search' },
  tr: { search: 'Soru arayın, ör. çocuk koltuğu, iptal, bekleme süresi …', results: (n: number) => `${n} sonuç`, none: 'Uygun soru bulunamadı – bizi arayın veya WhatsApp’tan yazın.', topics: 'Konular', questions: 'soru', contact: 'İletişim', clear: 'Aramayı temizle' },
} as const;

const clean = (label: string) => label.replace(/^[^\s]+\s/, '');

/** All answers stay in the DOM (hidden when closed) so search engines can read them. */
function FAQAccordion({ items, openFirst = true }: { items: Item[]; openFirst?: boolean }) {
  const [openIndex, setOpenIndex] = useState<number | null>(openFirst ? 0 : null);
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.question} className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition ${open ? 'ring-gold-400 shadow-md' : 'ring-gray-200 hover:ring-gold-300'}`}>
            <button type="button" aria-expanded={open} onClick={() => setOpenIndex(open ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6">
              <span className="font-semibold text-gray-900 md:text-[1.05rem]">{item.question}</span>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${open ? 'rotate-180 bg-gold-400 text-primary-900' : 'bg-gray-100 text-gray-500'}`}>
                <ChevronDown size={17} />
              </span>
            </button>
            <div className={`grid transition-all duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">
                <p className="border-t border-gray-100 px-5 pb-5 pt-4 leading-relaxed text-gray-600 sm:px-6">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FAQClient() {
  const locale = useLocale();
  const data = faqData[locale] || faqData.de;
  const dz = faqDesign[locale] || faqDesign.de;
  const ui = UI[(locale as keyof typeof UI)] || UI.de;
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (q.length < 2) return null;
    return data.categories.flatMap((c) => c.items).filter((it) => `${it.question} ${it.answer}`.toLowerCase().includes(q));
  }, [q, data]);

  const ActiveIcon = categoryIcons[active] || categoryIcons[0];

  return (
    <div className="bg-gray-50">
      {/* Hero with search */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/faq/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[75%_center]" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/95 via-primary-900/80 to-primary-900/15" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 md:pb-20 md:pt-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-gold-400">{dz.eyebrow}</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight drop-shadow sm:text-5xl md:text-6xl">{data.title}</h1>
            <p className="mt-4 text-lg text-white/85 drop-shadow">{data.subtitle}</p>
            <div className="relative mt-8">
              <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ui.search} aria-label={ui.search}
                className="w-full rounded-2xl bg-white py-4 pl-12 pr-12 text-base text-gray-900 shadow-2xl outline-none ring-4 ring-white/10 placeholder:text-gray-400 focus:ring-gold-400/60" />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label={ui.clear} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={18} /></button>
              )}
            </div>
          </div>
          <dl className="mt-10 grid max-w-3xl grid-cols-2 gap-4 rounded-2xl bg-white/10 p-5 ring-1 ring-white/15 backdrop-blur md:grid-cols-4">
            {dz.stats.map((s) => {
              const Ikon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-400/15 ring-1 ring-gold-400/40"><Ikon size={18} className="text-gold-400" /></span>
                  <div className="leading-tight">
                    <dt className="text-lg font-extrabold">{s.value}</dt>
                    <dd className="text-xs text-white/75">{s.label}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      {/* Main */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        {results && (
          <div className="mx-auto max-w-3xl">
            <p className="mb-5 text-sm font-semibold text-gray-500">{ui.results(results.length)}</p>
            {results.length ? <FAQAccordion key={q} items={results} openFirst={results.length === 1} /> : (
              <p className="rounded-2xl bg-white p-6 text-gray-600 shadow-sm ring-1 ring-gray-200">{ui.none}</p>
            )}
          </div>
        )}
        {/* All categories stay in the DOM (inactive ones hidden) so every answer is crawlable */}
        <div className={`grid gap-8 lg:grid-cols-[280px_1fr] ${results ? 'hidden' : ''}`}>
            {/* Categories */}
            <aside className="min-w-0">
              <p className="mb-3 hidden text-xs font-bold uppercase tracking-[.2em] text-gold-600 lg:block">{ui.topics}</p>
              <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:sticky lg:top-28 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
                {data.categories.map((cat, i) => {
                  const Ikon = categoryIcons[i] || categoryIcons[0];
                  const on = active === i;
                  return (
                    <button key={cat.label} type="button" onClick={() => setActive(i)}
                      className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-semibold transition lg:whitespace-normal ${on ? 'bg-primary-900 text-white shadow-lg' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gold-300'}`}>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? 'bg-gold-400 text-primary-900' : 'bg-primary-50 text-primary-700'}`}><Ikon size={16} /></span>
                      <span className="flex-1">{clean(cat.label)}</span>
                      <span className={`hidden rounded-full px-2 py-0.5 text-xs lg:inline ${on ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-500'}`}>{cat.items.length}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Questions */}
            <section className="min-w-0">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400/15 text-gold-600"><ActiveIcon size={20} /></span>
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900">{clean(data.categories[active].label)}</h2>
                  <p className="text-xs text-gray-500">{data.categories[active].items.length} {ui.questions}</p>
                </div>
              </div>
              {data.categories.map((c, i) => (
                <div key={c.label} className={i === active ? '' : 'hidden'}>
                  <FAQAccordion items={c.items} />
                </div>
              ))}
            </section>
          </div>

      </div>

      {/* CTA with photo */}
      <section className="relative overflow-hidden bg-primary-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/contact/hero.webp" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-[70%_center] opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900 via-primary-900/90 to-primary-900/50" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-xl">
            <span className="inline-block rounded-full bg-gold-400/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold-400 ring-1 ring-gold-400/40">{ui.contact}</span>
            <h2 className="mt-4 text-3xl font-extrabold">{data.cta_title}</h2>
            <p className="mt-2 text-white/80">{data.cta_text}</p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
              {dz.contactExtra.map((c) => {
                const Ikon = c.icon;
                return <span key={c.text} className="flex items-center gap-2 text-xs font-medium text-white/75"><Ikon size={15} className="text-gold-400" /> {c.text}</span>;
              })}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={CONTACT_INFO.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-7 py-3.5 font-bold text-primary-900 transition hover:-translate-y-0.5 hover:bg-gold-300"><Phone size={17} /> {data.cta_call}</a>
            <a href={CONTACT_INFO.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 px-7 py-3.5 font-bold text-white transition hover:-translate-y-0.5 hover:bg-green-600"><MessageCircle size={17} /> {data.cta_whatsapp}</a>
            <a href={`mailto:${CONTACT_INFO.email}`} className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 font-bold ring-1 ring-white/30 transition hover:bg-white/10"><Mail size={17} /> E-Mail</a>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 items-center gap-6 px-4 py-10 sm:px-6 lg:grid-cols-5 lg:px-8">
          {dz.trust.map((tItem, i) => {
            const Ikon = trustIcons[i] || trustIcons[0];
            return (
              <div key={tItem.title} className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Ikon size={20} /></span>
                <div className="leading-tight">
                  <div className="text-sm font-bold text-gray-900">{tItem.title}</div>
                  <div className="text-xs text-gray-500">{tItem.text}</div>
                </div>
              </div>
            );
          })}
          <div className="hidden text-right text-xl italic text-gold-600 lg:block" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{dz.signature}</div>
        </div>
      </section>
    </div>
  );
}
