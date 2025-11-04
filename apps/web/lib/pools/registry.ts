/**
 * Pool Registry - Stores known pool addresses in localStorage
 * This avoids calling factory.getPair() for pools we already know exist
 */

const REGISTRY_KEY = 'WARPX_POOL_REGISTRY_V1';

export interface PoolRegistryEntry {
  pairAddress: string;
  token0: string;
  token1: string;
  addedAt: number;
}

export class PoolRegistry {
  private registry: Map<string, PoolRegistryEntry> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Get cache key for a token pair
   */
  private getKey(token0: string, token1: string): string {
    const [lower, upper] = [token0.toLowerCase(), token1.toLowerCase()].sort();
    return `${lower}:${upper}`;
  }

  /**
   * Add a pool to the registry
   */
  addPool(pairAddress: string, token0: string, token1: string): void {
    const key = this.getKey(token0, token1);
    this.registry.set(key, {
      pairAddress: pairAddress.toLowerCase(),
      token0: token0.toLowerCase(),
      token1: token1.toLowerCase(),
      addedAt: Date.now(),
    });
    this.saveToStorage();
  }

  /**
   * Get a pool address from the registry
   */
  getPool(token0: string, token1: string): string | null {
    const key = this.getKey(token0, token1);
    const entry = this.registry.get(key);
    return entry?.pairAddress ?? null;
  }

  /**
   * Check if a pool exists in the registry
   */
  hasPool(token0: string, token1: string): boolean {
    return this.getPool(token0, token1) !== null;
  }

  /**
   * Get all pools in the registry
   */
  getAllPools(): PoolRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * Load registry from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(REGISTRY_KEY);
      if (stored) {
        const entries: PoolRegistryEntry[] = JSON.parse(stored);
        entries.forEach((entry) => {
          const key = this.getKey(entry.token0, entry.token1);
          this.registry.set(key, entry);
        });
      }
    } catch (error) {
      console.error('[PoolRegistry] Failed to load from storage:', error);
    }
  }

  /**
   * Save registry to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const entries = Array.from(this.registry.values());
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('[PoolRegistry] Failed to save to storage:', error);
    }
  }

  /**
   * Clear the registry
   */
  clear(): void {
    this.registry.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(REGISTRY_KEY);
    }
  }
}

// Singleton instance
export const poolRegistry = new PoolRegistry();
