import { IStorageService } from '../../../core/services/interfaces/IStorageService';
import { ILogger } from '../../../core/logging/Logger';
import { VoiceNote, NoteFilter } from '../types';

export interface IVoiceNoteSyncService {
  storeVoiceNote(note: VoiceNote): Promise<void>;
  getUnprocessedNotes(): Promise<VoiceNote[]>;
  getAllNotes(filter?: NoteFilter): Promise<VoiceNote[]>;
  getRecentNotes(hours?: number): Promise<VoiceNote[]>;
  markNoteAsProcessed(noteId: string): Promise<void>;
  markNoteAsSynced(noteId: string): Promise<void>;
  getNoteById(noteId: string): Promise<VoiceNote | null>;
}

export class VoiceNoteSyncService implements IVoiceNoteSyncService {
  private readonly NAMESPACE = 'voice_notes';
  private readonly VOICE_NOTE_PREFIX = 'voice_note:';
  private readonly DEFAULT_TTL = 86400 * 90; // 90 days

  constructor(
    private storage: IStorageService,
    private logger: ILogger
  ) {}

  async storeVoiceNote(note: VoiceNote): Promise<void> {
    try {
      const key = `${this.VOICE_NOTE_PREFIX}${note.id}`;
      await this.storage.put(this.NAMESPACE, key, JSON.stringify(note), {
        ttl: this.DEFAULT_TTL
      });
      
      this.logger.info('Voice note stored', {
        noteId: note.id,
        phone: note.phone,
        classification: note.metadata?.classification
      });
    } catch (error) {
      this.logger.error('Failed to store voice note', error as Error, { noteId: note.id });
      throw error;
    }
  }

  async getUnprocessedNotes(): Promise<VoiceNote[]> {
    try {
      const notes: VoiceNote[] = [];
      const listResult = await this.storage.list(this.NAMESPACE, { prefix: this.VOICE_NOTE_PREFIX });
      
      for (const keyInfo of listResult.keys) {
        const noteData = await this.storage.get(this.NAMESPACE, keyInfo.name);
        if (noteData) {
          const note = JSON.parse(noteData) as VoiceNote;
          if (!note.processed) {
            notes.push(note);
          }
        }
      }
      
      // Sort by timestamp (newest first)
      notes.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      this.logger.debug('Retrieved unprocessed notes', { count: notes.length });
      return notes;
    } catch (error) {
      this.logger.error('Failed to get unprocessed notes', error as Error);
      throw error;
    }
  }

  async getAllNotes(filter?: NoteFilter): Promise<VoiceNote[]> {
    try {
      const notes: VoiceNote[] = [];
      const listResult = await this.storage.list(this.NAMESPACE, { prefix: this.VOICE_NOTE_PREFIX });
      
      for (const keyInfo of listResult.keys) {
        const noteData = await this.storage.get(this.NAMESPACE, keyInfo.name);
        if (noteData) {
          const note = JSON.parse(noteData) as VoiceNote;
          
          // Apply filters if provided
          if (filter) {
            if (filter.userId && note.phone !== filter.userId) continue;
            if (filter.synced !== undefined && note.syncedToObsidian !== filter.synced) continue;
            if (filter.startDate && new Date(note.timestamp) < filter.startDate) continue;
            if (filter.endDate && new Date(note.timestamp) > filter.endDate) continue;
          }
          
          notes.push(note);
        }
      }
      
      // Sort by timestamp (newest first)
      notes.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // Apply pagination
      if (filter?.offset !== undefined && filter?.limit !== undefined) {
        return notes.slice(filter.offset, filter.offset + filter.limit);
      }
      
      this.logger.debug('Retrieved all notes', { count: notes.length, filtered: !!filter });
      return notes;
    } catch (error) {
      this.logger.error('Failed to get all notes', error as Error);
      throw error;
    }
  }

  async getRecentNotes(hours: number = 24): Promise<VoiceNote[]> {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      const notes: VoiceNote[] = [];
      const listResult = await this.storage.list(this.NAMESPACE, { prefix: this.VOICE_NOTE_PREFIX });
      
      for (const keyInfo of listResult.keys) {
        const noteData = await this.storage.get(this.NAMESPACE, keyInfo.name);
        if (noteData) {
          const note = JSON.parse(noteData) as VoiceNote;
          if (new Date(note.timestamp) >= cutoffTime) {
            notes.push(note);
          }
        }
      }
      
      // Sort by timestamp (newest first)
      notes.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      this.logger.debug('Retrieved recent notes', { 
        count: notes.length, 
        hoursBack: hours 
      });
      
      return notes;
    } catch (error) {
      this.logger.error('Failed to get recent notes', error as Error);
      throw error;
    }
  }

  async markNoteAsProcessed(noteId: string): Promise<void> {
    try {
      const key = `${this.VOICE_NOTE_PREFIX}${noteId}`;
      const noteData = await this.storage.get(this.NAMESPACE, key);
      
      if (!noteData) {
        throw new Error(`Note not found: ${noteId}`);
      }
      
      const note = JSON.parse(noteData) as VoiceNote;
      note.processed = true;
      
      await this.storage.put(this.NAMESPACE, key, JSON.stringify(note), {
        ttl: this.DEFAULT_TTL
      });
      
      this.logger.info('Note marked as processed', { noteId });
    } catch (error) {
      this.logger.error('Failed to mark note as processed', error as Error, { noteId });
      throw error;
    }
  }

  async markNoteAsSynced(noteId: string): Promise<void> {
    try {
      const key = `${this.VOICE_NOTE_PREFIX}${noteId}`;
      const noteData = await this.storage.get(this.NAMESPACE, key);
      
      if (!noteData) {
        throw new Error(`Note not found: ${noteId}`);
      }
      
      const note = JSON.parse(noteData) as VoiceNote;
      note.syncedToObsidian = true;
      
      await this.storage.put(this.NAMESPACE, key, JSON.stringify(note), {
        ttl: this.DEFAULT_TTL
      });
      
      this.logger.info('Note marked as synced to Obsidian', { noteId });
    } catch (error) {
      this.logger.error('Failed to mark note as synced', error as Error, { noteId });
      throw error;
    }
  }

  async getNoteById(noteId: string): Promise<VoiceNote | null> {
    try {
      const key = `${this.VOICE_NOTE_PREFIX}${noteId}`;
      const noteData = await this.storage.get(this.NAMESPACE, key);
      
      if (!noteData) {
        return null;
      }
      
      return JSON.parse(noteData) as VoiceNote;
    } catch (error) {
      this.logger.error('Failed to get note by ID', error as Error, { noteId });
      throw error;
    }
  }
}