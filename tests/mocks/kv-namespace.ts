import { vi } from 'vitest';

export class MockKVNamespace implements KVNamespace {
  private store = new Map<string, string>();
  private metadata = new Map<string, any>();
  
  async get(key: string, options?: any): Promise<any> {
    const value = this.store.get(key);
    if (!value) return null;
    
    // Handle the 'json' type option like Cloudflare KV
    if (options === 'json' || options?.type === 'json') {
      try {
        return JSON.parse(value);
      } catch {
        // Return null for invalid JSON, like real KV
        return null;
      }
    }
    
    return value;
  }
  
  async put(
    key: string, 
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: KVNamespacePutOptions
  ): Promise<void> {
    let stringValue: string;
    
    if (typeof value === 'string') {
      stringValue = value;
    } else if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      stringValue = Buffer.from(value as any).toString('base64');
    } else {
      throw new Error('Unsupported value type for KV put');
    }
    
    this.store.set(key, stringValue);
    
    if (options?.metadata) {
      this.metadata.set(key, options.metadata);
    }
  }
  
  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.metadata.delete(key);
  }
  
  async list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult<any>> {
    const prefix = options?.prefix || '';
    const limit = options?.limit || 1000;
    const cursor = options?.cursor;
    
    const keys = Array.from(this.store.keys())
      .filter(key => key.startsWith(prefix))
      .sort();
    
    const startIndex = cursor ? parseInt(cursor) : 0;
    const endIndex = Math.min(startIndex + limit, keys.length);
    
    const resultKeys = keys.slice(startIndex, endIndex).map(key => ({
      name: key,
      metadata: this.metadata.get(key),
    }));
    
    return {
      keys: resultKeys,
      list_complete: endIndex >= keys.length,
      cursor: endIndex < keys.length ? endIndex.toString() : undefined,
    };
  }
  
  getWithMetadata = vi.fn();
  
  // Test helpers
  clear(): void {
    this.store.clear();
    this.metadata.clear();
  }
  
  getAll(): Map<string, string> {
    return new Map(this.store);
  }
  
  has(key: string): boolean {
    return this.store.has(key);
  }
}