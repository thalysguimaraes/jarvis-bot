import { ObsidianNote } from './types';

export class NoteFormatter {
  static formatNote(note: ObsidianNote): string {
    const { content, metadata } = note;
    const timestamp = this.formatTimestamp(metadata.timestamp);
    
    return `## ${timestamp}
📱 Via WhatsApp Audio

${content}

---
`;
  }

  static formatDailyNote(notes: ObsidianNote[]): string {
    const date = new Date();
    const dateStr = this.formatDate(date);
    
    const header = `# Daily Notes - ${dateStr}\n\n`;
    
    const sortedNotes = notes.sort((a, b) => 
      b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime()
    );
    
    const notesContent = sortedNotes
      .map(note => this.formatNote(note))
      .join('\n');
    
    return header + notesContent;
  }

  static getDailyNoteFilename(date: Date = new Date()): string {
    return `${this.formatDate(date)}.md`;
  }

  static getIndividualNoteFilename(timestamp: Date): string {
    const dateStr = this.formatDate(timestamp);
    const timeStr = this.formatTime(timestamp).replace(/:/g, '-');
    return `audio-note-${dateStr}-${timeStr}.md`;
  }

  private static formatTimestamp(date: Date): string {
    return `${this.formatDate(date)} ${this.formatTime(date)}`;
  }

  private static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private static formatTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  static prependToContent(existingContent: string, newNote: ObsidianNote): string {
    const newNoteFormatted = this.formatNote(newNote);
    
    if (!existingContent || existingContent.trim() === '') {
      const date = new Date();
      const dateStr = this.formatDate(date);
      return `# Daily Notes - ${dateStr}\n\n${newNoteFormatted}`;
    }
    
    const headerMatch = existingContent.match(/^# Daily Notes[^\n]*/);
    if (headerMatch) {
      const headerEnd = headerMatch.index! + headerMatch[0].length;
      return existingContent.slice(0, headerEnd) + '\n\n' + newNoteFormatted + existingContent.slice(headerEnd);
    }
    
    return newNoteFormatted + '\n' + existingContent;
  }
}