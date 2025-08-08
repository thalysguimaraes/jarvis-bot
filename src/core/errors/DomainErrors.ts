import { AppError, ErrorContext } from '../logging/ErrorHandler';
import { ErrorCode } from './ErrorResponse';

/**
 * Domain-specific error classes with retry strategies and recovery options
 */

// ============================================================================
// Audio Processing Errors
// ============================================================================

export class AudioProcessingError extends AppError {
  constructor(
    message: string,
    public readonly stage: 'upload' | 'transcription' | 'classification' | 'routing',
    context?: ErrorContext
  ) {
    super(
      message,
      'AUDIO_PROCESSING_ERROR',
      true,
      { ...context, module: 'AudioProcessing' } as ErrorContext,
      stage === 'upload' ? false : true // Retry for all stages except upload
    );
    this.name = 'AudioProcessingError';
  }
  
  static transcriptionFailed(reason: string, context?: ErrorContext): AudioProcessingError {
    return new AudioProcessingError(
      `Transcription failed: ${reason}`,
      'transcription',
      context
    );
  }
  
  static classificationFailed(reason: string, context?: ErrorContext): AudioProcessingError {
    return new AudioProcessingError(
      `Classification failed: ${reason}`,
      'classification',
      context
    );
  }
  
  static unsupportedFormat(format: string, context?: ErrorContext): AudioProcessingError {
    return new AudioProcessingError(
      `Unsupported audio format: ${format}`,
      'upload',
      context
    );
  }
}

// ============================================================================
// Task Management Errors
// ============================================================================

export class TaskManagementError extends AppError {
  constructor(
    message: string,
    public readonly operation: 'create' | 'update' | 'delete' | 'sync',
    context?: ErrorContext
  ) {
    super(
      message,
      'TASK_MANAGEMENT_ERROR',
      true,
      { ...context, module: 'TaskManagement', operation },
      operation === 'sync' // Only retry sync operations
    );
    this.name = 'TaskManagementError';
  }
  
  static todoistApiError(message: string, context?: ErrorContext): TaskManagementError {
    return new TaskManagementError(
      `Todoist API error: ${message}`,
      'sync',
      context
    );
  }
  
  static invalidTaskFormat(reason: string, context?: ErrorContext): TaskManagementError {
    return new TaskManagementError(
      `Invalid task format: ${reason}`,
      'create',
      context
    );
  }
  
  static taskNotFound(taskId: string, context?: ErrorContext): TaskManagementError {
    return new TaskManagementError(
      `Task not found: ${taskId}`,
      'update',
      context
    );
  }
}

// ============================================================================
// Note Sync Errors
// ============================================================================

export class NoteSyncError extends AppError {
  constructor(
    message: string,
    public readonly destination: 'obsidian' | 'notion' | 'github',
    context?: ErrorContext
  ) {
    super(
      message,
      'NOTE_SYNC_ERROR',
      true,
      { ...context, module: 'NoteSync' } as ErrorContext,
      true // Always retry sync errors
    );
    this.name = 'NoteSyncError';
  }
  
  static obsidianSyncFailed(reason: string, context?: ErrorContext): NoteSyncError {
    return new NoteSyncError(
      `Obsidian sync failed: ${reason}`,
      'obsidian',
      context
    );
  }
  
  static githubPushFailed(reason: string, context?: ErrorContext): NoteSyncError {
    return new NoteSyncError(
      `GitHub push failed: ${reason}`,
      'github',
      context
    );
  }
  
  static notionApiError(message: string, context?: ErrorContext): NoteSyncError {
    return new NoteSyncError(
      `Notion API error: ${message}`,
      'notion',
      context
    );
  }
}

// ============================================================================
// Portfolio Errors
// ============================================================================

export class PortfolioError extends AppError {
  constructor(
    message: string,
    public readonly component: 'data' | 'api' | 'calculation' | 'report',
    context?: ErrorContext
  ) {
    super(
      message,
      'PORTFOLIO_ERROR',
      true,
      { ...context, module: 'Portfolio' } as ErrorContext,
      component === 'api' // Retry API errors
    );
    this.name = 'PortfolioError';
  }
  
  static brapiApiError(message: string, context?: ErrorContext): PortfolioError {
    return new PortfolioError(
      `Brapi API error: ${message}`,
      'api',
      context
    );
  }
  
