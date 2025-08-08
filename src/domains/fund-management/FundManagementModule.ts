import { BaseDomainModule, ModuleHealth } from '../../core/modules/IDomainModule';
// import { DependencyContainer } from '../../core/services/ServiceRegistry';
import { ILogger } from '../../core/logging/Logger';
import { IMessagingService, MessageType } from '../../core/services/interfaces/IMessagingService';
import { IStorageService } from '../../core/services/interfaces/IStorageService';
import { 
  EventTypes,
  FundPositionAddedEvent,
  // FundPositionUpdatedEvent,
  SystemErrorEvent,
  AudioClassifiedEvent
} from '../../core/event-bus/EventTypes';
import { DomainEvent } from '../../core/event-bus/DomainEvent';
import { GenericEvent } from '../../core/event-bus/EventTypes';
import { 
  FundConfig,
  FundPosition,
  FundCommand,
  UserFundPortfolio,
  FundPortfolioCalculation
} from './types';
import { ZaisenApiService, IFundApiService } from './services/ZaisenApiService';
import { FundCalculator, IFundCalculator } from './services/FundCalculator';
import { FundPortfolioManager, IFundPortfolioManager } from './services/FundPortfolioManager';

export class FundManagementModule extends BaseDomainModule {
  private logger!: ILogger;
  private messagingService!: IMessagingService;
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
    this.messagingService = this.container.resolve<IMessagingService>('IMessagingService');
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
    // Subscribe to fund command events (from audio classification)
    this.subscribe<AudioClassifiedEvent>(
      EventTypes.AUDIO_CLASSIFIED,
      this.handleAudioClassified.bind(this)
    );

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

  private async handleAudioClassified(event: AudioClassifiedEvent): Promise<void> {
    if (event.payload.classification !== 'fund') {
      return;
    }

    const { userId, transcription } = event.payload;
    
    try {
      this.logger.info('Processing fund command from audio', { userId, transcription });
      
      // Parse the fund command from transcription
      const command = this.parseFundCommand(transcription);
      
      if (!command) {
        await this.sendErrorMessage(userId, 'Não consegui entender o comando de fundo. Tente novamente.');
        return;
      }

      // Process the command
      await this.processFundCommand(userId, command);
      
    } catch (error) {
      this.logger.error('Failed to process fund command', error as Error);
      await this.publishError(error as Error, 'medium');
      await this.sendErrorMessage(userId, 'Erro ao processar comando de fundo.');
    }
  }

