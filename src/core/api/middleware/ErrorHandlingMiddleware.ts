import { MiddlewareHandler, RouteContext } from '../routers/DomainRouter';
import { ErrorResponseBuilder, ErrorCode } from '../../errors/ErrorResponse';
import { AppError } from '../../logging/ErrorHandler';
import { ILogger } from '../../logging/Logger';
import { 
  AudioProcessingError,
  TaskManagementError,
  NoteSyncError,
  PortfolioError,
  FundManagementError,
  MessagingError,
  StorageError,
  ConfigurationError
} from '../../errors/DomainErrors';

/**
 * Error handling middleware for consistent error responses
 */

export interface ErrorHandlingConfig {
  includeStackTrace?: boolean;
  logErrors?: boolean;
  notifyOnCritical?: boolean;
  customErrorHandler?: (error: Error, context: RouteContext) => Response | null;
}

export class ErrorHandlingMiddleware {
  private logger: ILogger;
  
  constructor(
    logger: ILogger,
    private config: ErrorHandlingConfig = {}
  ) {
    this.logger = logger.child({ middleware: 'ErrorHandlingMiddleware' });
  }
  
  /**
   * Create error handling middleware
   */
  handle(): MiddlewareHandler {
    return async (request, _params, context, next) => {
      const path = new URL(request.url).pathname;
      
      try {
        // Call next middleware/handler
        const response = await next();
        
        // Check if response indicates an error
        if (!response.ok && response.status >= 500) {
          // Log server errors
          if (this.config.logErrors !== false) {
            this.logger.error('Server error response', new Error(`Status ${response.status}`), {
              path,
              status: response.status,
              correlationId: context.correlationId,
            });
          }
        }
        
        return response;
        
      } catch (error) {
        // Handle thrown errors
        return this.handleError(error as Error, path, context);
      }
    };
  }
  
  /**
   * Handle specific error types
   */
  private handleError(error: Error, path: string, context: RouteContext): Response {
    // Allow custom error handler
    if (this.config.customErrorHandler) {
      const customResponse = this.config.customErrorHandler(error, context);
      if (customResponse) return customResponse;
    }
    
    // Log the error
    if (this.config.logErrors !== false) {
      const logLevel = this.getErrorLogLevel(error);
      const logMethod = this.logger[logLevel].bind(this.logger);
      
      logMethod('Request error', {
        path,
        correlationId: context.correlationId,
        errorType: error.constructor.name,
        error: error.message,
        stack: error.stack
      });
    }
    
    // Handle domain-specific errors
    if (error instanceof AudioProcessingError) {
      return this.handleAudioError(error, path, context);
    }
    
    if (error instanceof TaskManagementError) {
      return this.handleTaskError(error, path, context);
    }
    
    if (error instanceof NoteSyncError) {
      return this.handleNoteSyncError(error, path, context);
    }
    
    if (error instanceof PortfolioError) {
      return this.handlePortfolioError(error, path, context);
    }
    
    if (error instanceof FundManagementError) {
      return this.handleFundError(error, path, context);
    }
    
    if (error instanceof MessagingError) {
      return this.handleMessagingError(error, path, context);
    }
    
    if (error instanceof StorageError) {
      return this.handleStorageError(error, path, context);
    }
    
    if (error instanceof ConfigurationError) {
      return this.handleConfigError(error, path, context);
    }
    
    // Handle generic AppError
    if (error instanceof AppError) {
      return this.handleAppError(error, path, context);
    }
    
    // Handle unknown errors
    return this.handleUnknownError(error, path, context);
  }
  
  /**
   * Handle audio processing errors
   */
  private handleAudioError(error: AudioProcessingError, path: string, context: RouteContext): Response {
    const code = error.stage === 'upload' 
      ? ErrorCode.INVALID_FORMAT 
      : ErrorCode.SERVICE_UNAVAILABLE;
    
    return ErrorResponseBuilder.create(code, error.message)
      .withCorrelationId(context.correlationId)
      .withPath(path)
      .withDetails({
        stage: error.stage,
        context: error.context,
      })
      .withRetry(error.retryable)
      .toResponse();
  }
  
  /**
   * Handle task management errors
   */
  private handleTaskError(error: TaskManagementError, path: string, context: RouteContext): Response {
    const code = error.operation === 'sync' 
      ? ErrorCode.SERVICE_UNAVAILABLE 
      : ErrorCode.OPERATION_FAILED;
    
    return ErrorResponseBuilder.create(code, error.message)
      .withCorrelationId(context.correlationId)
      .withPath(path)
      .withDetails({
        operation: error.operation,
        context: error.context,
      })
      .withRetry(error.retryable)
      .toResponse();
  }
  
  /**
   * Handle note sync errors
   */
  private handleNoteSyncError(error: NoteSyncError, path: string, context: RouteContext): Response {
    return ErrorResponseBuilder.create(ErrorCode.SERVICE_UNAVAILABLE, error.message)
      .withCorrelationId(context.correlationId)
      .withPath(path)
      .withDetails({
        destination: error.destination,
        context: error.context,
      })
      .withRetry(true)
      .toResponse();
  }
  