  static invalidPortfolioData(reason: string, context?: ErrorContext): PortfolioError {
    return new PortfolioError(
      `Invalid portfolio data: ${reason}`,
      'data',
      context
    );
  }
  
  static calculationError(reason: string, context?: ErrorContext): PortfolioError {
    return new PortfolioError(
      `Portfolio calculation error: ${reason}`,
      'calculation',
      context
    );
  }
  
  static reportGenerationFailed(reason: string, context?: ErrorContext): PortfolioError {
    return new PortfolioError(
      `Report generation failed: ${reason}`,
      'report',
      context
    );
  }
}

// ============================================================================
// Fund Management Errors
// ============================================================================

export class FundManagementError extends AppError {
  constructor(
    message: string,
    public readonly operation: 'fetch' | 'calculate' | 'update' | 'report',
    context?: ErrorContext
  ) {
    super(
      message,
      'FUND_MANAGEMENT_ERROR',
      true,
      { ...context, module: 'FundManagement', operation },
      operation === 'fetch' // Retry fetch operations
    );
    this.name = 'FundManagementError';
  }
  
  static zaisenApiError(message: string, context?: ErrorContext): FundManagementError {
    return new FundManagementError(
      `Zaisen API error: ${message}`,
      'fetch',
      context
    );
  }
  
  static invalidCNPJ(cnpj: string, context?: ErrorContext): FundManagementError {
    return new FundManagementError(
      `Invalid CNPJ: ${cnpj}`,
      'update',
      context
    );
  }
  
  static fundNotFound(identifier: string, context?: ErrorContext): FundManagementError {
    return new FundManagementError(
      `Fund not found: ${identifier}`,
      'fetch',
      context
    );
  }
}

// ============================================================================
// Messaging Errors
// ============================================================================

export class MessagingError extends AppError {
  constructor(
    message: string,
    public readonly service: 'zapi' | 'whatsapp' | 'telegram',
    public readonly operation: 'send' | 'receive' | 'status',
    context?: ErrorContext
  ) {
    super(
      message,
      'MESSAGING_ERROR',
      true,
      { ...context, module: 'Messaging', operation } as ErrorContext,
      operation === 'send' // Retry send operations
    );
    this.name = 'MessagingError';
  }
  
  static zapiSendFailed(reason: string, context?: ErrorContext): MessagingError {
    return new MessagingError(
      `Z-API send failed: ${reason}`,
      'zapi',
      'send',
      context
    );
  }
  
  static invalidRecipient(recipient: string, context?: ErrorContext): MessagingError {
    return new MessagingError(
      `Invalid recipient: ${recipient}`,
      'whatsapp',
      'send',
      context
    );
  }
  
  static messageQueueFull(context?: ErrorContext): MessagingError {
    return new MessagingError(
      'Message queue is full',
      'whatsapp',
      'send',
      context
    );
  }
}

// ============================================================================
// Storage Errors
// ============================================================================

export class StorageError extends AppError {
  constructor(
    message: string,
    public readonly operation: 'read' | 'write' | 'delete' | 'list',
    public readonly storage: 'kv' | 'r2' | 'memory',
    context?: ErrorContext
  ) {
    super(
      message,
      'STORAGE_ERROR',
      true,
      { ...context, module: 'Storage', operation } as ErrorContext,
      operation === 'read' // Retry read operations
    );
    this.name = 'StorageError';
  }
  
  static kvReadFailed(key: string, context?: ErrorContext): StorageError {
    return new StorageError(
      `Failed to read KV key: ${key}`,
      'read',
      'kv',
      context
    );
  }
  
  static kvWriteFailed(key: string, context?: ErrorContext): StorageError {
    return new StorageError(
      `Failed to write KV key: ${key}`,
      'write',
      'kv',
      context
    );
  }
  
