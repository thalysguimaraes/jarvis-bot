/**
 * Base class for all domain events
 */

export interface EventMetadata {
  timestamp: Date;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  source: string;
  version: number;
}

export abstract class DomainEvent {
  public readonly id: string;
  public readonly type: string;
  public readonly metadata: EventMetadata;
  
  constructor(
    type: string,
    public readonly payload: any,
    metadata?: Partial<EventMetadata>
  ) {
    this.id = this.generateEventId();
    this.type = type;
    this.metadata = {
      timestamp: new Date(),
      source: 'unknown',
      version: 1,
      ...metadata,
    };
  }
  
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Create a new event that was caused by this event
   */
  createCausedEvent<T extends DomainEvent>(
    EventClass: new (payload: any, metadata?: Partial<EventMetadata>) => T,
    payload: any,
    additionalMetadata?: Partial<EventMetadata>
  ): T {
    return new EventClass(payload, {
      ...additionalMetadata,
      correlationId: this.metadata.correlationId,
      causationId: this.id,
    });
  }
  
  /**
   * Clone the event with new metadata
   */
  withMetadata(metadata: Partial<EventMetadata>): this {
    const cloned = Object.create(Object.getPrototypeOf(this));
    Object.assign(cloned, this);
    cloned.metadata = { ...this.metadata, ...metadata };
    return cloned;
  }
  
  /**
   * Convert to plain object for serialization
   */
  toJSON(): object {
    return {
      id: this.id,
      type: this.type,
      payload: this.payload,
      metadata: {
        ...this.metadata,
        timestamp: this.metadata.timestamp.toISOString(),
      },
    };
  }
  
  /**
   * Create from plain object
   */
  static fromJSON<T extends DomainEvent>(
    this: new (payload: any, metadata?: Partial<EventMetadata>) => T,
    data: any
  ): T {
    const metadata = {
      ...data.metadata,
      timestamp: new Date(data.metadata.timestamp),
    };
    
    const event = new this(data.payload, metadata);
    (event as any).id = data.id;
    (event as any).type = data.type;
    
    return event;
  }
}