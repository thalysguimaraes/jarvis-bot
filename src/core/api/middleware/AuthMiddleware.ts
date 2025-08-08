import { MiddlewareHandler } from '../routers/DomainRouter';
import { IConfigService } from '../../config/ConfigService';
import { ErrorResponseBuilder, ErrorCode } from '../../errors/ErrorResponse';
import { ILogger } from '../../logging/Logger';
import crypto from 'crypto';

/**
 * Authentication middleware for webhook and API endpoints
 */

export interface AuthConfig {
  webhookSecret?: string;
  apiKeys?: string[];
  zapiClientToken?: string;
  skipPaths?: string[];
  requireAuth?: boolean;
}

export class AuthMiddleware {
  private config: AuthConfig;
  private logger: ILogger;
  
  constructor(
    configService: IConfigService,
    logger: ILogger
  ) {
    this.logger = logger.child({ middleware: 'AuthMiddleware' });
    
    // Load auth configuration
    this.config = {
      webhookSecret: configService.get<string>('services.webhook.secret'),
      apiKeys: configService.get<string[]>('auth.apiKeys') || [],
      zapiClientToken: configService.get<string>('services.zapi.clientToken'),
      skipPaths: configService.get<string[]>('auth.skipPaths') || ['/health', '/status', '/api'],
      requireAuth: configService.get<boolean>('auth.requireAuth') ?? true,
    };
  }
  
  /**
   * Create middleware handler for webhook authentication
   */
  webhookAuth(): MiddlewareHandler {
    return async (request, _params, context, next) => {
      const path = new URL(request.url).pathname;
      
      // Skip auth for allowed paths
      if (this.config.skipPaths?.includes(path)) {
        return next();
      }
      
      // Check for Z-API webhook authentication
      const clientToken = request.headers.get('Client-Token');
      const securityToken = request.headers.get('Security-Token');
      
      if (clientToken || securityToken) {
        const providedToken = clientToken || securityToken;
        
        if (providedToken === this.config.zapiClientToken) {
          context.metadata.authType = 'zapi-webhook';
          context.metadata.authenticated = true;
          return next();
        }
        
        this.logger.warn('Invalid Z-API webhook token', {
          path,
          correlationId: context.correlationId,
        });
        
        return ErrorResponseBuilder.create(
          ErrorCode.INVALID_TOKEN,
          'Invalid webhook authentication token'
        )
          .withCorrelationId(context.correlationId)
          .withPath(path)
          .toResponse();
      }
      
      // Check for webhook signature (if configured)
      if (this.config.webhookSecret && request.method === 'POST') {
        const signature = request.headers.get('X-Webhook-Signature');
        
        if (signature) {
          const isValid = await this.verifyWebhookSignature(
            request,
            signature,
            this.config.webhookSecret
          );
          
          if (isValid) {
            context.metadata.authType = 'webhook-signature';
            context.metadata.authenticated = true;
            return next();
          }
          
          this.logger.warn('Invalid webhook signature', {
            path,
            correlationId: context.correlationId,
          });
          
          return ErrorResponseBuilder.create(
            ErrorCode.INVALID_TOKEN,
            'Invalid webhook signature'
          )
            .withCorrelationId(context.correlationId)
            .withPath(path)
            .toResponse();
        }
      }
      
      // If auth is not required globally, allow the request
      if (!this.config.requireAuth) {
        context.metadata.authenticated = false;
        return next();
      }
      
      // No valid authentication found
      return ErrorResponseBuilder.create(
        ErrorCode.UNAUTHENTICATED,
        'Authentication required'
      )
        .withCorrelationId(context.correlationId)
        .withPath(path)
        .toResponse();
    };
  }
  
  /**
   * Create middleware handler for API key authentication
   */
  apiKeyAuth(): MiddlewareHandler {
    return async (request, _params, context, next) => {
      const path = new URL(request.url).pathname;
      
      // Skip auth for allowed paths
      if (this.config.skipPaths?.includes(path)) {
        return next();
      }
      
      // Check for API key in headers
      const apiKey = request.headers.get('X-API-Key') || 
                     request.headers.get('Authorization')?.replace('Bearer ', '');
      
      if (apiKey && this.config.apiKeys?.includes(apiKey)) {
        context.metadata.authType = 'api-key';
        context.metadata.authenticated = true;
        context.userId = this.hashApiKey(apiKey); // Use hashed API key as user ID
        return next();
      }
      
      // Check if already authenticated by another middleware
      if (context.metadata.authenticated) {
        return next();
      }
      
      // If auth is not required, allow the request
      if (!this.config.requireAuth) {
        context.metadata.authenticated = false;
        return next();
      }
      
      // No valid API key found
      return ErrorResponseBuilder.create(
        ErrorCode.INVALID_TOKEN,
        'Invalid or missing API key'
      )
        .withCorrelationId(context.correlationId)
        .withPath(path)
        .toResponse();
    };
  }
  
  /**
   * Create middleware handler for optional authentication
   * Sets authentication status but doesn't block requests
   */
  optionalAuth(): MiddlewareHandler {
    return async (request, _params, context, next) => {
      // Try webhook auth
      const clientToken = request.headers.get('Client-Token');
      const securityToken = request.headers.get('Security-Token');
      
      if ((clientToken || securityToken) && 
          (clientToken === this.config.zapiClientToken || 
           securityToken === this.config.zapiClientToken)) {
        context.metadata.authType = 'zapi-webhook';
        context.metadata.authenticated = true;
        return next();
      }
      
      // Try API key auth
      const apiKey = request.headers.get('X-API-Key') || 
                     request.headers.get('Authorization')?.replace('Bearer ', '');
      
      if (apiKey && this.config.apiKeys?.includes(apiKey)) {
        context.metadata.authType = 'api-key';
        context.metadata.authenticated = true;
        context.userId = this.hashApiKey(apiKey);
        return next();
      }
      
      // No authentication found, but continue anyway
      context.metadata.authenticated = false;
      return next();
    };
  }
  
  /**
   * Verify webhook signature
   */
  private async verifyWebhookSignature(
    request: Request,
    signature: string,
    secret: string
  ): Promise<boolean> {
    try {
      // Clone request to read body
      const clonedRequest = request.clone();
      const body = await clonedRequest.text();
      
      // Calculate expected signature
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(body);
      const expectedSignature = hmac.digest('hex');
      
      // Compare signatures (timing-safe)
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      this.logger.error('Error verifying webhook signature', error as Error);
      return false;
    }
  }
  
  /**
   * Hash API key for user identification
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16);
  }
}

/**
 * Factory function to create auth middleware
 */
export function createAuthMiddleware(
  configService: IConfigService,
  logger: ILogger,
  type: 'webhook' | 'apiKey' | 'optional' = 'optional'
): MiddlewareHandler {
  const authMiddleware = new AuthMiddleware(configService, logger);
  
  switch (type) {
    case 'webhook':
      return authMiddleware.webhookAuth();
    case 'apiKey':
      return authMiddleware.apiKeyAuth();
    case 'optional':
    default:
      return authMiddleware.optionalAuth();
  }
}