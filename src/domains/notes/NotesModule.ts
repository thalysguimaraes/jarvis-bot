import { BaseDomainModule, ModuleHealth } from '../../core/modules/IDomainModule';
import { IStorageService } from '../../core/services/interfaces/IStorageService';
import { ILogger } from '../../core/logging/Logger';
import { DependencyContainer } from '../../core/services/ServiceRegistry';
import {
  NoteCreatedEvent,
  NoteSyncedEvent,
  AudioTranscribedEvent,
  AudioClassifiedEvent
} from '../../core/event-bus/EventTypes';
import { Note, NoteStorage, VoiceNote } from './types';
import { VoiceNoteSyncService, IVoiceNoteSyncService } from './services/VoiceNoteSyncService';

/**
 * Notes Domain Module
 * Handles note storage and synchronization
 */
export class NotesModule extends BaseDomainModule {
  private storageService!: IStorageService;
  private logger!: ILogger;
  private voiceSyncService!: IVoiceNoteSyncService;
  
  private readonly NAMESPACE = 'notes';
  private readonly SYNC_BATCH_SIZE = 50;
  
  constructor() {
    super('NotesModule', '2.0.0', ['storage', 'logger']);
  }
  
  protected async onInitialize(): Promise<void> {
    // Resolve dependencies
    this.storageService = this.container.resolve<IStorageService>('IStorageService');
    this.logger = this.container.resolve<ILogger>('ILogger');
    
    // Initialize voice sync service
    this.voiceSyncService = new VoiceNoteSyncService(this.storageService, this.logger);
    
    this.logger.info('Notes Module initialized with voice sync support');
  }
  
  protected subscribeToEvents(): void {
    // Subscribe to note events
    this.subscribe<NoteCreatedEvent>(
      'note.created',
      this.handleNoteCreated.bind(this)
    );
    
    // Subscribe to audio events for voice note storage
    this.subscribe<AudioClassifiedEvent>(
      'audio.classified',
      this.handleAudioClassified.bind(this)
    );
  }
  
