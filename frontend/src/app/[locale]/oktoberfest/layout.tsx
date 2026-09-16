import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const baseUrl = 'https://flughafen-muenchen.taxi';
  const path = '/oktoberfest';
  const url = locale === 'de' ? `${baseUrl}${path}` : `${baseUrl}/${locale}${path}`;
  return {
    title: t('oktoberfest_title'),
    description: t('oktoberfest_description'),
    alternates: {
      canonical: url,
      languages: {
        'de': `${baseUrl}${path}`,
        'en': `${baseUrl}/en${path}`,
        'tr': `${baseUrl}/tr${path}`,
        'x-default': `${baseUrl}${path}`,
      },
    },
    openGraph: {
      title: t('oktoberfest_title'),
      description: t('oktoberfest_description'),
      url,
      siteName: 'Munich Airport Taxi',
      type: 'website',
      locale: locale === 'de' ? 'de_DE' : locale === 'en' ? 'en_US' : 'tr_TR',
      images: [
        {
          url: '/images/oktoberfest/hero.webp',
          width: 1800,
          height: 1199,
          alt: t('oktoberfest_title'),
        },
      ],
    },
  };
}

export default function OktoberfestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
