'use client';

import { useState } from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { useLocale } from 'next-intl';
import { CONTACT_INFO } from '@/lib/utils';
import { faqData } from './faqData';

function FAQAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: openIndex === i
                    ? 'linear-gradient(135deg, #0f1b2d, #1e3a5f)'
                    : '#f4f7fb',
                  color: openIndex === i ? '#c9a84c' : '#6b7c93',
                  transition: 'all .2s',
                }}
              >
                {i + 1}
              </span>
              <span
                className="font-semibold text-sm md:text-base"
                style={{ color: openIndex === i ? '#0f1b2d' : '#2a3f5f' }}
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
  const [activeCategory, setActiveCategory] = useState(0);

  const categoryIcons = ['🚗', '✈️', '🚐', '📍'];

  return (
    <div style={{ background: '#f4f7fb', minHeight: '100vh' }}>

      {/* Hero */}
      <section
        className="py-16 text-white text-center"
        style={{ background: 'linear-gradient(135deg, #0f1b2d 0%, #1e3a5f 100%)' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5"
            style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.35)', color: '#c9a84c' }}
          >
            Support
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4" style={{ color: '#fff' }}>
            {data.title}
          </h1>
          <p className="text-lg" style={{ color: '#7a9ab8' }}>{data.subtitle}</p>

          {/* Quick stats */}
          <div className="mt-10 flex flex-wrap justify-center gap-6">
            {[
              { v: '24/7', l: 'Erreichbar' },
              { v: '60 Min', l: 'Wartezeit Flughafen' },
              { v: '3 Std', l: 'Kostenlos stornieren' },
              { v: '100%', l: 'Festpreise' },
            ].map(s => (
              <div key={s.l} className="text-center">
                <div className="text-2xl font-extrabold" style={{ color: '#c9a84c' }}>{s.v}</div>
                <div className="text-xs font-medium mt-0.5" style={{ color: '#5a7a99' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {data.categories.map((cat, i) => (
            <button
              key={i}
              onClick={() => setActiveCategory(i)}
              className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
              style={
                activeCategory === i
                  ? {
                      background: 'linear-gradient(135deg, #0f1b2d, #1e3a5f)',
                      color: '#c9a84c',
                      border: '1px solid transparent',
                      boxShadow: '0 4px 16px rgba(15,27,45,.25)',
                    }
                  : {
                      background: '#fff',
                      color: '#3a5070',
                      border: '1px solid #e5edf5',
                    }
              }
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Active category header card */}
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ background: '#fff', border: '1px solid #e5edf5', boxShadow: '0 2px 12px rgba(15,27,45,.04)' }}
        >
          <div
            className="flex items-center gap-4 px-7 py-5"
            style={{ background: 'linear-gradient(135deg, #0f1b2d, #1e3a5f)' }}
          >
            <div
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.3)' }}
            >
              {categoryIcons[activeCategory]}
            </div>
            <div>
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c9a84c' }}>
                Kategorie {activeCategory + 1} / {data.categories.length}
              </span>
              <h2 className="text-lg font-bold text-white leading-tight">
                {data.categories[activeCategory].label.replace(/^[^\s]+\s/, '')}
              </h2>
            </div>
            <span
              className="ml-auto text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: 'rgba(201,168,76,.15)', color: '#c9a84c', border: '1px solid rgba(201,168,76,.3)' }}
            >
              {data.categories[activeCategory].items.length} Fragen
            </span>
          </div>
        </div>

        {/* FAQ accordion */}
        <div className="mb-10">
          <FAQAccordion items={data.categories[activeCategory].items} />
        </div>

        {/* CTA card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0f1b2d 0%, #1e3a5f 100%)',
            border: '1px solid rgba(201,168,76,.3)',
          }}
        >
          <div className="px-8 py-8 text-center">
            <div
              className="inline-block text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4"
              style={{ background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.35)', color: '#c9a84c' }}
            >
              Kontakt
            </div>
            <h3 className="text-2xl font-extrabold text-white mb-2">{data.cta_title}</h3>
            <p className="mb-7" style={{ color: '#7a9ab8' }}>{data.cta_text}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={CONTACT_INFO.phoneHref}
                className="flex items-center justify-center gap-2.5 font-bold px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #c9a84c, #d4af6a)',
                  color: '#0f1b2d',
                  boxShadow: '0 4px 16px rgba(201,168,76,.3)',
                }}
              >
                <Phone size={17} />
                {data.cta_call}
              </a>
              <a
                href={CONTACT_INFO.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 font-bold px-7 py-3.5 rounded-xl transition-all hover:-translate-y-0.5"
                style={{
                  background: '#25d366',
                  color: '#fff',
                  boxShadow: '0 4px 16px rgba(37,211,102,.25)',
                }}
              >
                <MessageCircle size={17} />
                {data.cta_whatsapp}
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
