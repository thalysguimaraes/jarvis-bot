import { MiddlewareHandler, RouteContext } from '../routers/DomainRouter';
import { ErrorResponseBuilder, ErrorCode } from '../../errors/ErrorResponse';
import { ILogger } from '../../logging/Logger';
import { IStorageService } from '../../services/interfaces/IStorageService';

/**
 * Rate limiting middleware for API protection
 */

export interface RateLimitConfig {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Maximum requests per window
  keyGenerator?: (request: Request, context: RouteContext) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  standardHeaders?: boolean;  // Return rate limit info in headers
  legacyHeaders?: boolean;    // Return rate limit info in X-RateLimit-* headers
}

interface RateLimitStore {
  count: number;
  resetTime: number;
}

export class RateLimitMiddleware {
  private logger: ILogger;
  private stores: Map<string, RateLimitStore> = new Map();
  private lastPersist = new Map<string, { time: number; count: number }>();
  private persistenceInterval = 5000; // 5 seconds
  private cleanupInterval: number | null = null;
  
  constructor(
    private storage: IStorageService | null,
    logger: ILogger
  ) {
    this.logger = logger.child({ middleware: 'RateLimitMiddleware' });
    
    // Start cleanup interval
    this.startCleanup();
  }
  
  /**
   * Create rate limit middleware
   */
  limit(config: RateLimitConfig): MiddlewareHandler {
    const {
      windowMs,
      maxRequests,
      keyGenerator = this.defaultKeyGenerator,
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      message = 'Too many requests, please try again later',
      standardHeaders = true,
      legacyHeaders = false,
    } = config;
    
    return async (request, _params, context, next) => {
      const key = keyGenerator(request, context);
      const now = Date.now();
      
      try {
        // Get or create rate limit store
        let store = await this.getStore(key);
        
        if (!store || store.resetTime <= now) {
          // Create new store or reset expired one
          store = {
            count: 0,
            resetTime: now + windowMs,
          };
        }
        
        // Check if limit exceeded
        if (store.count >= maxRequests) {
          const retryAfter = Math.ceil((store.resetTime - now) / 1000);
          
          this.logger.warn('Rate limit exceeded', {
            key,
            count: store.count,
            limit: maxRequests,
            retryAfter,
            correlationId: context.correlationId,
          });
          
          const response = ErrorResponseBuilder.create(
            ErrorCode.RATE_LIMIT_EXCEEDED,
            message
          )
            .withCorrelationId(context.correlationId)
            .withPath(new URL(request.url).pathname)
            .withRetry(true, retryAfter * 1000)
            .toResponse();
          
          // Add rate limit headers
          if (standardHeaders) {
            response.headers.set('RateLimit-Limit', maxRequests.toString());
            response.headers.set('RateLimit-Remaining', '0');
            response.headers.set('RateLimit-Reset', new Date(store.resetTime).toISOString());
          }
          
          if (legacyHeaders) {
            response.headers.set('X-RateLimit-Limit', maxRequests.toString());
            response.headers.set('X-RateLimit-Remaining', '0');
            response.headers.set('X-RateLimit-Reset', store.resetTime.toString());
            response.headers.set('Retry-After', retryAfter.toString());
          }
          
          return response;
        }
        
        // Increment counter
        store.count++;
        await this.setStore(key, store);
        
        // Call next middleware
        const response = await next();
        
        // Optionally skip counting based on response
        if ((response.ok && skipSuccessfulRequests) || 
            (!response.ok && skipFailedRequests)) {
          store.count--;
          await this.setStore(key, store);
        }
        
        // Add rate limit headers to successful responses
        const remaining = Math.max(0, maxRequests - store.count);
        
        if (standardHeaders) {
          response.headers.set('RateLimit-Limit', maxRequests.toString());
          response.headers.set('RateLimit-Remaining', remaining.toString());
          response.headers.set('RateLimit-Reset', new Date(store.resetTime).toISOString());
        }
        
        if (legacyHeaders) {
          response.headers.set('X-RateLimit-Limit', maxRequests.toString());
          response.headers.set('X-RateLimit-Remaining', remaining.toString());
          response.headers.set('X-RateLimit-Reset', store.resetTime.toString());
        }
        
        return response;
        
      } catch (error) {
        this.logger.error('Rate limit middleware error', error as Error, {
          key,
          correlationId: context.correlationId,
        });
        
        // On error, allow the request (fail open)
        return next();
      }
    };
  }
  
