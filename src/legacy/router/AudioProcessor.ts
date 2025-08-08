// Simplified AudioProcessor without complex dependencies
import { VoiceNoteSyncService } from '../../domains/notes/services/VoiceNoteSyncService';
import { KVStorageService } from '../../core/services/storage/KVStorageService';
import { Logger } from '../../core/logging/Logger';
import { VoiceNote } from '../../domains/notes/types';
interface ZApiWebhookPayload {
  event?: string;
  data?: any;
  audio?: {
    data?: string;
    audioUrl?: string;
    mimeType?: string;
    mimetype?: string;
    seconds?: number;
    duration?: number;
  };
  from?: string;
  phone?: string;
  senderNumber?: string;
}

interface Env {
  Z_API_INSTANCE_ID: string;
  Z_API_INSTANCE_TOKEN: string;
  Z_API_CLIENT_TOKEN?: string;
  Z_API_SECURITY_TOKEN?: string;
  OPENAI_API_KEY: string;
  TODOIST_API_TOKEN?: string;
  USER_CONFIGS?: any;
  ZAISEN_API_URL?: string;
  ZAISEN_API_KEY?: string;
  CLASSIFICATION_ENABLED?: string;
}

export class AudioProcessor {
  private env: Env;
  private voiceSyncService: VoiceNoteSyncService | null = null;
  
  constructor(env: Env) {
    this.env = env;
    
    // Initialize storage and logger for VoiceNoteSyncService
    if (this.env.USER_CONFIGS) {
      const storageService = new KVStorageService(this.env.USER_CONFIGS);
      const logger = new Logger();
      this.voiceSyncService = new VoiceNoteSyncService(storageService, logger);
    }
  }
  
  public async handleAudioMessage(payload: ZApiWebhookPayload): Promise<void> {
    const userPhone = payload.from || payload.phone || payload.senderNumber;
    
    if (!userPhone) {
      console.error('No user phone number found in payload');
      return;
    }
    
    try {
      if (!payload.audio) {
        console.log('Invalid audio message received');
        return;
      }
      
      // Send initial response
      await this.sendResponse(userPhone, '🎤 Áudio recebido! Processando transcrição...');
      
      // Process audio directly
      await this.processAudioDirect(payload, userPhone);
      
    } catch (error) {
      console.error('Error processing audio:', error);
      await this.sendResponse(
        userPhone,
        '❌ Erro ao processar o áudio. Por favor, tente novamente.'
      );
    }
  }

  private async processAudioDirect(payload: ZApiWebhookPayload, userPhone: string): Promise<void> {
    try {
      // Get audio buffer
      let audioBuffer: ArrayBuffer;
      
      if (payload.audio?.data) {
        // Decode base64 audio data
        const base64Data = payload.audio.data;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioBuffer = bytes.buffer;
      } else if (payload.audio?.audioUrl) {
        // Download audio from URL
        const audioResponse = await fetch(payload.audio.audioUrl);
        if (!audioResponse.ok) {
          throw new Error(`Failed to download audio: ${audioResponse.status}`);
        }
        audioBuffer = await audioResponse.arrayBuffer();
      } else {
        throw new Error('No audio data or URL found');
      }

      // Transcribe with OpenAI
      const transcription = await this.transcribeAudio(audioBuffer);

      if (!transcription || transcription.trim().length === 0) {
        await this.sendResponse(
          userPhone,
          '❌ Não consegui transcrever o áudio. Por favor, tente falar mais claramente.'
        );
        return;
      }

      // Classify and process based on type
      await this.classifyAndProcess(transcription, payload, userPhone);

    } catch (error) {
      console.error('Audio processing error:', error);
      throw error;
    }
  }

