import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ServiceRegistry, DependencyContainer } from '../../src/core/services/ServiceRegistry';
import { createEventBus } from '../../src/core/event-bus/EventBus';
import { Logger } from '../../src/core/logging/Logger';
import { ErrorHandler } from '../../src/core/logging/ErrorHandler';
import { createMockEnv, createMockKVNamespace } from '../setup';

describe('Service Integration', () => {
  let registry: ServiceRegistry;
  let container: DependencyContainer;
  
  beforeEach(() => {
    registry = new ServiceRegistry();
    container = new DependencyContainer(registry);
  });
  
  afterEach(() => {
    container.dispose();
  });
  
  describe('Service Registry', () => {
    it('should register and resolve services', () => {
      const testService = { name: 'test' };
      registry.registerInstance('test', testService);
      
      const resolved = container.resolve('test');
      expect(resolved).toBe(testService);
    });
    
    it('should support singleton lifetime', () => {
      let instanceCount = 0;
      registry.registerSingleton('singleton', () => {
        instanceCount++;
        return { id: instanceCount };
      });
      
      const first = container.resolve('singleton');
      const second = container.resolve('singleton');
      
      expect(first).toBe(second);
      expect(instanceCount).toBe(1);
    });
    
    it('should support scoped lifetime', () => {
      let instanceCount = 0;
      registry.registerScoped('scoped', () => {
        instanceCount++;
        return { id: instanceCount };
      });
      
      const scope1 = container.createScope();
      const scope2 = container.createScope();
      
      const first = scope1.resolve('scoped');
      const second = scope1.resolve('scoped');
      const third = scope2.resolve('scoped');
      
      expect(first).toBe(second);
      expect(first).not.toBe(third);
      expect(instanceCount).toBe(2);
    });
    
    it('should support transient lifetime', () => {
      let instanceCount = 0;
      registry.registerTransient('transient', () => {
        instanceCount++;
        return { id: instanceCount };
      });
      
      const first = container.resolve('transient');
      const second = container.resolve('transient');
      
      expect(first).not.toBe(second);
      expect(instanceCount).toBe(2);
    });
  });
  
  describe('Event Bus', () => {
    it('should publish and subscribe to events', async () => {
      const logger = new Logger({ level: 'debug' });
      const eventBus = createEventBus(logger);
      
      let receivedEvent: any = null;
      eventBus.subscribe('test.event', (event) => {
        receivedEvent = event;
      });
      
      await eventBus.publish({
        id: 'evt_123',
        type: 'test.event',
        payload: { data: 'test' },
        metadata: {
          timestamp: new Date(),
          source: 'test',
          version: 1,
        },
      });
      
      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent.payload.data).toBe('test');
    });
    
    it('should handle multiple subscribers', async () => {
      const eventBus = createEventBus();
      
      let count = 0;
      eventBus.subscribe('test.event', () => count++);
      eventBus.subscribe('test.event', () => count++);
      eventBus.subscribe('test.event', () => count++);
      
      await eventBus.publish({
        id: 'evt_123',
        type: 'test.event',
        payload: {},
        metadata: {
          timestamp: new Date(),
          source: 'test',
          version: 1,
        },
      });
      
      expect(count).toBe(3);
    });
    
    it('should support wildcard subscriptions', async () => {
      const eventBus = createEventBus();
      
      const receivedEvents: string[] = [];
      eventBus.subscribe('*', (event) => {
        receivedEvents.push(event.type);
      });
      
      await eventBus.publish({
        id: 'evt_1',
        type: 'event.one',
        payload: {},
        metadata: { timestamp: new Date(), source: 'test', version: 1 },
      });
      
      await eventBus.publish({
        id: 'evt_2',
        type: 'event.two',
        payload: {},
        metadata: { timestamp: new Date(), source: 'test', version: 1 },
      });
      
      expect(receivedEvents).toEqual(['event.one', 'event.two']);
    });
  });
  
  describe('Logger', () => {
    it('should log at different levels', () => {
      const logger = new Logger({ level: 'debug', enableConsole: false, enableBuffer: true });
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message', new Error('test error'));
      
      const buffer = logger.getBuffer();
      expect(buffer).toHaveLength(4);
      expect(buffer[0].message).toBe('debug message');
      expect(buffer[3].message).toBe('error message');
    });
    
    it('should create child loggers with context', () => {
      const logger = new Logger({ enableConsole: false, enableBuffer: true });
      const childLogger = logger.child({ module: 'test-module' });
      
      childLogger.info('test message');
      
      const buffer = childLogger.getBuffer();
      expect(buffer[0].context?.module).toBe('test-module');
    });
  });
  
  describe('Error Handler', () => {
    it('should handle operational errors', () => {
      const logger = new Logger({ enableConsole: false });
      const errorHandler = new ErrorHandler(logger);
      
      const error = errorHandler.createError('Test error', 'TEST_ERROR');
      
      expect(errorHandler.isOperational(error)).toBe(true);
      expect(() => errorHandler.handle(error)).not.toThrow();
    });
    
    it('should identify retryable errors', () => {
      const logger = new Logger({ enableConsole: false });
      const errorHandler = new ErrorHandler(logger);
      
      const timeoutError = new Error('Request timeout');
      const validationError = new Error('Validation failed');
      
      expect(errorHandler.shouldRetry(timeoutError)).toBe(true);
      expect(errorHandler.shouldRetry(validationError)).toBe(false);
    });
  });
});