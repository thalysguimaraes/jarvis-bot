import { IExternalAPIService } from './IExternalAPIService';

/**
 * Message types supported by the messaging service
 */
export enum MessageType {
  TEXT = 'text',
  AUDIO = 'audio',
  IMAGE = 'image',
  DOCUMENT = 'document',
}

/**
 * Message priority levels for queue management
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

export interface Message {
  recipient: string;
  content: string;
  type?: MessageType;
  priority?: MessagePriority;
  metadata?: Record<string, any>;
}

export interface MessageBatch {
  messages: Message[];
  failureStrategy?: 'stop' | 'continue' | 'rollback';
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

export interface IMessagingService extends IExternalAPIService {
  /**
   * Send a single message
   */
  sendMessage(message: Message): Promise<SendMessageResult>;
  
  /**
   * Send multiple messages in batch
   */
  sendBatch(batch: MessageBatch): Promise<SendMessageResult[]>;
  
  /**
   * Queue a message for delayed sending
   */
  queueMessage(message: Message, delayMs?: number): Promise<string>;
  
  /**
   * Cancel a queued message
   */
  cancelQueuedMessage(queueId: string): Promise<boolean>;
  
  /**
   * Get queue status
   */
  getQueueStatus(): {
    pending: number;
    processing: number;
    failed: number;
  };
  
  /**
   * Download media from a message
   */
  downloadMedia(messageId: string, mediaType: 'audio' | 'image' | 'document'): Promise<ArrayBuffer>;
  
  /**
   * Send media message
   */
  sendMedia(recipient: string, mediaData: ArrayBuffer, mediaType: MessageType, caption?: string): Promise<SendMessageResult>;
  
  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber: string): boolean;
  
  /**
   * Format phone number for sending
   */
  formatPhoneNumber(phoneNumber: string): string;
}