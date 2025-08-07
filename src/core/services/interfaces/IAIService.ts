import { IExternalAPIService } from './IExternalAPIService';

/**
 * AI service interface for all AI operations
 */

export interface TranscriptionOptions {
  language?: string;
  prompt?: string;
  temperature?: number;
  format?: 'json' | 'text' | 'srt' | 'vtt';
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export interface ClassificationOptions {
  categories?: string[];
  threshold?: number;
  maxCategories?: number;
}

export interface ClassificationResult {
  category: string;
  confidence: number;
  alternativeCategories?: Array<{
    category: string;
    confidence: number;
  }>;
  reasoning?: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemPrompt?: string;
}

export interface CompletionResult {
  text: string;
  tokensUsed: number;
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'null';
}

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface IAIService extends IExternalAPIService {
  /**
   * Transcribe audio to text
   */
  transcribeAudio(
    audioData: ArrayBuffer | Uint8Array,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult>;
  
  /**
   * Classify text into categories
   */
  classifyText(
    text: string,
    options?: ClassificationOptions
  ): Promise<ClassificationResult>;
  
  /**
   * Generate text completion
   */
  generateCompletion(
    prompt: string,
    options?: CompletionOptions
  ): Promise<CompletionResult>;
  
  /**
   * Generate embeddings for text
   */
  generateEmbedding(
    text: string,
    options?: EmbeddingOptions
  ): Promise<number[]>;
  
  /**
   * Batch process multiple texts
   */
  batchClassify(
    texts: string[],
    options?: ClassificationOptions
  ): Promise<ClassificationResult[]>;
  
  /**
   * Get token count for text
   */
  countTokens(text: string, model?: string): number;
  
  /**
   * Get current token usage statistics
   */
  getTokenUsage(): TokenUsage;
  
  /**
   * Reset token usage statistics
   */
  resetTokenUsage(): void;
  
  /**
   * Set token usage limits
   */
  setTokenLimits(limits: {
    maxTokensPerRequest?: number;
    maxTokensPerDay?: number;
    maxCostPerDay?: number;
  }): void;
  
  /**
   * Check if a request would exceed limits
   */
  wouldExceedLimits(estimatedTokens: number): boolean;
  
  /**
   * Clear response cache
   */
  clearCache(): void;
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    hits: number;
    misses: number;
    size: number;
    savedTokens: number;
  };
}