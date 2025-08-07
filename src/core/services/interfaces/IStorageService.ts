/**
 * Storage service interface with namespace isolation
 */

export interface StorageOptions {
  ttl?: number; // Time to live in seconds
  metadata?: Record<string, any>;
}

export interface StorageItem<T = any> {
  value: T;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface ListResult<T = any> {
  keys: Array<{
    name: string;
    metadata?: Record<string, any>;
  }>;
  cursor?: string;
  hasMore: boolean;
}

export interface Transaction {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T, options?: StorageOptions): void;
  delete(key: string): void;
  commit(): Promise<void>;
  rollback(): void;
}

export interface IStorageService {
  /**
   * Get a value from storage
   */
  get<T = any>(namespace: string, key: string): Promise<T | null>;
  
  /**
   * Get value with metadata
   */
  getWithMetadata<T = any>(namespace: string, key: string): Promise<StorageItem<T> | null>;
  
  /**
   * Store a value
   */
  put<T = any>(namespace: string, key: string, value: T, options?: StorageOptions): Promise<void>;
  
  /**
   * Delete a value
   */
  delete(namespace: string, key: string): Promise<void>;
  
  /**
   * List keys in a namespace
   */
  list(namespace: string, options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<ListResult>;
  
  /**
   * Delete all keys in a namespace
   */
  deleteNamespace(namespace: string): Promise<number>;
  
  /**
   * Check if key exists
   */
  exists(namespace: string, key: string): Promise<boolean>;
  
  /**
   * Get multiple values at once
   */
  getMany<T = any>(namespace: string, keys: string[]): Promise<Map<string, T>>;
  
  /**
   * Store multiple values at once
   */
  putMany<T = any>(namespace: string, entries: Map<string, T>, options?: StorageOptions): Promise<void>;
  
  /**
   * Delete multiple keys at once
   */
  deleteMany(namespace: string, keys: string[]): Promise<void>;
  
  /**
   * Create a transaction for atomic operations
   */
  createTransaction(namespace: string): Transaction;
  
  /**
   * Get storage statistics for a namespace
   */
  getStats(namespace: string): Promise<{
    keyCount: number;
    sizeBytes?: number;
    lastModified?: Date;
  }>;
  
  /**
   * Export namespace data for backup
   */
  exportNamespace(namespace: string): Promise<Record<string, any>>;
  
  /**
   * Import namespace data from backup
   */
  importNamespace(namespace: string, data: Record<string, any>): Promise<void>;
}