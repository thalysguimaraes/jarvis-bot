/**
 * Simplified index for Jarvis Bot - working version
 */

import { Env } from './types/env';
import { AudioProcessor } from './router/AudioProcessor';
import { ZApiWebhookPayload } from './services/whatsapp/types';
import { PortfolioTracker } from './modules/portfolio-tracker';

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    // Portfolio daily report
    if (env.BRAPI_TOKEN && env.Z_API_INSTANCE_ID && env.Z_API_INSTANCE_TOKEN && 
        env.Z_API_CLIENT_TOKEN && env.PORTFOLIO_WHATSAPP_NUMBER) {
      try {
        const portfolioTracker = new PortfolioTracker({
          brapiToken: env.BRAPI_TOKEN,
          zApiInstanceId: env.Z_API_INSTANCE_ID,
          zApiInstanceToken: env.Z_API_INSTANCE_TOKEN,
          zApiSecurityToken: env.Z_API_CLIENT_TOKEN,
          whatsappNumber: env.PORTFOLIO_WHATSAPP_NUMBER,
          zaisenApiUrl: env.ZAISEN_API_URL,
          zaisenApiKey: env.ZAISEN_API_KEY,
        });
        
        await portfolioTracker.sendDailyReport(env.PORTFOLIO_DATA, env.FUND_PORTFOLIO_DATA);
        console.log('Daily portfolio report sent successfully');
      } catch (error) {
        console.error('Error sending daily portfolio report:', error);
      }
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'jarvis-bot' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Webhook handler
    if (url.pathname === '/webhook' && request.method === 'POST') {
      // Authenticate with Client-Token
      const clientToken = request.headers.get('Client-Token');
      if (clientToken !== env.Z_API_CLIENT_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      try {
        const payload = await request.json() as ZApiWebhookPayload;
        
        // Handle audio messages
        if (payload.event === 'message.received' && 
            payload.data?.message?.type === 'audio' &&
            !payload.data?.message?.fromMe) {
          
          try {
            const processor = new AudioProcessor(env);
            // Transform the message to match expected format
            const audioPayload = {
              ...payload,
              audio: payload.data.message.body,
              from: payload.data.message.from,
              phone: payload.data.message.from,
              senderNumber: payload.data.message.from,
            };
            await processor.handleAudioMessage(audioPayload);
            
            return new Response(JSON.stringify({ 
              success: true,
              message: 'Audio message processed'
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (error) {
            console.error('Audio processing error:', error);
            return new Response(JSON.stringify({ 
              success: false,
              message: 'Audio processing failed',
              error: error instanceof Error ? error.message : 'Unknown error'
            }), {
              status: 200,  // Still return 200 to acknowledge webhook
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
        
        // Acknowledge other messages
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Webhook received'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('Webhook processing error:', error);
        return new Response('Bad Request', { status: 400 });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  },
};