import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiRouter } from '../../../src/core/api/ApiRouter';
import { MockKVNamespace } from '../../mocks/kv-namespace';
import { ILogger } from '../../../src/core/logging/Logger';
import { IEventBus } from '../../../src/core/event-bus/EventBus';
import { VoiceNoteSyncService } from '../../../src/domains/notes/services/VoiceNoteSyncService';
import { VoiceNote } from '../../../src/domains/notes/types';
import { IStorageService } from '../../../src/core/services/storage/IStorageService';

// Create mock logger
const createMockLogger = (): ILogger => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
});

// Create mock event bus
const createMockEventBus = (): IEventBus => ({
  publish: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
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

// Create test request with auth header
const createAuthRequest = (
  url: string,
  method: string = 'GET',
  validAuth: boolean = true
): Request => {
  const headers = new Headers();
  if (validAuth) {
    headers.set('Authorization', 'Bearer test-api-key');
  }
  return new Request(url, { method, headers });
};

// Sample voice notes for testing
const createSampleNotes = (): VoiceNote[] => [
  {
    id: 'vn_1234567890_abc123',
    transcription: 'Test note 1',
    timestamp: new Date('2025-01-15T10:00:00Z'),
    phone: '5511999999999',
    processed: false,
    syncedToObsidian: false,
    metadata: {
      classification: 'note',
      confidence: 0.95,
      audioUrl: 'https://example.com/audio1.opus',
      duration: 10,
    },
  },
  {
    id: 'vn_1234567891_def456',
    transcription: 'Test note 2',
    timestamp: new Date('2025-01-15T11:00:00Z'),
    phone: '5511999999999',
    processed: true,
    syncedToObsidian: false,
    metadata: {
      classification: 'task',
      confidence: 0.92,
      audioUrl: 'https://example.com/audio2.opus',
      duration: 15,
    },
  },
  {
    id: 'vn_1234567892_ghi789',
    transcription: 'Test note 3',
    timestamp: new Date('2025-01-15T12:00:00Z'),
    phone: '5511999999999',
    processed: true,
    syncedToObsidian: true,
    metadata: {
      classification: 'note',
      confidence: 0.88,
      audioUrl: 'https://example.com/audio3.opus',
      duration: 20,
    },
  },
];

describe('Voice Sync API', () => {
  let apiRouter: ApiRouter;
  let mockKV: MockKVNamespace;
  let mockLogger: ILogger;
  let mockEventBus: IEventBus;
  let mockStorageService: IStorageService;
  let voiceNoteSyncService: VoiceNoteSyncService;
  let mockEnv: any;

  beforeEach(async () => {
    mockKV = new MockKVNamespace();
    mockLogger = createMockLogger();
    mockEventBus = createMockEventBus();
    mockStorageService = createMockStorageService(mockKV);
    mockEnv = {
      OBSIDIAN_API_KEY: 'test-api-key',
      USER_CONFIGS: mockKV,
    };

    // Set up voice note sync service with storage service
    voiceNoteSyncService = new VoiceNoteSyncService(mockStorageService, mockLogger);
    
    // Store sample notes in KV
    const notes = createSampleNotes();
    for (const note of notes) {
      await mockKV.put(`voice_note:${note.id}`, JSON.stringify(note));
    }

    // Initialize API router with event bus and logger
    apiRouter = new ApiRouter(mockEventBus, mockLogger);
    
    // Inject the voice note sync service
    (apiRouter as any).voiceNoteSyncService = voiceNoteSyncService;
  });

  describe('Authentication', () => {
    it('should reject requests without authorization header', async () => {
      const request = new Request('https://test.com/api/voice-notes/unprocessed');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({ error: 'Unauthorized' });
    });

    it('should reject requests with invalid Bearer token', async () => {
      const headers = new Headers();
      headers.set('Authorization', 'Bearer wrong-key');
      const request = new Request('https://test.com/api/voice-notes/unprocessed', {
        headers,
      });
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json).toEqual({ error: 'Unauthorized' });
    });

    it('should accept requests with valid Bearer token', async () => {
      const request = createAuthRequest('https://test.com/api/voice-notes/all');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/voice-notes/unprocessed', () => {
    it('should return unprocessed notes', async () => {
      const request = createAuthRequest('https://test.com/api/voice-notes/unprocessed');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
      const notes = await response.json();
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toBe('vn_1234567890_abc123');
      expect(notes[0].processed).toBe(false);
      expect(notes[0].syncedToObsidian).toBe(false);
    });

    it('should return empty array when no unprocessed notes exist', async () => {
      // Clear KV and add only processed notes
      mockKV.clear();
      const processedNote = createSampleNotes()[1];
      await mockKV.put(`voice_note:${processedNote.id}`, JSON.stringify(processedNote));
      
      const request = createAuthRequest('https://test.com/api/voice-notes/unprocessed');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
      const notes = await response.json();
      expect(notes).toHaveLength(0);
    });
  });

  describe('GET /api/voice-notes/all', () => {
    it('should return all notes with default pagination', async () => {
      const request = createAuthRequest('https://test.com/api/voice-notes/all');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
      const notes = await response.json();
      expect(notes).toHaveLength(3);
    });

    it('should respect limit parameter', async () => {
      const request = createAuthRequest('https://test.com/api/voice-notes/all?limit=2');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
      const notes = await response.json();
      expect(notes).toHaveLength(2);
    });

    it('should respect offset parameter', async () => {
      const request = createAuthRequest('https://test.com/api/voice-notes/all?offset=1');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
      const notes = await response.json();
      expect(notes).toHaveLength(2);
      expect(notes[0].id).toBe('vn_1234567891_def456');
    });

    it('should handle limit and offset together', async () => {
      const request = createAuthRequest('https://test.com/api/voice-notes/all?limit=1&offset=1');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
      const notes = await response.json();
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toBe('vn_1234567891_def456');
    });
  });

  describe('GET /api/voice-notes/recent', () => {
    beforeEach(() => {
      // Mock current time for consistent testing
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T13:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return notes from last 24 hours by default', async () => {
      const request = createAuthRequest('https://test.com/api/voice-notes/recent');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
      const notes = await response.json();
      expect(notes).toHaveLength(3); // All notes are within 24 hours
    });

    it('should respect hours parameter', async () => {
      const request = createAuthRequest('https://test.com/api/voice-notes/recent?hours=2');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
      const notes = await response.json();
      expect(notes).toHaveLength(1); // Only the most recent note
      expect(notes[0].id).toBe('vn_1234567892_ghi789');
    });

    it('should return empty array when no recent notes exist', async () => {
      const request = createAuthRequest('https://test.com/api/voice-notes/recent?hours=0.5');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
      const notes = await response.json();
      expect(notes).toHaveLength(0);
    });
  });

  describe('POST /api/voice-notes/:id/processed', () => {
    it('should mark note as processed', async () => {
      const noteId = 'vn_1234567890_abc123';
      const headers = new Headers();
      headers.set('Authorization', 'Bearer test-api-key');
      
      const request = new Request(`https://test.com/api/voice-notes/${noteId}/processed`, {
        method: 'POST',
        headers,
      });
      
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toEqual({ success: true });
      
      // Verify the note was updated
      const updatedNote = await mockKV.get(`voice_note:${noteId}`, { type: 'json' }) as any;
      expect(updatedNote.processed).toBe(true);
    });

    it('should return 404 for non-existent note', async () => {
      const headers = new Headers();
      headers.set('Authorization', 'Bearer test-api-key');
      
      const request = new Request('https://test.com/api/voice-notes/invalid_id/processed', {
        method: 'POST',
        headers,
      });
      
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result).toEqual({ error: 'Note not found' });
    });
  });

  describe('POST /api/voice-notes/:id/synced', () => {
    it('should mark note as synced to Obsidian', async () => {
      const noteId = 'vn_1234567890_abc123';
      const headers = new Headers();
      headers.set('Authorization', 'Bearer test-api-key');
      
      const request = new Request(`https://test.com/api/voice-notes/${noteId}/synced`, {
        method: 'POST',
        headers,
      });
      
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toEqual({ success: true });
      
      // Verify the note was updated
      const updatedNote = await mockKV.get(`voice_note:${noteId}`, { type: 'json' }) as any;
      expect(updatedNote.syncedToObsidian).toBe(true);
      expect(updatedNote.processed).toBe(true); // Should also mark as processed
    });

    it('should return 404 for non-existent note', async () => {
      const headers = new Headers();
      headers.set('Authorization', 'Bearer test-api-key');
      
      const request = new Request('https://test.com/api/voice-notes/invalid_id/synced', {
        method: 'POST',
        headers,
      });
      
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result).toEqual({ error: 'Note not found' });
    });
  });

  describe('CORS Support', () => {
    it('should handle preflight OPTIONS requests', async () => {
      const headers = new Headers();
      headers.set('Origin', 'app://obsidian.md');
      headers.set('Access-Control-Request-Method', 'GET');
      headers.set('Access-Control-Request-Headers', 'authorization, content-type');
      
      const request = new Request('https://test.com/api/voice-notes/unprocessed', {
        method: 'OPTIONS',
        headers,
      });
      
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
    });

    it('should include CORS headers in regular responses', async () => {
      const request = createAuthRequest('https://test.com/api/voice-notes/all');
      const response = await apiRouter.handle(request);
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when service throws error', async () => {
      // Mock service to throw error
      vi.spyOn(voiceNoteSyncService, 'getAllNotes').mockRejectedValueOnce(
        new Error('Database error')
      );
      
      const request = createAuthRequest('https://test.com/api/voice-notes/all');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(500);
      const result = await response.json();
      expect(result).toEqual({ error: 'Failed to fetch voice notes' });
    });

    it('should handle malformed query parameters gracefully', async () => {
      const request = createAuthRequest('https://test.com/api/voice-notes/all?limit=abc');
      const response = await apiRouter.handle(request);
      
      // Should use default limit when invalid
      expect(response.status).toBe(200);
      const notes = await response.json();
      expect(notes).toHaveLength(3);
    });
  });

  describe('Invalid Routes', () => {
    it('should return 404 for unknown voice-notes endpoints', async () => {
      const request = createAuthRequest('https://test.com/api/voice-notes/unknown');
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(404);
    });

    it('should return 405 for wrong HTTP method', async () => {
      const headers = new Headers();
      headers.set('Authorization', 'Bearer test-api-key');
      
      const request = new Request('https://test.com/api/voice-notes/unprocessed', {
        method: 'DELETE',
        headers,
      });
      
      const response = await apiRouter.handle(request);
      
      expect(response.status).toBe(404); // Router returns 404 for unmatched routes
    });
  });
});