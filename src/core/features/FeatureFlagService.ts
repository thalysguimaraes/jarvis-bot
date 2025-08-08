import { Injectable } from '../decorators/Injectable';
import { Inject } from '../decorators/Inject';
import { ILogger } from '../logging/Logger';
import { IStorageService } from '../services/interfaces/IStorageService';
import { EventBus } from '../event-bus/EventBus';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
  userGroups?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface FeatureFlagConfig {
  storagePrefix: string;
  cacheTTL: number;
  defaultFlags?: Record<string, boolean>;
  enableWebhook?: boolean;
  webhookUrl?: string;
}

export interface FeatureFlagContext {
  userId?: string;
  userGroup?: string;
  requestId?: string;
  environment?: string;
  metadata?: Record<string, any>;
}

@Injectable({ singleton: true })
export class FeatureFlagService {
  private flags = new Map<string, FeatureFlag>();
  private storagePrefix: string;
  private defaultFlags: Map<string, boolean>;
  private namespace = 'feature-flags';
  private evaluationCache = new Map<string, boolean>();

  constructor(
    @Inject('IStorageService') private storage: IStorageService,
    @Inject('ILogger') private logger: ILogger,
    @Inject('IEventBus') private eventBus: EventBus,
    config?: FeatureFlagConfig
  ) {
    this.storagePrefix = config?.storagePrefix || 'feature-flag:';
    // Cache TTL is handled by RequestCache itself
    this.defaultFlags = new Map(Object.entries(config?.defaultFlags || {}));
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadFlags();
    
    // Subscribe to flag update events
    this.eventBus.subscribe('feature-flag:updated', async (event: any) => {
      await this.loadFlag(event.payload.key);
    });
  }

  async isEnabled(key: string, context?: FeatureFlagContext): Promise<boolean> {
    // Check cache first
    const cacheKey = this.buildCacheKey(key, context);
    const cached = this.evaluationCache.get(cacheKey);
    
    if (cached !== undefined) {
      return cached;
    }
    
    // Get flag
    const flag = await this.getFlag(key);
    
    if (!flag) {
      // Use default if available
      const defaultValue = this.defaultFlags.get(key) || false;
      this.evaluationCache.set(cacheKey, defaultValue);
      return defaultValue;
    }
    
    // Check if expired
    if (flag.expiresAt && new Date() > flag.expiresAt) {
      this.logger.debug('Feature flag expired', { key });
      this.evaluationCache.set(cacheKey, false);
      return false;
    }
    
    // Evaluate flag
    const enabled = this.evaluateFlag(flag, context);
    this.evaluationCache.set(cacheKey, enabled);
    
    // Log evaluation
    this.logger.debug('Feature flag evaluated', {
      key,
      enabled,
      context
    });
    
    // Emit event
    this.eventBus.publish({
      type: 'feature-flag:evaluated',
      payload: { key, enabled, context },
      metadata: {}
    } as any);
    
    return enabled;
  }

  private evaluateFlag(flag: FeatureFlag, context?: FeatureFlagContext): boolean {
    if (!flag.enabled) {
      return false;
    }
    
    // Check user group targeting
    if (flag.userGroups && flag.userGroups.length > 0) {
      if (!context?.userGroup || !flag.userGroups.includes(context.userGroup)) {
        return false;
      }
    }
    
    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const hash = this.hashUserId(context?.userId || 'anonymous');
      const percentage = (hash % 100) + 1;
      return percentage <= flag.rolloutPercentage;
    }
    
    return true;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async getFlag(key: string): Promise<FeatureFlag | null> {
    // Check memory cache
    if (this.flags.has(key)) {
      return this.flags.get(key)!;
    }
    
    // Load from storage
    await this.loadFlag(key);
    return this.flags.get(key) || null;
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    await this.loadFlags();
    return Array.from(this.flags.values());
  }

  async createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<FeatureFlag> {
    const now = new Date();
    const newFlag: FeatureFlag = {
      ...flag,
      createdAt: now,
      updatedAt: now
    };
    
    // Save to storage
    await this.storage.put(
      this.namespace,
      `${this.storagePrefix}${flag.key}`,
      newFlag
    );
    
    // Update cache
    this.flags.set(flag.key, newFlag);
    this.invalidateEvaluationCache(flag.key);
    
    // Emit event
    this.eventBus.publish({
      type: 'feature-flag:created',
      payload: newFlag,
      metadata: {}
    } as any);
    
    this.logger.info('Feature flag created', { key: flag.key });
    
    return newFlag;
  }

  async updateFlag(key: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
    const existing = await this.getFlag(key);
    
    if (!existing) {
      throw new Error(`Feature flag not found: ${key}`);
    }
    
    const updated: FeatureFlag = {
      ...existing,
      ...updates,
      key, // Ensure key doesn't change
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: new Date()
    };
    
    // Save to storage
    await this.storage.put(
      this.namespace,
      `${this.storagePrefix}${key}`,
      updated
    );
    
    // Update cache
    this.flags.set(key, updated);
    this.invalidateEvaluationCache(key);
    
    // Emit event
    this.eventBus.publish({
      type: 'feature-flag:updated',
      payload: updated,
      metadata: {}
    } as any);
    
    this.logger.info('Feature flag updated', { key });
    
    return updated;
  }

