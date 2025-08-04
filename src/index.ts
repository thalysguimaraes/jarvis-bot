import { Env } from './types/env';
import { AudioProcessor } from './router/AudioProcessor';
import { ZApiWebhookPayload } from './services/whatsapp/types';
import { PortfolioTracker } from './modules/portfolio-tracker';

// Simple in-memory rate limiter to prevent loops
const recentMessages = new Map<string, number>();

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    // Portfolio daily report
    if (env.BRAPI_TOKEN && env.Z_API_INSTANCE_ID && env.Z_API_INSTANCE_TOKEN && 
        env.Z_API_SECURITY_TOKEN && env.PORTFOLIO_WHATSAPP_NUMBER) {
      try {
        const portfolioTracker = new PortfolioTracker({
          brapiToken: env.BRAPI_TOKEN,
          zApiInstanceId: env.Z_API_INSTANCE_ID,
          zApiInstanceToken: env.Z_API_INSTANCE_TOKEN,
          zApiSecurityToken: env.Z_API_SECURITY_TOKEN,
          whatsappNumber: env.PORTFOLIO_WHATSAPP_NUMBER,
          zaisenApiUrl: env.ZAISEN_API_URL,
          zaisenApiKey: env.ZAISEN_API_KEY,
        });
        
        await portfolioTracker.sendDailyReport();
        console.log('Daily portfolio report sent successfully');
      } catch (error) {
        console.error('Error sending daily portfolio report:', error);
      }
    } else {
      console.log('Portfolio tracking disabled - missing environment variables');
    }
  },

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
    
    if (url.pathname === '/test-config') {
      return handleTestConfig(env);
    }
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        }
      });
    }
    
    if (url.pathname === '/api/notes' && request.method === 'GET') {
      return handleGetNotes(request, env);
    }
    
    if (url.pathname === '/api/notes/sync' && request.method === 'POST') {
      return handleSyncNotes(request, env);
    }
    
    if (url.pathname === '/api/notes/clear' && request.method === 'POST') {
      return handleClearNotes(request, env);
    }
    
    if (url.pathname === '/test-portfolio' && request.method === 'POST') {
      return handleTestPortfolio(request, env);
    }
    
    if (url.pathname === '/test-fund-portfolio' && request.method === 'POST') {
      return handleTestFundPortfolio(request, env);
    }
    
    if (url.pathname === '/test-fund-storage' && request.method === 'POST') {
      return handleTestFundStorage(request, env);
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
    // Z-API webhooks don't send authentication headers
    // We'll rely on the webhook URL being private and HTTPS
    console.log('Webhook received from Z-API');
    
    // Parse the webhook payload
    const payload = await request.json() as ZApiWebhookPayload;
    
    console.log('Raw webhook payload:', JSON.stringify(payload, null, 2));
    
    const userPhone = payload.from || payload.phone || payload.senderNumber;
    
    console.log('Webhook payload:', {
      type: payload.type,
      hasAudio: !!payload.audio,
      fromMe: payload.fromMe,
      isGroup: payload.isGroup,
      phone: userPhone,
      messageId: payload.messageId,
      hasAudioData: !!payload.audio?.data,
      hasAudioUrl: !!payload.audio?.audioUrl
    });
    
    console.log('Environment check:', {
      hasInstanceId: !!env.Z_API_INSTANCE_ID,
      hasInstanceToken: !!env.Z_API_INSTANCE_TOKEN,
      hasSecurityToken: !!env.Z_API_SECURITY_TOKEN,
      hasOpenAI: !!env.OPENAI_API_KEY,
      hasTodoist: !!env.TODOIST_API_TOKEN
    });
    
    // Test: Send immediate response to confirm Z-API works
    // DISABLED - This test message might interfere with the audio processing
    /*
    if (env.Z_API_INSTANCE_ID && env.Z_API_INSTANCE_TOKEN && env.Z_API_SECURITY_TOKEN && userPhone) {
      try {
        const testResponse = await fetch(`https://api.z-api.io/instances/${env.Z_API_INSTANCE_ID}/token/${env.Z_API_INSTANCE_TOKEN}/send-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': env.Z_API_SECURITY_TOKEN
          },
          body: JSON.stringify({
            phone: userPhone,
            message: '✅ Webhook received! Testing Z-API connection...'
          })
        });
        
        console.log('Test message response:', {
          status: testResponse.status,
          ok: testResponse.ok
        });
        
        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          console.error('Test message failed:', errorText);
        }
      } catch (error) {
        console.error('Test message error:', error);
      }
    }
    */
    
    // Only process audio messages
    if (!payload.audio) {
      console.log(`Ignoring non-audio message of type: ${payload.type}`);
      return new Response('OK', { status: 200 });
    }
    
    // Skip messages from self
    if (payload.fromMe) {
      console.log('Ignoring message from self');
      return new Response('OK', { status: 200 });
    }
    
    // Skip group messages
    if (payload.isGroup) {
      console.log('Ignoring group message');
      return new Response('OK', { status: 200 });
    }
    
    // Rate limiting
    const messageKey = `${payload.phone}:${payload.messageId}`;
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
  const stockTrackingEnabled = !!(env.BRAPI_TOKEN && env.Z_API_INSTANCE_ID && 
    env.Z_API_INSTANCE_TOKEN && env.Z_API_SECURITY_TOKEN && env.PORTFOLIO_WHATSAPP_NUMBER);
  const fundTrackingEnabled = !!(env.ZAISEN_API_URL && env.ZAISEN_API_KEY);
  
  return new Response(JSON.stringify({
    status: 'ok',
    service: 'jarvis-bot',
    version: '3.0.0',
    features: [
      'voice-to-task',
      'portfolio-tracking',
      'fund-tracking',
      'note-taking',
      'classification'
    ],
    providers: {
      whatsapp: 'z-api',
      transcription: 'openai-whisper',
      tasks: 'todoist',
      stocks: 'brapi',
      funds: 'zaisen',
      storage: 'cloudflare-kv'
    },
    tracking: {
      stocks: stockTrackingEnabled,
      funds: fundTrackingEnabled,
      combined: stockTrackingEnabled && fundTrackingEnabled
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

async function handleTestWebhook(request: Request, _env: Env): Promise<Response> {
  const { debugWebhook } = await import('./debug-webhook');
  return debugWebhook(request);
}

async function handleTestConfig(env: Env): Promise<Response> {
  const { testConfiguration } = await import('./debug/test-config');
  const config = testConfiguration(env);
  
  return new Response(JSON.stringify(config, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

async function handleGetNotes(request: Request, env: Env): Promise<Response> {
  const { KVNoteStorage } = await import('./modules/kv-notes');
  
  // Optional: Add authentication
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.WEBHOOK_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const storage = new KVNoteStorage(env.USER_CONFIGS);
    const url = new URL(request.url);
    const onlyUnsynced = url.searchParams.get('unsynced') === 'true';
    
    const notes = await storage.getNotes(onlyUnsynced);
    
    return new Response(JSON.stringify({
      notes,
      count: notes.length,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error getting notes:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleSyncNotes(request: Request, env: Env): Promise<Response> {
  const { KVNoteStorage } = await import('./modules/kv-notes');
  
  // Authentication
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.WEBHOOK_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const { noteIds } = await request.json() as { noteIds: string[] };
    const storage = new KVNoteStorage(env.USER_CONFIGS);
    
    await storage.markAsSynced(noteIds);
    
    return new Response(JSON.stringify({
      success: true,
      syncedCount: noteIds.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error syncing notes:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleClearNotes(request: Request, env: Env): Promise<Response> {
  const { KVNoteStorage } = await import('./modules/kv-notes');
  
  // Authentication
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.WEBHOOK_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const storage = new KVNoteStorage(env.USER_CONFIGS);
    const cleared = await storage.clearSyncedNotes();
    
    return new Response(JSON.stringify({
      success: true,
      clearedCount: cleared
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error clearing notes:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleTestPortfolio(request: Request, env: Env): Promise<Response> {
  // Authentication
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.WEBHOOK_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  if (!env.BRAPI_TOKEN || !env.Z_API_INSTANCE_ID || !env.Z_API_INSTANCE_TOKEN || 
      !env.Z_API_SECURITY_TOKEN || !env.PORTFOLIO_WHATSAPP_NUMBER) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Portfolio tracking not configured - missing environment variables' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const portfolioTracker = new PortfolioTracker({
      brapiToken: env.BRAPI_TOKEN,
      zApiInstanceId: env.Z_API_INSTANCE_ID,
      zApiInstanceToken: env.Z_API_INSTANCE_TOKEN,
      zApiSecurityToken: env.Z_API_SECURITY_TOKEN,
      whatsappNumber: env.PORTFOLIO_WHATSAPP_NUMBER,
      zaisenApiUrl: env.ZAISEN_API_URL,
      zaisenApiKey: env.ZAISEN_API_KEY,
    });
    
    const combinedData = await portfolioTracker.getCombinedPortfolioData();
    await portfolioTracker.sendDailyReport();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Portfolio report sent successfully',
      data: combinedData,
      fundTrackingEnabled: portfolioTracker.isFundTrackingEnabled()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error testing portfolio:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleTestFundPortfolio(request: Request, env: Env): Promise<Response> {
  // Authentication
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.WEBHOOK_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  if (!env.ZAISEN_API_URL || !env.ZAISEN_API_KEY) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Fund tracking not configured - missing Zaisen API environment variables' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const portfolioTracker = new PortfolioTracker({
      brapiToken: env.BRAPI_TOKEN || '',
      zApiInstanceId: env.Z_API_INSTANCE_ID || '',
      zApiInstanceToken: env.Z_API_INSTANCE_TOKEN || '',
      zApiSecurityToken: env.Z_API_SECURITY_TOKEN || '',
      whatsappNumber: env.PORTFOLIO_WHATSAPP_NUMBER || '',
      zaisenApiUrl: env.ZAISEN_API_URL,
      zaisenApiKey: env.ZAISEN_API_KEY,
    });
    
    const fundData = await portfolioTracker.getFundPortfolioData();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Fund portfolio data retrieved successfully',
      data: fundData,
      fundTrackingEnabled: portfolioTracker.isFundTrackingEnabled()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error testing fund portfolio:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleTestFundStorage(request: Request, env: Env): Promise<Response> {
  // Authentication
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${env.WEBHOOK_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  try {
    const { KVFundStorage } = await import('./modules/fund-tracker');
    const storage = new KVFundStorage(env.USER_CONFIGS);
    const userId = 'test-user-123';
    
    // Your actual fund positions for testing
    const positions = [
      {
        cnpj: "11.111.111/0001-11",
        name: "Cash CIC de Classes RF",
        quotas: 222,
        avgPrice: 100.00,
        investedAmount: 21074.60,
        purchaseDate: "2025-01-08T00:00:00Z"
      },
      {
        cnpj: "22.222.222/0001-22", 
        name: "Absolute Hidra CDI FIC FI Infra",
        quotas: 469,
        avgPrice: 150.00,
        investedAmount: 60000.00,
        purchaseDate: "2025-07-31T00:00:00Z"
      },
      {
        cnpj: "33.333.333/0001-33",
        name: "Absolute Atenas Advisory FIC", 
        quotas: 810,
        avgPrice: 120.00,
        investedAmount: 90387.54,
        purchaseDate: "2025-07-31T00:00:00Z"
      },
      {
        cnpj: "44.444.444/0001-44",
        name: "ARMOR AXE FIC FIM RL",
        quotas: 633,
        avgPrice: 180.00,
        investedAmount: 98137.16,
        purchaseDate: "2025-07-31T00:00:00Z"
      }
    ];
    
    console.log('Testing fund storage with your positions...');
    
    // Clear existing portfolio first
    try {
      await storage.deletePortfolio(userId);
    } catch (e) {
      // Portfolio might not exist, that's okay
    }
    
    // Add all fund positions
    for (const position of positions) {
      await storage.addFundPosition(userId, position);
    }
    
    // Get portfolio
    const portfolio = await storage.getFundPortfolio(userId);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Fund storage test completed successfully',
      portfolio: portfolio,
      fundCount: portfolio.positions.length,
      totalInvested: portfolio.totalInvested,
      summary: portfolio.positions.map((f: any) => ({
        name: f.name,
        quotas: f.quotas,
        investedAmount: f.investedAmount,
        avgPrice: f.avgPrice
      }))
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error testing fund storage:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}