  private async classifyAndProcess(transcription: string, payload: ZApiWebhookPayload, userPhone: string): Promise<void> {
    let classification: { type: string; confidence: number; reasoning: string } | null = null;
    
    // Check if classification is enabled (CLASSIFICATION_ENABLED env var)
    const classificationEnabled = this.env.CLASSIFICATION_ENABLED === 'true';
    
    if (classificationEnabled && this.env.OPENAI_API_KEY) {
      try {
        // Simple OpenAI-based classification
        classification = await this.classifyWithOpenAI(transcription);
        
        const getClassificationDisplay = (type: string) => {
          switch (type) {
            case 'task': return { emoji: '📋', text: 'Tarefa' };
            case 'note': return { emoji: '📝', text: 'Nota' };
            default: return { emoji: '📋', text: 'Tarefa' };
          }
        };
        
        const { emoji: classificationEmoji, text: classificationText } = getClassificationDisplay(classification.type);
        const confidenceText = classification.confidence >= 0.8 ? '✅' : '⚠️';
        
        console.log('Classification result:', {
          type: classification.type,
          confidence: classification.confidence,
          reasoning: classification.reasoning
        });
        
        await this.sendResponse(
          userPhone,
          `${classificationEmoji} Transcrição: "${transcription}"\n\n${confidenceText} Classificado como: ${classificationText} (${Math.round(classification.confidence * 100)}% de confiança)`
        );
        
      } catch (error) {
        console.error('Classification failed:', error);
        classification = { type: 'task', confidence: 0.5, reasoning: 'Classification failed, defaulting to task' };
      }
    } else {
      // Default to task if classification is disabled
      classification = { type: 'task', confidence: 1.0, reasoning: 'Classification disabled' };
      
      // Send simple transcription result
      await this.sendResponse(
        userPhone,
        `🎤 Transcrição: "${transcription}"\n\n✅ Áudio processado com sucesso!`
      );
    }
    
    // Process based on classification
    if (classification.type === 'note') {
      await this.processAsNote(transcription, payload, userPhone);
    } else {
      await this.processAsTask(transcription, userPhone);
    }
  }

