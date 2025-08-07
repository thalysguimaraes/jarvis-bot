/**
 * Types for Audio Processing module
 */

export interface AudioProcessingConfig {
  maxAudioSizeMB: number;
  supportedFormats: string[];
  transcriptionLanguage: string;
  classificationEnabled: boolean;
  classificationCategories: string[];
  storageNamespace: string;
}

export interface AudioMetadata {
  userId: string;
  mimeType: string;
  duration?: number;
  size: number;
  timestamp: Date;
}

export interface TranscriptionData {
  text: string;
  language?: string;
  confidence?: number;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export interface ClassificationData {
  category: string;
  confidence: number;
  reasoning?: string;
  alternativeCategories?: Array<{
    category: string;
    confidence: number;
  }>;
}

export interface ProcessedAudio {
  id: string;
  metadata: AudioMetadata;
  transcription: TranscriptionData;
  classification?: ClassificationData;
  processedAt: Date;
  processingTimeMs: number;
}