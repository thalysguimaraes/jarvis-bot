import { EventMetadata } from './DomainEvent';

/**
 * Type-safe event system using discriminated unions
 * Provides compile-time type checking and better IDE support
 */

// ============================================================================
// Event Type Definitions
// ============================================================================

export enum EventCategory {
  AUDIO = 'audio',
  TASK = 'task',
  NOTE = 'note',
  PORTFOLIO = 'portfolio',
  FUND = 'fund',
  SYSTEM = 'system',
  MESSAGE = 'message',
}

export enum AudioEventType {
  RECEIVED = 'audio.received',
  TRANSCRIBED = 'audio.transcribed',
  CLASSIFIED = 'audio.classified',
  PROCESSING_FAILED = 'audio.processing_failed',
}

export enum TaskEventType {
  CREATED = 'task.created',
  UPDATED = 'task.updated',
  COMPLETED = 'task.completed',
  DELETED = 'task.deleted',
}

export enum NoteEventType {
  CREATED = 'note.created',
  UPDATED = 'note.updated',
  SYNCED = 'note.synced',
  DELETED = 'note.deleted',
}

export enum PortfolioEventType {
  UPDATED = 'portfolio.updated',
  REPORT_REQUESTED = 'portfolio.report_requested',
  REPORT_SENT = 'portfolio.report_sent',
}

export enum FundEventType {
  POSITION_ADDED = 'fund.position_added',
  POSITION_UPDATED = 'fund.position_updated',
  POSITION_REMOVED = 'fund.position_removed',
  REPORT_GENERATED = 'fund.report_generated',
}

export enum SystemEventType {
  ERROR = 'system.error',
  WARNING = 'system.warning',
  HEALTH_CHECK = 'system.health_check',
  STARTUP = 'system.startup',
  SHUTDOWN = 'system.shutdown',
}

export enum MessageEventType {
  SENT = 'message.sent',
  QUEUED = 'message.queued',
  FAILED = 'message.failed',
  DELIVERED = 'message.delivered',
}

// ============================================================================
// Event Payload Interfaces
// ============================================================================

// Audio Events
export interface AudioReceivedPayload {
  userId: string;
  audioData: ArrayBuffer | string;
  mimeType: string;
  duration?: number;
  source: 'whatsapp' | 'api' | 'test';
}

export interface AudioTranscribedPayload {
  userId: string;
  transcription: string;
  language?: string;
  confidence?: number;
  processingTimeMs: number;
}

export interface AudioClassifiedPayload {
  userId: string;
  transcription: string;
  classification: 'task' | 'note' | 'fund' | 'question' | 'other';
  confidence: number;
  metadata?: Record<string, any>;
}

export interface AudioProcessingFailedPayload {
  userId: string;
  error: string;
  errorCode: string;
  stage: 'transcription' | 'classification' | 'routing';
  retryable: boolean;
}

// Task Events
export interface TaskCreatedPayload {
  userId: string;
  taskId: string;
  title: string;
  description?: string;
  dueDate?: Date;
  project?: string;
  priority?: 'low' | 'medium' | 'high';
  labels?: string[];
}

export interface TaskUpdatedPayload {
  userId: string;
  taskId: string;
  changes: Partial<Omit<TaskCreatedPayload, 'userId' | 'taskId'>>;
}

export interface TaskCompletedPayload {
  userId: string;
  taskId: string;
  completedAt: Date;
}

export interface TaskDeletedPayload {
  userId: string;
  taskId: string;
  reason?: string;
}

// Note Events
export interface NoteCreatedPayload {
  userId: string;
  noteId: string;
  content: string;
  tags?: string[];
  source: 'voice' | 'text' | 'api';
}

export interface NoteUpdatedPayload {
  userId: string;
  noteId: string;
  content?: string;
  tags?: string[];
}

export interface NoteSyncedPayload {
  userId: string;
  noteIds: string[];
  destination: 'obsidian' | 'notion' | 'github';
  success: boolean;
  syncedAt: Date;
}

export interface NoteDeletedPayload {
  userId: string;
  noteId: string;
}

