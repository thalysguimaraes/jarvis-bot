import { z } from 'zod';

/**
 * Unified error response format for consistent error handling across the application
 */

// ============================================================================
// Error Codes
// ============================================================================

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  INTERNAL = 'INTERNAL',
  CONFIGURATION = 'CONFIGURATION',
  TIMEOUT = 'TIMEOUT',
}

export enum ErrorCode {
  // Validation errors (400)
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  INVALID_FORMAT = 'INVALID_FORMAT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // Authentication errors (401)
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Authorization errors (403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Not found errors (404)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  
  // Conflict errors (409)
  RESOURCE_EXISTS = 'RESOURCE_EXISTS',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  
  // Rate limit errors (429)
  RATE_LIMITED = 'RATE_LIMITED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // External service errors (502, 503)
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  
  // Internal errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',
  
  // Timeout errors (408, 504)
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  PROCESSING_TIMEOUT = 'PROCESSING_TIMEOUT',
}

// ============================================================================
// Error Response Structure
// ============================================================================

export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ErrorResponse {
  error: true;
  code: ErrorCode;
  category: ErrorCategory;
  message: string;
  details?: ErrorDetail[];
  timestamp: string;
  correlationId?: string;
  path?: string;
  retryable?: boolean;
  retryAfter?: number; // Seconds to wait before retry
  documentation?: string;
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
  correlationId?: string;
}

// ============================================================================
// Error Response Schema (for validation)
// ============================================================================

export const ErrorDetailSchema = z.object({
  field: z.string().optional(),
  message: z.string(),
  code: z.string().optional(),
});

export const ErrorResponseSchema = z.object({
  error: z.literal(true),
  code: z.nativeEnum(ErrorCode),
  category: z.nativeEnum(ErrorCategory),
  message: z.string(),
  details: z.array(ErrorDetailSchema).optional(),
  timestamp: z.string(),
  correlationId: z.string().optional(),
  path: z.string().optional(),
  retryable: z.boolean().optional(),
  retryAfter: z.number().optional(),
  documentation: z.string().optional(),
});

// ============================================================================
// Error Response Builder
// ============================================================================

export class ErrorResponseBuilder {
  private response: Partial<ErrorResponse> = {
    error: true,
    timestamp: new Date().toISOString(),
  };
  
  constructor(code: ErrorCode, message: string) {
    this.response.code = code;
    this.response.message = message;
    this.response.category = this.inferCategory(code);
  }
  
  static create(code: ErrorCode, message: string): ErrorResponseBuilder {
    return new ErrorResponseBuilder(code, message);
  }
  
  withCategory(category: ErrorCategory): this {
    this.response.category = category;
    return this;
  }
  
  withDetails(details: ErrorDetail[] | Record<string, any>): this {
    if (Array.isArray(details)) {
      this.response.details = details;
    } else {
      // Convert object to ErrorDetail array
      this.response.details = Object.entries(details).map(([field, value]) => ({
        field,
        message: String(value),
      }));
    }
    return this;
  }
  
  withDetail(field: string, message: string, code?: string): this {
    if (!this.response.details) {
      this.response.details = [];
    }
    this.response.details.push({ field, message, code });
    return this;
  }
  
  withCorrelationId(correlationId: string): this {
    this.response.correlationId = correlationId;
    return this;
  }
  
  withPath(path: string): this {
    this.response.path = path;
    return this;
  }
  
  withRetry(retryable: boolean, retryAfter?: number): this {
    this.response.retryable = retryable;
    if (retryAfter !== undefined) {
      this.response.retryAfter = retryAfter;
    }
    return this;
  }
  
  withDocumentation(url: string): this {
    this.response.documentation = url;
    return this;
  }
  
  build(): ErrorResponse {
    return this.response as ErrorResponse;
  }
  
  toJSON(): string {
    return JSON.stringify(this.build());
  }
  
