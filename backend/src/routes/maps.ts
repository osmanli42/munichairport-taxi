import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

function extractCountryCode(addr: string): 'DE' | 'AT' | 'CH' | 'IT' {
  if (/(österreich|austria)\s*$/i.test(addr)) return 'AT';
  if (/(schweiz|switzerland|suisse|svizzera)\s*$/i.test(addr)) return 'CH';
  if (/(italien|italy|italia)\s*$/i.test(addr)) return 'IT';
  return 'DE';
}

const _k1 = process.env.GOOGLE_MAPS_API_KEY || '';
const _k2 = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
// Nur aus der Umgebung — kein fest eingebauter Ersatzschlüssel (das Repo ist öffentlich).
const GOOGLE_API_KEY = _k1.length > 35 ? _k1 : _k2.length > 35 ? _k2 : '';
if (!GOOGLE_API_KEY) console.warn('[maps] GOOGLE_MAPS_API_KEY not set — address search and routing will fail');

// Geocode a free-text address to coordinates. Used as a server-side fallback
// (e.g. Pflichtfahrgebiet radius check) when the frontend did not send coords.
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    if (!address) return null;
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('key', GOOGLE_API_KEY);
    const response = await fetch(url.toString());
    const data = await response.json() as {
      status: string;
      results?: { geometry?: { location?: { lat: number; lng: number } } }[];
    };
    const loc = data.results?.[0]?.geometry?.location;
    if (data.status === 'OK' && loc) return { lat: loc.lat, lng: loc.lng };
    return null;
  } catch {
    return null;
  }
}

// GET /api/maps/geocode?address=... — public, resolve an address to coordinates
router.get('/geocode', async (req: Request, res: Response): Promise<void> => {
  const address = req.query.address as string | undefined;
  if (!address) {
    res.status(400).json({ error: 'address required' });
    return;
  }
  const coords = await geocodeAddress(address);
  if (!coords) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(coords);
});

