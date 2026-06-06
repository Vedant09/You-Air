import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'app-aircraft-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state.selectedAircraft(); as a) {
      <div class="aircraft-card glass rounded-xl border border-sky-400/20 animate-fade-in overflow-hidden">
        <!-- Header -->
        <div class="px-4 pt-4 pb-3 border-b border-white/5 flex items-start justify-between bg-sky-500/5">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <div class="w-2 h-2 rounded-full {{ a.onGround ? 'bg-slate-400' : 'bg-emerald-400 animate-pulse-dot' }}"></div>
              <span class="text-xs font-mono text-slate-400">{{ a.onGround ? '🅿️ ON GROUND' : '✈️ AIRBORNE' }}</span>
            </div>
            <h3 class="text-lg font-bold font-mono text-white">
              {{ a.callsign || a.icao24.toUpperCase() }}
            </h3>
            <div class="text-xs text-slate-400">ICAO: {{ a.icao24.toUpperCase() }}</div>
          </div>
          <button
            (click)="state.selectAircraft(null)"
            class="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-400 hover:text-white transition-colors text-sm mt-0.5">
            ✕
          </button>
        </div>

        <!-- Data grid -->
        <div class="p-4 grid grid-cols-2 gap-3">
          <div class="data-item">
            <div class="label">Altitude</div>
            <div class="value text-sky-400">{{ altitude(a) }}</div>
          </div>
          <div class="data-item">
            <div class="label">Speed</div>
            <div class="value text-emerald-400">{{ speed(a) }}</div>
          </div>
          <div class="data-item">
            <div class="label">Heading</div>
            <div class="value">
              <span class="inline-flex items-center gap-1">
                <span class="text-purple-400 font-mono">{{ a.trueTrack !== null ? (a.trueTrack | number:'1.0-0') + '°' : '–' }}</span>
                @if (a.trueTrack !== null) {
                  <span class="text-slate-500 text-xs">{{ headingLabel(a.trueTrack) }}</span>
                }
              </span>
            </div>
          </div>
          <div class="data-item">
            <div class="label">Vert. Rate</div>
            <div class="value {{ vertColor(a.verticalRate) }}">{{ vertRate(a) }}</div>
          </div>
          <div class="data-item">
            <div class="label">Origin</div>
            <div class="value text-slate-300">{{ a.originCountry || '–' }}</div>
          </div>
          <div class="data-item">
            <div class="label">Squawk</div>
            <div class="value font-mono text-amber-400">{{ a.squawk || '–' }}</div>
          </div>
          <div class="data-item col-span-2">
            <div class="label">Position</div>
            <div class="value font-mono text-slate-300 text-xs">
              {{ a.latitude !== null ? (a.latitude | number:'1.4-4') : '–' }},
              {{ a.longitude !== null ? (a.longitude | number:'1.4-4') : '–' }}
            </div>
          </div>
        </div>

        <!-- Heading compass -->
        @if (a.trueTrack !== null) {
          <div class="px-4 pb-4 flex items-center gap-3">
            <div class="compass w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center relative flex-shrink-0">
              <div class="compass-needle absolute w-0.5 h-5 bg-sky-400 rounded"
                   [style.transform]="'rotate(' + a.trueTrack + 'deg) translateY(-40%)'">
              </div>
              <div class="w-1.5 h-1.5 rounded-full bg-white/20"></div>
            </div>
            <div class="text-xs text-slate-500 leading-relaxed">
              Flying {{ headingLabel(a.trueTrack) }} at
              {{ a.trueTrack | number:'1.0-0' }}° true track
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .aircraft-card { width: 260px; }
    .data-item .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; font-family: 'JetBrains Mono', monospace; }
    .data-item .value { font-size: 13px; font-weight: 600; color: #e2e8f0; }
    .compass-needle { transform-origin: center bottom; }
  `]
})
export class AircraftCardComponent {
  state = inject(AppStateService);

  altitude(a: { baroAltitude: number | null; geoAltitude: number | null }): string {
    const alt = a.baroAltitude ?? a.geoAltitude;
    if (alt === null) return '–';
    const ft = Math.round(alt * 3.28084);
    return `${(alt | 0).toLocaleString()}m / ${ft.toLocaleString()}ft`;
  }

  speed(a: { velocity: number | null }): string {
    if (a.velocity === null) return '–';
    const kts = Math.round(a.velocity * 1.944);
    return `${kts} kts`;
  }

  vertRate(a: { verticalRate: number | null }): string {
    if (a.verticalRate === null) return '–';
    const fpm = Math.round(a.verticalRate * 196.85);
    const arrow = a.verticalRate > 0 ? '↑' : a.verticalRate < 0 ? '↓' : '→';
    return `${arrow} ${Math.abs(fpm)} fpm`;
  }

  vertColor(rate: number | null): string {
    if (rate === null) return '';
    if (rate > 1) return 'text-emerald-400';
    if (rate < -1) return 'text-red-400';
    return 'text-slate-400';
  }

  headingLabel(heading: number): string {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(heading / 45) % 8];
  }
}
