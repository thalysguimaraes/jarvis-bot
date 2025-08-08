import { Injectable } from '../../decorators/Injectable';
import { Inject } from '../../decorators/Inject';
import { ILogger } from '../../logging/Logger';
import { IStorageService, StorageOptions, StorageItem, ListResult, Transaction } from '../interfaces/IStorageService';
import { KVStorageService } from './KVStorageService';
import { RequestCache } from '../../cache/RequestCache';

export interface BatchOperation {
  type: 'put' | 'delete';
  key: string;
  value?: any;
  metadata?: any;
}

export interface CompressionOptions {
  enabled: boolean;
  threshold: number; // Minimum size in bytes to compress
  algorithm?: 'gzip' | 'deflate' | 'brotli';
}

export interface StorageMetrics {
  reads: number;
  writes: number;
  deletes: number;
  cacheHits: number;
  cacheMisses: number;
  compressionSaved: number;
  batchOperations: number;
  avgReadTime: number;
  avgWriteTime: number;
}

@Injectable({ singleton: true })
export class OptimizedKVStorage implements IStorageService {
  private metrics: StorageMetrics = {
    reads: 0,
    writes: 0,
    deletes: 0,
    cacheHits: 0,
    cacheMisses: 0,
    compressionSaved: 0,
    batchOperations: 0,
    avgReadTime: 0,
    avgWriteTime: 0
  };
  
  private readTimes: number[] = [];
  private writeTimes: number[] = [];
  private maxTimeSamples = 100;
  private batchQueue: BatchOperation[] = [];
  private batchTimer?: NodeJS.Timeout;
  private batchSize = 25; // KV allows up to 25 operations per batch
  private batchDelay = 100; // ms to wait before executing batch

  constructor(
    @Inject(KVStorageService) private kvStorage: KVStorageService,
    @Inject(RequestCache) private cache: RequestCache,
    @Inject('ILogger') private logger: ILogger,
    private compressionOptions: CompressionOptions = {
      enabled: true,
      threshold: 1024 // 1KB
    }
  ) {}

  async get<T>(namespace: string, key: string): Promise<T | null> {
    const startTime = Date.now();
    
    // Check cache first
    const fullKey = `${namespace}:${key}`;
    const cached = await this.cache.get<T>(fullKey, undefined, {
      scope: 'global',
      ttl: 300000 // 5 minutes
    });
    
    if (cached !== undefined) {
      this.metrics.cacheHits++;
      return cached;
    }
    
    this.metrics.cacheMisses++;
    this.metrics.reads++;
    
    try {
      const result = await this.kvStorage.get<T>(namespace, key);
      
      if (result && this.isCompressed(result)) {
        const decompressed = await this.decompress(result);
        
        // Cache the decompressed value
        await this.cache.set(fullKey, decompressed, {
          scope: 'global',
          ttl: 300000
        });
        
        this.recordReadTime(Date.now() - startTime);
        return decompressed;
      }
      
      if (result) {
        // Cache the value
        await this.cache.set(fullKey, result, {
          scope: 'global',
          ttl: 300000
        });
      }
      
      this.recordReadTime(Date.now() - startTime);
      return result;
    } catch (error) {
      this.logger.error('KV get failed', error as Error, { namespace, key });
      throw error;
    }
  }

  async put<T>(namespace: string, key: string, value: T, options?: StorageOptions): Promise<void> {
    const startTime = Date.now();
    this.metrics.writes++;
    
    try {
      // Check if we should compress
      const serialized = JSON.stringify(value);
      const size = new Blob([serialized]).size;
      
      let storedValue: any = value;
      let savedBytes = 0;
      
      if (this.compressionOptions.enabled && size > this.compressionOptions.threshold) {
        storedValue = await this.compress(value);
        const compressedSize = new Blob([JSON.stringify(storedValue)]).size;
        savedBytes = size - compressedSize;
        this.metrics.compressionSaved += savedBytes;
        
        this.logger.debug('Value compressed', {
          key,
          originalSize: size,
          compressedSize,
          savedBytes,
          namespace
        });
      }
      
      const fullKey = `${namespace}:${key}`;
      await this.kvStorage.put(namespace, key, storedValue, { metadata: options?.metadata });
      
      // Update cache
      await this.cache.set(fullKey, value, {
        scope: 'global',
        ttl: 300000
      });
      
      this.recordWriteTime(Date.now() - startTime);
    } catch (error) {
      this.logger.error('KV put failed', error as Error, { namespace, key });
      throw error;
    }
  }

