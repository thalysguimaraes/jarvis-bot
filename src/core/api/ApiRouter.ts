import { IEventBus } from '../event-bus/EventBus';
import { DomainEvent } from '../event-bus/DomainEvent';
import { ILogger } from '../logging/Logger';
import { AudioReceivedEvent } from '../event-bus/EventTypes';
import { ModuleManager } from '../modules/IDomainModule';
import { NotesModule } from '../../domains/notes/NotesModule';
import { createCorsResponse, getCorsHeaders } from '../utils/cors';
import { DependencyContainer } from '../services/DependencyContainer';
import { ServiceTokens } from '../services/ServiceRegistry';
import { ValidatedEnv } from '../config/env-schema';

export interface RouteHandler {
  (request: Request, params: Record<string, any>): Promise<Response>;
}

export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
  middleware?: RouteHandler[];
}

export interface IApiRouter {
  register(route: Route): void;
  handle(request: Request): Promise<Response>;
}

export class ApiRouter implements IApiRouter {
  private routes: Route[] = [];
  private env: ValidatedEnv;
  
  constructor(
    private eventBus: IEventBus,
    private logger: ILogger,
    private container: DependencyContainer,
    private moduleManager?: ModuleManager
  ) {
    // Get environment from container
    this.env = this.container.resolve<ValidatedEnv>(ServiceTokens.ENV);
    this.registerDefaultRoutes();
  }

  register(route: Route): void {
    this.routes.push(route);
    this.logger.debug('Route registered', { 
      method: route.method, 
      path: route.path 
    });
  }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    this.logger.debug('Handling request', { method, path });
    
    // Find matching route
    const route = this.findRoute(method, path);
    
    if (!route) {
      this.logger.warn('Route not found', { method, path });
      return createCorsResponse('Not Found', { status: 404 });
    }
    
