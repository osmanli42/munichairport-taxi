'use client';

import { useState } from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { useLocale } from 'next-intl';
import { CONTACT_INFO } from '@/lib/utils';
import { faqData } from './faqData';
import { faqDesign, categoryIcons, trustIcons } from './faqDesign';

function FAQAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#fff',
            border: openIndex === i ? '1px solid #c9a84c' : '1px solid #e5edf5',
            boxShadow: openIndex === i
              ? '0 4px 20px rgba(201,168,76,.12)'
              : '0 2px 12px rgba(15,27,45,.04)',
            transition: 'all .2s',
          }}
        >
          <button
            className="w-full flex items-center justify-between px-6 py-4 text-left"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            <div className="flex items-center gap-3 pr-4">
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: '#c9a84c' }}
              >
                {i + 1}
              </span>
              <span
                className="font-semibold text-sm md:text-base"
                style={{ color: '#0f1b2d' }}
              >
                {item.question}
              </span>
            </div>
            <span
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all"
              style={{
                background: openIndex === i ? '#fdf8ec' : '#f4f7fb',
                border: openIndex === i ? '1px solid #f0d890' : '1px solid #e5edf5',
                transform: openIndex === i ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'all .25s',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke={openIndex === i ? '#c9a84c' : '#8a9bb0'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>

          {openIndex === i && (
            <div
              className="px-6 pb-5 pt-0 text-sm leading-relaxed"
              style={{
                borderTop: '1px solid #f0f4f8',
                color: '#4a6280',
                paddingTop: '1rem',
              }}
            >
              <div className="flex gap-3">
                <span
                  className="flex-shrink-0 mt-0.5 w-1 rounded-full"
                  style={{ background: '#c9a84c', minHeight: '100%' }}
                />
                <p>{item.answer}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FAQClient() {
  const locale = useLocale();
  const data = faqData[locale] || faqData.de;
  const dz = faqDesign[locale] || faqDesign.de;
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div style={{ background: '#f4f7fb', minHeight: '100vh' }}>

      {/* Hero — arka plan: Munih Havalimani M terminali (sol) + kule/ucak/taksi (sag),
          tasarim gorselinden kesildi, ortaya dogru koyu lacivert (#0f1b2d) rengine soluyor */}
      <section className="relative overflow-hidden text-white py-16" style={{ background: '#0f1b2d' }}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-0 left-0 hidden sm:block h-full" style={{ width: '260px' }}>
            <img src="/images/faq-bg-left.webp" alt="" width={180} height={280} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(15,27,45,.20) 0%, #0f1b2d 92%)' }} />
          </div>
          <div className="absolute top-0 right-0 hidden sm:block h-full" style={{ width: '260px' }}>
            <img src="/images/faq-bg-right.webp" alt="" width={179} height={280} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, rgba(15,27,45,.15) 0%, #0f1b2d 90%)' }} />
          </div>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="hidden sm:block h-px w-10" style={{ background: '#c9a84c' }} />
            <span className="text-xs font-bold tracking-[.2em] uppercase" style={{ color: '#c9a84c' }}>{dz.eyebrow}</span>
            <span className="hidden sm:block h-px w-10" style={{ background: '#c9a84c' }} />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4" style={{ color: '#fff', textShadow: '0 2px 14px rgba(0,0,0,.35)' }}>
            {data.title}
          </h1>
          <p className="text-lg" style={{ color: '#c3d2e3', textShadow: '0 1px 8px rgba(0,0,0,.4)' }}>{data.subtitle}</p>

          {/* Quick stats */}
          <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-5">
            {dz.stats.map((s) => {
              const Ikon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-2.5">
                  <span
                    className="flex items-center justify-center rounded-full shrink-0"
                    style={{ width: '38px', height: '38px', border: '1.5px solid rgba(201,168,76,.5)', background: 'rgba(201,168,76,.12)' }}
                  >
                    <Ikon size={17} style={{ color: '#c9a84c' }} />
                  </span>
                  <div className="text-left">
                    <div className="text-base font-extrabold leading-tight" style={{ color: '#fff' }}>{s.value}</div>
                    <div className="text-xs font-medium" style={{ color: '#a9bdd4' }}>{s.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Category tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible">
          {data.categories.map((cat, i) => {
            const Ikon = categoryIcons[i] || categoryIcons[0];
            return (
              <button
                key={i}
                onClick={() => setActiveCategory(i)}
                className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap"
                style={
                  activeCategory === i
                    ? { background: '#c9a84c', color: '#0f1b2d', border: '1px solid transparent', boxShadow: '0 4px 16px rgba(201,168,76,.35)' }
                    : { background: '#fff', color: '#3a5070', border: '1px solid #e5edf5' }
                }
              >
                <Ikon size={16} />
                {cat.label.replace(/^[^\s]+\s/, '')}
              </button>
            );
          })}
        </div>

        {/* Active category header card */}
        <div
          className="flex items-center gap-4 rounded-2xl px-5 sm:px-7 py-5 mb-6"
          style={{ background: '#fff', border: '1px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
        >
          <div
            className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: '#fdf3de' }}
          >
            {(() => { const Ikon = categoryIcons[activeCategory] || categoryIcons[0]; return <Ikon size={20} style={{ color: '#0f1b2d' }} />; })()}
          </div>
          <div>
            <div className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>
              {locale === 'en' ? 'Category' : locale === 'tr' ? 'Kategori' : 'Kategorie'} {activeCategory + 1} / {data.categories.length}
            </div>
            <h2 className="text-lg font-bold leading-tight" style={{ color: '#0f1b2d' }}>
              {data.categories[activeCategory].label.replace(/^[^\s]+\s/, '')}
            </h2>
          </div>
          <span
            className="ml-auto hidden sm:inline-block text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
            style={{ background: '#f4f7fb', color: '#3a5070', border: '1px solid #e5edf5' }}
          >
            {data.categories[activeCategory].items.length} {locale === 'en' ? 'questions' : locale === 'tr' ? 'soru' : 'Fragen'}
            {locale === 'de' ? ' in dieser Kategorie' : locale === 'tr' ? ' bu kategoride' : ' in this category'}
          </span>
        </div>

        {/* FAQ accordion */}
        <div className="mb-10">
          <FAQAccordion key={activeCategory} items={data.categories[activeCategory].items} />
        </div>

        {/* CTA card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f1b2d 0%, #1e3a5f 100%)', border: '1px solid rgba(201,168,76,.3)' }}
        >
          <div className="px-6 sm:px-8 py-8 flex flex-col lg:flex-row lg:items-center gap-7 lg:gap-10">
            <div className="lg:flex-1">
              <div
                className="inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4"
                style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.35)', color: '#c9a84c' }}
              >
                {locale === 'en' ? 'Contact' : locale === 'tr' ? 'İletişim' : 'Kontakt'}
              </div>
              <h3 className="text-2xl font-extrabold text-white mb-2">{data.cta_title}</h3>
              <p style={{ color: '#7a9ab8' }}>{data.cta_text}</p>
            </div>

            <div className="lg:shrink-0">
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={CONTACT_INFO.phoneHref}
                  className="flex items-center justify-center gap-2.5 font-bold px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #c9a84c, #d4af6a)', color: '#0f1b2d', boxShadow: '0 4px 16px rgba(201,168,76,.3)' }}
                >
                  <Phone size={17} />
                  {data.cta_call}
                </a>
                <a
                  href={CONTACT_INFO.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2.5 font-bold px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5"
                  style={{ background: '#25d366', color: '#fff', boxShadow: '0 4px 16px rgba(37,211,102,.25)' }}
                >
                  <MessageCircle size={17} />
                  {data.cta_whatsapp}
                </a>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 justify-center sm:justify-start">
                {dz.contactExtra.map((c) => {
                  const Ikon = c.icon;
                  return (
                    <div key={c.text} className="flex items-center gap-2 text-xs font-medium" style={{ color: '#a9bdd4' }}>
                      <Ikon size={15} style={{ color: '#c9a84c' }} />
                      {c.text}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-10 pt-8 grid grid-cols-2 lg:grid-cols-5 gap-y-6 items-center" style={{ borderTop: '1px solid #e3eaf3' }}>
          {dz.trust.map((tItem, i) => {
            const Ikon = trustIcons[i] || trustIcons[0];
            return (
              <div key={tItem.title} className="flex items-center gap-3 pr-2">
                <Ikon size={24} strokeWidth={1.75} className="shrink-0" style={{ color: '#0f1b2d' }} />
                <div className="leading-tight">
                  <div className="font-bold text-xs sm:text-sm" style={{ color: '#0f1b2d' }}>{tItem.title}</div>
                  <div className="text-[11px] sm:text-xs" style={{ color: '#6b7c93' }}>{tItem.text}</div>
                </div>
              </div>
            );
          })}
          <div
            className="hidden lg:block text-right text-lg italic"
            style={{ color: '#c9a84c', fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            {dz.signature}
          </div>
        </div>

      </div>
    </div>
  );
}
