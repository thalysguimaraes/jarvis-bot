import { z } from 'zod';
import {
  AudioEventType,
  TaskEventType,
  NoteEventType,
  PortfolioEventType,
  FundEventType,
  SystemEventType,
  MessageEventType,
} from './TypedEvents';

/**
 * Zod schemas for runtime validation of event payloads
 * Ensures data integrity and provides helpful error messages
 */

// ============================================================================
// Common Schemas
// ============================================================================

const DateSchema = z.preprocess((arg) => {
  if (typeof arg === 'string' || arg instanceof Date) {
    return new Date(arg);
  }
  return arg;
}, z.date());

const UserIdSchema = z.string().min(1, 'User ID is required');

const EventMetadataSchema = z.object({
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  timestamp: DateSchema.optional(),
  source: z.string().optional(),
  version: z.string().optional(),
}).partial();

// ============================================================================
// Audio Event Schemas
// ============================================================================

export const AudioReceivedSchema = z.object({
  type: z.literal(AudioEventType.RECEIVED),
  payload: z.object({
    userId: UserIdSchema,
    audioData: z.union([
      z.instanceof(ArrayBuffer),
      z.string().min(1, 'Audio data cannot be empty'),
    ]),
    mimeType: z.string().regex(/^audio\//, 'Must be an audio MIME type'),
    duration: z.number().positive().optional(),
    source: z.enum(['whatsapp', 'api', 'test']),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const AudioTranscribedSchema = z.object({
  type: z.literal(AudioEventType.TRANSCRIBED),
  payload: z.object({
    userId: UserIdSchema,
    transcription: z.string().min(1, 'Transcription cannot be empty'),
    language: z.string().length(2).optional(), // ISO 639-1
    confidence: z.number().min(0).max(1).optional(),
    processingTimeMs: z.number().nonnegative(),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const AudioClassifiedSchema = z.object({
  type: z.literal(AudioEventType.CLASSIFIED),
  payload: z.object({
    userId: UserIdSchema,
    transcription: z.string().min(1),
    classification: z.enum(['task', 'note', 'fund', 'question', 'other']),
    confidence: z.number().min(0).max(1),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const AudioProcessingFailedSchema = z.object({
  type: z.literal(AudioEventType.PROCESSING_FAILED),
  payload: z.object({
    userId: UserIdSchema,
    error: z.string().min(1),
    errorCode: z.string().min(1),
    stage: z.enum(['transcription', 'classification', 'routing']),
    retryable: z.boolean(),
  }),
  metadata: EventMetadataSchema.optional(),
});

// ============================================================================
// Task Event Schemas
// ============================================================================

export const TaskCreatedSchema = z.object({
  type: z.literal(TaskEventType.CREATED),
  payload: z.object({
    userId: UserIdSchema,
    taskId: z.string().min(1, 'Task ID is required'),
    title: z.string().min(1, 'Task title is required').max(500),
    description: z.string().max(5000).optional(),
    dueDate: DateSchema.optional(),
    project: z.string().max(100).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    labels: z.array(z.string()).max(10).optional(),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const TaskUpdatedSchema = z.object({
  type: z.literal(TaskEventType.UPDATED),
  payload: z.object({
    userId: UserIdSchema,
    taskId: z.string().min(1),
    changes: z.object({
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(5000).optional(),
      dueDate: DateSchema.optional(),
      project: z.string().max(100).optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      labels: z.array(z.string()).max(10).optional(),
    }).partial(),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const TaskCompletedSchema = z.object({
  type: z.literal(TaskEventType.COMPLETED),
  payload: z.object({
    userId: UserIdSchema,
    taskId: z.string().min(1),
    completedAt: DateSchema,
  }),
  metadata: EventMetadataSchema.optional(),
});

export const TaskDeletedSchema = z.object({
  type: z.literal(TaskEventType.DELETED),
  payload: z.object({
    userId: UserIdSchema,
    taskId: z.string().min(1),
    reason: z.string().max(500).optional(),
  }),
  metadata: EventMetadataSchema.optional(),
});

// ============================================================================
// Note Event Schemas
// ============================================================================

export const NoteCreatedSchema = z.object({
  type: z.literal(NoteEventType.CREATED),
  payload: z.object({
    userId: UserIdSchema,
    noteId: z.string().min(1, 'Note ID is required'),
    content: z.string().min(1, 'Note content is required').max(10000),
    tags: z.array(z.string().max(50)).max(20).optional(),
    source: z.enum(['voice', 'text', 'api']),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const NoteUpdatedSchema = z.object({
  type: z.literal(NoteEventType.UPDATED),
  payload: z.object({
    userId: UserIdSchema,
    noteId: z.string().min(1),
    content: z.string().min(1).max(10000).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const NoteSyncedSchema = z.object({
  type: z.literal(NoteEventType.SYNCED),
  payload: z.object({
    userId: UserIdSchema,
    noteIds: z.array(z.string()).min(1, 'At least one note ID required'),
    destination: z.enum(['obsidian', 'notion', 'github']),
    success: z.boolean(),
    syncedAt: DateSchema,
  }),
  metadata: EventMetadataSchema.optional(),
});

export const NoteDeletedSchema = z.object({
  type: z.literal(NoteEventType.DELETED),
  payload: z.object({
    userId: UserIdSchema,
    noteId: z.string().min(1),
  }),
  metadata: EventMetadataSchema.optional(),
});

// ============================================================================
// Portfolio Event Schemas
// ============================================================================

const HoldingSchema = z.object({
  ticker: z.string().min(1).max(10),
  value: z.number().nonnegative(),
  change: z.number(),
});

export const PortfolioUpdatedSchema = z.object({
  type: z.literal(PortfolioEventType.UPDATED),
  payload: z.object({
    userId: UserIdSchema,
    portfolioId: z.string().min(1),
    totalValue: z.number().nonnegative(),
    change: z.number(),
    changePercent: z.number(),
    holdings: z.array(HoldingSchema),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const PortfolioReportRequestedSchema = z.object({
  type: z.literal(PortfolioEventType.REPORT_REQUESTED),
  payload: z.object({
    userId: UserIdSchema,
    type: z.enum(['daily', 'weekly', 'monthly', 'on-demand']),
    requestedAt: DateSchema,
  }),
  metadata: EventMetadataSchema.optional(),
});

export const PortfolioReportSentSchema = z.object({
  type: z.literal(PortfolioEventType.REPORT_SENT),
  payload: z.object({
    userId: UserIdSchema,
    recipient: z.string().min(1),
    reportType: z.enum(['daily', 'weekly', 'monthly']),
    success: z.boolean(),
    messageId: z.string().optional(),
  }),
  metadata: EventMetadataSchema.optional(),
});

// ============================================================================
// Fund Event Schemas
// ============================================================================

const CNPJSchema = z.string().regex(/^\d{14}$/, 'CNPJ must be 14 digits');

export const FundPositionAddedSchema = z.object({
  type: z.literal(FundEventType.POSITION_ADDED),
  payload: z.object({
    userId: UserIdSchema,
    fundId: z.string().min(1),
    cnpj: CNPJSchema,
    name: z.string().min(1).max(200),
    shares: z.number().positive(),
    value: z.number().nonnegative(),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const FundPositionUpdatedSchema = z.object({
  type: z.literal(FundEventType.POSITION_UPDATED),
  payload: z.object({
    userId: UserIdSchema,
    fundId: z.string().min(1),
    cnpj: CNPJSchema,
    shares: z.number().positive(),
    value: z.number().nonnegative(),
    change: z.number(),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const FundPositionRemovedSchema = z.object({
  type: z.literal(FundEventType.POSITION_REMOVED),
  payload: z.object({
    userId: UserIdSchema,
    fundId: z.string().min(1),
    cnpj: CNPJSchema,
  }),
  metadata: EventMetadataSchema.optional(),
});

export const FundReportGeneratedSchema = z.object({
  type: z.literal(FundEventType.REPORT_GENERATED),
  payload: z.object({
    userId: UserIdSchema,
    totalValue: z.number().nonnegative(),
    totalChange: z.number(),
    positions: z.number().nonnegative(),
    reportDate: DateSchema,
  }),
  metadata: EventMetadataSchema.optional(),
});

// ============================================================================
// System Event Schemas
// ============================================================================

export const SystemErrorSchema = z.object({
  type: z.literal(SystemEventType.ERROR),
  payload: z.object({
    error: z.string().min(1),
    stack: z.string().optional(),
    module: z.string().min(1),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    context: z.record(z.string(), z.any()).optional(),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const SystemWarningSchema = z.object({
  type: z.literal(SystemEventType.WARNING),
  payload: z.object({
    message: z.string().min(1),
    module: z.string().min(1),
    code: z.string().optional(),
    context: z.record(z.string(), z.any()).optional(),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const HealthCheckSchema = z.object({
  type: z.literal(SystemEventType.HEALTH_CHECK),
  payload: z.object({
    service: z.string().min(1),
    healthy: z.boolean(),
    latency: z.number().nonnegative().optional(),
    details: z.record(z.string(), z.any()).optional(),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const SystemStartupSchema = z.object({
  type: z.literal(SystemEventType.STARTUP),
  payload: z.object({
    version: z.string().min(1),
    environment: z.string().min(1),
    modules: z.array(z.string()),
    startTime: DateSchema,
  }),
  metadata: EventMetadataSchema.optional(),
});

export const SystemShutdownSchema = z.object({
  type: z.literal(SystemEventType.SHUTDOWN),
  payload: z.object({
    reason: z.string().min(1),
    graceful: z.boolean(),
    shutdownTime: DateSchema,
  }),
  metadata: EventMetadataSchema.optional(),
});

// ============================================================================
// Message Event Schemas
// ============================================================================

export const MessageSentSchema = z.object({
  type: z.literal(MessageEventType.SENT),
  payload: z.object({
    recipient: z.string().min(1),
    messageType: z.enum(['text', 'audio', 'image', 'document']),
    content: z.string().min(1),
    success: z.boolean(),
    messageId: z.string().optional(),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const MessageQueuedSchema = z.object({
  type: z.literal(MessageEventType.QUEUED),
  payload: z.object({
    queueId: z.string().min(1),
    recipient: z.string().min(1),
    scheduledAt: DateSchema,
    priority: z.number().int().min(0).max(10),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const MessageFailedSchema = z.object({
  type: z.literal(MessageEventType.FAILED),
  payload: z.object({
    recipient: z.string().min(1),
    error: z.string().min(1),
    retryCount: z.number().int().nonnegative(),
    willRetry: z.boolean(),
  }),
  metadata: EventMetadataSchema.optional(),
});

export const MessageDeliveredSchema = z.object({
  type: z.literal(MessageEventType.DELIVERED),
  payload: z.object({
    messageId: z.string().min(1),
    recipient: z.string().min(1),
    deliveredAt: DateSchema,
    readAt: DateSchema.optional(),
  }),
  metadata: EventMetadataSchema.optional(),
});

// ============================================================================
// Event Schema Registry
// ============================================================================

export const EventSchemaRegistry = {
  // Audio Events
  [AudioEventType.RECEIVED]: AudioReceivedSchema,
  [AudioEventType.TRANSCRIBED]: AudioTranscribedSchema,
  [AudioEventType.CLASSIFIED]: AudioClassifiedSchema,
  [AudioEventType.PROCESSING_FAILED]: AudioProcessingFailedSchema,
  
  // Task Events
  [TaskEventType.CREATED]: TaskCreatedSchema,
  [TaskEventType.UPDATED]: TaskUpdatedSchema,
  [TaskEventType.COMPLETED]: TaskCompletedSchema,
  [TaskEventType.DELETED]: TaskDeletedSchema,
  
  // Note Events
  [NoteEventType.CREATED]: NoteCreatedSchema,
  [NoteEventType.UPDATED]: NoteUpdatedSchema,
  [NoteEventType.SYNCED]: NoteSyncedSchema,
  [NoteEventType.DELETED]: NoteDeletedSchema,
  
  // Portfolio Events
  [PortfolioEventType.UPDATED]: PortfolioUpdatedSchema,
  [PortfolioEventType.REPORT_REQUESTED]: PortfolioReportRequestedSchema,
  [PortfolioEventType.REPORT_SENT]: PortfolioReportSentSchema,
  
  // Fund Events
  [FundEventType.POSITION_ADDED]: FundPositionAddedSchema,
  [FundEventType.POSITION_UPDATED]: FundPositionUpdatedSchema,
  [FundEventType.POSITION_REMOVED]: FundPositionRemovedSchema,
  [FundEventType.REPORT_GENERATED]: FundReportGeneratedSchema,
  
  // System Events
  [SystemEventType.ERROR]: SystemErrorSchema,
  [SystemEventType.WARNING]: SystemWarningSchema,
  [SystemEventType.HEALTH_CHECK]: HealthCheckSchema,
  [SystemEventType.STARTUP]: SystemStartupSchema,
  [SystemEventType.SHUTDOWN]: SystemShutdownSchema,
  
  // Message Events
  [MessageEventType.SENT]: MessageSentSchema,
  [MessageEventType.QUEUED]: MessageQueuedSchema,
  [MessageEventType.FAILED]: MessageFailedSchema,
  [MessageEventType.DELIVERED]: MessageDeliveredSchema,
} as const;

// ============================================================================
// Validation Functions
// ============================================================================

export function validateEvent<T>(eventType: string, event: unknown): T {
  const schema = EventSchemaRegistry[eventType as keyof typeof EventSchemaRegistry];
  
  if (!schema) {
    throw new Error(`No schema found for event type: ${eventType}`);
  }
  
  const result = schema.safeParse(event);
  
  if (!result.success) {
    const errors = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Event validation failed for ${eventType}: ${errors}`);
  }
  
  return result.data as T;
}

export function isValidEvent(eventType: string, event: unknown): boolean {
  try {
    validateEvent(eventType, event);
    return true;
  } catch {
    return false;
  }
}