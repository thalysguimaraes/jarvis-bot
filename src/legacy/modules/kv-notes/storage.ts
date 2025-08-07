import { KVNote } from './types';

export class KVNoteStorage {
  private kv: KVNamespace;
  
  constructor(kv: KVNamespace) {
    this.kv = kv;
  }
  
  async saveNote(content: string, userId: string): Promise<string> {
    const timestamp = new Date().toISOString();
    const id = `note:${timestamp}:${Math.random().toString(36).substr(2, 9)}`;
    
    const note: KVNote = {
      id,
      content,
      timestamp,
      userId,
      synced: false
    };
    
    // Store with 30 day expiration
    await this.kv.put(id, JSON.stringify(note), {
      expirationTtl: 60 * 60 * 24 * 30 // 30 days
    });
    
    // Also update the notes index
    await this.updateNotesIndex(id);
    
    return id;
  }
  
  async getNotes(onlyUnsynced = false): Promise<KVNote[]> {
    const indexKey = 'notes:index';
    const indexData = await this.kv.get(indexKey);
    
    if (!indexData) {
      return [];
    }
    
    const noteIds: string[] = JSON.parse(indexData);
    const notes: KVNote[] = [];
    
    for (const id of noteIds) {
      const noteData = await this.kv.get(id);
      if (noteData) {
        const note: KVNote = JSON.parse(noteData);
        if (!onlyUnsynced || !note.synced) {
          notes.push(note);
        }
      }
    }
    
    // Sort by timestamp, newest first
    return notes.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
  
  async markAsSynced(noteIds: string[]): Promise<void> {
    for (const id of noteIds) {
      const noteData = await this.kv.get(id);
      if (noteData) {
        const note: KVNote = JSON.parse(noteData);
        note.synced = true;
        await this.kv.put(id, JSON.stringify(note), {
          expirationTtl: 60 * 60 * 24 * 30 // 30 days
        });
      }
    }
  }
  
  async clearSyncedNotes(): Promise<number> {
    const notes = await this.getNotes();
    let cleared = 0;
    
    for (const note of notes) {
      if (note.synced) {
        await this.kv.delete(note.id);
        cleared++;
      }
    }
    
    // Update index
    const remainingNotes = notes.filter(n => !n.synced);
    const remainingIds = remainingNotes.map(n => n.id);
    await this.kv.put('notes:index', JSON.stringify(remainingIds));
    
    return cleared;
  }
  
  private async updateNotesIndex(noteId: string): Promise<void> {
    const indexKey = 'notes:index';
    const indexData = await this.kv.get(indexKey);
    
    let noteIds: string[] = [];
    if (indexData) {
      noteIds = JSON.parse(indexData);
    }
    
    if (!noteIds.includes(noteId)) {
      noteIds.push(noteId);
      // Keep only last 100 notes in index
      if (noteIds.length > 100) {
        noteIds = noteIds.slice(-100);
      }
      await this.kv.put(indexKey, JSON.stringify(noteIds));
    }
  }
}