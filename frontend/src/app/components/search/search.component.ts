import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../services/app-state.service';
import { SelectedRegion } from '../../models/aircraft.model';

interface SearchResult {
  type: 'country' | 'city' | 'airport';
  name: string;
  subtitle: string;
  center: [number, number];
  zoom: number;
  bbox: { lamin: number; lamax: number; lomin: number; lomax: number };
}

const SEARCH_DATA: SearchResult[] = [
  { type: 'country', name: 'United States', subtitle: 'North America', center: [-98, 38], zoom: 3, bbox: { lamin: 24.4, lamax: 49.4, lomin: -125, lomax: -66.9 } },
  { type: 'country', name: 'United Kingdom', subtitle: 'Europe', center: [-2, 54], zoom: 5, bbox: { lamin: 49.9, lamax: 60.9, lomin: -8.6, lomax: 1.8 } },
  { type: 'country', name: 'France', subtitle: 'Europe', center: [2.3, 46.7], zoom: 5, bbox: { lamin: 41.3, lamax: 51.1, lomin: -5.1, lomax: 9.6 } },
  { type: 'country', name: 'Germany', subtitle: 'Europe', center: [10.5, 51.2], zoom: 5, bbox: { lamin: 47.3, lamax: 55.1, lomin: 5.9, lomax: 15 } },
  { type: 'country', name: 'India', subtitle: 'Asia', center: [78, 22], zoom: 4, bbox: { lamin: 8.4, lamax: 37.6, lomin: 68.7, lomax: 97.3 } },
  { type: 'country', name: 'China', subtitle: 'Asia', center: [104, 35], zoom: 3, bbox: { lamin: 18, lamax: 53.6, lomin: 73.7, lomax: 135.1 } },
  { type: 'country', name: 'Japan', subtitle: 'Asia', center: [138, 36], zoom: 5, bbox: { lamin: 24.3, lamax: 45.7, lomin: 123, lomax: 154 } },
  { type: 'country', name: 'Australia', subtitle: 'Oceania', center: [134, -25], zoom: 3, bbox: { lamin: -43.6, lamax: -10.7, lomin: 113.3, lomax: 153.6 } },
  { type: 'country', name: 'Brazil', subtitle: 'South America', center: [-52, -14], zoom: 3, bbox: { lamin: -33.8, lamax: 5.3, lomin: -74, lomax: -28.9 } },
  { type: 'country', name: 'Canada', subtitle: 'North America', center: [-96, 60], zoom: 3, bbox: { lamin: 41.7, lamax: 83.1, lomin: -141, lomax: -52.6 } },
  { type: 'country', name: 'Russia', subtitle: 'Europe/Asia', center: [100, 60], zoom: 2, bbox: { lamin: 41.2, lamax: 81.9, lomin: 19.6, lomax: 180 } },
  { type: 'country', name: 'South Africa', subtitle: 'Africa', center: [25, -29], zoom: 5, bbox: { lamin: -34.8, lamax: -22.1, lomin: 16.5, lomax: 32.9 } },
  { type: 'city', name: 'New York', subtitle: 'United States', center: [-74.006, 40.713], zoom: 9, bbox: { lamin: 40.4, lamax: 41.1, lomin: -74.3, lomax: -73.7 } },
  { type: 'city', name: 'London', subtitle: 'United Kingdom', center: [-0.128, 51.508], zoom: 9, bbox: { lamin: 51.3, lamax: 51.7, lomin: -0.5, lomax: 0.2 } },
  { type: 'city', name: 'Tokyo', subtitle: 'Japan', center: [139.69, 35.69], zoom: 9, bbox: { lamin: 35.5, lamax: 35.9, lomin: 139.5, lomax: 139.9 } },
  { type: 'city', name: 'Dubai', subtitle: 'UAE', center: [55.27, 25.2], zoom: 9, bbox: { lamin: 24.9, lamax: 25.4, lomin: 55, lomax: 55.5 } },
  { type: 'city', name: 'Mumbai', subtitle: 'India', center: [72.88, 19.08], zoom: 9, bbox: { lamin: 18.9, lamax: 19.3, lomin: 72.7, lomax: 73.1 } },
  { type: 'city', name: 'Sydney', subtitle: 'Australia', center: [151.21, -33.87], zoom: 9, bbox: { lamin: -34.1, lamax: -33.6, lomin: 150.9, lomax: 151.4 } },
  { type: 'airport', name: 'JFK – New York', subtitle: 'John F. Kennedy International', center: [-73.778, 40.641], zoom: 12, bbox: { lamin: 40.6, lamax: 40.7, lomin: -73.8, lomax: -73.7 } },
  { type: 'airport', name: 'LHR – London', subtitle: 'London Heathrow', center: [-0.461, 51.477], zoom: 12, bbox: { lamin: 51.45, lamax: 51.5, lomin: -0.5, lomax: -0.4 } },
  { type: 'airport', name: 'DXB – Dubai', subtitle: 'Dubai International', center: [55.365, 25.253], zoom: 12, bbox: { lamin: 25.2, lamax: 25.3, lomin: 55.3, lomax: 55.4 } },
  { type: 'airport', name: 'SIN – Singapore', subtitle: 'Singapore Changi', center: [103.99, 1.364], zoom: 12, bbox: { lamin: 1.3, lamax: 1.4, lomin: 103.9, lomax: 104.1 } },
];

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search-container">
      <!-- Search trigger button -->
      <button
        (click)="toggle()"
        class="glass rounded-lg px-3 py-2 flex items-center gap-2 hover:border-sky-400/50 transition-all text-sm text-slate-400 hover:text-white w-64"
        [class.active]="isOpen()">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <span class="flex-1 text-left truncate">{{ query() || 'Search countries, cities, airports...' }}</span>
        <kbd class="hidden sm:block text-xs bg-white/10 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>

      <!-- Dropdown panel -->
      @if (isOpen()) {
        <div class="search-panel glass rounded-xl border border-sky-400/20 animate-fade-in mt-2 overflow-hidden">
          <div class="p-3 border-b border-white/5">
            <input
              #searchInput
              type="text"
              [ngModel]="query()"
              (ngModelChange)="onQuery($event)"
              placeholder="Search countries, cities, airports..."
              class="w-full bg-transparent text-white placeholder-slate-500 text-sm outline-none"
              autofocus
            />
          </div>

          <div class="max-h-80 overflow-y-auto">
            @if (results().length === 0 && query().length > 0) {
              <div class="px-4 py-6 text-center text-slate-500 text-sm">No results found</div>
            }

            @for (group of groupedResults(); track group.type) {
              <div>
                <div class="px-3 py-1.5 text-xs text-slate-500 uppercase tracking-wider font-mono bg-white/5">
                  {{ group.type }}
                </div>
                @for (result of group.items; track result.name) {
                  <button
                    (click)="select(result)"
                    class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left group">
                    <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                                {{ result.type === 'country' ? 'bg-blue-500/20 text-blue-400' :
                                   result.type === 'city' ? 'bg-purple-500/20 text-purple-400' :
                                   'bg-amber-500/20 text-amber-400' }}">
                      <span class="text-sm">{{ typeIcon(result.type) }}</span>
                    </div>
                    <div>
                      <div class="text-sm text-white group-hover:text-sky-300 transition-colors font-medium">
                        {{ result.name }}
                      </div>
                      <div class="text-xs text-slate-500">{{ result.subtitle }}</div>
                    </div>
                  </button>
                }
              </div>
            }

            @if (!query()) {
              <div class="px-4 py-3 text-xs text-slate-500">
                <div class="mb-2 font-mono uppercase tracking-wider">Popular</div>
                @for (item of popular; track item.name) {
                  <button (click)="select(item)" class="mr-2 mb-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-colors">
                    {{ item.name }}
                  </button>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .search-container { position: relative; }
    .search-panel { width: 340px; }
    .active { border-color: rgba(56, 189, 248, 0.5) !important; color: white; }
  `]
})
export class SearchComponent {
  private state = inject(AppStateService);

  isOpen = signal(false);
  query = signal('');
  results = signal<SearchResult[]>([]);

  popular = SEARCH_DATA.filter(d => d.type === 'country').slice(0, 8);

  toggle(): void {
    this.isOpen.update(v => !v);
    if (!this.isOpen()) this.query.set('');
  }

  onQuery(q: string): void {
    this.query.set(q);
    if (!q.trim()) {
      this.results.set([]);
      return;
    }
    const lower = q.toLowerCase();
    this.results.set(
      SEARCH_DATA.filter(d => d.name.toLowerCase().includes(lower) || d.subtitle.toLowerCase().includes(lower))
    );
  }

  groupedResults(): { type: string; items: SearchResult[] }[] {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of this.results()) {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    }
    return Object.entries(groups).map(([type, items]) => ({ type, items }));
  }

  select(result: SearchResult): void {
    const region: SelectedRegion = {
      name: result.name,
      bbox: result.bbox,
      center: result.center,
      zoom: result.zoom,
    };
    if (result.type === 'country') {
      this.state.selectCountry(region);
    } else {
      if (!this.state.selectedCountry()) {
        this.state.selectCountry(region);
      }
      this.state.selectRegion(region);
    }
    this.isOpen.set(false);
    this.query.set('');
  }

  typeIcon(type: string): string {
    return type === 'country' ? '🌍' : type === 'city' ? '🏙️' : '✈️';
  }
}
