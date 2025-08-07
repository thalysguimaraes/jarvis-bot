import { StockData, PortfolioItem } from './types';

export async function fetchAllPrices(brapiToken: string, portfolio: PortfolioItem[]): Promise<Map<string, StockData>> {
  const stockData = new Map<string, StockData>();
  const uniqueTickers = [...new Set(portfolio.map(item => item.ticker))];
  
  console.log(`Fetching prices for: ${uniqueTickers.join(', ')}`);
  
  // Try batch request first (up to 10 tickers)
  if (uniqueTickers.length <= 10) {
    try {
      const tickerList = uniqueTickers.join(',');
      const url = `https://brapi.dev/api/quote/${tickerList}?token=${brapiToken}`;
      console.log(`Batch fetching: ${tickerList}`);
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json() as any;
        if (data.results && Array.isArray(data.results)) {
          for (const stock of data.results) {
            if (stock.symbol && stock.regularMarketPrice !== null && stock.regularMarketPreviousClose !== null) {
              stockData.set(stock.symbol, {
                price: stock.regularMarketPrice,
                previousClose: stock.regularMarketPreviousClose,
                change: stock.regularMarketChange || 0,
                changePercent: stock.regularMarketChangePercent || 0
              });
              console.log(`${stock.symbol}: R$ ${stock.regularMarketPrice.toFixed(2)} (${stock.regularMarketChangePercent?.toFixed(2)}%)`);
            }
          }
          console.log(`Batch request successful: ${stockData.size}/${uniqueTickers.length} stocks`);
          return stockData;
        }
      }
    } catch (error) {
      console.error('Batch request failed, falling back to individual requests:', error);
    }
  }
  
  // Fallback: fetch one ticker at a time
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