  private async handleAudioClassified(event: AudioClassifiedEvent): Promise<void> {
    const { userId, transcription, classification, confidence } = event.payload;
    
    // Store as voice note for Obsidian sync
    if (classification === 'note' || classification === 'task') {
      try {
        const voiceNote: VoiceNote = {
          id: `vn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          transcription,
          timestamp: new Date().toISOString(),
          phone: userId,
          processed: false,
          syncedToObsidian: false,
          metadata: {
            classification,
            confidence
          }
        };
        
        await this.voiceSyncService.storeVoiceNote(voiceNote);
        
        this.logger.info('Voice note stored for Obsidian sync', {
          noteId: voiceNote.id,
          classification,
          userId
        });
      } catch (error) {
        this.logger.error('Failed to store voice note', error as Error, {
          userId,
          classification
        });
      }
    }
  }
  
  private async handleNoteCreated(event: NoteCreatedEvent): Promise<void> {
    const { userId, noteId, content, tags } = event.payload;
    
    try {
      this.logger.info('Storing new note', { userId, noteId });
      
      const note: Note = {
        id: noteId,
        userId,
        content,
        tags: tags || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        synced: false,
      };
      
      // Store note
      await this.storeNote(note);
      
      // Update user's note index
      await this.updateUserNoteIndex(userId, noteId);
      
      this.logger.info('Note stored successfully', { userId, noteId });
      
    } catch (error) {
      this.logger.error('Failed to store note', error, {
        userId,
        noteId,
        correlationId: event.metadata.correlationId,
      });
      throw error;
    }
  }
  
  async storeNote(note: Note): Promise<void> {
    await this.storageService.put(
      this.NAMESPACE,
      `note:${note.id}`,
      note,
      { ttl: 86400 * 30 } // Keep for 30 days
    );
    
    // Update stats
    await this.incrementNoteCount();
  }
  
  async getNote(noteId: string): Promise<Note | null> {
    return await this.storageService.get<Note>(
      this.NAMESPACE,
      `note:${noteId}`
    );
  }
  
  async getUserNotes(userId: string, limit = 100): Promise<Note[]> {
    // Get user's note index
    const index = await this.storageService.get<string[]>(
      this.NAMESPACE,
      `user:${userId}:notes`
    ) || [];
    
    // Get notes (up to limit)
    const noteIds = index.slice(0, limit);
    const notes = await Promise.all(
      noteIds.map(id => this.getNote(id))
    );
    
    return notes.filter((note): note is Note => note !== null);
  }
  
  async syncNotes(userId: string, destination: string): Promise<number> {
    try {
      this.logger.info('Starting note sync', { userId, destination });
      
      const notes = await this.getUserNotes(userId);
      const unsyncedNotes = notes.filter(note => !note.synced);
      
      if (unsyncedNotes.length === 0) {
        this.logger.info('No unsynced notes found', { userId });
        return 0;
      }
      
      // Process in batches
      let syncedCount = 0;
      for (let i = 0; i < unsyncedNotes.length; i += this.SYNC_BATCH_SIZE) {
        const batch = unsyncedNotes.slice(i, i + this.SYNC_BATCH_SIZE);
        
        // In real implementation, this would call an external sync service
        await this.syncBatch(batch, destination);
        
        // Mark as synced
        for (const note of batch) {
          note.synced = true;
          note.syncedAt = new Date();
          await this.storeNote(note);
        }
        
        syncedCount += batch.length;
      }
      
      // Publish sync event
      await this.publish(new NoteSyncedEvent({
        userId,
        noteIds: unsyncedNotes.map(n => n.id),
        destination,
      }));
      
      this.logger.info('Note sync completed', {
        userId,
        destination,
        syncedCount,
      });
      
      return syncedCount;
      
    } catch (error) {
      this.logger.error('Note sync failed', error, { userId, destination });
      throw error;
    }
  }
  
  async searchNotes(userId: string, query: string): Promise<Note[]> {
    const notes = await this.getUserNotes(userId);
    
    const lowerQuery = query.toLowerCase();
    return notes.filter(note => {
      // Search in content
      if (note.content.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      // Search in tags
      if (note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        return true;
      }
      
      return false;
    });
  }
  
  async deleteNote(noteId: string): Promise<void> {
    const note = await this.getNote(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }
    
    // Remove from user index
    await this.removeFromUserNoteIndex(note.userId, noteId);
    
    // Delete note
    await this.storageService.delete(
      this.NAMESPACE,
      `note:${noteId}`
    );
    
    this.logger.info('Note deleted', { noteId, userId: note.userId });
  }
  
  async clearUserNotes(userId: string): Promise<number> {
    const notes = await this.getUserNotes(userId);
    
    for (const note of notes) {
      await this.deleteNote(note.id);
    }
    
    // Clear user index
    await this.storageService.delete(
      this.NAMESPACE,
      `user:${userId}:notes`
    );
    
    this.logger.info('User notes cleared', { userId, count: notes.length });
    
    return notes.length;
  }
  
  private async updateUserNoteIndex(userId: string, noteId: string): Promise<void> {
    const key = `user:${userId}:notes`;
    const index = await this.storageService.get<string[]>(
      this.NAMESPACE,
      key
    ) || [];
    
    // Add to beginning (most recent first)
    if (!index.includes(noteId)) {
      index.unshift(noteId);
      
      // Keep only last 1000 notes in index
      if (index.length > 1000) {
        index.splice(1000);
      }
      
      await this.storageService.put(
        this.NAMESPACE,
        key,
        index
      );
    }
  }
  
  private async removeFromUserNoteIndex(userId: string, noteId: string): Promise<void> {
    const key = `user:${userId}:notes`;
    const index = await this.storageService.get<string[]>(
      this.NAMESPACE,
      key
    ) || [];
    
    const filtered = index.filter(id => id !== noteId);
    
    if (filtered.length !== index.length) {
      await this.storageService.put(
        this.NAMESPACE,
        key,
        filtered
      );
    }
  }
  
  private async syncBatch(notes: Note[], destination: string): Promise<void> {
    // Simulate sync operation
    // In real implementation, this would call GitHub API or other sync service
    this.logger.debug(`Syncing ${notes.length} notes to ${destination}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  private async incrementNoteCount(): Promise<void> {
    const count = await this.storageService.get<number>(
      this.NAMESPACE,
      'stats:total_notes'
    ) || 0;
    
    await this.storageService.put(
      this.NAMESPACE,
      'stats:total_notes',
      count + 1
    );
  }
  
  private async getNoteStats(): Promise<NoteStorage> {
    const totalNotes = await this.storageService.get<number>(
      this.NAMESPACE,
      'stats:total_notes'
    ) || 0;
    
    const stats = await this.storageService.getStats(this.NAMESPACE);
    
    return {
      totalNotes,
      totalUsers: 0, // Would need to track this separately
      lastSync: null,
      storageUsed: stats.keyCount,
    };
  }
  
  protected async onStart(): Promise<void> {
    this.logger.info('Notes Module started');
  }
  
  protected async onStop(): Promise<void> {
    this.logger.info('Notes Module stopped');
  }
  
  protected async onDispose(): Promise<void> {
    this.logger.info('Notes Module disposed');
  }
  
  // Public API methods for voice sync
  public getVoiceSyncService(): IVoiceNoteSyncService {
    return this.voiceSyncService;
  }
  
  public async getUnprocessedVoiceNotes(): Promise<VoiceNote[]> {
    return this.voiceSyncService.getUnprocessedNotes();
  }
  
  public async markVoiceNoteAsSynced(noteId: string): Promise<void> {
    return this.voiceSyncService.markNoteAsSynced(noteId);
  }
  
  public async getRecentVoiceNotes(hours?: number): Promise<VoiceNote[]> {
    return this.voiceSyncService.getRecentNotes(hours);
  }
  
  public async getAllVoiceNotes(filter?: any): Promise<VoiceNote[]> {
    return this.voiceSyncService.getAllNotes(filter);
  }
  
  protected async onHealthCheck(): Promise<Partial<ModuleHealth>> {
    const stats = await this.getNoteStats();
    
    return {
      healthy: true,
      metrics: {
        totalNotes: stats.totalNotes,
        storageKeys: stats.storageUsed,
      },
    };
  }
}