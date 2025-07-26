import { Env } from '@/types/env';
import { BaileysWebhookPayload, BaileysResponse } from '@/services/whatsapp/types';
import { processAudioMessage } from '@/modules/audio/processor';

export class AudioProcessor {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }
  
  public async handleAudioMessage(payload: BaileysWebhookPayload): Promise<void> {
    try {
      if (payload.type !== 'audio' || !payload.audio) {
        console.log('Invalid audio message received');
        return;
      }
      
      // Send initial response
      await this.sendResponse(payload.from, '🎤 Áudio recebido! Processando transcrição...');
      
      const context = {
        env: this.env,
        userId: payload.from,
        todoistToken: this.env.TODOIST_API_TOKEN,
        baileysPayload: payload
      };
      
      await processAudioMessage(payload, context);
      
    } catch (error) {
      console.error('Error processing audio:', error);
      await this.sendResponse(
        payload.from,
        '❌ Erro ao processar o áudio. Por favor, tente novamente.'
      );
    }
  }
  
  private async sendResponse(to: string, message: string): Promise<void> {
    // Send response back to Baileys service
    const response: BaileysResponse = {
      success: true,
      messageId: Date.now().toString()
    };
    
    try {
      await fetch(`${this.env.BAILEYS_SERVICE_URL}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.WEBHOOK_SECRET}`
        },
        body: JSON.stringify({
          to,
          message,
          type: 'text'
        })
      });
    } catch (error) {
      console.error('Error sending response to Baileys:', error);
    }
  }
}