import { Injectable } from '@angular/core';
import { Aircraft } from '../models/aircraft.model';

export interface AnimatedAircraft extends Aircraft {
  /** Current interpolated [lon, lat, altMeters] */
  animPos: [number, number, number];
  /** Position history for trail — up to HISTORY_LEN entries */
  trail: [number, number, number][];
}

const HISTORY_LEN = 25;        // trail length (positions stored)
const MAX_DEAD_RECKON_S = 90;  // don't extrapolate past 90 s (avoid wild drift)

/** Haversine dead-reckoning: advance a position forward in time. */
function deadReckon(
  lon: number, lat: number, alt: number,
  headingDeg: number, velocityMs: number, vertRateMs: number,
  elapsedS: number
): [number, number, number] {
  if (velocityMs < 0.5 || elapsedS <= 0) return [lon, lat, alt];
  const s = Math.min(elapsedS, MAX_DEAD_RECKON_S);
  const dist = velocityMs * s; // metres

  const R = 6_371_000;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const θ = (headingDeg * Math.PI) / 180;
  const δ = dist / R;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

  return [
    (λ2 * 180) / Math.PI,
    (φ2 * 180) / Math.PI,
    Math.max(0, alt + vertRateMs * s),
  ];
}

/** Build a projected-path great-circle arc (for the selected-aircraft overlay). */
export function buildProjectedPath(
  aircraft: AnimatedAircraft,
  minutesAhead = 20
): [number, number, number][] {
  if (!aircraft.velocity || aircraft.onGround) return [];
  const [lon, lat, alt] = aircraft.animPos;
  const heading = aircraft.trueTrack ?? 0;
  const vMs = aircraft.velocity;
  const vr = aircraft.verticalRate ?? 0;
  const pts: [number, number, number][] = [];
  for (let s = 0; s <= minutesAhead * 60; s += 30) {
    pts.push(deadReckon(lon, lat, alt, heading, vMs, vr, s));
  }
  return pts;
}

interface Track {
  aircraft: Aircraft;
  trail: [number, number, number][];
  lastUpdateS: number;
}

@Injectable({ providedIn: 'root' })
export class AircraftAnimatorService {
  private tracks = new Map<string, Track>();

  /**
   * Call this whenever a new OpenSky snapshot arrives.
   * Stores the new authoritative position and appends to the trail.
   */
  ingestSnapshot(snapshot: Aircraft[]): void {
    const nowS = Date.now() / 1000;
    const seen = new Set<string>();

    for (const a of snapshot) {
      if (a.latitude === null || a.longitude === null) continue;
      seen.add(a.icao24);

      const pos: [number, number, number] = [
        a.longitude,
        a.latitude,
        a.baroAltitude ?? a.geoAltitude ?? 0,
      ];

      const existing = this.tracks.get(a.icao24);
      if (existing) {
        existing.aircraft = a;
        existing.lastUpdateS = nowS;
        // Only push to trail if moved meaningfully (avoids duplicate entries)
        const last = existing.trail[existing.trail.length - 1];
        if (!last || Math.abs(pos[0] - last[0]) > 0.005 || Math.abs(pos[1] - last[1]) > 0.005) {
          existing.trail.push(pos);
          if (existing.trail.length > HISTORY_LEN) existing.trail.shift();
        }
      } else {
        this.tracks.set(a.icao24, {
          aircraft: a,
          trail: [pos],
          lastUpdateS: nowS,
        });
      }
    }

    // Evict aircraft that have vanished for > 2 minutes
    const cutoff = nowS - 120;
    for (const [id, track] of this.tracks) {
      if (!seen.has(id) && track.lastUpdateS < cutoff) this.tracks.delete(id);
    }
  }

  /**
   * Returns the current animated state for every tracked aircraft.
   * Call this at 60fps from a requestAnimationFrame loop.
   */
  getFrame(): AnimatedAircraft[] {
    const nowS = Date.now() / 1000;
    const result: AnimatedAircraft[] = [];

    for (const track of this.tracks.values()) {
      const a = track.aircraft;
      let animPos: [number, number, number];

      if (
        a.onGround ||
        a.latitude === null ||
        a.longitude === null ||
        !a.velocity ||
        a.trueTrack === null
      ) {
        animPos = [a.longitude ?? 0, a.latitude ?? 0, 0];
      } else {
        const elapsed = nowS - track.lastUpdateS;
        animPos = deadReckon(
          a.longitude,
          a.latitude,
          a.baroAltitude ?? 0,
          a.trueTrack,
          a.velocity,
          a.verticalRate ?? 0,
          elapsed
        );
      }

      result.push({ ...a, animPos, trail: track.trail });
    }

    return result;
  }

}
