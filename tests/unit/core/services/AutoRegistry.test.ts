import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceContainer, ServiceNotFoundError } from '@core/services/AutoRegistry';
import { Injectable, clearServiceRegistry } from '@core/decorators/Injectable';
import { Inject, Optional } from '@core/decorators/Inject';

/**
 * Tests for ServiceContainer (AutoRegistry)
 * 
 * Note: This tests the low-level DI container. For comprehensive integration tests
 * of the full DI system including advanced features like constructor injection,
 * optional dependencies, and circular dependency detection, see ServiceFactoryV2.test.ts
 */
describe('ServiceContainer', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    clearServiceRegistry();
    container = new ServiceContainer();
  });

  describe('Basic Registration and Resolution', () => {
    // Tests core container functionality: registering and resolving services
    it('should register and resolve a simple service', () => {
      @Injectable()
      class SimpleService {
        getValue() {
          return 'simple';
        }
      }

      container.registerClass(SimpleService);
      const instance = container.resolve(SimpleService);
      expect(instance).toBeInstanceOf(SimpleService);
      expect(instance.getValue()).toBe('simple');
    });

    it('should register value providers', () => {
      const value = { config: 'test' };
      container.register('Config', value);
      
      const resolved = container.resolve('Config');
      expect(resolved).toBe(value);
    });

    it('should register factory providers', () => {
      const factory = vi.fn(() => ({ created: Date.now() }));
      container.register('Factory', factory);
      
      const resolved = container.resolve('Factory');
      expect(factory).toHaveBeenCalled();
      expect(resolved).toHaveProperty('created');
    });

    it('should enforce singleton behavior by default', () => {
      @Injectable()
      class SingletonService {
        id = Math.random();
      }

      container.registerClass(SingletonService);
      const instance1 = container.resolve(SingletonService);
      const instance2 = container.resolve(SingletonService);
      
      expect(instance1).toBe(instance2);
      expect(instance1.id).toBe(instance2.id);
    });

    it('should support non-singleton services', () => {
      @Injectable({ singleton: false })
      class TransientService {
        id = Math.random();
      }

      container.registerClass(TransientService);
      const instance1 = container.resolve(TransientService);
      const instance2 = container.resolve(TransientService);
      
      expect(instance1).not.toBe(instance2);
      expect(instance1.id).not.toBe(instance2.id);
    });
  });

  // Note: Advanced dependency injection features (constructor injection, optional dependencies)
  // are tested comprehensively in ServiceFactoryV2.test.ts which uses AutoRegistry internally.

  describe('Property Injection', () => {
    // Tests basic property injection (advanced cases tested in ServiceFactoryV2)
    it('should inject properties', () => {
      @Injectable()
      class DatabaseService {
        query() {
          return 'query result';
        }
      }

      @Injectable()
      class UserRepository {
        @Inject(DatabaseService)
        db!: DatabaseService;
        
        findAll() {
          return this.db.query();
        }
      }

      container.registerClass(DatabaseService);
      container.registerClass(UserRepository);
      
      const repo = container.resolve(UserRepository);
      expect(repo.findAll()).toBe('query result');
    });

  });

  // Note: Circular dependency detection is implemented in AutoRegistry but complex to test
  // due to TypeScript metadata issues. The functionality is validated through integration tests.

  describe('Error Handling', () => {
    // Tests error cases and service not found scenarios
    it('should throw ServiceNotFoundError for missing services', () => {
      expect(() => container.resolve('MissingService')).toThrow(ServiceNotFoundError);
    });

    it('should throw error for non-injectable classes', () => {
      class RegularClass {}
      
      expect(() => container.registerClass(RegularClass)).toThrow();
    });

    it('should handle missing dependencies gracefully with optional', () => {
      @Injectable()
      class TestService {
        constructor(@Optional() missing?: any) {}
        
        test() {
          return this.missing ? 'has dependency' : 'no dependency';
        }
      }

      container.registerClass(TestService);
      const instance = container.resolve(TestService);
      expect(instance.test()).toBe('no dependency');
    });
  });

  describe('Auto-scanning', () => {
    // Tests automatic service discovery and registration
    it('should auto-register services when enabled', () => {
      @Injectable()
      class AutoService {
        getValue() {
          return 'auto';
        }
      }

      const autoContainer = new ServiceContainer({ enableAutoScan: true });
      const instance = autoContainer.resolve(AutoService);
      expect(instance.getValue()).toBe('auto');
    });
  });

  describe('Container Management', () => {
    // Tests container lifecycle operations
    it('should clear all services', () => {
      @Injectable()
      class TestService {}
      
      container.registerClass(TestService);
      expect(container.has(TestService)).toBe(true);
      
      container.clear();
      expect(container.has(TestService)).toBe(false);
    });

    it('should check if service is registered', () => {
      @Injectable()
      class TestService {}
      
      expect(container.has(TestService)).toBe(false);
      container.registerClass(TestService);
      expect(container.has(TestService)).toBe(true);
    });

    it('should get registered services list', () => {
      @Injectable()
      class Service1 {}
      
      @Injectable()
      class Service2 {}
      
      container.registerClass(Service1);
      container.registerClass(Service2);
      
      const services = container.getRegisteredServices();
      expect(services).toContain(Service1);
      expect(services).toContain(Service2);
    });

    it('should get singleton instances', () => {
      @Injectable()
      class TestService {
        id = Math.random();
      }
      
      container.registerClass(TestService);
      const instance = container.resolve(TestService);
      
      const instances = container.getInstances();
      expect(instances.get(TestService)).toBe(instance);
    });
  });
});