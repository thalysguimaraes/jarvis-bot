import { IEventBus } from './EventBus';
import { DomainEvent } from './DomainEvent';
import { EventHandler } from './EventTypes';
import {
  DomainEventUnion,
  TypedEventHandler,
  TypedEventSubscription,
  ITypedEventBus,
  EventFactory,
  AudioEventType,
  TaskEventType,
  NoteEventType,
  PortfolioEventType,
  FundEventType,
  SystemEventType,
  MessageEventType,
} from './TypedEvents';
import { validateEvent } from './EventSchemas';
import { ILogger } from '../logging/Logger';

/**
 * TypedEventBus - Type-safe wrapper around the existing event bus
 * Provides a bridge between the new typed event system and the legacy event bus
 * Enables gradual migration without breaking existing code
 */

export class TypedEventBus implements ITypedEventBus {
  private typeMap = new Map<string, Set<TypedEventHandler<any>>>();
  private subscriptions = new Map<string, TypedEventSubscription>();
  private subscriptionCounter = 0;
  
  constructor(
    private legacyEventBus: IEventBus,
    private logger?: ILogger,
    private validateEvents: boolean = true
  ) {
    this.logger = logger?.child({ component: 'TypedEventBus' });
    this.setupEventTypeMapping();
  }
  
  /**
   * Setup mapping between typed events and legacy event types
   */
  private setupEventTypeMapping(): void {
    // This maps our typed event types to legacy event strings
    // Allowing backward compatibility
  }
  
  /**
   * Publish a typed event
   */
  async publish<T extends DomainEventUnion>(event: T): Promise<void> {
    try {
      // Validate event if enabled
      if (this.validateEvents) {
        validateEvent(event.type, event);
      }
      
      // Convert to legacy DomainEvent format
      const legacyEvent = this.convertToLegacyEvent(event);
      
      // Publish through legacy event bus
      await this.legacyEventBus.publish(legacyEvent);
      
      // Also notify typed handlers directly
      await this.notifyTypedHandlers(event);
      
      this.logger?.debug('Typed event published', {
        type: event.type,
        hasLegacyFormat: true,
        metadata: event.metadata,
      });
    } catch (error) {
      this.logger?.error('Failed to publish typed event', error as Error, {
        eventType: event.type,
      });
      throw error;
    }
  }
  
  /**
   * Subscribe to typed events
   */
  subscribe<T extends DomainEventUnion>(
    eventType: T['type'],
    handler: TypedEventHandler<T>
  ): TypedEventSubscription {
    // Store typed handler
    if (!this.typeMap.has(eventType)) {
      this.typeMap.set(eventType, new Set());
    }
    this.typeMap.get(eventType)!.add(handler as any);
    
    // Create legacy handler wrapper
    const legacyHandler: EventHandler = async (event: DomainEvent) => {
      try {
        // Convert legacy event to typed format
        const typedEvent = this.convertFromLegacyEvent(event);
        
        if (typedEvent && typedEvent.type === eventType) {
          await handler(typedEvent as T);
        }
      } catch (error) {
        this.logger?.error('Error in typed event handler', error as Error, {
          eventType,
          handlerName: handler.name || 'anonymous',
        });
      }
    };
    
    // Subscribe to legacy event bus
    const legacySubscription = this.legacyEventBus.subscribe(
      eventType,
      legacyHandler
    );
    
    // Create typed subscription
    const subscriptionId = `typed_${++this.subscriptionCounter}`;
    const typedSubscription: TypedEventSubscription = {
      id: subscriptionId,
      unsubscribe: () => {
        // Unsubscribe from both typed and legacy handlers
        this.unsubscribe(typedSubscription);
        legacySubscription.unsubscribe();
      },
    };
    
    this.subscriptions.set(subscriptionId, typedSubscription);
    
    this.logger?.debug('Subscribed to typed event', {
      eventType,
      subscriptionId,
    });
    
    return typedSubscription;
  }
  
  /**
   * Unsubscribe from events
   */
  unsubscribe(subscription: TypedEventSubscription): void {
    this.subscriptions.delete(subscription.id);
    
    this.logger?.debug('Unsubscribed from typed event', {
      subscriptionId: subscription.id,
    });
  }
  
  /**
   * Convert typed event to legacy DomainEvent format
   */
  private convertToLegacyEvent(event: DomainEventUnion): DomainEvent {
    // Create a concrete implementation of DomainEvent
    class ConcreteDomainEvent extends DomainEvent {
      constructor(type: string, payload: any, metadata: any) {
        super(type, payload, metadata);
      }
    }
    
    const baseEvent = new ConcreteDomainEvent(
      event.type,
      event.payload,
      event.metadata
    );
    
    return baseEvent;
  }
  
