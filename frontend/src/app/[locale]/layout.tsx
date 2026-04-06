import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';
import MobileStickyCTA from '@/components/MobileStickyCTA';
import CookieBanner from '@/components/CookieBanner';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' });
  const host = headers().get('host') ?? 'www.munichairport.taxi';
  const baseUrl = `https://${host}`;
  const localePrefix = locale === 'de' ? '' : `/${locale}`;

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: t('home_title'),
      template: '%s | Munich Airport Taxi',
    },
    description: t('home_description'),
    keywords: 'Munich Airport Taxi, Flughafen München Taxi, Airport Transfer Munich, Flughafentransfer München',
    authors: [{ name: 'Osman Nar & M.Ali Nar' }],
    openGraph: {
      title: t('home_title'),
      description: t('home_description'),
      url: `${baseUrl}${localePrefix}`,
      siteName: 'Munich Airport Taxi',
      type: 'website',
      locale: locale === 'de' ? 'de_DE' : locale === 'en' ? 'en_US' : 'tr_TR',
      images: [
        {
          url: '/og-image.jpg',
          width: 1200,
          height: 630,
          alt: 'Munich Airport Taxi – Flughafentransfer München',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('home_title'),
      description: t('home_description'),
      images: ['/og-image.jpg'],
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${baseUrl}${localePrefix}`,
      languages: {
        'de': baseUrl,
        'en': `${baseUrl}/en`,
        'tr': `${baseUrl}/tr`,
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();
  const host = headers().get('host') ?? 'www.munichairport.taxi';
  const baseUrl = `https://${host}`;

  return (
    <html lang={locale}>
      <head>
        {/* Google Ads Tag — loads with consent mode (GDPR compliant) */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=AW-829027982`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                ad_storage: 'denied',
                analytics_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                wait_for_update: 500
              });
              gtag('js', new Date());
              gtag('config', 'AW-829027982', { send_page_view: false });
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'TaxiService',
              'name': 'Munich Airport Taxi',
              'url': baseUrl,
              'telephone': '+4915141620000',
              'email': 'info@munichairport.taxi',
              'address': {
                '@type': 'PostalAddress',
                'streetAddress': 'Eisvogelweg 2',
                'addressLocality': 'Freising',
                'postalCode': '85356',
                'addressCountry': 'DE',
              },
              'geo': {
                '@type': 'GeoCoordinates',
                'latitude': '48.4021',
                'longitude': '11.7473',
              },
              'openingHours': 'Mo-Su 00:00-24:00',
              'priceRange': '€€',
              'areaServed': 'München, Bavaria',
              'serviceType': 'Airport Transfer',
            }),
          }}
        />
      </head>
      <body className={`${inter.className} flex flex-col min-h-screen bg-gray-50 pb-[88px] md:pb-0`}>
        <NextIntlClientProvider messages={messages}>
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
          <WhatsAppButton />
          <MobileStickyCTA />
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
