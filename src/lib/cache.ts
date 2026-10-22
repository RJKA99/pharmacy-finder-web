interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Best-effort in-memory cache. Vercel serverless instances are ephemeral and
 * may not share this across invocations, but it still saves repeat Overpass
 * calls within a warm instance (e.g. a user refreshing the page).
 */
export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}
