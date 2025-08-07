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
