import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';
import { FlightService } from '../../services/flight.service';

const US_STATES: { name: string; center: [number, number]; bbox: [number, number, number, number] }[] = [
  { name: 'California', center: [-119.4, 36.7], bbox: [32.5, 42, -124.4, -114.1] },
  { name: 'Texas', center: [-99.9, 31.9], bbox: [25.8, 36.5, -106.6, -93.5] },
  { name: 'New York', center: [-74.2, 42.2], bbox: [40.5, 45.0, -79.8, -71.9] },
  { name: 'Florida', center: [-81.5, 27.7], bbox: [24.5, 31.0, -87.6, -80.0] },
  { name: 'Ohio', center: [-82.8, 40.4], bbox: [38.4, 41.9, -84.8, -80.5] },
  { name: 'Illinois', center: [-89.2, 40.6], bbox: [36.9, 42.5, -91.5, -87.0] },
  { name: 'Washington', center: [-120.7, 47.5], bbox: [45.5, 49.0, -124.7, -116.9] },
];

const INDIA_STATES: { name: string; center: [number, number]; bbox: [number, number, number, number] }[] = [
  { name: 'Maharashtra', center: [75.7, 19.7], bbox: [15.6, 22.0, 72.6, 80.9] },
  { name: 'Karnataka', center: [75.7, 14.5], bbox: [11.6, 18.4, 74.1, 78.6] },
  { name: 'Tamil Nadu', center: [78.7, 11.1], bbox: [8.1, 13.6, 76.3, 80.3] },
  { name: 'Gujarat', center: [71.6, 22.3], bbox: [20.1, 24.7, 68.2, 74.5] },
  { name: 'Rajasthan', center: [73.9, 27.0], bbox: [23.1, 30.2, 69.5, 78.3] },
  { name: 'Delhi', center: [77.1, 28.7], bbox: [28.4, 28.9, 76.8, 77.4] },
];

