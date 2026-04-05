'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Phone, MessageCircle } from 'lucide-react';
import { useLocale } from 'next-intl';
import { CONTACT_INFO } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { faqData } from './faqData';

function FAQAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            <span className="font-medium text-gray-800 pr-4 text-sm md:text-base">{item.question}</span>
            {openIndex === i
              ? <ChevronUp size={18} className="shrink-0 text-primary-600" />
              : <ChevronDown size={18} className="shrink-0 text-gray-400" />
            }
          </button>
          {openIndex === i && (
            <div className="px-5 pb-5 pt-1 text-sm text-gray-600 leading-relaxed border-t border-gray-50">
              {item.answer}
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

  return (
    <>
      {/* Hero */}
      <section className="bg-primary-600 text-white py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{data.title}</h1>
          <p className="text-primary-200 text-lg">{data.subtitle}</p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {data.categories.map((cat, i) => (
              <button
                key={i}
                onClick={() => setActiveCategory(i)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all',
                  activeCategory === i
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* FAQ Items */}
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">{data.categories[activeCategory].label}</h2>
            <FAQAccordion items={data.categories[activeCategory].items} />
          </div>

          {/* CTA Box */}
          <div className="bg-primary-600 rounded-2xl p-8 text-center text-white">
            <h3 className="text-2xl font-bold mb-2">{data.cta_title}</h3>
            <p className="text-primary-200 mb-6">{data.cta_text}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={CONTACT_INFO.phoneHref}
                className="flex items-center justify-center gap-2 bg-gold-400 hover:bg-gold-500 text-primary-600 font-bold px-6 py-3 rounded-xl transition-colors"
              >
                <Phone size={18} />
                {data.cta_call}
              </a>
              <a
                href={CONTACT_INFO.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                <MessageCircle size={18} />
                {data.cta_whatsapp}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
