import { Router, Request, Response } from 'express';

const router = Router();

const _k1 = process.env.GOOGLE_MAPS_API_KEY || '';
const _k2 = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_API_KEY = _k1.length > 35 ? _k1 : _k2.length > 35 ? _k2 : 'AIzaSyA7wWp8hvzPOVGUsy4pTFVgTzF9QBkmFxI';

// GET /api/maps/debug-key (temporary)
router.get('/debug-key', (req: Request, res: Response): void => {
  const key1 = process.env.GOOGLE_MAPS_API_KEY || '';
  const key2 = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  res.json({
    GOOGLE_MAPS_API_KEY_len: key1.length,
    GOOGLE_MAPS_API_KEY_start: key1.substring(0, 10),
    NEXT_PUBLIC_len: key2.length,
    NEXT_PUBLIC_start: key2.substring(0, 10),
    NEXT_PUBLIC_end: key2.substring(key2.length - 6),
  });
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
    url.searchParams.set('components', 'country:de|country:at|country:ch');
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

    res.json({ distance_km, duration_minutes, ...(anfahrt_distance_km !== undefined && { anfahrt_distance_km }) });
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
    url.searchParams.set('fields', 'address_components,types,formatted_address');
    url.searchParams.set('language', (req.query.language as string) || 'de');

    const response = await fetch(url.toString());
    const data = await response.json() as {
      status: string;
      result?: {
        address_components?: { long_name: string; short_name: string; types: string[] }[];
        types?: string[];
        formatted_address?: string;
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

    res.json({
      formatted_address: result?.formatted_address,
      has_street_number: hasStreetNumber,
      has_route: hasRoute,
      is_establishment: isEstablishment,
      is_specific: isSpecificEnough,
      types,
    });
  } catch (error) {
    console.error('Place details error:', error);
    res.status(500).json({ error: 'Place details failed' });
  }
});

export default router;
