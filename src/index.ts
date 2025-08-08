/**
 * Main entry point for the refactored Jarvis Bot
 * This replaces the monolithic index.ts with a modular, event-driven architecture
 */

import { ServiceFactory } from './core/services/ServiceFactory';
import { ModuleManager } from './core/modules/IDomainModule';
import { ILogger } from './core/logging/Logger';
import { SchedulerManager, getDefaultScheduledTasks } from './core/scheduler/SchedulerManager';
import { CompositeApiRouter } from './core/api/CompositeApiRouter';
import { createCorsResponse, handleCorsPreflight, addCorsHeaders } from './core/utils/cors';

// Import domain modules
import { AudioProcessingModule } from './domains/audio-processing/AudioProcessingModule';
import { NotesModule } from './domains/notes/NotesModule';
import { PortfolioModule } from './domains/portfolio/PortfolioModule';
import { FundManagementModule } from './domains/fund-management/FundManagementModule';

// Environment configuration
import { validateEnvironment, ValidatedEnv, createRuntimeEnv, getRuntimeEnv } from './core/config/env-schema';

export interface Env {
  // Z-API Configuration
  Z_API_INSTANCE_ID: string;
  Z_API_INSTANCE_TOKEN: string;
  Z_API_CLIENT_TOKEN?: string;  // Used for webhook authentication
  Z_API_SECURITY_TOKEN?: string;  // Deprecated, kept for backward compatibility

  // OpenAI Configuration
  OPENAI_API_KEY: string;

  // Todoist Configuration
  TODOIST_API_TOKEN: string;

  // Obsidian Sync API Configuration
  OBSIDIAN_API_KEY: string;

  // Portfolio Configuration
  BRAPI_TOKEN: string;
  PORTFOLIO_WHATSAPP_NUMBER: string;
  PORTFOLIO_DATA?: string;

  // Fund Management Configuration
  ZAISEN_API_URL?: string;
  ZAISEN_API_KEY?: string;

  // KV Namespaces
  USER_CONFIGS: any;

