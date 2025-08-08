import { DomainRouter, RouteContext } from './DomainRouter';
import { z } from 'zod';
import { AudioReceivedEvent, GenericEvent } from '../../event-bus/EventTypes';
import { EventFactory, AudioEventType } from '../../event-bus/TypedEvents';
import { validateEvent } from '../../event-bus/EventSchemas';

/**
 * Router for handling webhook requests from Z-API and other external services
 */

// Z-API Webhook payload schemas
const ZApiMessageSchema = z.object({
  event: z.string().optional(),
  type: z.string().optional(),
  fromMe: z.boolean().optional(),
  isGroup: z.boolean().optional(),
  from: z.string().optional(),
  phone: z.string().optional(),
  senderNumber: z.string().optional(),
  audio: z.object({
    data: z.string().optional(),
    mimeType: z.string().optional(),
  }).optional(),
  data: z.object({
    message: z.object({
      from: z.string().optional(),
      fromMe: z.boolean().optional(),
      type: z.string().optional(),
      body: z.object({
        data: z.string().optional(),
        mimeType: z.string().optional(),
      }).optional(),
      text: z.object({
        body: z.string().optional(),
      }).optional(),
    }).optional(),
  }).optional(),
});

export class WebhookRouter extends DomainRouter {
  protected initialize(): void {
    this.setPrefix('/webhook');
    
    // Main webhook endpoint
    this.post('', this.handleWebhook.bind(this), {
      description: 'Main webhook endpoint for Z-API messages',
      // Temporarily disabled validation to debug webhook issues
      // validation: {
      //   body: ZApiMessageSchema,
      // },
    });
    
    // Z-API specific webhook (for compatibility)
    this.post('/zapi', this.handleWebhook.bind(this), {
      description: 'Z-API specific webhook endpoint',
      // Temporarily disabled validation to debug webhook issues
      // validation: {
      //   body: ZApiMessageSchema,
      // },
    });
    
    // Webhook status endpoint
    this.get('/status', this.getWebhookStatus.bind(this), {
      description: 'Get webhook configuration status',
    });
    
    // Webhook test endpoint
    this.post('/test', this.testWebhook.bind(this), {
      description: 'Test webhook with sample data',
      validation: {
        body: z.object({
          type: z.enum(['audio', 'text', 'image']),
          userId: z.string().optional(),
        }),
      },
    });
  }
  
  /**
   * Handle incoming webhook from Z-API
   */
  private async handleWebhook(
    request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const payload = params.body || await request.json();
    
    this.logger.info('Webhook received', {
      correlationId: context.correlationId,
      type: payload.type || payload.event,
      hasAudio: !!(payload.audio?.data || payload.data?.message?.body?.data),
      fromMe: payload.fromMe || payload.data?.message?.fromMe,
      isGroup: payload.isGroup,
    });
    
    // Skip messages from self
    if (payload.fromMe || payload.data?.message?.fromMe) {
      this.logger.debug('Ignoring message from self', { correlationId: context.correlationId });
      return this.successResponse({
        processed: false,
        reason: 'Message from self',
      });
    }
    
    // Skip group messages
    if (payload.isGroup) {
      this.logger.debug('Ignoring group message', { correlationId: context.correlationId });
      return this.successResponse({
        processed: false,
        reason: 'Group message',
      });
    }
    
    // Process audio messages
    if (this.isAudioMessage(payload)) {
      return this.processAudioMessage(payload, context);
    }
    
    // Process text messages
    if (this.isTextMessage(payload)) {
      return this.processTextMessage(payload, context);
    }
    
    // Unknown message type
    return this.successResponse({
      processed: false,
      reason: 'Unknown message type',
    });
  }
  
  /**
   * Check if payload contains audio message
   */
  private isAudioMessage(payload: any): boolean {
    // Check for audio in different Z-API webhook formats
    return !!(
      payload.audio?.data ||
      (payload.event === 'message.received' && 
       payload.data?.message?.type === 'audio' &&
       payload.data?.message?.body?.data) ||
      (payload.type === 'audio' && payload.audio)
    );
  }
  
  /**
   * Check if payload contains text message
   */
  private isTextMessage(payload: any): boolean {
    return (
      payload.type === 'text' ||
      (payload.event === 'message.received' && payload.data?.message?.type === 'text') ||
      (payload.data?.message?.text?.body)
    );
  }
  
