import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import VehicleCard from '@/components/VehicleCard';
import { Check } from 'lucide-react';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://www.munichairport.taxi';
  const path = '/vehicles';
  return {
    title: t('vehicles_title'),
    description: t('vehicles_description'),
    alternates: {
      canonical: locale === 'de' ? `${baseUrl}${path}` : `${baseUrl}/${locale}${path}`,
      languages: {
        'de': `${baseUrl}${path}`,
        'en': `${baseUrl}/en${path}`,
        'tr': `${baseUrl}/tr${path}`,
      },
    },
  };
}

export default function VehiclesPage() {
  const t = useTranslations('vehicles');

  const vehicles = [
    {
      type: 'kombi' as const,
      name: t('kombi.name'),
      persons: t('kombi.persons'),
      description: t('kombi.description'),
      features: [t('kombi.features.0'), t('kombi.features.1'), t('kombi.features.2')],
      basePrice: 8.0,
      pricePerKm: 2.1,
    },
    {
      type: 'van' as const,
      name: t('van.name'),
      persons: t('van.persons'),
      description: t('van.description'),
      features: [t('van.features.0'), t('van.features.1'), t('van.features.2')],
      basePrice: 10.0,
      pricePerKm: 2.2,
      featured: true,
    },
    {
      type: 'grossraumtaxi' as const,
      name: t('grossraumtaxi.name'),
      persons: t('grossraumtaxi.persons'),
      description: t('grossraumtaxi.description'),
      features: [t('grossraumtaxi.features.0'), t('grossraumtaxi.features.1'), t('grossraumtaxi.features.2')],
      basePrice: 15.0,
      pricePerKm: 2.4,
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="bg-primary-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-primary-200 text-lg max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>
      </section>

      {/* Price Info Banner */}
      <section className="bg-gold-50 border-b border-gold-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-primary-600 font-semibold flex items-center justify-center gap-2">
            <Check size={18} className="text-green-500" />
            {t('fixed_price_info')}
          </p>
        </div>
      </section>

      {/* Vehicles Grid */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.type}
                {...vehicle}
                bookLabel={t('book_now')}
                basePriceLabel={t('base_price')}
                perKmLabel={t('per_km')}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Included Services */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-primary-600 text-center mb-8">{t('included')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              'Klimaanlage',
'Kindersitz auf Anfrage (kostenlos)',
              'Flugüberwachung bei Ankunftsfahrten',
              'Namensschild am Flughafen',
              'Keine versteckten Gebühren',
              'Zahlung bar oder mit Karte',
              'Gepäckhelfer',
              'Kostenloser Storno bis 3 Std. vorher',
              'Vollversicherte Fahrzeuge (Haftpflicht & Vollkasko)',
              '60 Min. Gratis-Wartezeit bei Flugverspätung',
              '20 Jahre Erfahrung im Flughafentransfer',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm">
                <Check size={18} className="text-green-500 shrink-0" />
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
