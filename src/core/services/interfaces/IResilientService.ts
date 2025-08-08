import { IExternalAPIService } from './IExternalAPIService';
import { IHealthCheckable } from './IHealthCheckable';
import { CircuitBreakerStats } from '../resilience/CircuitBreaker';
import { RateLimiterStats } from '../resilience/RateLimiter';
import { RetryOptions } from '../resilience/RetryHandler';

export interface ResilienceMetrics {
  circuitBreaker?: CircuitBreakerStats;
  rateLimiter?: RateLimiterStats;
  retryPolicy?: RetryOptions;
  lastError?: {
    message: string;
    timestamp: Date;
    attempts: number;
  };
  successRate: number;
  averageResponseTime: number;
}

export interface IResilientService extends IExternalAPIService, IHealthCheckable {
  /**
   * Get resilience metrics for the service
   */
  getResilienceMetrics(): ResilienceMetrics;
  
  /**
   * Reset circuit breaker if in use
   */
  resetCircuitBreaker?(): void;
  
  /**
   * Manually open circuit breaker (for testing/maintenance)
   */
  tripCircuitBreaker?(): void;
  
  /**
   * Update rate limiting configuration
   */
  updateRateLimits?(tokensPerInterval: number, interval: number): void;
  
  /**
   * Enable/disable resilience features
   */
  setResilienceEnabled(enabled: boolean): void;
  
  /**
   * Check if resilience is currently active
   */
  isResilienceEnabled(): boolean;
}