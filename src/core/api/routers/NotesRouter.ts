import { DomainRouter, RouteContext } from './DomainRouter';
import { z } from 'zod';
import { EventFactory, NoteEventType } from '../../event-bus/TypedEvents';
import { validateEvent } from '../../event-bus/EventSchemas';
import { ServiceTokens } from '../../services/ServiceRegistry';
import { ErrorResponseBuilder, ErrorCode } from '../../errors/ErrorResponse';

/**
 * Router for notes management and synchronization endpoints
 */

// Validation schemas
const CreateNoteSchema = z.object({
  content: z.string().min(1).max(10000),
  tags: z.array(z.string()).optional(),
  source: z.enum(['voice', 'text', 'api']).default('api'),
});

const UpdateNoteSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  tags: z.array(z.string()).optional(),
});

const SyncNotesSchema = z.object({
  noteIds: z.array(z.string()).optional(),
  destination: z.enum(['obsidian', 'notion', 'github']).default('obsidian'),
  force: z.boolean().default(false),
});

// const VoiceSyncApiKeySchema = z.object({
//   'X-API-Key': z.string().min(1),
// });

export class NotesRouter extends DomainRouter {
  protected initialize(): void {
    this.setPrefix('/api/notes');
    
    // Notes CRUD operations
    this.get('/list/:userId', this.listNotes.bind(this), {
      description: 'List all notes for a user',
      validation: {
        params: z.object({
          userId: z.string().min(1),
        }),
        query: z.object({
          limit: z.string().regex(/^\d+$/).optional(),
          offset: z.string().regex(/^\d+$/).optional(),
          tags: z.string().optional(), // comma-separated
        }).optional(),
      },
    });
    
    this.get('/:noteId', this.getNote.bind(this), {
      description: 'Get a specific note',
      validation: {
        params: z.object({
          noteId: z.string().min(1),
        }),
      },
    });
    
    this.post('/create', this.createNote.bind(this), {
      description: 'Create a new note',
      validation: {
        body: CreateNoteSchema,
        query: z.object({
          userId: z.string().default('default'),
        }),
      },
    });
    
    this.put('/:noteId', this.updateNote.bind(this), {
      description: 'Update an existing note',
      validation: {
        params: z.object({
          noteId: z.string().min(1),
        }),
        body: UpdateNoteSchema,
      },
    });
    
    this.delete('/:noteId', this.deleteNote.bind(this), {
      description: 'Delete a note',
      validation: {
        params: z.object({
          noteId: z.string().min(1),
        }),
      },
    });
    
    // Synchronization endpoints
    this.post('/sync', this.syncNotes.bind(this), {
      description: 'Sync notes to external service',
      validation: {
        body: SyncNotesSchema,
        query: z.object({
          userId: z.string().default('default'),
        }),
      },
    });
    
    // Voice note sync API (Obsidian integration)
    this.post('/voice-sync', this.voiceNoteSync.bind(this), {
      description: 'Sync voice note from Obsidian plugin',
      validation: {
        body: z.object({
          content: z.string().min(1),
          timestamp: z.string().optional(),
          metadata: z.record(z.any()).optional(),
        }),
      },
      middleware: [this.validateApiKey.bind(this)],
    });
    
    this.get('/voice-sync/notes', this.getVoiceNotes.bind(this), {
      description: 'Get voice notes for Obsidian sync',
      validation: {
        query: z.object({
          since: z.string().optional(),
          limit: z.string().regex(/^\d+$/).optional(),
        }).optional(),
      },
      middleware: [this.validateApiKey.bind(this)],
    });
    
    // Search endpoint
    this.get('/search', this.searchNotes.bind(this), {
      description: 'Search notes',
      validation: {
        query: z.object({
          q: z.string().min(1),
          userId: z.string().default('default'),
          tags: z.string().optional(),
        }),
      },
    });
  }
  