  /**
   * Process text message
   */
  private async processTextMessage(
    payload: any,
    context: RouteContext
  ): Promise<Response> {
    try {
      // Extract text content
      const text = payload.text || 
                   payload.data?.message?.text?.body || 
                   payload.data?.message?.body ||
                   '';
      
      // Extract user identifier
      const userId = payload.from || 
                    payload.phone || 
                    payload.senderNumber ||
                    payload.data?.message?.from ||
                    'unknown';
      
      this.logger.info('Processing text message', {
        correlationId: context.correlationId,
        userId,
        text: text.substring(0, 100), // Log first 100 chars
      });
      
      // Check for portfolio commands
      const lowerText = text.toLowerCase().trim();
      const portfolioKeywords = [
        'portfolio', 'portfólio', 'carteira', 
        'meu portfolio', 'meu portfólio', 'minha carteira',
        'posição', 'posições', 'saldo', 'patrimônio',
        'investimentos', 'ações', 'fundos'
      ];
      
      const isPortfolioCommand = portfolioKeywords.some(keyword => 
        lowerText.includes(keyword)
      );
      
      if (isPortfolioCommand) {
        // Publish portfolio instant report event
        await context.eventBus.publish(new GenericEvent('portfolio.instant_report', {
          userId,
          phoneNumber: userId,
          text,
          requestedAt: new Date().toISOString(),
        }, {
          correlationId: context.correlationId,
          source: 'WebhookRouter',
        }));
        
        this.logger.info('Portfolio command detected and event published', {
          correlationId: context.correlationId,
          userId,
        });
        
        return this.successResponse({
          processed: true,
          correlationId: context.correlationId,
          message: 'Portfolio report request queued',
        });
      }
      
      // No matching command
      this.logger.debug('No command detected in text message', {
        correlationId: context.correlationId,
        userId,
      });
      
      return this.successResponse({
        processed: false,
        reason: 'No recognized command',
      });
      
    } catch (error) {
      this.logger.error('Failed to process text message', error as Error, {
        correlationId: context.correlationId,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Text processing failed',
        500
      );
    }
  }
  
  /**
   * Process audio message
   */
  private async processAudioMessage(
    payload: any,
    context: RouteContext
  ): Promise<Response> {
    try {
      // Extract audio data and metadata
      const audioData = payload.audio?.data || payload.data?.message?.body?.data;
      const mimeType = payload.audio?.mimeType || 
                       payload.data?.message?.body?.mimeType || 
                       'audio/ogg';
      
      // Extract user identifier
      const userId = payload.from || 
                    payload.phone || 
                    payload.senderNumber ||
                    payload.data?.message?.from ||
                    'unknown';
      
      this.logger.info('Processing audio message', {
        correlationId: context.correlationId,
        userId,
        mimeType,
        dataLength: audioData?.length,
      });
      
      // Create typed audio received event
      const audioEvent = EventFactory.audioReceived({
        userId,
        audioData,
        mimeType,
        source: 'whatsapp',
      }, {
        correlationId: context.correlationId,
        source: 'WebhookRouter',
      });
      
      // Validate event
      try {
        validateEvent(AudioEventType.RECEIVED, audioEvent);
      } catch (error) {
        this.logger.error('Event validation failed', error as Error, {
          correlationId: context.correlationId,
        });
        return this.errorResponse('Invalid audio event data', 400);
      }
      
      // Publish event using legacy event bus (for now)
      // TODO: Replace with TypedEventBus when implemented
      await context.eventBus.publish(new AudioReceivedEvent({
        userId,
        audioData,
        mimeType,
      }, {
        correlationId: context.correlationId,
        source: 'WebhookRouter',
      }));
      
      this.logger.info('Audio event published', {
        correlationId: context.correlationId,
        userId,
        eventType: AudioEventType.RECEIVED,
      });
      
      return this.successResponse({
        processed: true,
        correlationId: context.correlationId,
        message: 'Audio message queued for processing',
      });
    } catch (error) {
      this.logger.error('Failed to process audio message', error as Error, {
        correlationId: context.correlationId,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Audio processing failed',
        500
      );
    }
  }
  
  /**
   * Get webhook configuration status
   */
  private async getWebhookStatus(
    _request: Request,
    _params: Record<string, any>,
    _context: RouteContext
  ): Promise<Response> {
    const status = {
      active: true,
      endpoints: {
        main: '/webhook',
        zapi: '/webhook/zapi',
        test: '/webhook/test',
      },
      supportedTypes: ['audio', 'text', 'image'],
      audioProcessing: {
        enabled: true,
        formats: ['audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/mp4'],
      },
      timestamp: new Date().toISOString(),
    };
    
    return this.successResponse(status);
  }
  
  /**
   * Test webhook with sample data
   */
  private async testWebhook(
    _request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { type, userId = 'test-user' } = params.body;
    
    this.logger.info('Test webhook triggered', {
      correlationId: context.correlationId,
      type,
      userId,
    });
    
    try {
      switch (type) {
        case 'audio':
          // Create a test audio event
          // Test audio event creation (event not used in test mode)
          EventFactory.audioReceived({
            userId,
            audioData: 'test-audio-data-base64',
            mimeType: 'audio/ogg',
            source: 'test',
          }, {
            correlationId: context.correlationId,
            source: 'WebhookRouter:test',
          });
          
          await context.eventBus.publish(new AudioReceivedEvent({
            userId,
            audioData: 'test-audio-data-base64',
            mimeType: 'audio/ogg',
          }, {
            correlationId: context.correlationId,
            source: 'WebhookRouter:test',
          }));
          
          return this.successResponse({
            message: 'Test audio event published',
            correlationId: context.correlationId,
            eventType: AudioEventType.RECEIVED,
          });
          
        case 'text':
          return this.successResponse({
            message: 'Text processing not yet implemented',
            type,
          });
          
        case 'image':
          return this.successResponse({
            message: 'Image processing not yet implemented',
            type,
          });
          
        default:
          return this.errorResponse(`Unknown test type: ${type}`, 400);
      }
    } catch (error) {
      this.logger.error('Test webhook failed', error as Error, {
        correlationId: context.correlationId,
        type,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Test failed',
        500
      );
    }
  }
}