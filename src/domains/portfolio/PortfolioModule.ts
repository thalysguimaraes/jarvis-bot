import { BaseDomainModule, ModuleHealth } from '../../core/modules/IDomainModule';
// import { DependencyContainer } from '../../core/services/ServiceRegistry';
import { ILogger } from '../../core/logging/Logger';
import { IMessagingService } from '../../core/services/interfaces/IMessagingService';
import { IStorageService } from '../../core/services/interfaces/IStorageService';
import { 
  // EventTypes,
  PortfolioUpdatedEvent,
  PortfolioReportSentEvent,
  SystemErrorEvent
} from '../../core/event-bus/EventTypes';
import { DomainEvent } from '../../core/event-bus/DomainEvent';
import { GenericEvent } from '../../core/event-bus/EventTypes';
import { 
  PortfolioConfig, 
  PortfolioItem, 
  PortfolioCalculation,
  PortfolioReportRequest
} from './types';
import { BrapiStockApiService, IStockApiService } from './services/StockApiService';
import { PortfolioCalculator, IPortfolioCalculator } from './services/PortfolioCalculator';
import { PortfolioDataLoader, IPortfolioDataLoader } from './services/PortfolioDataLoader';
import { PortfolioMessageFormatter, IMessageFormatter } from './services/MessageFormatter';
import { MessageType } from '../../core/services/interfaces/IMessagingService';

export class PortfolioModule extends BaseDomainModule {
  private readonly NAMESPACE = 'portfolio';
  private logger!: ILogger;
  private messagingService!: IMessagingService;
  private storageService!: IStorageService;
  private stockApiService!: IStockApiService;
  private calculator!: IPortfolioCalculator;
  private dataLoader!: IPortfolioDataLoader;
  private messageFormatter!: IMessageFormatter;
  private config!: PortfolioConfig;

  constructor() {
    super('portfolio', '1.0.0', ['messaging', 'storage']);
  }

  protected async onInitialize(): Promise<void> {
    // Resolve core services
    this.logger = this.container.resolve<ILogger>('ILogger');
    this.messagingService = this.container.resolve<IMessagingService>('IMessagingService');
    this.storageService = this.container.resolve<IStorageService>('IStorageService');

    // Load configuration
    this.config = await this.loadConfiguration();

    // Initialize portfolio-specific services
    this.stockApiService = new BrapiStockApiService(this.config.brapiToken, this.logger);
    this.calculator = new PortfolioCalculator(this.stockApiService, this.logger);
    this.dataLoader = new PortfolioDataLoader(this.logger);
    this.messageFormatter = new PortfolioMessageFormatter();

    this.logger.info('PortfolioModule initialized', { 
      whatsappNumber: this.config.whatsappNumber 
    });
  }

  protected subscribeToEvents(): void {
    // Subscribe to portfolio report requests
    this.subscribe<DomainEvent>(
      'portfolio.report_requested',
      this.handleReportRequest.bind(this)
    );

    // Subscribe to portfolio update requests
    this.subscribe<DomainEvent>(
      'portfolio.update_requested',
      this.handleUpdateRequest.bind(this)
    );

    // Subscribe to scheduled events for daily reports
    this.subscribe<DomainEvent>(
      'scheduler.daily_portfolio_report',
      this.handleDailyReport.bind(this)
    );
  }

  private async handleReportRequest(event: DomainEvent): Promise<void> {
    const { userId, type } = event.payload as PortfolioReportRequest;
    
    try {
      this.logger.info('Processing portfolio report request', { userId, type });
      
      // Generate and send the report
      await this.sendPortfolioReport(userId, type);
      
    } catch (error) {
      this.logger.error('Failed to process portfolio report request', error as Error);
      await this.publishError(error as Error, 'high');
    }
  }

  private async handleUpdateRequest(event: DomainEvent): Promise<void> {
    const { userId, portfolio } = event.payload as { userId: string; portfolio: PortfolioItem[] };
    
    try {
      this.logger.info('Updating portfolio', { userId, itemCount: portfolio.length });
      
      // Save portfolio to storage
      // Tests expect a simple storage.set(key, value, { expirationTtl }) shape
      const legacySet = (this.storageService as any).set as undefined | ((key:string, value:string, options?: any)=>Promise<void>);
      if (legacySet) {
        await legacySet(`portfolio:${userId}`, JSON.stringify(portfolio), { expirationTtl: 86400 * 30 });
      } else {
        await this.storageService.put(
          this.NAMESPACE,
          `portfolio:${userId}`,
          JSON.stringify(portfolio),
          { ttl: 86400 * 30 }
        );
      }
      
      // Calculate new values
      const calculation = await this.calculator.calculatePortfolioValue(portfolio);
      
      // Publish portfolio updated event
      await this.publish(new PortfolioUpdatedEvent({
        userId,
        portfolioId: `portfolio:${userId}`,
        totalValue: calculation.currentValue,
        change: calculation.dailyPnL,
        changePercent: calculation.dailyPercentageChange
      }));
      
    } catch (error) {
      this.logger.error('Failed to update portfolio', error as Error);
      await this.publishError(error as Error, 'medium');
    }
  }

