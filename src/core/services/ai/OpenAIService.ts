import {
  IAIService,
  TranscriptionOptions,
  TranscriptionResult,
  ClassificationOptions,
  ClassificationResult,
  CompletionOptions,
  CompletionResult,
  EmbeddingOptions,
  TokenUsage,
} from '../interfaces/IAIService';
import {
  RateLimitInfo,
  RetryConfig,
} from '../interfaces/IExternalAPIService';
import { ResponseCache } from './ResponseCache';

export interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  defaultModel?: string;
  maxTokensPerRequest?: number;
  maxTokensPerDay?: number;
  maxCostPerDay?: number;
  cacheEnabled?: boolean;
  cacheTTLMs?: number;
  retryConfig?: Partial<RetryConfig>;
}

interface TokenCounter {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  resetAt: Date;
}

export class OpenAIService implements IAIService {
  private config: Required<Omit<OpenAIConfig, 'organization'>>;
  private retryConfig: RetryConfig;
  private transcriptionCache: ResponseCache<TranscriptionResult>;
  private classificationCache: ResponseCache<ClassificationResult>;
  private completionCache: ResponseCache<CompletionResult>;
  private embeddingCache: ResponseCache<number[]>;
  
  private tokenUsage: TokenCounter = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    resetAt: new Date(Date.now() + 86400000), // 24 hours
  };
  
  private tokenLimits = {
    maxTokensPerRequest: 4096,
    maxTokensPerDay: 1000000,
    maxCostPerDay: 100,
  };
  
  private rateLimitRemaining = 60;
  private rateLimitResetAt = new Date(Date.now() + 60000);
  
  constructor(config: OpenAIConfig) {
    this.config = {
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4-turbo-preview',
      maxTokensPerRequest: 4096,
      maxTokensPerDay: 1000000,
      maxCostPerDay: 100,
      cacheEnabled: true,
      cacheTTLMs: 3600000, // 1 hour
      ...config,
      retryConfig: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        ...config.retryConfig,
      },
    };
    
    this.retryConfig = this.config.retryConfig as RetryConfig;
    this.tokenLimits = {
      maxTokensPerRequest: this.config.maxTokensPerRequest,
      maxTokensPerDay: this.config.maxTokensPerDay,
      maxCostPerDay: this.config.maxCostPerDay,
    };
    
    // Initialize caches
    const cacheSize = 100;
    this.transcriptionCache = new ResponseCache(cacheSize, this.config.cacheTTLMs);
    this.classificationCache = new ResponseCache(cacheSize, this.config.cacheTTLMs);
    this.completionCache = new ResponseCache(cacheSize, this.config.cacheTTLMs);
    this.embeddingCache = new ResponseCache(cacheSize, this.config.cacheTTLMs);
  }
  
  async transcribeAudio(
    audioData: ArrayBuffer | Uint8Array,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    // Check cache if enabled
    const cacheKey = this.config.cacheEnabled 
      ? ResponseCache.generateKey({ audio: audioData.byteLength, ...options })
      : null;
    
    if (cacheKey) {
      const cached = this.transcriptionCache.get(cacheKey);
      if (cached) return cached;
    }
    
    // Prepare form data - match legacy implementation exactly
    const formData = new FormData();
    
    // Determine file extension based on actual audio format
    const audioBlob = new Blob([audioData], { type: 'audio/ogg' });
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    
    if (options?.language) {
      formData.append('language', options.language);
    }
    
    // Direct API call like legacy implementation with timeout handling
    try {
      // Add 30-second timeout like legacy implementation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      let response;
      try {
        response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Transcription timeout after 30 seconds');
        }
        throw error;
      }
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Whisper API error:', {
          status: response.status,
          error,
          hasApiKey: !!this.config.apiKey,
          apiKeyLength: this.config.apiKey?.length
        });
        
        if (response.status === 401) {
          throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY configuration.');
        }
        
        throw new Error(`OpenAI API error (${response.status}): ${error}`);
      }
      
      const result = await response.json() as { text: string; language?: string; duration?: number };
      
      if (!result || !result.text) {
        throw new Error('Invalid response from OpenAI Whisper API: missing text field');
      }
      
      const transcriptionResult: TranscriptionResult = {
        text: result.text,
        language: result.language || options?.language,
        duration: result.duration,
        segments: undefined,
      };
      
      // Cache the result
      if (cacheKey && result.text) {
        const estimatedTokens = this.countTokens(result.text);
        this.transcriptionCache.set(cacheKey, transcriptionResult, estimatedTokens);
      }
      
      // Update token usage (estimate for Whisper)
      const estimatedTokens = Math.ceil(audioData.byteLength / 1000); // Rough estimate
      this.updateTokenUsage(0, estimatedTokens);
      
      return transcriptionResult;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }
  
  async classifyText(
    text: string,
    options?: ClassificationOptions
  ): Promise<ClassificationResult> {
    // Check cache
    const cacheKey = this.config.cacheEnabled
      ? ResponseCache.generateKey({ text, ...options })
      : null;
    
    if (cacheKey) {
      const cached = this.classificationCache.get(cacheKey);
      if (cached) return cached;
    }
    
    const categories = options?.categories || ['task', 'note', 'question', 'other'];
    const systemPrompt = `You are a text classifier. Classify the given text into one of these categories: ${categories.join(', ')}. 
    Respond with a JSON object containing: { "category": "chosen_category", "confidence": 0.0-1.0, "reasoning": "brief explanation" }`;
    
    const result = await this.makeRequest<any>('/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });
    
    const parsed = JSON.parse(result.choices[0].message.content);
    
    const classificationResult: ClassificationResult = {
      category: parsed.category,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    };
    
    // Cache the result
    if (cacheKey) {
      const tokensSaved = result.usage?.total_tokens || 0;
      this.classificationCache.set(cacheKey, classificationResult, tokensSaved);
    }
    
    // Update token usage
    if (result.usage) {
      this.updateTokenUsage(result.usage.prompt_tokens, result.usage.completion_tokens);
    }
    
    return classificationResult;
  }
  
  async generateCompletion(
    prompt: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    // Check cache
    const cacheKey = this.config.cacheEnabled
      ? ResponseCache.generateKey({ prompt, ...options })
      : null;
    
    if (cacheKey) {
      const cached = this.completionCache.get(cacheKey);
      if (cached) return cached;
    }
    
    // Check token limits
    const estimatedTokens = this.countTokens(prompt) + (options?.maxTokens || 1000);
    if (this.wouldExceedLimits(estimatedTokens)) {
      throw new Error('Request would exceed token limits');
    }
    
    const messages = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    const result = await this.makeRequest<any>('/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model || this.config.defaultModel,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
      }),
    });
    
    const completionResult: CompletionResult = {
      text: result.choices[0].message.content,
      tokensUsed: result.usage?.total_tokens || 0,
      model: result.model,
      finishReason: result.choices[0].finish_reason,
    };
    
    // Cache the result
    if (cacheKey) {
      this.completionCache.set(cacheKey, completionResult, result.usage?.total_tokens);
    }
    
    // Update token usage
    if (result.usage) {
      this.updateTokenUsage(result.usage.prompt_tokens, result.usage.completion_tokens);
    }
    
    return completionResult;
  }
  
  async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
    // Check cache
    const cacheKey = this.config.cacheEnabled
      ? ResponseCache.generateKey({ text, ...options })
      : null;
    
    if (cacheKey) {
      const cached = this.embeddingCache.get(cacheKey);
      if (cached) return cached;
    }
    
    const result = await this.makeRequest<any>('/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model || 'text-embedding-3-small',
        input: text,
        dimensions: options?.dimensions,
      }),
    });
    
    const embedding = result.data[0].embedding;
    
    // Cache the result
    if (cacheKey) {
      this.embeddingCache.set(cacheKey, embedding, result.usage?.total_tokens);
    }
    
    // Update token usage
    if (result.usage) {
      this.updateTokenUsage(result.usage.prompt_tokens, 0);
    }
    
    return embedding;
  }
  
  async batchClassify(
    texts: string[],
    options?: ClassificationOptions
  ): Promise<ClassificationResult[]> {
    // Process in parallel with rate limiting
    const batchSize = 5;
    const results: ClassificationResult[] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(text => this.classifyText(text, options))
      );
      results.push(...batchResults);
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }
  
  countTokens(text: string, model?: string): number {
    // Simplified token counting (roughly 4 chars per token)
    // In production, use a proper tokenizer like tiktoken
    if (!text || typeof text !== 'string') {
      return 0;
    }
    return Math.ceil(text.length / 4);
  }
  
  getTokenUsage(): TokenUsage {
    this.checkTokenReset();
    
    return {
      promptTokens: this.tokenUsage.promptTokens,
      completionTokens: this.tokenUsage.completionTokens,
      totalTokens: this.tokenUsage.totalTokens,
      estimatedCost: this.tokenUsage.estimatedCost,
    };
  }
  
  resetTokenUsage(): void {
    this.tokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      resetAt: new Date(Date.now() + 86400000),
    };
  }
  
  setTokenLimits(limits: {
    maxTokensPerRequest?: number;
    maxTokensPerDay?: number;
    maxCostPerDay?: number;
  }): void {
    this.tokenLimits = {
      ...this.tokenLimits,
      ...limits,
    };
  }
  
  wouldExceedLimits(estimatedTokens: number): boolean {
    this.checkTokenReset();
    
    if (estimatedTokens > this.tokenLimits.maxTokensPerRequest) {
      return true;
    }
    
    if (this.tokenUsage.totalTokens + estimatedTokens > this.tokenLimits.maxTokensPerDay) {
      return true;
    }
    
    const estimatedCost = this.calculateCost(estimatedTokens, 0);
    if (this.tokenUsage.estimatedCost + estimatedCost > this.tokenLimits.maxCostPerDay) {
      return true;
    }
    
    return false;
  }
  
  clearCache(): void {
    this.transcriptionCache.clear();
    this.classificationCache.clear();
    this.completionCache.clear();
    this.embeddingCache.clear();
  }
  
  getCacheStats() {
    const stats = {
      transcription: this.transcriptionCache.getStats(),
      classification: this.classificationCache.getStats(),
      completion: this.completionCache.getStats(),
      embedding: this.embeddingCache.getStats(),
    };
    
    return {
      hits: Object.values(stats).reduce((sum, s) => sum + s.hits, 0),
      misses: Object.values(stats).reduce((sum, s) => sum + s.misses, 0),
      size: Object.values(stats).reduce((sum, s) => sum + s.size, 0),
      savedTokens: Object.values(stats).reduce((sum, s) => sum + s.savedTokens, 0),
    };
  }
  
  getRateLimitStatus(): RateLimitInfo {
    this.updateRateLimit();
    
    return {
      remaining: this.rateLimitRemaining,
      total: 60,
      resetAt: this.rateLimitResetAt,
      isLimited: this.rateLimitRemaining <= 0,
    };
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async getHealthStatus() {
    const startTime = Date.now();
    const available = await this.isAvailable();
    const latency = Date.now() - startTime;
    
    return {
      healthy: available,
      latency,
      lastError: undefined,
    };
  }
  
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = {
      ...this.retryConfig,
      ...config,
    };
  }
  
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }
  
  // Private methods
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit,
    useJson = true
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        // Check rate limit
        this.updateRateLimit();
        if (this.rateLimitRemaining <= 0) {
          throw new Error('Rate limited');
        }
        
        const headers: any = {
          'Authorization': `Bearer ${this.config.apiKey}`,
          ...options.headers,
        };
        
        if (this.config.organization) {
          headers['OpenAI-Organization'] = this.config.organization;
        }
        
        const response = await fetch(url, {
          ...options,
          headers,
        });
        
        // Update rate limit from headers
        if (response.headers.get('x-ratelimit-remaining')) {
          this.rateLimitRemaining = parseInt(response.headers.get('x-ratelimit-remaining') || '60');
        }
        
        if (response.ok) {
          this.rateLimitRemaining--;
          return useJson ? await response.json() : await response.text();
        }
        
        // Handle rate limiting
        if (response.status === 429) {
          this.rateLimitRemaining = 0;
          const resetTime = response.headers.get('x-ratelimit-reset');
          if (resetTime) {
            this.rateLimitResetAt = new Date(parseInt(resetTime) * 1000);
          }
        }
        
        const errorData = await response.text();
        lastError = new Error(`OpenAI API error: ${response.status} - ${errorData}`);
        
        // Don't retry on client errors except rate limit
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          break;
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
      
      // Wait before retry
      if (attempt < this.retryConfig.maxAttempts) {
        const delay = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelayMs
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Request failed');
  }
  
  private updateTokenUsage(promptTokens: number, completionTokens: number): void {
    this.checkTokenReset();
    
    this.tokenUsage.promptTokens += promptTokens;
    this.tokenUsage.completionTokens += completionTokens;
    this.tokenUsage.totalTokens += promptTokens + completionTokens;
    this.tokenUsage.estimatedCost += this.calculateCost(promptTokens, completionTokens);
  }
  
  private calculateCost(promptTokens: number, completionTokens: number): number {
    // GPT-4 Turbo pricing (as of 2024)
    const promptCost = (promptTokens / 1000) * 0.01; // $0.01 per 1K tokens
    const completionCost = (completionTokens / 1000) * 0.03; // $0.03 per 1K tokens
    return promptCost + completionCost;
  }
  
  private checkTokenReset(): void {
    const now = new Date();
    if (now >= this.tokenUsage.resetAt) {
      this.resetTokenUsage();
    }
  }
  
  private updateRateLimit(): void {
    const now = new Date();
    if (now >= this.rateLimitResetAt) {
      this.rateLimitRemaining = 60;
      this.rateLimitResetAt = new Date(now.getTime() + 60000);
    }
  }
}