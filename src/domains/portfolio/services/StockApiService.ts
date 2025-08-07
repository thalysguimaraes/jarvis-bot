import { StockData, PortfolioItem, BrapiQuoteResponse } from '../types';
import { ILogger } from '../../../core/logging/Logger';

export interface IStockApiService {
  fetchPrices(tickers: string[]): Promise<Map<string, StockData>>;
}

export class BrapiStockApiService implements IStockApiService {
  private readonly baseUrl = 'https://brapi.dev/api/quote';
  
  constructor(
    private readonly apiToken: string,
    private readonly logger: ILogger
  ) {}

  async fetchPrices(tickers: string[]): Promise<Map<string, StockData>> {
    if (tickers.length === 0) {
      return new Map();
    }

    const stockData = new Map<string, StockData>();
    const tickerSet = new Set(tickers);
    
    try {
      // Use the list endpoint to get all stocks at once
      const url = `${this.baseUrl}/list?token=${this.apiToken}`;
      
      this.logger.debug('Fetching stock prices from list endpoint', { tickers });
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Brapi API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      
      if (!data.stocks || !Array.isArray(data.stocks)) {
        this.logger.warn('Unexpected response format from Brapi API', { tickers });
        return stockData;
      }
      
      // Filter and map the stocks we need
      for (const stock of data.stocks) {
        if (tickerSet.has(stock.stock)) {
          stockData.set(stock.stock, {
            price: stock.close || 0,
            previousClose: stock.close || 0, // List endpoint doesn't provide previous close
            change: 0, // Calculate if needed
            changePercent: 0 // Calculate if needed
          });
        }
      }
      
      // Log any missing tickers
      const foundTickers = Array.from(stockData.keys());
      const missingTickers = tickers.filter(t => !stockData.has(t));
      
      if (missingTickers.length > 0) {
        this.logger.warn('Some tickers not found in Brapi response', { missingTickers });
      }
      
      this.logger.debug('Stock prices fetched successfully', { 
        count: stockData.size,
        tickers: foundTickers
      });
      
      return stockData;
    } catch (error) {
      this.logger.error('Failed to fetch stock prices', error as Error, { tickers });
      throw error;
    }
  }
}