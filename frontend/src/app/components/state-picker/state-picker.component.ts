import {
  Component, Input, Output, EventEmitter,
  AfterViewInit, OnDestroy, ElementRef, ViewChild,
  NgZone, inject, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { GeoService, StateRegion } from '../../services/geo.service';
import { Country } from '../../data/countries';

// ─── Colour palette — each state gets a unique colour ─────────────────────────

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#14b8a6',
  '#a855f7', '#eab308', '#6366f1', '#22d3ee', '#fb923c',
  '#4ade80', '#f472b6', '#38bdf8', '#a3e635', '#fbbf24',
];

function stateColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-state-picker',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="root">

      <div #mapEl class="map-el"></div>

      <!-- Top bar -->
      <div class="top-bar">
        <button class="back-btn" (click)="back.emit()">← Back</button>
        <div class="title">
          <span class="flag">{{ country.emoji }}</span>
          <span class="name">{{ country.name }}</span>
          @if (!loadError() && !loaded()) {
            <span class="badge loading">
              <span class="dot"></span> Loading regions…
            </span>
          }
          @if (loaded() && stateCount() > 0) {
            <span class="badge ready">{{ stateCount() }} regions · click to explore</span>
          }
        </div>
      </div>

      <!-- Loading overlay -->
      @if (!loaded() && !loadError()) {
        <div class="overlay">
          <div class="spinner"></div>
          <p class="overlay-text">{{ statusMsg() }}</p>
          <p class="overlay-hint">Preparing region map…</p>
        </div>
      }

      <!-- Error overlay -->
      @if (loadError()) {
        <div class="overlay">
          <div class="error-icon">⚠</div>
          <p class="overlay-text">Couldn't load regions for {{ country.name }}</p>
          <p class="overlay-hint">{{ loadError() }}</p>
          <button class="skip-btn" (click)="skipToFlights()">View flights for whole country →</button>
        </div>
      }

      <!-- Hover tooltip -->
      @if (hoveredState()) {
        <div class="hover-tip" [style.left.px]="tipX()" [style.top.px]="tipY()">
          <span class="tip-plane">✈</span>
          <span class="tip-name">{{ hoveredState() }}</span>
          <span class="tip-cta">Click to explore flights</span>
        </div>
      }

    </div>
  `,
  styles: [`
    .root { position: fixed; inset: 0; background: #050d1a; font-family: 'Inter', sans-serif; }
    .map-el { position: absolute; inset: 0; }

    /* Top bar */
    .top-bar {
      position: absolute; top: 0; left: 0; right: 0; z-index: 1000;
      display: flex; align-items: center; gap: 12px; padding: 10px 14px;
      background: rgba(5,13,26,0.88); backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(56,189,248,0.15);
    }
    .back-btn {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      color: #94a3b8; border-radius: 8px; padding: 7px 14px;
      cursor: pointer; font-size: 13px; font-weight: 500;
      transition: all 0.2s; white-space: nowrap;
    }
    .back-btn:hover { background: rgba(255,255,255,0.12); color: #e2e8f0; }

    .title { display: flex; align-items: center; gap: 10px; flex: 1; }
    .flag { font-size: 22px; }
    .name { font-size: 17px; font-weight: 600; color: #e2e8f0; }

    .badge {
      font-size: 12px; border-radius: 999px; padding: 3px 12px;
    }
    .badge.loading {
      display: flex; align-items: center; gap: 6px;
      background: rgba(56,189,248,0.1); color: #38bdf8;
      border: 1px solid rgba(56,189,248,0.25);
    }
    .badge.ready {
      background: rgba(16,185,129,0.1); color: #10b981;
      border: 1px solid rgba(16,185,129,0.3);
    }

    .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #38bdf8; animation: pulse 1s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }

    /* Overlays */
    .overlay {
      position: absolute; inset: 0; z-index: 900;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
      background: rgba(5,13,26,0.82); backdrop-filter: blur(4px);
    }
    .spinner {
      width: 40px; height: 40px; border-radius: 50%;
      border: 3px solid rgba(56,189,248,0.15);
      border-top-color: #38bdf8;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .overlay-text { color: #e2e8f0; font-size: 16px; font-weight: 600; margin: 0; }
    .overlay-hint { color: #475569; font-size: 13px; margin: 0; }

    .error-icon { font-size: 36px; }
    .skip-btn {
      margin-top: 8px;
      background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.4);
      color: #38bdf8; border-radius: 10px; padding: 10px 20px;
      cursor: pointer; font-size: 14px; font-weight: 500;
      transition: all 0.2s;
    }
    .skip-btn:hover { background: rgba(56,189,248,0.22); }

    /* Hover tooltip */
    .hover-tip {
      position: absolute; z-index: 800; pointer-events: none;
      background: rgba(5,13,26,0.93); border: 1px solid rgba(56,189,248,0.4);
      border-radius: 10px; padding: 8px 14px;
      display: flex; flex-direction: column; gap: 2px;
      backdrop-filter: blur(8px);
      transform: translate(16px, -50%);
      box-shadow: 0 8px 30px rgba(0,0,0,0.4);
      animation: tip-in 0.12s ease-out;
    }
    @keyframes tip-in { from{opacity:0;transform:translate(12px,-50%)} to{opacity:1;transform:translate(16px,-50%)} }
    .tip-plane { font-size: 18px; }
    .tip-name { font-size: 15px; font-weight: 600; color: #e2e8f0; }
    .tip-cta { font-size: 11px; color: #38bdf8; }
  `],
})
export class StatePickerComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) country!: Country;
  @Output() stateSelected = new EventEmitter<StateRegion>();
  @Output() back = new EventEmitter<void>();

  @ViewChild('mapEl') mapElRef!: ElementRef<HTMLDivElement>;

  private zone = inject(NgZone);
  private geo = inject(GeoService);

  loaded = signal(false);
  loadError = signal<string | null>(null);
  stateCount = signal(0);
  statusMsg = signal('Loading regions…');
  hoveredState = signal<string | null>(null);
  tipX = signal(0);
  tipY = signal(0);

  private map!: L.Map;
  private geoLayer: L.GeoJSON | null = null;

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.initMap());
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  // ─── Map init ──────────────────────────────────────────────────────────────

  private initMap(): void {
    const { bbox, center } = this.country;

    this.map = L.map(this.mapElRef.nativeElement, {
      center: [center[0], center[1]],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c', 'd'],
    }).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    this.map.fitBounds(
      [[bbox.lamin, bbox.lomin], [bbox.lamax, bbox.lomax]],
      { padding: [30, 30] }
    );

    this.loadStates();
  }

  // ─── Load GeoJSON + build layers ──────────────────────────────────────────

  private async loadStates(): Promise<void> {
    try {
      const geojson = await this.geo.getAdm1(this.country.code);

      this.zone.run(() => this.statusMsg.set('Drawing regions…'));

      let colorIndex = 0;

      this.geoLayer = L.geoJSON(geojson, {
        style: () => ({
          fillColor: stateColor(colorIndex++),
          fillOpacity: 0.55,
          color: '#0f172a',
          weight: 1.5,
          dashArray: '',
        }),
        onEachFeature: (feature, layer) => {
          const name = this.geo.stateName(feature);
          const baseColor = stateColor(
            (geojson.features.indexOf(feature) + PALETTE.length) % PALETTE.length
          );

          layer.on({
            mouseover: (e: L.LeafletMouseEvent) => {
              (layer as L.Path).setStyle({
                fillOpacity: 0.85,
                weight: 3,
                color: '#ffffff',
              });
              this.zone.run(() => {
                this.hoveredState.set(name);
                this.tipX.set(e.containerPoint.x);
                this.tipY.set(e.containerPoint.y);
              });
            },
            mousemove: (e: L.LeafletMouseEvent) => {
              this.zone.run(() => {
                this.tipX.set(e.containerPoint.x);
                this.tipY.set(e.containerPoint.y);
              });
            },
            mouseout: () => {
              (layer as L.Path).setStyle({
                fillOpacity: 0.55,
                weight: 1.5,
                color: '#0f172a',
              });
              this.zone.run(() => this.hoveredState.set(null));
            },
            click: () => {
              const bbox = this.geo.bboxFromFeature(feature);
              const cx = (bbox.lamin + bbox.lamax) / 2;
              const cy = (bbox.lomin + bbox.lomax) / 2;

              // Zoom the map into the selected state before emitting
              this.map.flyToBounds(
                [[bbox.lamin, bbox.lomin], [bbox.lamax, bbox.lomax]],
                { padding: [40, 40], duration: 0.8 }
              );

              setTimeout(() => {
                this.zone.run(() =>
                  this.stateSelected.emit({
                    name,
                    bbox,
                    center: [cx, cy],
                  })
                );
              }, 900);
            },
          });
        },
      }).addTo(this.map);

      this.zone.run(() => {
        this.loaded.set(true);
        this.stateCount.set(geojson.features.length);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.zone.run(() =>
        this.loadError.set(
          msg.includes('404') || msg.includes('No ISO3')
            ? 'No regional boundary data available for this country.'
            : 'Network error — check your connection.'
        )
      );
    }
  }

  // ─── Skip to whole-country flight view ────────────────────────────────────

  skipToFlights(): void {
    const b = this.country.bbox;
    const cx = (b.lamin + b.lamax) / 2;
    const cy = (b.lomin + b.lomax) / 2;
    this.stateSelected.emit({ name: this.country.name, bbox: b, center: [cx, cy] });
  }
}
