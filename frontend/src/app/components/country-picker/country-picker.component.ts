import { Component, Output, EventEmitter, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { COUNTRIES, Country } from '../../data/countries';

@Component({
  selector: 'app-country-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker-root">

      <!-- Background gradient -->
      <div class="bg-gradient"></div>

      <!-- Animated plane trails -->
      <div class="trail trail-1"></div>
      <div class="trail trail-2"></div>
      <div class="trail trail-3"></div>

      <div class="content">

        <!-- Header -->
        <div class="header">
          <div class="logo">
            <span class="logo-plane">✈</span>
            <span class="logo-text">You'r-Air</span>
          </div>
          <p class="tagline">Real-time flight tracking · Pick a country to explore</p>
        </div>

        <!-- Big plane image area -->
        <div class="plane-showcase">
          <div class="plane-icon">✈</div>
          <div class="plane-glow"></div>
          <div class="stats-row">
            <div class="stat">
              <span class="stat-num">195</span>
              <span class="stat-label">Countries</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-num">Live</span>
              <span class="stat-label">Flight Data</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-num">30s</span>
              <span class="stat-label">Refresh</span>
            </div>
          </div>
        </div>

        <!-- Search + dropdown -->
        <div class="search-container">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search for a country…"
              [(ngModel)]="query"
              (ngModelChange)="onQueryChange($event)"
              class="search-input"
              autocomplete="off"
              spellcheck="false"
            />
            @if (query()) {
              <button class="clear-btn" (click)="clearQuery()">✕</button>
            }
          </div>

          @if (isOpen() && filtered().length > 0) {
            <div class="dropdown">
              @for (country of filtered(); track country.code) {
                <button class="dropdown-item" (click)="select(country)">
                  <span class="item-emoji">{{ country.emoji }}</span>
                  <span class="item-name">{{ country.name }}</span>
                  <span class="item-arrow">→</span>
                </button>
              }
              @if (filtered().length === COUNTRIES.length) {
                <div class="dropdown-hint">Type to filter · {{ COUNTRIES.length }} countries</div>
              }
            </div>
          }

          @if (isOpen() && filtered().length === 0) {
            <div class="dropdown">
              <div class="no-results">No countries found for "{{ query() }}"</div>
            </div>
          }

          <button class="explore-btn" (click)="toggleOpen()">
            {{ isOpen() ? 'Close' : '🌍 Choose a Country' }}
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .picker-root {
      position: fixed; inset: 0;
      background: #050d1a;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
      font-family: 'Inter', sans-serif;
    }

    .bg-gradient {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at 50% 30%, rgba(14,42,96,0.8) 0%, transparent 70%),
                  radial-gradient(ellipse at 80% 80%, rgba(0,60,120,0.4) 0%, transparent 50%);
      pointer-events: none;
    }

    /* Animated flight trails */
    .trail {
      position: absolute; height: 1px;
      background: linear-gradient(to right, transparent, rgba(56,189,248,0.5), transparent);
      animation: fly linear infinite;
      pointer-events: none;
    }
    .trail-1 { width: 40%; top: 20%; animation-duration: 8s; animation-delay: 0s; }
    .trail-2 { width: 30%; top: 55%; animation-duration: 12s; animation-delay: 3s; }
    .trail-3 { width: 50%; top: 75%; animation-duration: 10s; animation-delay: 6s; }
    @keyframes fly {
      from { transform: translateX(-120%); }
      to   { transform: translateX(250%); }
    }

    .content {
      position: relative; z-index: 10;
      display: flex; flex-direction: column; align-items: center; gap: 32px;
      width: 100%; max-width: 520px; padding: 24px;
      transform: translateY(-16vh);
    }

    /* Header */
    .header { text-align: center; }
    .logo {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      margin-bottom: 8px;
    }
    .logo-plane {
      font-size: 32px;
      filter: drop-shadow(0 0 12px rgba(56,189,248,0.8));
      animation: pulse 3s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1) rotate(-10deg); filter: drop-shadow(0 0 12px rgba(56,189,248,0.8)); }
      50% { transform: scale(1.08) rotate(-10deg); filter: drop-shadow(0 0 20px rgba(56,189,248,1)); }
    }
    .logo-text {
      font-size: 36px; font-weight: 700; letter-spacing: -1px;
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .tagline { color: #64748b; font-size: 14px; letter-spacing: 0.5px; }

    /* Plane showcase */
    .plane-showcase {
      position: relative; text-align: center;
      display: flex; flex-direction: column; align-items: center; gap: 24px;
    }
    .plane-icon {
      font-size: 96px; line-height: 1;
      filter: drop-shadow(0 0 30px rgba(56,189,248,0.6));
      transform: rotate(-10deg);
      animation: soar 6s ease-in-out infinite;
    }
    @keyframes soar {
      0%, 100% { transform: rotate(-10deg) translateY(0); }
      50% { transform: rotate(-10deg) translateY(-10px); }
    }
    .plane-glow {
      position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%);
      width: 160px; height: 60px;
      background: radial-gradient(ellipse, rgba(56,189,248,0.25) 0%, transparent 70%);
      border-radius: 50%; pointer-events: none;
      animation: glow-pulse 3s ease-in-out infinite;
    }
    @keyframes glow-pulse {
      0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
      50% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
    }

    /* Stats */
    .stats-row {
      display: flex; align-items: center; gap: 16px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 999px; padding: 10px 24px;
    }
    .stat { display: flex; flex-direction: column; align-items: center; }
    .stat-num { font-size: 18px; font-weight: 700; color: #38bdf8; font-family: 'JetBrains Mono', monospace; }
    .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-divider { width: 1px; height: 28px; background: rgba(255,255,255,0.08); }

    /* Search */
    .search-container { width: 100%; display: flex; flex-direction: column; gap: 12px; position: relative; }

    .search-box {
      display: flex; align-items: center; gap: 10px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(56,189,248,0.3);
      border-radius: 12px; padding: 14px 16px;
      transition: border-color 0.2s;
    }
    .search-box:focus-within { border-color: rgba(56,189,248,0.7); background: rgba(255,255,255,0.08); }

    .search-icon { font-size: 16px; flex-shrink: 0; }
    .search-input {
      flex: 1; background: none; border: none; outline: none;
      color: #e2e8f0; font-size: 16px;
    }
    .search-input::placeholder { color: #475569; }
    .clear-btn {
      background: none; border: none; color: #64748b; cursor: pointer;
      font-size: 14px; padding: 0; line-height: 1;
      transition: color 0.2s;
    }
    .clear-btn:hover { color: #e2e8f0; }

    .dropdown {
      position: absolute; top: calc(100% - 44px); left: 0; right: 0;
      margin-top: 60px;
      background: #0f1f38; border: 1px solid rgba(56,189,248,0.25);
      border-radius: 12px; overflow-y: auto; max-height: 260px;
      z-index: 100;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }

    .dropdown-item {
      width: 100%; display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; background: none; border: none;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      color: #e2e8f0; cursor: pointer; text-align: left;
      transition: background 0.15s;
    }
    .dropdown-item:last-child { border-bottom: none; }
    .dropdown-item:hover { background: rgba(56,189,248,0.12); }

    .item-emoji { font-size: 20px; width: 28px; text-align: center; }
    .item-name { flex: 1; font-size: 15px; }
    .item-arrow { color: #38bdf8; font-size: 14px; opacity: 0; transition: opacity 0.15s; }
    .dropdown-item:hover .item-arrow { opacity: 1; }

    .dropdown-hint, .no-results {
      padding: 12px 16px; font-size: 13px; color: #475569; text-align: center;
    }

    .explore-btn {
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      border: none; border-radius: 12px; padding: 16px;
      color: white; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;
      cursor: pointer; width: 100%;
      transition: opacity 0.2s, transform 0.2s;
      box-shadow: 0 4px 20px rgba(14,165,233,0.3);
    }
    .explore-btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .explore-btn:active { transform: translateY(0); }
  `],
})
export class CountryPickerComponent {
  @Output() countrySelected = new EventEmitter<Country>();

  readonly COUNTRIES = COUNTRIES;
  query = signal('');
  isOpen = signal(false);

  filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  });

  onQueryChange(val: string): void {
    this.query.set(val);
    this.isOpen.set(true);
  }

  toggleOpen(): void {
    this.isOpen.set(!this.isOpen());
  }

  clearQuery(): void {
    this.query.set('');
    this.isOpen.set(false);
  }

  select(country: Country): void {
    this.isOpen.set(false);
    this.query.set('');
    this.countrySelected.emit(country);
  }
}
