import { Injectable } from '../../decorators/Injectable';
import { ILogger } from '../../logging/Logger';
import { Inject } from '../../decorators/Inject';
import { EventBus } from '../../event-bus/EventBus';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  volumeThreshold: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  totalRequests: number;
  errorPercentage: number;
}

@Injectable({ singleton: false })
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private requestCounts: { timestamp: number; success: boolean }[] = [];
  
  constructor(
    private name: string,
    private options: CircuitBreakerOptions,
    @Inject('ILogger') private logger: ILogger,
    @Inject('IEventBus') private eventBus?: EventBus
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new Error(`Circuit breaker '${this.name}' is OPEN`);
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
        return true;
      }
      return false;
    }

    return true; // HALF_OPEN state
  }

  private shouldAttemptReset(): boolean {
    return !!this.nextAttemptTime && new Date() >= this.nextAttemptTime;
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.options.timeout}ms`));
      }, this.options.timeout);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = new Date();
    this.recordRequest(true);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.options.successThreshold) {
        this.transitionToClosed();
      }
    }
  }

  private onFailure(error: Error): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();
    this.recordRequest(false);

    this.logger.warn(`Circuit breaker '${this.name}' recorded failure`, {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      error: error.message
    });

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    } else if (this.state === CircuitState.CLOSED) {
      if (this.shouldOpen()) {
        this.transitionToOpen();
      }
    }
  }

  private shouldOpen(): boolean {
    const recentRequests = this.getRecentRequests();
    
    if (recentRequests.length < this.options.volumeThreshold) {
      return false;
    }

    if (this.consecutiveFailures >= this.options.failureThreshold) {
      return true;
    }

    const errorPercentage = this.calculateErrorPercentage(recentRequests);
    return errorPercentage >= this.options.errorThresholdPercentage;
  }

  private recordRequest(success: boolean): void {
    const now = Date.now();
    this.requestCounts.push({ timestamp: now, success });
    
    // Clean old requests (keep only last minute)
    const cutoff = now - 60000;
    this.requestCounts = this.requestCounts.filter(r => r.timestamp > cutoff);
  }

  private getRecentRequests(): { timestamp: number; success: boolean }[] {
    const cutoff = Date.now() - 60000; // Last minute
    return this.requestCounts.filter(r => r.timestamp > cutoff);
  }

  private calculateErrorPercentage(requests: { success: boolean }[]): number {
    if (requests.length === 0) return 0;
    const failures = requests.filter(r => !r.success).length;
    return (failures / requests.length) * 100;
  }

  private transitionToOpen(): void {
    const oldState = this.state;
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.options.resetTimeout);
    
    this.logger.error(`Circuit breaker '${this.name}' opened`, null, {
      oldState,
      failures: this.failures,
      consecutiveFailures: this.consecutiveFailures
    });

    this.emitStateChange(oldState, CircuitState.OPEN);
  }

  private transitionToHalfOpen(): void {
    const oldState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.nextAttemptTime = undefined;
    
    this.logger.info(`Circuit breaker '${this.name}' half-opened`, {
      oldState
    });

    this.emitStateChange(oldState, CircuitState.HALF_OPEN);
  }

  private transitionToClosed(): void {
    const oldState = this.state;
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.nextAttemptTime = undefined;
    
    this.logger.info(`Circuit breaker '${this.name}' closed`, {
      oldState,
      successes: this.successes,
      consecutiveSuccesses: this.consecutiveSuccesses
    });

    this.emitStateChange(oldState, CircuitState.CLOSED);
  }

  private emitStateChange(oldState: CircuitState, newState: CircuitState): void {
    if (this.options.onStateChange) {
      this.options.onStateChange(oldState, newState);
    }

    if (this.eventBus) {
      this.eventBus.publish({ type: 'circuit-breaker:state-change', payload: {
        name: this.name,
        oldState,
        newState,
        stats: this.getStats()
      }, metadata: {} } as any);
    }
  }

  getStats(): CircuitBreakerStats {
    const recentRequests = this.getRecentRequests();
    
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.failures + this.successes,
      errorPercentage: this.calculateErrorPercentage(recentRequests)
    };
  }

  reset(): void {
    this.transitionToClosed();
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.requestCounts = [];
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
  }

  isOpen(): boolean {
    return this.state === CircuitState.OPEN && !this.shouldAttemptReset();
  }

  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }
}