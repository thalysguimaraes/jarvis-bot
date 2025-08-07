import {
  IMessagingService,
  Message,
  MessageBatch,
  MessageType,
  SendMessageResult,
} from '../interfaces/IMessagingService';
import {
  RateLimitInfo,
  RetryConfig,
} from '../interfaces/IExternalAPIService';
import { MessageQueue } from './MessageQueue';

export interface ZApiConfig {
  instanceId: string;
  instanceToken: string;
  securityToken: string;
  baseUrl?: string;
  rateLimitPerMinute?: number;
  retryConfig?: Partial<RetryConfig>;
}

export class ZApiMessagingService implements IMessagingService {
  private config: Required<ZApiConfig>;
  private messageQueue: MessageQueue;
  private rateLimitTokens: number;
  private rateLimitResetAt: Date;
  private lastRequestTime: Date = new Date();
  private retryConfig: RetryConfig;
  private healthStatus = {
    healthy: true,
    lastError: undefined as string | undefined,
    lastCheck: new Date(),
  };
  
  constructor(config: ZApiConfig) {
    this.config = {
      baseUrl: 'https://api.z-api.io',
      rateLimitPerMinute: 60,
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
    this.rateLimitTokens = this.config.rateLimitPerMinute;
    this.rateLimitResetAt = new Date(Date.now() + 60000);
    
    this.messageQueue = new MessageQueue(
      this.sendMessageInternal.bind(this),
      1000
    );
  }
  
  async sendMessage(message: Message): Promise<SendMessageResult> {
    // Check rate limit
    if (this.isRateLimited()) {
      // Queue the message instead of failing
      const queueId = await this.queueMessage(message);
      return {
        success: false,
        error: `Rate limited. Message queued with ID: ${queueId}`,
        timestamp: new Date(),
      };
    }
    
    return this.sendMessageInternal(message);
  }
  
  private async sendMessageInternal(message: Message): Promise<SendMessageResult> {
    const attempts = this.retryConfig.maxAttempts;
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        // Update rate limit
        this.consumeRateLimit();
        
        const endpoint = this.getEndpoint(message.type || MessageType.TEXT);
        const payload = this.buildPayload(message);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': this.config.securityToken,
          },
          body: JSON.stringify(payload),
        });
        
        if (response.ok) {
          const data = await response.json();
          this.healthStatus.healthy = true;
          return {
            success: true,
            messageId: data.messageId || data.id,
            timestamp: new Date(),
          };
        }
        
        // Handle specific error codes
        if (response.status === 429) {
          // Rate limited by API
          this.rateLimitTokens = 0;
          this.rateLimitResetAt = new Date(Date.now() + 60000);
        }
        
        lastError = new Error(`API error: ${response.status} ${response.statusText}`);
        
        // Don't retry on client errors (4xx) except rate limit
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          break;
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
      
      // Wait before retry (except last attempt)
      if (attempt < attempts) {
        const delay = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelayMs
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    this.healthStatus.healthy = false;
    this.healthStatus.lastError = lastError?.message;
    
    return {
      success: false,
      error: lastError?.message || 'Failed to send message',
      timestamp: new Date(),
    };
  }
  
  async sendBatch(batch: MessageBatch): Promise<SendMessageResult[]> {
    const results: SendMessageResult[] = [];
    
    for (const message of batch.messages) {
      const result = await this.sendMessage(message);
      results.push(result);
      
      // Handle failure strategy
      if (!result.success && batch.failureStrategy === 'stop') {
        break;
      }
    }
    
    // Rollback on failure if specified
    if (batch.failureStrategy === 'rollback' && results.some(r => !r.success)) {
      // In a real implementation, we might need to send compensating messages
      return results.map(r => ({
        ...r,
        success: false,
        error: 'Batch rolled back due to failure',
      }));
    }
    
    return results;
  }
  
  async queueMessage(message: Message, delayMs?: number): Promise<string> {
    return this.messageQueue.add(message, delayMs);
  }
  
  async cancelQueuedMessage(queueId: string): Promise<boolean> {
    return this.messageQueue.cancel(queueId);
  }
  
  getQueueStatus() {
    const status = this.messageQueue.getStatus();
    return {
      pending: status.pending,
      processing: status.processing,
      failed: status.failed,
    };
  }
  
  async downloadMedia(messageId: string, mediaType: 'audio' | 'image' | 'document'): Promise<ArrayBuffer> {
    const endpoint = `${this.config.baseUrl}/instances/${this.config.instanceId}/token/${this.config.instanceToken}/download-media`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': this.config.securityToken,
      },
      body: JSON.stringify({
        messageId,
        mediaType,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status}`);
    }
    
    return response.arrayBuffer();
  }
  
  async sendMedia(
    recipient: string,
    mediaData: ArrayBuffer,
    mediaType: MessageType,
    caption?: string
  ): Promise<SendMessageResult> {
    // Convert ArrayBuffer to base64
    const base64 = btoa(String.fromCharCode(...new Uint8Array(mediaData)));
    
    const message: Message = {
      recipient,
      content: base64,
      type: mediaType,
      metadata: { caption },
    };
    
    return this.sendMessage(message);
  }
  
  validatePhoneNumber(phoneNumber: string): boolean {
    // Basic validation for international phone numbers
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }
  
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add Brazil country code if not present
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
      cleaned = '55' + cleaned.substring(1);
    } else if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = '55' + cleaned;
    }
    
    return cleaned;
  }
  
  getRateLimitStatus(): RateLimitInfo {
    this.updateRateLimit();
    
    return {
      remaining: this.rateLimitTokens,
      total: this.config.rateLimitPerMinute,
      resetAt: this.rateLimitResetAt,
      isLimited: this.rateLimitTokens <= 0,
    };
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/instances/${this.config.instanceId}/token/${this.config.instanceToken}/status`,
        {
          headers: {
            'Client-Token': this.config.securityToken,
          },
        }
      );
      
      this.healthStatus.healthy = response.ok;
      this.healthStatus.lastCheck = new Date();
      
      return response.ok;
    } catch (error) {
      this.healthStatus.healthy = false;
      this.healthStatus.lastError = error instanceof Error ? error.message : 'Unknown error';
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
      lastError: this.healthStatus.lastError,
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
  
  private getEndpoint(messageType: MessageType): string {
    const base = `${this.config.baseUrl}/instances/${this.config.instanceId}/token/${this.config.instanceToken}`;
    
    switch (messageType) {
      case MessageType.TEXT:
        return `${base}/send-text`;
      case MessageType.AUDIO:
        return `${base}/send-audio`;
      case MessageType.IMAGE:
        return `${base}/send-image`;
      case MessageType.DOCUMENT:
        return `${base}/send-document`;
      default:
        return `${base}/send-text`;
    }
  }
  
  private buildPayload(message: Message): any {
    const phone = this.formatPhoneNumber(message.recipient);
    
    const payload: any = {
      phone,
    };
    
    switch (message.type) {
      case MessageType.TEXT:
        payload.message = message.content;
        break;
      case MessageType.AUDIO:
      case MessageType.IMAGE:
      case MessageType.DOCUMENT:
        payload.base64 = message.content;
        if (message.metadata?.caption) {
          payload.caption = message.metadata.caption;
        }
        break;
      default:
        payload.message = message.content;
    }
    
    return payload;
  }
  
  private updateRateLimit() {
    const now = new Date();
    
    // Reset rate limit if window has passed
    if (now >= this.rateLimitResetAt) {
      this.rateLimitTokens = this.config.rateLimitPerMinute;
      this.rateLimitResetAt = new Date(now.getTime() + 60000);
    }
  }
  
  private consumeRateLimit() {
    this.updateRateLimit();
    
    if (this.rateLimitTokens > 0) {
      this.rateLimitTokens--;
    }
    
    this.lastRequestTime = new Date();
  }
  
  private isRateLimited(): boolean {
    this.updateRateLimit();
    return this.rateLimitTokens <= 0;
  }
  
  destroy() {
    this.messageQueue.destroy();
  }
}