import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceFactoryV2, createServiceFactoryV2 } from '@core/services/ServiceFactoryV2';
import { ValidatedEnv } from '@core/config/env-schema';
import { clearServiceRegistry } from '@core/decorators/Injectable';

describe('ServiceFactoryV2', () => {
  let mockEnv: ValidatedEnv;

  beforeEach(() => {
    clearServiceRegistry();
    vi.clearAllMocks();

    mockEnv = {
      Z_API_INSTANCE_ID: 'test_instance_id',
      Z_API_INSTANCE_TOKEN: 'test_instance_token',
      Z_API_CLIENT_TOKEN: 'test_client_token',
      OPENAI_API_KEY: 'test_openai_key',
      TODOIST_API_TOKEN: 'test_todoist_token',
      OBSIDIAN_API_KEY: 'test_obsidian_key',
      BRAPI_TOKEN: 'test_brapi_token',
      PORTFOLIO_WHATSAPP_NUMBER: '5511999999999',
      USER_CONFIGS: {} as any,
      WEBHOOK_SECRET: 'test_webhook_secret',
    };
  });

  describe('Service Registration', () => {
    it('should initialize with all core services', async () => {
      const factory = new ServiceFactoryV2(mockEnv);
      const container = await factory.initialize();

      // Check that core services are registered
      expect(container.has('ValidatedEnv')).toBe(true);
      expect(container.has('IConfigService')).toBe(true);
      expect(container.has('ILogger')).toBe(true);
      expect(container.has('IErrorHandler')).toBe(true);
      expect(container.has('IEventBus')).toBe(true);
      expect(container.has('ITypedEventBus')).toBe(true);
    });

    it('should register business services when credentials available', async () => {
      const factory = new ServiceFactoryV2(mockEnv);
      const container = await factory.initialize();

      // Check that business services are registered when credentials are available
      expect(container.has('IMessagingService')).toBe(true);
      expect(container.has('IStorageService')).toBe(true);
      expect(container.has('IAIService')).toBe(true);
    });

    it('should skip services when credentials are missing', async () => {
      const incompleteEnv = {
        ...mockEnv,
        OPENAI_API_KEY: '', // Missing API key
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const factory = new ServiceFactoryV2(incompleteEnv);
      await factory.initialize();

      // Should warn about missing AI service
      expect(consoleSpy).toHaveBeenCalledWith(
        'AI service not available:', 
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Service Resolution', () => {
    it('should resolve services through container', async () => {
      const factory = new ServiceFactoryV2(mockEnv);
      await factory.initialize();

      const configService = factory.resolve('IConfigService');
      expect(configService).toBeDefined();
      expect(typeof configService.get).toBe('function');

      const logger = factory.resolve('ILogger');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('should maintain singleton behavior', async () => {
      const factory = new ServiceFactoryV2(mockEnv);
      await factory.initialize();

      const configService1 = factory.resolve('IConfigService');
      const configService2 = factory.resolve('IConfigService');
      
      expect(configService1).toBe(configService2);
    });

    it('should resolve dependencies correctly', async () => {
      const factory = new ServiceFactoryV2(mockEnv);
      const container = await factory.initialize();

      // TypedEventBus depends on IEventBus, ILogger, and IConfigService
      const typedEventBus = container.resolve('ITypedEventBus');
      expect(typedEventBus).toBeDefined();
      
      // ErrorHandler depends on ILogger
      const errorHandler = container.resolve('IErrorHandler');
      expect(errorHandler).toBeDefined();
    });
  });

  describe('Configuration Integration', () => {
    it('should create ConfigService with provided environment', async () => {
      const factory = new ServiceFactoryV2(mockEnv);
      await factory.initialize();

      const configService = factory.resolve('IConfigService');
      const environment = configService.getEnvironment();
      
      expect(environment).toBeDefined();
      expect(['development', 'staging', 'production']).toContain(environment);
    });

    it('should use config service for service configuration', async () => {
      const factory = new ServiceFactoryV2(mockEnv);
      await factory.initialize();

      // The messaging service should be configured based on config service
      const messagingService = factory.resolve('IMessagingService');
      expect(messagingService).toBeDefined();
      
      // The AI service should be configured based on config service
      const aiService = factory.resolve('IAIService');
      expect(aiService).toBeDefined();
    });
  });

  describe('Health Checks', () => {
    it('should perform health checks on initialization', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const factory = new ServiceFactoryV2(mockEnv);
      await factory.initialize();

      // If health checks pass, there should be no error logs
      // If health checks fail, there should be appropriate warnings
      
      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Custom Service Registration', () => {
    it('should allow registering custom services', async () => {
      const factory = new ServiceFactoryV2(mockEnv);
      await factory.initialize();

      const customService = { getValue: () => 'custom' };
      factory.register('CustomService', customService);

      const resolved = factory.resolve('CustomService');
      expect(resolved).toBe(customService);
    });

    it('should support factory functions for custom services', async () => {
      const factory = new ServiceFactoryV2(mockEnv);
      await factory.initialize();

      const factoryFunction = vi.fn(() => ({ created: true }));
      factory.register('FactoryService', factoryFunction);

      const resolved = factory.resolve('FactoryService');
      expect(factoryFunction).toHaveBeenCalled();
      expect(resolved).toEqual({ created: true });
    });
  });

  describe('Dependency Validation', () => {
    it('should validate dependency graph during initialization', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const factory = new ServiceFactoryV2(mockEnv);
      
      // This should not throw, but may log warnings if validation fails
      await expect(factory.initialize()).resolves.toBeDefined();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Container Lifecycle', () => {
    it('should clear container when requested', async () => {
      const factory = new ServiceFactoryV2(mockEnv);
      await factory.initialize();

      expect(factory.getContainer().has('IConfigService')).toBe(true);
      
      factory.clear();
      
      expect(factory.getContainer().has('IConfigService')).toBe(false);
    });

    it('should reinitialize after clearing', async () => {
      const factory = new ServiceFactoryV2(mockEnv);
      await factory.initialize();
      
      factory.clear();
      await factory.initialize();
      
      expect(factory.getContainer().has('IConfigService')).toBe(true);
    });
  });

  describe('Factory Function', () => {
    it('should create and initialize factory via helper function', async () => {
      const factory = await createServiceFactoryV2(mockEnv);
      
      expect(factory).toBeInstanceOf(ServiceFactoryV2);
      expect(factory.getContainer().has('IConfigService')).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      const invalidEnv = {} as ValidatedEnv;
      
      // This should not throw, but may log warnings
      const factory = await createServiceFactoryV2(invalidEnv);
      expect(factory).toBeInstanceOf(ServiceFactoryV2);
    });
  });

  describe('Integration with Existing Services', () => {
    it('should work with decorated services', async () => {
      const factory = new ServiceFactoryV2(mockEnv);
      const container = await factory.initialize();

      // ZApiMessagingService is decorated with @Injectable
      const messagingService = container.resolve('IMessagingService');
      expect(messagingService).toBeDefined();
      
      // OpenAIService is decorated with @Injectable
      const aiService = container.resolve('IAIService');
      expect(aiService).toBeDefined();
      
      // ConfigService is decorated with @Injectable
      const configService = container.resolve('IConfigService');
      expect(configService).toBeDefined();
    });
  });
});