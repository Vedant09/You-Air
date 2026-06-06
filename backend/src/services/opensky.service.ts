import axios from 'axios';
import { AircraftState, OpenSkyResponse, FlightStats, BoundingBox } from '../types';
import { cacheService } from './cache.service';

const OPENSKY_BASE = 'https://opensky-network.org/api';
const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const TIMEOUT = 20000;
const STALE_TTL = 300; // 5-min stale fallback

// ─── OAuth2 token manager ─────────────────────────────────────────────────────

const CLIENT_ID = process.env.OPENSKY_CLIENT_ID;
const CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET;

let cachedToken: string | null = null;
let tokenExpiresAt = 0; // ms epoch

async function getBearerToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;

  // Refresh 60 s before expiry
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  try {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });
    const { data } = await axios.post<{ access_token: string; expires_in: number }>(
      TOKEN_URL,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10_000 }
    );
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000;
    console.log('[OpenSky] OAuth2 token refreshed, expires in', data.expires_in, 's');
    return cachedToken;
  } catch (err) {
    console.error('[OpenSky] Token fetch failed:', (err as Error).message);
    return null;
  }
}

async function buildHeaders(): Promise<Record<string, string>> {
  const token = await getBearerToken();
  const headers: Record<string, string> = {
    'User-Agent': 'AirspaceExplorer/1.0 (educational project)',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function parseState(s: (string | number | boolean | null)[]): AircraftState {
  return {
    icao24:        (s[0] as string) || '',
    callsign:      s[1] ? (s[1] as string).trim() || null : null,
    originCountry: (s[2] as string) || 'Unknown',
    timePosition:  s[3] as number | null,
    lastContact:   (s[4] as number) || 0,
    longitude:     s[5] as number | null,
    latitude:      s[6] as number | null,
    baroAltitude:  s[7] as number | null,
    onGround:      (s[8] as boolean) || false,
    velocity:      s[9] as number | null,
    trueTrack:     s[10] as number | null,
    verticalRate:  s[11] as number | null,
    geoAltitude:   s[13] as number | null,
    squawk:        s[14] as string | null,
    spi:           (s[15] as boolean) || false,
    positionSource:(s[16] as number) || 0,
  };
}

function filterValid(states: AircraftState[]): AircraftState[] {
  return states.filter(s => s.latitude !== null && s.longitude !== null && s.icao24);
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getWorldFlights(): Promise<AircraftState[]> {
  const key = 'world_flights';
  const staleKey = 'world_flights_stale';

  const cached = cacheService.get<AircraftState[]>(key);
  if (cached) return cached;

  try {
    const headers = await buildHeaders();
    const { data } = await axios.get<OpenSkyResponse>(
      `${OPENSKY_BASE}/states/all`,
      { timeout: TIMEOUT, headers }
    );

    if (!data.states) {
      const stale = cacheService.get<AircraftState[]>(staleKey);
      if (stale) {
        console.warn('[OpenSky] states=null (rate limited) — serving stale data');
        cacheService.set(key, stale, 15);
        return stale;
      }
      console.warn('[OpenSky] states=null and no stale data');
      return [];
    }

    const states = filterValid(data.states.map(parseState));
    cacheService.set(key, states, 30);
    cacheService.set(staleKey, states, STALE_TTL);
    return states;
  } catch (err) {
    console.error('[OpenSky] world flights error:', (err as Error).message);
    return cacheService.get<AircraftState[]>(staleKey)
        ?? cacheService.get<AircraftState[]>(key)
        ?? [];
  }
}

export async function getFlightsByBbox(bbox: BoundingBox): Promise<AircraftState[]> {
  const key = `bbox_${bbox.lamin}_${bbox.lamax}_${bbox.lomin}_${bbox.lomax}`;
  const staleKey = `${key}_stale`;

  const cached = cacheService.get<AircraftState[]>(key);
  if (cached) return cached;

  try {
    const headers = await buildHeaders();
    const params = new URLSearchParams({
      lamin: String(bbox.lamin), lamax: String(bbox.lamax),
      lomin: String(bbox.lomin), lomax: String(bbox.lomax),
    });
    const { data } = await axios.get<OpenSkyResponse>(
      `${OPENSKY_BASE}/states/all?${params}`,
      { timeout: TIMEOUT, headers }
    );

    if (!data.states) {
      const stale = cacheService.get<AircraftState[]>(staleKey);
      if (stale) return stale;
      return [];
    }

    const states = filterValid(data.states.map(parseState));
    cacheService.set(key, states, 30);
    cacheService.set(staleKey, states, STALE_TTL);
    return states;
  } catch (err) {
    console.error('[OpenSky] bbox error:', (err as Error).message);
    return cacheService.get<AircraftState[]>(staleKey)
        ?? cacheService.get<AircraftState[]>(key)
        ?? [];
  }
}

export async function getFlightStats(): Promise<FlightStats> {
  const key = 'flight_stats';
  const cached = cacheService.get<FlightStats>(key);
  if (cached) return cached;

  const flights = await getWorldFlights();
  const countryCounts: Record<string, number> = {};
  let onGround = 0, airborne = 0;

  for (const f of flights) {
    if (f.onGround) onGround++; else airborne++;
    const c = f.originCountry || 'Unknown';
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  }

  const topCountries = Object.entries(countryCounts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const stats: FlightStats = { totalFlights: flights.length, onGround, airborne, topCountries, updatedAt: Date.now() };
  cacheService.set(key, stats, 60);
  return stats;
}