// Portfolio Events
export interface PortfolioUpdatedPayload {
  userId: string;
  portfolioId: string;
  totalValue: number;
  change: number;
  changePercent: number;
  holdings: Array<{
    ticker: string;
    value: number;
    change: number;
  }>;
}

export interface PortfolioReportRequestedPayload {
  userId: string;
  type: 'daily' | 'weekly' | 'monthly' | 'on-demand';
  requestedAt: Date;
}

export interface PortfolioReportSentPayload {
  userId: string;
  recipient: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  success: boolean;
  messageId?: string;
}

// Fund Events
export interface FundPositionAddedPayload {
  userId: string;
  fundId: string;
  cnpj: string;
  name: string;
  shares: number;
  value: number;
}

export interface FundPositionUpdatedPayload {
  userId: string;
  fundId: string;
  cnpj: string;
  shares: number;
  value: number;
  change: number;
}

export interface FundPositionRemovedPayload {
  userId: string;
  fundId: string;
  cnpj: string;
}

export interface FundReportGeneratedPayload {
  userId: string;
  totalValue: number;
  totalChange: number;
  positions: number;
  reportDate: Date;
}

// System Events
export interface SystemErrorPayload {
  error: string;
  stack?: string;
  module: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

export interface SystemWarningPayload {
  message: string;
  module: string;
  code?: string;
  context?: Record<string, any>;
}

export interface HealthCheckPayload {
  service: string;
  healthy: boolean;
  latency?: number;
  details?: Record<string, any>;
}

export interface SystemStartupPayload {
  version: string;
  environment: string;
  modules: string[];
  startTime: Date;
}

export interface SystemShutdownPayload {
  reason: string;
  graceful: boolean;
  shutdownTime: Date;
}

// Message Events
export interface MessageSentPayload {
  recipient: string;
  messageType: 'text' | 'audio' | 'image' | 'document';
  content: string;
  success: boolean;
  messageId?: string;
}

export interface MessageQueuedPayload {
  queueId: string;
  recipient: string;
  scheduledAt: Date;
  priority: number;
}

export interface MessageFailedPayload {
  recipient: string;
  error: string;
  retryCount: number;
  willRetry: boolean;
}

export interface MessageDeliveredPayload {
  messageId: string;
  recipient: string;
  deliveredAt: Date;
  readAt?: Date;
}

// ============================================================================
// Discriminated Union Types
// ============================================================================

export type AudioEvent =
  | { type: AudioEventType.RECEIVED; payload: AudioReceivedPayload; metadata?: Partial<EventMetadata> }
  | { type: AudioEventType.TRANSCRIBED; payload: AudioTranscribedPayload; metadata?: Partial<EventMetadata> }
  | { type: AudioEventType.CLASSIFIED; payload: AudioClassifiedPayload; metadata?: Partial<EventMetadata> }
  | { type: AudioEventType.PROCESSING_FAILED; payload: AudioProcessingFailedPayload; metadata?: Partial<EventMetadata> };

export type TaskEvent =
  | { type: TaskEventType.CREATED; payload: TaskCreatedPayload; metadata?: Partial<EventMetadata> }
  | { type: TaskEventType.UPDATED; payload: TaskUpdatedPayload; metadata?: Partial<EventMetadata> }
  | { type: TaskEventType.COMPLETED; payload: TaskCompletedPayload; metadata?: Partial<EventMetadata> }
  | { type: TaskEventType.DELETED; payload: TaskDeletedPayload; metadata?: Partial<EventMetadata> };

export type NoteEvent =
  | { type: NoteEventType.CREATED; payload: NoteCreatedPayload; metadata?: Partial<EventMetadata> }
  | { type: NoteEventType.UPDATED; payload: NoteUpdatedPayload; metadata?: Partial<EventMetadata> }
  | { type: NoteEventType.SYNCED; payload: NoteSyncedPayload; metadata?: Partial<EventMetadata> }
  | { type: NoteEventType.DELETED; payload: NoteDeletedPayload; metadata?: Partial<EventMetadata> };

export type PortfolioEvent =
  | { type: PortfolioEventType.UPDATED; payload: PortfolioUpdatedPayload; metadata?: Partial<EventMetadata> }
  | { type: PortfolioEventType.REPORT_REQUESTED; payload: PortfolioReportRequestedPayload; metadata?: Partial<EventMetadata> }
  | { type: PortfolioEventType.REPORT_SENT; payload: PortfolioReportSentPayload; metadata?: Partial<EventMetadata> };

export type FundEvent =
  | { type: FundEventType.POSITION_ADDED; payload: FundPositionAddedPayload; metadata?: Partial<EventMetadata> }
  | { type: FundEventType.POSITION_UPDATED; payload: FundPositionUpdatedPayload; metadata?: Partial<EventMetadata> }
  | { type: FundEventType.POSITION_REMOVED; payload: FundPositionRemovedPayload; metadata?: Partial<EventMetadata> }
  | { type: FundEventType.REPORT_GENERATED; payload: FundReportGeneratedPayload; metadata?: Partial<EventMetadata> };

export type SystemEvent =
  | { type: SystemEventType.ERROR; payload: SystemErrorPayload; metadata?: Partial<EventMetadata> }
  | { type: SystemEventType.WARNING; payload: SystemWarningPayload; metadata?: Partial<EventMetadata> }
  | { type: SystemEventType.HEALTH_CHECK; payload: HealthCheckPayload; metadata?: Partial<EventMetadata> }
  | { type: SystemEventType.STARTUP; payload: SystemStartupPayload; metadata?: Partial<EventMetadata> }
  | { type: SystemEventType.SHUTDOWN; payload: SystemShutdownPayload; metadata?: Partial<EventMetadata> };

export type MessageEvent =
  | { type: MessageEventType.SENT; payload: MessageSentPayload; metadata?: Partial<EventMetadata> }
  | { type: MessageEventType.QUEUED; payload: MessageQueuedPayload; metadata?: Partial<EventMetadata> }
  | { type: MessageEventType.FAILED; payload: MessageFailedPayload; metadata?: Partial<EventMetadata> }
  | { type: MessageEventType.DELIVERED; payload: MessageDeliveredPayload; metadata?: Partial<EventMetadata> };

export type DomainEventUnion =
  | AudioEvent
  | TaskEvent
  | NoteEvent
  | PortfolioEvent
  | FundEvent
  | SystemEvent
  | MessageEvent;

// ============================================================================
// Type Guards
// ============================================================================

export function isAudioEvent(event: DomainEventUnion): event is AudioEvent {
  return Object.values(AudioEventType).includes(event.type as AudioEventType);
}

export function isTaskEvent(event: DomainEventUnion): event is TaskEvent {
  return Object.values(TaskEventType).includes(event.type as TaskEventType);
}

export function isNoteEvent(event: DomainEventUnion): event is NoteEvent {
  return Object.values(NoteEventType).includes(event.type as NoteEventType);
}

export function isPortfolioEvent(event: DomainEventUnion): event is PortfolioEvent {
  return Object.values(PortfolioEventType).includes(event.type as PortfolioEventType);
}

export function isFundEvent(event: DomainEventUnion): event is FundEvent {
  return Object.values(FundEventType).includes(event.type as FundEventType);
}

export function isSystemEvent(event: DomainEventUnion): event is SystemEvent {
  return Object.values(SystemEventType).includes(event.type as SystemEventType);
}

export function isMessageEvent(event: DomainEventUnion): event is MessageEvent {
  return Object.values(MessageEventType).includes(event.type as MessageEventType);
}

// ============================================================================
// Event Factory Functions
// ============================================================================

export class EventFactory {
  static audioReceived(
    payload: AudioReceivedPayload,
    metadata?: Partial<EventMetadata>
  ): AudioEvent {
    return {
      type: AudioEventType.RECEIVED,
      payload,
      metadata,
    };
  }

