import { PortfolioItem } from './types';

// This is example portfolio data - users should replace with their own positions
// You can load your portfolio from environment variables or external configuration
export const PORTFOLIO: PortfolioItem[] = JSON.parse(
  process.env.PORTFOLIO_DATA || 
  JSON.stringify([
    { ticker: 'AAPL34', shares: 100, avgPrice: 50.0 },
    { ticker: 'VALE3', shares: 500, avgPrice: 60.0 }
  ])
);
