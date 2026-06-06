import { Router, Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { cacheService } from '../services/cache.service';

const router = Router();
const GEO_CACHE_DIR = path.join(__dirname, '../../data/geo');
fs.mkdirSync(GEO_CACHE_DIR, { recursive: true });

router.get('/adm1/:iso3', async (req: Request, res: Response) => {
  const iso3 = req.params.iso3.toUpperCase();
  const cacheKey = `geo_adm1_${iso3}`;
  const diskPath = path.join(GEO_CACHE_DIR, `${iso3}.json`);

  // 1. In-memory cache — fastest, lost on restart
  const memCached = cacheService.get<object>(cacheKey);
  if (memCached) {
    res.setHeader('X-Cache', 'HIT-MEM');
    return res.json(memCached);
  }

  // 2. Disk cache — stream file directly to avoid JSON parse+serialize overhead
  if (fs.existsSync(diskPath)) {
    try {
      res.setHeader('X-Cache', 'HIT-DISK');
      res.setHeader('Content-Type', 'application/json');
      return res.sendFile(diskPath);
    } catch {
      fs.unlinkSync(diskPath);
    }
  }

  // 3. Network fetch — GeoBoundaries simplified (~80% smaller than full)
  try {
    const url =
      `https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main` +
      `/releaseData/gbOpen/${iso3}/ADM1/geoBoundaries-${iso3}-ADM1_simplified.geojson`;

    const geoRes = await axios.get(url, { timeout: 30_000, responseType: 'text' });
    const geojson = typeof geoRes.data === 'string' ? JSON.parse(geoRes.data) : geoRes.data;

    // Persist to disk so the next request (including after restart) is instant
    fs.writeFileSync(diskPath, JSON.stringify(geojson));
    cacheService.set(cacheKey, geojson, 86_400);

    res.setHeader('X-Cache', 'MISS');
    res.json(geojson);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Geo] ADM1 fetch failed for', iso3, ':', msg);
    const status = axios.isAxiosError(err) && err.response?.status === 404 ? 404 : 500;
    res.status(status).json({ error: msg, iso3 });
  }
});

export default router;
