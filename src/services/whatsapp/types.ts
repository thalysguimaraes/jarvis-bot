// Baileys webhook payload types
export interface BaileysWebhookPayload {
  messageId: string;
  from: string;
  to: string;
  timestamp: number;
  type: 'text' | 'audio' | 'image' | 'video' | 'document';
  fromMe: boolean;
  
  // Optional fields based on message type
  text?: string;
  audio?: BaileysAudioData;
  image?: BaileysImageData;
  
  // Sender info
  senderName?: string;
  senderNumber?: string;
}

export interface BaileysAudioData {
  mimetype: string;
  data: string; // base64 encoded audio
  duration?: number;
}

export interface BaileysImageData {
  mimetype: string;
  data: string; // base64 encoded image
  caption?: string;
}

// Response format for Baileys service
export interface BaileysResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Legacy types kept for compatibility
export interface WhatsAppMessage {
  id: string;
  from: string;
  name: string;
  timestamp: number;
  type: 'text' | 'audio' | 'image' | 'document' | 'location' | 'button' | 'interactive';
  text?: string;
  audio?: AudioMessage;
  image?: MediaMessage;
  document?: MediaMessage;
  location?: LocationMessage;
  context?: MessageContext;
}

export interface AudioMessage {
  id: string;
  mime_type: string;
}

export interface MediaMessage {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
}

export interface LocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface MessageContext {
  from: string;
  id: string;
}

export interface MessageTemplate {
  text?: string;
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
  interactive?: any;
}