// GET /api/maps/autocomplete?input=...
router.get('/autocomplete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { input } = req.query;
    if (!input || typeof input !== 'string' || input.length < 2) {
      res.status(400).json({ error: 'input required' });
      return;
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('key', GOOGLE_API_KEY);
    url.searchParams.set('language', (req.query.language as string) || 'de');
    url.searchParams.set('types', 'geocode|establishment');

    const response = await fetch(url.toString());
    const data = await response.json() as { status: string; predictions: unknown[] };

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      res.status(502).json({ error: 'Google API error', status: data.status });
      return;
    }

    res.json({ predictions: data.predictions || [] });
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

// ─── Betriebe an einer Hausadresse (Hotel, Gasthaus, Restaurant …) ───
// Der Kunde tippt "Sonnenstr. 25" und kennt den Hotelnamen nicht: Wir zeigen in der Vorschlagsliste,
// was genau an dieser Hausnummer liegt. Geocoding (place_id → Koordinate + Straße/Nr.) und
// Nearby Search (New) im 50-m-Kreis; nur Treffer mit identischer Straße und Hausnummer.
// Admin → Einstellungen "Hotels & Lokale an der Adresse" (address_poi_enabled).
interface AddressPlace { place_id: string; name: string; address: string; types: string[] }
const ADDRESS_PLACES_TTL_MS = 24 * 60 * 60 * 1000;
const addressPlacesCache = new Map<string, { at: number; places: AddressPlace[] }>();

const LODGING_TYPES = ['lodging', 'hotel', 'motel', 'hostel', 'guest_house', 'bed_and_breakfast', 'inn', 'resort_hotel', 'extended_stay_hotel', 'budget_japanese_inn', 'private_guest_room', 'farmstay', 'cottage'];
const FOOD_TYPES = ['restaurant', 'cafe', 'bar', 'pub', 'bakery', 'meal_takeaway', 'food', 'beer_garden', 'brewery', 'wine_bar', 'coffee_shop', 'night_club', 'event_venue', 'banquet_hall', 'wedding_venue'];
// Reine Adress-/Gebietsobjekte sind keine Betriebe.
const NON_BUSINESS_TYPES = ['premise', 'subpremise', 'street_address', 'route', 'locality', 'political', 'postal_code', 'neighborhood', 'sublocality'];

function normStreet(s: string): string {
  return s.toLowerCase().replace(/str\.?(?=\s|$)/g, 'straße').replace(/strasse/g, 'straße').replace(/[\s.-]+/g, '');
}
function normNumber(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}
function placeRank(types: string[]): number {
  if (types.some(t => LODGING_TYPES.includes(t))) return 0;
  if (types.some(t => FOOD_TYPES.includes(t))) return 1;
  return 2;
}

// GET /api/maps/address-places?place_id=...&language=de
router.get('/address-places', async (req: Request, res: Response): Promise<void> => {
  try {
    const placeId = req.query.place_id;
    if (typeof placeId !== 'string' || !/^[A-Za-z0-9_-]{10,600}$/.test(placeId)) {
      res.status(400).json({ error: 'place_id required' });
      return;
    }
    const [setting] = await query<{ setting_value: string }>(`SELECT setting_value FROM settings WHERE setting_key = 'address_poi_enabled'`);
    if (setting?.setting_value === '0') { res.json({ places: [] }); return; }

    const language = (req.query.language as string) === 'en' ? 'en' : 'de';
    const cacheKey = `${language}:${placeId}`;
    const cached = addressPlacesCache.get(cacheKey);
    if (cached && Date.now() - cached.at < ADDRESS_PLACES_TTL_MS) { res.json({ places: cached.places }); return; }

    const geoUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    geoUrl.searchParams.set('place_id', placeId);
    geoUrl.searchParams.set('key', GOOGLE_API_KEY);
    const geo = await fetch(geoUrl.toString()).then(r => r.json()) as {
      status: string;
      results?: { geometry?: { location?: { lat: number; lng: number } }; address_components?: { long_name: string; types: string[] }[] }[];
    };
    const g = geo.results?.[0];
    const loc = g?.geometry?.location;
    const route = g?.address_components?.find(c => c.types.includes('route'))?.long_name;
    const number = g?.address_components?.find(c => c.types.includes('street_number'))?.long_name;
    // Ohne Straße + Hausnummer lässt sich nichts eindeutig zuordnen.
    if (geo.status !== 'OK' || !loc || !route || !number) {
      addressPlacesCache.set(cacheKey, { at: Date.now(), places: [] });
      res.json({ places: [] });
      return;
    }

    const nearby = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.shortFormattedAddress,places.types,places.addressComponents',
      },
      body: JSON.stringify({
        locationRestriction: { circle: { center: { latitude: loc.lat, longitude: loc.lng }, radius: 50 } },
        rankPreference: 'DISTANCE',
        maxResultCount: 20,
        languageCode: language,
      }),
    }).then(r => r.json()) as {
      places?: {
        id: string;
        displayName?: { text: string };
        shortFormattedAddress?: string;
        types?: string[];
        addressComponents?: { longText: string; types: string[] }[];
      }[];
    };

    const wantStreet = normStreet(route);
    const wantNumber = normNumber(number);
    const places: AddressPlace[] = (nearby.places || [])
      .filter(p => {
        const types = p.types || [];
        if (!p.displayName?.text || types.some(t => NON_BUSINESS_TYPES.includes(t))) return false;
        const pRoute = p.addressComponents?.find(c => c.types.includes('route'))?.longText;
        const pNumber = p.addressComponents?.find(c => c.types.includes('street_number'))?.longText;
        return !!pRoute && !!pNumber && normStreet(pRoute) === wantStreet && normNumber(pNumber) === wantNumber;
      })
      .map(p => ({
        place_id: p.id,
        name: p.displayName!.text,
        address: p.shortFormattedAddress || `${route} ${number}`,
        types: p.types || [],
      }))
      .sort((a, b) => placeRank(a.types) - placeRank(b.types))
      .slice(0, 3);

    if (addressPlacesCache.size >= 2000) {
      const oldest = addressPlacesCache.keys().next().value;
      if (oldest) addressPlacesCache.delete(oldest);
    }
    addressPlacesCache.set(cacheKey, { at: Date.now(), places });
    res.json({ places });
  } catch (error) {
    console.error('Address places error:', error);
    res.json({ places: [] });
  }
});

