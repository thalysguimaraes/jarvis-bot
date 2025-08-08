import { ILogger } from '../logging/Logger';
import { DomainEvent } from './DomainEvent';
import { EventHandler, EventSubscription } from './EventTypes';
import { IEventBus } from './EventBus';

/**
 * Enhanced event bus with configurable parallel processing
 * Provides better performance for high-throughput scenarios
 */

export interface ConcurrentEventBusConfig {
  maxConcurrency: number;
  enablePriority: boolean;
  enableBatching: boolean;
  batchSize: number;
  batchTimeoutMs: number;
  enableThrottling: boolean;
  throttleRatePerSecond: number;
  enableBackpressure: boolean;
  maxQueueSize: number;
}

export interface PrioritizedEvent {
  event: DomainEvent;
  priority: number;
  timestamp: number;
}

export interface EventMetrics {
  totalPublished: number;
  totalProcessed: number;
  totalFailed: number;
  averageProcessingTimeMs: number;
  queueSize: number;
  activeHandlers: number;
}

export class ConcurrentEventBus implements IEventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>();
  private subscriptionId = 0;
  private subscriptions = new Map<string, { eventType: string; handler: EventHandler<any> }>();
  
  // Concurrent processing
  private eventQueue: PrioritizedEvent[] = [];
  private processing = false;
  private activeProcessors = 0;
  
  // Batching
  private batchBuffer: DomainEvent[] = [];
  private batchTimer: any = null;
  
  // Throttling
  private throttleTokens: number;
  private lastThrottleRefill: number = Date.now();
  
  // Metrics
  private metrics: EventMetrics = {
    totalPublished: 0,
    totalProcessed: 0,
    totalFailed: 0,
    averageProcessingTimeMs: 0,
    queueSize: 0,
    activeHandlers: 0,
  };
  
  private config: ConcurrentEventBusConfig = {
    maxConcurrency: 10,
    enablePriority: true,
    enableBatching: false,
    batchSize: 100,
    batchTimeoutMs: 100,
    enableThrottling: false,
    throttleRatePerSecond: 100,
    enableBackpressure: true,
    maxQueueSize: 10000,
  };
  
  constructor(
    config?: Partial<ConcurrentEventBusConfig>,
    private logger?: ILogger
  ) {
    this.config = { ...this.config, ...config };
    this.throttleTokens = this.config.throttleRatePerSecond;
  }
  
  /**
   * Publish a single event
   */
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    this.metrics.totalPublished++;
    
    // Check backpressure
    if (this.config.enableBackpressure && this.eventQueue.length >= this.config.maxQueueSize) {
      throw new Error(`Event queue full (max: ${this.config.maxQueueSize})`);
    }
    
    // Apply throttling
    if (this.config.enableThrottling) {
      await this.throttle();
    }
    
    // Handle batching
    if (this.config.enableBatching) {
      this.batchBuffer.push(event);
      
      if (this.batchBuffer.length >= this.config.batchSize) {
        await this.flushBatch();
      } else {
        this.scheduleBatchFlush();
      }
      
      return;
    }
    
    // Add to priority queue
    this.enqueueEvent(event);
    
    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }
  }
  
  /**
   * Publish multiple events
   */
  async publishMany(events: DomainEvent[]): Promise<void> {
    // Process as a batch for efficiency
    if (this.config.enableBatching) {
      this.batchBuffer.push(...events);
      await this.flushBatch();
    } else {
      // Add all to queue at once
      for (const event of events) {
        this.enqueueEvent(event);
      }
      
      if (!this.processing) {
        this.startProcessing();
      }
    }
  }
  
  /**
   * Subscribe to an event type
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): EventSubscription {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler);
    
    const subscriptionId = `sub_${++this.subscriptionId}`;
    this.subscriptions.set(subscriptionId, { eventType, handler });
    
    this.logger?.debug(`Subscribed to event: ${eventType}`, { subscriptionId });
    
    return {
      id: subscriptionId,
      unsubscribe: () => this.unsubscribe({ id: subscriptionId, unsubscribe: () => {} }),
    };
  }
  
  /**
   * Unsubscribe from events
   */
  unsubscribe(subscription: EventSubscription): void {
    const sub = this.subscriptions.get(subscription.id);
    if (!sub) {
      return;
    }
    
    const handlers = this.handlers.get(sub.eventType);
    if (handlers) {
      handlers.delete(sub.handler);
      if (handlers.size === 0) {
        this.handlers.delete(sub.eventType);
      }
    }
    
    this.subscriptions.delete(subscription.id);
    
    this.logger?.debug(`Unsubscribed from event: ${sub.eventType}`, {
      subscriptionId: subscription.id,
    });
  }
  
  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.handlers.clear();
    this.subscriptions.clear();
    this.subscriptionId = 0;
    this.eventQueue = [];
    this.batchBuffer = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    this.logger?.debug('Event bus cleared');
  }
  
  /**
   * Enqueue event with priority
   */
  private enqueueEvent(event: DomainEvent, priority: number = 5): void {
    const prioritizedEvent: PrioritizedEvent = {
      event,
      priority,
      timestamp: Date.now(),
    };
    
    if (this.config.enablePriority) {
      // Insert in priority order (higher priority first)
      const insertIndex = this.eventQueue.findIndex(
        e => e.priority < priority
      );
      
      if (insertIndex === -1) {
        this.eventQueue.push(prioritizedEvent);
      } else {
        this.eventQueue.splice(insertIndex, 0, prioritizedEvent);
      }
    } else {
      // Simple FIFO queue
      this.eventQueue.push(prioritizedEvent);
    }
    
    this.metrics.queueSize = this.eventQueue.length;
  }
  
  /**
   * Start processing events from the queue
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.eventQueue.length > 0) {
      // Process up to maxConcurrency events in parallel
      const batch: Promise<void>[] = [];
      
      for (let i = 0; i < this.config.maxConcurrency && this.eventQueue.length > 0; i++) {
        const prioritizedEvent = this.eventQueue.shift()!;
        batch.push(this.processEvent(prioritizedEvent.event));
      }
      
      // Wait for batch to complete
      await Promise.all(batch);
      
      this.metrics.queueSize = this.eventQueue.length;
    }
    
    this.processing = false;
  }
  
  /**
   * Process a single event
   */
  private async processEvent(event: DomainEvent): Promise<void> {
    const startTime = Date.now();
    this.activeProcessors++;
    this.metrics.activeHandlers = this.activeProcessors;
    
    try {
      this.logger?.debug(`Processing event: ${event.type}`, {
        eventId: event.id,
        correlationId: event.metadata.correlationId,
      });
      
      const handlers = this.handlers.get(event.type) || new Set();
      const wildcardHandlers = this.handlers.get('*') || new Set();
      const allHandlers = [...handlers, ...wildcardHandlers];
      
      if (allHandlers.length === 0) {
        this.logger?.debug(`No handlers for event: ${event.type}`);
        return;
      }
      
      // Execute handlers in parallel (within the event)
      const handlerPromises = allHandlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          this.metrics.totalFailed++;
          this.logger?.error(
            `Error in event handler for ${event.type}`,
            error as Error,
            {
              eventId: event.id,
              handler: handler.name || 'anonymous',
            }
          );
        }
      });
      
      await Promise.all(handlerPromises);
      
      this.metrics.totalProcessed++;
      
      // Update average processing time
      const processingTime = Date.now() - startTime;
      this.metrics.averageProcessingTimeMs = 
        (this.metrics.averageProcessingTimeMs * (this.metrics.totalProcessed - 1) + processingTime) / 
        this.metrics.totalProcessed;
      
    } finally {
      this.activeProcessors--;
      this.metrics.activeHandlers = this.activeProcessors;
    }
  }
  
  /**
   * Handle batching
   */
  private scheduleBatchFlush(): void {
    if (this.batchTimer) return;
    
    this.batchTimer = setTimeout(() => {
      this.flushBatch();
    }, this.config.batchTimeoutMs);
  }
  
  private async flushBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    if (this.batchBuffer.length === 0) return;
    
    const batch = [...this.batchBuffer];
    this.batchBuffer = [];
    
    this.logger?.debug(`Flushing batch of ${batch.length} events`);
    
    // Add all events to queue
    for (const event of batch) {
      this.enqueueEvent(event);
    }
    
    if (!this.processing) {
      await this.startProcessing();
    }
  }
  
  /**
   * Throttling implementation
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceRefill = now - this.lastThrottleRefill;
    
    // Refill tokens based on time elapsed
    if (timeSinceRefill >= 1000) {
      const refillAmount = Math.floor(timeSinceRefill / 1000) * this.config.throttleRatePerSecond;
      this.throttleTokens = Math.min(
        this.config.throttleRatePerSecond,
        this.throttleTokens + refillAmount
      );
      this.lastThrottleRefill = now;
    }
    
    // Wait if no tokens available
    if (this.throttleTokens <= 0) {
      const waitTime = 1000 - (now - this.lastThrottleRefill);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.throttleTokens = this.config.throttleRatePerSecond;
      this.lastThrottleRefill = Date.now();
    }
    
    this.throttleTokens--;
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConcurrentEventBusConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update throttle tokens if rate changed
    if (config.throttleRatePerSecond) {
      this.throttleTokens = config.throttleRatePerSecond;
    }
    
    this.logger?.info('Event bus configuration updated', this.config);
  }
  
  /**
   * Set event priority for specific event types
   */
  private eventPriorities = new Map<string, number>();
  
  setEventPriority(eventType: string, priority: number): void {
    this.eventPriorities.set(eventType, priority);
  }
  
  getEventPriority(eventType: string): number {
    return this.eventPriorities.get(eventType) || 5; // Default priority is 5
  }
}