  static audioTranscribed(
    payload: AudioTranscribedPayload,
    metadata?: Partial<EventMetadata>
  ): AudioEvent {
    return {
      type: AudioEventType.TRANSCRIBED,
      payload,
      metadata,
    };
  }

  static audioClassified(
    payload: AudioClassifiedPayload,
    metadata?: Partial<EventMetadata>
  ): AudioEvent {
    return {
      type: AudioEventType.CLASSIFIED,
      payload,
      metadata,
    };
  }

  static taskCreated(
    payload: TaskCreatedPayload,
    metadata?: Partial<EventMetadata>
  ): TaskEvent {
    return {
      type: TaskEventType.CREATED,
      payload,
      metadata,
    };
  }

  static taskCompleted(
    payload: TaskCompletedPayload,
    metadata?: Partial<EventMetadata>
  ): TaskEvent {
    return {
      type: TaskEventType.COMPLETED,
      payload,
      metadata,
    };
  }

  static noteCreated(
    payload: NoteCreatedPayload,
    metadata?: Partial<EventMetadata>
  ): NoteEvent {
    return {
      type: NoteEventType.CREATED,
      payload,
      metadata,
    };
  }

  static noteSynced(
    payload: NoteSyncedPayload,
    metadata?: Partial<EventMetadata>
  ): NoteEvent {
    return {
      type: NoteEventType.SYNCED,
      payload,
      metadata,
    };
  }