// POST /api/maps/distance
router.post('/distance', async (req: Request, res: Response): Promise<void> => {
  try {
    const { origin, destination } = req.body;
    if (!origin || !destination) {
      res.status(400).json({ error: 'origin and destination required' });
      return;
    }

    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', origin);
    url.searchParams.set('destinations', destination);
    url.searchParams.set('key', GOOGLE_API_KEY);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('units', 'metric');
    url.searchParams.set('language', req.body.language || 'de');

    const response = await fetch(url.toString());
    const data = await response.json() as {
      status: string;
      destination_addresses?: string[];
      rows: { elements: { status: string; distance: { value: number }; duration: { value: number } }[] }[];
    };

    if (data.status !== 'OK') {
      res.status(502).json({ error: 'Google API error', status: data.status });
      return;
    }

    const element = data.rows[0]?.elements[0];
    if (!element || element.status !== 'OK') {
      res.status(404).json({ error: 'Route not found', status: element?.status });
      return;
    }

    const distance_km = element.distance.value / 1000;
    const duration_minutes = Math.ceil(element.duration.value / 60);
    const destination_country = extractCountryCode(data.destination_addresses?.[0] || destination);

    // Check if Anfahrt distance is needed (non-airport trip)
    let anfahrt_distance_km: number | undefined;
    if (req.body.check_anfahrt) {
      const AIRPORT_KEYWORDS = ['flughafen münchen', 'munich airport', 'münchen-flughafen', 'munchen-flughafen', '85356', 'oberding', 'hallbergmoos', 'freising'];
      const originLower = (origin as string).toLowerCase();
      const destLower = (destination as string).toLowerCase();
      const isAirportTrip = AIRPORT_KEYWORDS.some(kw => originLower.includes(kw) || destLower.includes(kw));

      if (!isAirportTrip) {
        // Calculate distance from Freising to pickup (origin)
        const anfahrtUrl = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
        anfahrtUrl.searchParams.set('origins', 'Freising, Germany');
        anfahrtUrl.searchParams.set('destinations', origin as string);
        anfahrtUrl.searchParams.set('key', GOOGLE_API_KEY);
        anfahrtUrl.searchParams.set('mode', 'driving');
        anfahrtUrl.searchParams.set('units', 'metric');

        const anfahrtResponse = await fetch(anfahrtUrl.toString());
        const anfahrtData = await anfahrtResponse.json() as {
          status: string;
          rows: { elements: { status: string; distance: { value: number }; duration: { value: number } }[] }[];
        };

        if (anfahrtData.status === 'OK') {
          const anfahrtElement = anfahrtData.rows[0]?.elements[0];
          if (anfahrtElement?.status === 'OK') {
            anfahrt_distance_km = anfahrtElement.distance.value / 1000;
          }
        }
      }
    }

    // Zwischenstopp: calculate multi-leg distance (Pickup → Stop → Dropoff)
    let zwischenstopp_total_km: number | undefined;
    let zwischenstopp_total_duration: number | undefined;
    if (req.body.zwischenstopp) {
      const stop = req.body.zwischenstopp as string;
      // Leg 1: origin → zwischenstopp
      const leg1Url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      leg1Url.searchParams.set('origins', origin as string);
      leg1Url.searchParams.set('destinations', stop);
      leg1Url.searchParams.set('key', GOOGLE_API_KEY);
      leg1Url.searchParams.set('mode', 'driving');
      leg1Url.searchParams.set('units', 'metric');

      // Leg 2: zwischenstopp → destination
      const leg2Url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      leg2Url.searchParams.set('origins', stop);
      leg2Url.searchParams.set('destinations', destination as string);
      leg2Url.searchParams.set('key', GOOGLE_API_KEY);
      leg2Url.searchParams.set('mode', 'driving');
      leg2Url.searchParams.set('units', 'metric');

      const [leg1Res, leg2Res] = await Promise.all([
        fetch(leg1Url.toString()).then(r => r.json()) as Promise<any>,
        fetch(leg2Url.toString()).then(r => r.json()) as Promise<any>,
      ]);

      const leg1El = leg1Res?.rows?.[0]?.elements?.[0];
      const leg2El = leg2Res?.rows?.[0]?.elements?.[0];

      if (leg1El?.status === 'OK' && leg2El?.status === 'OK') {
        zwischenstopp_total_km = (leg1El.distance.value + leg2El.distance.value) / 1000;
        zwischenstopp_total_duration = Math.ceil((leg1El.duration.value + leg2El.duration.value) / 60);
      }
    }

    res.json({
      distance_km,
      duration_minutes,
      destination_country,
      ...(anfahrt_distance_km !== undefined && { anfahrt_distance_km }),
      ...(zwischenstopp_total_km !== undefined && { zwischenstopp_total_km, zwischenstopp_total_duration }),
    });
  } catch (error) {
    console.error('Distance calculation error:', error);
    res.status(500).json({ error: 'Distance calculation failed' });
  }
});

