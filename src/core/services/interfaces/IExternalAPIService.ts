/**
 * Base interface for all external API services
 */

export interface RateLimitInfo {
  remaining: number;
  total: number;
  resetAt: Date;
  isLimited: boolean;
}

export interface APIResponse<T = any> {
  data?: T;
  error?: string;
  statusCode: number;
  headers?: Record<string, string>;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface IExternalAPIService {
  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): RateLimitInfo;
  
  /**
   * Check if service is available
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get service health status
   */
  getHealthStatus(): Promise<{
    healthy: boolean;
    latency?: number;
    lastError?: string;
  }>;
  
  /**
   * Configure retry behavior
   */
  setRetryConfig(config: Partial<RetryConfig>): void;
  
  /**
   * Get current retry configuration
   */
  getRetryConfig(): RetryConfig;
}