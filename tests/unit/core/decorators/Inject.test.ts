import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { Inject, getInjectionTokens, getInjectionOptions, getPropertyInjections, Optional } from '@core/decorators/Inject';
import { Injectable, clearServiceRegistry } from '@core/decorators/Injectable';

describe('Inject Decorator', () => {
  beforeEach(() => {
    clearServiceRegistry();
  });

  describe('Parameter Injection', () => {
    it('should inject custom tokens in constructor parameters', () => {
      @Injectable()
      class TestService {
        constructor(@Inject('CustomToken') dependency: any) {}
      }

      const tokens = getInjectionTokens(TestService);
      expect(tokens).toEqual(['CustomToken']);
    });

    it('should inject multiple tokens', () => {
      @Injectable()
      class TestService {
        constructor(
          @Inject('Token1') dep1: any,
          @Inject('Token2') dep2: any
        ) {}
      }

      const tokens = getInjectionTokens(TestService);
      expect(tokens).toEqual(['Token1', 'Token2']);
    });

    it('should handle optional parameters', () => {
      @Injectable()
      class TestService {
        constructor(
          @Inject('Token1', { optional: true }) dep1: any,
          @Inject('Token2') dep2: any
        ) {}
      }

      const options = getInjectionOptions(TestService);
      expect(options[0]).toEqual({ optional: true });
      expect(options[1]).toEqual({});
    });

    it('should support Optional decorator shorthand', () => {
      @Injectable()
      class TestService {
        constructor(@Optional() dep: any) {}
      }

      const options = getInjectionOptions(TestService);
      expect(options[0]).toEqual({ optional: true });
    });

    it('should handle mixed injection scenarios', () => {
      @Injectable()
      class DependencyService {}

      @Injectable()
      class TestService {
        constructor(
          dep1: DependencyService,
          @Inject('CustomToken') dep2: any,
          @Optional() dep3: any
        ) {}
      }

      const tokens = getInjectionTokens(TestService);
      const options = getInjectionOptions(TestService);
      
      expect(tokens[0]).toBeUndefined(); // No custom token, uses type
      expect(tokens[1]).toBe('CustomToken');
      expect(tokens[2]).toBeUndefined(); // Optional uses type
      expect(options[2]).toEqual({ optional: true });
    });
  });

  describe('Property Injection', () => {
    it('should inject properties with custom tokens', () => {
      @Injectable()
      class TestService {
        @Inject('PropertyToken')
        dependency: any;
      }

      const injections = getPropertyInjections(TestService.prototype);
      expect(injections.get('dependency')).toEqual({
        token: 'PropertyToken',
        options: {}
      });
    });

    it('should inject optional properties', () => {
      @Injectable()
      class TestService {
        @Inject('Token', { optional: true })
        dependency: any;
      }

      const injections = getPropertyInjections(TestService.prototype);
      expect(injections.get('dependency')?.options).toEqual({ optional: true });
    });

    it('should handle multiple property injections', () => {
      @Injectable()
      class TestService {
        @Inject('Token1')
        dep1: any;

        @Inject('Token2', { optional: true })
        dep2: any;

        @Optional()
        dep3: any;
      }

      const injections = getPropertyInjections(TestService.prototype);
      expect(injections.size).toBe(3);
      expect(injections.get('dep1')?.token).toBe('Token1');
      expect(injections.get('dep2')?.token).toBe('Token2');
      expect(injections.get('dep2')?.options.optional).toBe(true);
      expect(injections.get('dep3')?.options.optional).toBe(true);
    });

    it('should handle symbol property keys', () => {
      const symbolKey = Symbol('testKey');

      @Injectable()
      class TestService {
        @Inject('Token')
        [symbolKey]: any;
      }

      const injections = getPropertyInjections(TestService.prototype);
      expect(injections.get(symbolKey)).toBeDefined();
    });
  });

  describe('Injection Tokens', () => {
    it('should support string tokens', () => {
      @Injectable()
      class TestService {
        constructor(@Inject('stringToken') dep: any) {}
      }

      const tokens = getInjectionTokens(TestService);
      expect(tokens[0]).toBe('stringToken');
    });

    it('should support symbol tokens', () => {
      const symbolToken = Symbol('symbolToken');

      @Injectable()
      class TestService {
        constructor(@Inject(symbolToken) dep: any) {}
      }

      const tokens = getInjectionTokens(TestService);
      expect(tokens[0]).toBe(symbolToken);
    });

    it('should support class tokens', () => {
      @Injectable()
      class DependencyService {}

      @Injectable()
      class TestService {
        constructor(@Inject(DependencyService) dep: any) {}
      }

      const tokens = getInjectionTokens(TestService);
      expect(tokens[0]).toBe(DependencyService);
    });
  });

  describe('Factory Functions', () => {
    it('should support factory functions in injection options', () => {
      const factory = () => ({ value: 'test' });

      @Injectable()
      class TestService {
        constructor(@Inject('Token', { factory }) dep: any) {}
      }

      const options = getInjectionOptions(TestService);
      expect(options[0].factory).toBe(factory);
    });

    it('should combine factory with optional', () => {
      const factory = () => ({ value: 'test' });

      @Injectable()
      class TestService {
        constructor(@Inject('Token', { factory, optional: true }) dep: any) {}
      }

      const options = getInjectionOptions(TestService);
      expect(options[0]).toEqual({
        factory,
        optional: true
      });
    });
  });
});