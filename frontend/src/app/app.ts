import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountryPickerComponent, FoundFlight } from './components/country-picker/country-picker.component';
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
        <app-country-picker
          (countrySelected)="onCountry($event)"
          (flightFound)="onFlightFound($event)"
        />
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
          [trackedCallsign]="trackedCallsign()"
          (back)="onBack()"
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
  trackedCallsign = signal<string | null>(null);

  onCountry(country: Country): void {
    this.selectedCountry.set(country);
    this.trackedCallsign.set(null);
    this.screen.set('state');
    this.geo.getAdm1(country.code).catch(() => {});
  }

  onState(state: StateRegion): void {
    this.selectedState.set(state);
    this.screen.set('flights');
  }

  onFlightFound(flight: FoundFlight): void {
    const PAD = 8; // degrees around the flight
    const fakeCountry: Country = {
      name: flight.originCountry,
      code: 'XX',
      emoji: '✈',
      center: [flight.latitude, flight.longitude],
      bbox: {
        lamin: flight.latitude - PAD, lamax: flight.latitude + PAD,
        lomin: flight.longitude - PAD, lomax: flight.longitude + PAD,
      },
    };
    const fakeState: StateRegion = {
      name: flight.callsign?.trim() || flight.icao24.toUpperCase(),
      bbox: {
        lamin: flight.latitude - PAD, lamax: flight.latitude + PAD,
        lomin: flight.longitude - PAD, lomax: flight.longitude + PAD,
      },
      center: [flight.latitude, flight.longitude],
    };

    this.selectedCountry.set(fakeCountry);
    this.selectedState.set(fakeState);
    this.trackedCallsign.set((flight.callsign?.trim() || flight.icao24).toUpperCase());
    this.screen.set('flights');
  }

  onBack(): void {
    this.trackedCallsign.set(null);
    // Go back to state picker if we have a real country, otherwise go home
    if (this.selectedCountry()?.code === 'XX') {
      this.selectedCountry.set(null);
      this.screen.set('country');
    } else {
      this.screen.set('state');
    }
  }
}
