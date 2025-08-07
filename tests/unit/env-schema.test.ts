import { describe, it, expect } from 'vitest';
import { 
  validateEnvironment, 
  createTestEnvironment, 
  maskSensitiveEnv,
  FeatureChecks 
} from '../../src/core/config/env-schema';

describe('Environment Schema Validation', () => {
  describe('validateEnvironment', () => {
    it('should validate a complete valid environment', () => {
      const env = {
        Z_API_INSTANCE_ID: 'instance-123',
        Z_API_INSTANCE_TOKEN: 'token-abc',
        Z_API_SECURITY_TOKEN: 'security-xyz',
        OPENAI_API_KEY: 'sk-openai-key',
        USER_CONFIGS: {},
        WEBHOOK_SECRET: 'webhook-secret-123',
        TODOIST_API_TOKEN: 'todoist-token',
        BRAPI_TOKEN: 'brapi-token',
        PORTFOLIO_WHATSAPP_NUMBER: '5511999999999',
      };
      
      const validated = validateEnvironment(env);
      expect(validated).toBeDefined();
      expect(validated.Z_API_INSTANCE_ID).toBe('instance-123');
    });
    
    it('should fail when required fields are missing', () => {
      const env = {
        Z_API_INSTANCE_ID: 'instance-123',
        // Missing other required fields
      };
      
      expect(() => validateEnvironment(env)).toThrow('Environment validation failed');
    });
    
    it('should allow optional fields to be undefined', () => {
      const env = {
        Z_API_INSTANCE_ID: 'instance-123',
        Z_API_INSTANCE_TOKEN: 'token-abc',
        Z_API_SECURITY_TOKEN: 'security-xyz',
        OPENAI_API_KEY: 'sk-openai-key',
        USER_CONFIGS: {},
        WEBHOOK_SECRET: 'webhook-secret-123',
        // No optional fields
      };
      
      const validated = validateEnvironment(env);
      expect(validated.TODOIST_API_TOKEN).toBeUndefined();
      expect(validated.GITHUB_DISCOVERY_ENABLED).toBe('false');
    });
    
    it('should validate phone number format', () => {
      const invalidEnv = {
        Z_API_INSTANCE_ID: 'instance-123',
        Z_API_INSTANCE_TOKEN: 'token-abc',
        Z_API_SECURITY_TOKEN: 'security-xyz',
        OPENAI_API_KEY: 'sk-openai-key',
        USER_CONFIGS: {},
        WEBHOOK_SECRET: 'webhook-secret-123',
        PORTFOLIO_WHATSAPP_NUMBER: 'invalid-phone', // Invalid format
      };
      
      expect(() => validateEnvironment(invalidEnv)).toThrow('Invalid string: must match pattern');
    });
  });
  
  describe('createTestEnvironment', () => {
    it('should create a valid test environment', () => {
      const testEnv = createTestEnvironment();
      
      expect(testEnv.Z_API_INSTANCE_ID).toBe('test-instance-id');
      expect(testEnv.OPENAI_API_KEY).toBe('test-openai-key');
      expect(testEnv.GITHUB_DISCOVERY_ENABLED).toBe('false');
    });
    
    it('should allow overrides', () => {
      const testEnv = createTestEnvironment({
        OPENAI_API_KEY: 'custom-key',
        GITHUB_DISCOVERY_ENABLED: 'true',
      });
      
      expect(testEnv.OPENAI_API_KEY).toBe('custom-key');
      expect(testEnv.GITHUB_DISCOVERY_ENABLED).toBe('true');
    });
  });
  
  describe('maskSensitiveEnv', () => {
    it('should mask sensitive values', () => {
      const env = createTestEnvironment({
        OPENAI_API_KEY: 'sk-1234567890abcdef',
        TODOIST_API_TOKEN: 'todoist-secret-token',
      });
      
      const masked = maskSensitiveEnv(env);
      
      expect(masked.OPENAI_API_KEY).toBe('sk-1****');
      expect(masked.TODOIST_API_TOKEN).toBe('todo****');
      expect(masked.Z_API_INSTANCE_ID).toBe('test-instance-id'); // Not masked
    });
    
    it('should handle KV namespace specially', () => {
      const env = createTestEnvironment();
      const masked = maskSensitiveEnv(env);
      
      expect(masked.USER_CONFIGS).toBe('[KVNamespace]');
    });
  });
  
  describe('FeatureChecks', () => {
    it('should correctly determine feature availability', () => {
      const env = createTestEnvironment();
      
      expect(FeatureChecks.todoistEnabled(env)).toBe(false);
      expect(FeatureChecks.portfolioEnabled(env)).toBe(false);
      expect(FeatureChecks.githubDiscoveryEnabled(env)).toBe(false);
      expect(FeatureChecks.classificationEnabled(env)).toBe(false);
    });
    
    it('should detect enabled features', () => {
      const env = createTestEnvironment({
        TODOIST_API_TOKEN: 'token',
        BRAPI_TOKEN: 'brapi',
        PORTFOLIO_WHATSAPP_NUMBER: '5511999999999',
        CLASSIFICATION_ENABLED: 'true',
      });
      
      expect(FeatureChecks.todoistEnabled(env)).toBe(true);
      expect(FeatureChecks.portfolioEnabled(env)).toBe(true);
      expect(FeatureChecks.classificationEnabled(env)).toBe(true);
    });
    
    it('should require all dependencies for complex features', () => {
      const env = createTestEnvironment({
        GITHUB_DISCOVERY_ENABLED: 'true',
        // Missing GITHUB_DISCOVERY_WHATSAPP_NUMBER
      });
      
      expect(FeatureChecks.githubDiscoveryEnabled(env)).toBe(false);
    });
  });
});