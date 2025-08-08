import { IEventBus } from '../event-bus/EventBus';
import { ILogger } from '../logging/Logger';
import { DependencyContainer } from '../services/ServiceRegistry';
import { ModuleManager } from '../modules/IDomainModule';
import { DomainRouter, Route, RouteContext } from './routers/DomainRouter';
import { WebhookRouter } from './routers/WebhookRouter';
import { PortfolioRouter } from './routers/PortfolioRouter';
import { NotesRouter } from './routers/NotesRouter';
import { handleCorsPreflight } from '../utils/cors';
import { ErrorResponseBuilder, ErrorCode } from '../errors/ErrorResponse';

/**
 * Composite API Router that manages and delegates to domain-specific routers
 * Replaces the monolithic ApiRouter with a modular approach
 */

export interface ICompositeApiRouter {
  registerRouter(router: DomainRouter): void;
  handle(request: Request): Promise<Response>;
  getRoutes(): Route[];
}

export class CompositeApiRouter implements ICompositeApiRouter {
  private routers: DomainRouter[] = [];
  private globalRoutes: Route[] = [];
  private logger: ILogger;
  
  constructor(
    private eventBus: IEventBus,
    logger: ILogger,
    private container: DependencyContainer,
    private moduleManager?: ModuleManager
  ) {
    this.logger = logger.child({ component: 'CompositeApiRouter' });
    this.initializeRouters();
    this.registerGlobalRoutes();
  }
  
  /**
   * Initialize and register all domain routers
   */
  private initializeRouters(): void {
    // Create domain routers
    const routers = [
      new WebhookRouter(this.container, this.eventBus, this.logger),
      new PortfolioRouter(this.container, this.eventBus, this.logger),
      new NotesRouter(this.container, this.eventBus, this.logger),
    ];
    
    // Register each router
    routers.forEach(router => this.registerRouter(router));
    
    this.logger.info('Domain routers initialized', {
      routers: routers.map(r => r.constructor.name),
      totalRoutes: this.getRoutes().length,
    });
  }
  
