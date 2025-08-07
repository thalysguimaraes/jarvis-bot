import { IAIService, TranscriptionResult } from '@/core/services/interfaces/IAIService';
import { IStorageService } from '@/core/services/interfaces/IStorageService';
import { ILogger } from '@/core/logging/Logger';
import { AudioProcessingConfig } from '../types';

/**
 * Handles audio transcription and processing
 */
export class AudioHandler {
  constructor(
    private aiService: IAIService,
    private storageService: IStorageService,
    private logger: ILogger,
    private config: AudioProcessingConfig
  ) {}
  
  async transcribeAudio(
    audioData: ArrayBuffer | string,
    options?: {
      language?: string;
      prompt?: string;
    }
  ): Promise<TranscriptionResult & { confidence?: number }> {
    this.logger.info('Starting audio transcription');
    
    try {
      // Convert string to ArrayBuffer if needed
      let audioBuffer: ArrayBuffer;
      if (typeof audioData === 'string') {
        // Assume base64 encoded
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioBuffer = bytes.buffer;
      } else {
        audioBuffer = audioData;
      }
      
      // Log audio info
      this.logger.debug('Transcribing audio', {
        size: audioBuffer.byteLength,
        language: options?.language || this.config.transcriptionLanguage,
      });
      
      // Transcribe with AI service
      const result = await this.aiService.transcribeAudio(audioBuffer, {
        language: options?.language || this.config.transcriptionLanguage,
        prompt: options?.prompt,
        format: 'json',
      });
      
      // Store transcription for analytics
      await this.storeTranscription(result);
      
      // Calculate confidence based on text length and language detection
      const confidence = this.calculateConfidence(result);
      
      return {
        ...result,
        confidence,
      };
      
    } catch (error) {
      this.logger.error('Audio transcription failed', error);
      throw new Error(`Failed to transcribe audio: ${error}`);
    }
  }
  
  async downloadAudio(audioUrl: string): Promise<ArrayBuffer> {
    try {
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.status}`);
      }
      
      return await response.arrayBuffer();
    } catch (error) {
      this.logger.error('Audio download failed', error, { audioUrl });
      throw error;
    }
  }
  
  private async storeTranscription(result: TranscriptionResult): Promise<void> {
    try {
      // Update processed count
      const count = await this.storageService.get<number>(
        this.config.storageNamespace,
        'processed_count'
      ) || 0;
      
      await this.storageService.put(
        this.config.storageNamespace,
        'processed_count',
        count + 1
      );
      
      // Update last processed time
      await this.storageService.put(
        this.config.storageNamespace,
        'last_processed',
        new Date().toISOString()
      );
      
      // Store transcription history (keep last 100)
      const historyKey = `transcription_${Date.now()}`;
      await this.storageService.put(
        this.config.storageNamespace,
        historyKey,
        {
          text: result.text,
          language: result.language,
          duration: result.duration,
          timestamp: new Date(),
        },
        { ttl: 86400 * 7 } // Keep for 7 days
      );
      
    } catch (error) {
      this.logger.warn('Failed to store transcription', error);
      // Don't throw - this is not critical
    }
  }
  
  private calculateConfidence(result: TranscriptionResult): number {
    // Simple confidence calculation based on text characteristics
    let confidence = 0.5;
    
    // Increase confidence for longer texts
    if (result.text.length > 20) confidence += 0.2;
    if (result.text.length > 50) confidence += 0.1;
    
    // Increase confidence if language matches expected
    if (result.language === this.config.transcriptionLanguage) {
      confidence += 0.1;
    }
    
    // Check for segments if available
    if (result.segments && result.segments.length > 0) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }
}