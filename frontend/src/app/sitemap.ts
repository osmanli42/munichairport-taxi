import { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { allCitySlugs } from '@/lib/citiesData';

const GERMAN_ONLY = new Set(['/blog/taxi-flughafen-muenchen']);

export default function sitemap(): MetadataRoute.Sitemap {
  const host = headers().get('host') ?? 'flughafen-muenchen.taxi';
  const baseUrl = `https://${host}`;
  const locales = ['', '/en', '/tr'];
  const cityPages = allCitySlugs.map((slug) => `/blog/${slug}`);
  const pages = ['', '/vehicles', '/business', '/about', '/contact', '/faq', '/treffpunkt-flughafen-muenchen', '/blog/taxi-flughafen-muenchen', '/oktoberfest', '/munich-airport-to-city-centre', '/messe-muenchen-transfer', ...cityPages];

  const routes: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const page of pages) {
      // Ratgeber ist nur deutsch; /en und /tr zeigen per canonical auf die DE-Seite → nicht in die Sitemap
      if (locale && GERMAN_ONLY.has(page)) continue;
      routes.push({
        url: `${baseUrl}${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'weekly' : 'monthly',
        priority: page === '' ? 1.0 : 0.8,
      });
    }
  }

  return routes;
}
