import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
  AfterViewInit, ElementRef, ViewChild, NgZone, inject, signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as L from 'leaflet';
import { FlightService } from '../../services/flight.service';
import { Aircraft } from '../../models/aircraft.model';
import { Country } from '../../data/countries';
import { StateRegion } from '../../services/geo.service';
import { environment } from '../../environments/environment';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrackedFlight {
  icao24: string;
  marker: L.Marker;
  prevLat: number;
  prevLon: number;
  targetLat: number;
  targetLon: number;
  heading: number;
  animStart: number;
}

interface PopupFlight {
  icao24: string;
  callsign: string | null;
  country: string;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  lat: number;
  lon: number;
}

interface AirportPin { icao: string; name: string; city: string; lat: number; lon: number; estimated?: boolean; }

interface TrackResult {
  icao24: string;
  callsign: string | null;
  path: [number, number][];
  currentHeading: number | null;
  departure: AirportPin | null;
  arrival: AirportPin | null;
}

const ANIM_DURATION = 25_000; // ms to interpolate to new position

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

function altitudeColor(alt: number | null): string {
  if (alt === null) return '#64748b';
  const t = Math.min(alt / 12000, 1);
  if (t < 0.33) return '#38bdf8'; // low — cyan
  if (t < 0.66) return '#34d399'; // mid — green
  return '#f97316';               // high — orange
}

function planeSvg(color: string, heading: number, tracked = false): string {
  const size = tracked ? 40 : 32;
  const ring = tracked
    ? `<div style="position:absolute;inset:0;border-radius:50%;border:2px solid #f59e0b;animation:pulse-ring 1.4s ease-out infinite;"></div>
       <div style="position:absolute;inset:0;border-radius:50%;border:2px solid #f59e0b;animation:pulse-ring 1.4s ease-out 0.7s infinite;opacity:0.5;"></div>`
    : '';
  return `
    <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
      ${ring}
      <div style="transform:rotate(${heading}deg);display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 24 24" width="${tracked ? 34 : 28}" height="${tracked ? 34 : 28}" xmlns="http://www.w3.org/2000/svg">
          <path fill="${tracked ? '#f59e0b' : color}" stroke="rgba(0,0,0,0.5)" stroke-width="0.5"
            d="M12 2L8 10H3l2 2-1 1 4 1 1 3H7l1 2 4-1 4 1 1-2h-2l1-3 4-1-1-1 2-2h-5z"/>
        </svg>
      </div>
    </div>`;
}

