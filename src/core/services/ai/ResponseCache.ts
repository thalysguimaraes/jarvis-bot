import { createHash } from 'crypto';

export interface CacheEntry<T> {
  value: T;
  timestamp: Date;
  hits: number;
  tokensSaved?: number;
}

export class ResponseCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats = {
    hits: 0,
    misses: 0,
    savedTokens: 0,
  };
  
  constructor(
    private maxSize: number = 100,
    private ttlMs: number = 3600000 // 1 hour default
  ) {}
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    const now = new Date();
    if (now.getTime() - entry.timestamp.getTime() > this.ttlMs) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update stats
    entry.hits++;
    this.stats.hits++;
    if (entry.tokensSaved) {
      this.stats.savedTokens += entry.tokensSaved;
    }
    
    return entry.value;
  }
  
  set(key: string, value: T, tokensSaved?: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.findOldestEntry();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      value,
      timestamp: new Date(),
      hits: 0,
      tokensSaved,
    });
  }
  
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check expiration
    const now = new Date();
    if (now.getTime() - entry.timestamp.getTime() > this.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      savedTokens: 0,
    };
  }
  
  getStats() {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      savedTokens: this.stats.savedTokens,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
    };
  }
  
  /**
   * Generate a cache key from input parameters
   */
  static generateKey(input: any): string {
    const normalized = JSON.stringify(input, Object.keys(input).sort());
    return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }
  
  private findOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = new Date();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }
}