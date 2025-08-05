import { PortfolioItem } from './types';

// Default fallback portfolio data
const DEFAULT_PORTFOLIO: PortfolioItem[] = [
  { ticker: 'AAPL34', shares: 100, avgPrice: 50.0 },
  { ticker: 'VALE3', shares: 500, avgPrice: 60.0 }
];

// This will be dynamically loaded in the calculator
export const PORTFOLIO: PortfolioItem[] = DEFAULT_PORTFOLIO;

export function loadPortfolioData(portfolioData?: string): PortfolioItem[] {
  if (portfolioData) {
    try {
      return JSON.parse(portfolioData);
    } catch (error) {
      console.error('Error parsing PORTFOLIO_DATA:', error);
    }
  }
  return DEFAULT_PORTFOLIO;
}
