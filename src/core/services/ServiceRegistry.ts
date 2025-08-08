/**
 * Service Registry for managing service instances
 */

export enum ServiceLifetime {
  SINGLETON = 'singleton',
  SCOPED = 'scoped',
  TRANSIENT = 'transient',
}

export interface ServiceDescriptor {
  token: string;
  factory: (container: DependencyContainer) => any;
  lifetime: ServiceLifetime;
  instance?: any;
}

export class ServiceRegistry {
  private services = new Map<string, ServiceDescriptor>();
  
  /**
   * Register a service
   */
  register<T>(
    token: string,
    factory: (container: DependencyContainer) => T,
    lifetime: ServiceLifetime = ServiceLifetime.SINGLETON
  ): this {
    this.services.set(token, {
      token,
      factory,
      lifetime,
    });
    return this;
  }
  
  /**
   * Register a singleton service
   */
  registerSingleton<T>(token: string, factory: (container: DependencyContainer) => T): this {
    return this.register(token, factory, ServiceLifetime.SINGLETON);
  }
  
  /**
   * Register a singleton instance directly
   */
  registerInstance<T>(token: string, instance: T): this {
    this.services.set(token, {
      token,
      factory: () => instance,
      lifetime: ServiceLifetime.SINGLETON,
      instance,
    });
    return this;
  }
  
  /**
   * Register a scoped service
   */
  registerScoped<T>(token: string, factory: (container: DependencyContainer) => T): this {
    return this.register(token, factory, ServiceLifetime.SCOPED);
  }
  
  /**
   * Register a transient service
   */
  registerTransient<T>(token: string, factory: (container: DependencyContainer) => T): this {
    return this.register(token, factory, ServiceLifetime.TRANSIENT);
  }
  
  /**
   * Check if a service is registered
   */
  has(token: string): boolean {
    return this.services.has(token);
  }
  
  /**
   * Get a service descriptor
   */
  get(token: string): ServiceDescriptor | undefined {
    return this.services.get(token);
  }
  
  /**
   * Get all registered services
   */
  getAll(): Map<string, ServiceDescriptor> {
    return new Map(this.services);
  }
  
  /**
   * Clear all registrations
   */
  clear(): void {
    this.services.clear();
  }
}

/**
 * Dependency Injection Container
 */
export class DependencyContainer {
  private scopedInstances = new Map<string, any>();
  
  constructor(
    private registry: ServiceRegistry,
    private parent?: DependencyContainer
  ) {}
  
  /**
   * Resolve a service
   */
  resolve<T>(token: string): T {
    const descriptor = this.registry.get(token);
    
    if (!descriptor) {
      // Check parent container
      if (this.parent) {
        return this.parent.resolve<T>(token);
      }
      throw new Error(`Service not registered: ${token}`);
    }
    
    switch (descriptor.lifetime) {
      case ServiceLifetime.SINGLETON:
        if (!descriptor.instance) {
          descriptor.instance = descriptor.factory(this);
        }
        return descriptor.instance;
        
      case ServiceLifetime.SCOPED:
        if (!this.scopedInstances.has(token)) {
          this.scopedInstances.set(token, descriptor.factory(this));
        }
        return this.scopedInstances.get(token);
        
      case ServiceLifetime.TRANSIENT:
        return descriptor.factory(this);
        
      default:
        throw new Error(`Unknown service lifetime: ${descriptor.lifetime}`);
    }
  }
  
  /**
   * Try to resolve a service, return null if not found
   */
  tryResolve<T>(token: string): T | null {
    try {
      return this.resolve<T>(token);
    } catch {
      return null;
    }
  }
  
  /**
   * Resolve multiple services
   */
  resolveMany<T>(...tokens: string[]): T[] {
    return tokens.map(token => this.resolve<T>(token));
  }
  
  /**
   * Create a scoped container
   */
  createScope(): DependencyContainer {
    return new DependencyContainer(this.registry, this);
  }
  
  /**
   * Dispose scoped instances
   */
  dispose(): void {
    // Dispose any IDisposable services
    for (const instance of this.scopedInstances.values()) {
      if (typeof instance?.dispose === 'function') {
        instance.dispose();
      }
    }
    this.scopedInstances.clear();
  }
}

/**
 * Service tokens for type-safe resolution
 */
export const ServiceTokens = {
  // Core services
  MESSAGING: 'IMessagingService',
  STORAGE: 'IStorageService',
  AI: 'IAIService',
  
  // Infrastructure
  LOGGER: 'ILogger',
  ERROR_HANDLER: 'IErrorHandler',
  EVENT_BUS: 'IEventBus',
  
  // Configuration
  CONFIG: 'IConfig',
  ENV: 'IEnvironment',
  
  // Modules
  AUDIO_MODULE: 'AudioProcessingModule',
  NOTES_MODULE: 'NotesModule',
  PORTFOLIO_MODULE: 'PortfolioModule',
  FUND_MODULE: 'FundManagementModule',
} as const;

export type ServiceToken = typeof ServiceTokens[keyof typeof ServiceTokens];

/**
 * Decorator for dependency injection (future enhancement)
 */
export function Injectable(_token?: string) {
  return function (_target: any) {
    // No-op for now (metadata system not enabled)
    return;
  };
}

/**
 * Decorator for injecting dependencies (future enhancement)
 */
export function Inject(_token: string) {
  return function (_target: any, _propertyKey: string | symbol, _parameterIndex: number) {
    // No-op for now (metadata system not enabled)
    return;
  };
}