// GET /api/maps/place-details?place_id=...
router.get('/place-details', async (req: Request, res: Response): Promise<void> => {
  try {
    const { place_id } = req.query;
    if (!place_id || typeof place_id !== 'string') {
      res.status(400).json({ error: 'place_id required' });
      return;
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', place_id);
    url.searchParams.set('key', GOOGLE_API_KEY);
    url.searchParams.set('fields', 'name,address_components,types,formatted_address,geometry');
    url.searchParams.set('language', (req.query.language as string) || 'de');

    const response = await fetch(url.toString());
    const data = await response.json() as {
      status: string;
      result?: {
        name?: string;
        address_components?: { long_name: string; short_name: string; types: string[] }[];
        types?: string[];
        formatted_address?: string;
        geometry?: { location?: { lat: number; lng: number } };
      };
    };

    if (data.status !== 'OK') {
      res.status(502).json({ error: 'Google API error', status: data.status });
      return;
    }

    const result = data.result;
    const components = result?.address_components || [];
    const types = result?.types || [];

    // Check if address has street number
    const hasStreetNumber = components.some(c => c.types.includes('street_number'));
    const hasRoute = components.some(c => c.types.includes('route'));

    // Check if it's a specific establishment (airport, hotel, etc.) — those are OK without street number
    const specificPlaceTypes = ['airport', 'train_station', 'transit_station', 'bus_station',
      'lodging', 'hotel', 'restaurant', 'hospital', 'shopping_mall', 'university',
      'stadium', 'museum', 'amusement_park', 'church', 'school'];
    const isEstablishment = types.includes('establishment') ||
      types.some(t => specificPlaceTypes.includes(t));

    const isSpecificEnough = (hasStreetNumber && hasRoute) || isEstablishment;
    const location = result?.geometry?.location;

    res.json({
      name: result?.name || null,
      formatted_address: result?.formatted_address,
      has_street_number: hasStreetNumber,
      has_route: hasRoute,
      is_establishment: isEstablishment,
      is_specific: isSpecificEnough,
      types,
      lat: location?.lat,
      lng: location?.lng,
    });
  } catch (error) {
    console.error('Place details error:', error);
    res.status(500).json({ error: 'Place details failed' });
  }
});

export default router;
