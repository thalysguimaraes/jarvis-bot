import { MiddlewareHandler } from '../routers/DomainRouter';
import { ErrorResponseBuilder, ErrorCode } from '../../errors/ErrorResponse';
import { ILogger } from '../../logging/Logger';
import { z } from 'zod';

/**
 * Validation middleware for request validation using Zod schemas
 */

export interface ValidationSchemas {
  params?: z.ZodSchema;
  query?: z.ZodSchema;
  body?: z.ZodSchema;
  headers?: z.ZodSchema;
}

export class ValidationMiddleware {
  private logger: ILogger;
  
  constructor(logger: ILogger) {
    this.logger = logger.child({ middleware: 'ValidationMiddleware' });
  }
  
  /**
   * Create middleware handler for request validation
   */
  validate(schemas: ValidationSchemas): MiddlewareHandler {
    return async (request, params, context, next) => {
      const path = new URL(request.url).pathname;
      const errors: string[] = [];
      
      try {
        // Validate path parameters
        if (schemas.params) {
          const result = schemas.params.safeParse(params);
          if (!result.success) {
            errors.push(...result.error.issues.map((e: any) => 
              `params.${e.path.join('.')}: ${e.message}`
            ));
          } else {
            // Update params with validated/transformed data
            Object.assign(params, result.data);
          }
        }
        
        // Validate query parameters
        if (schemas.query) {
          const url = new URL(request.url);
          const queryParams = Object.fromEntries(url.searchParams);
          const result = schemas.query.safeParse(queryParams);
          
          if (!result.success) {
            errors.push(...result.error.issues.map((e: any) => 
              `query.${e.path.join('.')}: ${e.message}`
            ));
          } else {
            // Store validated query params in context
            context.metadata.query = result.data;
          }
        }
        
        // Validate request body
        if (schemas.body && request.method !== 'GET' && request.method !== 'HEAD') {
          try {
            const contentType = request.headers.get('Content-Type') || '';
            let body: any;
            
            if (contentType.includes('application/json')) {
              const clonedRequest = request.clone();
              body = await clonedRequest.json();
            } else if (contentType.includes('application/x-www-form-urlencoded')) {
              const clonedRequest = request.clone();
              const text = await clonedRequest.text();
              body = Object.fromEntries(new URLSearchParams(text));
            } else if (contentType.includes('multipart/form-data')) {
              const clonedRequest = request.clone();
              const formData = await clonedRequest.formData();
              const entries: [string, any][] = [];
              formData.forEach((value, key) => entries.push([key, value]));
              body = Object.fromEntries(entries);
            } else {
              errors.push('Unsupported Content-Type for body validation');
            }
            
            if (body !== undefined) {
              const result = schemas.body.safeParse(body);
              
              if (!result.success) {
                errors.push(...result.error.issues.map((e: any) => 
                  `body.${e.path.join('.')}: ${e.message}`
                ));
              } else {
                // Store validated body in context
                context.metadata.body = result.data;
              }
            }
          } catch (error) {
            errors.push(`Failed to parse request body: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        
        // Validate headers
        if (schemas.headers) {
          const headers: Record<string, string> = {};
          request.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value;
          });
          
          const result = schemas.headers.safeParse(headers);
          
          if (!result.success) {
            errors.push(...result.error.issues.map((e: any) => 
              `headers.${e.path.join('.')}: ${e.message}`
            ));
          } else {
            // Store validated headers in context
            context.metadata.headers = result.data;
          }
        }
        
        // If there are validation errors, return error response
        if (errors.length > 0) {
          this.logger.warn('Validation failed', {
            path,
            errors,
            correlationId: context.correlationId,
          });
          
          return ErrorResponseBuilder.create(
            ErrorCode.VALIDATION_ERROR,
            'Request validation failed'
          )
            .withCorrelationId(context.correlationId)
            .withPath(path)
            .withDetails({ errors })
            .toResponse();
        }
        
        // All validations passed, continue to next middleware
        return next();
        
      } catch (error) {
        this.logger.error('Validation middleware error', error as Error, {
          path,
          correlationId: context.correlationId,
        });
        
        return ErrorResponseBuilder.create(
          ErrorCode.INTERNAL_ERROR,
          'Validation processing failed'
        )
          .withCorrelationId(context.correlationId)
          .withPath(path)
          .toResponse();
      }
    };
  }
  
  /**
   * Create middleware for content type validation
   */
  validateContentType(allowedTypes: string[]): MiddlewareHandler {
    return async (request, _params, context, next) => {
      if (request.method === 'GET' || request.method === 'HEAD') {
        return next();
      }
      
      const contentType = request.headers.get('Content-Type') || '';
      const baseType = contentType.split(';')[0].trim().toLowerCase();
      
      if (!allowedTypes.some(type => baseType === type.toLowerCase())) {
        const path = new URL(request.url).pathname;
        
        this.logger.warn('Invalid content type', {
          path,
          contentType,
          allowedTypes,
          correlationId: context.correlationId,
        });
        
        return ErrorResponseBuilder.create(
          ErrorCode.VALIDATION_ERROR,
          `Invalid Content-Type. Expected one of: ${allowedTypes.join(', ')}`
        )
          .withCorrelationId(context.correlationId)
          .withPath(path)
          .toResponse();
      }
      
      return next();
    };
  }
  
  /**
   * Create middleware for request size validation
   */
  validateRequestSize(maxSizeBytes: number): MiddlewareHandler {
    return async (request, _params, context, next) => {
      const contentLength = request.headers.get('Content-Length');
      
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        
        if (size > maxSizeBytes) {
          const path = new URL(request.url).pathname;
          
          this.logger.warn('Request too large', {
            path,
            size,
            maxSizeBytes,
            correlationId: context.correlationId,
          });
          
          return ErrorResponseBuilder.create(
            ErrorCode.VALIDATION_ERROR,
            `Request too large. Maximum size: ${maxSizeBytes} bytes`
          )
            .withCorrelationId(context.correlationId)
            .withPath(path)
            .toResponse();
        }
      }
      
      return next();
    };
  }
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  // Pagination parameters
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('asc'),
  }),
  
  // Date range parameters
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
  
  // ID parameter
  id: z.object({
    id: z.string().uuid(),
  }),
  
  // Search query
  search: z.object({
    q: z.string().min(1).max(200),
  }),
};

/**
 * Factory functions for common validation middleware
 */
export function createValidationMiddleware(
  logger: ILogger,
  schemas: ValidationSchemas
): MiddlewareHandler {
  const validator = new ValidationMiddleware(logger);
  return validator.validate(schemas);
}

export function createContentTypeValidator(
  logger: ILogger,
  allowedTypes: string[]
): MiddlewareHandler {
  const validator = new ValidationMiddleware(logger);
  return validator.validateContentType(allowedTypes);
}

export function createSizeValidator(
  logger: ILogger,
  maxSizeBytes: number
): MiddlewareHandler {
  const validator = new ValidationMiddleware(logger);
  return validator.validateRequestSize(maxSizeBytes);
}