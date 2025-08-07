export interface PortfolioItem {
  ticker: string;
  shares: number;
  avgPrice: number;
}

export interface StockData {
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

export interface PortfolioCalculation {
  currentValue: number;
  previousCloseValue: number;
  totalCost: number;
  dailyPnL: number;
  dailyPercentageChange: number;
  totalPnL: number;
  totalPercentageChange: number;
  details: Array<{
    ticker: string; 
    currentPrice: number | null; 
    position: number;
    dailyChange: number;
    dailyChangePercent: number;
  }>
}

export interface PortfolioConfig {
  brapiToken: string;
  whatsappNumber: string;
  portfolioData?: string;
}

export interface BrapiQuoteResponse {
  results: Array<{
    symbol: string;
    longName: string;
    regularMarketPrice: number;
    regularMarketPreviousClose: number;
    regularMarketChange: number;
    regularMarketChangePercent: number;
    currency: string;
    regularMarketTime: string;
  }>;
  requestedAt: string;
  took: string;
}

export interface PortfolioReportRequest {
  userId: string;
  type: 'daily' | 'weekly' | 'monthly' | 'on-demand';
}