import { DomainEvent, EventMetadata } from './DomainEvent';

/**
 * Event handler and subscription types
 */

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  unsubscribe: () => void;
}

/**
 * Audio Processing Events
 */
export class AudioReceivedEvent extends DomainEvent {
  constructor(
    payload: {
      userId: string;
      audioData: ArrayBuffer | string;
      mimeType: string;
      duration?: number;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('audio.received', payload, metadata);
  }
}

export class AudioTranscribedEvent extends DomainEvent {
  constructor(
    payload: {
      userId: string;
      transcription: string;
      language?: string;
      confidence?: number;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('audio.transcribed', payload, metadata);
  }
}

export class AudioClassifiedEvent extends DomainEvent {
  constructor(
    payload: {
      userId: string;
      transcription: string;
      classification: string;
      confidence: number;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('audio.classified', payload, metadata);
  }
}

/**
 * Task Management Events
 */
export class TaskCreatedEvent extends DomainEvent {
  constructor(
    payload: {
      userId: string;
      taskId: string;
      title: string;
      description?: string;
      dueDate?: Date;
      project?: string;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('task.created', payload, metadata);
  }
}

export class TaskCompletedEvent extends DomainEvent {
  constructor(
    payload: {
      userId: string;
      taskId: string;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('task.completed', payload, metadata);
  }
}

/**
 * Note Events
 */
export class NoteCreatedEvent extends DomainEvent {
  constructor(
    payload: {
      userId: string;
      noteId: string;
      content: string;
      tags?: string[];
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('note.created', payload, metadata);
  }
}

export class NoteSyncedEvent extends DomainEvent {
  constructor(
    payload: {
      userId: string;
      noteIds: string[];
      destination: string;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('note.synced', payload, metadata);
  }
}

/**
 * Portfolio Events
 */
export class PortfolioUpdatedEvent extends DomainEvent {
  constructor(
    payload: {
      userId: string;
      portfolioId: string;
      totalValue: number;
      change: number;
      changePercent: number;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('portfolio.updated', payload, metadata);
  }
}

export class PortfolioReportSentEvent extends DomainEvent {
  constructor(
    payload: {
      userId: string;
      recipient: string;
      reportType: 'daily' | 'weekly' | 'monthly';
      success: boolean;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('portfolio.report_sent', payload, metadata);
  }
}

/**
 * Fund Management Events
 */
export class FundPositionAddedEvent extends DomainEvent {
  constructor(
    payload: {
      userId: string;
      fundId: string;
      cnpj: string;
      name: string;
      shares: number;
      value: number;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('fund.position_added', payload, metadata);
  }
}

export class FundPositionUpdatedEvent extends DomainEvent {
  constructor(
    payload: {
      userId: string;
      fundId: string;
      cnpj: string;
      shares: number;
      value: number;
      change: number;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('fund.position_updated', payload, metadata);
  }
}

/**
 * System Events
 */
export class SystemErrorEvent extends DomainEvent {
  constructor(
    payload: {
      error: string;
      stack?: string;
      module: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('system.error', payload, metadata);
  }
}

export class HealthCheckEvent extends DomainEvent {
  constructor(
    payload: {
      service: string;
      healthy: boolean;
      latency?: number;
      details?: any;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('system.health_check', payload, metadata);
  }
}

/**
 * Message Events
 */
export class MessageSentEvent extends DomainEvent {
  constructor(
    payload: {
      recipient: string;
      messageType: string;
      content: string;
      success: boolean;
      messageId?: string;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('message.sent', payload, metadata);
  }
}

export class MessageQueuedEvent extends DomainEvent {
  constructor(
    payload: {
      queueId: string;
      recipient: string;
      scheduledAt: Date;
      priority: number;
    },
    metadata?: Partial<EventMetadata>
  ) {
    super('message.queued', payload, metadata);
  }
}

/**
 * Event type registry for type safety
 */
export const EventTypes = {
  // Audio
  AUDIO_RECEIVED: 'audio.received',
  AUDIO_TRANSCRIBED: 'audio.transcribed',
  AUDIO_CLASSIFIED: 'audio.classified',
  
  // Tasks
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  
  // Notes
  NOTE_CREATED: 'note.created',
  NOTE_SYNCED: 'note.synced',
  
  // Portfolio
  PORTFOLIO_UPDATED: 'portfolio.updated',
  PORTFOLIO_REPORT_SENT: 'portfolio.report_sent',
  
  // Funds
  FUND_POSITION_ADDED: 'fund.position_added',
  FUND_POSITION_UPDATED: 'fund.position_updated',
  
  // System
  SYSTEM_ERROR: 'system.error',
  HEALTH_CHECK: 'system.health_check',
  
  // Messages
  MESSAGE_SENT: 'message.sent',
  MESSAGE_QUEUED: 'message.queued',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];

/**
 * Generic event class for dynamic event types
 * Useful for simple events where defining a dedicated class is overkill
 */
export class GenericEvent extends DomainEvent {
  constructor(type: string, payload: any, metadata?: Partial<EventMetadata>) {
    super(type, payload, metadata);
  }
}