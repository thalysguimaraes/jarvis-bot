import { PortfolioItem } from '../types';
import { ILogger } from '../../../core/logging/Logger';

export interface IPortfolioDataLoader {
  loadPortfolioData(data?: string): PortfolioItem[];
}

export class PortfolioDataLoader implements IPortfolioDataLoader {
  constructor(private readonly logger: ILogger) {}

  loadPortfolioData(data?: string): PortfolioItem[] {
    if (data) {
      try {
        const portfolio = JSON.parse(data) as PortfolioItem[];
        this.logger.debug('Loaded portfolio from provided data', { 
          itemCount: portfolio.length 
        });
        return portfolio;
      } catch (error) {
        this.logger.error('Failed to parse portfolio data', error as Error);
        // Don't throw here, fall back to defaults
        this.logger.warn('Falling back to default portfolio due to parse error');
      }
    }

    // Default portfolio data - only used as last resort
    const defaultPortfolio: PortfolioItem[] = [
      { ticker: 'PETR4', shares: 100, avgPrice: 35.50 },
      { ticker: 'VALE3', shares: 50, avgPrice: 85.00 },
      { ticker: 'BBDC4', shares: 200, avgPrice: 18.20 },
      { ticker: 'ITUB4', shares: 150, avgPrice: 28.50 },
      { ticker: 'ABEV3', shares: 300, avgPrice: 14.80 }
    ];

    this.logger.debug('Using default portfolio data (no configuration provided)', { 
      itemCount: defaultPortfolio.length 
    });

    return defaultPortfolio;
  }
}