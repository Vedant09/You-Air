import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy,
  inject, effect, signal, computed, NgZone, ChangeDetectionStrategy, untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer, PathLayer, TextLayer } from '@deck.gl/layers';
import { AppStateService } from '../../services/app-state.service';
import { FlightService } from '../../services/flight.service';
import { GeocodingService } from '../../services/geocoding.service';
import { AircraftAnimatorService, AnimatedAircraft, buildProjectedPath } from '../../services/aircraft-animator.service';
import { Airport } from '../../models/aircraft.model';

// ─── Constants ───────────────────────────────────────────────────────────────

const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// ─── Colour helper ────────────────────────────────────────────────────────────

function altColor(a: AnimatedAircraft): [number, number, number, number] {
  if (a.onGround) return [100, 116, 139, 180];
  const t = Math.min((a.baroAltitude ?? 0) / 12_000, 1);
  if (t < 0.33) { const s = t / 0.33; return [Math.round(56 + s * -4), Math.round(189 + s * 22), Math.round(248 - s * 95), 235]; }
  if (t < 0.66) { const s = (t - 0.33) / 0.33; return [Math.round(52 + s * 199), Math.round(211 - s * 20), Math.round(153 - s * 117), 235]; }
  const s = (t - 0.66) / 0.34;
  return [Math.round(251 - s * 12), Math.round(191 - s * 123), Math.round(36 + s * 32), 235];
}

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="viewer-root absolute inset-0">
      <div #container class="absolute inset-0"></div>

      <!-- Hover tooltip -->
      @if (hoverInfo(); as info) {
        <div class="tooltip glass-light rounded-lg px-3 py-2 pointer-events-none animate-fade-in"
             [style.left.px]="info.x + 16" [style.top.px]="info.y - 14">
          <div class="font-mono text-sm text-white font-bold tracking-wide">
            {{ info.callsign?.trim() || info.icao24.toUpperCase() }}
          </div>
          <div class="text-xs text-slate-400 mt-0.5 flex gap-2 items-center">
            <span>{{ info.originCountry }}</span>
            @if (info.baroAltitude) {
              <span class="text-sky-400 font-mono">{{ (info.baroAltitude | number:'1.0-0') }}m</span>
            }
            @if (info.velocity) {
              <span class="text-emerald-400 font-mono">{{ (info.velocity! * 1.944 | number:'1.0-0') }}kts</span>
            }
          </div>
          <div class="text-xs text-sky-500 mt-1">Click to track →</div>
        </div>
      }

      <!-- Following banner -->
      @if (followingIcao()) {
        <div class="following-banner glass rounded-full flex items-center gap-3 px-4 py-2 animate-fade-in">
          <div class="w-2 h-2 rounded-full bg-amber-400 animate-pulse-dot"></div>
          <span class="text-xs font-mono text-white">TRACKING {{ followingCallsign() }}</span>
          <span class="text-xs text-sky-400 font-mono">
            @if (selectedAnimated(); as s) {
              {{ s.animPos[2] | number:'1.0-0' }}m · {{ ((s.velocity ?? 0) * 1.944) | number:'1.0-0' }}kts
            }
          </span>
          <button (click)="stopFollowing()"
                  class="ml-1 text-xs text-slate-400 hover:text-white transition-colors px-2 py-0.5 rounded bg-white/10 hover:bg-white/20">
            ✕ Stop
          </button>
        </div>
      }

      <!-- Aircraft count badge (always visible) -->
      <div class="aircraft-badge glass-light rounded-full px-3 py-1 pointer-events-none">
        <span class="text-xs font-mono"
              [class]="aircraftCount() > 0 ? 'text-emerald-400' : 'text-slate-500'">
          {{ aircraftCount() > 0 ? '✈ ' + aircraftCount() + ' aircraft' : '⏳ loading aircraft…' }}
        </span>
      </div>

      <!-- Debug: data-load counts (Angular-rendered, not deck.gl) -->
      <div class="fixed bottom-24 left-4 z-50 bg-slate-900/90 text-white text-xs font-mono px-2 py-1 rounded pointer-events-none">
        airports: {{ airportCount() }} | ac: {{ aircraftCount() }}
      </div>

      <!-- Globe hint -->
      @if (showHint()) {
        <div class="absolute bottom-16 left-1/2 -translate-x-1/2 glass-light rounded-full
                    px-4 py-2 text-xs text-slate-400 pointer-events-none animate-fade-in">
          Drag to rotate · Scroll to zoom · Click a country to explore
        </div>
      }
    </div>
  `,
  styles: [`
    .viewer-root { overflow: hidden; }
    .tooltip { position: absolute; z-index: 50; white-space: nowrap; }
    .following-banner {
      position: absolute; top: 56px; left: 50%; transform: translateX(-50%);
      z-index: 40;
    }
    .aircraft-badge {
      position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
      z-index: 40;
    }
  `]
})
export class ViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  private stateService = inject(AppStateService);
  private flights = inject(FlightService);
  private geocoding = inject(GeocodingService);
  private animator = inject(AircraftAnimatorService);
  private zone = inject(NgZone);

  hoverInfo = signal<(AnimatedAircraft & { x: number; y: number }) | null>(null);
  showHint = signal(true);
  selectedAnimated = signal<AnimatedAircraft | null>(null);
  followingIcao = signal<string | null>(null);
  followingCallsign = signal<string>('');
  aircraftCount = signal(0);
  airportCount = computed(() => this.flights.airports().length);

  private lastClickWasAircraft = false;

  private map!: maplibregl.Map;
  private deckOverlay!: MapboxOverlay;
  private animFrameId = 0;
  private geocodingBusy = false;
  private resizeObserver!: ResizeObserver;
  private userInteracting = false;

  // ─── Constructor: signal effects ─────────────────────────────────────────

  constructor() {
    effect(() => {
      const aircraft = this.flights.worldAircraft();
      if (aircraft.length) this.animator.ingestSnapshot(aircraft);
    });

    effect(() => {
      const region = this.stateService.selectedRegion() ?? this.stateService.selectedCountry();
      if (region && this.map) {
        // Stop following when the user navigates to a region
        this.zone.run(() => this.followingIcao.set(null));
        this.zone.runOutsideAngular(() =>
          this.map.flyTo({
            center: region.center,
            zoom: region.zoom,
            pitch: region.zoom > 7 ? 52 : 30,
            bearing: 0,
            duration: 2200,
            essential: true,
          })
        );
      }
    });

    effect(() => {
      if (this.stateService.selectedCountry()) this.zone.run(() => this.showHint.set(false));
    });

    effect(() => {
      const aircraft = this.stateService.selectedAircraft();
      if (!aircraft) {
        this.zone.run(() => {
          this.followingIcao.set(null);
          this.selectedAnimated.set(null);
        });
        return;
      }
      // If not already following this aircraft (e.g. selected from the sidebar),
      // fly to it and start tracking — same as a direct map click.
      if (this.map && untracked(() => this.followingIcao()) !== aircraft.icao24) {
        const animated = this.animator.getFrame().find(a => a.icao24 === aircraft.icao24);
        if (animated) this.trackOnly(animated);
      }
    });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.initMap());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animFrameId);
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  // ─── Stop following (public — called from template) ──────────────────────

  stopFollowing(): void {
    this.followingIcao.set(null);
    this.map?.easeTo({ pitch: 40, bearing: 0, duration: 1000 });
  }

  // ─── Map init ─────────────────────────────────────────────────────────────

  private initMap(): void {
    this.map = new maplibregl.Map({
      container: this.containerRef.nativeElement,
      style: CARTO_DARK,
      center: [10, 25],
      zoom: 1.8,
      pitch: 0,
      antialias: true,
    });

    this.map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    this.map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    this.map.on('load', () => {
      (this.map as unknown as { setProjection: (p: unknown) => void }).setProjection({ type: 'globe' });
      this.addAtmosphere();
      this.initDeckOverlay();
      this.startRenderLoop();
      this.flights.loadAirports();
    });

    this.map.on('click', e => this.handleMapClick(e));

    // Detect when user manually drags so we pause following
    this.map.on('mousedown', () => { this.userInteracting = true; });
    this.map.on('touchstart', () => { this.userInteracting = true; });
    this.map.on('dragend', () => { this.userInteracting = false; });
    this.map.on('touchend', () => { this.userInteracting = false; });

    this.resizeObserver = new ResizeObserver(() => this.map.resize());
    this.resizeObserver.observe(this.containerRef.nativeElement);
  }

  private addAtmosphere(): void {
    (this.map as any).setFog({
      color: '#0c1a2e', 'high-color': '#0f2342',
      'horizon-blend': 0.08, 'space-color': '#030810', 'star-intensity': 0.65,
    });
    (this.map as any).addLayer({
      id: 'sky', type: 'sky',
      paint: { 'sky-type': 'atmosphere', 'sky-atmosphere-sun': [0, 90], 'sky-atmosphere-sun-intensity': 12 },
    });
  }

  // ─── deck.gl overlay ─────────────────────────────────────────────────────

  private initDeckOverlay(): void {
    // interleaved: false → renders on its own canvas on top of MapLibre.
    // This avoids the globe-projection / Mercator matrix incompatibility.
    this.deckOverlay = new MapboxOverlay({ interleaved: false });
    this.map.addControl(this.deckOverlay as unknown as maplibregl.IControl);
  }

  // ─── 60fps render loop (outside Angular zone) ────────────────────────────

  private startRenderLoop(): void {
    let lastFollowUpdate = 0;

    const tick = (ts: number) => {
      const frame = this.animator.getFrame();
      const zoom = this.map.getZoom();
      const followId = this.followingIcao();
      const layers = this.stateService.layers();

      // ── Camera tracking (every 100ms to avoid jank) ─────────────────────
      if (followId && !this.userInteracting && ts - lastFollowUpdate > 100) {
        lastFollowUpdate = ts;
        const target = frame.find(a => a.icao24 === followId);
        if (target) {
          this.map.easeTo({
            center: [target.animPos[0], target.animPos[1]],
            duration: 120,
            easing: t => t,
          });
          // Update live telemetry in Angular zone (throttled to 100ms)
          this.zone.run(() => this.selectedAnimated.set(target));
        }
      }

      // ── Deck.gl layer update ─────────────────────────────────────────────
      try {
        const builtLayers = this.buildLayers(
          frame, zoom, followId,
          layers.aircraft, layers.airports, layers.flightPaths, layers.density
        );
        this.deckOverlay.setProps({ layers: builtLayers });
      } catch (e) {
        console.error('[Viewer] buildLayers error:', e);
      }

      // Update count badge every ~500ms (no need to hit Angular zone at 60fps)
      if (Math.round(ts) % 500 < 20) {
        const airborneCount = frame.filter(a => !a.onGround && a.longitude !== null).length;
        this.zone.run(() => this.aircraftCount.set(airborneCount));
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  // ─── Fly to and track an aircraft (map animation + local signals only) ──────

  private trackOnly(aircraft: AnimatedAircraft): void {
    const [lon, lat] = aircraft.animPos;
    const bearing = aircraft.trueTrack ?? 0;

    this.map.flyTo({
      center: [lon, lat],
      zoom: 12,
      pitch: 70,
      bearing,
      duration: 2500,
      essential: true,
    });

    this.zone.run(() => {
      this.followingIcao.set(aircraft.icao24);
      this.followingCallsign.set(aircraft.callsign?.trim() || aircraft.icao24.toUpperCase());
      this.selectedAnimated.set(aircraft);
      this.showHint.set(false);
    });
  }

  // Called on direct map click — also selects the aircraft in global state.
  private trackAircraft(aircraft: AnimatedAircraft): void {
    this.trackOnly(aircraft);
    this.zone.run(() => this.stateService.selectAircraft(aircraft));
  }

  // ─── Layer builder ────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildLayers(
    frame: AnimatedAircraft[],
    zoom: number,
    followId: string | null,
    showAircraft: boolean,
    showAirports: boolean,
    showFlightPaths: boolean,
    showDensity: boolean
  ): any[] {
    // Only include aircraft with valid coordinates
    const airborne = frame.filter(a => !a.onGround && a.longitude !== null && a.latitude !== null);
    const grounded = frame.filter(a => a.onGround && a.longitude !== null && a.latitude !== null);
    const show3d = zoom > 5;
    const close = zoom > 9;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any[] = [];

    // ── Aircraft icons (rotated SVG, GPU-instanced, all zoom levels) ─────────
    if (showAircraft) {
      // Icon size grows with zoom; selected aircraft is bigger
      const baseSize = close ? 28 : (show3d ? 20 : 14);

      // Selection glow ring behind the followed aircraft
      if (followId) {
        const sel = airborne.find(a => a.icao24 === followId);
        if (sel) {
          out.push(
            new ScatterplotLayer<AnimatedAircraft>({
              id: 'ac-selected-ring',
              data: [sel],
              getPosition: a => a.animPos,
              getColor: () => [255, 220, 0, 50],
              getRadius: baseSize + 12,
              radiusUnits: 'pixels',
              stroked: true,
              getLineColor: () => [255, 220, 0, 200],
              getLineWidth: 2,
              lineWidthUnits: 'pixels',
              pickable: false,
            })
          );
        }
      }

      // All airborne aircraft as coloured dots (altitude-based colour)
      out.push(
        new ScatterplotLayer<AnimatedAircraft>({
          id: 'ac-icons',
          data: airborne,
          getPosition: a => a.animPos,
          getRadius: a => a.icao24 === followId ? baseSize + 4 : Math.max(baseSize * 0.6, 5),
          radiusUnits: 'pixels',
          radiusMinPixels: 4,
          radiusMaxPixels: 28,
          getFillColor: a => a.icao24 === followId ? [255, 220, 0, 255] : altColor(a),
          stroked: true,
          getLineColor: () => [0, 0, 0, 100] as [number, number, number, number],
          getLineWidth: 1,
          lineWidthUnits: 'pixels',
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 220, 0, 120],
          onHover: (info: { object?: AnimatedAircraft; x: number; y: number }) => {
            this.zone.run(() =>
              this.hoverInfo.set(info.object ? { ...info.object, x: info.x, y: info.y } : null)
            );
          },
          onClick: (info: { object?: AnimatedAircraft }) => {
            if (info.object) {
              this.lastClickWasAircraft = true;
              this.trackAircraft(info.object);
            }
          },
        })
      );

      // Grounded aircraft as dim dots
      out.push(
        new ScatterplotLayer<AnimatedAircraft>({
          id: 'ac-ground',
          data: grounded,
          getPosition: a => a.animPos,
          getColor: () => [80, 96, 112, 130],
          getRadius: 4,
          radiusUnits: 'pixels',
          radiusMinPixels: 2,
          pickable: false,
        })
      );
    }

    // ── Callsign labels (close zoom) ──────────────────────────────────────
    if (showAircraft && close) {
      out.push(
        new TextLayer<AnimatedAircraft>({
          id: 'ac-labels',
          data: airborne.slice(0, 250),
          getPosition: a => a.animPos,
          getText: a => a.callsign?.trim() || a.icao24.toUpperCase(),
          getSize: 12,
          getPixelOffset: [0, -22],
          getColor: [210, 235, 255, 220],
          fontFamily: '"JetBrains Mono", monospace',
          fontWeight: 500,
          background: true,
          getBackgroundColor: [8, 20, 40, 180],
          getBorderColor: [56, 189, 248, 60],
          getBorderWidth: 1,
          backgroundPadding: [4, 2],
          pickable: false,
        })
      );
    }

    // ── Flight trails for non-followed aircraft (Flight Paths toggle) ────────
    if (showFlightPaths) {
      // The followed aircraft gets its own dedicated Apple-style arc below
      const withTrails = airborne.filter(a => a.trail.length > 1 && a.icao24 !== followId);
      out.push(
        new PathLayer<AnimatedAircraft>({
          id: 'ac-trails',
          data: withTrails,
          getPath: a => [...a.trail, a.animPos],
          getColor: a => ([...altColor(a).slice(0, 3), 90] as [number, number, number, number]),
          getWidth: 1.5,
          widthUnits: 'pixels',
          widthMinPixels: 1,
          pickable: false,
          jointRounded: true,
        })
      );
    }

    // ── Traffic density (large soft circles, always drawn regardless of zoom) ─
    if (showDensity) {
      out.push(
        new ScatterplotLayer<AnimatedAircraft>({
          id: 'ac-density',
          data: airborne,
          getPosition: a => a.animPos,
          getColor: () => [56, 189, 248, 18],
          getRadius: 80_000,          // 80 km soft blob per aircraft
          radiusUnits: 'meters',
          radiusMinPixels: 8,
          pickable: false,
          opacity: 0.6,
        })
      );
    }

    // ── Flight path for followed aircraft ────────────────────────────────────
    if (followId) {
      const sel = frame.find(a => a.icao24 === followId);
      if (sel && !sel.onGround && sel.velocity) {
        const history: [number, number, number][] = [...sel.trail, sel.animPos];
        const proj = buildProjectedPath(sel, 90);

        // Solid yellow trail — where the plane has been
        if (history.length > 1) {
          out.push(new PathLayer({
            id: 'ac-trail-done',
            data: [history],
            getPath: d => d,
            getColor: () => [255, 210, 40, 235],
            getWidth: 3,
            widthUnits: 'pixels',
            widthMinPixels: 2,
            pickable: false,
            jointRounded: true,
            capRounded: true,
          }));
        }

        // Solid red projected path — where the plane is heading
        if (proj.length > 1) {
          out.push(new PathLayer({
            id: 'ac-projected',
            data: [proj],
            getPath: d => d,
            getColor: () => [220, 38, 38, 210],
            getWidth: 3,
            widthUnits: 'pixels',
            widthMinPixels: 2,
            pickable: false,
            jointRounded: true,
            capRounded: true,
          }));
        }
      }
    }

    // ── Airport dots ─────────────────────────────────────────────────────
    if (showAirports) {
      const airports = this.flights.airports();
      if (airports.length) {
        out.push(
          new ScatterplotLayer<Airport>({
            id: 'airports',
            data: airports,
            getPosition: a => [a.longitude, a.latitude, 0],
            getColor: a => a.type === 'large_airport' ? [251, 191, 36, 220] : [107, 114, 128, 170],
            getRadius: a => (a.type === 'large_airport' ? 5 : 3),
            radiusUnits: 'pixels',
            radiusMinPixels: 2,
            pickable: true,
            onHover: (info: { object?: Airport; x: number; y: number }) => {
              this.zone.run(() => {
                if (info.object) {
                  this.hoverInfo.set({
                    icao24: info.object.icao, callsign: `${info.object.iata} — ${info.object.name}`,
                    originCountry: `${info.object.city}, ${info.object.country}`,
                    baroAltitude: info.object.altitude, onGround: true,
                    velocity: null, trueTrack: null, verticalRate: null,
                    timePosition: null, lastContact: 0,
                    longitude: info.object.longitude, latitude: info.object.latitude,
                    geoAltitude: null, squawk: null, spi: false, positionSource: 0,
                    animPos: [info.object.longitude, info.object.latitude, 0],
                    trail: [], x: info.x, y: info.y,
                  });
                } else {
                  this.hoverInfo.set(null);
                }
              });
            },
          })
        );
      }
    }

    return out;
  }

  // ─── Map click → geo navigation ──────────────────────────────────────────

  private async handleMapClick(e: maplibregl.MapMouseEvent): Promise<void> {
    // If deck.gl already handled this click (aircraft was picked), skip map-level logic
    if (this.lastClickWasAircraft) {
      this.lastClickWasAircraft = false;
      return;
    }
    if (this.geocodingBusy) return;
    if (this.followingIcao()) {
      this.zone.run(() => this.stopFollowing());
      return;
    }
    if (this.stateService.selectedAircraft()) {
      this.zone.run(() => this.stateService.selectAircraft(null));
      return;
    }

    const { lng, lat } = e.lngLat;
    const zoom = this.map.getZoom();
    const mode = this.stateService.viewMode();
    const hint = mode === 'globe' && zoom < 5 ? 'country' : 'state';

    this.geocodingBusy = true;
    try {
      const region = await this.geocoding.reverseGeocode(lat, lng, hint);
      if (!region) return;
      this.zone.run(() => {
        if (hint === 'country') this.stateService.selectCountry(region);
        else this.stateService.selectRegion(region);
      });
    } finally {
      this.geocodingBusy = false;
    }
  }
}
