import { Injectable } from '../../decorators/Injectable';
import { ILogger } from '../../logging/Logger';
import { Inject } from '../../decorators/Inject';

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  shouldRetry?: (error: any, attempt: number) => boolean;
  onRetry?: (error: any, attempt: number, nextDelayMs: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
}

@Injectable({ singleton: true })
export class RetryHandler {
  constructor(
    @Inject('ILogger') private logger: ILogger
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
    context?: string
  ): Promise<RetryResult<T>> {
    const {
      maxAttempts,
      initialDelayMs,
      maxDelayMs,
      backoffMultiplier,
      shouldRetry = this.defaultShouldRetry,
      onRetry
    } = options;

    let lastError: Error | undefined;
    let totalDelayMs = 0;
    let attempts = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      
      try {
        const value = await operation();
        
        if (attempt > 1) {
          this.logger.info('Retry succeeded', {
            context,
            attempt,
            totalDelayMs
          });
        }
        
        return {
          success: true,
          value,
          attempts,
          totalDelayMs
        };
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
          this.logger.error('Retry failed', lastError, {
            context,
            attempt,
            maxAttempts,
            totalDelayMs
          });
          
          return {
            success: false,
            error: lastError,
            attempts,
            totalDelayMs
          };
        }
        
        const delayMs = Math.min(
          initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
          maxDelayMs
        );
        
        totalDelayMs += delayMs;
        
        this.logger.warn('Operation failed, retrying', {
          context,
          attempt,
          maxAttempts,
          nextDelayMs: delayMs,
          error: lastError.message
        });
        
        if (onRetry) {
          onRetry(lastError, attempt, delayMs);
        }
        
        await this.delay(delayMs);
      }
    }
    
    return {
      success: false,
      error: lastError || new Error('Retry failed with unknown error'),
      attempts,
      totalDelayMs
    };
  }

  async executeWithJitter<T>(
    operation: () => Promise<T>,
    options: RetryOptions,
    context?: string
  ): Promise<RetryResult<T>> {
    const jitteredOptions = {
      ...options,
      initialDelayMs: this.addJitter(options.initialDelayMs),
      maxDelayMs: this.addJitter(options.maxDelayMs)
    };
    
    return this.execute(operation, jitteredOptions, context);
  }

  private defaultShouldRetry(error: any, _attempt: number): boolean {
    // Retry on network errors
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET') {
      return true;
    }
    
    // Retry on specific HTTP status codes
    if (error.status === 429 || // Rate limited
        error.status === 502 || // Bad gateway
        error.status === 503 || // Service unavailable
        error.status === 504) { // Gateway timeout
      return true;
    }
    
    // Don't retry on client errors (4xx except 429)
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
      return false;
    }
    
    // Retry on other errors by default
    return true;
  }

  private addJitter(delayMs: number): number {
    // Add ±20% jitter to avoid thundering herd
    const jitter = 0.2;
    const min = delayMs * (1 - jitter);
    const max = delayMs * (1 + jitter);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  createRetryable<T>(
    operation: () => Promise<T>,
    defaultOptions: RetryOptions
  ): () => Promise<T> {
    return async () => {
      const result = await this.execute(operation, defaultOptions);
      if (!result.success) {
        throw result.error;
      }
      return result.value!;
    };
  }
}