const REGION_MAP: Record<string, typeof US_STATES> = {
  'United States': US_STATES,
  'India': INDIA_STATES,
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sidebar glass fixed right-0 top-11 bottom-0 z-20 flex flex-col animate-slide-right"
           [class.hidden]="!state.sidebarOpen()">

      <!-- Header -->
      <div class="p-4 border-b border-white/5 flex items-start justify-between">
        <div>
          <div class="text-xs text-sky-400 font-mono uppercase tracking-widest mb-0.5">
            {{ state.viewMode() === 'region' ? 'REGION' : 'COUNTRY' }}
          </div>
          <h2 class="text-xl font-bold text-white">{{ regionName() }}</h2>
        </div>
        <button (click)="state.goBack()"
                class="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white text-xs mt-0.5">
          ←
        </button>
      </div>

      <!-- Stats cards -->
      <div class="p-4 grid grid-cols-2 gap-2">
        <div class="glass-light rounded-lg p-3">
          <div class="text-xs text-slate-500 mb-1">Active Flights</div>
          <div class="text-2xl font-bold text-sky-400 font-mono">
            {{ aircraftInRegion().length }}
          </div>
        </div>
        <div class="glass-light rounded-lg p-3">
          <div class="text-xs text-slate-500 mb-1">Airports</div>
          <div class="text-2xl font-bold text-amber-400 font-mono">
            {{ flights.airports().length }}
          </div>
        </div>
        <div class="glass-light rounded-lg p-3">
          <div class="text-xs text-slate-500 mb-1">Airborne</div>
          <div class="text-2xl font-bold text-emerald-400 font-mono">
            {{ airborneCount() }}
          </div>
        </div>
        <div class="glass-light rounded-lg p-3">
          <div class="text-xs text-slate-500 mb-1">On Ground</div>
          <div class="text-2xl font-bold text-slate-400 font-mono">
            {{ groundCount() }}
          </div>
        </div>
      </div>

      <!-- Sub-regions (states) -->
      @if (subRegions().length > 0) {
        <div class="px-4 pb-2">
          <div class="text-xs text-slate-500 font-mono uppercase tracking-widest mb-2">
            Regions / States
          </div>
          <div class="space-y-1">
            @for (region of subRegions(); track region.name) {
              <button
                (click)="selectSubRegion(region)"
                class="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/3 hover:bg-white/8 border border-transparent hover:border-sky-400/20 transition-all text-left group">
                <span class="text-sm text-slate-300 group-hover:text-white transition-colors">
                  {{ region.name }}
                </span>
                <svg class="w-4 h-4 text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            }
          </div>
        </div>
      }

      <!-- Top airlines in region -->
      @if (topCountries().length > 0) {
        <div class="px-4 pb-2 mt-2 border-t border-white/5 pt-4">
          <div class="text-xs text-slate-500 font-mono uppercase tracking-widest mb-2">
            Top Origin Countries
          </div>
          <div class="space-y-1.5">
            @for (item of topCountries(); track item.country; let i = $index) {
              <div class="flex items-center gap-2">
                <div class="text-xs text-slate-500 font-mono w-4 text-right">{{ i + 1 }}</div>
                <div class="flex-1 flex items-center gap-2">
                  <div class="h-1.5 rounded-full bg-sky-400/30"
                       [style.width.%]="(item.count / maxCount()) * 100"></div>
                  <span class="text-xs text-slate-300 truncate">{{ item.country }}</span>
                </div>
                <span class="text-xs text-slate-500 font-mono">{{ item.count }}</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Aircraft list -->
      <div class="flex-1 overflow-y-auto border-t border-white/5 mt-2">
        <div class="px-4 pt-3 pb-2 flex items-center justify-between sticky top-0 bg-sky-950/80 backdrop-blur-sm">
          <div class="text-xs text-slate-500 font-mono uppercase tracking-widest">Live Aircraft</div>
          <div class="text-xs text-sky-400 font-mono">{{ aircraftInRegion().length }}</div>
        </div>
        @for (aircraft of visibleAircraft(); track aircraft.icao24) {
          <button
            (click)="state.selectAircraft(aircraft)"
            class="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors text-left border-b border-white/3 group">
            <div class="w-6 h-6 rounded flex items-center justify-center flex-shrink-0
                        {{ aircraft.onGround ? 'bg-slate-700' : 'bg-sky-500/20' }}">
              <span class="text-xs">{{ aircraft.onGround ? '🅿️' : '✈' }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-mono text-white truncate">
                {{ aircraft.callsign || aircraft.icao24.toUpperCase() }}
              </div>
              <div class="text-xs text-slate-500 truncate">{{ aircraft.originCountry }}</div>
            </div>
            <div class="text-right flex-shrink-0">
              <div class="text-xs font-mono text-sky-400">
                {{ aircraft.baroAltitude ? (aircraft.baroAltitude | number:'1.0-0') + 'm' : '–' }}
              </div>
              <div class="text-xs text-slate-500">
                {{ aircraft.velocity ? (aircraft.velocity | number:'1.0-0') + 'kn' : '–' }}
              </div>
            </div>
          </button>
        }
      </div>
    </aside>
  `,
  styles: [`
    .sidebar { width: 300px; }
  `]
})
export class SidebarComponent {
  state = inject(AppStateService);
  flights = inject(FlightService);

  regionName = computed(() => {
    return this.state.selectedRegion()?.name || this.state.selectedCountry()?.name || '';
  });

  aircraftInRegion = computed(() => {
    const region = this.state.selectedRegion() || this.state.selectedCountry();
    if (!region) return [];
    const bbox = region.bbox;
    return this.flights.worldAircraft().filter(
      a => a.latitude !== null && a.longitude !== null &&
           a.latitude! >= bbox.lamin && a.latitude! <= bbox.lamax &&
           a.longitude! >= bbox.lomin && a.longitude! <= bbox.lomax
    );
  });

  airborneCount = computed(() => this.aircraftInRegion().filter(a => !a.onGround).length);
  groundCount = computed(() => this.aircraftInRegion().filter(a => a.onGround).length);
  visibleAircraft = computed(() => this.aircraftInRegion().slice(0, 50));

  topCountries = computed(() => {
    const counts: Record<string, number> = {};
    for (const a of this.aircraftInRegion()) {
      const c = a.originCountry || 'Unknown';
      counts[c] = (counts[c] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  });

  maxCount = computed(() => Math.max(1, ...this.topCountries().map(c => c.count)));

  subRegions = computed(() => {
    const country = this.state.selectedCountry();
    if (!country || this.state.viewMode() === 'region') return [];
    return REGION_MAP[country.name] || [];
  });

  selectSubRegion(region: (typeof US_STATES)[0]): void {
    this.state.selectRegion({
      name: region.name,
      bbox: { lamin: region.bbox[0], lamax: region.bbox[1], lomin: region.bbox[2], lomax: region.bbox[3] },
      center: region.center,
      zoom: 7,
    });
  }
}
