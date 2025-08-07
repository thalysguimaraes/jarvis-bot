/**
 * Minimal test entry point for debugging
 */

export interface Env {
  USER_CONFIGS: KVNamespace;
  CLASSIFICATION_ENABLED?: string;
  CLASSIFICATION_CONFIDENCE_THRESHOLD?: string;
  Z_API_INSTANCE_ID: string;
  Z_API_INSTANCE_TOKEN: string;
  Z_API_SECURITY_TOKEN: string;
  OPENAI_API_KEY: string;
  TODOIST_API_TOKEN?: string;
  OBSIDIAN_API_KEY?: string;
  BRAPI_TOKEN?: string;
  PORTFOLIO_WHATSAPP_NUMBER?: string;
  WEBHOOK_SECRET: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    
    // Basic health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        env_keys: Object.keys(env).filter(k => !k.includes('TOKEN') && !k.includes('KEY'))
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Test voice API
    if (url.pathname === '/api/voice-notes/unprocessed') {
      const auth = request.headers.get('Authorization');
      if (!auth || !auth.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      const token = auth.substring(7);
      if (token !== env.OBSIDIAN_API_KEY) {
        return new Response('Invalid token', { status: 401 });
      }
      
      // Return empty array for now
      return new Response('[]', {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};