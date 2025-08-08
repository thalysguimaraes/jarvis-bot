import { IEventBus } from '../../event-bus/EventBus';
import { ILogger } from '../../logging/Logger';
import { DependencyContainer } from '../../services/ServiceRegistry';
import { createCorsResponse } from '../../utils/cors';
import { z } from 'zod';

/**
 * Base class for domain-specific routers
 * Provides common functionality for route handling, validation, and middleware
 */

export interface RouteHandler {
  (request: Request, params: Record<string, any>, context: RouteContext): Promise<Response>;
}

export interface MiddlewareHandler {
  (request: Request, params: Record<string, any>, context: RouteContext, next: () => Promise<Response>): Promise<Response>;
}

export interface RouteContext {
  container: DependencyContainer;
  eventBus: IEventBus;
  logger: ILogger;
  userId?: string;
  correlationId: string;
  metadata: Record<string, any>;
}

export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
  middleware?: MiddlewareHandler[];
  validation?: {
    params?: z.ZodSchema;
    query?: z.ZodSchema;
    body?: z.ZodSchema;
  };
  description?: string;
  authenticated?: boolean;
}

export abstract class DomainRouter {
  protected routes: Route[] = [];
  protected prefix: string = '';
  protected globalMiddleware: MiddlewareHandler[] = [];
  
  constructor(
    protected container: DependencyContainer,
    protected eventBus: IEventBus,
    protected logger: ILogger
  ) {
    this.logger = logger.child({ router: this.constructor.name });
    this.initialize();
  }
  
  /**
   * Initialize router - override in subclasses to register routes
   */
  protected abstract initialize(): void;
  
  /**
   * Get the URL prefix for this router
   */
  public getPrefix(): string {
    return this.prefix;
  }
  
  /**
   * Set the URL prefix for this router
   */
  protected setPrefix(prefix: string): void {
    this.prefix = prefix;
  }
  
  /**
   * Register a route
   */
  protected route(route: Route): void {
    this.routes.push(route);
    this.logger.debug('Route registered', {
      method: route.method,
      path: `${this.prefix}${route.path}`,
      description: route.description,
    });
  }
  
  /**
   * Register a GET route
   */
  protected get(path: string, handler: RouteHandler, options?: Partial<Route>): void {
    this.route({
      method: 'GET',
      path,
      handler,
      ...options,
    });
  }
  
  /**
   * Register a POST route
   */
  protected post(path: string, handler: RouteHandler, options?: Partial<Route>): void {
    this.route({
      method: 'POST',
      path,
      handler,
      ...options,
    });
  }
  
  /**
   * Register a PUT route
   */
  protected put(path: string, handler: RouteHandler, options?: Partial<Route>): void {
    this.route({
      method: 'PUT',
      path,
      handler,
      ...options,
    });
  }
  
  /**
   * Register a DELETE route
   */
  protected delete(path: string, handler: RouteHandler, options?: Partial<Route>): void {
    this.route({
      method: 'DELETE',
      path,
      handler,
      ...options,
    });
  }
  
  /**
   * Register a PATCH route
   */
  protected patch(path: string, handler: RouteHandler, options?: Partial<Route>): void {
    this.route({
      method: 'PATCH',
      path,
      handler,
      ...options,
    });
  }
  
  /**
   * Add global middleware for all routes in this router
   */
  protected use(middleware: MiddlewareHandler): void {
    this.globalMiddleware.push(middleware);
  }
  
  /**
   * Get all routes with prefix applied
   */
  public getRoutes(): Route[] {
    return this.routes.map(route => ({
      ...route,
      path: `${this.prefix}${route.path}`,
      middleware: [...this.globalMiddleware, ...(route.middleware || [])],
    }));
  }
  
