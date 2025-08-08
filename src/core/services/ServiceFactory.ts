import { ServiceRegistry, DependencyContainer, ServiceTokens } from './ServiceRegistry';
import { ZApiMessagingService } from './messaging/ZApiMessagingService';
import { KVStorageService } from './storage/KVStorageService';
import { OpenAIService } from './ai/OpenAIService';
import { IMessagingService } from './interfaces/IMessagingService';
import { IStorageService } from './interfaces/IStorageService';
import { IAIService } from './interfaces/IAIService';
import { ValidatedEnv } from '../config/env-schema';
import { Logger, ILogger } from '../logging/Logger';
import { ErrorHandler, IErrorHandler } from '../logging/ErrorHandler';
import { EventBus, IEventBus } from '../event-bus/EventBus';
import { ConfigService, IConfigService } from '../config/ConfigService';
import { createTypedEventBus } from '../event-bus/TypedEventBus';
import { ITypedEventBus } from '../event-bus/TypedEvents';

/**
 * Factory for creating and configuring services
 */
export class ServiceFactory {
  private registry: ServiceRegistry;
  private container: DependencyContainer;
  private configService: IConfigService;
  
  constructor(private env: ValidatedEnv) {
    this.registry = new ServiceRegistry();
    this.container = new DependencyContainer(this.registry);
    this.configService = new ConfigService(env);
  }
  
  /**
   * Initialize all core services
   */
  async initialize(): Promise<DependencyContainer> {
    // Register environment and config service
    this.registry.registerInstance(ServiceTokens.ENV, this.env);
    this.registry.registerInstance('IConfigService', this.configService);
    
    // Register infrastructure services first (always needed)
    this.registerLogger();
    this.registerErrorHandler();
    this.registerEventBus();
    
    // Register core services conditionally based on available credentials
    try {
      this.registerMessagingService();
    } catch (error) {
      console.warn('Messaging service not available:', error);
    }
    
    try {
      this.registerStorageService();
    } catch (error) {
      console.warn('Storage service not available:', error);
    }
    
    try {
      this.registerAIService();
    } catch (error) {
      console.warn('AI service not available:', error);
    }
    
    // Perform health checks (non-blocking)
    this.performHealthChecks().catch(error => 
      console.warn('Health check failed:', error)
    );
    
    return this.container;
  }
  
  /**
   * Register messaging service
   */
  private registerMessagingService(): void {
    this.registry.registerSingleton<IMessagingService>(
      ServiceTokens.MESSAGING,
      (container) => {
        const configService = container.resolve<IConfigService>('IConfigService');
        const zapiConfig = configService.getServiceConfig('zapi');
        
        if (!zapiConfig || !('instanceId' in zapiConfig)) {
          throw new Error('Z-API configuration not found');
        }
        
        const { instanceId, instanceToken, clientToken } = zapiConfig as any;
        
        if (!instanceId || !instanceToken || !clientToken) {
          throw new Error('Z-API credentials (Instance ID, Instance Token, and Client Token) are required for messaging service');
        }
        
        return new ZApiMessagingService({
          instanceId,
          instanceToken,
          securityToken: clientToken,  // Used as Client-Token header in API calls
          rateLimitPerMinute: zapiConfig.rateLimitPerMinute,
          retryConfig: {
            maxAttempts: zapiConfig.maxRetries,
            initialDelayMs: zapiConfig.retryDelayMs,
            maxDelayMs: zapiConfig.timeoutMs,
            backoffMultiplier: 2,
          },
        });
      }
    );
  }
  
  /**
   * Register storage service
   */
  private registerStorageService(): void {
    this.registry.registerSingleton<IStorageService>(
      ServiceTokens.STORAGE,
      (container) => {
        const env = container.resolve<ValidatedEnv>(ServiceTokens.ENV);
        const configService = container.resolve<IConfigService>('IConfigService');
        const storageConfig = configService.get<any>('storage');
        
        return new KVStorageService(
          env.USER_CONFIGS,
          {
            cacheEnabled: storageConfig?.cacheEnabled ?? true,
            cacheTTLSeconds: storageConfig?.cacheTTLSeconds ?? 300,
          }
        );
      }
    );
  }
  
  /**
   * Register AI service
   */
  private registerAIService(): void {
    this.registry.registerSingleton<IAIService>(
      ServiceTokens.AI,
      (container) => {
        const configService = container.resolve<IConfigService>('IConfigService');
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
      }
    );
  }
  
  /**
   * Register logger service
   */
  private registerLogger(): void {
    this.registry.registerSingleton<ILogger>(
      ServiceTokens.LOGGER,
      () => {
        return new Logger({
          level: (this.env as any).LOG_LEVEL || 'info',
          format: 'json',
        });
      }
    );
  }
  
  /**
   * Register error handler
   */
  private registerErrorHandler(): void {
    this.registry.registerSingleton<IErrorHandler>(
      ServiceTokens.ERROR_HANDLER,
      (container) => {
        const logger = container.resolve<ILogger>(ServiceTokens.LOGGER);
        return new ErrorHandler(logger);
      }
    );
  }
  
  /**
   * Register event bus
   */
  private registerEventBus(): void {
    // Register legacy event bus
    this.registry.registerSingleton<IEventBus>(
      ServiceTokens.EVENT_BUS,
      (container) => {
        const logger = container.resolve<ILogger>(ServiceTokens.LOGGER);
        return new EventBus(logger);
      }
    );
    
    // Register typed event bus adapter
    this.registry.registerSingleton<ITypedEventBus>(
      'ITypedEventBus',
      (container) => {
        const legacyEventBus = container.resolve<IEventBus>(ServiceTokens.EVENT_BUS);
        const logger = container.resolve<ILogger>(ServiceTokens.LOGGER);
        const configService = container.resolve<IConfigService>('IConfigService');
        
        return createTypedEventBus(legacyEventBus, {
          logger,
          validateEvents: configService.getEnvironment() !== 'production',
          enableMetrics: configService.isFeatureEnabled('debugMode'),
        });
      }
    );
  }
  
  /**
   * Perform health checks on critical services
   */
  private async performHealthChecks(): Promise<void> {
    const criticalServices = [
      ServiceTokens.MESSAGING,
      ServiceTokens.AI,
    ];
    
    const healthChecks = criticalServices.map(async (token) => {
      try {
        // Check if service is registered before trying to resolve
        if (!this.registry.has(token)) {
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
      // In production, you might want to throw here or implement retry logic
    }
  }
  
  /**
   * Create a scoped container for request-specific services
   */
  createScope(): DependencyContainer {
    return this.container.createScope();
  }
  
  /**
   * Get the main container
   */
  getContainer(): DependencyContainer {
    return this.container;
  }
  
  /**
   * Get the service registry
   */
  getRegistry(): ServiceRegistry {
    return this.registry;
  }
  
  /**
   * Dispose all services
   */
  dispose(): void {
    // Dispose singletons that implement IDisposable
    const services = this.registry.getAll();
    for (const [, descriptor] of services) {
      if (descriptor.instance && typeof descriptor.instance.dispose === 'function') {
        descriptor.instance.dispose();
      }
      if (descriptor.instance && typeof descriptor.instance.destroy === 'function') {
        descriptor.instance.destroy();
      }
    }
    
    this.container.dispose();
  }
}

/**
 * Create and initialize service factory
 */
export async function createServiceFactory(env: ValidatedEnv): Promise<ServiceFactory> {
  const factory = new ServiceFactory(env);
  await factory.initialize();
  return factory;
}