  /**
   * Convert legacy DomainEvent to typed format
   */
  private convertFromLegacyEvent(event: DomainEvent): DomainEventUnion | null {
    try {
      // Determine event category and create typed event
      const eventType = event.type;
      const payload = event.payload;
      const metadata = event.metadata;
      
      // Audio events
      if (Object.values(AudioEventType).includes(eventType as AudioEventType)) {
        switch (eventType) {
          case AudioEventType.RECEIVED:
            return EventFactory.audioReceived(payload, metadata);
          case AudioEventType.TRANSCRIBED:
            return EventFactory.audioTranscribed(payload, metadata);
          case AudioEventType.CLASSIFIED:
            return EventFactory.audioClassified(payload, metadata);
        }
      }
      
      // Task events
      if (Object.values(TaskEventType).includes(eventType as TaskEventType)) {
        switch (eventType) {
          case TaskEventType.CREATED:
            return EventFactory.taskCreated(payload, metadata);
          case TaskEventType.COMPLETED:
            return EventFactory.taskCompleted(payload, metadata);
        }
      }
      
      // Note events
      if (Object.values(NoteEventType).includes(eventType as NoteEventType)) {
        switch (eventType) {
          case NoteEventType.CREATED:
            return EventFactory.noteCreated(payload, metadata);
          case NoteEventType.SYNCED:
            return EventFactory.noteSynced(payload, metadata);
        }
      }
      
      // Portfolio events
      if (Object.values(PortfolioEventType).includes(eventType as PortfolioEventType)) {
        switch (eventType) {
          case PortfolioEventType.UPDATED:
            return EventFactory.portfolioUpdated(payload, metadata);
          case PortfolioEventType.REPORT_SENT:
            return EventFactory.portfolioReportSent(payload, metadata);
        }
      }
      
      // Fund events
      if (Object.values(FundEventType).includes(eventType as FundEventType)) {
        switch (eventType) {
          case FundEventType.POSITION_ADDED:
            return EventFactory.fundPositionAdded(payload, metadata);
        }
      }
      
      // System events
      if (Object.values(SystemEventType).includes(eventType as SystemEventType)) {
        switch (eventType) {
          case SystemEventType.ERROR:
            return EventFactory.systemError(payload, metadata);
          case SystemEventType.HEALTH_CHECK:
            return EventFactory.healthCheck(payload, metadata);
        }
      }
      
      // Message events
      if (Object.values(MessageEventType).includes(eventType as MessageEventType)) {
        switch (eventType) {
          case MessageEventType.SENT:
            return EventFactory.messageSent(payload, metadata);
          case MessageEventType.QUEUED:
            return EventFactory.messageQueued(payload, metadata);
        }
      }
      
      // Unknown event type - log warning
      this.logger?.warn('Unknown event type for conversion', {
        eventType,
        eventId: event.id,
      });
      
      return null;
    } catch (error) {
      this.logger?.error('Failed to convert legacy event', error as Error, {
        eventType: event.type,
        eventId: event.id,
      });
      return null;
    }
  }
  
  /**
   * Notify typed handlers directly
   */
  private async notifyTypedHandlers<T extends DomainEventUnion>(event: T): Promise<void> {
    const handlers = this.typeMap.get(event.type);
    
    if (!handlers || handlers.size === 0) {
      return;
    }
    
    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger?.error('Error in typed handler', error as Error, {
          eventType: event.type,
          handlerName: handler.name || 'anonymous',
        });
      }
    });
    
    await Promise.all(promises);
  }
  
  /**
   * Publish many events
   */
  async publishMany(events: DomainEventUnion[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
  
  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.typeMap.clear();
    this.subscriptions.clear();
    this.subscriptionCounter = 0;
    
    this.logger?.debug('TypedEventBus cleared');
  }
  
  /**
   * Get statistics
   */
  getStats(): {
    typedHandlers: number;
    subscriptions: number;
    eventTypes: string[];
  } {
    let totalHandlers = 0;
    for (const handlers of this.typeMap.values()) {
      totalHandlers += handlers.size;
    }
    
    return {
      typedHandlers: totalHandlers,
      subscriptions: this.subscriptions.size,
      eventTypes: Array.from(this.typeMap.keys()),
    };
  }
}

/**
 * Factory function to create a TypedEventBus with enhanced features
 */
export function createTypedEventBus(
  legacyEventBus: IEventBus,
  options?: {
    logger?: ILogger;
    validateEvents?: boolean;
    enableMetrics?: boolean;
  }
): TypedEventBus {
  const typedBus = new TypedEventBus(
    legacyEventBus,
    options?.logger,
    options?.validateEvents ?? true
  );
  
  if (options?.enableMetrics) {
    // Add metrics collection wrapper
    const originalPublish = typedBus.publish.bind(typedBus);
    typedBus.publish = async function(event) {
      const startTime = Date.now();
      try {
        await originalPublish(event);
        options.logger?.debug('Event published', {
          type: event.type,
          duration: Date.now() - startTime,
        });
      } catch (error) {
        options.logger?.error('Event publish failed', error as Error, {
          type: event.type,
          duration: Date.now() - startTime,
        });
        throw error;
      }
    };
  }
  
  return typedBus;
}