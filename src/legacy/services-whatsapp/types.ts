// Z-API webhook payload types
export interface ZApiWebhookPayload {
  waitingMessage?: boolean;
  isGroup?: boolean;
  instanceId?: string;
  messageId: string;
  phone?: string; // Legacy field
  from?: string; // Actual field from Z-API
  to?: string;
  fromMe: boolean;
  momment?: number; // timestamp in milliseconds
  timestamp?: number; // Alternative timestamp field
  status?: string;
  chatName?: string;
  senderPhoto?: string;
  senderName?: string;
  senderNumber?: string;
  participantPhone?: string;
  participantLid?: string;
  photo?: string;
  broadcast?: boolean;
  type: string;
  
  // Message content based on type
  text?: ZApiTextData;
  audio?: ZApiAudioData;
  image?: ZApiImageData;
}

export interface ZApiTextData {
  message: string;
}

export interface ZApiAudioData {
  ptt?: boolean; // Push to Talk (voice message)
  seconds?: number; // duration in seconds
  duration?: number; // Alternative duration field
  audioUrl?: string; // URL to download audio file (legacy)
  data?: string; // Base64 encoded audio data
  mimeType?: string;
  mimetype?: string; // Alternative field name
  viewOnce?: boolean;
}

export interface ZApiImageData {
  imageUrl: string;
  mimeType: string;
  caption?: string;
  viewOnce: boolean;
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