  async delete(namespace: string, key: string): Promise<void> {
    this.metrics.deletes++;
    
    try {
      await this.kvStorage.delete(namespace, key);
      
      // Invalidate cache
      this.cache.invalidate(`${namespace}:${key}`, { scope: 'global' });
    } catch (error) {
      this.logger.error('KV delete failed', error as Error, { namespace, key });
      throw error;
    }
  }

  async list(namespace: string, options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<ListResult> {
    const listResult = await this.kvStorage.list(namespace, options);
    
    return listResult;
  }

  async exists(namespace: string, key: string): Promise<boolean> {
    // Check cache first
    const fullKey = `${namespace}:${key}`;
    const cached = await this.cache.get(fullKey, undefined, {
      scope: 'global'
    });
    
    if (cached !== undefined) {
      return true;
    }
    
    return this.kvStorage.exists(namespace, key);
  }

  async batch(operations: BatchOperation[]): Promise<void> {
    // Add to batch queue
    this.batchQueue.push(...operations);
    
    // Clear existing timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    // If we've reached batch size, execute immediately
    if (this.batchQueue.length >= this.batchSize) {
      await this.executeBatch();
    } else {
      // Otherwise, wait for more operations
      this.batchTimer = setTimeout(() => {
        this.executeBatch().catch(error => {
          this.logger.error('Batch execution failed', error);
        });
      }, this.batchDelay);
    }
  }

  private async executeBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;
    
    const operations = this.batchQueue.splice(0, this.batchSize);
    this.metrics.batchOperations++;
    
    this.logger.debug('Executing batch operations', {
      count: operations.length
    });
    
    try {
      // Group operations by type for optimization
      const puts = operations.filter(op => op.type === 'put');
      const deletes = operations.filter(op => op.type === 'delete');
      
      // Execute in parallel
      const promises: Promise<void>[] = [];
      
      for (const op of puts) {
        // Parse namespace from key
        const [namespace, ...keyParts] = op.key.split(':');
        const key = keyParts.join(':');
        promises.push(this.put(namespace, key, op.value, { metadata: op.metadata }));
      }
      
      for (const op of deletes) {
        // Parse namespace from key
        const [namespace, ...keyParts] = op.key.split(':');
        const key = keyParts.join(':');
        promises.push(this.delete(namespace, key));
      }
      
      await Promise.all(promises);
      
      this.logger.info('Batch operations completed', {
        puts: puts.length,
        deletes: deletes.length
      });
    } catch (error) {
      this.logger.error('Batch execution failed', error as Error, {
        operations: operations.length
      });
      throw error;
    }
    
    // If there are more operations, schedule next batch
    if (this.batchQueue.length > 0) {
      this.batchTimer = setTimeout(() => {
        this.executeBatch().catch(error => {
          this.logger.error('Batch execution failed', error);
        });
      }, this.batchDelay);
    }
  }

  async getMany<T>(namespace: string, keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    // Check cache for all keys first
    const uncachedKeys: string[] = [];
    
    for (const key of keys) {
      const fullKey = `${namespace}:${key}`;
      const cached = await this.cache.get<T>(fullKey, undefined, {
        scope: 'global'
      });
      
      if (cached !== undefined) {
        results.set(key, cached);
        this.metrics.cacheHits++;
      } else {
        uncachedKeys.push(key);
        this.metrics.cacheMisses++;
      }
    }
    
    // Fetch uncached keys in parallel
    if (uncachedKeys.length > 0) {
      const promises = uncachedKeys.map(key => 
        this.get<T>(namespace, key).then(value => ({ key, value }))
      );
      
      const fetchedResults = await Promise.all(promises);
      
      for (const { key, value } of fetchedResults) {
        if (value !== null) {
          results.set(key, value as T);
        }
      }
    }
    
    return results;
  }

  async getWithMetadata<T>(namespace: string, key: string): Promise<StorageItem<T> | null> {
    const value = await this.get<T>(namespace, key);
    
    if (!value) {
      return null;
    }
    
    // Return in StorageItem format
    return {
      value,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };
  }
  
  // Additional methods to implement IStorageService
  async deleteNamespace(namespace: string): Promise<number> {
    const result = await this.list(namespace);
    let count = 0;
    
    for (const item of result.keys) {
      await this.delete(namespace, item.name);
      count++;
    }
    
    return count;
  }
  
