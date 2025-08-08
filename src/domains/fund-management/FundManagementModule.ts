import { BaseDomainModule, ModuleHealth } from '../../core/modules/IDomainModule';
// import { DependencyContainer } from '../../core/services/ServiceRegistry';
import { ILogger } from '../../core/logging/Logger';
import { IStorageService } from '../../core/services/interfaces/IStorageService';
import { 
  FundPositionAddedEvent,
  SystemErrorEvent
} from '../../core/event-bus/EventTypes';
import { DomainEvent } from '../../core/event-bus/DomainEvent';
import { GenericEvent } from '../../core/event-bus/EventTypes';
import { 
  FundConfig,
  FundPosition,
  UserFundPortfolio,
  FundPortfolioCalculation
} from './types';
import { ZaisenApiService, IFundApiService } from './services/ZaisenApiService';
import { FundCalculator, IFundCalculator } from './services/FundCalculator';
import { FundPortfolioManager, IFundPortfolioManager } from './services/FundPortfolioManager';

export class FundManagementModule extends BaseDomainModule {
  private logger!: ILogger;
  private storageService!: IStorageService;
  private fundApiService!: IFundApiService;
  private calculator!: IFundCalculator;
  private portfolioManager!: IFundPortfolioManager;
  private config!: FundConfig;

  constructor() {
    super('fund-management', '1.0.0', ['messaging', 'storage']);
  }

  protected async onInitialize(): Promise<void> {
    // Resolve core services
    this.logger = this.container.resolve<ILogger>('ILogger');
    this.storageService = this.container.resolve<IStorageService>('IStorageService');

    // Load configuration
    this.config = await this.loadConfiguration();

    // Initialize fund-specific services
    this.fundApiService = new ZaisenApiService(
      this.config.zaisenApiUrl,
      this.config.zaisenApiKey,
      this.logger
    );
    this.calculator = new FundCalculator(this.fundApiService, this.logger);
    this.portfolioManager = new FundPortfolioManager(this.storageService, this.logger);

    this.logger.info('FundManagementModule initialized');
  }

  protected subscribeToEvents(): void {
    // Subscribe to fund management requests
    this.subscribe<DomainEvent>(
      'fund.add_position',
      this.handleAddPosition.bind(this)
    );

    this.subscribe<DomainEvent>(
      'fund.remove_position',
      this.handleRemovePosition.bind(this)
    );

    this.subscribe<DomainEvent>(
      'fund.list_positions',
      this.handleListPositions.bind(this)
    );

    this.subscribe<DomainEvent>(
      'fund.calculate_portfolio',
      this.handleCalculatePortfolio.bind(this)
    );
  }


  private async handleAddPosition(event: DomainEvent): Promise<void> {
    const { userId, position } = event.payload as { userId: string; position: FundPosition };
    
    try {
      await this.portfolioManager.addPosition(userId, position);
      
      await this.publish(new FundPositionAddedEvent({
        userId,
        fundId: position.id || position.cnpj,
        cnpj: position.cnpj,
        name: position.name,
        shares: position.quotas,
        value: position.quotas * position.avgPrice
      }));
      
    } catch (error) {
      this.logger.error('Failed to add fund position', error as Error);
      await this.publishError(error as Error, 'medium');
    }
  }

  private async handleRemovePosition(event: DomainEvent): Promise<void> {
    const { userId, cnpj } = event.payload as { userId: string; cnpj: string };
    
    try {
      await this.portfolioManager.removePosition(userId, cnpj);
      this.logger.info('Fund position removed', { userId, cnpj });
    } catch (error) {
      this.logger.error('Failed to remove fund position', error as Error);
      await this.publishError(error as Error, 'low');
    }
  }

  private async handleListPositions(event: DomainEvent): Promise<void> {
    const { userId } = event.payload as { userId: string };
    
    try {
      const portfolio = await this.portfolioManager.getUserPortfolio(userId);
      
      // Return portfolio data via event
      await this.publish(new GenericEvent('fund.positions_listed', {
        userId,
        portfolio
      }));
      
    } catch (error) {
      this.logger.error('Failed to list fund positions', error as Error);
      await this.publishError(error as Error, 'low');
    }
  }

  private async handleCalculatePortfolio(event: DomainEvent): Promise<void> {
    const { userId } = event.payload as { userId: string };
    
    try {
      const portfolio = await this.portfolioManager.getUserPortfolio(userId);
      const calculation = await this.calculator.calculatePortfolioValue(portfolio.positions);
      
      // Return calculation via event
      await this.publish(new GenericEvent('fund.portfolio_calculated', {
        userId,
        calculation
      }));
      
    } catch (error) {
      this.logger.error('Failed to calculate fund portfolio', error as Error);
      await this.publishError(error as Error, 'medium');
    }
  }


  private async loadConfiguration(): Promise<FundConfig> {
    const env = this.container.resolve<any>('IEnvironment');
    
    if (!env.ZAISEN_API_URL || !env.ZAISEN_API_KEY) {
      throw new Error('ZAISEN_API_URL and ZAISEN_API_KEY are required for fund management module');
    }
    
    return {
      zaisenApiUrl: env.ZAISEN_API_URL,
      zaisenApiKey: env.ZAISEN_API_KEY
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
    this.logger.info('FundManagementModule started');
  }

  protected async onStop(): Promise<void> {
    this.logger.info('FundManagementModule stopped');
  }

  protected async onDispose(): Promise<void> {
    this.logger.info('FundManagementModule disposed');
  }

  protected async onHealthCheck(): Promise<Partial<ModuleHealth>> {
    try {
      // Check if we can reach the Zaisen API
      await this.fundApiService.searchFunds('test', 1);
      
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
        errors: [`Fund API health check failed: ${(error as Error).message}`],
        metrics: {
          apiAvailable: false,
          lastCheck: new Date()
        }
      };
    }
  }

  // Public methods for external access
  public async getUserPortfolio(userId: string): Promise<UserFundPortfolio> {
    return this.portfolioManager.getUserPortfolio(userId);
  }

  public async calculatePortfolio(userId: string): Promise<FundPortfolioCalculation> {
    const portfolio = await this.portfolioManager.getUserPortfolio(userId);
    return this.calculator.calculatePortfolioValue(portfolio.positions);
  }
}