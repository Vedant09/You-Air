import { Injectable } from '@angular/core';
import { BoundingBox, SelectedRegion } from '../models/aircraft.model';

interface NominatimResult {
  display_name: string;
  address: {
    country?: string;
    state?: string;
    province?: string;
    region?: string;
    county?: string;
    city?: string;
  };
  boundingbox: [string, string, string, string]; // south, north, west, east
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private lastCall = 0;

  async reverseGeocode(lat: number, lon: number, zoomHint: 'country' | 'state'): Promise<SelectedRegion | null> {
    // Nominatim rate limit: 1 req/sec
    const now = Date.now();
    if (now - this.lastCall < 1100) {
      await new Promise(r => setTimeout(r, 1100 - (now - this.lastCall)));
    }
    this.lastCall = Date.now();

    const nominatimZoom = zoomHint === 'country' ? 5 : 8;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=${nominatimZoom}&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'AirspaceExplorer/1.0 (educational project)',
        },
      });
      const data: NominatimResult = await res.json();

      const bb = data.boundingbox;
      const bbox: BoundingBox = {
        lamin: parseFloat(bb[0]),
        lamax: parseFloat(bb[1]),
        lomin: parseFloat(bb[2]),
        lomax: parseFloat(bb[3]),
      };

      const addr = data.address;
      const name =
        zoomHint === 'country'
          ? (addr.country || 'Unknown')
          : (addr.state || addr.province || addr.region || addr.county || addr.country || 'Unknown');

      const centerLon = (bbox.lomin + bbox.lomax) / 2;
      const centerLat = (bbox.lamin + bbox.lamax) / 2;

      const span = Math.max(bbox.lamax - bbox.lamin, bbox.lomax - bbox.lomin);
      const zoom = zoomHint === 'country'
        ? Math.max(3, Math.min(6, Math.round(7 - Math.log2(span))))
        : Math.max(6, Math.min(10, Math.round(10 - Math.log2(span))));

      return { name, bbox, center: [centerLon, centerLat], zoom };
    } catch (e) {
      console.error('[Geocoding] Nominatim error:', e);
      return null;
    }
  }
}
