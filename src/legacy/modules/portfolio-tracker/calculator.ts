import { PortfolioCalculation } from './types';
import { loadPortfolioData } from './portfolio-data';
import { fetchAllPrices } from './stock-api';

export async function calculatePortfolioValue(brapiToken: string, portfolioData?: string): Promise<PortfolioCalculation> {
  const portfolio = loadPortfolioData(portfolioData);
  const stockData = await fetchAllPrices(brapiToken, portfolio);
  
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
  const totalPercentageChange = (totalPnL / totalCost) * 100;

  return {
    currentValue,
    previousCloseValue,
    totalCost,
    dailyPnL,
    dailyPercentageChange,
    totalPnL,
    totalPercentageChange,
    details
  };
}
