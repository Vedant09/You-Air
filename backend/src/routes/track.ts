import { Router, Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { cacheService } from '../services/cache.service';
import { getAirports } from '../services/airports.service';

const router = Router();

const OPENSKY_BASE = 'https://opensky-network.org/api';
const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

// ─── Airport lookup ───────────────────────────────────────────────────────────

interface AirportInfo { name: string; city: string; lat: number; lon: number; }
type AirportPin = AirportInfo & { icao: string; iata: string | null; estimated?: boolean };

const AIRPORTS: Record<string, AirportInfo> = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../data/airports_lookup.json'), 'utf-8')
);
const AIRPORT_LIST = Object.entries(AIRPORTS).map(([icao, a]) => ({ icao, ...a }));

// IATA codes only exist in the curated airport dataset — cross-reference by ICAO
const IATA_BY_ICAO: Record<string, string> = {};
for (const ap of getAirports()) {
  IATA_BY_ICAO[ap.icao] = ap.iata;
}

function lookupAirport(icao: string | null): AirportPin | null {
  if (!icao) return null;
  const key = icao.toUpperCase();
  const a = AIRPORTS[key];
  return a ? { icao: key, iata: IATA_BY_ICAO[key] ?? null, ...a } : null;
}

/** Haversine distance in km between two lat/lon points. */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Project a point forward from (lat, lon) by distanceKm in the given heading (degrees).
 * Uses spherical Earth formula.
 */
function projectForward(lat: number, lon: number, headingDeg: number, distanceKm: number): { lat: number; lon: number } {
  const R = 6371;
  const d = distanceKm / R;
  const brng = headingDeg * Math.PI / 180;
  const φ1 = lat * Math.PI / 180;
  const λ1 = lon * Math.PI / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(brng));
  const λ2 = λ1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: φ2 * 180 / Math.PI, lon: λ2 * 180 / Math.PI };
}

/**
 * Compute the heading (degrees) between two lat/lon points.
 */
function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const dλ = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/**
 * Given the plane's current position and heading, find the nearest major airport
 * that is roughly in the direction of travel (within ±60°) and at a plausible range.
 * Returns the closest such airport as an estimated destination.
 */
function estimateDestination(
  lat: number, lon: number, headingDeg: number, departureLat?: number, departureLon?: number
): AirportPin | null {
  // Estimate flight distance remaining: use distance already flown as a proxy for total range,
  // or default to 800–4000 km search window.
  let candidates = AIRPORT_LIST
    .map(ap => {
      const dist = haversine(lat, lon, ap.lat, ap.lon);
      const brng = bearing(lat, lon, ap.lat, ap.lon);
      let angleDiff = Math.abs(brng - headingDeg);
      if (angleDiff > 180) angleDiff = 360 - angleDiff;
      return { ...ap, dist, angleDiff };
    })
    // Must be ahead of us (within ±60° of current heading) and at least 80km away
    .filter(ap => ap.angleDiff <= 60 && ap.dist >= 80)
    // Exclude departure airport
    .filter(ap => {
      if (departureLat === undefined || departureLon === undefined) return true;
      return haversine(ap.lat, ap.lon, departureLat, departureLon) > 50;
    })
    .sort((a, b) => a.dist - b.dist);

  // If we have many candidates, prefer airports within a 3000 km window
  const nearby = candidates.filter(ap => ap.dist <= 3000);
  candidates = nearby.length > 0 ? nearby : candidates;

  if (candidates.length === 0) return null;
  const { dist: _d, angleDiff: _a, ...ap } = candidates[0];
  return { ...ap, iata: IATA_BY_ICAO[ap.icao] ?? null, estimated: true };
}

// ─── OAuth token ──────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getToken(): Promise<string | null> {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;
  try {
    const params = new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret });
    const { data } = await axios.post<{ access_token: string; expires_in: number }>(
      TOKEN_URL, params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10_000 }
    );
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return cachedToken;
  } catch { return null; }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  const h: Record<string, string> = { 'User-Agent': 'AirspaceExplorer/1.0' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get('/:icao24', async (req: Request, res: Response) => {
  const icao24 = req.params.icao24.toLowerCase();
  const cacheKey = `track_${icao24}`;

  const cached = cacheService.get<object>(cacheKey);
  if (cached) return res.json(cached);

  const hdrs = await authHeaders();
  const now = Math.floor(Date.now() / 1000);
  const begin = now - 86400; // 24-hour lookback to catch long-haul departures

  const [trackRes, flightRes] = await Promise.allSettled([
    axios.get(`${OPENSKY_BASE}/tracks/all?icao24=${icao24}&time=0`, { headers: hdrs, timeout: 15_000 }),
    axios.get(`${OPENSKY_BASE}/flights/aircraft?icao24=${icao24}&begin=${begin}&end=${now}`, { headers: hdrs, timeout: 15_000 }),
  ]);

  const trackData = trackRes.status === 'fulfilled' ? trackRes.value.data : null;

  // path[i] = [time, lat, lon, baroAlt, heading, onGround]
  const rawPath: unknown[][] = trackData?.path ?? [];
  const flightPoints = rawPath.filter((p: unknown[]) => p[1] != null && p[2] != null && !p[5]);
  const pathLatLon: [number, number][] = flightPoints.map((p: unknown[]) => [p[1] as number, p[2] as number]);

  // Current heading: average of last few track headings (index 4)
  const recentHeadings = rawPath.slice(-5).map((p: unknown[]) => p[4] as number).filter(h => h != null);
  const currentHeading = recentHeadings.length
    ? recentHeadings.reduce((a, b) => a + b, 0) / recentHeadings.length
    : null;

  // Current position: last track point
  const lastPoint = pathLatLon[pathLatLon.length - 1] ?? null;

  // Departure / arrival from OpenSky historical flights endpoint
  const flights = flightRes.status === 'fulfilled' ? flightRes.value.data : [];
  const latest = Array.isArray(flights) ? flights[flights.length - 1] : null;
  const departure = lookupAirport(latest?.estDepartureAirport ?? null);
  let arrival = lookupAirport(latest?.estArrivalAirport ?? null);

  // If no arrival from OpenSky (flight still airborne), estimate from heading
  if (!arrival && lastPoint && currentHeading !== null) {
    arrival = estimateDestination(
      lastPoint[0], lastPoint[1], currentHeading,
      departure?.lat, departure?.lon
    );
  }

  const result = {
    icao24,
    callsign: trackData?.callsign?.trim() ?? null,
    path: pathLatLon,
    currentHeading,
    departure,
    arrival,
  };

  cacheService.set(cacheKey, result, 30);
  res.json(result);
});

export default router;
