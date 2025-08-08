import { Injectable } from '../../decorators/Injectable';
import { Inject } from '../../decorators/Inject';
import { ILogger } from '../../logging/Logger';
import { IConfigService } from '../../config/ConfigService';
import { EventBus } from '../../event-bus/EventBus';
import { CircuitBreaker, CircuitBreakerOptions, CircuitState } from './CircuitBreaker';
import { RateLimiter, RateLimiterFactory, RateLimiterOptions } from './RateLimiter';
import { RetryHandler, RetryOptions } from './RetryHandler';

export interface ServiceResilienceConfig {
  serviceName: string;
  circuitBreaker?: Partial<CircuitBreakerOptions>;
  rateLimiter?: RateLimiterOptions;
  retry?: Partial<RetryOptions>;
  enabled?: boolean;
}

export interface ResilienceStats {
  service: string;
  circuitBreakerState?: CircuitState;
  rateLimiterStats?: {
    availableTokens: number;
    maxTokens: number;
    isLimited: boolean;
  };
  retryStats?: {
    totalAttempts: number;
    successfulRetries: number;
    failedRetries: number;
  };
}

@Injectable({ singleton: true })
export class ResilienceManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private rateLimiters = new Map<string, RateLimiter>();
  private serviceConfigs = new Map<string, ServiceResilienceConfig>();
  private retryStats = new Map<string, {
    totalAttempts: number;
    successfulRetries: number;
    failedRetries: number;
  }>();

  constructor(
    @Inject('ILogger') private logger: ILogger,
    @Inject('IConfigService') private configService: IConfigService,
    @Inject('IEventBus') private eventBus: EventBus,
    @Inject(RateLimiterFactory) private rateLimiterFactory: RateLimiterFactory,
    @Inject(RetryHandler) private retryHandler: RetryHandler
  ) {
    this.loadConfiguration();
    this.setupEventListeners();
  }

  private loadConfiguration(): void {
    const resilienceConfig = this.configService.get<any>('resilience');
    
    if (resilienceConfig?.services) {
      Object.entries(resilienceConfig.services).forEach(([serviceName, config]) => {
        this.configureService(serviceName, config as ServiceResilienceConfig);
      });
    }

    this.logger.info('Resilience configuration loaded', {
      servicesConfigured: this.serviceConfigs.size
    });
  }

  private setupEventListeners(): void {
    this.eventBus.subscribe('circuit-breaker:state-change', (event: any) => {
      this.logger.warn('Circuit breaker state changed', {
        service: event.name,
        oldState: event.oldState,
        newState: event.newState
      });
    });
  }

  configureService(serviceName: string, config: ServiceResilienceConfig): void {
    this.serviceConfigs.set(serviceName, config);
    
    if (!config.enabled) {
      this.logger.debug(`Resilience disabled for service: ${serviceName}`);
      return;
    }

    if (config.circuitBreaker) {
      this.createCircuitBreaker(serviceName, config.circuitBreaker);
    }

    if (config.rateLimiter) {
      this.createRateLimiter(serviceName, config.rateLimiter);
    }

    this.logger.info(`Resilience configured for service: ${serviceName}`, config);
  }

  private createCircuitBreaker(
    serviceName: string,
    options: Partial<CircuitBreakerOptions>
  ): CircuitBreaker {
    const defaultOptions: CircuitBreakerOptions = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 10000,
      volumeThreshold: 10,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      ...options
    };

    const circuitBreaker = new CircuitBreaker(
      serviceName,
      defaultOptions,
      this.logger,
      this.eventBus
    );

    this.circuitBreakers.set(serviceName, circuitBreaker);
    return circuitBreaker;
  }

  private createRateLimiter(
    serviceName: string,
    options: RateLimiterOptions
  ): RateLimiter {
    const rateLimiter = this.rateLimiterFactory.create(serviceName, options);
    this.rateLimiters.set(serviceName, rateLimiter);
    return rateLimiter;
  }

  getCircuitBreaker(serviceName: string): CircuitBreaker | undefined {
    let circuitBreaker = this.circuitBreakers.get(serviceName);
    
    if (!circuitBreaker) {
      const config = this.serviceConfigs.get(serviceName);
      if (config?.circuitBreaker && config.enabled !== false) {
        circuitBreaker = this.createCircuitBreaker(serviceName, config.circuitBreaker);
      }
    }
    
    return circuitBreaker;
  }

  getRateLimiter(serviceName: string): RateLimiter | undefined {
    let rateLimiter = this.rateLimiters.get(serviceName);
    
    if (!rateLimiter) {
      const config = this.serviceConfigs.get(serviceName);
      if (config?.rateLimiter && config.enabled !== false) {
        rateLimiter = this.createRateLimiter(serviceName, config.rateLimiter);
      }
    }
    
    return rateLimiter;
  }

  async executeWithResilience<T>(
    serviceName: string,
    operation: () => Promise<T>,
    options?: {
      skipCircuitBreaker?: boolean;
      skipRateLimiter?: boolean;
      skipRetry?: boolean;
      customRetryOptions?: Partial<RetryOptions>;
    }
  ): Promise<T> {
    const config = this.serviceConfigs.get(serviceName);
    
    if (!config || !config.enabled) {
      return operation();
    }

    let wrappedOperation = operation;

    // Apply rate limiting
    if (!options?.skipRateLimiter) {
      const rateLimiter = this.getRateLimiter(serviceName);
      if (rateLimiter) {
        const originalOperation = wrappedOperation;
        wrappedOperation = () => rateLimiter.executeWithRateLimit(originalOperation);
      }
    }

    // Apply circuit breaker
    if (!options?.skipCircuitBreaker) {
      const circuitBreaker = this.getCircuitBreaker(serviceName);
      if (circuitBreaker) {
        const originalOperation = wrappedOperation;
        wrappedOperation = () => circuitBreaker.execute(originalOperation);
      }
    }

    // Apply retry logic
    if (!options?.skipRetry && (config.retry || options?.customRetryOptions)) {
      const retryOptions: RetryOptions = {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        ...config.retry,
        ...options?.customRetryOptions
      };

      const result = await this.retryHandler.execute(
        wrappedOperation,
        retryOptions,
        serviceName
      );

      this.updateRetryStats(serviceName, result.attempts, result.success);

      if (!result.success) {
        throw result.error;
      }

      return result.value!;
    }

    return wrappedOperation();
  }

  private updateRetryStats(serviceName: string, attempts: number, success: boolean): void {
    let stats = this.retryStats.get(serviceName);
    
    if (!stats) {
      stats = {
        totalAttempts: 0,
        successfulRetries: 0,
        failedRetries: 0
      };
      this.retryStats.set(serviceName, stats);
    }

    stats.totalAttempts += attempts;
    
    if (success && attempts > 1) {
      stats.successfulRetries++;
    } else if (!success) {
      stats.failedRetries++;
    }
  }

  getStats(serviceName: string): ResilienceStats {
    const stats: ResilienceStats = {
      service: serviceName
    };

    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker) {
      stats.circuitBreakerState = circuitBreaker.getStats().state;
    }

    const rateLimiter = this.rateLimiters.get(serviceName);
    if (rateLimiter) {
      const rlStats = rateLimiter.getStats();
      stats.rateLimiterStats = {
        availableTokens: rlStats.availableTokens,
        maxTokens: rlStats.maxTokens,
        isLimited: rlStats.isLimited
      };
    }

    const retryStats = this.retryStats.get(serviceName);
    if (retryStats) {
      stats.retryStats = { ...retryStats };
    }

    return stats;
  }

  getAllStats(): ResilienceStats[] {
    const allServices = new Set([
      ...this.serviceConfigs.keys(),
      ...this.circuitBreakers.keys(),
      ...this.rateLimiters.keys()
    ]);

    return Array.from(allServices).map(service => this.getStats(service));
  }

  resetService(serviceName: string): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker) {
      circuitBreaker.reset();
    }

    const rateLimiter = this.rateLimiters.get(serviceName);
    if (rateLimiter) {
      rateLimiter.reset();
    }

    this.retryStats.delete(serviceName);
    
    this.logger.info(`Resilience reset for service: ${serviceName}`);
  }

  resetAll(): void {
    this.circuitBreakers.forEach(cb => cb.reset());
    this.rateLimiters.forEach(rl => rl.reset());
    this.retryStats.clear();
    
    this.logger.info('All resilience components reset');
  }

  isServiceHealthy(serviceName: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker && circuitBreaker.isOpen()) {
      return false;
    }

    const rateLimiter = this.rateLimiters.get(serviceName);
    if (rateLimiter && rateLimiter.getStats().isLimited) {
      return false;
    }

    return true;
  }
}