import { ILogger } from './Logger';

/**
 * Centralized error handling service
 */

export interface ErrorContext {
  module?: string;
  operation?: string;
  userId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface IErrorHandler {
  handle(error: Error | unknown, context?: ErrorContext): void;
  handleAsync(error: Error | unknown, context?: ErrorContext): Promise<void>;
  createError(message: string, code?: string, context?: ErrorContext): AppError;
  isOperational(error: Error): boolean;
  shouldRetry(error: Error): boolean;
}

export class AppError extends Error {
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly context?: ErrorContext;
  public readonly timestamp: Date;
  public retryable: boolean;
  
  constructor(
    message: string,
    code?: string,
    isOperational = true,
    context?: ErrorContext,
    retryable = false
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date();
    this.retryable = retryable;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'VALIDATION_ERROR', true, context, false);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, context?: ErrorContext) {
    super(`${resource} not found`, 'NOT_FOUND', true, context, false);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'RATE_LIMIT', true, context, true);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, context?: ErrorContext) {
    super(`External service error (${service}): ${message}`, 'EXTERNAL_SERVICE', true, context, true);
    this.name = 'ExternalServiceError';
  }
}

export class ErrorHandler implements IErrorHandler {
  private errorCallbacks: Array<(error: Error, context?: ErrorContext) => void> = [];
  
  constructor(private logger: ILogger) {}
  
  handle(error: Error | unknown, context?: ErrorContext): void {
    const normalizedError = this.normalizeError(error);
    const errorContext = this.enrichContext(normalizedError, context);
    
    // Log the error
    if (this.isOperational(normalizedError)) {
      this.logger.warn(`Operational error: ${normalizedError.message}`, {
        error: normalizedError.name,
        code: (normalizedError as AppError).code,
        ...errorContext,
      });
    } else {
      this.logger.error(`System error: ${normalizedError.message}`, normalizedError, errorContext);
    }
    
    // Execute callbacks
    this.errorCallbacks.forEach(callback => {
      try {
        callback(normalizedError, errorContext);
      } catch (cbError) {
        this.logger.error('Error in error callback', cbError);
      }
    });
    
    // Re-throw non-operational errors
    if (!this.isOperational(normalizedError)) {
      throw normalizedError;
    }
  }
  
  async handleAsync(error: Error | unknown, context?: ErrorContext): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.handle(error, context);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
  
  createError(message: string, code?: string, context?: ErrorContext): AppError {
    return new AppError(message, code, true, context);
  }
  
  isOperational(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    
    // Check for known operational error patterns
    const operationalPatterns = [
      /validation/i,
      /not found/i,
      /unauthorized/i,
      /forbidden/i,
      /bad request/i,
      /conflict/i,
      /rate limit/i,
    ];
    
    return operationalPatterns.some(pattern => pattern.test(error.message));
  }
  
  shouldRetry(error: Error): boolean {
    if (error instanceof AppError) {
      return error.retryable;
    }
    
    // Check for known retryable error patterns
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /ECONNREFUSED/i,
      /ENOTFOUND/i,
      /ETIMEDOUT/i,
      /rate limit/i,
      /too many requests/i,
      /service unavailable/i,
      /gateway timeout/i,
    ];
    
    return retryablePatterns.some(pattern => pattern.test(error.message));
  }
  
  onError(callback: (error: Error, context?: ErrorContext) => void): void {
    this.errorCallbacks.push(callback);
  }
  
  private normalizeError(error: Error | unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    
    if (typeof error === 'string') {
      return new Error(error);
    }
    
    if (typeof error === 'object' && error !== null) {
      const message = (error as any).message || JSON.stringify(error);
      const err = new Error(message);
      err.name = (error as any).name || 'UnknownError';
      return err;
    }
    
    return new Error(String(error));
  }
  
  private enrichContext(error: Error, context?: ErrorContext): ErrorContext {
    const enriched: ErrorContext = {
      ...context,
      timestamp: new Date().toISOString(),
    };
    
    // Add error-specific context
    if (error instanceof AppError && error.context) {
      Object.assign(enriched, error.context);
    }
    
    // Add stack trace summary
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(1, 4);
      enriched.stackSummary = stackLines.map(line => line.trim()).join(' | ');
    }
    
    return enriched;
  }
}

/**
 * Global error handling utilities
 */
export function wrapAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler: IErrorHandler,
  context?: ErrorContext
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      errorHandler.handle(error, context);
      throw error;
    }
  }) as T;
}

export function createErrorBoundary(
  errorHandler: IErrorHandler,
  fallback?: (error: Error) => any
) {
  return <T extends (...args: any[]) => any>(fn: T): T => {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args);
        
        // Handle async functions
        if (result instanceof Promise) {
          return result.catch((error: Error) => {
            errorHandler.handle(error);
            if (fallback) {
              return fallback(error);
            }
            throw error;
          });
        }
        
        return result;
      } catch (error) {
        errorHandler.handle(error);
        if (fallback) {
          return fallback(error as Error);
        }
        throw error;
      }
    }) as T;
  };
}