import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.munichairport.taxi';
  const locales = ['', '/en', '/tr'];
  const pages = ['', '/vehicles', '/about', '/contact'];

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
