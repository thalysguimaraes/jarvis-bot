import { 
  FundPosition, 
  FundPortfolioCalculation
} from '../types';
import { IFundApiService } from './ZaisenApiService';
import { ILogger } from '../../../core/logging/Logger';

export interface IFundCalculator {
  calculatePortfolioValue(positions: FundPosition[]): Promise<FundPortfolioCalculation>;
}

export class FundCalculator implements IFundCalculator {
  constructor(
    private fundApi: IFundApiService,
    private logger: ILogger
  ) {}

  async calculatePortfolioValue(positions: FundPosition[]): Promise<FundPortfolioCalculation> {
    if (positions.length === 0) {
      return this.getEmptyPortfolio();
    }

    try {
      // Get current quotes for all funds
      const cnpjs = positions.map(p => p.cnpj);
      const quotes = await this.fundApi.getMultipleQuotes(cnpjs);
      
      let totalInvested = 0;
      let currentValue = 0;
      
      const calculatedPositions = positions.map(position => {
        const quote = quotes.get(position.cnpj);
        const invested = position.quotas * position.avgPrice;
        totalInvested += invested;
        
        if (quote) {
          const positionValue = position.quotas * quote.lastQuote;
          currentValue += positionValue;
          const performance = positionValue - invested;
          const performancePercent = invested > 0 ? (performance / invested) * 100 : 0;
          
          return {
            cnpj: position.cnpj,
            name: position.name || quote.name,
            quotas: position.quotas,
            avgPrice: position.avgPrice,
            currentQuotaValue: quote.lastQuote,
            currentValue: positionValue,
            performance,
            performancePercent
          };
        } else {
          // No quote available - use last known value or avg price
          const fallbackValue = position.currentQuotaValue || position.avgPrice;
          const positionValue = position.quotas * fallbackValue;
          currentValue += positionValue;
          
          this.logger.warn('No quote available for fund', { 
            cnpj: position.cnpj, 
            name: position.name 
          });
          
          return {
            cnpj: position.cnpj,
            name: position.name || 'Unknown Fund',
            quotas: position.quotas,
            avgPrice: position.avgPrice,
            currentQuotaValue: fallbackValue,
            currentValue: positionValue,
            performance: positionValue - invested,
            performancePercent: invested > 0 ? ((positionValue - invested) / invested) * 100 : 0
          };
        }
      });
      
      const totalPerformance = currentValue - totalInvested;
      const totalPerformancePercent = totalInvested > 0 
        ? (totalPerformance / totalInvested) * 100 
        : 0;
      
      const calculation: FundPortfolioCalculation = {
        totalInvested,
        currentValue,
        totalPerformance,
        totalPerformancePercent,
        positions: calculatedPositions
      };
      
      this.logger.debug('Fund portfolio calculation completed', {
        totalInvested,
        currentValue,
        totalPerformance,
        fundCount: positions.length
      });
      
      return calculation;
    } catch (error) {
      this.logger.error('Fund portfolio calculation failed', error as Error);
      throw error;
    }
  }

  private getEmptyPortfolio(): FundPortfolioCalculation {
    return {
      totalInvested: 0,
      currentValue: 0,
      totalPerformance: 0,
      totalPerformancePercent: 0,
      positions: []
    };
  }
}