  async putMany<T>(namespace: string, entries: Map<string, T>, options?: StorageOptions): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [key, value] of entries) {
      promises.push(this.put(namespace, key, value, options));
    }
    
    await Promise.all(promises);
  }
  
  async deleteMany(namespace: string, keys: string[]): Promise<void> {
    const promises = keys.map(key => this.delete(namespace, key));
    await Promise.all(promises);
  }
  
  createTransaction(namespace: string): Transaction {
    const operations: BatchOperation[] = [];
    
    return {
      get: async <T>(key: string) => this.get<T>(namespace, key),
      put: <T>(key: string, value: T, options?: StorageOptions) => {
        operations.push({ type: 'put', key: `${namespace}:${key}`, value, metadata: options?.metadata });
      },
      delete: (key: string) => {
        operations.push({ type: 'delete', key: `${namespace}:${key}` });
      },
      commit: async () => {
        await this.batch(operations);
      },
      rollback: () => {
        operations.length = 0;
      }
    };
  }
  
  async getStats(namespace: string): Promise<{
    keyCount: number;
    sizeBytes?: number;
    lastModified?: Date;
  }> {
    const result = await this.list(namespace);
    return {
      keyCount: result.keys.length,
      lastModified: new Date()
    };
  }
  
  async exportNamespace(namespace: string): Promise<Record<string, any>> {
    const result = await this.list(namespace);
    const data: Record<string, any> = {};
    
    for (const item of result.keys) {
      const value = await this.get(namespace, item.name);
      if (value !== null) {
        data[item.name] = value;
      }
    }
    
    return data;
  }
  
  async importNamespace(namespace: string, data: Record<string, any>): Promise<void> {
    const entries = new Map(Object.entries(data));
    await this.putMany(namespace, entries);
  }

  private async compress(value: any): Promise<any> {
    // Simple compression marker
    // In production, use proper compression library
    return {
      __compressed: true,
      data: JSON.stringify(value),
      algorithm: 'json'
    };
  }

  private async decompress(value: any): Promise<any> {
    if (value.__compressed && value.data) {
      return JSON.parse(value.data);
    }
    return value;
  }

  private isCompressed(value: any): boolean {
    return value && typeof value === 'object' && value.__compressed === true;
  }

  private recordReadTime(time: number): void {
    this.readTimes.push(time);
    
    if (this.readTimes.length > this.maxTimeSamples) {
      this.readTimes.shift();
    }
    
    this.metrics.avgReadTime = 
      this.readTimes.reduce((a, b) => a + b, 0) / this.readTimes.length;
  }

  private recordWriteTime(time: number): void {
    this.writeTimes.push(time);
    
    if (this.writeTimes.length > this.maxTimeSamples) {
      this.writeTimes.shift();
    }
    
    this.metrics.avgWriteTime = 
      this.writeTimes.reduce((a, b) => a + b, 0) / this.writeTimes.length;
  }

  getMetrics(): StorageMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      reads: 0,
      writes: 0,
      deletes: 0,
      cacheHits: 0,
      cacheMisses: 0,
      compressionSaved: 0,
      batchOperations: 0,
      avgReadTime: 0,
      avgWriteTime: 0
    };
    this.readTimes = [];
    this.writeTimes = [];
  }

  getCacheEfficiency(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return total > 0 ? this.metrics.cacheHits / total : 0;
  }

  getCompressionRatio(): number {
    const totalWritten = this.metrics.writes * 1000; // Rough estimate
    return totalWritten > 0 ? this.metrics.compressionSaved / totalWritten : 0;
  }

  async flush(): Promise<void> {
    // Execute any pending batch operations
    if (this.batchQueue.length > 0) {
      await this.executeBatch();
    }
    
    // Clear cache
    this.cache.clear('global');
  }

  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.flush().catch(error => {
      this.logger.error('Failed to flush on destroy', error);
    });
  }
}

/**
 * Decorator for automatic KV caching
 */
export function KVCached(ttl: number = 300000) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const storage = (this as any).storage;
      if (!storage || !(storage instanceof OptimizedKVStorage)) {
        return originalMethod.apply(this, args);
      }
      
      // Build cache key from method name and arguments
      const cacheKey = `method:${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
      
      // Try to get from KV storage with caching
      const [cacheNs, ...cacheKeyParts] = cacheKey.split(':');
      const cached = await storage.get(cacheNs, cacheKeyParts.join(':'));
      if (cached !== null) {
        return cached;
      }
      
      // Execute method and cache result
      const result = await originalMethod.apply(this, args);
      await storage.put(cacheNs, cacheKeyParts.join(':'), result, { ttl });
      
      return result;
    };
    
    return descriptor;
  };
}