import { Component, OnInit, inject, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewerComponent } from './components/viewer/viewer.component';
import { StatsBarComponent } from './components/stats-bar/stats-bar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { AircraftCardComponent } from './components/aircraft-card/aircraft-card.component';
import { SearchComponent } from './components/search/search.component';
import { LayerControlsComponent } from './components/layer-controls/layer-controls.component';
import { AppStateService } from './services/app-state.service';
import { FlightService } from './services/flight.service';
import { ConfigService } from './services/config.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ViewerComponent,
    StatsBarComponent,
    SidebarComponent,
    AircraftCardComponent,
    SearchComponent,
    LayerControlsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-screen h-screen overflow-hidden relative bg-sky-950">

      <!-- MapLibre + Deck.gl viewer (fills entire viewport) -->
      <app-viewer></app-viewer>

      <!-- Top navigation bar -->
      <app-stats-bar></app-stats-bar>

      <!-- Search + zoom shortcuts -->
      <div class="fixed top-14 left-4 z-30">
        <app-search></app-search>
      </div>

      <!-- Layer toggles (bottom-left) -->
      <div class="fixed bottom-6 left-4 z-30">
        <app-layer-controls></app-layer-controls>
      </div>

      <!-- Country / region sidebar (right) -->
      <app-sidebar></app-sidebar>

      <!-- Selected aircraft card (bottom-right, shifts left when sidebar open) -->
      @if (state.selectedAircraft()) {
        <div class="fixed bottom-6 z-40 animate-fade-in"
             [class]="state.sidebarOpen() ? 'right-80' : 'right-4'">
          <app-aircraft-card></app-aircraft-card>
        </div>
      }

      <!-- Full-screen loading splash -->
      @if (isLoading()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-sky-950">
          <div class="text-center">
            <div class="spinner w-12 h-12 mx-auto mb-4" style="border-width: 3px;"></div>
            <p class="text-sky-400 font-mono text-sm tracking-widest uppercase">Initializing</p>
            <p class="text-slate-500 text-xs mt-1">Connecting to Airspace Explorer...</p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .right-80 { right: 316px; }
  `]
})
export class AppComponent implements OnInit {
  state = inject(AppStateService);
  private flights = inject(FlightService);
  private config = inject(ConfigService);

  isLoading = signal(true);

  constructor() {
    // Start polling aircraft only when the user selects a country or region.
    // Stop and clear when they navigate back to the globe.
    effect(() => {
      const active = this.state.selectedRegion() ?? this.state.selectedCountry();
      if (active) {
        this.flights.startRegionPolling(active.bbox, 60_000);
      } else {
        this.flights.stopPolling();
        this.flights.clearAircraft();
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.config.load();
    await this.flights.loadStats();
    this.isLoading.set(false);
  }
}