  static noteUpdated(
    payload: NoteUpdatedPayload,
    metadata?: Partial<EventMetadata>
  ): NoteEvent {
    return {
      type: NoteEventType.UPDATED,
      payload,
      metadata,
    };
  }

  static noteDeleted(
    payload: NoteDeletedPayload,
    metadata?: Partial<EventMetadata>
  ): NoteEvent {
    return {
      type: NoteEventType.DELETED,
      payload,
      metadata,
    };
  }

  static portfolioUpdated(
    payload: PortfolioUpdatedPayload,
    metadata?: Partial<EventMetadata>
  ): PortfolioEvent {
    return {
      type: PortfolioEventType.UPDATED,
      payload,
      metadata,
    };
  }

  static portfolioReportRequested(
    payload: PortfolioReportRequestedPayload,
    metadata?: Partial<EventMetadata>
  ): PortfolioEvent {
    return {
      type: PortfolioEventType.REPORT_REQUESTED,
      payload,
      metadata,
    };
  }

  static portfolioReportSent(
    payload: PortfolioReportSentPayload,
    metadata?: Partial<EventMetadata>
  ): PortfolioEvent {
    return {
      type: PortfolioEventType.REPORT_SENT,
      payload,
      metadata,
    };
  }

  static fundPositionAdded(
    payload: FundPositionAddedPayload,
    metadata?: Partial<EventMetadata>
  ): FundEvent {
    return {
      type: FundEventType.POSITION_ADDED,
      payload,
      metadata,
    };
  }

  static systemError(
    payload: SystemErrorPayload,
    metadata?: Partial<EventMetadata>
  ): SystemEvent {
    return {
      type: SystemEventType.ERROR,
      payload,
      metadata,
    };
  }

  static healthCheck(
    payload: HealthCheckPayload,
    metadata?: Partial<EventMetadata>
  ): SystemEvent {
    return {
      type: SystemEventType.HEALTH_CHECK,
      payload,
      metadata,
    };
  }

  static messageSent(
    payload: MessageSentPayload,
    metadata?: Partial<EventMetadata>
  ): MessageEvent {
    return {
      type: MessageEventType.SENT,
      payload,
      metadata,
    };
  }

  static messageQueued(
    payload: MessageQueuedPayload,
    metadata?: Partial<EventMetadata>
  ): MessageEvent {
    return {
      type: MessageEventType.QUEUED,
      payload,
      metadata,
    };
  }
}

// ============================================================================
// Event Handler Types
// ============================================================================

export type TypedEventHandler<T extends DomainEventUnion> = (event: T) => void | Promise<void>;

export interface TypedEventSubscription {
  id: string;
  unsubscribe: () => void;
}

// Type-safe event bus interface
export interface ITypedEventBus {
  publish<T extends DomainEventUnion>(event: T): Promise<void>;
  subscribe<T extends DomainEventUnion>(
    eventType: T['type'],
    handler: TypedEventHandler<T>
  ): TypedEventSubscription;
  unsubscribe(subscription: TypedEventSubscription): void;
}