  static quotaExceeded(storage: 'kv' | 'r2', context?: ErrorContext): StorageError {
    return new StorageError(
      `Storage quota exceeded for ${storage}`,
      'write',
      storage,
      context
    );
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

export class ConfigurationError extends AppError {
  constructor(
    message: string,
    public readonly configKey: string,
    context?: ErrorContext
  ) {
    super(
      message,
      ErrorCode.CONFIGURATION_ERROR,
      false, // Configuration errors are not operational
      { ...context, module: 'Configuration' } as ErrorContext,
      false // Don't retry configuration errors
    );
    this.name = 'ConfigurationError';
  }
  
  static missingRequired(key: string, context?: ErrorContext): ConfigurationError {
    return new ConfigurationError(
      `Required configuration missing: ${key}`,
      key,
      context
    );
  }
  
  static invalidValue(key: string, value: any, context?: ErrorContext): ConfigurationError {
    return new ConfigurationError(
      `Invalid configuration value for ${key}: ${value}`,
      key,
      context
    );
  }
  
  static environmentMismatch(expected: string, actual: string, context?: ErrorContext): ConfigurationError {
    return new ConfigurationError(
      `Environment mismatch - expected: ${expected}, actual: ${actual}`,
      'environment',
      context
    );
  }
}

// ============================================================================
// Error Recovery Strategies
// ============================================================================

export interface ErrorRecoveryStrategy {
  shouldRetry(error: AppError, attemptNumber: number): boolean;
  getRetryDelay(error: AppError, attemptNumber: number): number;
  getMaxRetries(error: AppError): number;
  handleFinalFailure(error: AppError): void;
}

export class ExponentialBackoffStrategy implements ErrorRecoveryStrategy {
  constructor(
    private baseDelayMs: number = 1000,
    private maxDelayMs: number = 30000,
    private maxRetries: number = 3
  ) {}
  
  shouldRetry(error: AppError, attemptNumber: number): boolean {
    return error.retryable && attemptNumber < this.getMaxRetries(error);
  }
  
  getRetryDelay(_error: AppError, attemptNumber: number): number {
    const delay = Math.min(
      this.baseDelayMs * Math.pow(2, attemptNumber - 1),
      this.maxDelayMs
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }
  
  getMaxRetries(error: AppError): number {
    // Different retry counts for different error types
    if (error instanceof MessagingError) return 5;
    if (error instanceof StorageError) return 3;
    if (error instanceof AudioProcessingError) return 2;
    return this.maxRetries;
  }
  
  handleFinalFailure(error: AppError): void {
    // Log to error tracking service
    console.error('Final failure after retries', {
      error: error.message,
      code: error.code,
      context: error.context,
    });
  }
}

export class CircuitBreakerStrategy implements ErrorRecoveryStrategy {
  private failures = new Map<string, number>();
  private lastFailure = new Map<string, number>();
  private circuitOpen = new Map<string, boolean>();
  
  constructor(
    private threshold: number = 5,
    private resetTimeMs: number = 60000
  ) {}
  
  shouldRetry(error: AppError, attemptNumber: number): boolean {
    const key = this.getErrorKey(error);
    
    // Check if circuit is open
    if (this.circuitOpen.get(key)) {
      const lastFailureTime = this.lastFailure.get(key) || 0;
      if (Date.now() - lastFailureTime < this.resetTimeMs) {
        return false; // Circuit still open
      }
      // Reset circuit
      this.circuitOpen.set(key, false);
      this.failures.set(key, 0);
    }
    
    return error.retryable && attemptNumber < 3;
  }
  
  getRetryDelay(_error: AppError, attemptNumber: number): number {
    return 1000 * attemptNumber;
  }
  
  getMaxRetries(_error: AppError): number {
    return 3;
  }
  
  handleFinalFailure(error: AppError): void {
    const key = this.getErrorKey(error);
    const failures = (this.failures.get(key) || 0) + 1;
    this.failures.set(key, failures);
    this.lastFailure.set(key, Date.now());
    
    if (failures >= this.threshold) {
      this.circuitOpen.set(key, true);
      console.error('Circuit breaker opened', {
        key,
        failures,
        error: error.message,
      });
    }
  }
  
  private getErrorKey(error: AppError): string {
    return `${error.name}:${error.code}`;
  }
}

// ============================================================================
// Error Handler with Recovery
// ============================================================================

export class DomainErrorHandler {
  constructor(
    private strategy: ErrorRecoveryStrategy = new ExponentialBackoffStrategy()
  ) {}
  
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    _errorContext?: ErrorContext
  ): Promise<T> {
    let attempt = 0;
    
    while (true) {
      attempt++;
      
      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof AppError)) {
          throw error; // Non-recoverable error
        }
        
        if (!this.strategy.shouldRetry(error, attempt)) {
          this.strategy.handleFinalFailure(error);
          throw error;
        }
        
        const delay = this.strategy.getRetryDelay(error, attempt);
        console.log(`Retrying after ${delay}ms (attempt ${attempt})`, {
          error: error.message,
          code: error.code,
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}