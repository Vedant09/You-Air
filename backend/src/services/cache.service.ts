import NodeCache from 'node-cache';

class CacheService {
  private cache = new NodeCache({ stdTTL: 30, checkperiod: 60 });

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttl = 30): boolean {
    return this.cache.set(key, value, ttl);
  }

  del(key: string): number {
    return this.cache.del(key);
  }

  flush(): void {
    this.cache.flushAll();
  }

  keys(): string[] {
    return this.cache.keys();
  }
}

export const cacheService = new CacheService();
