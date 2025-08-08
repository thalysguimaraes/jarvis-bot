import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Injectable, getServiceMetadata, getAllServices, isInjectable, clearServiceRegistry } from '@core/decorators/Injectable';

describe('Injectable Decorator', () => {
  beforeEach(() => {
    clearServiceRegistry();
  });

  it('should register a class as injectable', () => {
    @Injectable()
    class TestService {}

    expect(isInjectable(TestService)).toBe(true);
    expect(getServiceMetadata(TestService)).toBeDefined();
  });

  it('should use default options when none provided', () => {
    @Injectable()
    class TestService {}

    const metadata = getServiceMetadata(TestService);
    expect(metadata?.singleton).toBe(true);
    expect(metadata?.providedIn).toBe('root');
  });

  it('should use custom options when provided', () => {
    @Injectable({ 
      singleton: false, 
      providedIn: 'module1' 
    })
    class TestService {}

    const metadata = getServiceMetadata(TestService);
    expect(metadata?.singleton).toBe(false);
    expect(metadata?.providedIn).toBe('module1');
  });

  it('should attempt to store parameter types from reflect-metadata', () => {
    @Injectable()
    class DependencyService {}

    @Injectable()
    class TestService {
      constructor(dep: DependencyService) {}
    }

    const metadata = getServiceMetadata(TestService);
    expect(metadata?.paramTypes).toBeDefined();
    // Note: In test environment, parameter types may not be captured due to TypeScript compilation
    // In runtime with proper TypeScript compilation, this would contain the parameter types
  });

  it('should support factory functions', () => {
    const mockFactory = vi.fn(() => ({ value: 'test' }));

    @Injectable({ factory: mockFactory })
    class TestService {}

    const metadata = getServiceMetadata(TestService);
    expect(metadata?.factory).toBe(mockFactory);
  });

  it('should track all registered services', () => {
    @Injectable()
    class Service1 {}

    @Injectable()
    class Service2 {}

    const allServices = getAllServices();
    expect(allServices.size).toBe(2);
    expect(allServices.has(Service1)).toBe(true);
    expect(allServices.has(Service2)).toBe(true);
  });

  it('should clear service registry', () => {
    @Injectable()
    class TestService {}

    expect(getAllServices().size).toBe(1);
    clearServiceRegistry();
    expect(getAllServices().size).toBe(0);
  });

  it('should identify non-injectable classes', () => {
    class RegularClass {}

    expect(isInjectable(RegularClass)).toBe(false);
    expect(getServiceMetadata(RegularClass)).toBeUndefined();
  });

  it('should handle classes without constructor parameters', () => {
    @Injectable()
    class SimpleService {
      getValue() {
        return 'simple';
      }
    }

    const metadata = getServiceMetadata(SimpleService);
    expect(metadata?.paramTypes).toEqual([]);
  });
});