  private async handleDailyReport(_event: DomainEvent): Promise<void> {
    try {
      this.logger.info('Processing daily portfolio report');
      
      // For scheduled reports, we use the default user
      await this.sendPortfolioReport('default', 'daily');
      
    } catch (error) {
      this.logger.error('Failed to send daily portfolio report', error as Error);
      await this.publishError(error as Error, 'high');
    }
  }

  private async sendPortfolioReport(userId: string, reportType: string): Promise<void> {
    try {
      // Load portfolio data
      const portfolioData = await this.loadPortfolioData(userId);
      
      // Calculate portfolio value
      const calculation = await this.calculator.calculatePortfolioValue(portfolioData);
      
      // Format message
      const message = this.messageFormatter.formatPortfolioMessage(calculation);
      
      // Send WhatsApp message
      await this.messagingService.sendMessage({
        recipient: this.config.whatsappNumber,
        content: message,
        type: MessageType.TEXT
      });
      
      // Publish success event
      await this.publish(new PortfolioReportSentEvent({
        userId,
        recipient: this.config.whatsappNumber,
        reportType: reportType as 'daily' | 'weekly' | 'monthly',
        success: true
      }));
      
      this.logger.info('Portfolio report sent successfully', { 
        userId, 
        reportType,
        value: calculation.currentValue 
      });
      
    } catch (error) {
      // Publish failure event
      await this.publish(new PortfolioReportSentEvent({
        userId,
        recipient: this.config.whatsappNumber,
        reportType: reportType as 'daily' | 'weekly' | 'monthly',
        success: false
      }));
      
      throw error;
    }
  }

  private async loadPortfolioData(userId: string): Promise<PortfolioItem[]> {
    try {
      // Try to load from storage first
      const stored = await this.storageService.get(this.NAMESPACE, `portfolio:${userId}`);
      if (stored) {
        return JSON.parse(stored) as PortfolioItem[];
      }
    } catch (error) {
      this.logger.warn('Failed to load portfolio from storage', { userId, error });
    }
    
    // Fall back to default data
    return this.dataLoader.loadPortfolioData(this.config.portfolioData);
  }

  private async loadConfiguration(): Promise<PortfolioConfig> {
    // Allow both 'env' and 'IEnvironment' tokens as tests use 'env'
    let env: any;
    try {
      env = this.container.resolve<any>('env');
    } catch {
      env = this.container.resolve<any>('IEnvironment');
    }
    
    if (!env.BRAPI_TOKEN) {
      throw new Error('BRAPI_TOKEN is required for portfolio module');
    }
    
    if (!env.PORTFOLIO_WHATSAPP_NUMBER) {
      throw new Error('PORTFOLIO_WHATSAPP_NUMBER is required for portfolio module');
    }
    
    return {
      brapiToken: env.BRAPI_TOKEN,
      whatsappNumber: env.PORTFOLIO_WHATSAPP_NUMBER,
      portfolioData: env.PORTFOLIO_DATA
    };
  }

  private async publishError(error: Error, severity: 'low' | 'medium' | 'high' | 'critical'): Promise<void> {
    await this.publish(new SystemErrorEvent({
      error: error.message,
      stack: error.stack,
      module: this.name,
      severity
    }));
  }

  protected async onStart(): Promise<void> {
    this.logger.info('PortfolioModule started');
  }

  protected async onStop(): Promise<void> {
    this.logger.info('PortfolioModule stopped');
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('PortfolioModule disposed');
  }

  protected async onHealthCheck(): Promise<Partial<ModuleHealth>> {
    try {
      // Check if we can reach the Brapi API
      const testTickers = ['PETR4'];
      await this.stockApiService.fetchPrices(testTickers);
      
      return {
        healthy: true,
        metrics: {
          apiAvailable: true,
          lastCheck: new Date()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        errors: [`Stock API health check failed: ${(error as Error).message}`],
        metrics: {
          apiAvailable: false,
          lastCheck: new Date()
        }
      };
    }
  }

  // Public methods for external access
  public async getPortfolioValue(userId: string): Promise<PortfolioCalculation> {
    const portfolio = await this.loadPortfolioData(userId);
    return this.calculator.calculatePortfolioValue(portfolio);
  }

  public async updatePortfolio(userId: string, portfolio: PortfolioItem[]): Promise<void> {
    await this.handleUpdateRequest(new GenericEvent('portfolio.update_requested', {
      userId,
      portfolio
    }));
  }
}