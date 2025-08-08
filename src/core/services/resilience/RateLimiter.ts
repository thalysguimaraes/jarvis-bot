import { Injectable } from '../../decorators/Injectable';
import { ILogger } from '../../logging/Logger';
import { Inject } from '../../decorators/Inject';

export interface RateLimiterOptions {
  tokensPerInterval: number;
  interval: number; // in milliseconds
  maxBurstSize?: number;
  uniformDistribution?: boolean;
}

export interface RateLimiterStats {
  availableTokens: number;
  maxTokens: number;
  nextRefillTime: Date;
  isLimited: boolean;
  requestsAccepted: number;
  requestsRejected: number;
}

@Injectable({ singleton: false })
export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private lastRefillTime: number;
  private requestsAccepted = 0;
  private requestsRejected = 0;
  // Queue for future implementation of priority queuing
  // private queue: Array<{
  //   resolve: () => void;
  //   timestamp: number;
  // }> = [];

  constructor(
    private name: string,
    private options: RateLimiterOptions,
    @Inject('ILogger') private logger: ILogger
  ) {
    this.maxTokens = options.maxBurstSize || options.tokensPerInterval;
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
  }

  async acquire(tokensRequested: number = 1): Promise<boolean> {
    if (tokensRequested > this.maxTokens) {
      this.logger.error(`Rate limiter '${this.name}': Requested ${tokensRequested} tokens exceeds maximum ${this.maxTokens}`, null);
      return false;
    }

    this.refillTokens();

    if (this.tokens >= tokensRequested) {
      this.tokens -= tokensRequested;
      this.requestsAccepted++;
      return true;
    }

    this.requestsRejected++;
    this.logger.debug(`Rate limiter '${this.name}' rejected request`, {
      tokensRequested,
      availableTokens: this.tokens
    });
    
    return false;
  }

  async acquireOrWait(tokensRequested: number = 1, maxWaitMs?: number): Promise<boolean> {
    const startTime = Date.now();
    
    while (true) {
      if (await this.acquire(tokensRequested)) {
        return true;
      }

      const elapsed = Date.now() - startTime;
      if (maxWaitMs && elapsed >= maxWaitMs) {
        return false;
      }

      const waitTime = this.calculateWaitTime(tokensRequested);
      if (maxWaitMs && elapsed + waitTime > maxWaitMs) {
        return false;
      }

      await this.delay(Math.min(waitTime, maxWaitMs ? maxWaitMs - elapsed : waitTime));
    }
  }

  async executeWithRateLimit<T>(
    operation: () => Promise<T>,
    tokensRequired: number = 1
  ): Promise<T> {
    const acquired = await this.acquire(tokensRequired);
    
    if (!acquired) {
      throw new Error(`Rate limit exceeded for '${this.name}'`);
    }

    try {
      return await operation();
    } catch (error) {
      // Optionally refund tokens on error
      this.tokens = Math.min(this.tokens + tokensRequired, this.maxTokens);
      throw error;
    }
  }

  async executeWithWait<T>(
    operation: () => Promise<T>,
    tokensRequired: number = 1,
    maxWaitMs: number = 60000
  ): Promise<T> {
    const acquired = await this.acquireOrWait(tokensRequired, maxWaitMs);
    
    if (!acquired) {
      throw new Error(`Rate limit exceeded for '${this.name}' after waiting ${maxWaitMs}ms`);
    }

    return operation();
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;
    const tokensToAdd = (timePassed / this.options.interval) * this.options.tokensPerInterval;
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.tokens + tokensToAdd, this.maxTokens);
      this.lastRefillTime = now;
    }
  }

  private calculateWaitTime(tokensRequested: number): number {
    this.refillTokens();
    
    if (this.tokens >= tokensRequested) {
      return 0;
    }

    const tokensNeeded = tokensRequested - this.tokens;
    const refillRate = this.options.tokensPerInterval / this.options.interval;
    const waitTime = Math.ceil(tokensNeeded / refillRate);
    
    if (this.options.uniformDistribution) {
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * waitTime;
      return waitTime + jitter;
    }
    
    return waitTime;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  tryAcquire(tokensRequested: number = 1): boolean {
    this.refillTokens();
    
    if (this.tokens >= tokensRequested) {
      this.tokens -= tokensRequested;
      this.requestsAccepted++;
      return true;
    }
    
    this.requestsRejected++;
    return false;
  }

  getStats(): RateLimiterStats {
    this.refillTokens();
    
    const nextRefillTime = new Date(
      this.lastRefillTime + 
      ((this.maxTokens - this.tokens) / this.options.tokensPerInterval) * this.options.interval
    );

    return {
      availableTokens: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      nextRefillTime,
      isLimited: this.tokens < 1,
      requestsAccepted: this.requestsAccepted,
      requestsRejected: this.requestsRejected
    };
  }

  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
    this.requestsAccepted = 0;
    this.requestsRejected = 0;
    // this.queue = [];
  }

  setTokensPerInterval(tokensPerInterval: number): void {
    this.options.tokensPerInterval = tokensPerInterval;
    this.maxTokens = this.options.maxBurstSize || tokensPerInterval;
  }

  setInterval(interval: number): void {
    this.options.interval = interval;
  }
}

@Injectable({ singleton: true })
export class RateLimiterFactory {
  private limiters = new Map<string, RateLimiter>();

  constructor(
    @Inject('ILogger') private logger: ILogger
  ) {}

  create(name: string, options: RateLimiterOptions): RateLimiter {
    if (this.limiters.has(name)) {
      return this.limiters.get(name)!;
    }

    const limiter = new RateLimiter(name, options, this.logger);
    this.limiters.set(name, limiter);
    return limiter;
  }

  get(name: string): RateLimiter | undefined {
    return this.limiters.get(name);
  }

  remove(name: string): boolean {
    return this.limiters.delete(name);
  }

  clear(): void {
    this.limiters.clear();
  }

  getAll(): Map<string, RateLimiter> {
    return new Map(this.limiters);
  }
}