  /**
   * Create sliding window rate limiter
   */
  slidingWindow(config: RateLimitConfig): MiddlewareHandler {
    // For simplicity, using fixed window for now
    // TODO: Implement true sliding window with timestamp tracking
    return this.limit(config);
  }
  
  /**
   * Default key generator (by IP address)
   */
  private defaultKeyGenerator(request: Request, _context: RouteContext): string {
    // Try to get client IP from various headers
    const ip = request.headers.get('CF-Connecting-IP') ||  // Cloudflare
               request.headers.get('X-Forwarded-For')?.split(',')[0] ||  // Proxy
               request.headers.get('X-Real-IP') ||  // Nginx
               'unknown';
    
    const path = new URL(request.url).pathname;
    return `ratelimit:${ip}:${path}`;
  }
  
  /**
   * Get rate limit store
   */
  private async getStore(key: string): Promise<RateLimitStore | null> {
    // Try distributed storage first
    if (this.storage) {
      try {
        const data = await this.storage.get<RateLimitStore>('rate_limit', key);
        if (data) return data;
      } catch (error) {
        this.logger.error('Failed to get rate limit from storage', error, { key });
      }
    }
    
    // Fall back to in-memory store
    return this.stores.get(key) || null;
  }
  
  /**
   * Set rate limit store
   */
  private async setStore(key: string, store: RateLimitStore): Promise<void> {
    // Update in-memory store
    this.stores.set(key, store);

    // Try to update distributed storage
    if (this.storage) {
      try {
        const now = Date.now();
        const last = this.lastPersist.get(key) || { time: 0, count: 0 };
        if (
          now - last.time > this.persistenceInterval ||
          store.count - last.count >= 10
        ) {
          const ttl = Math.ceil((store.resetTime - now) / 1000);
          await this.storage.put('rate_limit', key, store, { ttl });
          this.lastPersist.set(key, { time: now, count: store.count });
        }
      } catch (error) {
        this.logger.error('Failed to set rate limit in storage', error, { key });
      }
    }
  }
  
  /**
   * Start cleanup interval for expired stores
   */
  private startCleanup(): void {
    // Clean up every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];
      
      for (const [key, store] of this.stores) {
        if (store.resetTime <= now) {
          expired.push(key);
        }
      }
      
      for (const key of expired) {
        this.stores.delete(key);
      }
      
      if (expired.length > 0) {
        this.logger.debug('Cleaned up expired rate limit stores', { count: expired.length });
      }
    }, 60000) as unknown as number;
  }
  
  /**
   * Stop cleanup interval
   */
  dispose(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.stores.clear();
  }
}

/**
 * Factory functions for common rate limiters
 */
export function createRateLimiter(
  storage: IStorageService | null,
  logger: ILogger,
  config: RateLimitConfig
): MiddlewareHandler {
  const rateLimiter = new RateLimitMiddleware(storage, logger);
  return rateLimiter.limit(config);
}

export function createApiRateLimiter(
  storage: IStorageService | null,
  logger: ILogger
): MiddlewareHandler {
  return createRateLimiter(storage, logger, {
    windowMs: 60 * 1000,     // 1 minute
    maxRequests: 60,          // 60 requests per minute
    standardHeaders: true,
  });
}

export function createWebhookRateLimiter(
  storage: IStorageService | null,
  logger: ILogger
): MiddlewareHandler {
  return createRateLimiter(storage, logger, {
    windowMs: 1000,           // 1 second
    maxRequests: 10,          // 10 requests per second
    standardHeaders: true,
    keyGenerator: (request, _context) => {
      // Rate limit by webhook source
      const source = request.headers.get('X-Webhook-Source') || 
                    request.headers.get('User-Agent') || 
                    'unknown';
      return `webhook:${source}`;
    },
  });
}

export function createStrictRateLimiter(
  storage: IStorageService | null,
  logger: ILogger
): MiddlewareHandler {
  return createRateLimiter(storage, logger, {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100,          // 100 requests per hour
    standardHeaders: true,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  });
}