  /**
   * Middleware to validate API key for voice sync
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
    
    // Get expected API key from config
    const configService = context.container.tryResolve('IConfigService');
    const expectedKey = configService?.get('services.obsidian.apiKey') || 
                       (context.container.tryResolve(ServiceTokens.ENV) as any)?.OBSIDIAN_API_KEY;
    
    if (!expectedKey || apiKey !== expectedKey) {
      this.logger.warn('Invalid API key attempt', {
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
   * List notes for a user
   */
  private async listNotes(
    request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { userId } = params.params;
    const { limit = '100', offset = '0', tags } = params.query || {};
    
    try {
      const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
      
      if (!storageService) {
        return ErrorResponseBuilder.create(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Storage service not available'
        )
          .withCorrelationId(context.correlationId)
          .toResponse();
      }
      
      // Get notes from storage
      const notesKey = `notes:list:${userId}`;
      const notesData = await (storageService as any).get(notesKey);
      
      if (!notesData) {
        return this.successResponse({
          notes: [],
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset),
        });
      }
      
      let notes = JSON.parse(notesData);
      
      // Filter by tags if provided
      if (tags) {
        const tagList = tags.split(',').map(t => t.trim());
        notes = notes.filter((note: any) => 
          note.tags && note.tags.some((tag: string) => tagList.includes(tag))
        );
      }
      
      // Apply pagination
      const total = notes.length;
      const startIndex = parseInt(offset);
      const endIndex = startIndex + parseInt(limit);
      notes = notes.slice(startIndex, endIndex);
      
      return this.successResponse({
        notes,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
    } catch (error) {
      this.logger.error('Failed to list notes', error as Error, {
        correlationId: context.correlationId,
        userId,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INTERNAL_ERROR,
        'Failed to retrieve notes'
      )
        .withCorrelationId(context.correlationId)
        .withRetry(true)
        .toResponse();
    }
  }
  
  /**
   * Get a specific note
   */
  private async getNote(
    request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { noteId } = params.params;
    
    try {
      const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
      
      if (!storageService) {
        return ErrorResponseBuilder.create(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Storage service not available'
        )
          .withCorrelationId(context.correlationId)
          .toResponse();
      }
      
      const noteKey = `notes:item:${noteId}`;
      const noteData = await (storageService as any).get(noteKey);
      
      if (!noteData) {
        return ErrorResponseBuilder.create(
          ErrorCode.RESOURCE_NOT_FOUND,
          `Note ${noteId} not found`
        )
          .withCorrelationId(context.correlationId)
          .toResponse();
      }
      
      return this.successResponse(JSON.parse(noteData));
    } catch (error) {
      this.logger.error('Failed to get note', error as Error, {
        correlationId: context.correlationId,
        noteId,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INTERNAL_ERROR,
        'Failed to retrieve note'
      )
        .withCorrelationId(context.correlationId)
        .withRetry(true)
        .toResponse();
    }
  }
  
  /**
   * Create a new note
   */
  private async createNote(
    request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { content, tags, source } = params.body;
    const { userId = 'default' } = params.query || {};
    
    try {
      const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create typed event
      const noteEvent = EventFactory.noteCreated({
        userId,
        noteId,
        content,
        tags,
        source,
      }, {
        correlationId: context.correlationId,
        source: 'NotesRouter',
      });
      
      // Validate event
      validateEvent(NoteEventType.CREATED, noteEvent);
      
      // Store note
      const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
      
      if (!storageService) {
        return ErrorResponseBuilder.create(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Storage service not available'
        )
          .withCorrelationId(context.correlationId)
          .toResponse();
      }
      
      const note = {
        noteId,
        userId,
        content,
        tags: tags || [],
        source,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Store individual note
      await (storageService as any).set(`notes:item:${noteId}`, JSON.stringify(note));
      
      // Update user's note list
      const listKey = `notes:list:${userId}`;
      const existingList = await (storageService as any).get(listKey);
      const notesList = existingList ? JSON.parse(existingList) : [];
      notesList.unshift(note);
      await (storageService as any).set(listKey, JSON.stringify(notesList));
      
      // Publish event
      await context.eventBus.publish(noteEvent as any);
      
      this.logger.info('Note created', {
        correlationId: context.correlationId,
        noteId,
        userId,
        source,
      });
      
      return this.successResponse({
        noteId,
        message: 'Note created successfully',
        note,
      }, 201);
    } catch (error) {
      this.logger.error('Failed to create note', error as Error, {
        correlationId: context.correlationId,
        userId,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INTERNAL_ERROR,
        'Failed to create note'
      )
        .withCorrelationId(context.correlationId)
        .withRetry(true)
        .toResponse();
    }
  }
  
  /**
   * Update an existing note
   */
  private async updateNote(
    request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { noteId } = params.params;
    const updates = params.body;
    
    try {
      const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
      
      if (!storageService) {
        return ErrorResponseBuilder.create(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Storage service not available'
        )
          .withCorrelationId(context.correlationId)
          .toResponse();
      }
      
      // Get existing note
      const noteKey = `notes:item:${noteId}`;
      const existingData = await (storageService as any).get(noteKey);
      
      if (!existingData) {
        return ErrorResponseBuilder.create(
          ErrorCode.RESOURCE_NOT_FOUND,
          `Note ${noteId} not found`
        )
          .withCorrelationId(context.correlationId)
          .toResponse();
      }
      
      const note = JSON.parse(existingData);
      
      // Apply updates
      const updatedNote = {
        ...note,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      // Save updated note
      await (storageService as any).set(noteKey, JSON.stringify(updatedNote));
      
      // Update in user's list
      const listKey = `notes:list:${note.userId}`;
      const listData = await (storageService as any).get(listKey);
      if (listData) {
        const notesList = JSON.parse(listData);
        const noteIndex = notesList.findIndex((n: any) => n.noteId === noteId);
        if (noteIndex !== -1) {
          notesList[noteIndex] = updatedNote;
          await (storageService as any).set(listKey, JSON.stringify(notesList));
        }
      }
      
      // Publish update event
      const updateEvent = EventFactory.noteUpdated({
        userId: note.userId,
        noteId,
        ...updates,
      }, {
        correlationId: context.correlationId,
        source: 'NotesRouter',
      });
      
      await context.eventBus.publish(updateEvent as any);
      
      return this.successResponse({
        message: 'Note updated successfully',
        note: updatedNote,
      });
    } catch (error) {
      this.logger.error('Failed to update note', error as Error, {
        correlationId: context.correlationId,
        noteId,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INTERNAL_ERROR,
        'Failed to update note'
      )
        .withCorrelationId(context.correlationId)
        .withRetry(true)
        .toResponse();
    }
  }
  
  /**
   * Delete a note
   */
  private async deleteNote(
    request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { noteId } = params.params;
    
    try {
      const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
      
      if (!storageService) {
        return ErrorResponseBuilder.create(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Storage service not available'
        )
          .withCorrelationId(context.correlationId)
          .toResponse();
      }
      
      // Get note to find userId
      const noteKey = `notes:item:${noteId}`;
      const noteData = await (storageService as any).get(noteKey);
      
      if (!noteData) {
        return ErrorResponseBuilder.create(
          ErrorCode.RESOURCE_NOT_FOUND,
          `Note ${noteId} not found`
        )
          .withCorrelationId(context.correlationId)
          .toResponse();
      }
      
      const note = JSON.parse(noteData);
      
      // Delete note
      await (storageService as any).delete(noteKey);
      
      // Remove from user's list
      const listKey = `notes:list:${note.userId}`;
      const listData = await (storageService as any).get(listKey);
      if (listData) {
        const notesList = JSON.parse(listData);
        const filteredList = notesList.filter((n: any) => n.noteId !== noteId);
        await (storageService as any).set(listKey, JSON.stringify(filteredList));
      }
      
      // Publish delete event
      const deleteEvent = EventFactory.noteDeleted({
        userId: note.userId,
        noteId,
      }, {
        correlationId: context.correlationId,
        source: 'NotesRouter',
      });
      
      await context.eventBus.publish(deleteEvent as any);
      
      return this.successResponse({
        message: 'Note deleted successfully',
        noteId,
      });
    } catch (error) {
      this.logger.error('Failed to delete note', error as Error, {
        correlationId: context.correlationId,
        noteId,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INTERNAL_ERROR,
        'Failed to delete note'
      )
        .withCorrelationId(context.correlationId)
        .withRetry(true)
        .toResponse();
    }
  }
  
  /**
   * Sync notes to external service
   */
  private async syncNotes(
    request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { noteIds, destination, force } = params.body;
    const { userId = 'default' } = params.query || {};
    
    try {
      // If no specific noteIds, sync all notes for user
      let notesToSync = noteIds;
      
      if (!notesToSync || notesToSync.length === 0) {
        const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
        if (storageService) {
          const listKey = `notes:list:${userId}`;
          const listData = await (storageService as any).get(listKey);
          if (listData) {
            const notesList = JSON.parse(listData);
            notesToSync = notesList.map((n: any) => n.noteId);
          }
        }
      }
      
      if (!notesToSync || notesToSync.length === 0) {
        return this.successResponse({
          message: 'No notes to sync',
          synced: 0,
        });
      }
      
      // Publish sync event
      const syncEvent = EventFactory.noteSynced({
        userId,
        noteIds: notesToSync,
        destination,
        success: true,
        syncedAt: new Date(),
      }, {
        correlationId: context.correlationId,
        source: 'NotesRouter',
      });
      
      validateEvent(NoteEventType.SYNCED, syncEvent);
      await context.eventBus.publish(syncEvent as any);
      
      this.logger.info('Notes sync initiated', {
        correlationId: context.correlationId,
        userId,
        destination,
        noteCount: notesToSync.length,
      });
      
      return this.successResponse({
        message: 'Sync initiated',
        noteIds: notesToSync,
        destination,
        correlationId: context.correlationId,
      });
    } catch (error) {
      this.logger.error('Failed to sync notes', error as Error, {
        correlationId: context.correlationId,
        userId,
        destination,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INTERNAL_ERROR,
        'Failed to sync notes'
      )
        .withCorrelationId(context.correlationId)
        .withRetry(true)
        .toResponse();
    }
  }
  
  /**
   * Voice note sync from Obsidian plugin
   */
  private async voiceNoteSync(
    request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { content, timestamp, metadata } = params.body;
    
    try {
      // Create note from voice sync
      const noteId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userId = 'obsidian_user'; // Default user for Obsidian sync
      
      const note = {
        noteId,
        userId,
        content,
        tags: ['voice', 'obsidian'],
        source: 'voice' as const,
        createdAt: timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata,
      };
      
      // Store note
      const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
      if (storageService) {
        await (storageService as any).set(`notes:item:${noteId}`, JSON.stringify(note));
        
        // Update user's note list
        const listKey = `notes:list:${userId}`;
        const existingList = await (storageService as any).get(listKey);
        const notesList = existingList ? JSON.parse(existingList) : [];
        notesList.unshift(note);
        await (storageService as any).set(listKey, JSON.stringify(notesList));
      }
      
      // Publish event
      const noteEvent = EventFactory.noteCreated({
        userId,
        noteId,
        content,
        tags: ['voice', 'obsidian'],
        source: 'voice',
      }, {
        correlationId: context.correlationId,
        source: 'NotesRouter:VoiceSync',
      });
      
      await context.eventBus.publish(noteEvent as any);
      
      return this.successResponse({
        success: true,
        noteId,
        message: 'Voice note synced successfully',
      });
    } catch (error) {
      this.logger.error('Failed to sync voice note', error as Error, {
        correlationId: context.correlationId,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INTERNAL_ERROR,
        'Failed to sync voice note'
      )
        .withCorrelationId(context.correlationId)
        .withRetry(true)
        .toResponse();
    }
  }
  
  /**
   * Get voice notes for Obsidian sync
   */
  private async getVoiceNotes(
    request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { since, limit = '50' } = params.query || {};
    
    try {
      const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
      
      if (!storageService) {
        return ErrorResponseBuilder.create(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Storage service not available'
        )
          .withCorrelationId(context.correlationId)
          .toResponse();
      }
      
      // Get voice notes for Obsidian user
      const userId = 'obsidian_user';
      const listKey = `notes:list:${userId}`;
      const listData = await (storageService as any).get(listKey);
      
      if (!listData) {
        return this.successResponse({
          notes: [],
          total: 0,
        });
      }
      
      let notes = JSON.parse(listData);
      
      // Filter voice notes
      notes = notes.filter((note: any) => 
        note.tags && note.tags.includes('voice')
      );
      
      // Filter by timestamp if provided
      if (since) {
        const sinceDate = new Date(since);
        notes = notes.filter((note: any) => 
          new Date(note.createdAt) > sinceDate
        );
      }
      
      // Apply limit
      notes = notes.slice(0, parseInt(limit));
      
      return this.successResponse({
        notes,
        total: notes.length,
      });
    } catch (error) {
      this.logger.error('Failed to get voice notes', error as Error, {
        correlationId: context.correlationId,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INTERNAL_ERROR,
        'Failed to retrieve voice notes'
      )
        .withCorrelationId(context.correlationId)
        .withRetry(true)
        .toResponse();
    }
  }
  
  /**
   * Search notes
   */
  private async searchNotes(
    request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { q, userId = 'default', tags } = params.query;
    
    try {
      const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
      
      if (!storageService) {
        return ErrorResponseBuilder.create(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Storage service not available'
        )
          .withCorrelationId(context.correlationId)
          .toResponse();
      }
      
      // Get user's notes
      const listKey = `notes:list:${userId}`;
      const listData = await (storageService as any).get(listKey);
      
      if (!listData) {
        return this.successResponse({
          results: [],
          total: 0,
          query: q,
        });
      }
      
      let notes = JSON.parse(listData);
      
      // Search in content
      const searchQuery = q.toLowerCase();
      notes = notes.filter((note: any) => 
        note.content.toLowerCase().includes(searchQuery)
      );
      
      // Filter by tags if provided
      if (tags) {
        const tagList = tags.split(',').map((t: string) => t.trim());
        notes = notes.filter((note: any) => 
          note.tags && note.tags.some((tag: string) => tagList.includes(tag))
        );
      }
      
      return this.successResponse({
        results: notes,
        total: notes.length,
        query: q,
      });
    } catch (error) {
      this.logger.error('Failed to search notes', error as Error, {
        correlationId: context.correlationId,
        query: q,
        userId,
      });
      
      return ErrorResponseBuilder.create(
        ErrorCode.INTERNAL_ERROR,
        'Failed to search notes'
      )
        .withCorrelationId(context.correlationId)
        .withRetry(true)
        .toResponse();
    }
  }
}