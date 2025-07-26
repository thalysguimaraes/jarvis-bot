import { Env } from './types/env';
import { AudioProcessor } from './router/AudioProcessor';
import { BaileysWebhookPayload } from './services/whatsapp/types';

// Simple in-memory rate limiter to prevent loops
const recentMessages = new Map<string, number>();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleWebhookMessage(request, env, ctx);
    }
    
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }
    
    if (url.pathname === '/status') {
      return handleStatusCheck(env);
    }
    
    if (url.pathname === '/test-webhook') {
      return handleTestWebhook(request, env);
    }
    
    // Debug: Log all requests
    if (url.pathname.startsWith('/webhook')) {
      console.log(`Webhook request received: ${request.method} ${url.pathname}`);
      console.log('Headers:', Object.fromEntries(request.headers.entries()));
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

async function handleWebhookMessage(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    // Validate webhook secret
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.WEBHOOK_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    // Parse the webhook payload
    const payload = await request.json() as BaileysWebhookPayload;
    
    // Only process audio messages
    if (payload.type !== 'audio' || !payload.audio) {
      console.log(`Ignoring non-audio message of type: ${payload.type}`);
      return new Response('OK', { status: 200 });
    }
    
    // Skip messages from self
    if (payload.fromMe) {
      console.log('Ignoring message from self');
      return new Response('OK', { status: 200 });
    }
    
    // Rate limiting
    const messageKey = `${payload.from}:${payload.messageId}`;
    const lastSeen = recentMessages.get(messageKey);
    const now = Date.now();
    
    if (lastSeen && (now - lastSeen) < 60000) { // 1 minute
      console.log('Ignoring duplicate message:', messageKey);
      return new Response('OK', { status: 200 });
    }
    
    recentMessages.set(messageKey, now);
    
    // Clean up old entries
    for (const [key, time] of recentMessages) {
      if (now - time > 300000) { // 5 minutes
        recentMessages.delete(key);
      }
    }
    
    const processor = new AudioProcessor(env);
    
    ctx.waitUntil(
      processor.handleAudioMessage(payload).catch(error => {
        console.error('Error processing audio:', error);
      })
    );
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleStatusCheck(env: Env): Promise<Response> {
  return new Response(JSON.stringify({
    status: 'ok',
    service: 'audio-to-todoist-worker',
    version: '2.0.0',
    providers: {
      whatsapp: 'baileys',
      transcription: 'openai-whisper',
      tasks: 'todoist'
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

async function handleTestWebhook(request: Request, env: Env): Promise<Response> {
  const { debugWebhook } = await import('./debug-webhook');
  return debugWebhook(request);
}