  /**
   * Register global routes (health, status, etc.)
   */
  private registerGlobalRoutes(): void {
    // Health check endpoint
    this.globalRoutes.push({
      method: 'GET',
      path: '/health',
      handler: async (_request, _params, _context) => {
        const health = await this.getHealthStatus();
        return new Response(JSON.stringify(health), {
          status: health.healthy ? 200 : 503,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
    
    // Status endpoint
    this.globalRoutes.push({
      method: 'GET',
      path: '/status',
      handler: async (_request, _params, _context) => {
        const status = {
          version: '2.0.0',
          environment: (() => {
            try {
              const configService = this.container.resolve('IConfigService') as any;
              return configService && typeof configService.getEnvironment === 'function' 
                ? configService.getEnvironment() 
                : 'unknown';
            } catch {
              return 'unknown';
            }
          })(),
          routers: this.routers.map(r => ({
            name: r.constructor.name,
            prefix: r.getPrefix(),
            routes: r.getRoutes().length,
          })),
          modules: this.moduleManager ? await this.getModuleStatus() : null,
          timestamp: new Date().toISOString(),
        };
        
        return new Response(JSON.stringify(status), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
    
    // API documentation endpoint
    this.globalRoutes.push({
      method: 'GET',
      path: '/api',
      handler: async (_request, _params, _context) => {
        const documentation = {
          version: '2.0.0',
          endpoints: this.getRoutes().map(route => ({
            method: route.method,
            path: route.path,
            description: route.description,
            authenticated: route.authenticated,
          })),
        };
        
        return new Response(JSON.stringify(documentation, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
  }
  
  /**
   * Register a domain router
   */
  registerRouter(router: DomainRouter): void {
    this.routers.push(router);
    this.logger.debug('Router registered', {
      router: router.constructor.name,
      prefix: router.getPrefix(),
      routes: router.getRoutes().length,
    });
  }
  
  /**
   * Handle incoming request
   */
  async handle(request: Request): Promise<Response> {
    // Handle CORS preflight
    const preflightResponse = handleCorsPreflight(request);
    if (preflightResponse) {
      return preflightResponse;
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const correlationId = this.generateCorrelationId();
    
    this.logger.info('Request received', {
      method,
      path,
      correlationId,
      userAgent: request.headers.get('User-Agent'),
    });
    
    try {
      // Check global routes first
      for (const route of this.globalRoutes) {
        if (route.method === method && this.matchPath(route.path, path)) {
          const context: RouteContext = {
            container: this.container,
            eventBus: this.eventBus,
            logger: this.logger,
            correlationId,
            metadata: {},
          };
          
          const params = this.extractParams(route.path, path);
          return await route.handler(request, params, context);
        }
      }
      
      // Try each domain router
      for (const router of this.routers) {
        const response = await router.handle(request, path);
        if (response) {
          // Add correlation ID header
          response.headers.set('X-Correlation-ID', correlationId);
          return response;
        }
      }
      
      // No matching route found
      this.logger.warn('Route not found', {
        method,
        path,
        correlationId,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.ENDPOINT_NOT_FOUND,
        `Endpoint not found: ${method} ${path}`
      )
        .withCorrelationId(correlationId)
        .withPath(path)
        .toResponse();
      
    } catch (error) {
      this.logger.error('Request handling error', error as Error, {
        method,
        path,
        correlationId,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Internal server error'
      )
        .withCorrelationId(correlationId)
        .withPath(path)
        .withRetry(true)
        .toResponse();
    }
  }
  
  /**
   * Get all routes from all routers
   */
  getRoutes(): Route[] {
    const allRoutes: Route[] = [...this.globalRoutes];
    
    for (const router of this.routers) {
      allRoutes.push(...router.getRoutes());
    }
    
    return allRoutes;
  }
  
  /**
   * Get health status
   */
  private async getHealthStatus(): Promise<any> {
    const checks: Record<string, boolean> = {};
    
    // Check core services
    const services = ['IEventBus', 'ILogger', 'IConfigService'];
    for (const service of services) {
      checks[service] = this.container.tryResolve(service) !== null;
    }
    
    // Check modules if available
    if (this.moduleManager) {
      try {
        const modules = await this.getModuleStatus();
        checks.modules = modules.every((m: any) => m.healthy);
      } catch {
        checks.modules = false;
      }
    }
    
    const healthy = Object.values(checks).every(v => v);
    
    return {
      healthy,
      checks,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Get module status
   */
  private async getModuleStatus(): Promise<any[]> {
    if (!this.moduleManager) return [];
    
    const moduleStatuses = [];
    
    try {
      // Get all registered modules and their health
      const modules = this.moduleManager.getAll();
      
      for (const [name, module] of modules) {
        try {
          const health = await module.getHealth();
          moduleStatuses.push({
            name,
            version: module.version,
            ...health,
          });
        } catch (error) {
          moduleStatuses.push({
            name,
            version: module.version,
            healthy: false,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to get module status', error as Error);
    }
    
    return moduleStatuses;
  }
  
  /**
   * Match path pattern
   */
  private matchPath(pattern: string, path: string): boolean {
    if (pattern === path) return true;
    
    // Convert pattern to regex
    const regexPattern = pattern.replace(/:([^/]+)/g, '([^/]+)');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }
  
  /**
   * Extract parameters from path
   */
  private extractParams(pattern: string, path: string): Record<string, string> {
    const params: Record<string, string> = {};
    
    if (pattern === path) return params;
    
    const paramNames: string[] = [];
    const regexPattern = pattern.replace(/:([^/]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });
    
    const regex = new RegExp(`^${regexPattern}$`);
    const match = path.match(regex);
    
    if (match) {
      paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });
    }
    
    return params;
  }
  
  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}