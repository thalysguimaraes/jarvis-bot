// Voice Note Sync API for Obsidian Plugin Integration

export interface StoredVoiceNote {
  id: string;
  transcription: string;
  timestamp: string;
  phone: string;
  processed: boolean;
  metadata?: {
    audioUrl?: string;
    duration?: number;
    classification?: string;
  };
}

export class VoiceNoteSyncAPI {
  private env: any;

  constructor(env: any) {
    this.env = env;
  }

  /**
   * GET /api/voice-notes/unprocessed
   * Returns all unprocessed voice notes for Obsidian sync
   */
  async getUnprocessedNotes(request: Request): Promise<Response> {
    try {
      // Verify API key
      const authHeader = request.headers.get('Authorization');
      if (!this.isValidApiKey(authHeader)) {
        return new Response('Unauthorized', { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get unprocessed notes from KV storage
      const notes = await this.fetchUnprocessedNotesFromKV();
      
      return new Response(JSON.stringify(notes), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, content-type, Authorization, Content-Type'
        }
      });
    } catch (error) {
      console.error('Error fetching unprocessed notes:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * POST /api/voice-notes/{id}/processed
   * Mark a voice note as processed
   */
  async markNoteAsProcessed(request: Request, noteId: string): Promise<Response> {
    try {
      // Verify API key
      const authHeader = request.headers.get('Authorization');
      if (!this.isValidApiKey(authHeader)) {
        return new Response('Unauthorized', { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Mark note as processed in KV storage
      await this.markNoteProcessedInKV(noteId);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, content-type, Authorization, Content-Type'
        }
      });
    } catch (error) {
      console.error('Error marking note as processed:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * OPTIONS handler for CORS
   */
  async handleOptions(): Promise<Response> {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, Authorization, Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  private isValidApiKey(authHeader: string | null): boolean {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    
    const apiKey = authHeader.substring(7);
    const validApiKey = this.env.OBSIDIAN_API_KEY || this.env.API_KEY;
    
    return apiKey === validApiKey;
  }

  private async fetchUnprocessedNotesFromKV(): Promise<StoredVoiceNote[]> {
    if (!this.env.USER_CONFIGS) {
      throw new Error('KV storage not configured');
    }

    const notes: StoredVoiceNote[] = [];
    
    // Get all voice note keys
    const list = await this.env.USER_CONFIGS.list({ prefix: 'voice_note:' });
    
    for (const key of list.keys) {
      try {
        const noteData = await this.env.USER_CONFIGS.get(key.name, 'json');
        if (noteData && !noteData.processed) {
          notes.push({
            id: key.name.replace('voice_note:', ''),
            transcription: noteData.transcription,
            timestamp: noteData.timestamp,
            phone: noteData.phone,
            processed: false,
            metadata: noteData.metadata
          });
        }
      } catch (error) {
        console.error(`Error reading note ${key.name}:`, error);
      }
    }
    
    // Sort by timestamp (newest first)
    notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return notes;
  }

  private async markNoteProcessedInKV(noteId: string): Promise<void> {
    if (!this.env.USER_CONFIGS) {
      throw new Error('KV storage not configured');
    }

    const key = `voice_note:${noteId}`;
    const noteData = await this.env.USER_CONFIGS.get(key, 'json');
    
    if (noteData) {
      noteData.processed = true;
      noteData.processedAt = new Date().toISOString();
      await this.env.USER_CONFIGS.put(key, JSON.stringify(noteData));
    }
  }
}