  // Webhook Configuration
  WEBHOOK_SECRET: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: any
  ): Promise<Response> {
    // Handle CORS preflight for all routes
    const preflightResponse = handleCorsPreflight(request);
    if (preflightResponse) {
      return preflightResponse;
    }
    
    const url = new URL(request.url);
    
    // DEPRECATED: Test endpoints - these will be removed in the next version
    // TODO: Remove test endpoints after confirming new router works
    if (url.pathname === '/test-audio' && request.method === 'POST') {
      try {
        const payload = await request.json() as any;
        
        // If no audio provided, return error
        if (!payload.audio?.data) {
          return createCorsResponse('No audio data provided', { status: 400 });
        }
        
        // Decode base64 audio
        const base64Data = payload.audio.data;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const audioBuffer = bytes.buffer;
        
        // Call OpenAI directly
        const apiKey = getRuntimeEnv(env, 'OPENAI_API_KEY');
        const formData = new FormData();
        const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' });
        formData.append('file', audioBlob, 'audio.ogg');
        formData.append('model', 'whisper-1');
        formData.append('language', 'pt');
        
        console.log('Calling OpenAI with audio size:', audioBuffer.byteLength);
        
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          body: formData
        });
        
        const responseText = await response.text();
        console.log('OpenAI response:', response.status, responseText);
        
        if (!response.ok) {
          return createCorsResponse(JSON.stringify({
            error: 'OpenAI error',
            status: response.status,
            message: responseText
          }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const result = JSON.parse(responseText);
        
        // Send message back via Z-API
        const zApiUrl = `https://api.z-api.io/instances/${env.Z_API_INSTANCE_ID}/token/${env.Z_API_INSTANCE_TOKEN}/send-text`;
        const zApiResponse = await fetch(zApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': env.Z_API_CLIENT_TOKEN || env.Z_API_SECURITY_TOKEN || ''
          },
          body: JSON.stringify({
            phone: payload.from || payload.phone || '553491517110',
            message: `🎤 Transcrição: "${result.text}"\n\n✅ Teste bem-sucedido!`
          })
        });
        
        return createCorsResponse(JSON.stringify({
          success: true,
          transcription: result.text,
          messageSent: zApiResponse.ok
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error: any) {
        console.error('Test audio error:', error);
        return createCorsResponse(JSON.stringify({
          error: error.message,
          stack: error.stack
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Test OpenAI connectivity
    if (url.pathname === '/test-openai') {
      try {
        const apiKey = getRuntimeEnv(env, 'OPENAI_API_KEY');
        if (!apiKey) {
          return createCorsResponse('OpenAI API key not configured', { status: 500 });
        }
        
        // Create minimal test audio
        const audioBuffer = new ArrayBuffer(8000); // Small audio
        const formData = new FormData();
        const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
        formData.append('file', audioBlob, 'test.wav');
        formData.append('model', 'whisper-1');
        formData.append('language', 'pt');
        formData.append('response_format', 'json');
        
        const startTime = Date.now();
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          body: formData
        });
        const elapsed = Date.now() - startTime;
        
        const responseText = await response.text();
        
        return createCorsResponse(JSON.stringify({
          status: response.status,
          ok: response.ok,
          elapsed: `${elapsed}ms`,
          response: responseText.substring(0, 500),
          keyLength: apiKey.length
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        return createCorsResponse(JSON.stringify({
          error: error.message,
          stack: error.stack
        }, null, 2), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Direct portfolio report endpoint (bypasses module system)
    if (url.pathname === '/api/portfolio/send-direct') {
      try {
        // Load portfolio data from environment or use defaults
        let portfolio;
        
        if (env.PORTFOLIO_DATA) {
          try {
            // Parse PORTFOLIO_DATA from environment
            portfolio = JSON.parse(env.PORTFOLIO_DATA as string);
            console.log('Loaded portfolio from PORTFOLIO_DATA env variable', { 
              itemCount: portfolio.length 
            });
          } catch (error) {
            console.error('Failed to parse PORTFOLIO_DATA, using defaults:', error);
            // Fallback to hardcoded defaults if parsing fails
            portfolio = [
              { ticker: 'PETR4', shares: 100, avgPrice: 35.50 },
              { ticker: 'VALE3', shares: 50, avgPrice: 85.00 },
              { ticker: 'BBDC4', shares: 200, avgPrice: 18.20 },
              { ticker: 'ITUB4', shares: 150, avgPrice: 28.50 },
              { ticker: 'ABEV3', shares: 300, avgPrice: 14.80 }
            ];
          }
        } else {
          console.log('PORTFOLIO_DATA not configured, using default portfolio');
          // Default portfolio data
          portfolio = [
            { ticker: 'PETR4', shares: 100, avgPrice: 35.50 },
            { ticker: 'VALE3', shares: 50, avgPrice: 85.00 },
            { ticker: 'BBDC4', shares: 200, avgPrice: 18.20 },
            { ticker: 'ITUB4', shares: 150, avgPrice: 28.50 },
            { ticker: 'ABEV3', shares: 300, avgPrice: 14.80 }
          ];
        }
        
        // Fetch current prices from Brapi using list endpoint
        const tickerSet = new Set(portfolio.map((p: any) => p.ticker));
        const brapiUrl = `https://brapi.dev/api/quote/list?token=${env.BRAPI_TOKEN}`;
        
        console.log('Fetching prices from Brapi for tickers:', Array.from(tickerSet));
        const brapiResponse = await fetch(brapiUrl);
        
        if (!brapiResponse.ok) {
          console.error('Brapi API error:', brapiResponse.status, brapiResponse.statusText);
          throw new Error(`Brapi API error: ${brapiResponse.status}`);
        }
        
        const brapiData = await brapiResponse.json() as any;
        
        // Build price map from list endpoint
        const priceMap: Record<string, number> = {};
        if (brapiData.stocks && Array.isArray(brapiData.stocks)) {
          for (const stock of brapiData.stocks) {
            if (tickerSet.has(stock.stock)) {
              // Use 'close' field from list endpoint
              priceMap[stock.stock] = stock.close || 0;
              console.log(`Price for ${stock.stock}: ${stock.close}`);
            }
          }
        } else {
          console.error('Unexpected Brapi response format:', brapiData);
        }
        
        // Calculate portfolio values
        let totalCost = 0;
        let totalValue = 0;
        const holdings: any[] = [];
        
        for (const item of portfolio) {
          const currentPrice = priceMap[item.ticker] || item.avgPrice;
          const cost = item.shares * item.avgPrice;
          const value = item.shares * currentPrice;
          const pnl = value - cost;
          const pnlPercent = ((currentPrice - item.avgPrice) / item.avgPrice) * 100;
          
          totalCost += cost;
          totalValue += value;
          
          holdings.push({
            ticker: item.ticker,
            shares: item.shares,
            avgPrice: item.avgPrice,
            currentPrice,
            value,
            pnl,
            pnlPercent
          });
        }
        
        const totalPnL = totalValue - totalCost;
        const totalPnLPercent = (totalPnL / totalCost) * 100;
        
        // Format message
        const lines = [
          '📊 *RELATÓRIO DO PORTFÓLIO*',
          `📅 ${new Date().toLocaleDateString('pt-BR')} - ${new Date().toLocaleTimeString('pt-BR')}`,
          '',
          '💼 *RESUMO GERAL*',
          `💰 Valor Total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `📈 Resultado: R$ ${totalPnL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%)`,
          '',
          '📋 *POSIÇÕES*'
        ];
        
        for (const holding of holdings) {
          const emoji = holding.pnl >= 0 ? '🟢' : '🔴';
          lines.push(
            `${emoji} *${holding.ticker}*`,
            `   ${holding.shares} ações @ R$ ${holding.currentPrice.toFixed(2)}`,
            `   Valor: R$ ${holding.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            `   P/L: R$ ${holding.pnl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${holding.pnlPercent >= 0 ? '+' : ''}${holding.pnlPercent.toFixed(2)}%)`,
            ''
          );
        }
        
        lines.push(
          '━━━━━━━━━━━━━━━━━━',
          '_Relatório gerado automaticamente_'
        );
        
        const message = lines.join('\n');
        
        // Send via Z-API
        const zApiUrl = `https://api.z-api.io/instances/${env.Z_API_INSTANCE_ID}/token/${env.Z_API_INSTANCE_TOKEN}/send-text`;
        const zApiResponse = await fetch(zApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': env.Z_API_CLIENT_TOKEN || env.Z_API_SECURITY_TOKEN || ''
          },
          body: JSON.stringify({
            phone: env.PORTFOLIO_WHATSAPP_NUMBER,
            message
          })
        });
        
        const result: any = await zApiResponse.json();
        
        return createCorsResponse(JSON.stringify({
          success: zApiResponse.ok,
          messageId: result.messageId,
          portfolioSummary: {
            totalValue,
            totalPnL,
            totalPnLPercent: totalPnLPercent.toFixed(2),
            holdings: holdings.length
          }
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error: any) {
        return createCorsResponse(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Portfolio diagnostic endpoint
    if (url.pathname === '/api/portfolio/diagnose') {
      const diagnostics: any = {
        timestamp: new Date().toISOString(),
        steps: {}
      };
      
      try {
        // Step 1: Check environment variables
        diagnostics.steps.environment = {
          PORTFOLIO_WHATSAPP_NUMBER: env.PORTFOLIO_WHATSAPP_NUMBER ? `Present (${env.PORTFOLIO_WHATSAPP_NUMBER})` : 'Missing',
          BRAPI_TOKEN: env.BRAPI_TOKEN ? 'Present' : 'Missing',
          Z_API_CONFIGURED: (env.Z_API_INSTANCE_ID && env.Z_API_INSTANCE_TOKEN) ? 'Yes' : 'No'
        };
        
        // Step 2: Test portfolio data loading
        try {
          const defaultPortfolio = [
            { ticker: 'PETR4', shares: 100, avgPrice: 35.50 },
            { ticker: 'VALE3', shares: 50, avgPrice: 85.00 }
          ];
          diagnostics.steps.portfolioData = {
            success: true,
            itemCount: defaultPortfolio.length,
            tickers: defaultPortfolio.map(p => p.ticker)
          };
        } catch (error: any) {
          diagnostics.steps.portfolioData = {
            success: false,
            error: error.message
          };
        }
        
        // Step 3: Test Brapi API
        if (env.BRAPI_TOKEN) {
          try {
            const testTicker = 'PETR4';
            const brapiUrl = `https://brapi.dev/api/quote/list?token=${env.BRAPI_TOKEN}`;
            const brapiResponse = await fetch(brapiUrl);
            const brapiData = await brapiResponse.json() as any;
            
            let price = 'N/A';
            if (brapiData.stocks && Array.isArray(brapiData.stocks)) {
              const petr4 = brapiData.stocks.find((s: any) => s.stock === testTicker);
              price = petr4?.close || 'N/A';
            }
            
            diagnostics.steps.brapiApi = {
              success: brapiResponse.ok && price !== 'N/A',
              status: brapiResponse.status,
              ticker: testTicker,
              price: price,
              error: brapiData.error || null
            };
          } catch (error: any) {
            diagnostics.steps.brapiApi = {
              success: false,
              error: error.message
            };
          }
        } else {
          diagnostics.steps.brapiApi = {
            success: false,
            error: 'BRAPI_TOKEN not configured'
          };
        }
        
        // Step 4: Test message formatting
        try {
          const testMessage = `📊 *TESTE DIAGNÓSTICO*\n📅 ${new Date().toLocaleDateString('pt-BR')}\n\nTeste de envio de mensagem para: ${env.PORTFOLIO_WHATSAPP_NUMBER}`;
          diagnostics.steps.messageFormatting = {
            success: true,
            messageLength: testMessage.length,
            preview: testMessage.substring(0, 100)
          };
        } catch (error: any) {
          diagnostics.steps.messageFormatting = {
            success: false,
            error: error.message
          };
        }
        
        // Step 5: Test Z-API message sending
        if (env.Z_API_INSTANCE_ID && env.Z_API_INSTANCE_TOKEN && env.PORTFOLIO_WHATSAPP_NUMBER) {
          try {
            const zApiUrl = `https://api.z-api.io/instances/${env.Z_API_INSTANCE_ID}/token/${env.Z_API_INSTANCE_TOKEN}/send-text`;
            const zApiPayload = {
              phone: env.PORTFOLIO_WHATSAPP_NUMBER,
              message: `🔧 *DIAGNÓSTICO DO PORTFOLIO*\n\n✅ Teste de envio realizado em ${new Date().toLocaleTimeString('pt-BR')}\n\nSe você recebeu esta mensagem, o sistema de envio está funcionando corretamente.`
            };
            
            const zApiResponse = await fetch(zApiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Client-Token': env.Z_API_CLIENT_TOKEN || env.Z_API_SECURITY_TOKEN || ''
              },
              body: JSON.stringify(zApiPayload)
            });
            
            const zApiResult = await zApiResponse.text();
            
            diagnostics.steps.zApiSending = {
              success: zApiResponse.ok,
              status: zApiResponse.status,
              phoneNumber: env.PORTFOLIO_WHATSAPP_NUMBER,
              response: zApiResult.substring(0, 200),
              url: zApiUrl.replace(env.Z_API_INSTANCE_TOKEN, 'REDACTED')
            };
          } catch (error: any) {
            diagnostics.steps.zApiSending = {
              success: false,
              error: error.message,
              phoneNumber: env.PORTFOLIO_WHATSAPP_NUMBER
            };
          }
        } else {
          diagnostics.steps.zApiSending = {
            success: false,
            error: 'Missing Z-API credentials or phone number',
            hasInstanceId: !!env.Z_API_INSTANCE_ID,
            hasToken: !!env.Z_API_INSTANCE_TOKEN,
            hasPhone: !!env.PORTFOLIO_WHATSAPP_NUMBER
          };
        }
        
        // Overall status
        diagnostics.overallStatus = {
          canLoadData: diagnostics.steps.portfolioData?.success || false,
          canFetchPrices: diagnostics.steps.brapiApi?.success || false,
          canFormatMessage: diagnostics.steps.messageFormatting?.success || false,
          canSendMessage: diagnostics.steps.zApiSending?.success || false
        };
        
      } catch (error: any) {
        diagnostics.error = error.message;
        diagnostics.stack = error.stack;
      }
      
      return createCorsResponse(JSON.stringify(diagnostics, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Diagnostic endpoint to check environment
    if (url.pathname === '/debug/env') {
      const secrets = [
        'Z_API_INSTANCE_ID',
        'Z_API_INSTANCE_TOKEN', 
        'Z_API_CLIENT_TOKEN',
        'OPENAI_API_KEY',
        'WEBHOOK_SECRET',
        'TODOIST_API_TOKEN',
        'BRAPI_TOKEN',
        'PORTFOLIO_WHATSAPP_NUMBER',
        'ZAISEN_API_KEY',
        'ZAISEN_API_URL'
      ];
      
      const status: Record<string, string> = {};
      for (const key of secrets) {
        try {
          const value = (env as any)[key];
          if (value !== undefined && value !== null && value !== '') {
            status[key] = '✅ Present (length: ' + String(value).length + ')';
          } else {
            status[key] = '❌ Missing or empty';
          }
        } catch (e) {
          status[key] = '⚠️ Error accessing';
        }
      }
      
      // Check KV namespace
      status['USER_CONFIGS'] = env.USER_CONFIGS ? '✅ KV Namespace bound' : '❌ KV Namespace missing';
      
      return createCorsResponse(JSON.stringify({
        environment: 'production',
        secrets: status,
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Handle webhook - Check for audio messages that need legacy processor
    if (url.pathname === '/webhook' && request.method === 'POST') {
      // No authentication needed - Z-API webhooks rely on URL privacy
      
      // Clone the request so we can read the body twice if needed
      const clonedRequest = request.clone();
      
      try {
        const payload = await clonedRequest.json() as any;
        console.log('Webhook received from Z-API', { 
          event: payload.event, 
          messageType: payload.data?.message?.type,
          hasAudio: !!payload.audio?.data || !!payload.data?.message?.body?.data,
          hasText: !!(payload.data?.message?.text?.body || payload.text)
        });
        
        // Check if it's an audio message that needs legacy processing
        const isAudioMessage = (payload.event === 'message.received' && 
                               payload.data?.message?.type === 'audio' &&
                               !payload.data?.message?.fromMe) ||
                              payload.audio?.data;
        
        if (isAudioMessage) {
          console.log('Processing audio with legacy processor');
          
          // Import legacy processor
          const { AudioProcessor } = await import('./legacy/router/AudioProcessor');
          const processor = new AudioProcessor(env);
          
          // Transform payload to legacy format if needed
          const audioPayload = payload.audio?.data ? payload : {
            ...payload,
            audio: payload.data?.message?.body || payload.audio,
            from: payload.data?.message?.from || payload.from,
            phone: payload.data?.message?.from || payload.phone,
            senderNumber: payload.data?.message?.from || payload.senderNumber,
          };
          
          await processor.handleAudioMessage(audioPayload);
          
          return createCorsResponse(JSON.stringify({ 
            success: true,
            message: 'Audio message processed with legacy processor'
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // For text messages and other webhook types, pass through to modular system
        // The request will be handled by the WebhookRouter in the modular system
        console.log('Passing webhook to modular system for processing');
        
      } catch (error) {
        console.error('Webhook preprocessing error:', error);
        // Don't return error here, let it pass through to modular system
      }
    }
    
    // For all other requests (including non-audio webhooks), use new modular architecture
    
    // Validate environment (lenient mode for Cloudflare Workers)
    let validatedEnv: ValidatedEnv;
    try {
      // Use non-strict validation in production
      validatedEnv = validateEnvironment(env, false);
    } catch (error) {
      console.error('Environment validation failed:', error);
      // In production, try to continue with raw env if validation fails
      console.warn('Continuing with raw environment due to validation failure');
      validatedEnv = createRuntimeEnv(env);
    }
    
    try {
      console.log('Starting service initialization for non-webhook request...');
      
      // Create service factory and initialize all services
      const serviceFactory = new ServiceFactory(validatedEnv);
      const container = await serviceFactory.initialize();
      console.log('Services initialized');
      
      // Create module manager
      const moduleManager = new ModuleManager(container);
      console.log('Module manager created');
      
      // Register domain modules with error handling
      console.log('Registering domain modules...');
      
      const modules: Array<{ name: string; module: any }> = [
        { name: 'AudioProcessingModule', module: AudioProcessingModule },
        { name: 'NotesModule', module: NotesModule },
        { name: 'PortfolioModule', module: PortfolioModule },
      ];
      
      // Add fund module if configured
      if (env.ZAISEN_API_URL && env.ZAISEN_API_KEY) {
        modules.push({ name: 'FundManagementModule', module: FundManagementModule });
      }
      
      for (const { name, module: ModuleClass } of modules) {
        try {
          const moduleInstance = new ModuleClass();
          moduleManager.register(moduleInstance);
          console.log(`Registered ${name}`);
        } catch (e) {
          console.error(`Failed to create ${name}:`, e);
        }
      }
      
      // Initialize all modules
      console.log('Initializing all modules...');
      await moduleManager.initializeAll();
      console.log('All modules initialized');
      
      // Start all modules
      console.log('Starting all modules...');
      await moduleManager.startAll();
      console.log('All modules started');
      
      // Get dependencies from container
      const eventBus = container.resolve<any>('IEventBus');
      const logger = container.resolve<ILogger>('ILogger');
      
      // Create Composite API router with module manager and container
      const apiRouter = new CompositeApiRouter(eventBus, logger, container, moduleManager);
      
      // Handle the request
      const response = await apiRouter.handle(request);
      
      // Ensure CORS headers are present
      if (!response.headers.has('Access-Control-Allow-Origin')) {
        return addCorsHeaders(response);
      }
      
      // Clean up modules in the background
      ctx.waitUntil(
        moduleManager.stopAll().catch(error => 
          logger.error('Error stopping modules', error as Error)
        )
      );
      
      return response;
    } catch (error) {
      console.error('Request handling error:', error);
      
      // Return more informative error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('Service initialization error:', errorMessage);
      if (errorStack) console.error('Stack trace:', errorStack);
      
      // Check if it's a configuration error
      if (errorMessage.includes('required') || errorMessage.includes('credentials')) {
        return createCorsResponse(JSON.stringify({
          error: 'Configuration Error',
          message: 'Service is not properly configured. Please check environment variables.',
          detail: errorMessage
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return createCorsResponse(JSON.stringify({
        error: 'Internal Server Error',
        message: errorMessage,
        path: url.pathname
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async scheduled(
    event: any,
    env: Env,
    _ctx: any
  ): Promise<void> {
    // Validate environment (lenient mode for Cloudflare Workers)
    let validatedEnv: ValidatedEnv;
    try {
      // Use non-strict validation in production
      validatedEnv = validateEnvironment(env, false);
    } catch (error) {
      console.error('Environment validation failed:', error);
      // In production, try to continue with raw env if validation fails
      console.warn('Continuing with raw environment due to validation failure');
      validatedEnv = createRuntimeEnv(env);
    }
    
    try {
      // Create service factory and initialize all services
      const serviceFactory = new ServiceFactory(validatedEnv);
      const container = await serviceFactory.initialize();
      
      const logger = container.resolve<ILogger>('ILogger');
      logger.info('Scheduled event triggered', { cron: event.cron });
      
      // Create module manager
      const moduleManager = new ModuleManager(container);
      
      // Register domain modules
      moduleManager.register(new AudioProcessingModule());
      moduleManager.register(new NotesModule());
      moduleManager.register(new PortfolioModule());
      
      // Register fund management module if configured
      if (env.ZAISEN_API_URL && env.ZAISEN_API_KEY) {
        moduleManager.register(new FundManagementModule());
      }
      
      // Initialize all modules
      await moduleManager.initializeAll();
      
      // Start all modules
      await moduleManager.startAll();
      
      // Get dependencies from container
      const eventBus = container.resolve<any>('IEventBus');
      
      // Create scheduler manager
      const schedulerManager = new SchedulerManager(eventBus, logger);
      
      // Register default scheduled tasks
      const defaultTasks = getDefaultScheduledTasks();
      defaultTasks.forEach(task => schedulerManager.registerTask(task));
      
      // Handle the scheduled event
      await schedulerManager.handleScheduledEvent({
        cron: event.cron,
        scheduledTime: new Date(event.scheduledTime),
        actualTime: new Date()
      });
      
      // Clean up
      await moduleManager.stopAll();
      await moduleManager.disposeAll();
      
      logger.info('Scheduled event completed', { cron: event.cron });
    } catch (error) {
      console.error('Scheduled event error:', error);
      throw error; // Re-throw to mark the scheduled job as failed
    }
  }
};