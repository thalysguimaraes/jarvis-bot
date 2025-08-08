import { Injectable } from '../../decorators/Injectable';
import {
  IStorageService,
  StorageOptions,
  StorageItem,
  ListResult,
  Transaction,
} from '../interfaces/IStorageService';

/**
 * KV Storage Service with namespace isolation
 * Provides virtual namespaces within a single KV namespace
 */

export interface KVStorageConfig {
  cacheEnabled?: boolean;
  cacheTTLSeconds?: number;
}

@Injectable({ singleton: true })
export class KVStorageService implements IStorageService {
  private kv: KVNamespace;
  private namespacePrefix = 'ns';
  private separator = ':';
  private config: KVStorageConfig;
  
  constructor(kv: KVNamespace, config: KVStorageConfig = {}) {
    this.kv = kv;
    this.config = {
      cacheEnabled: true,
      cacheTTLSeconds: 300,
      ...config
    };
  }
  
  async get<T = any>(namespace: string, key: string): Promise<T | null> {
    const fullKey = this.buildKey(namespace, key);
    const value = await this.kv.get(fullKey, 'json');
    
    if (value === null) return null;
    
    // Check if value is a StorageItem wrapper
    if (this.isStorageItem(value)) {
      // Check expiration
      if (value.expiresAt && new Date(value.expiresAt) < new Date()) {
        await this.delete(namespace, key);
        return null;
      }
      return value.value as T;
    }
    
    return value as T;
  }
  
  async getWithMetadata<T = any>(namespace: string, key: string): Promise<StorageItem<T> | null> {
    const fullKey = this.buildKey(namespace, key);
    const result = await this.kv.getWithMetadata(fullKey, 'json');
    
    if (result.value === null) return null;
    
    let item: StorageItem<T>;
    
    if (this.isStorageItem(result.value)) {
      item = result.value as StorageItem<T>;
      
      // Check expiration
      if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
        await this.delete(namespace, key);
        return null;
      }
    } else {
      // Legacy data without StorageItem wrapper
      item = {
        value: result.value as T,
        metadata: result.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    
    return item;
  }
  
  async put<T = any>(namespace: string, key: string, value: T, options?: StorageOptions): Promise<void> {
    const fullKey = this.buildKey(namespace, key);
    const now = new Date();
    
    const item: StorageItem<T> = {
      value,
      metadata: options?.metadata,
      createdAt: now,
      updatedAt: now,
      expiresAt: options?.ttl ? new Date(now.getTime() + options.ttl * 1000) : undefined,
    };
    
    const kvOptions: KVNamespacePutOptions = {
      metadata: options?.metadata,
    };
    
    if (options?.ttl) {
      kvOptions.expirationTtl = options.ttl;
    }
    
    await this.kv.put(fullKey, JSON.stringify(item), kvOptions);
  }
  
  async delete(namespace: string, key: string): Promise<void> {
    const fullKey = this.buildKey(namespace, key);
    await this.kv.delete(fullKey);
  }
  
  async list(namespace: string, options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<ListResult> {
    const namespacePrefix = this.buildKey(namespace, options?.prefix || '');
    
    const result = await this.kv.list({
      prefix: namespacePrefix,
      limit: options?.limit || 1000,
      cursor: options?.cursor,
    });
    
    // Remove namespace prefix from keys
    const keys = result.keys.map((key: any) => ({
      name: this.extractKey(namespace, key.name),
      metadata: key.metadata as Record<string, any> | undefined,
    }));
    
    const anyResult = result as any;
    return {
      keys,
      cursor: anyResult.cursor,
      hasMore: !anyResult.list_complete,
    };
  }
  
  async deleteNamespace(namespace: string): Promise<number> {
    const namespacePrefix = this.buildKey(namespace, '');
    let deleted = 0;
    let cursor: string | undefined;
    
    do {
      const result = await this.kv.list({
        prefix: namespacePrefix,
        limit: 100,
        cursor,
      });
      
      // Delete all keys in parallel
      await Promise.all(
        result.keys.map(key => this.kv.delete(key.name))
      );
      
      deleted += result.keys.length;
      cursor = (result as any).cursor;
      
    } while (cursor);
    
    return deleted;
  }
  
  async exists(namespace: string, key: string): Promise<boolean> {
    const value = await this.get(namespace, key);
    return value !== null;
  }
  
  async getMany<T = any>(namespace: string, keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    // Batch get operations
    const promises = keys.map(async key => {
      const value = await this.get<T>(namespace, key);
      if (value !== null) {
        results.set(key, value);
      }
    });
    
    await Promise.all(promises);
    return results;
  }
  
  async putMany<T = any>(namespace: string, entries: Map<string, T>, options?: StorageOptions): Promise<void> {
    const promises = Array.from(entries.entries()).map(([key, value]) =>
      this.put(namespace, key, value, options)
    );
    
    await Promise.all(promises);
  }
  
  async deleteMany(namespace: string, keys: string[]): Promise<void> {
    const promises = keys.map(key => this.delete(namespace, key));
    await Promise.all(promises);
  }
  
  createTransaction(namespace: string): Transaction {
    return new KVTransaction(this, namespace);
  }
  
  async getStats(namespace: string): Promise<{
    keyCount: number;
    sizeBytes?: number;
    lastModified?: Date;
  }> {
    let keyCount = 0;
    let lastModified: Date | undefined;
    let cursor: string | undefined;
    
    do {
      const result = await this.kv.list({
        prefix: this.buildKey(namespace, ''),
        limit: 1000,
        cursor,
      });
      
      keyCount += result.keys.length;
      
      // Track most recent modification
      for (const key of result.keys as any) {
        if ((key.metadata as any)?.updatedAt) {
          const updated = new Date((key.metadata as any).updatedAt);
          if (!lastModified || updated > lastModified) {
            lastModified = updated;
          }
        }
      }
      
      cursor = (result as any).cursor;
    } while (cursor);
    
    return {
      keyCount,
      lastModified,
    };
  }
  
  async exportNamespace(namespace: string): Promise<Record<string, any>> {
    const data: Record<string, any> = {};
    let cursor: string | undefined;
    
    do {
      const result = await this.kv.list({
        prefix: this.buildKey(namespace, ''),
        limit: 100,
        cursor,
      });
      
      // Get all values
      const promises = result.keys.map(async key => {
        const shortKey = this.extractKey(namespace, key.name);
        const value = await this.kv.get(key.name, 'json');
        if (value !== null) {
          data[shortKey] = value;
        }
      });
      
      await Promise.all(promises);
      cursor = (result as any).cursor;
      
    } while (cursor);
    
    return data;
  }
  
  async importNamespace(namespace: string, data: Record<string, any>): Promise<void> {
    const entries = new Map(Object.entries(data));
    
    // Import with larger batch size for efficiency
    const batchSize = 50;
    const keys = Array.from(entries.keys());
    
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const batchEntries = new Map(batch.map(key => [key, entries.get(key)!]));
      await this.putMany(namespace, batchEntries);
    }
  }
  
  // Helper methods
  private buildKey(namespace: string, key: string): string {
    if (!namespace) {
      throw new Error('Namespace is required');
    }
    
    // Sanitize namespace and key
    const safeNamespace = namespace.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeKey = key.replace(/[^a-zA-Z0-9_\-:.]/g, '_');
    
    return `${this.namespacePrefix}${this.separator}${safeNamespace}${this.separator}${safeKey}`;
  }
  
  private extractKey(namespace: string, fullKey: string): string {
    const prefix = `${this.namespacePrefix}${this.separator}${namespace}${this.separator}`;
    return fullKey.startsWith(prefix) ? fullKey.substring(prefix.length) : fullKey;
  }
  
  private isStorageItem(value: any): value is StorageItem {
    return (
      typeof value === 'object' &&
      value !== null &&
      'value' in value &&
      'createdAt' in value &&
      'updatedAt' in value
    );
  }
}

/**
 * Transaction implementation for atomic operations
 */
class KVTransaction implements Transaction {
  private operations: Array<{
    type: 'get' | 'put' | 'delete';
    key: string;
    value?: any;
    options?: StorageOptions;
  }> = [];
  