function makePlaneIcon(color: string, heading: number, tracked = false): L.DivIcon {
  const size = tracked ? 40 : 32;
  return L.divIcon({
    html: planeSvg(color, heading, tracked),
    className: 'plane-icon-div',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="map-root">

      <!-- Map container -->
      <div #mapContainer class="map-container"></div>

      <!-- Top bar -->
      <div class="top-bar">
        <button class="back-btn" (click)="back.emit()">
          ← Back
        </button>

        <div class="country-info">
          <span class="country-emoji">{{ country.emoji }}</span>
          <span class="country-name">{{ state.name }}</span>
          <span class="breadcrumb">· {{ country.name }}</span>
        </div>

        <div class="flight-badge" [class.has-flights]="flightCount() > 0" [class.tracking]="trackedCallsign">
          @if (loading()) {
            <span class="dot-pulse"></span>
            <span>Searching…</span>
          } @else if (trackedCallsign) {
            <span class="plane-icon-sm">✈</span>
            <span>{{ flightCount() > 0 ? 'Tracking ' + trackedCallsign : trackedCallsign + ' not in range' }}</span>
          } @else {
            <span class="plane-icon-sm">✈</span>
            <span>{{ flightCount() }} flights</span>
          }
        </div>
      </div>

      <!-- Refresh countdown bar -->
      <div class="refresh-bar">
        <div class="refresh-fill" [style.width.%]="refreshPct()"></div>
      </div>

      <!-- Selected flight popup -->
      @if (popup()) {
        <div class="flight-popup animate-in">
          <div class="popup-header">
            <span class="popup-callsign">{{ popup()!.callsign?.trim() || popup()!.icao24.toUpperCase() }}</span>
            <button class="popup-close" (click)="popup.set(null)">✕</button>
          </div>
          <div class="popup-grid">
            <div class="popup-field">
              <span class="field-label">Country</span>
              <span class="field-val">{{ popup()!.country }}</span>
            </div>
            <div class="popup-field">
              <span class="field-label">Altitude</span>
              <span class="field-val sky">{{ popup()!.altitude !== null ? (popup()!.altitude! | number:'1.0-0') + ' m' : '—' }}</span>
            </div>
            <div class="popup-field">
              <span class="field-label">Speed</span>
              <span class="field-val green">{{ popup()!.speed !== null ? (popup()!.speed! * 1.944 | number:'1.0-0') + ' kts' : '—' }}</span>
            </div>
            <div class="popup-field">
              <span class="field-label">Heading</span>
              <span class="field-val">{{ popup()!.heading !== null ? (popup()!.heading! | number:'1.0-0') + '°' : '—' }}</span>
            </div>
          </div>
        </div>
      }

      <!-- No flights notice -->
      @if (!loading() && flightCount() === 0) {
        <div class="no-flights">
          @if (trackedCallsign) {
            <span>{{ trackedCallsign }} is not currently visible.</span>
            <span class="hint">It may be on the ground or outside ADS-B coverage. Retrying every 30s.</span>
          } @else {
            <span>No airborne flights found over {{ state.name }} right now.</span>
            <span class="hint">Data refreshes every 30 seconds.</span>
          }
        </div>
      }

      <!-- Last updated -->
      @if (lastUpdated()) {
        <div class="last-updated">
          Updated {{ lastUpdated()! | date:'HH:mm:ss' }}
        </div>
      }

    </div>
  `,
  styles: [`
    .map-root { position: fixed; inset: 0; background: #0c1a2e; font-family: 'Inter', sans-serif; }
    .map-container { position: absolute; inset: 0; }

    /* Pulsing ring animation for tracked flight (injected into Leaflet divIcon DOM) */
    :global(.plane-icon-div) { overflow: visible !important; }
    @keyframes pulse-ring {
      0%   { transform: scale(0.6); opacity: 0.9; }
      100% { transform: scale(2);   opacity: 0; }
    }

    /* Top bar */
    .top-bar {
      position: absolute; top: 0; left: 0; right: 0; z-index: 1000;
      display: flex; align-items: center; gap: 12px;
      padding: 10px 14px;
      background: rgba(5,13,26,0.88);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(56,189,248,0.15);
    }
    .back-btn {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      color: #94a3b8; border-radius: 8px; padding: 7px 14px;
      cursor: pointer; font-size: 13px; font-weight: 500;
      transition: all 0.2s; white-space: nowrap;
    }
    .back-btn:hover { background: rgba(255,255,255,0.12); color: #e2e8f0; }

    .country-info {
      display: flex; align-items: center; gap: 8px; flex: 1;
    }
    .country-emoji { font-size: 24px; }
    .country-name { font-size: 17px; font-weight: 600; color: #e2e8f0; }
    .breadcrumb { font-size: 13px; color: #475569; }

    .flight-badge {
      display: flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 999px; padding: 5px 14px;
      font-size: 13px; color: #64748b; white-space: nowrap;
      transition: border-color 0.3s;
    }
    .flight-badge.has-flights { border-color: rgba(56,189,248,0.4); color: #94a3b8; }
    .flight-badge.tracking { border-color: rgba(245,158,11,0.5); color: #f59e0b; }

    .plane-icon-sm { font-size: 14px; }

    .dot-pulse {
      width: 8px; height: 8px; border-radius: 50%;
      background: #38bdf8;
      animation: pulse-dot 1s ease-in-out infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.7); }
    }

    /* Refresh bar */
    .refresh-bar {
      position: absolute; top: 48px; left: 0; right: 0; height: 2px;
      background: rgba(255,255,255,0.04); z-index: 999;
    }
    .refresh-fill {
      height: 100%; background: linear-gradient(to right, #38bdf8, #818cf8);
      transition: width 1s linear;
    }

    /* Flight popup */
    .flight-popup {
      position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: 1000;
      background: rgba(5,13,26,0.95); border: 1px solid rgba(56,189,248,0.3);
      border-radius: 14px; padding: 16px; min-width: 260px;
      backdrop-filter: blur(12px);
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }
    .animate-in { animation: pop-in 0.2s ease-out; }
    @keyframes pop-in {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .popup-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
    }
    .popup-callsign { font-size: 18px; font-weight: 700; color: #e2e8f0; font-family: 'JetBrains Mono', monospace; }
    .popup-close {
      background: none; border: none; color: #64748b; cursor: pointer;
      font-size: 16px; line-height: 1; transition: color 0.2s;
    }
    .popup-close:hover { color: #e2e8f0; }

    .popup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .popup-field { display: flex; flex-direction: column; gap: 2px; }
    .field-label { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .field-val { font-size: 14px; color: #94a3b8; font-family: 'JetBrains Mono', monospace; }
    .field-val.sky { color: #38bdf8; }
    .field-val.green { color: #34d399; }

    /* No flights */
    .no-flights {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      z-index: 999; background: rgba(5,13,26,0.9); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px; padding: 24px 32px; text-align: center;
      display: flex; flex-direction: column; gap: 8px;
      backdrop-filter: blur(10px);
    }
    .no-flights span { color: #94a3b8; font-size: 15px; }
    .no-flights .hint { color: #475569; font-size: 12px; }

    /* Last updated */
    .last-updated {
      position: absolute; bottom: 8px; right: 10px; z-index: 999;
      font-size: 11px; color: #334155; font-family: 'JetBrains Mono', monospace;
    }
  `],
})
export class MapViewComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) country!: Country;
  @Input({ required: true }) state!: StateRegion;
  /** When set, this callsign is highlighted with a pulsing amber ring and the map pans to follow it. */
  @Input() trackedCallsign: string | null = null;
  @Output() back = new EventEmitter<void>();

  @ViewChild('mapContainer') mapContainerRef!: ElementRef<HTMLDivElement>;

  private zone = inject(NgZone);
  private flightService = inject(FlightService);
  private http = inject(HttpClient);

  flightCount = signal(0);
  loading = signal(true);
  popup = signal<PopupFlight | null>(null);
  lastUpdated = signal<Date | null>(null);
  refreshPct = signal(100);

  private map!: L.Map;
  private tracked = new Map<string, TrackedFlight>();
  private rafId = 0;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private refreshStart = Date.now();
  private readonly POLL_MS = 30_000;

  // Track / route layers — cleared whenever a different plane is clicked
  private trackLayer: L.Polyline | null = null;
  private arcLayer: L.Polyline | null = null;
  private airportMarkers: L.Marker[] = [];

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.initMap());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.flightService.stopPolling();
    this.flightService.clear();
    this.clearTrackLayers();
    this.map?.remove();
  }

  // ─── Map init ─────────────────────────────────────────────────────────────

  private initMap(): void {
    const { bbox, center } = this.state;

    this.map = L.map(this.mapContainerRef.nativeElement, {
      center: [center[0], center[1]],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    // Free OSM tiles — no API key needed
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      subdomains: ['a', 'b', 'c'],
    }).addTo(this.map);

    // Dark overlay to match our theme
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c', 'd'],
    }).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Fit to country bbox
    this.map.fitBounds([
      [bbox.lamin, bbox.lomin],
      [bbox.lamax, bbox.lomax],
    ], { padding: [30, 30] });

    // Click map → close popup and clear track
    this.map.on('click', () => {
      this.zone.run(() => this.popup.set(null));
      this.clearTrackLayers();
    });

    // Start flight polling for the selected state's bbox
    this.flightService.startPolling(this.state.bbox, this.POLL_MS);

    // Watch for new flight data
    this.watchFlights();

    // Start animation loop
    this.startAnimLoop();

    // Start refresh progress bar
    this.startRefreshBar();
  }

  // ─── Watch flight data updates ────────────────────────────────────────────

  private watchFlights(): void {
    // Poll the signal every 500ms (outside Angular zone)
    const check = () => {
      const flights = this.flightService.flights();
      const loading = this.flightService.loading();
      const updated = this.flightService.lastUpdated();

      this.zone.run(() => {
        this.loading.set(loading);
        this.flightCount.set(flights.length);
        if (updated) this.lastUpdated.set(updated);
      });

      if (flights.length > 0) this.syncMarkers(flights);

      setTimeout(check, 500);
    };
    setTimeout(check, 200);
  }

  // ─── Sync Leaflet markers with flight data ────────────────────────────────

  private syncMarkers(rawFlights: Aircraft[]): void {
    const flights = this.trackedCallsign
      ? rawFlights.filter(f =>
          f.callsign?.trim().toUpperCase() === this.trackedCallsign!.toUpperCase() ||
          f.icao24.toUpperCase() === this.trackedCallsign!.toUpperCase()
        )
      : rawFlights;

    const incomingIds = new Set(flights.map(f => f.icao24));

    // Remove markers for departed flights
    for (const [id, tf] of this.tracked) {
      if (!incomingIds.has(id)) {
        tf.marker.remove();
        this.tracked.delete(id);
      }
    }

    for (const flight of flights) {
      if (flight.latitude === null || flight.longitude === null) continue;

      const existing = this.tracked.get(flight.icao24);
      const color = altitudeColor(flight.baroAltitude);
      const heading = flight.trueTrack ?? 0;
      const isTracked = !!this.trackedCallsign &&
        (flight.callsign?.trim().toUpperCase() === this.trackedCallsign.toUpperCase() ||
         flight.icao24.toUpperCase() === this.trackedCallsign.toUpperCase());

      if (existing) {
        // Only restart the animation when the server gives us a genuinely new position.
        // Resetting animStart on every 500ms watchFlights tick was the bug —
        // it kept t near 0 so the marker never reached its target.
        const posChanged =
          existing.targetLat !== flight.latitude ||
          existing.targetLon !== flight.longitude;

        if (posChanged) {
          const now = Date.now();
          const t = Math.min((now - existing.animStart) / ANIM_DURATION, 1);
          existing.prevLat = lerp(existing.prevLat, existing.targetLat, t);
          existing.prevLon = lerp(existing.prevLon, existing.targetLon, t);
          existing.targetLat = flight.latitude;
          existing.targetLon = flight.longitude;
          existing.animStart = now;
          if (isTracked) this.map.panTo([flight.latitude, flight.longitude], { animate: true, duration: 1 });
        }
        existing.heading = heading;
        existing.marker.setIcon(makePlaneIcon(color, heading, isTracked));
      } else {
        // Create new marker
        const marker = L.marker([flight.latitude, flight.longitude], {
          icon: makePlaneIcon(color, heading, isTracked),
          zIndexOffset: isTracked ? 1000 : 100,
        }).addTo(this.map);
        if (isTracked) this.map.panTo([flight.latitude, flight.longitude], { animate: true, duration: 1 });

        marker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          this.zone.run(() => {
            this.popup.set({
              icao24: flight.icao24,
              callsign: flight.callsign,
              country: flight.originCountry,
              altitude: flight.baroAltitude,
              speed: flight.velocity,
              heading: flight.trueTrack,
              lat: flight.latitude!,
              lon: flight.longitude!,
            });
          });
          this.loadTrack(flight.icao24);
        });

        this.tracked.set(flight.icao24, {
          icao24: flight.icao24,
          marker,
          prevLat: flight.latitude,
          prevLon: flight.longitude,
          targetLat: flight.latitude,
          targetLon: flight.longitude,
          heading,
          animStart: Date.now(),
        });
      }
    }
  }

  // ─── RAF animation loop — smooth marker interpolation ────────────────────

  private startAnimLoop(): void {
    const tick = () => {
      const now = Date.now();
      for (const tf of this.tracked.values()) {
        const t = Math.min((now - tf.animStart) / ANIM_DURATION, 1);
        const lat = lerp(tf.prevLat, tf.targetLat, t);
        const lon = lerp(tf.prevLon, tf.targetLon, t);
        tf.marker.setLatLng([lat, lon]);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  // ─── Flight track / route ─────────────────────────────────────────────────

  private clearTrackLayers(): void {
    this.trackLayer?.remove(); this.trackLayer = null;
    this.arcLayer?.remove();   this.arcLayer = null;
    this.airportMarkers.forEach(m => m.remove());
    this.airportMarkers = [];
  }

  private async loadTrack(icao24: string): Promise<void> {
    this.clearTrackLayers();
    try {
      const result = await firstValueFrom(
        this.http.get<TrackResult>(`${environment.apiUrl}/api/track/${icao24}`)
      );

      // 1. Flown path — thin dashed white line
      if (result.path.length > 1) {
        this.trackLayer = L.polyline(result.path, {
          color: '#ffffff',
          weight: 1.5,
          opacity: 0.45,
          dashArray: '4 6',
        }).addTo(this.map);
      }

      // 2. Great-circle arc from departure to arrival — solid cyan line
      if (result.departure && result.arrival) {
        const arcPoints = this.greatCirclePoints(
          result.departure.lat, result.departure.lon,
          result.arrival.lat,  result.arrival.lon,
          80
        );
        this.arcLayer = L.polyline(arcPoints, {
          color: '#38bdf8',
          weight: 2,
          opacity: 0.7,
          dashArray: '8 5',
        }).addTo(this.map);
      }

      // 3. Airport pins
      const pinIcon = (label: string, color: string) => L.divIcon({
        html: `<div style="
          background:${color}; color:#fff; font-size:10px; font-weight:700;
          padding:3px 7px; border-radius:6px; white-space:nowrap;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
          border:1px solid rgba(255,255,255,0.2);">
          ${label}
        </div>`,
        className: '',
        iconAnchor: [0, 10],
      });

      if (result.departure) {
        const { lat, lon, icao, city } = result.departure;
        const m = L.marker([lat, lon], { icon: pinIcon(`✈ ${icao}`, '#10b981'), zIndexOffset: 500 })
          .bindTooltip(`Departure: ${city} (${icao})`, { direction: 'top' })
          .addTo(this.map);
        this.airportMarkers.push(m);
      }
      if (result.arrival) {
        const { lat, lon, icao, city, estimated } = result.arrival;
        const label = estimated ? `~ ${icao}` : `⬇ ${icao}`;
        const color = estimated ? '#8b5cf6' : '#f59e0b';
        const tooltip = estimated
          ? `Est. destination: ${city} (${icao}) — based on heading`
          : `Arrival: ${city} (${icao})`;
        const m = L.marker([lat, lon], { icon: pinIcon(label, color), zIndexOffset: 500 })
          .bindTooltip(tooltip, { direction: 'top' })
          .addTo(this.map);
        this.airportMarkers.push(m);
      }
    } catch {
      // Track fetch failed silently — user still sees the popup
    }
  }

  /** Compute n intermediate points along the great-circle arc between two lat/lon pairs. */
  private greatCirclePoints(
    lat1: number, lon1: number, lat2: number, lon2: number, n = 80
  ): [number, number][] {
    const toRad = (d: number) => d * Math.PI / 180;
    const toDeg = (r: number) => r * 180 / Math.PI;
    const φ1 = toRad(lat1), λ1 = toRad(lon1);
    const φ2 = toRad(lat2), λ2 = toRad(lon2);

    const d = 2 * Math.asin(Math.sqrt(
      Math.sin((φ2 - φ1) / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
    ));

    if (d < 0.0001) return [[lat1, lon1], [lat2, lon2]];

    const points: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const a = Math.sin((1 - f) * d) / Math.sin(d);
      const b = Math.sin(f * d) / Math.sin(d);
      const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2);
      const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2);
      const z = a * Math.sin(φ1) + b * Math.sin(φ2);
      points.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
    }
    return points;
  }

  // ─── Refresh progress bar ─────────────────────────────────────────────────

  private startRefreshBar(): void {
    this.refreshStart = Date.now();
    this.refreshTimer = setInterval(() => {
      const elapsed = Date.now() - this.refreshStart;
      const pct = 100 - Math.min((elapsed / this.POLL_MS) * 100, 100);
      this.zone.run(() => this.refreshPct.set(pct));

      if (elapsed >= this.POLL_MS) {
        this.refreshStart = Date.now();
      }
    }, 500);
  }
}
