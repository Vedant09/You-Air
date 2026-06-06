import { Router, Request, Response } from 'express';
import { getAirports, getAirportsByBbox } from '../services/airports.service';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { country, type, lamin, lamax, lomin, lomax } = req.query;

  if (lamin && lamax && lomin && lomax) {
    const airports = getAirportsByBbox({
      lamin: Number(lamin),
      lamax: Number(lamax),
      lomin: Number(lomin),
      lomax: Number(lomax),
    });
    return res.json({ success: true, count: airports.length, data: airports });
  }

  const airports = getAirports({
    country: country as string | undefined,
    type: type as string | undefined,
  });
  res.json({ success: true, count: airports.length, data: airports });
});

export default router;
