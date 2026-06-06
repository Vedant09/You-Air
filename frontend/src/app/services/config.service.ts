import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { environment } from '../environments/environment';

interface AppConfig {
  version: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);

  async load(): Promise<void> {
    // Fetch config to confirm backend is reachable; ignore errors gracefully
    await firstValueFrom(
      this.http.get<AppConfig>(`${environment.apiUrl}/api/config`).pipe(
        catchError(() => of({ version: '1.0.0' }))
      )
    );
  }
}
