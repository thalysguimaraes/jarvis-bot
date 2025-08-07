import { vi } from 'vitest';

export interface MessageRecord {
  recipient: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'audio' | 'image';
}

export class MockMessagingService {
  private messages: MessageRecord[] = [];
  private rateLimitRemaining = 100;
  private isRateLimited = false;
  
  // Mock methods
  sendMessage = vi.fn(async (recipient: string, message: string) => {
    if (this.isRateLimited) {
      throw new Error('Rate limit exceeded');
    }
    
    if (this.rateLimitRemaining <= 0) {
      this.isRateLimited = true;
      throw new Error('Rate limit exceeded');
    }
    
    this.messages.push({
      recipient,
      message,
      timestamp: new Date(),
      type: 'text',
    });
    
    this.rateLimitRemaining--;
    return { success: true, messageId: Math.random().toString(36) };
  });
  
  sendAudio = vi.fn(async (recipient: string, audioUrl: string) => {
    this.messages.push({
      recipient,
      message: audioUrl,
      timestamp: new Date(),
      type: 'audio',
    });
    
    return { success: true, messageId: Math.random().toString(36) };
  });
  
  downloadAudio = vi.fn(async (messageId: string) => {
    // Return mock base64 audio data
    return 'bW9jayBhdWRpbyBkYXRh';
  });
  
  // Test helpers
  getMessages(): MessageRecord[] {
    return [...this.messages];
  }
  
  getMessagesByRecipient(recipient: string): MessageRecord[] {
    return this.messages.filter(m => m.recipient === recipient);
  }
  
  clearMessages(): void {
    this.messages = [];
  }
  
  setRateLimit(remaining: number): void {
    this.rateLimitRemaining = remaining;
    this.isRateLimited = false;
  }
  
  setRateLimited(limited: boolean): void {
    this.isRateLimited = limited;
  }
  
  getRateLimitStatus() {
    return {
      remaining: this.rateLimitRemaining,
      isLimited: this.isRateLimited,
    };
  }
}