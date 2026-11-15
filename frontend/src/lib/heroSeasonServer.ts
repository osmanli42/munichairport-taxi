import fs from 'fs';
import path from 'path';
import { activeHeroSeason, berlinToday, parseHeroSeasons } from '@/lib/heroSeasons';

// Nur Server: welches Saisonbild zeigt die Startseite heute? null = Standard-Hero.
const _API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_URL = _API.endsWith('/api') ? _API : `${_API}/api`;

async function loadSettings(): Promise<Record<string, string>> {
  try {
    const r = await fetch(`${API_URL}/settings`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(1500) });
    return r.ok ? await r.json() : {};
  } catch {
    return {};
  }
}

function hasImages(img: string): boolean {
  if (!/^[a-z0-9-]+$/.test(img)) return false;
  const dir = path.join(process.cwd(), 'public', 'images', 'hero-seasons');
  return ['-web.webp', '-web-1200.webp', '-mobile.webp'].every((suffix) => fs.existsSync(path.join(dir, img + suffix)));
}

// Vorschau aus dem Admin: ?heroPreview=<bild> zeigt ein Bild direkt, ?heroDate=JJJJ-MM-TT simuliert einen Tag
export async function resolveHeroSeasonImg(previewImg?: string, previewDate?: string): Promise<string | null> {
  if (previewImg) return hasImages(previewImg) ? previewImg : null;
  const settings = await loadSettings();
  if (settings.hero_seasons_enabled !== '1') return null;
  const date = previewDate && /^\d{4}-\d{2}-\d{2}$/.test(previewDate) ? previewDate : berlinToday();
  const season = activeHeroSeason(parseHeroSeasons(settings.hero_seasons), date);
  return season && hasImages(season.img) ? season.img : null;
}
