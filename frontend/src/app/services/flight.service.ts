import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription, switchMap, catchError, of, startWith } from 'rxjs';
import { Aircraft, Airport, BoundingBox, FlightStats } from '../models/aircraft.model';
import { environment } from '../environments/environment';

interface ApiResponse<T> {
  success: boolean;
  count: number;
  data: T;
  timestamp?: number;
}

@Injectable({ providedIn: 'root' })
export class FlightService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;
  private pollSub: Subscription | null = null;

  readonly worldAircraft = signal<Aircraft[]>([]);
  readonly airports = signal<Airport[]>([]);
  readonly stats = signal<FlightStats | null>(null);
  readonly isLoadingWorld = signal(false);
  readonly lastUpdated = signal<Date | null>(null);

  // Poll aircraft for a specific bounding box (triggered on country/region click).
  startRegionPolling(bbox: BoundingBox, intervalMs = 60_000): void {
    this.stopPolling();
    this.isLoadingWorld.set(true);

    const params = new URLSearchParams({
      lamin: String(bbox.lamin), lamax: String(bbox.lamax),
      lomin: String(bbox.lomin), lomax: String(bbox.lomax),
    });

    this.pollSub = interval(intervalMs).pipe(
      startWith(0),
      switchMap(() =>
        this.http.get<ApiResponse<Aircraft[]>>(
          `${this.base}/api/flights/region/current?${params}`
        ).pipe(catchError(() => of(null)))
      )
    ).subscribe(res => {
      this.isLoadingWorld.set(false);
      if (res?.success) {
        this.worldAircraft.set(res.data);
        this.lastUpdated.set(new Date());
      }
    });
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  clearAircraft(): void {
    this.worldAircraft.set([]);
  }

  async loadStats(): Promise<void> {
    try {
      const res = await this.http
        .get<{ success: boolean; data: FlightStats }>(`${this.base}/api/flights/stats`)
        .toPromise();
      if (res?.success) this.stats.set(res.data);
    } catch {
      // ignore
    }
  }

  async loadAirports(bbox?: BoundingBox): Promise<void> {
    try {
      let url = `${this.base}/api/airports`;
      if (bbox) {
        const params = new URLSearchParams({
          lamin: String(bbox.lamin),
          lamax: String(bbox.lamax),
          lomin: String(bbox.lomin),
          lomax: String(bbox.lomax),
        });
        url += `?${params}`;
      }
      const res = await this.http.get<ApiResponse<Airport[]>>(url).toPromise();
      if (res?.success) this.airports.set(res.data);
    } catch {
      // ignore
    }
  }

  filterByBbox(aircraft: Aircraft[], bbox: BoundingBox): Aircraft[] {
    return aircraft.filter(
      a => a.latitude !== null && a.longitude !== null &&
           a.latitude! >= bbox.lamin && a.latitude! <= bbox.lamax &&
           a.longitude! >= bbox.lomin && a.longitude! <= bbox.lomax
    );
  }
}