  /**
   * Handle portfolio errors
   */
  private handlePortfolioError(error: PortfolioError, path: string, context: RouteContext): Response {
    const code = error.component === 'api' 
      ? ErrorCode.SERVICE_UNAVAILABLE 
      : ErrorCode.OPERATION_FAILED;
    
    return ErrorResponseBuilder.create(code, error.message)
      .withCorrelationId(context.correlationId)
      .withPath(path)
      .withDetails({
        component: error.component,
        context: error.context,
      })
      .withRetry(error.retryable)
      .toResponse();
  }
  
  /**
   * Handle fund management errors
   */
  private handleFundError(error: FundManagementError, path: string, context: RouteContext): Response {
    const code = error.operation === 'fetch' 
      ? ErrorCode.SERVICE_UNAVAILABLE 
      : ErrorCode.OPERATION_FAILED;
    
    return ErrorResponseBuilder.create(code, error.message)
      .withCorrelationId(context.correlationId)
      .withPath(path)
      .withDetails({
        operation: error.operation,
        context: error.context,
      })
      .withRetry(error.retryable)
      .toResponse();
  }
  
  /**
   * Handle messaging errors
   */
  private handleMessagingError(error: MessagingError, path: string, context: RouteContext): Response {
    return ErrorResponseBuilder.create(ErrorCode.SERVICE_UNAVAILABLE, error.message)
      .withCorrelationId(context.correlationId)
      .withPath(path)
      .withDetails({
        service: error.service,
        operation: error.operation,
        context: error.context,
      })
      .withRetry(error.retryable)
      .toResponse();
  }
  
  /**
   * Handle storage errors
   */
  private handleStorageError(error: StorageError, path: string, context: RouteContext): Response {
    return ErrorResponseBuilder.create(ErrorCode.INTERNAL_ERROR, error.message)
      .withCorrelationId(context.correlationId)
      .withPath(path)
      .withDetails({
        operation: error.operation,
        storage: error.storage,
        context: error.context,
      })
      .withRetry(error.retryable)
      .toResponse();
  }
  
  /**
   * Handle configuration errors
   */
  private handleConfigError(error: ConfigurationError, path: string, context: RouteContext): Response {
    return ErrorResponseBuilder.create(ErrorCode.CONFIGURATION_ERROR, error.message)
      .withCorrelationId(context.correlationId)
      .withPath(path)
      .withDetails({
        configKey: error.configKey,
        context: error.context,
      })
      .toResponse();
  }
  
  /**
   * Handle generic AppError
   */
  private handleAppError(error: AppError, path: string, context: RouteContext): Response {
    const code = error.code as ErrorCode || ErrorCode.INTERNAL_ERROR;
    
    return ErrorResponseBuilder.create(code, error.message)
      .withCorrelationId(context.correlationId)
      .withPath(path)
      .withDetails(error.context || {})
      .withRetry(error.retryable)
      .toResponse();
  }
  
  /**
   * Handle unknown errors
   */
  private handleUnknownError(error: Error, path: string, context: RouteContext): Response {
    const builder = ErrorResponseBuilder.create(
      ErrorCode.INTERNAL_ERROR,
      this.config.includeStackTrace ? error.message : 'An unexpected error occurred'
    )
      .withCorrelationId(context.correlationId)
      .withPath(path);
    
    if (this.config.includeStackTrace && error.stack) {
      builder.withDetails({ stack: error.stack });
    }
    
    return builder.toResponse();
  }
  
  /**
   * Determine log level based on error type
   */
  private getErrorLogLevel(error: Error): 'error' | 'warn' | 'info' {
    // Configuration errors are critical
    if (error instanceof ConfigurationError) return 'error';
    
    // Non-operational errors are errors
    if (error instanceof AppError && !error.isOperational) return 'error';
    
    // External service errors are warnings
    if (error instanceof MessagingError || 
        error instanceof NoteSyncError ||
        (error instanceof PortfolioError && error.component === 'api') ||
        (error instanceof FundManagementError && error.operation === 'fetch')) {
      return 'warn';
    }
    
    // Everything else is an error
    return 'error';
  }
}

/**
 * Factory function for error handling middleware
 */
export function createErrorHandler(
  logger: ILogger,
  config?: ErrorHandlingConfig
): MiddlewareHandler {
  const handler = new ErrorHandlingMiddleware(logger, config);
  return handler.handle();
}

/**
 * Development error handler with stack traces
 */
export function createDevErrorHandler(logger: ILogger): MiddlewareHandler {
  return createErrorHandler(logger, {
    includeStackTrace: true,
    logErrors: true,
  });
}

/**
 * Production error handler without sensitive information
 */
export function createProdErrorHandler(logger: ILogger): MiddlewareHandler {
  return createErrorHandler(logger, {
    includeStackTrace: false,
    logErrors: true,
    notifyOnCritical: true,
  });
}