import { Injectable } from '../decorators/Injectable';
import { Inject } from '../decorators/Inject';
import { ILogger } from '../logging/Logger';
import { ResilienceManager } from '../services/resilience/ResilienceManager';

export interface PoolConfig {
  maxConnections: number;
  maxIdleTime: number;
  keepAlive: boolean;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface ConnectionStats {
  active: number;
  idle: number;
  total: number;
  created: number;
  destroyed: number;
  errors: number;
  avgResponseTime: number;
}

export interface HttpClientOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  pool?: string;
}

class PooledConnection {
  private lastUsed: Date = new Date();
  private useCount = 0;
  private errors = 0;
  
  constructor(
    public readonly id: string,
    public readonly host: string,
    private keepAlive: boolean
  ) {}
  
  async execute(
    url: string,
    options: RequestInit & { timeout?: number }
  ): Promise<Response> {
    this.lastUsed = new Date();
    this.useCount++;
    
    const controller = new AbortController();
    const timeout = options.timeout || 30000;
    
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          ...(this.keepAlive ? { 'Connection': 'keep-alive' } : {})
        }
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      this.errors++;
      throw error;
    }
  }
  
  isIdle(maxIdleTime: number): boolean {
    return Date.now() - this.lastUsed.getTime() > maxIdleTime;
  }
  
  getStats() {
    return {
      id: this.id,
      host: this.host,
      useCount: this.useCount,
      errors: this.errors,
      lastUsed: this.lastUsed,
      errorRate: this.useCount > 0 ? this.errors / this.useCount : 0
    };
  }
}

@Injectable({ singleton: true })
export class ConnectionPool {
  private pools = new Map<string, Map<string, PooledConnection>>();
  private stats = new Map<string, ConnectionStats>();
  private cleanupInterval?: NodeJS.Timeout;
  private defaultConfig: PoolConfig = {
    maxConnections: 10,
    maxIdleTime: 60000,
    keepAlive: true,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  };
  private responseTimes: number[] = [];
  private maxResponseTimeSamples = 100;

  constructor(
    @Inject('ILogger') private logger: ILogger,
    @Inject(ResilienceManager) private resilienceManager: ResilienceManager
  ) {
    this.startCleanupTimer();
  }

  async request(
    url: string,
    options: HttpClientOptions = {}
  ): Promise<Response> {
    const parsedUrl = new URL(url);
    const host = parsedUrl.host;
    const poolName = options.pool || 'default';
    
    // Execute with resilience
    return this.resilienceManager.executeWithResilience(
      `http-${host}`,
      async () => {
        const connection = this.getConnection(host, poolName);
        const startTime = Date.now();
        
        try {
          const response = await connection.execute(url, {
            ...options,
            timeout: options.timeout || this.defaultConfig.timeout
          });
          
          this.recordResponseTime(Date.now() - startTime);
          this.updateStats(poolName, 'success');
          
          return response;
        } catch (error) {
          this.updateStats(poolName, 'error');
          throw error;
        }
      },
      {
        customRetryOptions: {
          maxAttempts: options.retries || this.defaultConfig.retryAttempts,
          initialDelayMs: this.defaultConfig.retryDelay,
          maxDelayMs: this.defaultConfig.retryDelay * 10,
          backoffMultiplier: 2
        }
      }
    );
  }

  async get(url: string, options?: HttpClientOptions): Promise<Response> {
    return this.request(url, { ...options, method: 'GET' });
  }

