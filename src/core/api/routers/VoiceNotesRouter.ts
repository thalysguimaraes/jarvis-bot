import { DomainRouter, RouteContext } from './DomainRouter';
import { z } from 'zod';
import { VoiceNoteSyncService } from '../../../domains/notes/services/VoiceNoteSyncService';
import { KVStorageService } from '../../services/storage/KVStorageService';
import { Logger } from '../../logging/Logger';
import { ErrorResponseBuilder, ErrorCode } from '../../errors/ErrorResponse';
import { ServiceTokens } from '../../services/ServiceRegistry';

/**
 * Router for voice notes API endpoints used by the Obsidian plugin
 * Provides endpoints to fetch unprocessed notes and mark them as processed
 */
export class VoiceNotesRouter extends DomainRouter {
  private voiceNoteSyncService?: VoiceNoteSyncService;

  protected initialize(): void {
    this.setPrefix('/api/voice-notes');
    
    // Health check endpoint
    this.get('/health', this.healthCheck.bind(this), {
      description: 'Health check for voice notes API',
    });
    
    // Get unprocessed voice notes
    this.get('/unprocessed', this.getUnprocessedNotes.bind(this), {
      description: 'Fetch unprocessed voice notes for Obsidian sync',
      middleware: [this.validateApiKey.bind(this)],
    });
    
    // Mark note as processed
    this.post('/:noteId/processed', this.markNoteAsProcessed.bind(this), {
      description: 'Mark a voice note as processed',
      validation: {
        params: z.object({
          noteId: z.string().min(1),
        }),
      },
      middleware: [this.validateApiKey.bind(this)],
    });
  }

  /**
   * Initialize the voice note sync service
   */
  private getVoiceNoteSyncService(context: RouteContext): VoiceNoteSyncService {
    if (!this.voiceNoteSyncService) {
      // Get KV namespace from environment
      const env = context.container.tryResolve(ServiceTokens.ENV) as any;
      if (!env?.USER_CONFIGS) {
        throw new Error('USER_CONFIGS KV namespace not configured');
      }
      
      // Create service instances
      const storageService = new KVStorageService(env.USER_CONFIGS);
      const logger = new Logger();
      this.voiceNoteSyncService = new VoiceNoteSyncService(storageService, logger);
    }
    return this.voiceNoteSyncService;
  }

  /**
   * Middleware to validate API key for Obsidian plugin
   */
  private async validateApiKey(
    request: Request,
    _params: Record<string, any>,
    context: RouteContext,
    next: () => Promise<Response>
  ): Promise<Response> {
    const apiKey = request.headers.get('X-API-Key');
    
    if (!apiKey) {
      return ErrorResponseBuilder.create(
        ErrorCode.UNAUTHENTICATED,
        'API key required'
      )
        .withCorrelationId(context.correlationId)
        .toResponse();
    }
    
    // Get expected API key from environment
    const env = context.container.tryResolve(ServiceTokens.ENV) as any;
    const expectedKey = env?.OBSIDIAN_API_KEY;
    
    if (!expectedKey) {
      this.logger.error('OBSIDIAN_API_KEY not configured', {
        correlationId: context.correlationId,
      });
      return ErrorResponseBuilder.create(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Voice notes API not properly configured'
      )
        .withCorrelationId(context.correlationId)
        .toResponse();
    }
    
    if (apiKey !== expectedKey) {
      this.logger.warn('Invalid API key attempt for voice notes', {
        correlationId: context.correlationId,
        providedKey: apiKey.substring(0, 4) + '***',
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INVALID_TOKEN,
        'Invalid API key'
      )
        .withCorrelationId(context.correlationId)
        .toResponse();
    }
    
    // API key valid, continue
    context.metadata.authenticated = true;
    return next();
  }

  /**
   * Health check endpoint
   */
  private async healthCheck(
    _request: Request,
    _params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    try {
      // Check if voice note service can be initialized
      const service = this.getVoiceNoteSyncService(context);
      
      return this.successResponse({
        status: 'healthy',
        service: 'voice-notes-api',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        configured: !!service,
      });
    } catch (error) {
      this.logger.error('Voice notes API health check failed', error as Error);
      
      return this.successResponse({
        status: 'unhealthy',
        service: 'voice-notes-api',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      }, 503);
    }
  }

  /**
   * Get unprocessed voice notes
   */
  private async getUnprocessedNotes(
    _request: Request,
    _params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    try {
      const service = this.getVoiceNoteSyncService(context);
      
      // Fetch unprocessed notes
      const notes = await service.getUnprocessedNotes();
      
      // Format notes for Obsidian plugin
      const formattedNotes = notes.map(note => ({
        id: note.id,
        transcription: note.transcription,
        timestamp: note.timestamp,
        phone: note.phone,
        metadata: note.metadata || {},
      }));
      
      this.logger.info('Retrieved unprocessed voice notes', {
        correlationId: context.correlationId,
        count: formattedNotes.length,
      });
      
      return this.successResponse({
        notes: formattedNotes,
        count: formattedNotes.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to get unprocessed notes', error as Error, {
        correlationId: context.correlationId,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INTERNAL_ERROR,
        'Failed to retrieve unprocessed notes'
      )
        .withCorrelationId(context.correlationId)
        .withRetry(true)
        .toResponse();
    }
  }

  /**
   * Mark a note as processed
   */
  private async markNoteAsProcessed(
    _request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { noteId } = params.params;
    
    try {
      const service = this.getVoiceNoteSyncService(context);
      
      // Mark the note as synced to Obsidian
      await service.markNoteAsSynced(noteId);
      
      this.logger.info('Voice note marked as processed', {
        correlationId: context.correlationId,
        noteId,
      });
      
      return this.successResponse({
        success: true,
        noteId,
        message: 'Note marked as processed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Handle note not found specifically
      if (errorMessage.includes('not found')) {
        return ErrorResponseBuilder.create(
          ErrorCode.RESOURCE_NOT_FOUND,
          `Note ${noteId} not found`
        )
          .withCorrelationId(context.correlationId)
          .toResponse();
      }
      
      this.logger.error('Failed to mark note as processed', error as Error, {
        correlationId: context.correlationId,
        noteId,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INTERNAL_ERROR,
        'Failed to mark note as processed'
      )
        .withCorrelationId(context.correlationId)
        .withRetry(true)
        .toResponse();
    }
  }
}