    try {
      // Extract route params
      const params = this.extractParams(route.path, path);
      
      // Run middleware if any
      if (route.middleware) {
        for (const middleware of route.middleware) {
          const response = await middleware(request, params);
          if (response.status !== 200) {
            return response;
          }
        }
      }
      
      // Execute handler
      return await route.handler(request, params);
    } catch (error) {
      this.logger.error('Route handler error', error as Error, { method, path });
      return createCorsResponse('Internal Server Error', { status: 500 });
    }
  }

  private registerDefaultRoutes(): void {
    // Health check
    this.register({
      method: 'GET',
      path: '/health',
      handler: async () => {
        return createCorsResponse(JSON.stringify({ status: 'healthy' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    });

    // Z-API webhook endpoint (both paths for compatibility)
    const webhookHandler = async (request: Request) => {
      try {
        const payload = await request.json();
        
        this.logger.info('Webhook payload received', {
          type: payload.type,
          hasAudio: !!payload.audio,
          fromMe: payload.fromMe,
          isGroup: payload.isGroup,
          from: payload.from || payload.phone || payload.senderNumber
        });
        
        // Skip messages from self
        if (payload.fromMe) {
          this.logger.debug('Ignoring message from self');
          return createCorsResponse(JSON.stringify({ success: true, message: 'Ignored (from self)' }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Skip group messages
        if (payload.isGroup) {
          this.logger.debug('Ignoring group message');
          return createCorsResponse(JSON.stringify({ success: true, message: 'Ignored (group message)' }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Process audio messages from Z-API webhook format
        if (payload.audio) {
          await this.handleZApiAudioMessage(payload);
        }
        
        return createCorsResponse(JSON.stringify({ success: true, message: 'Webhook processed' }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        this.logger.error('Webhook processing error', error as Error);
        return createCorsResponse('Bad Request', { status: 400 });
      }
    };
    
    // Register both paths
    this.register({
      method: 'POST',
      path: '/webhook',
      handler: webhookHandler
    });
    
    this.register({
      method: 'POST',
      path: '/webhook/zapi',
      handler: webhookHandler
    });

    // Portfolio report trigger
    this.register({
      method: 'POST',
      path: '/api/portfolio/report',
      handler: async (request) => {
        try {
          const body = await request.json();
          const { userId = 'default', type = 'on-demand' } = body;
          
          await this.eventBus.publish(new DomainEvent('portfolio.report_requested', {
            userId,
            type
          }));
          
          return createCorsResponse(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          this.logger.error('Portfolio report trigger error', error as Error);
          return createCorsResponse('Bad Request', { status: 400 });
        }
      }
    });

    // Fund portfolio endpoint
    this.register({
      method: 'GET',
      path: '/api/funds/:userId',
      handler: async (request, params) => {
        try {
          await this.eventBus.publish(new DomainEvent('fund.list_positions', {
            userId: params.userId
          }));
          
          return createCorsResponse(JSON.stringify({ processing: true }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          this.logger.error('Fund portfolio error', error as Error);
          return createCorsResponse('Internal Server Error', { status: 500 });
        }
      }
    });

    // Voice Sync API endpoints for Obsidian plugin
    this.register({
      method: 'GET',
      path: '/api/voice-notes/unprocessed',
      handler: async (request) => {
        return this.handleVoiceNotesRequest(request, 'unprocessed');
      }
    });

    this.register({
      method: 'GET',
      path: '/api/voice-notes/all',
      handler: async (request) => {
        return this.handleVoiceNotesRequest(request, 'all');
      }
    });

    this.register({
      method: 'GET',
      path: '/api/voice-notes/recent',
      handler: async (request) => {
        return this.handleVoiceNotesRequest(request, 'recent');
      }
    });

    this.register({
      method: 'POST',
      path: '/api/voice-notes/:noteId/processed',
      handler: async (request, params) => {
        return this.handleMarkNoteProcessed(request, params.noteId);
      }
    });

    this.register({
      method: 'POST',
      path: '/api/voice-notes/:noteId/synced',
      handler: async (request, params) => {
        return this.handleMarkNoteSynced(request, params.noteId);
      }
    });

    // CORS options handler for voice sync API
    this.register({
      method: 'OPTIONS',
      path: '/api/voice-notes/*',
      handler: async () => {
        return createCorsResponse(null, { status: 204 });
      }
    });
  }

  private async handleVoiceNotesRequest(request: Request, type: string): Promise<Response> {
    try {
      // Verify API key
      const authHeader = request.headers.get('Authorization');
      if (!this.isValidApiKey(authHeader)) {
        return createCorsResponse('Unauthorized', { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get notes module
      const notesModule = this.moduleManager?.getModule('NotesModule') as NotesModule;
      if (!notesModule) {
        return createCorsResponse('Notes module not available', { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let notes: any[] = [];
      switch (type) {
        case 'unprocessed':
          notes = await notesModule.getUnprocessedVoiceNotes();
          break;
        case 'recent':
          const url = new URL(request.url);
          const hours = parseInt(url.searchParams.get('hours') || '24');
          notes = await notesModule.getRecentVoiceNotes(hours);
          break;
        case 'all':
          const limit = parseInt(new URL(request.url).searchParams.get('limit') || '100');
          const offset = parseInt(new URL(request.url).searchParams.get('offset') || '0');
          notes = await notesModule.getAllVoiceNotes({ limit, offset });
          break;
        default:
          notes = [];
      }

      return createCorsResponse(JSON.stringify(notes), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      this.logger.error('Error fetching voice notes', error as Error);
      return createCorsResponse('Internal Server Error', { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleMarkNoteProcessed(request: Request, noteId: string): Promise<Response> {
    try {
      // Verify API key
      const authHeader = request.headers.get('Authorization');
      if (!this.isValidApiKey(authHeader)) {
        return new Response('Unauthorized', { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const notesModule = this.moduleManager?.getModule('NotesModule') as NotesModule;
      if (!notesModule) {
        return new Response('Notes module not available', { 
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const voiceSyncService = notesModule.getVoiceSyncService();
      await voiceSyncService.markNoteAsProcessed(noteId);

      return createCorsResponse(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      this.logger.error('Error marking note as processed', error as Error);
      return createCorsResponse('Internal Server Error', { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleMarkNoteSynced(request: Request, noteId: string): Promise<Response> {
    try {
      // Verify API key
      const authHeader = request.headers.get('Authorization');
      if (!this.isValidApiKey(authHeader)) {
        return new Response('Unauthorized', { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const notesModule = this.moduleManager?.getModule('NotesModule') as NotesModule;
      if (!notesModule) {
        return new Response('Notes module not available', { 
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      await notesModule.markVoiceNoteAsSynced(noteId);

      return createCorsResponse(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      this.logger.error('Error marking note as synced', error as Error);
      return createCorsResponse('Internal Server Error', { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private isValidApiKey(authHeader: string | null): boolean {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    
    const apiKey = authHeader.substring(7);
    // Get API key from Cloudflare Worker environment
    const validApiKey = this.env.OBSIDIAN_API_KEY || 'obs-voice-sync-2025-secure-api-key-v1';
    
    return apiKey === validApiKey;
  }

  private async handleAudioMessage(data: any): Promise<void> {
    const { message, sender } = data;
    
    if (!message?.audioUrl) {
      this.logger.warn('Audio message without URL', { data });
      return;
    }
    
    // Download audio data
    const audioResponse = await fetch(message.audioUrl);
    const audioData = await audioResponse.arrayBuffer();
    
    // Publish audio received event
    await this.eventBus.publish(new AudioReceivedEvent({
      userId: sender?.phone || 'unknown',
      audioData,
      mimeType: message.mimeType || 'audio/ogg',
      duration: message.duration
    }));
  }

  private async handleZApiAudioMessage(payload: any): Promise<void> {
    const userId = payload.from || payload.phone || payload.senderNumber || 'unknown';
    
    this.logger.info('Processing Z-API audio message', {
      userId,
      hasAudioUrl: !!payload.audio?.audioUrl,
      hasAudioData: !!payload.audio?.data,
      audioDataLength: payload.audio?.data?.length,
      mimeType: payload.audio?.mimeType || payload.audio?.mimetype
    });
    
    let audioData: ArrayBuffer;
    
    // Z-API can send audio as URL or base64 data
    if (payload.audio?.audioUrl) {
      // Download from URL
      try {
        const audioResponse = await fetch(payload.audio.audioUrl);
        audioData = await audioResponse.arrayBuffer();
        this.logger.debug('Downloaded audio from URL', { size: audioData.byteLength });
      } catch (error) {
        this.logger.error('Failed to download audio from URL', error as Error);
        return;
      }
    } else if (payload.audio?.data) {
      // Decode base64 data
      try {
        const base64Data = payload.audio.data;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioData = bytes.buffer;
        this.logger.debug('Decoded audio from base64', { size: audioData.byteLength });
      } catch (error) {
        this.logger.error('Failed to decode base64 audio', error as Error);
        return;
      }
    } else {
      this.logger.warn('Audio message without data or URL');
      return;
    }
    
    // Publish audio received event to all modules
    const event = new AudioReceivedEvent({
      userId,
      audioData,
      mimeType: payload.audio?.mimeType || payload.audio?.mimetype || 'audio/ogg',
      duration: payload.audio?.seconds || payload.audio?.duration,
      messageId: payload.messageId,
      timestamp: payload.timestamp || payload.momment || Date.now()
    });
    
    this.logger.info('Publishing audio event to modules', { 
      userId, 
      audioSize: audioData.byteLength,
      messageId: payload.messageId 
    });
    
    await this.eventBus.publish(event);
  }

  private findRoute(method: string, path: string): Route | undefined {
    return this.routes.find(route => {
      if (route.method !== method) return false;
      
      // Simple pattern matching
      const routeParts = route.path.split('/');
      const pathParts = path.split('/');
      
      if (routeParts.length !== pathParts.length) return false;
      
      return routeParts.every((part, index) => {
        if (part.startsWith(':')) return true; // Parameter
        return part === pathParts[index];
      });
    });
  }

  private extractParams(routePath: string, actualPath: string): Record<string, any> {
    const params: Record<string, any> = {};
    const routeParts = routePath.split('/');
    const pathParts = actualPath.split('/');
    
    routeParts.forEach((part, index) => {
      if (part.startsWith(':')) {
        const paramName = part.substring(1);
        params[paramName] = pathParts[index];
      }
    });
    
    return params;
  }
}