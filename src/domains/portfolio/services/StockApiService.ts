import { StockData } from '../types';
import { ILogger } from '../../../core/logging/Logger';
import { YahooFinanceApiService } from './YahooFinanceApiService';

export interface IStockApiService {
  fetchPrices(tickers: string[]): Promise<Map<string, StockData>>;
}

export class BrapiStockApiService implements IStockApiService {
  private readonly baseUrl = 'https://brapi.dev/api/quote';
  private cache: Map<string, { data: Map<string, StockData>; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 60 seconds cache
  private yahooFallback: YahooFinanceApiService;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // Minimum 1 second between requests
  
  constructor(
    private readonly apiToken: string,
    private readonly logger: ILogger
  ) {
    this.yahooFallback = new YahooFinanceApiService(logger);
  }

  async fetchPrices(tickers: string[]): Promise<Map<string, StockData>> {
    if (tickers.length === 0) {
      return new Map();
    }

    // Check cache first
    const cacheKey = tickers.sort().join(',');
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      this.logger.debug('Returning cached stock prices', { 
        tickers, 
        cacheAge: Math.round((now - cached.timestamp) / 1000) + 's' 
      });
      return cached.data;
    }

    const stockData = new Map<string, StockData>();
    const tickerSet = new Set(tickers);
    
    try {
      // Add rate limiting to prevent 429 errors
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        this.logger.debug('Rate limiting: waiting before request', { waitTime });
        await this.delay(waitTime);
      }
      
      // Use the quote endpoint for requested tickers
      const symbols = tickers.join(',');
      const url = `${this.baseUrl}/${symbols}?token=${this.apiToken}`;
      
      this.logger.debug('Fetching stock prices from Brapi API', { tickers });
      
      this.lastRequestTime = Date.now();
      const response = await fetch(url);
      if (!response.ok) {
        // On rate limit error, try fallback options
        if (response.status === 429) {
          // First, try to return stale cache if available
          if (cached) {
            this.logger.warn('Brapi rate limited, returning stale cache', { 
              tickers,
              cacheAge: Math.round((now - cached.timestamp) / 1000) + 's'
            });
            return cached.data;
          }
          
          // If no cache, fall back to Yahoo Finance
          this.logger.warn('Brapi rate limited, falling back to Yahoo Finance', { tickers });
          const yahooData = await this.yahooFallback.fetchPrices(tickers);
          
          if (yahooData.size > 0) {
            // Cache the Yahoo results
            this.cache.set(cacheKey, {
              data: yahooData,
              timestamp: Date.now()
            });
            
            return yahooData;
          }
          
          // If Yahoo also fails, throw the original error
          throw new Error(`Brapi API error: ${response.status} ${response.statusText} (Yahoo fallback also failed)`);
        }
        
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
      
      // Cache the results
      this.cache.set(cacheKey, {
        data: stockData,
        timestamp: Date.now()
      });
      
      // Clean old cache entries (keep max 10 entries)
      if (this.cache.size > 10) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }
      
      return stockData;
    } catch (error) {
      this.logger.error('Failed to fetch stock prices', error as Error, { tickers });
      throw error;
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}