  private async classifyWithOpenAI(transcription: string): Promise<{ type: string; confidence: number; reasoning: string }> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a text classifier. Classify the given Portuguese text as either "task" (actionable item) or "note" (information to remember). Respond with JSON: { "type": "task" or "note", "confidence": 0.0-1.0, "reasoning": "brief explanation" }'
          },
          {
            role: 'user',
            content: transcription
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI classification error: ${response.status}`);
    }

    const result: any = await response.json();
    const parsed = JSON.parse(result.choices[0].message.content);
    
    return {
      type: parsed.type || 'task',
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || 'AI classification'
    };
  }

  private async processAsNote(transcription: string, payload: ZApiWebhookPayload, userPhone: string): Promise<void> {
    try {
      await this.sendResponse(
        userPhone,
        '📝 Salvando nota para sincronização com Obsidian...'
      );
      
      // Store voice note for Obsidian sync
      await this.storeVoiceNote(transcription, userPhone, payload);
      
      await this.sendResponse(
        userPhone,
        `✅ Nota salva para sincronização!\n\n📝 "${transcription.substring(0, 100)}${transcription.length > 100 ? '...' : ''}"\n\n💡 A nota será sincronizada automaticamente com seu Obsidian.`
      );
      
    } catch (error) {
      console.error('Error processing as note:', error);
      await this.sendResponse(
        userPhone,
        '❌ Erro ao salvar nota. Criando tarefa no Todoist como fallback...'
      );
      await this.processAsTask(`[NOTA] ${transcription}`, userPhone);
    }
  }

  private async processAsTask(transcription: string, userPhone: string): Promise<void> {
    await this.sendResponse(
      userPhone,
      '✨ Criando tarefa no Todoist...'
    );
    
    if (!this.env.TODOIST_API_TOKEN) {
      await this.sendResponse(
        userPhone,
        '❌ Token do Todoist não configurado. Adicione TODOIST_API_TOKEN nas variáveis de ambiente.'
      );
      return;
    }
    
    await this.createSimpleTask(transcription, userPhone);
  }

  private async transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
    if (!this.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' });
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');

    // Add timeout like legacy implementation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`
        },
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        if (response.status === 401) {
          throw new Error('Invalid OpenAI API key');
        }
        throw new Error(`OpenAI API error (${response.status}): ${error}`);
      }

      const result = await response.json() as { text: string };
      return result.text;

    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Transcription timeout after 30 seconds');
      }
      throw error;
    }
  }

  private async storeVoiceNote(transcription: string, userPhone: string, payload: ZApiWebhookPayload): Promise<void> {
    try {
      if (!this.env.USER_CONFIGS) {
        console.warn('USER_CONFIGS KV not available for voice note storage');
        return;
      }

      // Generate unique note ID
      const noteId = `vn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create voice note object
      const voiceNote = {
        id: noteId,
        transcription,
        timestamp: new Date().toISOString(),
        phone: userPhone,
        processed: false,
        syncedToObsidian: false,
        metadata: {
          classification: 'note',
          confidence: 1.0,
          audioUrl: payload.audio?.audioUrl,
          duration: payload.audio?.duration || payload.audio?.seconds,
          mimeType: payload.audio?.mimeType || payload.audio?.mimetype
        }
      };

      // Store using the VoiceNoteSyncService if available
      if (this.voiceSyncService) {
        // Convert to VoiceNote type for the service
        const serviceNote: VoiceNote = {
          id: noteId,
          transcription,
          timestamp: voiceNote.timestamp,
          phone: userPhone,
          processed: false,
          syncedToObsidian: false,
          metadata: voiceNote.metadata
        };
        await this.voiceSyncService.storeVoiceNote(serviceNote);
        console.log('Voice note stored via VoiceNoteSyncService:', {
          noteId,
          userPhone,
          transcriptionLength: transcription.length
        });
      } else {
        // Fallback to direct KV storage
        await this.env.USER_CONFIGS.put(`voice-notes:${noteId}`, JSON.stringify(voiceNote));
        console.log('Voice note stored directly to KV (fallback):', {
          noteId,
          userPhone,
          transcriptionLength: transcription.length
        });
      }

    } catch (error) {
      console.error('Error storing voice note:', error);
      // Don't throw - this is not critical
    }
  }

  private async createSimpleTask(transcription: string, userPhone: string): Promise<void> {
    try {
      // Create a simple task using Todoist REST API
      const response = await fetch('https://api.todoist.com/rest/v2/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.TODOIST_API_TOKEN}`
        },
        body: JSON.stringify({
          content: transcription,
          priority: 1
        })
      });

      if (!response.ok) {
        throw new Error(`Todoist API error: ${response.status}`);
      }

      await this.sendResponse(
        userPhone,
        `✅ Tarefa criada no Todoist: "${transcription}"`
      );

    } catch (error) {
      console.error('Error creating Todoist task:', error);
      await this.sendResponse(
        userPhone,
        '⚠️ Transcrito com sucesso, mas não foi possível criar tarefa no Todoist.'
      );
    }
  }

  public async processFundCommand(
    transcription: string, 
    _classification: string,
    payload: ZApiWebhookPayload
  ): Promise<void> {
    try {
      const userId = payload.phone || payload.from || payload.senderNumber;
      
      if (!userId) {
        console.error('No user ID found for fund command');
        return;
      }
      
      // Simplified fund command handling - just acknowledge for now
      await this.sendResponse(
        userId,
        `💰 Comando de fundo recebido: "${transcription}"\n\n⚠️ Funcionalidade em manutenção. Use o comando via chat.`
      );
      
    } catch (error) {
      console.error('Error processing fund command:', error);
      await this.sendResponse(
        payload.phone || payload.from || payload.senderNumber || '',
        '❌ Erro ao processar comando de fundo.'
      );
    }
  }

  private async sendResponse(to: string, message: string): Promise<void> {
    // Validate phone number
    if (!to || to.trim() === '') {
      console.error('Cannot send message: phone number is empty');
      return;
    }
    
    // Send response back via Z-API
    if (!this.env.Z_API_INSTANCE_ID || !this.env.Z_API_INSTANCE_TOKEN || 
        (!this.env.Z_API_SECURITY_TOKEN && !this.env.Z_API_CLIENT_TOKEN)) {
      console.error('Z-API credentials not configured');
      return;
    }
    
    try {
      const url = `https://api.z-api.io/instances/${this.env.Z_API_INSTANCE_ID}/token/${this.env.Z_API_INSTANCE_TOKEN}/send-text`;
      const body = {
        phone: to,
        message
      };
      
      console.log('Sending Z-API message from AudioProcessor:', {
        url,
        to,
        messageLength: message.length,
        hasClientToken: !!(this.env.Z_API_CLIENT_TOKEN || this.env.Z_API_SECURITY_TOKEN)
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.env.Z_API_CLIENT_TOKEN || this.env.Z_API_SECURITY_TOKEN || ''
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Z-API error response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Z-API error: ${response.status} - ${errorText}`);
      }
      
      console.log('Z-API message sent successfully from AudioProcessor');
    } catch (error) {
      console.error('Error sending response via Z-API:', error);
    }
  }
}
