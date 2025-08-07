import { z } from 'zod';

/**
 * Environment variable validation schema using Zod
 * Ensures all required environment variables are present and valid
 */

// Core required variables
const CoreEnvSchema = z.object({
  // WhatsApp Integration (Z-API)
  Z_API_INSTANCE_ID: z.string().min(1, 'Z-API Instance ID is required'),
  Z_API_INSTANCE_TOKEN: z.string().min(1, 'Z-API Instance Token is required'),
  Z_API_CLIENT_TOKEN: z.string().min(1, 'Z-API Client Token is required'),  // Used for webhook authentication
  
  // OpenAI Integration
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API Key is required'),
  
  // KV Storage
  USER_CONFIGS: z.any(), // KV Namespace object
  
  // Webhook Security
  WEBHOOK_SECRET: z.string().min(1, 'Webhook secret is required'),
});

// Optional feature-specific variables
const OptionalEnvSchema = z.object({
  // Todoist Integration
  TODOIST_API_TOKEN: z.string().optional(),
  
  // Portfolio Tracking
  BRAPI_TOKEN: z.string().optional(),
  PORTFOLIO_WHATSAPP_NUMBER: z.string().regex(/^\d+$/).optional(),
  PORTFOLIO_DATA: z.string().optional().default('[]'),
  
  // Fund Tracking
  ZAISEN_API_KEY: z.string().optional(),
  ZAISEN_API_URL: z.string().url().optional(),
  FUND_PORTFOLIO_DATA: z.string().optional().default('[]'),
  
  // GitHub Discovery
  GITHUB_DISCOVERY_ENABLED: z.enum(['true', 'false']).optional().default('false'),
  GITHUB_DISCOVERY_WHATSAPP_NUMBER: z.string().regex(/^\d+$/).optional(),
  GITHUB_SCRAPER_API_URL: z.string().url().optional(),
  GITHUB_SCRAPER_API_KEY: z.string().optional(),
  TWITTER_BEARER_TOKEN: z.string().optional(),
  TWITTER_USERNAME: z.string().optional(),
  TWITTER_PASSWORD: z.string().optional(),
  TWITTER_EMAIL: z.string().email().optional(),
  
  // Obsidian Voice Sync API
  OBSIDIAN_API_KEY: z.string().optional(),
  
  // Feature Flags
  CLASSIFICATION_ENABLED: z.enum(['true', 'false']).optional().default('false'),
});

// Complete environment schema
export const EnvSchema = CoreEnvSchema.merge(OptionalEnvSchema);

// Inferred TypeScript type from schema
export type ValidatedEnv = z.infer<typeof EnvSchema>;

// Feature availability checks based on environment
export const FeatureChecks = {
  todoistEnabled: (env: ValidatedEnv): boolean => {
    return !!env.TODOIST_API_TOKEN;
  },
  
  portfolioEnabled: (env: ValidatedEnv): boolean => {
    return !!(
      env.BRAPI_TOKEN && 
      env.PORTFOLIO_WHATSAPP_NUMBER
    );
  },
  
  fundTrackingEnabled: (env: ValidatedEnv): boolean => {
    return !!(
      env.ZAISEN_API_KEY && 
      env.ZAISEN_API_URL
    );
  },
  
  githubDiscoveryEnabled: (env: ValidatedEnv): boolean => {
    return (
      env.GITHUB_DISCOVERY_ENABLED === 'true' &&
      !!env.GITHUB_DISCOVERY_WHATSAPP_NUMBER &&
      !!env.OPENAI_API_KEY
    );
  },
  
  obsidianSyncEnabled: (env: ValidatedEnv): boolean => {
    return !!env.OBSIDIAN_API_KEY;
  },
  
  classificationEnabled: (env: ValidatedEnv): boolean => {
    return env.CLASSIFICATION_ENABLED === 'true';
  },
};

/**
 * Validates environment variables and returns typed result
 * Throws detailed error if validation fails
 * @param strict - If false, validation is more lenient for Cloudflare Workers runtime
 */