  toResponse(status?: number): Response {
    const statusCode = status || this.inferStatusCode(this.response.code!);
    
    return new Response(this.toJSON(), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...(this.response.retryAfter && {
          'Retry-After': this.response.retryAfter.toString(),
        }),
      },
    });
  }
  
  private inferCategory(code: ErrorCode): ErrorCategory {
    const categoryMap: Record<ErrorCode, ErrorCategory> = {
      [ErrorCode.INVALID_REQUEST]: ErrorCategory.VALIDATION,
      [ErrorCode.MISSING_PARAMETER]: ErrorCategory.VALIDATION,
      [ErrorCode.INVALID_PARAMETER]: ErrorCategory.VALIDATION,
      [ErrorCode.INVALID_FORMAT]: ErrorCategory.VALIDATION,
      [ErrorCode.VALIDATION_ERROR]: ErrorCategory.VALIDATION,
      
      [ErrorCode.UNAUTHENTICATED]: ErrorCategory.AUTHENTICATION,
      [ErrorCode.INVALID_TOKEN]: ErrorCategory.AUTHENTICATION,
      [ErrorCode.TOKEN_EXPIRED]: ErrorCategory.AUTHENTICATION,
      
      [ErrorCode.UNAUTHORIZED]: ErrorCategory.AUTHORIZATION,
      [ErrorCode.INSUFFICIENT_PERMISSIONS]: ErrorCategory.AUTHORIZATION,
      
      [ErrorCode.RESOURCE_NOT_FOUND]: ErrorCategory.NOT_FOUND,
      [ErrorCode.ENDPOINT_NOT_FOUND]: ErrorCategory.NOT_FOUND,
      
      [ErrorCode.RESOURCE_EXISTS]: ErrorCategory.CONFLICT,
      [ErrorCode.CONCURRENT_MODIFICATION]: ErrorCategory.CONFLICT,
      
      [ErrorCode.RATE_LIMITED]: ErrorCategory.RATE_LIMIT,
      [ErrorCode.RATE_LIMIT_EXCEEDED]: ErrorCategory.RATE_LIMIT,
      [ErrorCode.QUOTA_EXCEEDED]: ErrorCategory.RATE_LIMIT,
      
      [ErrorCode.EXTERNAL_SERVICE_ERROR]: ErrorCategory.EXTERNAL_SERVICE,
      [ErrorCode.SERVICE_UNAVAILABLE]: ErrorCategory.EXTERNAL_SERVICE,
      [ErrorCode.GATEWAY_TIMEOUT]: ErrorCategory.EXTERNAL_SERVICE,
      
      [ErrorCode.INTERNAL_ERROR]: ErrorCategory.INTERNAL,
      [ErrorCode.DATABASE_ERROR]: ErrorCategory.INTERNAL,
      [ErrorCode.CONFIGURATION_ERROR]: ErrorCategory.CONFIGURATION,
      [ErrorCode.OPERATION_FAILED]: ErrorCategory.INTERNAL,
      
      [ErrorCode.REQUEST_TIMEOUT]: ErrorCategory.TIMEOUT,
      [ErrorCode.PROCESSING_TIMEOUT]: ErrorCategory.TIMEOUT,
    };
    
    return categoryMap[code] || ErrorCategory.INTERNAL;
  }
  
  private inferStatusCode(code: ErrorCode): number {
    const statusMap: Record<ErrorCode, number> = {
      [ErrorCode.INVALID_REQUEST]: 400,
      [ErrorCode.MISSING_PARAMETER]: 400,
      [ErrorCode.INVALID_PARAMETER]: 400,
      [ErrorCode.INVALID_FORMAT]: 400,
      [ErrorCode.VALIDATION_ERROR]: 400,
      
      [ErrorCode.UNAUTHENTICATED]: 401,
      [ErrorCode.INVALID_TOKEN]: 401,
      [ErrorCode.TOKEN_EXPIRED]: 401,
      
      [ErrorCode.UNAUTHORIZED]: 403,
      [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
      
      [ErrorCode.RESOURCE_NOT_FOUND]: 404,
      [ErrorCode.ENDPOINT_NOT_FOUND]: 404,
      
      [ErrorCode.REQUEST_TIMEOUT]: 408,
      
      [ErrorCode.RESOURCE_EXISTS]: 409,
      [ErrorCode.CONCURRENT_MODIFICATION]: 409,
      
      [ErrorCode.RATE_LIMITED]: 429,
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
      [ErrorCode.QUOTA_EXCEEDED]: 429,
      
      [ErrorCode.INTERNAL_ERROR]: 500,
      [ErrorCode.DATABASE_ERROR]: 500,
      [ErrorCode.CONFIGURATION_ERROR]: 500,
      [ErrorCode.OPERATION_FAILED]: 500,
      
      [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
      [ErrorCode.SERVICE_UNAVAILABLE]: 503,
      
      [ErrorCode.GATEWAY_TIMEOUT]: 504,
      [ErrorCode.PROCESSING_TIMEOUT]: 504,
    };
    
    return statusMap[code] || 500;
  }
}

// ============================================================================
// Success Response Builder
// ============================================================================

export class SuccessResponseBuilder<T = any> {
  private response: Partial<SuccessResponse<T>> = {
    success: true,
    timestamp: new Date().toISOString(),
  };
  
  constructor(data: T) {
    this.response.data = data;
  }
  
  static create<T>(data: T): SuccessResponseBuilder<T> {
    return new SuccessResponseBuilder(data);
  }
  
  withCorrelationId(correlationId: string): this {
    this.response.correlationId = correlationId;
    return this;
  }
  
  build(): SuccessResponse<T> {
    return this.response as SuccessResponse<T>;
  }
  
  toJSON(): string {
    return JSON.stringify(this.build());
  }
  
  toResponse(status: number = 200): Response {
    return new Response(this.toJSON(), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

// ============================================================================
// Common Error Factories
// ============================================================================

export class CommonErrors {
  static validationError(message: string, details?: ErrorDetail[]): ErrorResponse {
    return ErrorResponseBuilder.create(ErrorCode.INVALID_REQUEST, message)
      .withDetails(details || [])
      .build();
  }
  
  static notFound(resource: string): ErrorResponse {
    return ErrorResponseBuilder.create(
      ErrorCode.RESOURCE_NOT_FOUND,
      `${resource} not found`
    ).build();
  }
  
  static unauthorized(message: string = 'Unauthorized access'): ErrorResponse {
    return ErrorResponseBuilder.create(ErrorCode.UNAUTHORIZED, message).build();
  }
  
  static rateLimited(retryAfter: number): ErrorResponse {
    return ErrorResponseBuilder.create(
      ErrorCode.RATE_LIMITED,
      'Too many requests'
    )
      .withRetry(true, retryAfter)
      .build();
  }
  
  static internalError(message: string = 'Internal server error'): ErrorResponse {
    return ErrorResponseBuilder.create(ErrorCode.INTERNAL_ERROR, message)
      .withRetry(true)
      .build();
  }
  
  static externalServiceError(service: string, message: string): ErrorResponse {
    return ErrorResponseBuilder.create(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `External service error (${service}): ${message}`
    )
      .withRetry(true, 30)
      .build();
  }
  
  static timeout(message: string = 'Request timeout'): ErrorResponse {
    return ErrorResponseBuilder.create(ErrorCode.REQUEST_TIMEOUT, message)
      .withRetry(true, 5)
      .build();
  }
  
  static configurationError(message: string): ErrorResponse {
    return ErrorResponseBuilder.create(ErrorCode.CONFIGURATION_ERROR, message)
      .withRetry(false)
      .build();
  }
}