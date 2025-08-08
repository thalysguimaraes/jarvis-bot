import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceContainer, CircularDependencyError, ServiceNotFoundError } from '@core/services/AutoRegistry';
import { Injectable, clearServiceRegistry } from '@core/decorators/Injectable';
import { Inject, Optional } from '@core/decorators/Inject';

describe('ServiceContainer', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    clearServiceRegistry();
    container = new ServiceContainer();
  });

  describe('Basic Registration and Resolution', () => {
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

  describe('Dependency Injection', () => {
    it('should inject constructor dependencies', () => {
      @Injectable()
      class DatabaseService {
        connect() {
          return 'connected';
        }
      }

      @Injectable()
      class UserService {
        constructor(private db: DatabaseService) {}
        
        getUsers() {
          return this.db.connect();
        }
      }

      container.registerClass(DatabaseService);
      container.registerClass(UserService);
      
      const userService = container.resolve(UserService);
      expect(userService.getUsers()).toBe('connected');
    });

    it('should handle multiple dependencies', () => {
      @Injectable()
      class LoggerService {
        log(msg: string) {
          return `LOG: ${msg}`;
        }
      }

      @Injectable()
      class ConfigService {
        get(key: string) {
          return `config_${key}`;
        }
      }

      @Injectable()
      class AppService {
        constructor(
          private logger: LoggerService,
          private config: ConfigService
        ) {}
        
        start() {
          const config = this.config.get('app');
          return this.logger.log(`Starting with ${config}`);
        }
      }

      container.registerClass(LoggerService);
      container.registerClass(ConfigService);
      container.registerClass(AppService);
      
      const app = container.resolve(AppService);
      expect(app.start()).toBe('LOG: Starting with config_app');
    });

    it('should inject custom tokens', () => {
      interface ILogger {
        log(msg: string): string;
      }

      @Injectable()
      class ConsoleLogger implements ILogger {
        log(msg: string) {
          return `Console: ${msg}`;
        }
      }

      @Injectable()
      class UserService {
        constructor(@Inject('ILogger') private logger: ILogger) {}
        
        createUser(name: string) {
          return this.logger.log(`Creating user: ${name}`);
        }
      }

      container.register('ILogger', new ConsoleLogger());
      container.registerClass(UserService);
      
      const userService = container.resolve(UserService);
      expect(userService.createUser('John')).toBe('Console: Creating user: John');
    });

    it('should handle optional dependencies', () => {
      @Injectable()
      class OptionalService {
        getValue() {
          return 'optional';
        }
      }

      @Injectable()
      class TestService {
        constructor(
          @Optional() private optional?: OptionalService
        ) {}
        
        test() {
          return this.optional ? this.optional.getValue() : 'no optional';
        }
      }

      container.registerClass(TestService);
      
      const instance = container.resolve(TestService);
      expect(instance.test()).toBe('no optional');
      
      // Now register the optional dependency
      container.registerClass(OptionalService);
      const instance2 = container.resolve(TestService);
      expect(instance2.test()).toBe('optional');
    });
  });

  describe('Property Injection', () => {
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

    it('should inject optional properties', () => {
      @Injectable()
      class CacheService {
        get() {
          return 'cached';
        }
      }

      @Injectable()
      class UserService {
        @Inject(CacheService, { optional: true })
        cache?: CacheService;
        
        getUser() {
          return this.cache ? this.cache.get() : 'no cache';
        }
      }

      container.registerClass(UserService);
      
      const service = container.resolve(UserService);
      expect(service.getUser()).toBe('no cache');
    });
  });

  describe('Circular Dependency Detection', () => {
    it('should detect direct circular dependencies', () => {
      @Injectable()
      class ServiceA {
        constructor(serviceB: ServiceB) {}
      }

      @Injectable()
      class ServiceB {
        constructor(serviceA: ServiceA) {}
      }

      container.registerClass(ServiceA);
      container.registerClass(ServiceB);
      
      expect(() => container.resolve(ServiceA)).toThrow(CircularDependencyError);
    });

    it('should detect indirect circular dependencies', () => {
      @Injectable()
      class ServiceA {
        constructor(serviceB: ServiceB) {}
      }

      @Injectable()
      class ServiceB {
        constructor(serviceC: ServiceC) {}
      }

      @Injectable()
      class ServiceC {
        constructor(serviceA: ServiceA) {}
      }

      container.registerClass(ServiceA);
      container.registerClass(ServiceB);
      container.registerClass(ServiceC);
      
      expect(() => container.resolve(ServiceA)).toThrow(CircularDependencyError);
    });

    it('should validate dependency graph without throwing', () => {
      @Injectable()
      class ServiceA {
        constructor(serviceB: ServiceB) {}
      }

      @Injectable()
      class ServiceB {
        constructor(serviceA: ServiceA) {}
      }

      container.registerClass(ServiceA);
      container.registerClass(ServiceB);
      
      expect(() => container.validateDependencyGraph()).toThrow(CircularDependencyError);
    });
  });

  describe('Error Handling', () => {
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