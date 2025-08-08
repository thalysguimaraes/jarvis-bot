import { Injectable } from '../decorators/Injectable';
import { Inject } from '../decorators/Inject';
import { ILogger } from '../logging/Logger';
import { IConfigService } from '../config/ConfigService';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  key?: string; // Custom cache key
  scope?: 'request' | 'global' | 'user';
  compress?: boolean;
}

export interface CacheEntry<T> {
  value: T;
  expires: number;
  hits: number;
  size: number;
  compressed: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  entries: number;
}

@Injectable({ singleton: true })
export class RequestCache {
  private cache = new Map<string, CacheEntry<any>>();
  private requestCache = new Map<string, Map<string, CacheEntry<any>>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    entries: 0
  };
  private maxSize: number;
  private defaultTTL: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    @Inject('ILogger') private logger: ILogger,
    @Inject('IConfigService') private configService: IConfigService
  ) {
    const cacheConfig = this.configService.get<any>('cache');
    this.maxSize = cacheConfig?.maxSize || 100 * 1024 * 1024; // 100MB default
    this.defaultTTL = cacheConfig?.defaultTTL || 300000; // 5 minutes default
    
    this.startCleanupTimer();
  }

  async get<T>(
    key: string,
    factory?: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T | undefined> {
    const cacheKey = this.buildCacheKey(key, options);
    const cache = this.getCache(options.scope);
    
    const entry = cache.get(cacheKey);
    
    if (entry && entry.expires > Date.now()) {
      this.stats.hits++;
      entry.hits++;
      this.logger.debug('Cache hit', { key: cacheKey, hits: entry.hits });
      
      return options.compress && entry.compressed
        ? this.decompress(entry.value)
        : entry.value;
    }
    
    this.stats.misses++;
    
    if (factory) {
      const value = await factory();
      await this.set(key, value, options);
      return value;
    }
    
    return undefined;
  }

  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(key, options);
    const cache = this.getCache(options.scope);
    
    const ttl = options.ttl || this.defaultTTL;
    const expires = Date.now() + ttl;
    
    const processedValue = options.compress
      ? await this.compress(value)
      : value;
    
    const size = this.estimateSize(processedValue);
    
    // Check if we need to evict entries
    if (this.stats.size + size > this.maxSize) {
      this.evictLRU(size);
    }
    
    const entry: CacheEntry<T> = {
      value: processedValue,
      expires,
      hits: 0,
      size,
      compressed: options.compress || false
    };
    
    cache.set(cacheKey, entry);
    this.stats.size += size;
    this.stats.entries++;
    
    this.logger.debug('Cache set', {
      key: cacheKey,
      ttl,
      size,
      compressed: options.compress
    });
  }

  invalidate(key: string, options: CacheOptions = {}): boolean {
    const cacheKey = this.buildCacheKey(key, options);
    const cache = this.getCache(options.scope);
    
    const entry = cache.get(cacheKey);
    if (entry) {
      cache.delete(cacheKey);
      this.stats.size -= entry.size;
      this.stats.entries--;
      
      this.logger.debug('Cache invalidated', { key: cacheKey });
      return true;
    }
    
    return false;
  }

  invalidatePattern(pattern: string | RegExp, scope?: 'request' | 'global' | 'user'): number {
    const cache = this.getCache(scope);
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    let count = 0;
    for (const [key, entry] of cache.entries()) {
      if (regex.test(key)) {
        cache.delete(key);
        this.stats.size -= entry.size;
        this.stats.entries--;
        count++;
      }
    }
    
    if (count > 0) {
      this.logger.debug('Cache pattern invalidated', { pattern: pattern.toString(), count });
    }
    
    return count;
  }

  clear(scope?: 'request' | 'global' | 'user'): void {
    if (scope === 'request' || !scope) {
      this.requestCache.clear();
    }
    
    if (scope === 'global' || !scope) {
      this.cache.clear();
      this.stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        size: 0,
        entries: 0
      };
    }
    
    this.logger.info('Cache cleared', { scope });
  }

  createRequestScope(requestId: string): void {
    this.requestCache.set(requestId, new Map());
  }

  clearRequestScope(requestId: string): void {
    const cache = this.requestCache.get(requestId);
    if (cache) {
      for (const entry of cache.values()) {
        this.stats.size -= entry.size;
        this.stats.entries--;
      }
      this.requestCache.delete(requestId);
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private getCache(scope?: 'request' | 'global' | 'user'): Map<string, CacheEntry<any>> {
    if (scope === 'request') {
      // Get the current request cache (would need request context)
      const requestId = this.getCurrentRequestId();
      if (requestId) {
        const cache = this.requestCache.get(requestId);
        if (cache) return cache;
      }
    }
    
    return this.cache;
  }

  private getCurrentRequestId(): string | undefined {
    // This would be implemented with AsyncLocalStorage or similar
    // For now, return undefined to use global cache
    return undefined;
  }

  private buildCacheKey(key: string, options: CacheOptions): string {
    const parts = [key];
    
    if (options.key) {
      parts.push(options.key);
    }
    
    if (options.scope === 'user') {
      // Add user ID to key (would need user context)
      const userId = this.getCurrentUserId();
      if (userId) {
        parts.push(`user:${userId}`);
      }
    }
    
    return parts.join(':');
  }

  private getCurrentUserId(): string | undefined {
    // This would be implemented with AsyncLocalStorage or similar
    return undefined;
  }

  private estimateSize(value: any): number {
    // Simple size estimation
    const str = JSON.stringify(value);
    return str.length * 2; // Assuming 2 bytes per character
  }

  private async compress(value: any): Promise<any> {
    // Simple compression using JSON stringification
    // In production, use a proper compression library
    return JSON.stringify(value);
  }

  private async decompress(value: any): Promise<any> {
    // Simple decompression
    return typeof value === 'string' ? JSON.parse(value) : value;
  }

  private evictLRU(requiredSize: number): void {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => {
        // Sort by least recently used (lowest hits) and oldest expiry
        const scoreA = a.entry.hits * 1000 + (a.entry.expires - Date.now());
        const scoreB = b.entry.hits * 1000 + (b.entry.expires - Date.now());
        return scoreA - scoreB;
      });
    
    let freedSize = 0;
    for (const { key, entry } of entries) {
      if (freedSize >= requiredSize) break;
      
      this.cache.delete(key);
      freedSize += entry.size;
      this.stats.size -= entry.size;
      this.stats.entries--;
      this.stats.evictions++;
    }
    
    this.logger.debug('Cache LRU eviction', {
      requiredSize,
      freedSize,
      evicted: this.stats.evictions
    });
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Run cleanup every minute
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
        this.stats.size -= entry.size;
        this.stats.entries--;
        cleaned++;
      }
    }
    
    // Cleanup request caches
    for (const [requestId, cache] of this.requestCache.entries()) {
      for (const [key, entry] of cache.entries()) {
        if (entry.expires < now) {
          cache.delete(key);
          this.stats.size -= entry.size;
          this.stats.entries--;
          cleaned++;
        }
      }
      
      // Remove empty request caches
      if (cache.size === 0) {
        this.requestCache.delete(requestId);
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug('Cache cleanup', { cleaned });
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

/**
 * Cache decorator for methods
 */
export function Cacheable(options: CacheOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      // Get cache instance (would need DI context)
      const cache = (this as any).cache || new RequestCache(
        console as any,
        { get: () => ({}) } as any
      );
      
      // Build cache key from method name and arguments
      const key = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = await cache.get(key, undefined, options);
      if (cached !== undefined) {
        return cached;
      }
      
      // Execute method and cache result
      const result = await originalMethod.apply(this, args);
      await cache.set(key, result, options);
      
      return result;
    };
    
    return descriptor;
  };
}