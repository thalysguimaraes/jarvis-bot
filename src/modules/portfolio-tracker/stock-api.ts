import { StockData } from './types';
import { PORTFOLIO } from './portfolio-data';

export async function fetchAllPrices(brapiToken: string): Promise<Map<string, StockData>> {
  const stockData = new Map<string, StockData>();
  const uniqueTickers = [...new Set(PORTFOLIO.map(item => item.ticker))];
  
  console.log(`Fetching prices for: ${uniqueTickers.join(', ')}`);
  
  // Fetch one ticker at a time due to free plan limitations
  for (const ticker of uniqueTickers) {
    try {
      const url = `https://brapi.dev/api/quote/${ticker}?token=${brapiToken}`;
      console.log(`Fetching ${ticker}...`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Error fetching ${ticker}: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const data = await response.json() as any;
      
      if (data.results && data.results[0]) {
        const stock = data.results[0];
        if (stock.regularMarketPrice !== null && stock.regularMarketPreviousClose !== null) {
          stockData.set(ticker, {
            price: stock.regularMarketPrice,
            previousClose: stock.regularMarketPreviousClose,
            change: stock.regularMarketChange || 0,
            changePercent: stock.regularMarketChangePercent || 0
          });
          console.log(`${ticker}: R$ ${stock.regularMarketPrice.toFixed(2)} (${stock.regularMarketChangePercent?.toFixed(2)}%)`);
        }
      } else {
        console.log(`No price data for ${ticker}`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching ${ticker}:`, error);
    }
  }
  
  console.log(`Returning ${stockData.size} stocks with data`);
  return stockData;
}
