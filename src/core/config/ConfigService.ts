import { Injectable } from '../decorators/Injectable';
import { ValidatedEnv, EnvSchema, FeatureChecks } from './env-schema';
import { ILogger } from '../logging/Logger';

/**
 * Centralized configuration service with type-safe access and feature flags
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface FeatureFlags {
  audioProcessing: boolean;
  taskManagement: boolean;
  noteSync: boolean;
  portfolioTracking: boolean;
  fundTracking: boolean;
  githubDiscovery: boolean;
  classification: boolean;
  debugMode: boolean;
}

export interface ServiceConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  rateLimitPerMinute: number;
}

export interface ModuleConfig {
  enabled: boolean;
  config: Record<string, any>;
}

export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  version: string;
  features: FeatureFlags;
  services: {
    zapi: ServiceConfig & {
      instanceId: string;
      instanceToken: string;
      clientToken?: string;
    };
    openai: ServiceConfig & {
      apiKey: string;
      model: string;
      maxTokens: number;
    };
    brapi: ServiceConfig & {
      token: string;
      baseUrl: string;
    };
    zaisen?: ServiceConfig & {
      apiKey: string;
      apiUrl: string;
    };
    todoist?: ServiceConfig & {
      apiToken: string;
    };
  };
  modules: Record<string, ModuleConfig>;
  storage: {
    kvNamespace: string;
    cacheEnabled: boolean;
    cacheTTLSeconds: number;
  };
  messaging: {
    defaultRecipient?: string;
    maxMessageLength: number;
    retryOnFailure: boolean;
  };
}

// ============================================================================
// Configuration Service
// ============================================================================

export interface IConfigService {
  get<T = any>(path: string): T | undefined;
  getRequired<T = any>(path: string): T;
  set(path: string, value: any): void;
  getFeatureFlags(): FeatureFlags;
  isFeatureEnabled(feature: keyof FeatureFlags): boolean;
  getServiceConfig(service: string): ServiceConfig | undefined;
  getModuleConfig(module: string): ModuleConfig | undefined;
  getEnvironment(): 'development' | 'staging' | 'production';
  reload(): Promise<void>;
}

@Injectable({ singleton: true })
export class ConfigService implements IConfigService {
  private config: AppConfig;
  private env: ValidatedEnv;
  private overrides: Map<string, any> = new Map();
  private listeners: Map<string, Set<(value: any) => void>> = new Map();
  
  constructor(
    env: ValidatedEnv,
    private logger?: ILogger
  ) {
    this.env = env;
    this.config = this.buildConfig(env);
    this.logger?.info('ConfigService initialized', {
      environment: this.config.environment,
      version: this.config.version,
      enabledFeatures: Object.entries(this.config.features)
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name),
    });
  }
  
  /**
   * Build configuration from environment variables
   */
  private buildConfig(env: ValidatedEnv): AppConfig {
    const environment = this.inferEnvironment();
    
    return {
      environment,
      version: '2.0.0', // TODO: Get from package.json or build process
      
      features: {
        audioProcessing: true, // Always enabled as core feature
        taskManagement: FeatureChecks.todoistEnabled(env),
        noteSync: FeatureChecks.obsidianSyncEnabled(env),
        portfolioTracking: FeatureChecks.portfolioEnabled(env),
        fundTracking: FeatureChecks.fundTrackingEnabled(env),
        githubDiscovery: FeatureChecks.githubDiscoveryEnabled(env),
        classification: FeatureChecks.classificationEnabled(env),
        debugMode: environment === 'development',
      },
      
      services: {
        zapi: {
          instanceId: env.Z_API_INSTANCE_ID,
          instanceToken: env.Z_API_INSTANCE_TOKEN,
          clientToken: env.Z_API_CLIENT_TOKEN,
          maxRetries: 3,
          retryDelayMs: 1000,
          timeoutMs: 30000,
          rateLimitPerMinute: 60,
        },
        
        openai: {
          apiKey: env.OPENAI_API_KEY,
          model: 'whisper-1',
          maxTokens: 4000,
          maxRetries: 2,
          retryDelayMs: 2000,
          timeoutMs: 60000,
          rateLimitPerMinute: 50,
        },
        
        brapi: {
          token: env.BRAPI_TOKEN || '',
          baseUrl: 'https://brapi.dev/api',
          maxRetries: 3,
          retryDelayMs: 1000,
          timeoutMs: 10000,
          rateLimitPerMinute: 100,
        },
        
        ...(env.ZAISEN_API_KEY && env.ZAISEN_API_URL ? {
          zaisen: {
            apiKey: env.ZAISEN_API_KEY,
            apiUrl: env.ZAISEN_API_URL,
            maxRetries: 3,
            retryDelayMs: 1000,
            timeoutMs: 15000,
            rateLimitPerMinute: 30,
          },
        } : {}),
        
        ...(env.TODOIST_API_TOKEN ? {
          todoist: {
            apiToken: env.TODOIST_API_TOKEN,
            maxRetries: 3,
            retryDelayMs: 1000,
            timeoutMs: 10000,
            rateLimitPerMinute: 100,
          },
        } : {}),
      },
      
      modules: {
        audioProcessing: {
          enabled: true,
          config: {
            maxAudioSizeMB: 25,
            supportedFormats: ['audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/mp4'],
            transcriptionLanguage: 'pt',
          },
        },
        
        notes: {
          enabled: FeatureChecks.obsidianSyncEnabled(env),
          config: {
            maxNoteLength: 10000,
            autoSync: true,
            syncIntervalMinutes: 5,
          },
        },
        
        portfolio: {
          enabled: FeatureChecks.portfolioEnabled(env),
          config: {
            whatsappNumber: env.PORTFOLIO_WHATSAPP_NUMBER,
            defaultReportTime: '09:00',
            reportFormat: 'detailed',
          },
        },
        
        fundManagement: {
          enabled: FeatureChecks.fundTrackingEnabled(env),
          config: {
            updateIntervalHours: 24,
            maxPositions: 50,
          },
        },
      },
      
      storage: {
        kvNamespace: 'USER_CONFIGS',
        cacheEnabled: true,
        cacheTTLSeconds: 300,
      },
      
      messaging: {
        defaultRecipient: env.PORTFOLIO_WHATSAPP_NUMBER,
        maxMessageLength: 4096,
        retryOnFailure: true,
      },
    };
  }
  
  /**
   * Infer environment from various sources
   */
  private inferEnvironment(): 'development' | 'staging' | 'production' {
    // Check for explicit environment variable
    const envVar = (this.env as any).ENVIRONMENT || (this.env as any).NODE_ENV;
    if (envVar) {
      return envVar as any;
    }
    
    // Infer from hostname or other indicators
    if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
      const hostname = (globalThis as any).location?.hostname;
      if (hostname?.includes('localhost') || hostname?.includes('127.0.0.1')) {
        return 'development';
      }
      if (hostname?.includes('staging')) {
        return 'staging';
      }
    }
    
    return 'production';
  }
  
  /**
   * Get configuration value by path
   */
  get<T = any>(path: string): T | undefined {
    // Check overrides first
    if (this.overrides.has(path)) {
      return this.overrides.get(path) as T;
    }
    
    // Navigate through config object
    const parts = path.split('.');
    let current: any = this.config;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current as T;
  }
  
  /**
   * Get required configuration value
   */
  getRequired<T = any>(path: string): T {
    const value = this.get<T>(path);
    if (value === undefined) {
      throw new Error(`Required configuration not found: ${path}`);
    }
    return value;
  }
  
  /**
   * Set configuration override
   */
  set(path: string, value: any): void {
    this.overrides.set(path, value);
    
    // Notify listeners
    const listeners = this.listeners.get(path);
    if (listeners) {
      listeners.forEach(listener => listener(value));
    }
    
    this.logger?.debug('Configuration override set', { path, value });
  }
  
  /**
   * Watch for configuration changes
   */
  watch(path: string, callback: (value: any) => void): () => void {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    
    this.listeners.get(path)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(path);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(path);
        }
      }
    };
  }
  
  /**
   * Get feature flags
   */
  getFeatureFlags(): FeatureFlags {
    return { ...this.config.features };
  }
  
  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return this.config.features[feature] || false;
  }
  
  /**
   * Get service configuration
   */
  getServiceConfig(service: string): ServiceConfig | undefined {
    return (this.config.services as any)[service];
  }
  
  /**
   * Get module configuration
   */
  getModuleConfig(module: string): ModuleConfig | undefined {
    return this.config.modules[module];
  }
  
  /**
   * Get environment
   */
  getEnvironment(): 'development' | 'staging' | 'production' {
    return this.config.environment;
  }
  
  /**
   * Reload configuration from environment
   */
  async reload(): Promise<void> {
    try {
      // Re-validate environment
      const validatedEnv = EnvSchema.parse(this.env);
      this.env = validatedEnv;
      
      // Rebuild configuration
      this.config = this.buildConfig(validatedEnv);
      
      // Clear overrides if needed
      // this.overrides.clear();
      
      this.logger?.info('Configuration reloaded', {
        environment: this.config.environment,
        version: this.config.version,
      });
      
      // Notify all listeners
      for (const [path, listeners] of this.listeners) {
        const value = this.get(path);
        listeners.forEach(listener => listener(value));
      }
    } catch (error) {
      this.logger?.error('Failed to reload configuration', error as Error);
      throw error;
    }
  }
  
  /**
   * Export configuration as JSON
   */
  toJSON(): string {
    return JSON.stringify({
      config: this.config,
      overrides: Object.fromEntries(this.overrides),
    }, null, 2);
  }
  
  /**
   * Get configuration summary for logging
   */
  getSummary(): Record<string, any> {
    return {
      environment: this.config.environment,
      version: this.config.version,
      features: Object.entries(this.config.features)
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name),
      services: Object.keys(this.config.services),
      modules: Object.entries(this.config.modules)
        .filter(([_, config]) => config.enabled)
        .map(([name]) => name),
      overrides: this.overrides.size,
    };
  }
}

