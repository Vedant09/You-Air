import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { iso2ToIso3 } from '../data/iso3';
import { environment } from '../environments/environment';

export interface StateRegion {
  name: string;
  bbox: { lamin: number; lamax: number; lomin: number; lomax: number };
  center: [number, number];
}

@Injectable({ providedIn: 'root' })
export class GeoService {
  private http = inject(HttpClient);
  private cache = new Map<string, GeoJSON.FeatureCollection>();

  async getAdm1(iso2: string): Promise<GeoJSON.FeatureCollection> {
    if (this.cache.has(iso2)) return this.cache.get(iso2)!;

    const iso3 = iso2ToIso3(iso2);
    if (!iso3) throw new Error(`No ISO3 code for ${iso2}`);

    // Proxy through our backend — avoids CORS and caches server-side
    const geojson = await firstValueFrom(
      this.http.get<GeoJSON.FeatureCollection>(
        `${environment.apiUrl}/api/geo/adm1/${iso3}`
      )
    );

    this.cache.set(iso2, geojson);
    return geojson;
  }

  /** Compute bbox {lamin, lamax, lomin, lomax} from a GeoJSON feature */
  bboxFromFeature(feature: GeoJSON.Feature): StateRegion['bbox'] {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;

    const walk = (coords: unknown): void => {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0] === 'number') {
        minLon = Math.min(minLon, coords[0]);
        maxLon = Math.max(maxLon, coords[0]);
        minLat = Math.min(minLat, coords[1] as number);
        maxLat = Math.max(maxLat, coords[1] as number);
      } else {
        (coords as unknown[]).forEach(walk);
      }
    };

    walk((feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates);
    return { lamin: minLat, lamax: maxLat, lomin: minLon, lomax: maxLon };
  }

  /** Resolve the human-readable state name from a GeoBoundaries feature */
  stateName(feature: GeoJSON.Feature): string {
    const p = feature.properties as Record<string, unknown>;
    return (p['shapeName'] ?? p['name'] ?? p['NAME'] ?? p['admin'] ?? 'Unknown') as string;
  }
}
