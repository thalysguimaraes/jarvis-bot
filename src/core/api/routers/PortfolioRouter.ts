import { DomainRouter, RouteContext } from './DomainRouter';
import { z } from 'zod';
import { EventFactory, PortfolioEventType, FundEventType } from '../../event-bus/TypedEvents';
import { validateEvent } from '../../event-bus/EventSchemas';
import { GenericEvent } from '../../event-bus/EventTypes';
import { ServiceTokens } from '../../services/ServiceRegistry';

/**
 * Router for portfolio-related endpoints
 * Handles portfolio reports, updates, and fund management
 */

// Validation schemas
const PortfolioReportRequestSchema = z.object({
  userId: z.string().default('default'),
  type: z.enum(['daily', 'weekly', 'monthly', 'on-demand']).default('on-demand'),
});

const FundPositionSchema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ must be 14 digits'),
  name: z.string().min(1).max(200),
  shares: z.number().positive(),
});

const FundCommandSchema = z.object({
  userId: z.string().default('default'),
  command: z.enum(['add', 'remove', 'update', 'list']),
  position: FundPositionSchema.optional(),
});

export class PortfolioRouter extends DomainRouter {
  protected initialize(): void {
    this.setPrefix('/api/portfolio');
    
    // Portfolio report endpoints
    this.post('/report', this.triggerPortfolioReport.bind(this), {
      description: 'Trigger portfolio report generation',
      validation: {
        body: PortfolioReportRequestSchema,
      },
    });
    
    this.get('/report/:userId', this.getPortfolioReport.bind(this), {
      description: 'Get latest portfolio report for user',
      validation: {
        params: z.object({
          userId: z.string().min(1),
        }),
      },
    });
    
    // Direct send endpoint (for immediate WhatsApp delivery)
    this.post('/send-direct', this.sendPortfolioDirectly.bind(this), {
      description: 'Send portfolio report directly via WhatsApp',
      validation: {
        body: z.object({
          userId: z.string().optional(),
          force: z.boolean().optional(),
        }),
      },
    });
    
    // Portfolio diagnostic endpoint
    this.get('/diagnose', this.diagnosePortfolio.bind(this), {
      description: 'Run portfolio system diagnostics',
    });
    
    // Fund management endpoints
    this.get('/funds/:userId', this.getUserFunds.bind(this), {
      description: 'Get user fund positions',
      validation: {
        params: z.object({
          userId: z.string().min(1),
        }),
      },
    });
    
    this.post('/funds/command', this.handleFundCommand.bind(this), {
      description: 'Execute fund management command',
      validation: {
        body: FundCommandSchema,
      },
    });
    
    // Portfolio configuration
    this.get('/config/:userId', this.getPortfolioConfig.bind(this), {
      description: 'Get user portfolio configuration',
      validation: {
        params: z.object({
          userId: z.string().min(1),
        }),
      },
    });
    
    this.put('/config/:userId', this.updatePortfolioConfig.bind(this), {
      description: 'Update user portfolio configuration',
      validation: {
        params: z.object({
          userId: z.string().min(1),
        }),
        body: z.object({
          whatsappNumber: z.string().regex(/^\d+$/).optional(),
          reportSchedule: z.enum(['daily', 'weekly', 'monthly', 'disabled']).optional(),
          portfolioData: z.array(z.object({
            ticker: z.string(),
            shares: z.number().positive(),
            avgPrice: z.number().positive(),
          })).optional(),
        }),
      },
    });
  }
  