  /**
   * Handle a request - find matching route and execute
   */
  public async handle(request: Request, path: string): Promise<Response | null> {
    const method = request.method;
    const prefixedPath = path.startsWith(this.prefix) ? path : `${this.prefix}${path}`;
    
    for (const route of this.routes) {
      const fullPath = `${this.prefix}${route.path}`;
      
      if (route.method !== method) continue;
      
      const params = this.matchPath(fullPath, prefixedPath);
      if (!params) continue;
      
      this.logger.debug('Route matched', {
        method,
        path: fullPath,
        params,
      });
      
      // Create context
      const context: RouteContext = {
        container: this.container,
        eventBus: this.eventBus,
        logger: this.logger,
        correlationId: this.generateCorrelationId(),
        metadata: {},
      };
      
      try {
        // Validate request if validation schemas provided
        if (route.validation) {
          const validation = await this.validateRequest(request, params, route.validation);
          if (!validation.success) {
            return this.errorResponse(validation.error || 'Validation failed', 400);
          }
          // Merge validated data into params
          Object.assign(params, validation.data);
        }
        
        // Execute middleware chain
        const middleware = [...this.globalMiddleware, ...(route.middleware || [])];
        
        const executeHandler = async () => route.handler(request, params, context);
        
        const response = await this.executeMiddleware(
          request,
          params,
          context,
          middleware,
          executeHandler
        );
        
        return response;
      } catch (error) {
        this.logger.error('Route handler error', error as Error, {
          method,
          path: fullPath,
          correlationId: context.correlationId,
        });
        
        return this.errorResponse(
          error instanceof Error ? error.message : 'Internal Server Error',
          500
        );
      }
    }
    
    return null; // No matching route
  }
  
  /**
   * Execute middleware chain
   */
  private async executeMiddleware(
    request: Request,
    params: Record<string, any>,
    context: RouteContext,
    middleware: MiddlewareHandler[],
    finalHandler: () => Promise<Response>
  ): Promise<Response> {
    let index = 0;
    
    const next = async (): Promise<Response> => {
      if (index >= middleware.length) {
        return finalHandler();
      }
      
      const currentMiddleware = middleware[index++];
      return currentMiddleware(request, params, context, next);
    };
    
    return next();
  }
  
  /**
   * Match a path pattern against an actual path
   */
  private matchPath(pattern: string, path: string): Record<string, string> | null {
    // Handle exact matches
    if (pattern === path) {
      return {};
    }
    
    // Convert pattern to regex (support :param syntax)
    const paramNames: string[] = [];
    const regexPattern = pattern.replace(/:([^/]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });
    
    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);
    
    if (!match) {
      return null;
    }
    
    const params: Record<string, string> = {};
    paramNames.forEach((name, index) => {
      params[name] = match[index + 1];
    });
    
    return params;
  }
  
  /**
   * Validate request against schemas
   */
  private async validateRequest(
    request: Request,
    params: Record<string, any>,
    validation: Route['validation']
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const validated: Record<string, any> = {};
      
      // Validate params
      if (validation?.params) {
        const result = validation.params.safeParse(params);
        if (!result.success) {
          return {
            success: false,
            error: `Invalid params: ${result.error.issues.map((e: any) => e.message).join(', ')}`,
          };
        }
        validated.params = result.data;
      }
      
      // Validate query parameters
      if (validation?.query) {
        const url = new URL(request.url);
        const query = Object.fromEntries(url.searchParams);
        const result = validation.query.safeParse(query);
        if (!result.success) {
          return {
            success: false,
            error: `Invalid query: ${result.error.issues.map((e: any) => e.message).join(', ')}`,
          };
        }
        validated.query = result.data;
      }
      
      // Validate body
      if (validation?.body && request.method !== 'GET') {
        try {
          const body = await request.json();
          const result = validation.body.safeParse(body);
          if (!result.success) {
            return {
              success: false,
              error: `Invalid body: ${result.error.issues.map((e: any) => e.message).join(', ')}`,
            };
          }
          validated.body = result.data;
        } catch (error) {
          return {
            success: false,
            error: 'Invalid JSON body',
          };
        }
      }
      
      return { success: true, data: validated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation error',
      };
    }
  }
  
  /**
   * Generate a correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Create an error response
   */
  protected errorResponse(message: string, status: number): Response {
    return createCorsResponse(
      JSON.stringify({
        error: true,
        message,
        status,
        timestamp: new Date().toISOString(),
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  
  /**
   * Create a success response
   */
  protected successResponse(data: any, status: number = 200): Response {
    return createCorsResponse(
      JSON.stringify({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}