  private parseFundCommand(transcription: string): FundCommand | null {
    const lowerText = transcription.toLowerCase();
    
    // Patterns for different commands
    if (lowerText.includes('adicionar') || lowerText.includes('comprar')) {
      // Extract CNPJ, quotas, and price from text
      const cnpjMatch = lowerText.match(/\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      const quotasMatch = lowerText.match(/(\d+(?:\.\d+)?)\s*(?:cotas?|quota)/);
      const priceMatch = lowerText.match(/(?:r\$|rs)?\s*(\d+(?:[,\.]\d+)?)/);
      
      if (cnpjMatch && quotasMatch && priceMatch) {
        return {
          type: 'add',
          cnpj: cnpjMatch[0],
          quotas: parseFloat(quotasMatch[1].replace(',', '.')),
          avgPrice: parseFloat(priceMatch[1].replace(',', '.'))
        };
      }
    } else if (lowerText.includes('remover') || lowerText.includes('vender')) {
      const cnpjMatch = lowerText.match(/\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      
      if (cnpjMatch) {
        return {
          type: 'remove',
          cnpj: cnpjMatch[0]
        };
      }
    } else if (lowerText.includes('listar') || lowerText.includes('mostrar') || lowerText.includes('posições')) {
      return { type: 'list' };
    }
    
    return null;
  }

  private async processFundCommand(userId: string, command: FundCommand): Promise<void> {
    switch (command.type) {
      case 'add':
        await this.handleAddPositionCommand(userId, command);
        break;
      case 'remove':
        await this.handleRemovePositionCommand(userId, command);
        break;
      case 'list':
        await this.handleListPositionsCommand(userId);
        break;
      default:
        this.logger.warn('Unknown fund command type', { type: command.type });
    }
  }

  private async handleAddPositionCommand(userId: string, command: FundCommand): Promise<void> {
    if (!command.cnpj || !command.quotas || !command.avgPrice) {
      await this.sendErrorMessage(userId, 'Informações incompletas para adicionar posição.');
      return;
    }

    // Validate CNPJ
    const apiService = this.fundApiService as ZaisenApiService;
    if (!apiService.validateCnpj(command.cnpj)) {
      await this.sendErrorMessage(userId, 'CNPJ inválido.');
      return;
    }

    // Get fund details
    const fundDetails = await this.fundApiService.getFundDetails(command.cnpj);
    
    if (!fundDetails) {
      await this.sendErrorMessage(userId, 'Fundo não encontrado.');
      return;
    }

    // Add position
    const position: FundPosition = {
      cnpj: command.cnpj,
      name: fundDetails.nome,
      quotas: command.quotas,
      avgPrice: command.avgPrice
    };

    await this.portfolioManager.addPosition(userId, position);
    
    // Send confirmation
    await this.sendSuccessMessage(
      userId,
      `✅ Posição adicionada:\n${fundDetails.nome}\n${command.quotas} cotas a R$ ${command.avgPrice.toFixed(2)}`
    );

    // Publish event
    await this.publish(new FundPositionAddedEvent({
      userId,
      fundId: position.id || command.cnpj,
      cnpj: command.cnpj,
      name: fundDetails.nome,
      shares: command.quotas,
      value: command.quotas * command.avgPrice
    }));
  }

  private async handleRemovePositionCommand(userId: string, command: FundCommand): Promise<void> {
    if (!command.cnpj) {
      await this.sendErrorMessage(userId, 'CNPJ não informado.');
      return;
    }

    await this.portfolioManager.removePosition(userId, command.cnpj);
    
    await this.sendSuccessMessage(userId, `✅ Posição removida: ${command.cnpj}`);
  }

  private async handleListPositionsCommand(userId: string): Promise<void> {
    const portfolio = await this.portfolioManager.getUserPortfolio(userId);
    
    if (portfolio.positions.length === 0) {
      await this.sendMessage(userId, '📊 Você não possui fundos na carteira.');
      return;
    }

    // Calculate current values
    const calculation = await this.calculator.calculatePortfolioValue(portfolio.positions);
    
    // Format and send message
    const message = this.formatPortfolioMessage(calculation);
    await this.sendMessage(userId, message);
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

  private formatPortfolioMessage(calculation: FundPortfolioCalculation): string {
    const lines: string[] = [
      '💼 *CARTEIRA DE FUNDOS*',
      '',
      `💰 Total Investido: R$ ${calculation.totalInvested.toFixed(2)}`,
      `📊 Valor Atual: R$ ${calculation.currentValue.toFixed(2)}`,
      `${this.getEmoji(calculation.totalPerformance)} Resultado: R$ ${Math.abs(calculation.totalPerformance).toFixed(2)} (${calculation.totalPerformancePercent.toFixed(2)}%)`,
      '',
      '*Posições:*'
    ];

    for (const position of calculation.positions) {
      lines.push(
        `${this.getEmoji(position.performance)} ${position.name}`,
        `  Cotas: ${position.quotas.toFixed(2)}`,
        `  Valor: R$ ${position.currentValue.toFixed(2)} (${position.performancePercent.toFixed(2)}%)`
      );
    }

    return lines.join('\n');
  }

  private getEmoji(value: number): string {
    return value >= 0 ? '🟢' : '🔴';
  }

  private async sendMessage(userId: string, content: string): Promise<void> {
    // In a real implementation, you'd get the user's WhatsApp number from storage
    const phoneNumber = userId; // Simplified for now
    
    await this.messagingService.sendMessage({
      recipient: phoneNumber,
      content,
      type: MessageType.TEXT
    });
  }

  private async sendSuccessMessage(userId: string, message: string): Promise<void> {
    await this.sendMessage(userId, message);
  }

  private async sendErrorMessage(userId: string, message: string): Promise<void> {
    await this.sendMessage(userId, `❌ ${message}`);
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