// ============================================================================
// Feature Flag Manager
// ============================================================================

export class FeatureFlagManager {
  constructor(private configService: IConfigService) {}
  
  /**
   * Check if feature is enabled with fallback
   */
  isEnabled(feature: keyof FeatureFlags, defaultValue: boolean = false): boolean {
    try {
      return this.configService.isFeatureEnabled(feature);
    } catch {
      return defaultValue;
    }
  }
  
  /**
   * Run code only if feature is enabled
   */
  async runIfEnabled<T>(
    feature: keyof FeatureFlags,
    callback: () => T | Promise<T>,
    fallback?: T
  ): Promise<T | undefined> {
    if (this.isEnabled(feature)) {
      return callback();
    }
    return fallback;
  }
  
  /**
   * Get all enabled features
   */
  getEnabledFeatures(): string[] {
    const flags = this.configService.getFeatureFlags();
    return Object.entries(flags)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name);
  }
  
  /**
   * A/B testing support
   */
  private experiments = new Map<string, { enabled: boolean; variant: string }>();
  
  setExperiment(name: string, enabled: boolean, variant: string = 'control'): void {
    this.experiments.set(name, { enabled, variant });
  }
  
  getExperimentVariant(name: string): string | null {
    const experiment = this.experiments.get(name);
    return experiment?.enabled ? experiment.variant : null;
  }
  
  isInExperiment(name: string, variant?: string): boolean {
    const experiment = this.experiments.get(name);
    if (!experiment?.enabled) return false;
    return variant ? experiment.variant === variant : true;
  }
}