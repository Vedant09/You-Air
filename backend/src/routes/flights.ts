import { Router, Request, Response } from 'express';
import { getWorldFlights, getFlightsByBbox, getFlightStats } from '../services/opensky.service';

const router = Router();

const COUNTRY_BBOXES: Record<string, [number, number, number, number]> = {
  us: [24.396, 49.384, -125.0, -66.934],
  usa: [24.396, 49.384, -125.0, -66.934],
  india: [8.4, 37.6, 68.7, 97.25],
  china: [18.0, 53.56, 73.68, 135.08],
  uk: [49.9, 60.9, -8.62, 1.77],
  france: [41.3, 51.1, -5.14, 9.56],
  germany: [47.27, 55.06, 5.87, 15.04],
  brazil: [-33.75, 5.27, -73.99, -28.85],
  australia: [-43.64, -10.67, 113.34, 153.64],
  canada: [41.68, 83.11, -141.0, -52.64],
  russia: [41.19, 81.86, 19.64, 180.0],
  japan: [24.25, 45.71, 122.94, 153.99],
  mexico: [14.54, 32.72, -118.36, -86.71],
  spain: [27.64, 43.79, -18.16, 4.33],
  italy: [35.49, 47.09, 6.63, 18.52],
  southafrica: [-34.83, -22.13, 16.46, 32.89],
};

router.get('/world', async (_req: Request, res: Response) => {
  try {
    const flights = await getWorldFlights();
    res.json({ success: true, count: flights.length, data: flights, timestamp: Date.now() });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch world flights' });
  }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getFlightStats();
    res.json({ success: true, data: stats });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

router.get('/country/:country', async (req: Request, res: Response) => {
  const key = req.params.country.toLowerCase().replace(/\s+/g, '');
  const bbox = COUNTRY_BBOXES[key];

  if (bbox) {
    const [lamin, lamax, lomin, lomax] = bbox;
    const flights = await getFlightsByBbox({ lamin, lamax, lomin, lomax });
    return res.json({ success: true, count: flights.length, data: flights });
  }

  const { lamin, lamax, lomin, lomax } = req.query;
  if (!lamin || !lamax || !lomin || !lomax) {
    return res.status(400).json({
      success: false,
      error: 'Unknown country. Provide bbox query params: lamin, lamax, lomin, lomax',
    });
  }

  const flights = await getFlightsByBbox({
    lamin: Number(lamin),
    lamax: Number(lamax),
    lomin: Number(lomin),
    lomax: Number(lomax),
  });
  res.json({ success: true, count: flights.length, data: flights });
});

router.get('/region/:region', async (req: Request, res: Response) => {
  const { lamin, lamax, lomin, lomax } = req.query;
  if (!lamin || !lamax || !lomin || !lomax) {
    return res.status(400).json({
      success: false,
      error: 'Provide bbox query params: lamin, lamax, lomin, lomax',
    });
  }
  const flights = await getFlightsByBbox({
    lamin: Number(lamin),
    lamax: Number(lamax),
    lomin: Number(lomin),
    lomax: Number(lomax),
  });
  res.json({ success: true, count: flights.length, data: flights });
});

export default router;
