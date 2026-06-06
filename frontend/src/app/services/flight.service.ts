import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription, switchMap, catchError, of, startWith } from 'rxjs';
import { Aircraft } from '../models/aircraft.model';
import { environment } from '../environments/environment';

interface BboxQuery { lamin: number; lamax: number; lomin: number; lomax: number; }

@Injectable({ providedIn: 'root' })
export class FlightService {
  private http = inject(HttpClient);
  private pollSub: Subscription | null = null;

  readonly flights = signal<Aircraft[]>([]);
  readonly loading = signal(false);
  readonly lastUpdated = signal<Date | null>(null);

  startPolling(bbox: BboxQuery, intervalMs = 30_000): void {
    this.stopPolling();
    this.loading.set(true);

    const params = new URLSearchParams({
      lamin: String(bbox.lamin), lamax: String(bbox.lamax),
      lomin: String(bbox.lomin), lomax: String(bbox.lomax),
    });

    this.pollSub = interval(intervalMs).pipe(
      startWith(0),
      switchMap(() =>
        this.http.get<{ success: boolean; data: Aircraft[] }>(
          `${environment.apiUrl}/api/flights/region/live?${params}`
        ).pipe(catchError(() => of(null)))
      )
    ).subscribe(res => {
      this.loading.set(false);
      if (res?.success) {
        this.flights.set(res.data.filter(a => a.latitude !== null && a.longitude !== null && !a.onGround));
        this.lastUpdated.set(new Date());
      }
    });
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  clear(): void {
    this.flights.set([]);
    this.lastUpdated.set(null);
  }
}
