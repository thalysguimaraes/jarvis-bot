import 'reflect-metadata';
import { ServiceContainer, container } from './AutoRegistry';
import { Injectable } from '../decorators/Injectable';
import { ZApiMessagingService } from './messaging/ZApiMessagingService';
import { KVStorageService } from './storage/KVStorageService';
import { OpenAIService } from './ai/OpenAIService';
import { IMessagingService } from './interfaces/IMessagingService';
import { IStorageService } from './interfaces/IStorageService';
import { IAIService } from './interfaces/IAIService';
import { ValidatedEnv } from '../config/env-schema';
import { Logger, ILogger } from '../logging/Logger';
import { ErrorHandler } from '../logging/ErrorHandler';
import { EventBus, IEventBus } from '../event-bus/EventBus';
import { ConfigService, IConfigService } from '../config/ConfigService';
import { createTypedEventBus } from '../event-bus/TypedEventBus';
import { ConsoleLogger } from '../logging/ConsoleLogger';

/**
 * Enhanced service factory using decorator-based dependency injection
 */
@Injectable({ singleton: true })
export class ServiceFactoryV2 {
  private container: ServiceContainer;
  private initialized = false;
  
  constructor(private env: ValidatedEnv) {
    this.container = container;
  }
  
  /**
   * Initialize all core services with decorator-based DI
   */
  async initialize(): Promise<ServiceContainer> {
    if (this.initialized) {
      return this.container;
    }
    
    // Register environment as a value
    this.container.register('ValidatedEnv', this.env);
    
    // Register config service first
    this.registerConfigService();
    
    // Register infrastructure services
    this.registerInfrastructureServices();
    
    // Register business services
    await this.registerBusinessServices();
    
    // Validate dependency graph
    try {
      this.container.validateDependencyGraph();
    } catch (error) {
      console.error('Dependency graph validation failed:', error);
      // In production, you might want to throw here
    }
    
    // Perform health checks
    await this.performHealthChecks();
    
    this.initialized = true;
    return this.container;
  }
  
  private registerConfigService(): void {
    // ConfigService is already decorated with @Injectable
    // We just need to provide a factory that passes the env
    this.container.register(ConfigService, () => {
      return new ConfigService(this.env);
    });
    
    // Also register by interface token
    this.container.register('IConfigService', () => {
      return this.container.resolve(ConfigService);
    });
  }
  
  private registerInfrastructureServices(): void {
    // Register logger implementations
    this.container.register('ILogger', () => {
      const logLevel = (this.env as any).LOG_LEVEL || 'info';
      return new ConsoleLogger(logLevel);
    });
    
    this.container.register(Logger, () => {
      return new Logger({
        level: (this.env as any).LOG_LEVEL || 'info',
        format: 'json',
      });
    });
    
    // Register error handler
    this.container.register('IErrorHandler', () => {
      const logger = this.container.resolve<ILogger>('ILogger');
      return new ErrorHandler(logger);
    });
    
    // Register event buses
    this.registerEventBuses();
  }
  
  private registerEventBuses(): void {
    // Legacy event bus
    this.container.register('IEventBus', () => {
      const logger = this.container.resolve<ILogger>('ILogger');
      return new EventBus(logger);
    });
    
    // Typed event bus adapter
    this.container.register('ITypedEventBus', () => {
      const legacyEventBus = this.container.resolve<IEventBus>('IEventBus');
      const logger = this.container.resolve<ILogger>('ILogger');
      const configService = this.container.resolve<IConfigService>('IConfigService');
      
      return createTypedEventBus(legacyEventBus, {
        logger,
        validateEvents: configService.getEnvironment() !== 'production',
        enableMetrics: configService.isFeatureEnabled('debugMode'),
      });
    });
  }
  
  private async registerBusinessServices(): Promise<void> {
    // Register messaging service
    try {
      this.registerMessagingService();
    } catch (error) {
      console.warn('Messaging service not available:', error);
    }
    
    // Register storage service
    try {
      this.registerStorageService();
    } catch (error) {
      console.warn('Storage service not available:', error);
    }
    
    // Register AI service
    try {
      this.registerAIService();
    } catch (error) {
      console.warn('AI service not available:', error);
    }
  }
  
