import 'reflect-metadata';
import { Injectable, getServiceMetadata, getAllServices, isInjectable, ServiceMetadata } from '../decorators/Injectable';
import { InjectionToken, getInjectionTokens, getInjectionOptions, getPropertyInjections } from '../decorators/Inject';
import { ILogger } from '../logging/Logger';
import { ConsoleLogger } from '../logging/ConsoleLogger';

export class CircularDependencyError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

export class ServiceNotFoundError extends Error {
  constructor(public readonly token: InjectionToken) {
    super(`Service not found for token: ${typeof token === 'function' ? token.name : String(token)}`);
    this.name = 'ServiceNotFoundError';
  }
}

export interface ContainerConfig {
  logger?: ILogger;
  enableAutoScan?: boolean;
  strict?: boolean;
}

@Injectable({ singleton: true })
export class ServiceContainer {
  private static instance: ServiceContainer;
  private services = new Map<InjectionToken, any>();
  private instances = new Map<InjectionToken, any>();
  private resolving = new Set<InjectionToken>();
  private logger: ILogger;
  
  constructor(config: ContainerConfig = {}) {
    this.logger = config.logger || new ConsoleLogger();
    
    if (config.enableAutoScan) {
      this.scanAndRegister();
    }
    
    this.services.set(ServiceContainer, this);
    this.instances.set(ServiceContainer, this);
  }
  
