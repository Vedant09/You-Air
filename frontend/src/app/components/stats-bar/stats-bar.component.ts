import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';
import { FlightService } from '../../services/flight.service';

@Component({
  selector: 'app-stats-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stats-bar glass fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2 border-b border-sky-900/50">
      <!-- Logo -->
      <div class="flex items-center gap-3">
        <button (click)="state.goToGlobe()"
                class="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div class="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center">
            <span class="text-sm">✈</span>
          </div>
          <span class="font-semibold text-white text-sm tracking-wide hidden sm:block">AIRSPACE EXPLORER</span>
        </button>

        <!-- Breadcrumb -->
        @if (state.selectedCountry(); as country) {
          <div class="flex items-center gap-1 text-xs text-sky-400/70">
            <span class="text-sky-600">/</span>
            <button (click)="state.goBack()" class="hover:text-sky-300 transition-colors">
              {{ country.name }}
            </button>
            @if (state.selectedRegion(); as region) {
              <span class="text-sky-600">/</span>
              <span class="text-sky-300">{{ region.name }}</span>
            }
          </div>
        }
      </div>

      <!-- Live Stats -->
      <div class="flex items-center gap-4">
        @if (flights.isLoadingWorld()) {
          <div class="spinner w-4 h-4"></div>
        } @else {
          <div class="flex items-center gap-1.5">
            <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot"></div>
            <span class="text-mono text-xs text-white font-medium">
              {{ (flights.worldAircraft().length | number) }} aircraft
            </span>
          </div>
        }

        @if (flights.stats(); as stats) {
          <div class="hidden md:flex items-center gap-3 text-xs text-slate-400">
            <span class="text-emerald-400 font-mono">{{ stats.airborne | number }} airborne</span>
            <span class="text-slate-600">|</span>
            <span>Updated {{ lastUpdated() }}</span>
          </div>
        }

        <!-- View mode badge -->
        <div class="glass-light rounded px-2 py-0.5 text-xs text-sky-400 font-mono hidden sm:block">
          {{ viewLabel() }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stats-bar { height: 44px; }
  `]
})
export class StatsBarComponent {
  state = inject(AppStateService);
  flights = inject(FlightService);

  lastUpdated(): string {
    const d = this.flights.lastUpdated();
    if (!d) return '–';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  viewLabel(): string {
    switch (this.state.viewMode()) {
      case 'globe': return 'GLOBAL';
      case 'country': return 'COUNTRY';
      case 'region': return 'REGION';
    }
  }
}
