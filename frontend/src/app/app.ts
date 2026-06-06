import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountryPickerComponent } from './components/country-picker/country-picker.component';
import { StatePickerComponent } from './components/state-picker/state-picker.component';
import { MapViewComponent } from './components/map-view/map-view.component';
import { Country } from './data/countries';
import { GeoService, StateRegion } from './services/geo.service';

type Screen = 'country' | 'state' | 'flights';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, CountryPickerComponent, StatePickerComponent, MapViewComponent],
  template: `
    @switch (screen()) {
      @case ('country') {
        <app-country-picker (countrySelected)="onCountry($event)" />
      }
      @case ('state') {
        <app-state-picker
          [country]="selectedCountry()!"
          (stateSelected)="onState($event)"
          (back)="screen.set('country')"
        />
      }
      @case ('flights') {
        <app-map-view
          [country]="selectedCountry()!"
          [state]="selectedState()!"
          (back)="screen.set('state')"
        />
      }
    }
  `,
})
export class AppComponent {
  private geo = inject(GeoService);

  screen = signal<Screen>('country');
  selectedCountry = signal<Country | null>(null);
  selectedState = signal<StateRegion | null>(null);

  onCountry(country: Country): void {
    this.selectedCountry.set(country);
    this.screen.set('state');
    // Kick off the GeoJSON fetch immediately — the state-picker will get it
    // from the in-memory cache when it mounts, eliminating the wait.
    this.geo.getAdm1(country.code).catch(() => { /* handled inside state-picker */ });
  }

  onState(state: StateRegion): void {
    this.selectedState.set(state);
    this.screen.set('flights');
  }
}