  async toggleFlag(key: string): Promise<boolean> {
    const flag = await this.getFlag(key);
    
    if (!flag) {
      throw new Error(`Feature flag not found: ${key}`);
    }
    
    const updated = await this.updateFlag(key, {
      enabled: !flag.enabled
    });
    
    return updated.enabled;
  }

  async deleteFlag(key: string): Promise<void> {
    // Delete from storage
    await this.storage.delete(this.namespace, `${this.storagePrefix}${key}`);
    
    // Remove from cache
    this.flags.delete(key);
    this.invalidateEvaluationCache(key);
    
    // Emit event
    this.eventBus.publish({
      type: 'feature-flag:deleted',
      payload: { key },
      metadata: {}
    } as any);
    
    this.logger.info('Feature flag deleted', { key });
  }

  async setRolloutPercentage(key: string, percentage: number): Promise<FeatureFlag> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }
    
    return this.updateFlag(key, { rolloutPercentage: percentage });
  }

  async addUserGroup(key: string, group: string): Promise<FeatureFlag> {
    const flag = await this.getFlag(key);
    
    if (!flag) {
      throw new Error(`Feature flag not found: ${key}`);
    }
    
    const groups = flag.userGroups || [];
    if (!groups.includes(group)) {
      groups.push(group);
    }
    
    return this.updateFlag(key, { userGroups: groups });
  }

  async removeUserGroup(key: string, group: string): Promise<FeatureFlag> {
    const flag = await this.getFlag(key);
    
    if (!flag) {
      throw new Error(`Feature flag not found: ${key}`);
    }
    
    const groups = (flag.userGroups || []).filter(g => g !== group);
    
    return this.updateFlag(key, { userGroups: groups });
  }

  private async loadFlags(): Promise<void> {
    const result = await this.storage.list(this.namespace, { prefix: this.storagePrefix });
    
    for (const key of result.keys) {
      const flagKey = key.name.replace(this.storagePrefix, '');
      await this.loadFlag(flagKey);
    }
    
    this.logger.info('Feature flags loaded', { count: this.flags.size });
  }

  private async loadFlag(key: string): Promise<void> {
    const flag = await this.storage.get<FeatureFlag>(
      this.namespace,
      `${this.storagePrefix}${key}`
    );
    
    if (flag) {
      this.flags.set(key, flag);
    }
  }

  private buildCacheKey(flagKey: string, context?: FeatureFlagContext): string {
    const parts = [flagKey];
    
    if (context?.userId) {
      parts.push(`u:${context.userId}`);
    }
    
    if (context?.userGroup) {
      parts.push(`g:${context.userGroup}`);
    }
    
    return parts.join(':');
  }

  private invalidateEvaluationCache(flagKey?: string): void {
    if (flagKey) {
      // Remove all evaluations for this flag
      const keysToRemove: string[] = [];
      for (const key of this.evaluationCache.keys()) {
        if (key.startsWith(flagKey)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => this.evaluationCache.delete(key));
    } else {
      // Clear all evaluations
      this.evaluationCache.clear();
    }
  }

  getEvaluationStats(): {
    totalEvaluations: number;
    cachedEvaluations: number;
    flags: number;
  } {
    return {
      totalEvaluations: this.evaluationCache.size,
      cachedEvaluations: this.evaluationCache.size,
      flags: this.flags.size
    };
  }

  async exportFlags(): Promise<Record<string, FeatureFlag>> {
    await this.loadFlags();
    
    const result: Record<string, FeatureFlag> = {};
    for (const [key, flag] of this.flags.entries()) {
      result[key] = flag;
    }
    
    return result;
  }

  async importFlags(flags: Record<string, Omit<FeatureFlag, 'createdAt' | 'updatedAt'>>): Promise<void> {
    for (const [key, flag] of Object.entries(flags)) {
      await this.createFlag({ ...flag, key });
    }
    
    this.logger.info('Feature flags imported', { count: Object.keys(flags).length });
  }

  clearCache(): void {
    this.invalidateEvaluationCache();
    this.flags.clear();
  }
}

/**
 * Decorator for feature flag checking
 */
export function FeatureFlag(flagKey: string, defaultValue: boolean = false) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const flagService = (this as any).featureFlagService;
      
      if (!flagService) {
        // If no flag service, use default
        if (!defaultValue) {
          throw new Error(`Feature '${flagKey}' is disabled`);
        }
        return originalMethod.apply(this, args);
      }
      
      const enabled = await flagService.isEnabled(flagKey);
      
      if (!enabled) {
        throw new Error(`Feature '${flagKey}' is disabled`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}