  private registerMessagingService(): void {
    this.container.register('IMessagingService', () => {
      const configService = this.container.resolve<IConfigService>('IConfigService');
      const zapiConfig = configService.getServiceConfig('zapi');
      
      if (!zapiConfig || !('instanceId' in zapiConfig)) {
        throw new Error('Z-API configuration not found');
      }
      
      const { instanceId, instanceToken, clientToken } = zapiConfig as any;
      
      if (!instanceId || !instanceToken || !clientToken) {
        throw new Error('Z-API credentials are required for messaging service');
      }
      
      return new ZApiMessagingService({
        instanceId,
        instanceToken,
        securityToken: clientToken,
        rateLimitPerMinute: zapiConfig.rateLimitPerMinute,
        retryConfig: {
          maxAttempts: zapiConfig.maxRetries,
          initialDelayMs: zapiConfig.retryDelayMs,
          maxDelayMs: zapiConfig.timeoutMs,
          backoffMultiplier: 2,
        },
      });
    });
    
    // Also register the concrete class
    this.container.register(ZApiMessagingService, () => {
      return this.container.resolve<IMessagingService>('IMessagingService');
    });
  }
  
  private registerStorageService(): void {
    this.container.register('IStorageService', () => {
      const env = this.container.resolve<ValidatedEnv>('ValidatedEnv');
      const configService = this.container.resolve<IConfigService>('IConfigService');
      const storageConfig = configService.get<any>('storage');
      
      return new KVStorageService(env.USER_CONFIGS, {
        cacheEnabled: storageConfig?.cacheEnabled ?? true,
        cacheTTLSeconds: storageConfig?.cacheTTLSeconds ?? 300,
      } as any);
    });
    
    // Also register the concrete class
    this.container.register(KVStorageService, () => {
      return this.container.resolve<IStorageService>('IStorageService');
    });
  }
  
  private registerAIService(): void {
    this.container.register('IAIService', () => {
      const configService = this.container.resolve<IConfigService>('IConfigService');
      const openaiConfig = configService.getServiceConfig('openai');
      
      if (!openaiConfig || !('apiKey' in openaiConfig)) {
        throw new Error('OpenAI configuration not found');
      }
      
      const { apiKey, model, maxTokens } = openaiConfig as any;
      
      if (!apiKey || apiKey === 'undefined') {
        throw new Error('OpenAI API key is required for AI service');
      }
      
      return new OpenAIService({
        apiKey,
        defaultModel: model || 'gpt-4-turbo-preview',
        maxTokensPerRequest: maxTokens || 4096,
        maxTokensPerDay: 1000000,
        maxCostPerDay: 100,
        cacheEnabled: true,
        cacheTTLMs: 3600000,
        retryConfig: {
          maxAttempts: openaiConfig.maxRetries,
          initialDelayMs: openaiConfig.retryDelayMs,
          maxDelayMs: openaiConfig.timeoutMs,
          backoffMultiplier: 2,
        },
      });
    });
    
    // Also register the concrete class
    this.container.register(OpenAIService, () => {
      return this.container.resolve<IAIService>('IAIService');
    });
  }
  
  private async performHealthChecks(): Promise<void> {
    const criticalServices = [
      'IMessagingService',
      'IAIService',
    ];
    
    const healthChecks = criticalServices.map(async (token) => {
      try {
        if (!this.container.has(token)) {
          console.warn(`Service ${token} is not registered`);
          return { token, available: false };
        }
        
        const service = this.container.resolve<any>(token);
        if (typeof service?.isAvailable === 'function') {
          const available = await service.isAvailable();
          if (!available) {
            console.warn(`Service ${token} is not available`);
          }
          return { token, available };
        }
        return { token, available: true };
      } catch (error) {
        console.error(`Failed to check health of ${token}:`, error);
        return { token, available: false };
      }
    });
    
    const results = await Promise.all(healthChecks);
    const failures = results.filter(r => !r.available);
    
    if (failures.length > 0) {
      console.error('Some services failed health checks:', failures);
    }
  }
  
  /**
   * Get the service container
   */
  getContainer(): ServiceContainer {
    return this.container;
  }
  
  /**
   * Resolve a service from the container
   */
  resolve<T>(token: any): T {
    return this.container.resolve<T>(token);
  }
  
  /**
   * Register a custom service
   */
  register<T>(token: any, provider: T | (() => T)): void {
    this.container.register(token, provider);
  }
  
  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.container.clear();
    this.initialized = false;
  }
}

/**
 * Create and initialize service factory with decorator-based DI
 */
export async function createServiceFactoryV2(env: ValidatedEnv): Promise<ServiceFactoryV2> {
  const factory = new ServiceFactoryV2(env);
  await factory.initialize();
  return factory;
}