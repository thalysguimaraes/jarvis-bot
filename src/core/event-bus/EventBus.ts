import { ILogger } from '../logging/Logger';
import { DomainEvent } from './DomainEvent';
import { EventHandler, EventSubscription } from './EventTypes';

/**
 * Event Bus for domain event communication
 */

export interface IEventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  publishMany(events: DomainEvent[]): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): EventSubscription;
  unsubscribe(subscription: EventSubscription): void;
  clear(): void;
}

export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>();
  private subscriptionId = 0;
  private subscriptions = new Map<string, { eventType: string; handler: EventHandler<any> }>();
  private processingQueue: Promise<void> = Promise.resolve();
  
  constructor(private logger?: ILogger) {}
  
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    this.logger?.debug(`Publishing event: ${event.type}`, {
      eventId: event.id,
      source: event.metadata.source,
      correlationId: event.metadata.correlationId,
    });
    
    const handlers = this.handlers.get(event.type) || new Set();
    const wildcardHandlers = this.handlers.get('*') || new Set();
    const allHandlers = [...handlers, ...wildcardHandlers];
    
    if (allHandlers.length === 0) {
      this.logger?.debug(`No handlers for event: ${event.type}`);
      return;
    }
    
    // Process handlers sequentially to maintain order
    this.processingQueue = this.processingQueue.then(async () => {
      const promises = allHandlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          this.logger?.error(
            `Error in event handler for ${event.type}`,
            error,
            {
              eventId: event.id,
              handler: handler.name || 'anonymous',
            }
          );
          // Don't throw - continue processing other handlers
        }
      });
      
      await Promise.all(promises);
    });
    
    await this.processingQueue;
  }
  
  async publishMany(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
  
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
  
  clear(): void {
    this.handlers.clear();
    this.subscriptions.clear();
    this.subscriptionId = 0;
    this.logger?.debug('Event bus cleared');
  }
  
  /**
   * Wait for all current event processing to complete
   */
  async waitForCompletion(): Promise<void> {
    await this.processingQueue;
  }
  
  /**
   * Get statistics about the event bus
   */
  getStats(): {
    eventTypes: number;
    totalHandlers: number;
    subscriptions: number;
  } {
    let totalHandlers = 0;
    for (const handlers of this.handlers.values()) {
      totalHandlers += handlers.size;
    }
    
    return {
      eventTypes: this.handlers.size,
      totalHandlers,
      subscriptions: this.subscriptions.size,
    };
  }
}

/**
 * Event Bus with middleware support
 */
export class MiddlewareEventBus extends EventBus {
  private middleware: Array<(event: DomainEvent, next: () => Promise<void>) => Promise<void>> = [];
  
  use(middleware: (event: DomainEvent, next: () => Promise<void>) => Promise<void>): void {
    this.middleware.push(middleware);
  }
  
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    if (this.middleware.length === 0) {
      return super.publish(event);
    }
    
    // Build middleware chain
    let index = 0;
    const next = async (): Promise<void> => {
      if (index >= this.middleware.length) {
        return super.publish(event);
      }
      
      const middleware = this.middleware[index++];
      await middleware(event, next);
    };
    
    await next();
  }
}

/**
 * Create event bus with common middleware
 */
export function createEventBus(logger?: ILogger): MiddlewareEventBus {
  const eventBus = new MiddlewareEventBus(logger);
  
  // Add correlation ID middleware
  eventBus.use(async (event, next) => {
    if (!event.metadata.correlationId) {
      event.metadata.correlationId = generateCorrelationId();
    }
    await next();
  });
  
  // Add timing middleware
  eventBus.use(async (event, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      logger?.warn(`Slow event processing: ${event.type}`, {
        eventId: event.id,
        duration,
      });
    }
  });
  
  return eventBus;
}

function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}