/**
 * Types for Notes module
 */

export interface Note {
  id: string;
  userId: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;
  syncedAt?: Date;
  metadata?: {
    source?: 'whatsapp' | 'api' | 'manual';
    audioUrl?: string;
    duration?: number;
    classification?: string;
    phone?: string;
    confidence?: number;
  };
}

export interface VoiceNote {
  id: string;
  transcription: string;
  timestamp: string;
  phone: string;
  processed: boolean;
  syncedToObsidian?: boolean;
  metadata?: {
    audioUrl?: string;
    duration?: number;
    classification?: string;
    confidence?: number;
  };
}

export interface NoteStorage {
  totalNotes: number;
  totalUsers: number;
  lastSync: Date | null;
  storageUsed: number;
}

export interface NoteSyncOptions {
  destination: 'obsidian' | 'api';
  format?: 'markdown' | 'json' | 'plain';
  includeMetadata?: boolean;
}

export interface NoteSearchOptions {
  query: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

export interface NoteFilter {
  userId?: string;
  tags?: string[];
  synced?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}