export function validateEnvironment(env: unknown, strict = false): ValidatedEnv {
  try {
    if (!strict) {
      // In non-strict mode (production Cloudflare Workers), 
      // treat all fields as optional and present
      const lenientSchema = z.object({
        // KV namespace
        USER_CONFIGS: z.any(),
        
        // These will be accessed at runtime from the env binding
        Z_API_INSTANCE_ID: z.any().optional(),
        Z_API_INSTANCE_TOKEN: z.any().optional(),
        Z_API_CLIENT_TOKEN: z.any().optional(),
        Z_API_SECURITY_TOKEN: z.any().optional(),  // Keep for backward compatibility
        OPENAI_API_KEY: z.any().optional(),
        WEBHOOK_SECRET: z.any().optional(),
        
        // All optional fields remain optional
        TODOIST_API_TOKEN: z.any().optional(),
        BRAPI_TOKEN: z.any().optional(),
        PORTFOLIO_WHATSAPP_NUMBER: z.any().optional(),
        PORTFOLIO_DATA: z.any().optional(),
        ZAISEN_API_KEY: z.any().optional(),
        ZAISEN_API_URL: z.any().optional(),
        FUND_PORTFOLIO_DATA: z.any().optional(),
        GITHUB_DISCOVERY_ENABLED: z.any().optional(),
        GITHUB_DISCOVERY_WHATSAPP_NUMBER: z.any().optional(),
        GITHUB_SCRAPER_API_URL: z.any().optional(),
        GITHUB_SCRAPER_API_KEY: z.any().optional(),
        TWITTER_BEARER_TOKEN: z.any().optional(),
        TWITTER_USERNAME: z.any().optional(),
        TWITTER_PASSWORD: z.any().optional(),
        TWITTER_EMAIL: z.any().optional(),
        OBSIDIAN_API_KEY: z.any().optional(),
        CLASSIFICATION_ENABLED: z.any().optional(),
      });
      
      return lenientSchema.parse(env) as ValidatedEnv;
    }
    
    // Strict mode for local development
    return EnvSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => {
        return `  - ${issue.path.join('.')}: ${issue.message}`;
      }).join('\n');
      
      throw new Error(
        `Environment validation failed:\n${issues}\n\n` +
        `Please ensure all required environment variables are set correctly.`
      );
    }
    throw error;
  }
}

/**
 * Creates a safe environment object with defaults for testing
 */
export function createTestEnvironment(overrides?: Partial<ValidatedEnv>): ValidatedEnv {
  const testEnv = {
    // Required
    Z_API_INSTANCE_ID: 'test-instance-id',
    Z_API_INSTANCE_TOKEN: 'test-instance-token',
    Z_API_SECURITY_TOKEN: 'test-security-token',
    OPENAI_API_KEY: 'test-openai-key',
    USER_CONFIGS: {} as any, // Mock KV namespace
    WEBHOOK_SECRET: 'test-webhook-secret',
    
    // Optional with defaults
    PORTFOLIO_DATA: '[]',
    FUND_PORTFOLIO_DATA: '[]',
    GITHUB_DISCOVERY_ENABLED: 'false' as const,
    CLASSIFICATION_ENABLED: 'false' as const,
    
    // Apply overrides
    ...overrides,
  };
  
  return EnvSchema.parse(testEnv);
}

/**
 * Runtime helper to safely access environment variables in Cloudflare Workers
 * Returns the value if present, undefined otherwise
 */
export function getRuntimeEnv<K extends keyof ValidatedEnv>(
  env: any,
  key: K
): ValidatedEnv[K] | undefined {
  try {
    const value = env[key];
    // Check if value exists and is not just an empty binding
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
    return undefined;
  } catch {
    // Some bindings might throw when accessed incorrectly
    return undefined;
  }
}

/**
 * Checks if a required environment variable is available at runtime
 */
export function hasRuntimeEnv(
  env: any,
  key: keyof ValidatedEnv
): boolean {
  return getRuntimeEnv(env, key) !== undefined;
}

/**
 * Creates a runtime environment wrapper with safe access
 */
export function createRuntimeEnv(env: any): ValidatedEnv {
  return new Proxy(env, {
    get(target, prop: string) {
      // KV namespaces and other bindings are always returned as-is
      if (prop === 'USER_CONFIGS') {
        return target[prop];
      }
      
      // For secrets, return the value or undefined
      const value = target[prop];
      if (value === undefined || value === null || value === '') {
        return undefined;
      }
      return value;
    }
  }) as ValidatedEnv;
}

/**
 * Masks sensitive values in environment for logging
 */
export function maskSensitiveEnv(env: ValidatedEnv): Record<string, string> {
  const masked: Record<string, string> = {};
  const sensitiveKeys = [
    'Z_API_INSTANCE_TOKEN',
    'Z_API_CLIENT_TOKEN',
    'Z_API_SECURITY_TOKEN',  // deprecated
    'OPENAI_API_KEY',
    'TODOIST_API_TOKEN',
    'BRAPI_TOKEN',
    'ZAISEN_API_KEY',
    'GITHUB_TOKEN',
    'TWITTER_BEARER_TOKEN',
    'TWITTER_PASSWORD',
    'WEBHOOK_SECRET',
    'API_KEY_HASH',
    'GITHUB_SCRAPER_API_KEY',
  ];
  
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || value === null) continue;
    
    if (sensitiveKeys.includes(key)) {
      masked[key] = value.toString().substring(0, 4) + '****';
    } else if (key === 'USER_CONFIGS') {
      masked[key] = '[KVNamespace]';
    } else {
      masked[key] = value.toString();
    }
  }
  
  return masked;
}