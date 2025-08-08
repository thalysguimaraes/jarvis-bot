import { StockData } from '../types';
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
      // Use the quote endpoint for requested tickers
      const symbols = tickers.join(',');
      const url = `${this.baseUrl}/${symbols}?token=${this.apiToken}`;
      
      this.logger.debug('Fetching stock prices', { tickers });
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Brapi API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      
      if (!data.results || !Array.isArray(data.results)) {
        this.logger.warn('No results from Brapi API', { tickers });
        return stockData;
      }
      
      // Map the results
      for (const item of data.results) {
        const symbol = item.symbol;
        if (!tickerSet.has(symbol)) continue;
        stockData.set(symbol, {
          price: item.regularMarketPrice ?? 0,
          previousClose: item.regularMarketPreviousClose ?? 0,
          change: item.regularMarketChange ?? 0,
          changePercent: item.regularMarketChangePercent ?? 0,
        });
      }
      
      // Log any missing tickers
      const foundTickers = Array.from(stockData.keys());
      const missingTickers = tickers.filter(t => !stockData.has(t));
      
      if (missingTickers.length === tickers.length) {
        // No results at all for requested tickers
        this.logger.warn('No results from Brapi API', { tickers });
      } else if (missingTickers.length > 0) {
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