  /**
   * Trigger portfolio report generation
   */
  private async triggerPortfolioReport(
    _request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { userId, type } = params.body;
    
    this.logger.info('Triggering portfolio report', {
      correlationId: context.correlationId,
      userId,
      type,
    });
    
    try {
      // Create typed event
      const reportEvent = EventFactory.portfolioReportRequested({
        userId,
        type,
        requestedAt: new Date(),
      }, {
        correlationId: context.correlationId,
        source: 'PortfolioRouter',
      });
      
      // Validate event
      validateEvent(PortfolioEventType.REPORT_REQUESTED, reportEvent);
      
      // Publish event (using legacy event bus for now)
      await context.eventBus.publish(new GenericEvent('portfolio.report_requested', {
        userId,
        type,
        correlationId: context.correlationId,
      }));
      
      return this.successResponse({
        message: 'Portfolio report triggered',
        userId,
        type,
        correlationId: context.correlationId,
      });
    } catch (error) {
      this.logger.error('Failed to trigger portfolio report', error as Error, {
        correlationId: context.correlationId,
        userId,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to trigger report',
        500
      );
    }
  }
  
  /**
   * Get portfolio report for user
   */
  private async getPortfolioReport(
    _request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { userId } = params.params;
    
    try {
      // Get storage service
      const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
      
      if (!storageService) {
        return this.errorResponse('Storage service not available', 503);
      }
      
      // Retrieve latest report from storage
      const reportKey = `portfolio:report:${userId}`;
      const report = await (storageService as any).get(reportKey);
      
      if (!report) {
        return this.errorResponse('No report found for user', 404);
      }
      
      return this.successResponse({
        userId,
        report: JSON.parse(report),
      });
    } catch (error) {
      this.logger.error('Failed to get portfolio report', error as Error, {
        correlationId: context.correlationId,
        userId,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to get report',
        500
      );
    }
  }
  
  /**
   * Send portfolio report directly via WhatsApp
   */
  private async sendPortfolioDirectly(
    _request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { userId = 'default', force = false } = params.body || {};
    
    this.logger.info('Sending portfolio directly', {
      correlationId: context.correlationId,
      userId,
      force,
    });
    
    try {
      // Trigger immediate report generation and sending
      await context.eventBus.publish(new GenericEvent('portfolio.send_direct', {
        userId,
        force,
        correlationId: context.correlationId,
      }));
      
      return this.successResponse({
        message: 'Portfolio report queued for sending',
        userId,
        correlationId: context.correlationId,
      });
    } catch (error) {
      this.logger.error('Failed to send portfolio directly', error as Error, {
        correlationId: context.correlationId,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to send portfolio',
        500
      );
    }
  }
  
  /**
   * Run portfolio system diagnostics
   */
  private async diagnosePortfolio(
    _request: Request,
    _params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const diagnostics: Record<string, any> = {
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId,
      services: {},
      configuration: {},
      connectivity: {},
    };
    
    try {
      // Check service availability
      const services = [
        ServiceTokens.MESSAGING,
        ServiceTokens.STORAGE,
        ServiceTokens.AI,
      ];
      
      for (const service of services) {
        diagnostics.services[service] = context.container.tryResolve(service) !== null;
      }
      
      // Check environment configuration
      const env = context.container.tryResolve(ServiceTokens.ENV) as any;
      if (env) {
        diagnostics.configuration = {
          hasBrapiToken: !!env.BRAPI_TOKEN,
          hasPortfolioNumber: !!env.PORTFOLIO_WHATSAPP_NUMBER,
          hasZaisenConfig: !!(env.ZAISEN_API_KEY && env.ZAISEN_API_URL),
        };
      }
      
      // Check external API connectivity (mock for now)
      diagnostics.connectivity = {
        brapi: 'not_tested',
        zaisen: 'not_tested',
        zapi: 'not_tested',
      };
      
      diagnostics.healthy = Object.values(diagnostics.services).every(v => v);
      
      return this.successResponse(diagnostics);
    } catch (error) {
      this.logger.error('Diagnostic failed', error as Error, {
        correlationId: context.correlationId,
      });
      
      diagnostics.error = error instanceof Error ? error.message : 'Diagnostic error';
      diagnostics.healthy = false;
      
      return this.successResponse(diagnostics, 200); // Still return 200 with error in body
    }
  }
  
  /**
   * Get user fund positions
   */
  private async getUserFunds(
    _request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { userId } = params.params;
    
    try {
      // Get storage service
      const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
      
      if (!storageService) {
        return this.errorResponse('Storage service not available', 503);
      }
      
      // Retrieve fund positions from storage
      const fundsKey = `funds:positions:${userId}`;
      const fundsData = await (storageService as any).get(fundsKey);
      
      if (!fundsData) {
        return this.successResponse({
          userId,
          positions: [],
          totalValue: 0,
        });
      }
      
      const positions = JSON.parse(fundsData);
      
      return this.successResponse({
        userId,
        positions,
        totalValue: positions.reduce((sum: number, p: any) => sum + p.value, 0),
      });
    } catch (error) {
      this.logger.error('Failed to get user funds', error as Error, {
        correlationId: context.correlationId,
        userId,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to get funds',
        500
      );
    }
  }
  
  /**
   * Handle fund management command
   */
  private async handleFundCommand(
    request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { userId, command, position } = params.body;
    
    this.logger.info('Handling fund command', {
      correlationId: context.correlationId,
      userId,
      command,
    });
    
    try {
      switch (command) {
        case 'add':
          if (!position) {
            return this.errorResponse('Position data required for add command', 400);
          }
          
          const addEvent = EventFactory.fundPositionAdded({
            userId,
            fundId: `fund_${Date.now()}`,
            cnpj: position.cnpj,
            name: position.name,
            shares: position.shares,
            value: 0, // Will be calculated by handler
          }, {
            correlationId: context.correlationId,
            source: 'PortfolioRouter',
          });
          
          validateEvent(FundEventType.POSITION_ADDED, addEvent);
          
          await context.eventBus.publish(new GenericEvent('fund.position_added', {
            userId,
            ...position,
            correlationId: context.correlationId,
          }));
          
          return this.successResponse({
            message: 'Fund position added',
            userId,
            position,
          });
          
        case 'remove':
          if (!position?.cnpj) {
            return this.errorResponse('CNPJ required for remove command', 400);
          }
          
          await context.eventBus.publish(new GenericEvent('fund.position_removed', {
            userId,
            cnpj: position.cnpj,
            correlationId: context.correlationId,
          }));
          
          return this.successResponse({
            message: 'Fund position removed',
            userId,
            cnpj: position.cnpj,
          });
          
        case 'list':
          // Redirect to getUserFunds
          return this.getUserFunds(request, { params: { userId } }, context);
          
        default:
          return this.errorResponse(`Unknown command: ${command}`, 400);
      }
    } catch (error) {
      this.logger.error('Failed to handle fund command', error as Error, {
        correlationId: context.correlationId,
        command,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Command failed',
        500
      );
    }
  }
  
  /**
   * Get portfolio configuration
   */
  private async getPortfolioConfig(
    _request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { userId } = params.params;
    
    try {
      const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
      
      if (!storageService) {
        return this.errorResponse('Storage service not available', 503);
      }
      
      const configKey = `portfolio:config:${userId}`;
      const config = await (storageService as any).get(configKey);
      
      if (!config) {
        // Return default configuration
        return this.successResponse({
          userId,
          whatsappNumber: null,
          reportSchedule: 'disabled',
          portfolioData: [],
        });
      }
      
      return this.successResponse({
        userId,
        ...JSON.parse(config),
      });
    } catch (error) {
      this.logger.error('Failed to get portfolio config', error as Error, {
        correlationId: context.correlationId,
        userId,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to get config',
        500
      );
    }
  }
  
  /**
   * Update portfolio configuration
   */
  private async updatePortfolioConfig(
    _request: Request,
    params: Record<string, any>,
    context: RouteContext
  ): Promise<Response> {
    const { userId } = params.params;
    const config = params.body;
    
    try {
      const storageService = context.container.tryResolve(ServiceTokens.STORAGE);
      
      if (!storageService) {
        return this.errorResponse('Storage service not available', 503);
      }
      
      const configKey = `portfolio:config:${userId}`;
      
      // Get existing config
      const existingConfig = await (storageService as any).get(configKey);
      const currentConfig = existingConfig ? JSON.parse(existingConfig) : {};
      
      // Merge with new config
      const updatedConfig = {
        ...currentConfig,
        ...config,
        updatedAt: new Date().toISOString(),
      };
      
      // Save updated config
      await (storageService as any).set(configKey, JSON.stringify(updatedConfig));
      
      this.logger.info('Portfolio config updated', {
        correlationId: context.correlationId,
        userId,
        changes: Object.keys(config),
      });
      
      return this.successResponse({
        message: 'Configuration updated',
        userId,
        config: updatedConfig,
      });
    } catch (error) {
      this.logger.error('Failed to update portfolio config', error as Error, {
        correlationId: context.correlationId,
        userId,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to update config',
        500
      );
    }
  }
}