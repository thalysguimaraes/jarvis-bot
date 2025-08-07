import { Message, MessagePriority, SendMessageResult } from '../interfaces/IMessagingService';

export interface QueuedMessage {
  id: string;
  message: Message;
  scheduledAt: Date;
  attempts: number;
  lastAttempt?: Date;
  error?: string;
}

export class MessageQueue {
  private queue: Map<string, QueuedMessage> = new Map();
  private processing = false;
  private processInterval: any;
  
  constructor(
    private sendFunction: (message: Message) => Promise<SendMessageResult>,
    private intervalMs: number = 1000
  ) {
    this.startProcessing();
  }
  
  async add(message: Message, delayMs: number = 0): Promise<string> {
    const id = this.generateId();
    const scheduledAt = new Date(Date.now() + delayMs);
    
    this.queue.set(id, {
      id,
      message,
      scheduledAt,
      attempts: 0,
    });
    
    // Sort queue by priority and scheduled time
    this.sortQueue();
    
    return id;
  }
  
  cancel(id: string): boolean {
    return this.queue.delete(id);
  }
  
  getStatus() {
    const now = new Date();
    let pending = 0;
    let scheduled = 0;
    let failed = 0;
    
    for (const item of this.queue.values()) {
      if (item.error) {
        failed++;
      } else if (item.scheduledAt > now) {
        scheduled++;
      } else {
        pending++;
      }
    }
    
    return {
      pending,
      processing: this.processing ? 1 : 0,
      scheduled,
      failed,
      total: this.queue.size,
    };
  }
  
  private startProcessing() {
    this.processInterval = setInterval(() => {
      if (!this.processing) {
        this.processNext();
      }
    }, this.intervalMs);
  }
  
  private async processNext() {
    const now = new Date();
    const readyMessages = Array.from(this.queue.values())
      .filter(m => m.scheduledAt <= now && !m.error)
      .sort((a, b) => {
        // Sort by priority first, then by scheduled time
        const priorityDiff = (b.message.priority || MessagePriority.NORMAL) - 
                            (a.message.priority || MessagePriority.NORMAL);
        if (priorityDiff !== 0) return priorityDiff;
        return a.scheduledAt.getTime() - b.scheduledAt.getTime();
      });
    
    if (readyMessages.length === 0) return;
    
    const next = readyMessages[0];
    this.processing = true;
    
    try {
      const result = await this.sendFunction(next.message);
      
      if (result.success) {
        this.queue.delete(next.id);
      } else {
        next.attempts++;
        next.lastAttempt = now;
        next.error = result.error;
        
        // Retry with exponential backoff
        if (next.attempts < 3) {
          next.scheduledAt = new Date(now.getTime() + Math.pow(2, next.attempts) * 1000);
          next.error = undefined;
        }
      }
    } catch (error) {
      next.attempts++;
      next.lastAttempt = now;
      next.error = error instanceof Error ? error.message : 'Unknown error';
      
      if (next.attempts < 3) {
        next.scheduledAt = new Date(now.getTime() + Math.pow(2, next.attempts) * 1000);
      }
    } finally {
      this.processing = false;
    }
  }
  
  private sortQueue() {
    // Map maintains insertion order, so we need to recreate it sorted
    const sorted = Array.from(this.queue.entries())
      .sort(([, a], [, b]) => {
        const priorityDiff = (b.message.priority || MessagePriority.NORMAL) - 
                            (a.message.priority || MessagePriority.NORMAL);
        if (priorityDiff !== 0) return priorityDiff;
        return a.scheduledAt.getTime() - b.scheduledAt.getTime();
      });
    
    this.queue.clear();
    for (const [id, message] of sorted) {
      this.queue.set(id, message);
    }
  }
  
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  destroy() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }
    this.queue.clear();
  }
}