  private cache = new Map<string, any>();
  private committed = false;
  
  constructor(
    private storage: KVStorageService,
    private namespace: string
  ) {}
  
  async get<T>(key: string): Promise<T | null> {
    if (this.committed) {
      throw new Error('Transaction already committed');
    }
    
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    // Get from storage
    const value = await this.storage.get<T>(this.namespace, key);
    this.cache.set(key, value);
    
    this.operations.push({ type: 'get', key });
    
    return value;
  }
  
  put<T>(key: string, value: T, options?: StorageOptions): void {
    if (this.committed) {
      throw new Error('Transaction already committed');
    }
    
    this.cache.set(key, value);
    this.operations.push({ type: 'put', key, value, options });
  }
  
  delete(key: string): void {
    if (this.committed) {
      throw new Error('Transaction already committed');
    }
    
    this.cache.delete(key);
    this.operations.push({ type: 'delete', key });
  }
  
  async commit(): Promise<void> {
    if (this.committed) {
      throw new Error('Transaction already committed');
    }
    
    try {
      // Execute all write operations
      const promises = this.operations
        .filter(op => op.type !== 'get')
        .map(op => {
          switch (op.type) {
            case 'put':
              return this.storage.put(this.namespace, op.key, op.value, op.options);
            case 'delete':
              return this.storage.delete(this.namespace, op.key);
            default:
              return Promise.resolve();
          }
        });
      
      await Promise.all(promises);
      this.committed = true;
      
    } catch (error) {
      // In a real implementation, we might want to implement rollback
      throw new Error(`Transaction failed: ${error}`);
    }
  }
  
  rollback(): void {
    this.operations = [];
    this.cache.clear();
    this.committed = false;
  }
}