// Enhanced KV Note Storage for Voice Sync

export class EnhancedKVNoteStorage {
  private kv: any;

  constructor(kv: any) {
    this.kv = kv;
  }

  async saveNote(transcription: string, userPhone: string, metadata?: any): Promise<string> {
    const noteId = this.generateNoteId();
    const timestamp = new Date().toISOString();
    
    const noteData = {
      id: noteId,
      transcription,
      phone: userPhone,
      timestamp,
      processed: false,
      metadata: metadata || {}
    };
    
    const key = `voice_note:${noteId}`;
    await this.kv.put(key, JSON.stringify(noteData));
    
    console.log('Voice note saved for sync:', {
      noteId,
      userPhone,
      contentLength: transcription.length
    });
    
    return noteId;
  }

  async getNoteById(noteId: string): Promise<any | null> {
    const key = `voice_note:${noteId}`;
    return await this.kv.get(key, 'json');
  }

  async markNoteAsProcessed(noteId: string): Promise<void> {
    const key = `voice_note:${noteId}`;
    const noteData = await this.kv.get(key, 'json');
    
    if (noteData) {
      noteData.processed = true;
      noteData.processedAt = new Date().toISOString();
      await this.kv.put(key, JSON.stringify(noteData));
    }
  }

  private generateNoteId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}
