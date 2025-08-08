import { StockData } from '../types';
import { ILogger } from '../../../core/logging/Logger';
import { IStockApiService } from './StockApiService';

/**
 * Yahoo Finance API Service - Fallback for when Brapi is rate-limited
 * Uses the v8 chart API which is free and doesn't require authentication
 */
export class YahooFinanceApiService implements IStockApiService {
  private readonly baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';
  
  constructor(
    private readonly logger: ILogger
  ) {}

  async fetchPrices(tickers: string[]): Promise<Map<string, StockData>> {
    if (tickers.length === 0) {
      return new Map();
    }

    const stockData = new Map<string, StockData>();
    
    // Convert Brazilian tickers to Yahoo format (add .SA suffix)
    const yahooTickers = tickers.map(ticker => `${ticker}.SA`);
    
    this.logger.info('Fetching stock prices from Yahoo Finance', { tickers });
    
    // Yahoo v8 doesn't support batch requests, so we need to make parallel requests
    const promises = yahooTickers.map(async (yahooTicker, index) => {
      const originalTicker = tickers[index];
      
      try {
        // Add small delay between requests to avoid rate limiting
        if (index > 0) {
          await this.delay(100 * index); // Stagger requests by 100ms
        }
        
        const url = `${this.baseUrl}/${yahooTicker}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; StockBot/1.0)'
          }
        });
        
        if (!response.ok) {
          this.logger.warn('Yahoo Finance API error for ticker', { 
            ticker: originalTicker, 
            status: response.status 
          });
          return null;
        }
        
        const data = await response.json() as any;
        
        // Extract price data from the response
        const chart = data.chart?.result?.[0];
        if (!chart || !chart.meta) {
          this.logger.warn('No data from Yahoo Finance for ticker', { ticker: originalTicker });
          return null;
        }
        
        const meta = chart.meta;
        const price = meta.regularMarketPrice || 0;
        const previousClose = meta.previousClose || meta.chartPreviousClose || 0;
        const change = price - previousClose;
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
        
        stockData.set(originalTicker, {
          price,
          previousClose,
          change,
          changePercent
        });
        
        this.logger.debug('Yahoo Finance price fetched', { 
          ticker: originalTicker, 
          price,
          previousClose 
        });
        
        return { ticker: originalTicker, success: true };
        
      } catch (error) {
        this.logger.error('Failed to fetch price from Yahoo Finance', error as Error, { 
          ticker: originalTicker 
        });
        return { ticker: originalTicker, success: false };
      }
    });
    
    // Wait for all requests to complete
    const results = await Promise.all(promises);
    
    // Log summary
    const successful = results.filter(r => r?.success).length;
    const failed = results.filter(r => r && !r.success).length;
    
    this.logger.info('Yahoo Finance fetch complete', {
      requested: tickers.length,
      successful,
      failed,
      tickers: Array.from(stockData.keys())
    });
    
    return stockData;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}