  async post(
    url: string,
    body?: any,
    options?: HttpClientOptions
  ): Promise<Response> {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: typeof body === 'object' ? JSON.stringify(body) : body,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });
  }

  async put(
    url: string,
    body?: any,
    options?: HttpClientOptions
  ): Promise<Response> {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: typeof body === 'object' ? JSON.stringify(body) : body,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });
  }

  async delete(url: string, options?: HttpClientOptions): Promise<Response> {
    return this.request(url, { ...options, method: 'DELETE' });
  }

  async json<T>(url: string, options?: HttpClientOptions): Promise<T> {
    const response = await this.get(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  configurePool(name: string, config: Partial<PoolConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
    this.logger.info('Connection pool configured', { name, config });
  }

  private getConnection(host: string, poolName: string): PooledConnection {
    if (!this.pools.has(poolName)) {
      this.pools.set(poolName, new Map());
      this.initializeStats(poolName);
    }
    
    const pool = this.pools.get(poolName)!;
    
    // Try to reuse existing connection
    for (const connection of pool.values()) {
      if (connection.host === host && !connection.isIdle(this.defaultConfig.maxIdleTime)) {
        this.logger.debug('Reusing connection', {
          pool: poolName,
          host,
          connectionId: connection.id
        });
        return connection;
      }
    }
    
    // Check if we've reached max connections
    if (pool.size >= this.defaultConfig.maxConnections) {
      // Find least recently used connection to replace
      const lru = Array.from(pool.values())
        .sort((a, b) => a.getStats().lastUsed.getTime() - b.getStats().lastUsed.getTime())[0];
      
      if (lru) {
        pool.delete(lru.id);
        this.updateStats(poolName, 'destroyed');
      }
    }
    
    // Create new connection
    const connectionId = `${host}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const connection = new PooledConnection(
      connectionId,
      host,
      this.defaultConfig.keepAlive
    );
    
    pool.set(connectionId, connection);
    this.updateStats(poolName, 'created');
    
    this.logger.debug('Created new connection', {
      pool: poolName,
      host,
      connectionId
    });
    
    return connection;
  }

  private initializeStats(poolName: string): void {
    this.stats.set(poolName, {
      active: 0,
      idle: 0,
      total: 0,
      created: 0,
      destroyed: 0,
      errors: 0,
      avgResponseTime: 0
    });
  }

  private updateStats(poolName: string, event: 'created' | 'destroyed' | 'success' | 'error'): void {
    const stats = this.stats.get(poolName);
    if (!stats) return;
    
    switch (event) {
      case 'created':
        stats.created++;
        stats.total++;
        break;
      case 'destroyed':
        stats.destroyed++;
        stats.total--;
        break;
      case 'error':
        stats.errors++;
        break;
    }
    
    // Update active/idle counts
    const pool = this.pools.get(poolName);
    if (pool) {
      stats.active = 0;
      stats.idle = 0;
      
      for (const connection of pool.values()) {
        if (connection.isIdle(this.defaultConfig.maxIdleTime)) {
          stats.idle++;
        } else {
          stats.active++;
        }
      }
    }
  }

  private recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    
    if (this.responseTimes.length > this.maxResponseTimeSamples) {
      this.responseTimes.shift();
    }
    
    // Update average response time in stats
    const avgTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    
    for (const stats of this.stats.values()) {
      stats.avgResponseTime = avgTime;
    }
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000); // Run cleanup every 30 seconds
  }

  private cleanup(): void {
    let cleaned = 0;
    
    for (const [poolName, pool] of this.pools.entries()) {
      const toRemove: string[] = [];
      
      for (const [id, connection] of pool.entries()) {
        if (connection.isIdle(this.defaultConfig.maxIdleTime)) {
          toRemove.push(id);
        }
      }
      
      for (const id of toRemove) {
        pool.delete(id);
        this.updateStats(poolName, 'destroyed');
        cleaned++;
      }
      
      // Remove empty pools
      if (pool.size === 0) {
        this.pools.delete(poolName);
        this.stats.delete(poolName);
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug('Connection pool cleanup', { cleaned });
    }
  }

  getStats(poolName?: string): ConnectionStats | Map<string, ConnectionStats> {
    if (poolName) {
      return this.stats.get(poolName) || this.getEmptyStats();
    }
    
    return new Map(this.stats);
  }

  private getEmptyStats(): ConnectionStats {
    return {
      active: 0,
      idle: 0,
      total: 0,
      created: 0,
      destroyed: 0,
      errors: 0,
      avgResponseTime: 0
    };
  }

  getConnectionDetails(poolName: string): any[] {
    const pool = this.pools.get(poolName);
    if (!pool) return [];
    
    return Array.from(pool.values()).map(conn => conn.getStats());
  }

  closePool(poolName: string): void {
    const pool = this.pools.get(poolName);
    if (pool) {
      const count = pool.size;
      pool.clear();
      this.pools.delete(poolName);
      this.stats.delete(poolName);
      
      this.logger.info('Connection pool closed', { poolName, connections: count });
    }
  }

  closeAll(): void {
    const poolNames = Array.from(this.pools.keys());
    
    for (const poolName of poolNames) {
      this.closePool(poolName);
    }
    
    this.responseTimes = [];
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.closeAll();
  }
}

/**
 * Global HTTP client instance with connection pooling
 */
export class HttpClient {
  private static instance: ConnectionPool;
  
  static getInstance(): ConnectionPool {
    if (!HttpClient.instance) {
      // This would normally use DI
      HttpClient.instance = new ConnectionPool(
        console as any,
        {} as any
      );
    }
    return HttpClient.instance;
  }
  
  static async get(url: string, options?: HttpClientOptions): Promise<Response> {
    return HttpClient.getInstance().get(url, options);
  }
  
  static async post(
    url: string,
    body?: any,
    options?: HttpClientOptions
  ): Promise<Response> {
    return HttpClient.getInstance().post(url, body, options);
  }
  
  static async json<T>(url: string, options?: HttpClientOptions): Promise<T> {
    return HttpClient.getInstance().json<T>(url, options);
  }
}