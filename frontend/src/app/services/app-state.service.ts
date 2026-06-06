import { Injectable, signal } from '@angular/core';
import { Aircraft, FlightStats, LayerConfig, SelectedRegion, ViewMode } from '../models/aircraft.model';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  readonly viewMode = signal<ViewMode>('globe');
  readonly selectedCountry = signal<SelectedRegion | null>(null);
  readonly selectedRegion = signal<SelectedRegion | null>(null);
  readonly selectedAircraft = signal<Aircraft | null>(null);
  readonly sidebarOpen = signal(false);
  readonly stats = signal<FlightStats | null>(null);

  readonly layers = signal<LayerConfig>({
    aircraft: true,
    airports: true,
    flightPaths: false,
    density: false,
  });

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  selectCountry(region: SelectedRegion): void {
    this.selectedCountry.set(region);
    this.selectedRegion.set(null);
    this.viewMode.set('country');
    this.sidebarOpen.set(true);
  }

  selectRegion(region: SelectedRegion): void {
    this.selectedRegion.set(region);
    this.viewMode.set('region');
    this.sidebarOpen.set(true);
  }

  selectAircraft(aircraft: Aircraft | null): void {
    this.selectedAircraft.set(aircraft);
  }

  goBack(): void {
    if (this.viewMode() === 'region') {
      this.selectedRegion.set(null);
      this.viewMode.set('country');
    } else if (this.viewMode() === 'country') {
      this.selectedCountry.set(null);
      this.selectedAircraft.set(null);
      this.viewMode.set('globe');
      this.sidebarOpen.set(false);
    }
  }

  goToGlobe(): void {
    this.selectedCountry.set(null);
    this.selectedRegion.set(null);
    this.selectedAircraft.set(null);
    this.viewMode.set('globe');
    this.sidebarOpen.set(false);
  }

  toggleLayer(layer: keyof LayerConfig): void {
    this.layers.update(l => ({ ...l, [layer]: !l[layer] }));
  }

  updateStats(stats: FlightStats): void {
    this.stats.set(stats);
  }
}
