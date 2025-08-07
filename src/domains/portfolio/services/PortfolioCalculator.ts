import { PortfolioItem, PortfolioCalculation, StockData } from '../types';
import { IStockApiService } from './StockApiService';
import { ILogger } from '../../../core/logging/Logger';

export interface IPortfolioCalculator {
  calculatePortfolioValue(portfolio: PortfolioItem[]): Promise<PortfolioCalculation>;
}

export class PortfolioCalculator implements IPortfolioCalculator {
  constructor(
    private readonly stockApi: IStockApiService,
    private readonly logger: ILogger
  ) {}

  async calculatePortfolioValue(portfolio: PortfolioItem[]): Promise<PortfolioCalculation> {
    if (portfolio.length === 0) {
      return this.getEmptyPortfolio();
    }

    try {
      const tickers = portfolio.map(item => item.ticker);
      const stockData = await this.stockApi.fetchPrices(tickers);
      
      let currentValue = 0;
      let previousCloseValue = 0;
      
      const details = portfolio.map((item) => {
        const data = stockData.get(item.ticker);
        if (data) {
          const position = data.price * item.shares;
          const previousPosition = data.previousClose * item.shares;
          currentValue += position;
          previousCloseValue += previousPosition;
          
          return {
            ticker: item.ticker,
            currentPrice: data.price,
            position,
            dailyChange: data.change * item.shares,
            dailyChangePercent: data.changePercent
          };
        }
        
        this.logger.warn('No price data for ticker', { ticker: item.ticker });
        
        return {
          ticker: item.ticker,
          currentPrice: null,
          position: 0,
          dailyChange: 0,
          dailyChangePercent: 0
        };
      });

      const totalCost = portfolio.reduce((sum, item) => sum + (item.avgPrice * item.shares), 0);
      const dailyPnL = currentValue - previousCloseValue;
      const dailyPercentageChange = previousCloseValue > 0 ? (dailyPnL / previousCloseValue) * 100 : 0;
      const totalPnL = currentValue - totalCost;
      const totalPercentageChange = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

      const calculation: PortfolioCalculation = {
        currentValue,
        previousCloseValue,
        totalCost,
        dailyPnL,
        dailyPercentageChange,
        totalPnL,
        totalPercentageChange,
        details
      };

      this.logger.debug('Portfolio calculation completed', {
        currentValue,
        dailyPnL,
        totalPnL,
        tickerCount: portfolio.length
      });

      return calculation;
    } catch (error) {
      this.logger.error('Portfolio calculation failed', error as Error);
      throw error;
    }
  }

  private getEmptyPortfolio(): PortfolioCalculation {
    return {
      currentValue: 0,
      previousCloseValue: 0,
      totalCost: 0,
      dailyPnL: 0,
      dailyPercentageChange: 0,
      totalPnL: 0,
      totalPercentageChange: 0,
      details: []
    };
  }
}