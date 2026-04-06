import { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { allCitySlugs } from '@/lib/citiesData';

export default function sitemap(): MetadataRoute.Sitemap {
  const host = headers().get('host') ?? 'www.munichairport.taxi';
  const baseUrl = `https://${host}`;
  const locales = ['', '/en', '/tr'];
  const cityPages = allCitySlugs.map((slug) => `/blog/${slug}`);
  const pages = ['', '/vehicles', '/about', '/contact', '/faq', '/blog/taxi-flughafen-muenchen', ...cityPages];

  const routes: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const page of pages) {
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
