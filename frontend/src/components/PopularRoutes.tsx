'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { MapPin, Clock, ArrowRight, Car } from 'lucide-react';

const _BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _BASE.endsWith('/api') ? _BASE : `${_BASE}/api`;

interface RouteDetail {
  slug: string;
  city: string;
  distance_km: number;
  duration_min: number;
  prices: { kombi: number | null; van: number | null; grossraumtaxi: number | null };
}

export default function PopularRoutes() {
  const t = useTranslations('popularRoutes');
  const locale = useLocale();
  const [routes, setRoutes] = useState<RouteDetail[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/popular-routes`)
      .then((r) => r.json())
      .then((data: RouteDetail[]) => { if (!cancelled) setRoutes(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  if (error || (routes && routes.length === 0)) return null;

  const prefix = locale === 'de' ? '' : `/${locale}`;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-bold tracking-[.18em] uppercase mb-3 text-gold-500">{t('sectionLabel')}</p>
          <h2 className="text-3xl font-bold text-primary-600">{t('title')}</h2>
          <p className="text-gray-600 mt-2">{t('subtitle')}</p>
        </div>

        {!routes ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-gray-100 p-6 h-48 animate-pulse bg-gray-50" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {routes.map((route) => (
              <Link
                key={route.slug}
                href={`${prefix}/${route.slug}`}
                className="group rounded-2xl border border-gray-100 hover:border-gold-300 bg-white p-6 shadow-sm hover:shadow-lg transition-all flex flex-col"
              >
                <div className="flex items-center gap-2 text-primary-600 mb-3">
                  <Car size={18} />
                  <h3 className="font-bold text-lg text-gray-900">{route.city}</h3>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} /> {route.distance_km} km
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={14} /> {route.duration_min} {t('minLabel')}
                  </span>
                </div>
                <div className="mt-auto">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{t('fromLabel')}</p>
                  <p className="text-2xl font-extrabold text-gold-500">
                    {route.prices.kombi != null ? `${route.prices.kombi.toFixed(2).replace('.', ',')} €` : '—'}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 group-hover:gap-2 transition-all">
                    {t('viewDetails')} <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
