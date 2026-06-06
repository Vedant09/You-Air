import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/app-state.service';
import { LayerConfig } from '../../models/aircraft.model';

@Component({
  selector: 'app-layer-controls',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layer-panel glass rounded-xl border border-white/10 p-3">
      <div class="text-xs text-slate-500 font-mono uppercase tracking-wider mb-3">Layers</div>
      <div class="space-y-2">
        @for (layer of layerDefs; track layer.key) {
          <button
            (click)="state.toggleLayer(layer.key)"
            class="flex items-center gap-2.5 w-full hover:opacity-80 transition-opacity">
            <div class="w-8 h-4 rounded-full transition-colors relative"
                 [ngClass]="state.layers()[layer.key] ? 'bg-sky-500' : 'bg-slate-700'">
              <div class="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform"
                   [ngClass]="state.layers()[layer.key] ? 'translate-x-4' : 'translate-x-0.5'"></div>
            </div>
            <span class="text-xs text-slate-300">{{ layer.label }}</span>
            <div class="ml-auto w-2 h-2 rounded-full" [style.background]="layer.color"></div>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .layer-panel { min-width: 160px; }
  `]
})
export class LayerControlsComponent {
  state = inject(AppStateService);

  layerDefs: { key: keyof LayerConfig; label: string; color: string }[] = [
    { key: 'aircraft', label: 'Live Aircraft', color: '#38bdf8' },
    { key: 'airports', label: 'Airports', color: '#f59e0b' },
    { key: 'flightPaths', label: 'Flight Paths', color: '#818cf8' },
    { key: 'density', label: 'Traffic Density', color: '#f87171' },
  ];
}