  static getInstance(config?: ContainerConfig): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer(config);
    }
    return ServiceContainer.instance;
  }
  
  register<T>(token: InjectionToken<T>, provider: T | (() => T)): void {
    this.services.set(token, provider);
    this.logger.debug(`Registered service: ${this.tokenToString(token)}`);
  }
  
  registerClass<T>(ClassType: new (...args: any[]) => T): void {
    if (!isInjectable(ClassType)) {
      throw new Error(`Class ${ClassType.name} is not decorated with @Injectable`);
    }
    
    this.services.set(ClassType, ClassType);
    this.logger.debug(`Registered class: ${ClassType.name}`);
  }
  
  resolve<T>(token: InjectionToken<T>): T {
    if (this.resolving.has(token)) {
      throw new CircularDependencyError(Array.from(this.resolving).map(t => this.tokenToString(t)));
    }
    
    const metadata = this.getMetadataForToken(token);
    const isSingleton = metadata?.singleton !== false;
    
    if (isSingleton && this.instances.has(token)) {
      return this.instances.get(token);
    }
    
    this.resolving.add(token);
    
    try {
      const instance = this.createInstance(token);
      
      if (isSingleton) {
        this.instances.set(token, instance);
      }
      
      return instance;
    } finally {
      this.resolving.delete(token);
    }
  }
  
  resolveOptional<T>(token: InjectionToken<T>): T | undefined {
    try {
      return this.resolve(token);
    } catch (error) {
      if (error instanceof ServiceNotFoundError) {
        return undefined;
      }
      throw error;
    }
  }
  
  has(token: InjectionToken): boolean {
    return this.services.has(token);
  }
  
  clear(): void {
    this.services.clear();
    this.instances.clear();
    this.resolving.clear();
    this.services.set(ServiceContainer, this);
    this.instances.set(ServiceContainer, this);
  }
  
  private createInstance<T>(token: InjectionToken<T>): T {
    const provider = this.services.get(token);
    
    // If provider is a direct value (not a function), return it
    if (provider && typeof provider !== 'function') {
      return provider;
    }
    
    // If provider is a factory function (not a class), call it
    if (provider && typeof provider === 'function' && !isInjectable(provider)) {
      return provider();
    }
    
    // Otherwise, treat as a class constructor
    const ClassType = provider || token;
    
    if (typeof ClassType !== 'function') {
      throw new ServiceNotFoundError(token);
    }
    
    // Check if it's an injectable class
    if (!isInjectable(ClassType)) {
      // If it's not injectable but is a function, treat it as a factory
      if (typeof ClassType === 'function') {
        return ClassType();
      }
      throw new Error(`Class ${this.tokenToString(token)} is not decorated with @Injectable`);
    }
    
    const metadata = getServiceMetadata(ClassType);
    
    // Use factory from metadata if available
    if (metadata?.factory) {
      return metadata.factory();
    }
    
    // Dependency injection for constructor
    const injectionTokens = getInjectionTokens(ClassType);
    const injectionOptions = getInjectionOptions(ClassType);
    const paramTypes = metadata?.paramTypes || Reflect.getMetadata('design:paramtypes', ClassType) || [];
    
    const dependencies = paramTypes.map((paramType: any, index: number) => {
      const injectionToken = injectionTokens[index] || paramType;
      const options = injectionOptions[index] || {};
      
      if (options.optional) {
        return this.resolveOptional(injectionToken);
      }
      
      return this.resolve(injectionToken);
    });
    
    const instance = new (ClassType as any)(...dependencies);
    
    this.injectProperties(instance, ClassType);
    
    return instance;
  }
  
  private injectProperties(instance: any, ClassType: any): void {
    const propertyInjections = getPropertyInjections(ClassType.prototype);
    
    propertyInjections.forEach(({ token, options }, propertyKey) => {
      const resolvedToken = token || Reflect.getMetadata('design:type', ClassType.prototype, propertyKey);
      
      if (options.optional) {
        instance[propertyKey] = this.resolveOptional(resolvedToken);
      } else {
        instance[propertyKey] = this.resolve(resolvedToken);
      }
    });
  }
  
  private scanAndRegister(): void {
    const allServices = getAllServices();
    
    allServices.forEach((_metadata, ClassType) => {
      if (!this.services.has(ClassType)) {
        this.registerClass(ClassType);
      }
    });
    
    this.logger.info(`Auto-registered ${allServices.size} services`);
  }
  
  private getMetadataForToken(token: InjectionToken): ServiceMetadata | undefined {
    if (typeof token === 'function') {
      return getServiceMetadata(token);
    }
    
    const provider = this.services.get(token);
    if (provider && typeof provider === 'function') {
      return getServiceMetadata(provider);
    }
    
    return undefined;
  }
  
  private tokenToString(token: InjectionToken): string {
    if (typeof token === 'function') {
      return token.name || 'Anonymous Class';
    }
    if (typeof token === 'symbol') {
      return token.toString();
    }
    return String(token);
  }
  
  getRegisteredServices(): InjectionToken[] {
    return Array.from(this.services.keys());
  }
  
  getInstances(): Map<InjectionToken, any> {
    return new Map(this.instances);
  }
  
  validateDependencyGraph(): void {
    const visited = new Set<InjectionToken>();
    const stack = new Set<InjectionToken>();
    
    const visit = (token: InjectionToken) => {
      if (stack.has(token)) {
        throw new CircularDependencyError(Array.from(stack).map(t => this.tokenToString(t)));
      }
      
      if (visited.has(token)) {
        return;
      }
      
      visited.add(token);
      stack.add(token);
      
      const metadata = this.getMetadataForToken(token);
      if (metadata) {
        const paramTypes = metadata.paramTypes || [];
        const injectionTokens = typeof token === 'function' ? getInjectionTokens(token) : [];
        
        paramTypes.forEach((paramType: any, index: number) => {
          const depToken = injectionTokens[index] || paramType;
          if (depToken && depToken !== token) {
            visit(depToken);
          }
        });
      }
      
      stack.delete(token);
    };
    
    this.services.forEach((_, token) => {
      if (!visited.has(token)) {
        visit(token);
      }
    });
    
    this.logger.info('Dependency graph validation successful');
  }
}

export const container = ServiceContainer.getInstance();

export function Autowired<T>(token?: InjectionToken<T>): PropertyDecorator {
  return function(target: any, propertyKey: string | symbol) {
    const resolvedToken = token || Reflect.getMetadata('design:type', target, propertyKey);
    
    Object.defineProperty(target, propertyKey, {
      get() {
        return container.resolve(resolvedToken);
      },
      enumerable: true,
      configurable: true,
    });
  };
}