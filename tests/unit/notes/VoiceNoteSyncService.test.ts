import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VoiceNoteSyncService } from '../../../src/domains/notes/services/VoiceNoteSyncService';
import { MockKVNamespace } from '../../mocks/kv-namespace';
import { ILogger } from '../../../src/core/logging/Logger';
import { IStorageService } from '../../../src/core/services/storage/IStorageService';
import { VoiceNote, NoteFilter } from '../../../src/domains/notes/types';

// Create mock logger
const createMockLogger = (): ILogger => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
});

// Create mock storage service that wraps KV
const createMockStorageService = (kv: MockKVNamespace): IStorageService => ({
  get: async (key: string) => {
    return await kv.get(key);
  },
  set: async (key: string, value: string, options?: any) => {
    await kv.put(key, value, options);
  },
  delete: async (key: string) => {
    await kv.delete(key);
  },
  list: async (options?: { prefix?: string }) => {
    const result = await kv.list(options);
    return result.keys.map(k => k.name);
  },
});

describe('VoiceNoteSyncService', () => {
  let service: VoiceNoteSyncService;
  let mockKV: MockKVNamespace;
  let mockLogger: ILogger;
  let mockStorageService: IStorageService;

  const createTestNote = (
    id: string,
    processed: boolean = false,
    synced: boolean = false,
    timestamp: Date = new Date()
  ): VoiceNote => ({
    id,
    transcription: `Test transcription for ${id}`,
    timestamp,
    phone: '5511999999999',
    processed,
    syncedToObsidian: synced,
    metadata: {
      classification: 'note',
      confidence: 0.95,
      audioUrl: `https://example.com/audio/${id}.opus`,
      duration: 10,
    },
  });

  beforeEach(() => {
    mockKV = new MockKVNamespace();
    mockLogger = createMockLogger();
    mockStorageService = createMockStorageService(mockKV);
    service = new VoiceNoteSyncService(mockStorageService, mockLogger);
  });

  describe('storeVoiceNote', () => {
    it('should save a voice note to KV storage', async () => {
      const note = createTestNote('test-id-1');
      
      await service.storeVoiceNote(note);
      
      const saved = await mockKV.get('voice_note:test-id-1', { type: 'json' });
      expect(saved).toEqual(note);
      expect(mockLogger.info).toHaveBeenCalledWith('Voice note stored', {
        noteId: 'test-id-1',
        phone: '5511999999999',
        classification: 'note',
      });
    });

    it('should handle save errors gracefully', async () => {
      const note = createTestNote('test-id-1');
      vi.spyOn(mockStorageService, 'set').mockRejectedValueOnce(new Error('KV error'));
      
      await expect(service.storeVoiceNote(note)).rejects.toThrow('KV error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to store voice note',
        expect.any(Error),
        { noteId: 'test-id-1' }
      );
    });
  });

  describe('getUnprocessedNotes', () => {
    it('should return only unprocessed and unsynced notes', async () => {
      const notes = [
        createTestNote('note-1', false, false),
        createTestNote('note-2', true, false),
        createTestNote('note-3', true, true),
        createTestNote('note-4', false, false),
      ];
      
      for (const note of notes) {
        await mockKV.put(`voice_note:${note.id}`, JSON.stringify(note));
      }
      
      const unprocessed = await service.getUnprocessedNotes();
      
      expect(unprocessed).toHaveLength(2);
      expect(unprocessed.map(n => n.id).sort()).toEqual(['note-1', 'note-4'].sort());
    });

    it('should return empty array when all notes are processed', async () => {
      const notes = [
        createTestNote('note-1', true, true),
        createTestNote('note-2', true, false),
      ];
      
      for (const note of notes) {
        await mockKV.put(`voice_note:${note.id}`, JSON.stringify(note));
      }
      
      const unprocessed = await service.getUnprocessedNotes();
      expect(unprocessed).toHaveLength(0);
    });

    it('should handle KV list errors', async () => {
      vi.spyOn(mockKV, 'list').mockRejectedValueOnce(new Error('KV error'));
      
      await expect(service.getUnprocessedNotes()).rejects.toThrow('KV error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get unprocessed notes',
        expect.any(Error)
      );
    });
  });

  describe('getAllNotes', () => {
    beforeEach(async () => {
      const notes = [
        createTestNote('note-1', false, false, new Date('2025-01-15T10:00:00Z')),
        createTestNote('note-2', true, false, new Date('2025-01-15T11:00:00Z')),
        createTestNote('note-3', true, true, new Date('2025-01-15T12:00:00Z')),
      ];
      
      for (const note of notes) {
        await mockKV.put(`voice_note:${note.id}`, JSON.stringify(note));
      }
    });

    it('should return all notes when no filter provided', async () => {
      const notes = await service.getAllNotes();
      
      expect(notes).toHaveLength(3);
      // Should be sorted by timestamp descending (newest first)
      expect(notes).toHaveLength(3);
      expect(notes.map(n => n.id)).toContain('note-1');
      expect(notes.map(n => n.id)).toContain('note-2');
      expect(notes.map(n => n.id)).toContain('note-3');
    });

    it('should apply limit filter', async () => {
      const filter: NoteFilter = { limit: 2 };
      const notes = await service.getAllNotes(filter);
      
      expect(notes).toHaveLength(2);
      expect(notes).toHaveLength(2);
    });

    it('should apply offset filter', async () => {
      const filter: NoteFilter = { offset: 1 };
      const notes = await service.getAllNotes(filter);
      
      expect(notes).toHaveLength(2);
      expect(notes).toHaveLength(2);
    });

    it('should apply limit and offset together', async () => {
      const filter: NoteFilter = { limit: 1, offset: 1 };
      const notes = await service.getAllNotes(filter);
      
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toBe('note-2');
    });

    it('should sort notes by timestamp descending', async () => {
      const notes = await service.getAllNotes();
      
      // Should be sorted by timestamp, most recent first
      const timestamps = notes.map(n => new Date(n.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
      }
    });

    it('should handle invalid note data gracefully', async () => {
      await mockKV.put('voice_note:invalid', 'not-json');
      
      // getAllNotes should throw on invalid JSON
      await expect(service.getAllNotes()).rejects.toThrow();
    });
  });

  describe('getRecentNotes', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T14:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return notes from last 24 hours by default', async () => {
      const notes = [
        createTestNote('note-1', false, false, new Date('2025-01-14T10:00:00Z')), // 28 hours ago
        createTestNote('note-2', true, false, new Date('2025-01-14T15:00:00Z')), // 23 hours ago
        createTestNote('note-3', true, true, new Date('2025-01-15T12:00:00Z')), // 2 hours ago
      ];
      
      for (const note of notes) {
        await mockKV.put(`voice_note:${note.id}`, JSON.stringify(note));
      }
      
      const recent = await service.getRecentNotes();
      
      expect(recent).toHaveLength(2);
      const recentIds = recent.map(n => n.id);
      expect(recentIds).toContain('note-2');
      expect(recentIds).toContain('note-3');
      expect(recentIds).not.toContain('note-1');
    });

    it('should respect custom hours parameter', async () => {
      const notes = [
        createTestNote('note-1', false, false, new Date('2025-01-15T10:00:00Z')), // 4 hours ago
        createTestNote('note-2', true, false, new Date('2025-01-15T11:00:00Z')), // 3 hours ago
        createTestNote('note-3', true, true, new Date('2025-01-15T12:30:00Z')), // 1.5 hours ago
      ];
      
      for (const note of notes) {
        await mockKV.put(`voice_note:${note.id}`, JSON.stringify(note));
      }
      
      const recent = await service.getRecentNotes(2); // Last 2 hours
      
      expect(recent).toHaveLength(1);
      expect(recent[0].id).toBe('note-3');
    });

    it('should return empty array when no recent notes exist', async () => {
      const notes = [
        createTestNote('note-1', false, false, new Date('2025-01-10T10:00:00Z')), // 5 days ago
      ];
      
      for (const note of notes) {
        await mockKV.put(`voice_note:${note.id}`, JSON.stringify(note));
      }
      
      const recent = await service.getRecentNotes(1);
      expect(recent).toHaveLength(0);
    });
  });

  describe('markNoteAsProcessed', () => {
    it('should mark note as processed', async () => {
      const note = createTestNote('test-id', false, false);
      await mockKV.put('voice_note:test-id', JSON.stringify(note));
      
      await service.markNoteAsProcessed('test-id');
      
      const updated = await mockKV.get('voice_note:test-id', { type: 'json' }) as VoiceNote;
      expect(updated.processed).toBe(true);
      expect(updated.syncedToObsidian).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Note marked as processed', {
        noteId: 'test-id',
      });
    });

    it('should throw error for non-existent note', async () => {
      await expect(service.markNoteAsProcessed('non-existent')).rejects.toThrow(
        'Note not found: non-existent'
      );
    });

    it('should handle update errors', async () => {
      const note = createTestNote('test-id', false, false);
      await mockKV.put('voice_note:test-id', JSON.stringify(note));
      
      vi.spyOn(mockKV, 'put').mockRejectedValueOnce(new Error('KV error'));
      
      await expect(service.markNoteAsProcessed('test-id')).rejects.toThrow('KV error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to mark note as processed',
        expect.any(Error),
        { noteId: 'test-id' }
      );
    });
  });

  describe('markNoteAsSynced', () => {
    it('should mark note as synced and processed', async () => {
      const note = createTestNote('test-id', false, false);
      await mockKV.put('voice_note:test-id', JSON.stringify(note));
      
      await service.markNoteAsSynced('test-id');
      
      const updated = await mockKV.get('voice_note:test-id', { type: 'json' }) as VoiceNote;
      expect(updated.processed).toBe(true);
      expect(updated.syncedToObsidian).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Note marked as synced to Obsidian', {
        noteId: 'test-id',
      });
    });

    it('should update already processed note', async () => {
      const note = createTestNote('test-id', true, false);
      await mockKV.put('voice_note:test-id', JSON.stringify(note));
      
      await service.markNoteAsSynced('test-id');
      
      const updated = await mockKV.get('voice_note:test-id', { type: 'json' }) as VoiceNote;
      expect(updated.processed).toBe(true);
      expect(updated.syncedToObsidian).toBe(true);
    });

    it('should throw error for non-existent note', async () => {
      await expect(service.markNoteAsSynced('non-existent')).rejects.toThrow(
        'Note not found: non-existent'
      );
    });
  });

  describe('getNoteById', () => {
    it('should get a note by ID', async () => {
      const note = createTestNote('test-id');
      await mockKV.put('voice_note:test-id', JSON.stringify(note));
      
      const retrieved = await service.getNoteById('test-id');
      
      expect(retrieved).toEqual(note);
    });

    it('should return null for non-existent note', async () => {
      const retrieved = await service.getNoteById('non-existent');
      
      expect(retrieved).toBeNull();
    });

    it('should handle retrieval errors', async () => {
      vi.spyOn(mockStorageService, 'get').mockRejectedValueOnce(new Error('KV error'));
      
      await expect(service.getNoteById('test-id')).rejects.toThrow('KV error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get note by ID',
        expect.any(Error),
        { noteId: 'test-id' }
      );
    });
  });
});